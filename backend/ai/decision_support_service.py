"""Clinical Decision-Support Service for MediAssist AI.

Implements rule-based clinical decision support and triage mapping.
Strict constraints:
1. Model outputs are treated as model screening scores, NOT calibrated clinical probabilities.
2. Thresholds (0.50 detection, 0.40 uncertainty floor) are project-defined engineering operating points.
3. No numerical disease-severity score is calculated.
4. Support Devices is treated as an observational finding and excluded from pathological disease urgency.
5. No Finding is suppressed when any pathological abnormality >= 0.50 is detected.
6. The official decision-support tiers are:
   CRITICAL, HIGH_URGENCY, MODERATE, MILD, UNCERTAIN, OBSERVATIONAL.
   (NORMAL is not a decision-support tier; unremarkable chest X-rays use MILD with status UNREMARKABLE).
"""

# Project-defined engineering operating points (not clinically calibrated cutoffs)
PROJECT_OPERATING_THRESHOLDS = {
    "detection_threshold": 0.50,  # Project engineering operating cutoff
    "uncertainty_floor": 0.40,    # Lower boundary of the ambiguous-score zone
}

# 1. Symptom Model Risk Mapping (all 41 classes from label_encoder.pkl)
SYMPTOM_RISK_MAP = {
    # CRITICAL: Time-critical emergency risk
    "Heart attack": "CRITICAL",
    "Paralysis (brain hemorrhage)": "CRITICAL",

    # HIGH_URGENCY: Acute lower respiratory/mycobacterial/severe conditions
    "Pneumonia": "HIGH_URGENCY",
    "AIDS": "HIGH_URGENCY",
    "Tuberculosis": "HIGH_URGENCY",

    # MODERATE: Outpatient medical consultation / diagnostic workup
    "Bronchial Asthma": "MODERATE",
    "Diabetes": "MODERATE",
    "Alcoholic hepatitis": "MODERATE",
    "Chronic cholestasis": "MODERATE",
    "Dengue": "MODERATE",
    "Drug Reaction": "MODERATE",
    "Hepatitis B": "MODERATE",
    "Hepatitis C": "MODERATE",
    "Hepatitis D": "MODERATE",
    "Hepatitis E": "MODERATE",
    "hepatitis A": "MODERATE",
    "Hypertension": "MODERATE",
    "Hyperthyroidism": "MODERATE",
    "Hypoglycemia": "MODERATE",
    "Hypothyroidism": "MODERATE",
    "Jaundice": "MODERATE",
    "Malaria": "MODERATE",
    "Peptic ulcer diseae": "MODERATE",
    "Typhoid": "MODERATE",

    # MILD: Supportive self-care, symptom tracking, or routine outpatient care
    "(vertigo) Paroymsal Positional Vertigo": "MILD",
    "Acne": "MILD",
    "Allergy": "MILD",
    "Arthritis": "MILD",
    "Cervical spondylosis": "MILD",
    "Chicken pox": "MILD",
    "Common Cold": "MILD",
    "Dimorphic hemmorhoids(piles)": "MILD",
    "Fungal infection": "MILD",
    "GERD": "MILD",
    "Gastroenteritis": "MILD",
    "Impetigo": "MILD",
    "Migraine": "MILD",
    "Osteoarthristis": "MILD",
    "Psoriasis": "MILD",
    "Urinary tract infection": "MILD",
    "Varicose veins": "MILD",
}

# 2. Chest X-Ray Finding Mapping (all 14 observations from DenseNet-121)
CHEST_RISK_MAP = {
    # HIGH_URGENCY: Acute pulmonary or cardiopulmonary findings
    "Consolidation": "HIGH_URGENCY",
    "Edema": "HIGH_URGENCY",
    "Pleural Effusion": "HIGH_URGENCY",
    "Pneumonia": "HIGH_URGENCY",
    "Pneumothorax": "HIGH_URGENCY",

    # MODERATE: Secondary, structural, or non-specific findings
    "Atelectasis": "MODERATE",
    "Cardiomegaly": "MODERATE",
    "Enlarged Cardiomediastinum": "MODERATE",
    "Fracture": "MODERATE",
    "Lung Lesion": "MODERATE",
    "Lung Opacity": "MODERATE",
    "Pleural Other": "MODERATE",

    # OBSERVATIONAL: Hardware marker (never contributes to pathological urgency)
    "Support Devices": "OBSERVATIONAL",

    # Associated with unremarkable study when all pathological criteria met
    "No Finding": "MILD",
}

# 3. Skin Disease Mapping (all 7 classes from MobileNetV2 / HAM10000)
SKIN_RISK_MAP = {
    # HIGH_URGENCY: Urgent 2-week specialist referral for dermoscopy & biopsy
    "Melanoma": "HIGH_URGENCY",

    # MODERATE: Suspicious / premalignant / non-melanoma skin cancer
    "Basal Cell Carcinoma": "MODERATE",
    "Actinic Keratoses": "MODERATE",

    # MILD: Benign dermatological growth patterns
    "Benign Keratosis": "MILD",
    "Dermatofibroma": "MILD",
    "Melanocytic Nevus": "MILD",
    "Vascular Lesions": "MILD",
}

DISCLAIMER_TEXT = (
    "MediAssist AI provides artificial intelligence screening decision support for clinical guidance "
    "only and does not provide a confirmed medical diagnosis. Screening scores reflect mathematical model "
    "outputs and are not calibrated disease probabilities. Results must be clinically correlated with "
    "patient history, physical examination, and vital signs by a qualified healthcare professional."
)


def evaluate_decision_support(modality, prediction_data):
    """Synthesize model output score, uncertainty check, and clinical urgency.

    Pipeline:
    MODEL OUTPUT -> MODEL SCORE -> UNCERTAINTY CHECK -> CLINICAL RISK MAPPING -> DECISION SUPPORT
    """
    detection_threshold = PROJECT_OPERATING_THRESHOLDS["detection_threshold"]
    uncertainty_floor = PROJECT_OPERATING_THRESHOLDS["uncertainty_floor"]

    # -----------------------------------------------------------------------
    # Multi-Label Chest Radiography Decision Logic
    # -----------------------------------------------------------------------
    if modality == "chest_xray":
        scores = prediction_data.get("scores", {})  # Dict: {class_name: float_score, ...}

        pathological_findings = []
        hardware_findings = []

        for name, score in scores.items():
            if score >= detection_threshold:
                if name == "Support Devices":
                    hardware_findings.append({
                        "label": name,
                        "model_score": round(float(score), 4),
                        "clinical_urgency": "OBSERVATIONAL",
                    })
                elif name != "No Finding":
                    risk = CHEST_RISK_MAP.get(name, "MODERATE")
                    pathological_findings.append({
                        "label": name,
                        "model_score": round(float(score), 4),
                        "clinical_urgency": risk,
                    })

        no_finding_score = float(scores.get("No Finding", 0.0))
        pathological_scores = [
            float(s) for k, s in scores.items() if k not in ("No Finding", "Support Devices")
        ]
        max_pathology_score = max(pathological_scores, default=0.0)

        # CASE 1: Any pathological X-ray class >= detection threshold (0.50)
        # -> ABNORMAL -> suppress No Finding as a positive finding unconditionally
        if len(pathological_findings) > 0:
            pathological_findings.sort(key=lambda x: x["model_score"], reverse=True)
            primary = pathological_findings[0]

            if any(p["clinical_urgency"] == "HIGH_URGENCY" for p in pathological_findings):
                tier = "HIGH_URGENCY"
                action = (
                    "Priority medical evaluation recommended. Radiographic patterns suggest acute "
                    "pulmonary or cardiopulmonary pathology. Clinical assessment with vital signs, "
                    "chest auscultation, and oxygenation status is required. The model cannot determine "
                    "physiological instability from imaging alone."
                )
            else:
                tier = "MODERATE"
                action = (
                    "Prompt clinical consultation advised. Radiographic patterns suggest a secondary "
                    "or chronic finding requiring physician review and clinical correlation."
                )

            return {
                "decision_tier": tier,
                "finding_status": "ABNORMAL",
                "headline_finding": primary["label"],
                "headline_score": primary["model_score"],
                "detected_pathologies": pathological_findings,
                "hardware_observations": hardware_findings,
                "no_finding_suppressed": True,
                "action_recommendation": action,
                "disclaimer": DISCLAIMER_TEXT,
            }

        # CASE 2: No pathology >= 0.50 AND No Finding >= 0.50 AND max pathology < 0.40
        # -> UNREMARKABLE (assigned decision_tier = MILD, finding_status = UNREMARKABLE)
        elif no_finding_score >= detection_threshold and max_pathology_score < uncertainty_floor:
            return {
                "decision_tier": "MILD",
                "finding_status": "UNREMARKABLE",
                "headline_finding": "No Acute Finding",
                "headline_score": round(no_finding_score, 4),
                "detected_pathologies": [],
                "hardware_observations": hardware_findings,
                "no_finding_suppressed": False,
                "action_recommendation": (
                    "No learned pathological finding exceeded the project's positive detection threshold, "
                    "and no pathological score entered the ambiguous zone. Routine follow-up or consultation "
                    "if clinical symptoms persist."
                ),
                "disclaimer": DISCLAIMER_TEXT,
            }

        # CASE 3: Everything else (e.g. max pathology in 0.40-0.49, or ambiguous signals)
        # -> INCONCLUSIVE / UNCERTAIN
        else:
            top_score = max(scores.values()) if scores else 0.0
            return {
                "decision_tier": "UNCERTAIN",
                "finding_status": "INCONCLUSIVE",
                "headline_finding": "Inconclusive Imaging Signal",
                "headline_score": round(float(top_score), 4),
                "detected_pathologies": [],
                "hardware_observations": hardware_findings,
                "no_finding_suppressed": False,
                "action_recommendation": (
                    "The automated screening model produced ambiguous or borderline signals. "
                    "Automated analysis cannot definitively confirm or exclude acute pathology. "
                    "Formal radiologist review is recommended."
                ),
                "disclaimer": DISCLAIMER_TEXT,
            }

    # -----------------------------------------------------------------------
    # Single-Class Modalities (Symptoms & Skin)
    # -----------------------------------------------------------------------
    predicted_class = prediction_data.get("predicted_disease", "Unknown")
    model_score = float(prediction_data.get("model_score", 0.0))

    risk_map = SYMPTOM_RISK_MAP if modality == "symptoms" else SKIN_RISK_MAP
    base_urgency = risk_map.get(predicted_class, "MODERATE")

    # 1. Below Operating Floor (< 0.40): Insufficient AI Signal
    if model_score < uncertainty_floor:
        return {
            "decision_tier": "UNCERTAIN",
            "predicted_condition": predicted_class,
            "model_score": round(model_score, 4),
            "clinical_urgency": base_urgency,
            "action_recommendation": (
                "The model screening score is below the project operating floor; the AI signal is "
                "insufficient for a positive screening classification. Consult a qualified healthcare "
                "provider for comprehensive clinical evaluation."
            ),
            "disclaimer": DISCLAIMER_TEXT,
        }

    # 2. Decision Tier Synthesis
    if base_urgency == "CRITICAL":
        if model_score >= detection_threshold:
            tier = "CRITICAL"
            action = (
                "The screening result is associated with a potentially time-critical condition. "
                "If the patient currently has corresponding emergency symptoms or is acutely unwell, "
                "seek immediate emergency medical care or activate local emergency services."
            )
        else:
            # Ambiguous zone: 0.40 <= score < 0.50
            tier = "UNCERTAIN"
            action = (
                "Borderline screening signal associated with a potentially acute condition. "
                "Clinical consultation is advised to evaluate symptoms."
            )

    elif base_urgency == "HIGH_URGENCY":
        if model_score >= detection_threshold:
            tier = "HIGH_URGENCY"
            if modality == "skin":
                action = (
                    "Urgent specialist evaluation recommended. The visual pattern matches features of a "
                    "high-risk pigmented lesion (melanoma). Arrange an urgent 2-week dermatology referral "
                    "for dermoscopic examination and biopsy. This is an urgent specialist evaluation, not an "
                    "emergency room resuscitation."
                )
            else:
                action = (
                    "Priority medical evaluation recommended. An in-person clinical assessment is required "
                    "to evaluate vital signs, physical examination, and disease severity."
                )
        else:
            tier = "UNCERTAIN"
            action = "Inconclusive screening score. Consult a physician for definitive evaluation."

    elif base_urgency == "MODERATE":
        if model_score >= detection_threshold:
            tier = "MODERATE"
            action = (
                "Consult a qualified healthcare professional. Schedule an outpatient appointment for "
                "clinical examination, diagnostic laboratory workup, or dermoscopic review."
            )
        else:
            tier = "UNCERTAIN"
            action = "Weak screening signal. Consult a healthcare professional if symptoms persist or concern arises."

    else:  # MILD
        if model_score >= detection_threshold:
            tier = "MILD"
            action = (
                "Consider appropriate supportive self-care and monitoring. Seek medical advice if symptoms "
                "worsen, fail to improve, or new concerning signs develop."
            )
        else:
            tier = "UNCERTAIN"
            action = "Low confidence screening result. Routine clinical review if symptomatic."

    return {
        "decision_tier": tier,
        "predicted_condition": predicted_class,
        "model_score": round(model_score, 4),
        "clinical_urgency": base_urgency,
        "action_recommendation": action,
        "disclaimer": DISCLAIMER_TEXT,
    }
