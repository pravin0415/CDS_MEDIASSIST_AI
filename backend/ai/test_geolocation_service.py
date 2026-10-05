import unittest
import sys
from unittest.mock import Mock, patch

try:
    import requests  # noqa: F401
except ModuleNotFoundError:
    # The geometry test does not make HTTP calls; the backend runtime installs
    # requests via requirements.txt, while minimal test runtimes may omit it.
    sys.modules["requests"] = Mock()

from geolocation_service import get_nearby_doctors


class NearbyHospitalTests(unittest.TestCase):
    @patch("geolocation_service.requests.post")
    def test_radius_requires_explicit_expansion_and_results_are_sorted(self, post):
        response = Mock()
        response.json.return_value = {"elements": [
            {"type": "node", "id": 1, "lat": 0.03, "lon": 0, "tags": {"amenity": "hospital", "name": "Far"}},
            {"type": "node", "id": 2, "lat": 0.01, "lon": 0, "tags": {"amenity": "hospital", "name": "Near"}},
            {"type": "node", "id": 3, "lat": 0.001, "lon": 0, "tags": {"amenity": "clinic", "name": "Not a hospital"}},
        ]}
        post.return_value = response
        nearby = get_nearby_doctors(0, 0, radius_km=3)
        self.assertEqual([item["name"] for item in nearby["facilities"]], ["Near"])
        expanded = get_nearby_doctors(0, 0, radius_km=5)
        self.assertEqual([item["name"] for item in expanded["facilities"]], ["Near", "Far"])

    @patch("geolocation_service.requests.post")
    def test_doctor_search_excludes_hospitals_and_respects_radius(self, post):
        response = Mock()
        response.json.return_value = {"elements": [
            {"type": "node", "id": 1, "lat": 0.01, "lon": 0, "tags": {"healthcare": "doctor", "name": "Nearby Practice"}},
            {"type": "node", "id": 2, "lat": 0.02, "lon": 0, "tags": {"amenity": "clinic", "name": "Local Clinic"}},
            {"type": "node", "id": 3, "lat": 0.001, "lon": 0, "tags": {"amenity": "hospital", "name": "Hospital"}},
            {"type": "node", "id": 4, "lat": 0.09, "lon": 0, "tags": {"amenity": "doctors", "name": "Too Far"}},
        ]}
        post.return_value = response
        nearby = get_nearby_doctors(0, 0, radius_km=3, kind="doctor")
        self.assertEqual([item["name"] for item in nearby["facilities"]], ["Nearby Practice", "Local Clinic"])
        self.assertEqual([item["type"] for item in nearby["facilities"]], ["doctor", "clinic"])


if __name__ == "__main__":
    unittest.main()
