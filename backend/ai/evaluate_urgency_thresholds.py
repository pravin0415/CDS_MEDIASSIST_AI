"""Offline audit of symptom/skin urgent-alert cutoffs on clinician-labelled cases.

CSV columns: modality,predicted_condition,model_score,true_urgent
modality is symptoms or skin; true_urgent is 1/0 from independent clinical review.
This does not calibrate scores or establish a clinically safe operating point.
"""

import argparse
import csv
from pathlib import Path

from decision_support_service import SKIN_RISK_MAP, SYMPTOM_RISK_MAP

RISK_MAPS = {"symptoms": SYMPTOM_RISK_MAP, "skin": SKIN_RISK_MAP}
URGENT = {"CRITICAL", "HIGH_URGENCY"}


def load_cases(path):
    cases = []
    with Path(path).open(newline="", encoding="utf-8-sig") as stream:
        reader = csv.DictReader(stream)
        required = {"modality", "predicted_condition", "model_score", "true_urgent"}
        if not required.issubset(reader.fieldnames or []):
            raise ValueError(f"CSV needs columns: {', '.join(sorted(required))}")
        for line, row in enumerate(reader, start=2):
            modality = row["modality"].strip().lower()
            if modality not in RISK_MAPS:
                raise ValueError(f"Line {line}: unsupported modality {modality!r}")
            condition = row["predicted_condition"].strip()
            if condition not in RISK_MAPS[modality]:
                raise ValueError(f"Line {line}: unknown condition {condition!r}")
            score = float(row["model_score"])
            if not 0 <= score <= 1:
                raise ValueError(f"Line {line}: model_score must be 0..1")
            truth = row["true_urgent"].strip()
            if truth not in {"0", "1"}:
                raise ValueError(f"Line {line}: true_urgent must be 0 or 1")
            cases.append((RISK_MAPS[modality][condition] in URGENT, score, truth == "1"))
    if not cases:
        raise ValueError("CSV has no cases")
    return cases


def evaluate(cases, threshold):
    tp = fp = tn = fn = 0
    for predicted_urgent_condition, score, truly_urgent in cases:
        alert = predicted_urgent_condition and score >= threshold
        if alert and truly_urgent:
            tp += 1
        elif alert:
            fp += 1
        elif truly_urgent:
            fn += 1
        else:
            tn += 1
    ratio = lambda a, b: f"{a / b:.3f}" if b else "N/A"
    return {
        "threshold": threshold, "TP": tp, "FP": fp, "TN": tn, "FN": fn,
        "sensitivity": ratio(tp, tp + fn), "specificity": ratio(tn, tn + fp),
        "precision": ratio(tp, tp + fp),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("cases_csv", help="Independent clinician-labelled evaluation CSV")
    args = parser.parse_args()
    cases = load_cases(args.cases_csv)
    print(f"Cases: {len(cases)}. These are screening-alert metrics, not clinical validation.")
    print("threshold  TP  FP  TN  FN  sensitivity  specificity  precision")
    for threshold in (0.35, 0.40, 0.45, 0.50, 0.55, 0.60):
        result = evaluate(cases, threshold)
        print(f"{threshold:>9.2f}  {result['TP']:>2}  {result['FP']:>2}  "
              f"{result['TN']:>2}  {result['FN']:>2}  {result['sensitivity']:>11}  "
              f"{result['specificity']:>11}  {result['precision']:>9}")
    print("Review missed urgent cases (FN) with clinicians before changing any cutoff.")


if __name__ == "__main__":
    main()
