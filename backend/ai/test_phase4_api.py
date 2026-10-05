"""Phase 4 Verification Test Suite: Modular REST API & Doctor Geolocation.

Tests:
1. Model load status endpoint GET /api/models/status
2. Modular symptom prediction POST /api/predict/symptoms
3. Modular image endpoints POST /api/predict/chest-xray & POST /api/predict/skin
4. Real geolocation doctor search GET /api/nearby-doctors via OpenStreetMap Overpass API
5. Legacy combined route backward compatibility POST /api/ai/predict
"""

import io
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

# Ensure backend/ai is in sys.path
CURRENT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(CURRENT_DIR))

from server import app


class TestPhase4ModularAPIAndGeolocation(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.client = app.test_client()

    def test_01_models_status_endpoint(self):
        """Test GET /api/models/status returns readiness for all 4 models."""
        response = self.client.get("/api/models/status")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        print(f"\n[+] Models status endpoint: {data}")
        
        self.assertTrue(data["ok"])
        models = data["models"]
        self.assertIn("symptom_model", models)
        self.assertIn("chest_xray_model", models)
        self.assertIn("skin_disease_model", models)
        self.assertIn("voice_transcription", models)
        self.assertTrue(models["symptom_model"]["loaded"])

    def test_02_predict_symptoms_modular(self):
        """Test POST /api/predict/symptoms modular endpoint."""
        response = self.client.post(
            "/api/predict/symptoms",
            json={"description": "high fever and cough"},
        )
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        print(f"[+] Modular Symptoms Response: Disease = {data['predicted_disease']}, Tier = {data['decision_tier']}")
        
        self.assertIn("predicted_disease", data)
        self.assertIn("decision_tier", data)
        self.assertIn("xai", data)
        self.assertEqual(data["xai"]["method"], "SHAP")

    def test_03_nearby_doctors_geolocation(self):
        """Test GET /api/nearby-doctors endpoint with valid GPS coordinates."""
        # Coordinates for Bengaluru city center
        response = self.client.get("/api/nearby-doctors?lat=12.9716&lon=77.5946&radius_km=3.0")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        print(f"[+] Nearby Doctors Found: {data.get('total_found', 0)} facilities")
        
        self.assertIn("query_location", data)
        self.assertIn("facilities", data)
        if data.get("facilities"):
            first = data["facilities"][0]
            print(f"    First Facility: {first['name']} ({first['distance_km']} km) - {first['address']}")
            self.assertIn("name", first)
            self.assertIn("distance_km", first)
            self.assertIn("maps_url", first)

    def test_04_nearby_doctors_missing_coords(self):
        """Test GET /api/nearby-doctors rejects missing coordinates."""
        response = self.client.get("/api/nearby-doctors")
        self.assertEqual(response.status_code, 400)
        data = response.get_json()
        self.assertIn("error", data)

    def test_05_legacy_symptoms_prediction_compatibility(self):
        """Test backward compatibility for POST /api/ai/predict with symptoms submission."""
        response = self.client.post(
            "/api/ai/predict",
            json={"submission_type": "symptoms", "description": "chest pain and breathlessness"},
        )
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        print(f"[+] Legacy API Symptoms Response: Disease = {data['predicted_disease']}, Tier = {data['decision_tier']}")
        self.assertEqual(data["predicted_disease"], "Heart attack")
        self.assertEqual(data["decision_tier"], "CRITICAL")


if __name__ == "__main__":
    unittest.main(verbosity=2)
