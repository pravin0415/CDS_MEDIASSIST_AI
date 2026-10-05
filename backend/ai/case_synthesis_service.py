"""Decision-level case synthesis for independently trained MediAssist models.

The symptom, chest X-ray, and skin models were trained on different, unpaired
datasets and predict different label spaces.  They must not be represented as
an end-to-end multimodal model or be averaged into a disease probability.  This
module therefore performs *decision-level fusion*: it preserves each modality's
output and selects the most urgent reported tier for clinician review.
"""

from collections import Counter


TIER_ORDER = {
    "CRITICAL": 5,
    "HIGH_URGENCY": 4,
    "MODERATE": 3,
    "MILD": 2,
    "UNCERTAIN": 1,
    "OBSERVATIONAL": 0,
}

ALLOWED_MODALITIES = {"symptoms", "voice", "chest_xray", "skin"}

SYNTHESIS_DISCLAIMER = (
    "This is a decision-level summary of separate AI screening outputs, not a "
    "trained multimodal prediction, a combined probability, or a diagnosis. "
    "The underlying datasets are unpaired across modalities. A qualified clinician "
    "must reconcile findings with the patient history, examination, vital signs, "
    "and appropriate tests."
)


def synthesize_case(assessments):
    """Create an explainable case-review summary from completed modality outputs.

    Each item must contain ``modality`` and ``decision_tier``. ``model_score`` is
    displayed as provenance only; no calibration or cross-model comparability is
    implied. The function is intentionally deterministic and has no model update
    or autonomous treatment recommendation path.
    """
    if not isinstance(assessments, list) or not assessments:
        raise ValueError("Provide a non-empty 'assessments' list.")

    normalized = []
    seen_modalities = set()
    for index, item in enumerate(assessments):
        if not isinstance(item, dict):
            raise ValueError(f"Assessment {index + 1} must be an object.")
        modality = str(item.get("modality", "")).strip().lower()
        tier = str(item.get("decision_tier", "")).strip().upper()
        if modality not in ALLOWED_MODALITIES:
            raise ValueError("Each modality must be one of: symptoms, voice, chest_xray, skin.")
        if modality in seen_modalities:
            raise ValueError("Only one assessment per modality is allowed in a case synthesis.")
        if tier not in TIER_ORDER:
            raise ValueError("Each assessment needs a valid decision_tier from its model response.")
        seen_modalities.add(modality)
        normalized.append({
            "modality": modality,
            "decision_tier": tier,
            "headline": str(item.get("headline") or item.get("predicted_disease") or item.get("headline_finding") or "No headline supplied"),
            "model_score": item.get("model_score"),
            "explanation_available": bool(item.get("xai") or item.get("explanation_available")),
        })

    normalized.sort(key=lambda entry: (-TIER_ORDER[entry["decision_tier"]], entry["modality"]))
    top_tier = normalized[0]["decision_tier"]
    tiers = Counter(entry["decision_tier"] for entry in normalized)

    if top_tier == "CRITICAL":
        action = "Potentially time-critical signal reported. Seek immediate emergency care if emergency symptoms are present; clinician review is required."
    elif top_tier == "HIGH_URGENCY":
        action = "Priority in-person clinical assessment is recommended."
    elif top_tier == "MODERATE":
        action = "Arrange clinician review to correlate the separate screening findings."
    elif top_tier == "UNCERTAIN":
        action = "The available AI signals are inconclusive; obtain clinical assessment rather than relying on automated screening."
    else:
        action = "No urgent AI tier was reported, but persistent or concerning symptoms still require clinical assessment."

    return {
        "fusion_strategy": "decision_level_case_synthesis",
        "multimodal_model_trained": False,
        "combined_probability": None,
        "combined_diagnosis": None,
        "case_review_tier": top_tier,
        "tier_counts": dict(tiers),
        "assessments": normalized,
        "action_recommendation": action,
        "disclaimer": SYNTHESIS_DISCLAIMER,
        "calibration_status": "Not calibrated across modalities; model scores are retained only as source-model outputs.",
    }
