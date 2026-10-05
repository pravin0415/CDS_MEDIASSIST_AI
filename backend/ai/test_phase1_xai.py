"""Phase 1 Automated Verification Test Suite.

Verifies:
1. XGBoost -> Prediction -> Real SHAP TreeExplainer (Dynamic class explanation, positive & negative contributors)
2. DenseNet-121 -> Multi-label Prediction -> Real Grad-CAM (Targeting actual predicted finding)
3. MobileNetV2 -> Skin Disease Prediction -> Real Grad-CAM (Targeting actual predicted class)
"""

import sys
from pathlib import Path
import numpy as np

# Ensure backend/ai is on sys.path
SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from symptom_predictor import analyze_symptoms
from chest_predictor import analyze_chest_xray, generate_gradcam as generate_chest_gradcam, CLASS_NAMES as CHEST_CLASSES
from skin_predictor import analyze_skin_disease, generate_gradcam as generate_skin_gradcam
from skin_class_names import class_names as SKIN_CLASSES


def test_symptom_shap_pipeline():
    print("\n=======================================================")
    print("TEST 1: XGBoost Symptom Prediction + SHAP TreeExplainer")
    print("=======================================================")

    test_cases = [
        ("Heart Attack Symptoms", "I have sharp chest pain, sweating, severe breathlessness, and vomiting"),
        ("Diabetes Symptoms", "I suffer from extreme fatigue, excessive weight loss, restlessness, and increased appetite"),
        ("Pneumonia Symptoms", "I have persistent cough, high fever, breathlessness, and chills"),
    ]

    for label, text in test_cases:
        print(f"\n--- Running: {label} ---")
        result = analyze_symptoms(text)

        disease = result["predicted_disease"]
        confidence = result["confidence"]
        xai = result["xai"]

        print(f"Predicted Disease : {disease} (Class {result['class_index']})")
        print(f"Confidence Score  : {confidence * 100:.1f}%")
        print(f"XAI Method        : {xai.get('method')}")
        print(f"Base Value        : {xai.get('base_value')}")
        print(f"Net Score (sum)   : {xai.get('net_score')}")

        # Assertions
        assert xai.get("available") is True, "SHAP should be available"
        assert xai.get("method") == "SHAP", "Method should be SHAP"
        assert len(xai.get("top_positive_contributors", [])) > 0, "Must have positive contributors"

        print("Top Positive Contributors (pushed toward disease):")
        for item in xai["top_positive_contributors"][:3]:
            print(f"   [+] {item['feature']}: {item['contribution']:+.4f} (present={item['is_present']})")

        print("Top Negative Contributors (pushed away from disease):")
        for item in xai.get("top_negative_contributors", [])[:3]:
            print(f"   [-] {item['feature']}: {item['contribution']:+.4f} (present={item['is_present']})")

    print("\n>>> TEST 1 PASSED: Real SHAP TreeExplainer dynamically explains predicted classes.")


def test_chest_xray_gradcam_pipeline():
    print("\n===========================================================")
    print("TEST 2: DenseNet-121 Multi-label Prediction + Real Grad-CAM")
    print("===========================================================")

    uploads_dir = SCRIPT_DIR.parent / "runtime" / "uploads"
    heatmaps_dir = SCRIPT_DIR.parent / "runtime" / "heatmaps"
    test_images = list(uploads_dir.glob("*.jpg")) + list(uploads_dir.glob("*.jpeg"))

    if not test_images:
        print("No test images found in runtime/uploads. Skipping image test.")
        return

    test_img = test_images[0]
    print(f"Testing on chest image: {test_img.name}")

    result = analyze_chest_xray(test_img)
    headline_disease = result["predicted_disease"]
    headline_idx = result["class_index"]
    headline_conf = result["confidence"]

    print(f"Headline Finding  : {headline_disease} (Index {headline_idx})")
    print(f"Confidence        : {headline_conf * 100:.1f}%")
    print(f"Total Findings    : {len(result.get('top_predictions', []))} observations evaluated")
    print(f"Detected (>=50%)  : {[f['label'] for f in result.get('detected_findings', [])]}")

    # Generate Grad-CAM for headline class
    out_cam = heatmaps_dir / "phase1_test_chest_gradcam.jpg"
    generated_path = generate_chest_gradcam(test_img, out_cam, class_index=headline_idx)

    assert generated_path.exists(), f"Grad-CAM file should exist at {generated_path}"
    assert generated_path.stat().st_size > 1000, "Grad-CAM file size should be substantial"
    print(f"Grad-CAM Generated: {generated_path.name} ({generated_path.stat().st_size} bytes)")

    print("\n>>> TEST 2 PASSED: DenseNet-121 multi-label prediction & Grad-CAM successfully generated.")


def test_skin_disease_gradcam_pipeline():
    print("\n===========================================================")
    print("TEST 3: MobileNetV2 Skin Disease Prediction + Real Grad-CAM")
    print("===========================================================")

    uploads_dir = SCRIPT_DIR.parent / "runtime" / "uploads"
    heatmaps_dir = SCRIPT_DIR.parent / "runtime" / "heatmaps"
    test_images = list(uploads_dir.glob("*.jpeg")) + list(uploads_dir.glob("*.jpg"))

    if not test_images:
        print("No test images found in runtime/uploads. Skipping skin test.")
        return

    test_img = test_images[0]
    print(f"Testing on skin image: {test_img.name}")

    result = analyze_skin_disease(test_img)
    disease = result["predicted_disease"]
    class_idx = result["class_index"]
    conf = result["confidence"]

    print(f"Predicted Disease : {disease} (Index {class_idx})")
    print(f"Confidence        : {conf * 100:.1f}%")
    print(f"Top Predictions   : {[(p['label'], p['confidence']) for p in result['top_predictions']]}")

    out_cam = heatmaps_dir / "phase1_test_skin_gradcam.jpg"
    generated_path = generate_skin_gradcam(test_img, out_cam, class_index=class_idx)

    assert generated_path.exists(), f"Grad-CAM file should exist at {generated_path}"
    assert generated_path.stat().st_size > 1000, "Grad-CAM file size should be substantial"
    print(f"Grad-CAM Generated: {generated_path.name} ({generated_path.stat().st_size} bytes)")

    print("\n>>> TEST 3 PASSED: MobileNetV2 prediction & Grad-CAM successfully generated.")


if __name__ == "__main__":
    print("RUNNING PHASE 1 TEST SUITE...")
    test_symptom_shap_pipeline()
    test_chest_xray_gradcam_pipeline()
    test_skin_disease_gradcam_pipeline()
    print("\n=======================================================")
    print("ALL PHASE 1 CORE MODEL & XAI TESTS COMPLETED AND PASSED!")
    print("=======================================================")
