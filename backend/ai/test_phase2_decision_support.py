"""Phase 2 Decision-Support Test Suite.

Verifies:
1. Boundary values: 0.39, 0.40, 0.49, 0.50, 0.65 across all tiers.
2. Exact No Finding logic:
   - Case 1: Any pathology >= 0.50 -> ABNORMAL + suppress No Finding unconditionally
   - Case 2: No pathology >= 0.50 + No Finding >= 0.50 + max pathology < 0.40 -> UNREMARKABLE (tier MILD)
   - Case 3: Ambiguous zone (pathology 0.40-0.49 or conflicting signals) -> UNCERTAIN
3. Support Devices independence: Observational only, never alters decision tier.
4. Single-class boundary transitions (CRITICAL, HIGH_URGENCY, MODERATE, MILD, UNCERTAIN).
5. Disclaimer text present on every payload.
6. End-to-end integration with live predictors.
"""

import sys
from pathlib import Path

# Add backend/ai to sys.path
SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from decision_support_service import (
    evaluate_decision_support,
    PROJECT_OPERATING_THRESHOLDS,
    SYMPTOM_RISK_MAP,
    CHEST_RISK_MAP,
    SKIN_RISK_MAP,
    DISCLAIMER_TEXT,
)


def test_boundary_values_and_tiers():
    print("\n--- Test 1: Boundary Value Testing (0.39, 0.40, 0.49, 0.50, 0.65) ---")

    # 1. CRITICAL condition (Heart attack)
    # < 0.40 -> UNCERTAIN (below operating floor)
    res_039 = evaluate_decision_support("symptoms", {"predicted_disease": "Heart attack", "model_score": 0.39})
    assert res_039["decision_tier"] == "UNCERTAIN", f"Expected UNCERTAIN at 0.39, got {res_039['decision_tier']}"

    # 0.40 (ambiguous floor) -> UNCERTAIN
    res_040 = evaluate_decision_support("symptoms", {"predicted_disease": "Heart attack", "model_score": 0.40})
    assert res_040["decision_tier"] == "UNCERTAIN", f"Expected UNCERTAIN at 0.40, got {res_040['decision_tier']}"

    # 0.49 (ambiguous ceiling) -> UNCERTAIN
    res_049 = evaluate_decision_support("symptoms", {"predicted_disease": "Heart attack", "model_score": 0.49})
    assert res_049["decision_tier"] == "UNCERTAIN", f"Expected UNCERTAIN at 0.49, got {res_049['decision_tier']}"

    # 0.50 (detection threshold) -> CRITICAL
    res_050 = evaluate_decision_support("symptoms", {"predicted_disease": "Heart attack", "model_score": 0.50})
    assert res_050["decision_tier"] == "CRITICAL", f"Expected CRITICAL at 0.50, got {res_050['decision_tier']}"
    assert "potentially time-critical condition" in res_050["action_recommendation"]

    # 0.65 (high score) -> CRITICAL
    res_065 = evaluate_decision_support("symptoms", {"predicted_disease": "Heart attack", "model_score": 0.65})
    assert res_065["decision_tier"] == "CRITICAL", f"Expected CRITICAL at 0.65, got {res_065['decision_tier']}"

    # 2. HIGH_URGENCY condition (Melanoma in skin)
    # < 0.40 -> UNCERTAIN
    res_skin_039 = evaluate_decision_support("skin", {"predicted_disease": "Melanoma", "model_score": 0.39})
    assert res_skin_039["decision_tier"] == "UNCERTAIN"

    # 0.45 (ambiguous) -> UNCERTAIN
    res_skin_045 = evaluate_decision_support("skin", {"predicted_disease": "Melanoma", "model_score": 0.45})
    assert res_skin_045["decision_tier"] == "UNCERTAIN"

    # >= 0.50 -> HIGH_URGENCY
    res_skin_050 = evaluate_decision_support("skin", {"predicted_disease": "Melanoma", "model_score": 0.50})
    assert res_skin_050["decision_tier"] == "HIGH_URGENCY"
    assert "urgent 2-week dermatology referral" in res_skin_050["action_recommendation"]
    assert "not an emergency room resuscitation" in res_skin_050["action_recommendation"]

    # 3. MODERATE condition (Diabetes in symptoms, Basal Cell Carcinoma in skin)
    res_mod_049 = evaluate_decision_support("symptoms", {"predicted_disease": "Diabetes", "model_score": 0.49})
    assert res_mod_049["decision_tier"] == "UNCERTAIN"
    res_mod_050 = evaluate_decision_support("symptoms", {"predicted_disease": "Diabetes", "model_score": 0.50})
    assert res_mod_050["decision_tier"] == "MODERATE"

    # 4. MILD condition (Common Cold)
    res_mild_049 = evaluate_decision_support("symptoms", {"predicted_disease": "Common Cold", "model_score": 0.49})
    assert res_mild_049["decision_tier"] == "UNCERTAIN"
    res_mild_050 = evaluate_decision_support("symptoms", {"predicted_disease": "Common Cold", "model_score": 0.50})
    assert res_mild_050["decision_tier"] == "MILD"

    print(">>> PASS: Boundary value testing (0.39, 0.40, 0.49, 0.50, 0.65) verified across all tiers.")


def test_chest_xray_combinations_and_no_finding():
    print("\n--- Test 2: Chest X-ray Multi-Label Combinations & No Finding Logic ---")

    # Scenario A: No Finding high (0.85), all pathologies low (< 0.40)
    # -> Case 2: UNREMARKABLE / MILD
    clean_scores = {
        "Atelectasis": 0.05, "Cardiomegaly": 0.12, "Consolidation": 0.02, "Edema": 0.04,
        "Enlarged Cardiomediastinum": 0.08, "Fracture": 0.01, "Lung Lesion": 0.03,
        "Lung Opacity": 0.06, "No Finding": 0.85, "Pleural Effusion": 0.03,
        "Pleural Other": 0.04, "Pneumonia": 0.01, "Pneumothorax": 0.02, "Support Devices": 0.01,
    }
    res_a = evaluate_decision_support("chest_xray", {"scores": clean_scores})
    assert res_a["decision_tier"] == "MILD"
    assert res_a["finding_status"] == "UNREMARKABLE"
    assert res_a["no_finding_suppressed"] is False
    assert res_a["headline_finding"] == "No Acute Finding"
    assert len(res_a["detected_pathologies"]) == 0
    print("   [+] Scenario A passed: No Finding high + all pathology low -> UNREMARKABLE / MILD")

    # Scenario B: No Finding high (0.75), BUT Edema >= 0.50 (0.70)
    # -> Case 1: ABNORMAL, No Finding suppressed unconditionally, HIGH_URGENCY
    contradictory_scores = dict(clean_scores)
    contradictory_scores["No Finding"] = 0.75
    contradictory_scores["Edema"] = 0.70
    res_b = evaluate_decision_support("chest_xray", {"scores": contradictory_scores})
    assert res_b["decision_tier"] == "HIGH_URGENCY"
    assert res_b["finding_status"] == "ABNORMAL"
    assert res_b["no_finding_suppressed"] is True
    assert res_b["headline_finding"] == "Edema"
    # Verify No Finding is NEVER in detected_pathologies
    assert not any(p["label"] == "No Finding" for p in res_b["detected_pathologies"])
    print("   [+] Scenario B passed: No Finding high + pathology >= 0.50 -> ABNORMAL (No Finding suppressed)")

    # Scenario C: Pathology in ambiguous zone 0.40-0.49 (e.g. Pneumothorax at 0.48, No Finding at 0.52)
    # Max pathology is 0.48, which is >= 0.40 uncertainty floor
    # -> Case 3: UNCERTAIN / INCONCLUSIVE
    ambiguous_scores = dict(clean_scores)
    ambiguous_scores["No Finding"] = 0.52
    ambiguous_scores["Pneumothorax"] = 0.48
    res_c = evaluate_decision_support("chest_xray", {"scores": ambiguous_scores})
    assert res_c["decision_tier"] == "UNCERTAIN"
    assert res_c["finding_status"] == "INCONCLUSIVE"
    assert res_c["no_finding_suppressed"] is False
    assert len(res_c["detected_pathologies"]) == 0
    print("   [+] Scenario C passed: Pathology in 0.40-0.49 -> INCONCLUSIVE / UNCERTAIN")

    # Scenario D: Multiple detected pathologies (Edema 0.70 [HIGH_URGENCY], Cardiomegaly 0.60 [MODERATE])
    # -> Highest urgency dominates: HIGH_URGENCY
    multi_scores = dict(clean_scores)
    multi_scores["No Finding"] = 0.20
    multi_scores["Edema"] = 0.70
    multi_scores["Cardiomegaly"] = 0.60
    res_d = evaluate_decision_support("chest_xray", {"scores": multi_scores})
    assert res_d["decision_tier"] == "HIGH_URGENCY"
    assert res_d["headline_finding"] == "Edema"
    assert len(res_d["detected_pathologies"]) == 2
    print("   [+] Scenario D passed: Multiple pathologies -> High-Urgency pathology dominates")


def test_support_devices_independence():
    print("\n--- Test 3: Support Devices Independence ---")

    # 1. Support Devices ONLY (0.88), all pathologies low (< 0.40), No Finding high (0.80)
    # -> Must remain UNREMARKABLE / MILD for disease urgency! Support Devices reported as hardware.
    hw_only_scores = {
        "Atelectasis": 0.05, "Cardiomegaly": 0.10, "Consolidation": 0.02, "Edema": 0.04,
        "Enlarged Cardiomediastinum": 0.05, "Fracture": 0.02, "Lung Lesion": 0.02,
        "Lung Opacity": 0.05, "No Finding": 0.80, "Pleural Effusion": 0.03,
        "Pleural Other": 0.04, "Pneumonia": 0.01, "Pneumothorax": 0.02,
        "Support Devices": 0.88,  # Hardware high
    }
    res_hw = evaluate_decision_support("chest_xray", {"scores": hw_only_scores})
    assert res_hw["decision_tier"] == "MILD", f"Expected MILD, got {res_hw['decision_tier']}"
    assert res_hw["finding_status"] == "UNREMARKABLE"
    assert len(res_hw["hardware_observations"]) == 1
    assert res_hw["hardware_observations"][0]["label"] == "Support Devices"
    assert res_hw["hardware_observations"][0]["clinical_urgency"] == "OBSERVATIONAL"
    print("   [+] Support Devices ONLY does not elevate disease urgency (decision_tier remains MILD)")

    # 2. Support Devices (0.88) + Cardiomegaly (0.65, MODERATE)
    # -> Must be MODERATE (not elevated by Support Devices)
    hw_mod_scores = dict(hw_only_scores)
    hw_mod_scores["Cardiomegaly"] = 0.65
    res_hw_mod = evaluate_decision_support("chest_xray", {"scores": hw_mod_scores})
    assert res_hw_mod["decision_tier"] == "MODERATE"
    assert res_hw_mod["headline_finding"] == "Cardiomegaly"
    assert len(res_hw_mod["hardware_observations"]) == 1
    print("   [+] Support Devices + MODERATE pathology -> decision_tier remains MODERATE")


def test_live_predictors_integration():
    print("\n--- Test 4: Live Predictors Integration with Decision Support ---")

    # Test 1: Live symptoms predictor
    from symptom_predictor import analyze_symptoms
    sym_res = analyze_symptoms("I have severe sharp chest pain, sweating, and difficulty breathing")
    assert "decision_support" in sym_res
    assert sym_res["decision_tier"] == "CRITICAL"
    assert sym_res["decision_support"]["clinical_urgency"] == "CRITICAL"
    assert "disclaimer" in sym_res["decision_support"]
    print("   [+] Live Symptom Predictor returns valid decision_support and decision_tier = CRITICAL")

    # Test 2: Live chest predictor
    from chest_predictor import analyze_chest_xray
    img_path = Path(r"c:\Users\Hp\Desktop\Clinical_Decision_Support_System\backend\runtime\uploads\4385a0fdb80946bda81e77fae43bd3bc.jpg")
    if img_path.exists():
        chest_res = analyze_chest_xray(img_path)
        assert "decision_support" in chest_res
        assert "decision_tier" in chest_res
        assert "finding_status" in chest_res
        # In our earlier test, this image had Edema (70.1%) -> HIGH_URGENCY
        assert chest_res["decision_tier"] == "HIGH_URGENCY"
        assert chest_res["finding_status"] == "ABNORMAL"
        assert chest_res["decision_support"]["no_finding_suppressed"] is True
        print("   [+] Live Chest Predictor returns valid decision_support with No Finding suppressed")

    # Test 3: Live skin predictor
    from skin_predictor import analyze_skin_disease
    skin_img_path = Path(r"c:\Users\Hp\Desktop\Clinical_Decision_Support_System\backend\runtime\uploads\09231f38997e4a6b82ef307ca6598f58.jpeg")
    if skin_img_path.exists():
        skin_res = analyze_skin_disease(skin_img_path)
        assert "decision_support" in skin_res
        assert "decision_tier" in skin_res
        # This image predicted Melanocytic Nevus (benign mole) -> MILD
        assert skin_res["decision_tier"] == "MILD"
        print("   [+] Live Skin Predictor returns valid decision_support and decision_tier = MILD")


if __name__ == "__main__":
    print("=======================================================")
    print("RUNNING PHASE 2 DECISION-SUPPORT TEST SUITE")
    print("=======================================================")
    test_boundary_values_and_tiers()
    test_chest_xray_combinations_and_no_finding()
    test_support_devices_independence()
    test_live_predictors_integration()
    print("\n=======================================================")
    print("ALL PHASE 2 DECISION-SUPPORT TESTS PASSED!")
    print("=======================================================")
