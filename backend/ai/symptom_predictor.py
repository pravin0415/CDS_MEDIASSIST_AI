"""Free-text adapter for the supplied 131-feature XGBoost symptom model."""

from functools import lru_cache
import json
from pathlib import Path
import pickle
import re

import numpy as np


ROOT_DIR = Path(__file__).resolve().parents[2]
MODEL_DIR = ROOT_DIR / "models" / "symptoms"
COLUMNS_PATH = MODEL_DIR / "symptom_columns.json"
MODEL_PATH = MODEL_DIR / "xgboost_model.pkl"
ENCODER_PATH = MODEL_DIR / "label_encoder.pkl"


def _normalise(text):
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", text.lower())).strip()


@lru_cache(maxsize=1)
def _load_artifacts():
    with COLUMNS_PATH.open(encoding="utf-8") as source:
        symptom_columns = json.load(source)
    with MODEL_PATH.open("rb") as source:
        model = pickle.load(source)
    with ENCODER_PATH.open("rb") as source:
        label_encoder = pickle.load(source)

    if not symptom_columns:
        raise ValueError("The symptom vocabulary is empty.")

    return symptom_columns, model, label_encoder


@lru_cache(maxsize=1)
def get_symptom_vocabulary():
    """Return the exact selectable symptom labels used to build model vectors."""
    with COLUMNS_PATH.open(encoding="utf-8") as source:
        return json.load(source)


def _matched_symptoms(description, symptom_columns):
    normalised_description = _normalise(description)
    available_symptoms = set(symptom_columns)

    # Translate common patient wording only when the equivalent feature exists
    # in this model's training vocabulary.  This keeps the model input
    # transparent: we never invent an unstated symptom.
    aliases = {
        "shortness of breath": ("breathlessness", "shortness of breath"),
        "difficulty breathing": ("breathlessness", "difficulty breathing"),
        "trouble breathing": ("breathlessness", "difficulty breathing"),
        "fever": ("high fever", "mild fever", "fever"),
        "high temperature": ("high fever", "fever"),
        "tired": ("fatigue",),
        "tiredness": ("fatigue",),
        "body ache": ("muscle pain", "ache all over"),
        "body aches": ("muscle pain", "ache all over"),
        "throwing up": ("vomiting",),
        "throw up": ("vomiting",),
        "loose motions": ("diarrhoea", "diarrhea"),
        "diarrhea": ("diarrhoea", "diarrhea"),
        "heart racing": ("fast heart rate", "increased heart rate"),
        "burning when i pee": ("burning micturition", "painful urination"),
        "burning while urinating": ("burning micturition", "painful urination"),
        "burning urine": ("burning micturition", "painful urination"),
    }
    matches = []

    for symptom in symptom_columns:
        normalised_symptom = _normalise(symptom)
        if re.search(rf"(?<!\w){re.escape(normalised_symptom)}(?!\w)", normalised_description):
            matches.append(symptom)

    for phrase, candidates in aliases.items():
        if phrase not in normalised_description:
            continue
        symptom = next((item for item in candidates if item in available_symptoms), None)
        if symptom and symptom not in matches:
            matches.append(symptom)

    return matches


from xai_service import compute_symptom_shap
from decision_support_service import evaluate_decision_support


def analyze_symptoms(description, selected_symptoms=None, explain_class_index=None):
    """Return ranked screening predictions and real SHAP explanations for symptoms."""
    if not description or not description.strip():
        if not selected_symptoms:
            raise ValueError("A symptom description or selected symptoms are required.")
        description = " ".join(selected_symptoms)

    symptom_columns, model, label_encoder = _load_artifacts()
    matched_symptoms = _matched_symptoms(description, symptom_columns)
    
    if selected_symptoms and isinstance(selected_symptoms, (list, set)):
        available = set(symptom_columns)
        for s in selected_symptoms:
            if s in available and s not in matched_symptoms:
                matched_symptoms.append(s)

    if not matched_symptoms:
        raise ValueError(
            "No symptoms in the submitted text match this model's supported vocabulary. "
            "Use the model's symptom terms in the patient description."
        )

    feature_vector = np.zeros((1, len(symptom_columns)), dtype=np.float32)
    column_index = {name: index for index, name in enumerate(symptom_columns)}
    for symptom in matched_symptoms:
        feature_vector[0, column_index[symptom]] = 1.0

    probabilities = np.asarray(model.predict_proba(feature_vector)[0], dtype=float)
    class_ids = np.asarray(getattr(model, "classes_", np.arange(len(probabilities))))

    # The paired LabelEncoder maps numeric model class IDs to disease names.
    if np.issubdtype(class_ids.dtype, np.number):
        labels = label_encoder.inverse_transform(class_ids.astype(int))
    else:
        labels = class_ids
    ranked_indices = np.argsort(probabilities)[::-1]

    top_predictions = [
        {
            "label": str(labels[index]),
            "confidence": round(float(probabilities[index]), 4),
            "model_score": round(float(probabilities[index]), 4),
        }
        for index in ranked_indices[:5]
    ]

    top_index = int(ranked_indices[0])
    target_class_idx = int(explain_class_index) if explain_class_index is not None else top_index

    # Evaluate decision-support tier and guidance
    decision_support = evaluate_decision_support("symptoms", {
        "predicted_disease": str(labels[top_index]),
        "model_score": float(probabilities[top_index]),
    })

    # Compute real mathematically grounded SHAP TreeExplainer feature contributions
    try:
        xai_data = compute_symptom_shap(
            model,
            feature_vector,
            target_class_idx,
            symptom_columns,
            label_encoder=label_encoder,
        )
    except Exception as exc:
        xai_data = {
            "method": "SHAP",
            "available": False,
            "error": str(exc),
            "target_disease": str(labels[top_index]),
            "top_positive_contributors": [],
            "top_negative_contributors": [],
        }

    return {
        "class_index": top_index,
        "predicted_disease": str(labels[top_index]),
        "prediction": str(labels[top_index]),
        "confidence": round(float(probabilities[top_index]), 4),
        "model_score": round(float(probabilities[top_index]), 4),
        "decision_tier": decision_support["decision_tier"],
        "decision_support": decision_support,
        "top_predictions": top_predictions,
        "matched_symptoms": matched_symptoms,
        "supported_conditions": int(len(labels)),
        "xai": xai_data,
    }
