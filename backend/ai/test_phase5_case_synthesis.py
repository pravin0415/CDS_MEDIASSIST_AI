"""Tests for safe decision-level synthesis of independent modality outputs."""

from pathlib import Path
import sys
import unittest

CURRENT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(CURRENT_DIR))

from server import app


class TestDecisionLevelCaseSynthesis(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = app.test_client()

    def test_synthesis_preserves_provenance_without_fabricating_prediction(self):
        response = self.client.post("/api/cases/synthesize", json={
            "assessments": [
                {"modality": "symptoms", "decision_tier": "MODERATE", "predicted_disease": "Diabetes", "model_score": 0.72, "xai": {"method": "SHAP"}},
                {"modality": "chest_xray", "decision_tier": "HIGH_URGENCY", "headline_finding": "Pneumonia", "model_score": 0.67, "xai": {"method": "Grad-CAM"}},
            ]
        })
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data["fusion_strategy"], "decision_level_case_synthesis")
        self.assertFalse(data["multimodal_model_trained"])
        self.assertIsNone(data["combined_probability"])
        self.assertIsNone(data["combined_diagnosis"])
        self.assertEqual(data["case_review_tier"], "HIGH_URGENCY")
        self.assertEqual(data["assessments"][0]["modality"], "chest_xray")

    def test_invalid_or_empty_input_is_rejected(self):
        response = self.client.post("/api/cases/synthesize", json={"assessments": []})
        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main(verbosity=2)
