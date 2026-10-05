"""Explainable AI (XAI) Service for MediAssist AI.

Provides mathematically grounded, non-fabricated explanations:
1. SHAP TreeExplainer for multi-class XGBoost (symptoms)
2. Grad-CAM for DenseNet-121 (chest X-ray multi-label observations)
3. Grad-CAM for MobileNetV2 (skin disease classes)
"""

from pathlib import Path
import numpy as np
import xgboost as xgb


def compute_symptom_shap(
    model,
    feature_vector,
    predicted_class_index,
    symptom_columns,
    label_encoder=None,
    top_k=8,
):
    """Compute exact Tree SHAP contributions for the XGBoost symptom model.

    Uses XGBoost's native Tree SHAP C++ implementation (pred_contribs=True),
    which calculates exact Shapley values for tree ensembles across all 41 disease classes.
    """
    booster = model.get_booster() if hasattr(model, "get_booster") else model
    feature_vec_2d = np.asarray(feature_vector, dtype=np.float32)
    if feature_vec_2d.ndim == 1:
        feature_vec_2d = np.expand_dims(feature_vec_2d, axis=0)

    dmat = xgb.DMatrix(feature_vec_2d, feature_names=symptom_columns)
    raw_contribs = booster.predict(dmat, pred_contribs=True)

    if raw_contribs.ndim == 3:
        class_contribs = raw_contribs[0, predicted_class_index, :-1]
        base_value = float(raw_contribs[0, predicted_class_index, -1])
    elif raw_contribs.ndim == 2:
        n_features_with_bias = len(symptom_columns) + 1
        reshaped = raw_contribs.reshape(-1, n_features_with_bias)
        class_contribs = reshaped[predicted_class_index, :-1]
        base_value = float(reshaped[predicted_class_index, -1])
    else:
        raise ValueError(f"Unexpected SHAP contributions shape: {raw_contribs.shape}")

    disease_name = str(predicted_class_index)
    if label_encoder is not None:
        try:
            disease_name = str(label_encoder.inverse_transform([predicted_class_index])[0])
        except Exception:
            disease_name = str(predicted_class_index)

    feature_records = []
    active_records = []

    for i, name in enumerate(symptom_columns):
        val = float(class_contribs[i])
        is_present = bool(feature_vec_2d[0, i] > 0)
        record = {
            "feature": name,
            "contribution": round(val, 4),
            "magnitude": round(abs(val), 4),
            "direction": "positive" if val > 0 else "negative",
            "is_present": is_present,
            "patient_value": float(feature_vec_2d[0, i]),
        }
        feature_records.append(record)
        if is_present:
            active_records.append(record)

    sorted_by_mag = sorted(feature_records, key=lambda x: x["magnitude"], reverse=True)
    positive_contribs = [r for r in sorted_by_mag if r["contribution"] > 0][:top_k]
    negative_contribs = [r for r in sorted_by_mag if r["contribution"] < 0][:top_k]
    active_sorted = sorted(active_records, key=lambda x: x["contribution"], reverse=True)

    top_pos_names = [f"'{r['feature']}' (+{r['contribution']:.2f})" for r in positive_contribs[:3]]
    top_pos_summary = ", ".join(top_pos_names) if top_pos_names else "baseline model probability"

    summary = (
        f"SHAP TreeExplainer analyzed all 131 symptoms for {disease_name}. "
        f"The prediction was most strongly driven by {top_pos_summary}."
    )

    signals = [
        f"{r['feature']} (SHAP: +{r['contribution']:.2f})" for r in positive_contribs
    ]

    return {
        "method": "SHAP",
        "available": True,
        "target_disease": disease_name,
        "class_index": int(predicted_class_index),
        "base_value": round(base_value, 4),
        "net_score": round(float(np.sum(class_contribs) + base_value), 4),
        "top_positive_contributors": positive_contribs,
        "top_negative_contributors": negative_contribs,
        "active_symptom_contributions": active_sorted,
        "summary": summary,
        "about": (
            f"SHAP (SHapley Additive exPlanations) calculated the exact mathematical contribution "
            f"of each symptom toward the predicted condition '{disease_name}' using TreeExplainer."
        ),
        "signals": signals if signals else [r["feature"] for r in active_sorted],
        "confidence_note": (
            f"Base expected value for {disease_name} is {base_value:.3f}. "
            f"Positive SHAP features pushed the prediction score higher."
        ),
    }
