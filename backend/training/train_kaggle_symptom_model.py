"""Train the app's XGBoost symptom model from the Kaggle symptom archive.

This creates a model only for the 41 labels present in dataset.csv. The report is
for development validation, not clinical validation.
"""

import argparse
import json
import pickle
import re
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import ConfusionMatrixDisplay, accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from xgboost import XGBClassifier


def normalise(value):
    value = str(value).strip().lower()
    value = re.sub(r"\s+", " ", value)
    return value.replace("_", " ")


def load_dataset(dataset_path):
    raw = pd.read_csv(dataset_path).fillna("")
    symptom_source_columns = [column for column in raw.columns if column != "Disease"]
    rows, labels = [], []

    for _, row in raw.iterrows():
        symptoms = {
            normalise(value)
            for value in row[symptom_source_columns]
            if str(value).strip()
        }
        if symptoms:
            rows.append(symptoms)
            labels.append(str(row["Disease"]).strip())

    symptom_columns = sorted(set().union(*rows))
    symptom_index = {symptom: index for index, symptom in enumerate(symptom_columns)}
    features = np.zeros((len(rows), len(symptom_columns)), dtype=np.float32)
    for row_index, symptoms in enumerate(rows):
        for symptom in symptoms:
            features[row_index, symptom_index[symptom]] = 1.0
    return features, labels, symptom_columns


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", required=True, help="Path to dataset.csv from the Kaggle archive")
    parser.add_argument("--output", default="symptom_model_artifacts")
    args = parser.parse_args()

    features, labels, symptom_columns = load_dataset(args.dataset)
    encoder = LabelEncoder()
    target = encoder.fit_transform(labels)
    train_x, test_x, train_y, test_y = train_test_split(
        features, target, test_size=0.2, random_state=42, stratify=target
    )

    model = XGBClassifier(
        objective="multi:softprob",
        num_class=len(encoder.classes_),
        n_estimators=350,
        max_depth=5,
        learning_rate=0.05,
        subsample=0.85,
        colsample_bytree=0.85,
        eval_metric="mlogloss",
        random_state=42,
        n_jobs=-1,
        tree_method="hist",
    )
    model.fit(train_x, train_y)

    predicted = model.predict(test_x)
    accuracy = accuracy_score(test_y, predicted)
    print(f"Validation accuracy: {accuracy:.4f}")
    print(classification_report(test_y, predicted, target_names=encoder.classes_, zero_division=0))

    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    matrix = confusion_matrix(test_y, predicted, labels=np.arange(len(encoder.classes_)))
    display = ConfusionMatrixDisplay(matrix, display_labels=encoder.classes_)
    figure = display.plot(xticks_rotation=90, include_values=False, cmap="Blues").figure_
    figure.set_size_inches(20, 20)
    figure.tight_layout()
    figure.savefig(output / "confusion_matrix.png", dpi=180)

    # Refit on all rows after reporting development validation.
    final_model = XGBClassifier(**model.get_params())
    final_model.fit(features, target)
    with (output / "xgboost_model.pkl").open("wb") as file:
        pickle.dump(final_model, file)
    with (output / "label_encoder.pkl").open("wb") as file:
        pickle.dump(encoder, file)
    (output / "symptom_columns.json").write_text(json.dumps(symptom_columns, indent=2), encoding="utf-8")
    (output / "model_metadata.json").write_text(json.dumps({
        "dataset": Path(args.dataset).name,
        "training_rows": int(len(features)),
        "symptom_count": int(len(symptom_columns)),
        "disease_count": int(len(encoder.classes_)),
        "development_validation_accuracy": float(accuracy),
        "warning": "Development result from a curated symptom dataset. Not clinical validation or a diagnosis model.",
    }, indent=2), encoding="utf-8")
    print(f"Saved artifacts to: {output.resolve()}")


if __name__ == "__main__":
    main()
