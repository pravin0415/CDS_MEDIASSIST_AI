"""Phase 3 Verification Test Suite: Voice Input & NLP Symptom Extraction.

Tests:
1. NLP Symptom extraction from free-text transcripts against 131-vocabulary.
2. Whisper model lazy loading and audio transcription.
3. Flask endpoint POST /api/transcribe.
4. Updated GET /api/health endpoint.
5. End-to-end POST /api/predict/voice endpoint with transcription mock.
"""

import io
import os
from pathlib import Path
import struct
import sys
import unittest
from unittest.mock import patch
import wave

# Ensure backend/ai is in sys.path
CURRENT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(CURRENT_DIR))

from nlp_service import extract_symptoms, get_whisper_model, transcribe_audio
from server import app
from symptom_predictor import get_symptom_vocabulary


def generate_test_wav_bytes(duration_s=1.0, sample_rate=16000) -> bytes:
    """Generate a valid 16kHz mono WAV file in memory with a simple tone."""
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as wav_file:
        wav_file.setnchannels(1)  # Mono
        wav_file.setsampwidth(2)  # 16-bit PCM
        wav_file.setframerate(sample_rate)
        
        num_samples = int(duration_s * sample_rate)
        samples = [int(100 * (i % 10)) for i in range(num_samples)]
        packed = struct.pack(f'<{num_samples}h', *samples)
        wav_file.writeframes(packed)
        
    return buf.getvalue()


class TestPhase3VoiceAndNLP(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.client = app.test_client()
        cls.vocabulary = get_symptom_vocabulary()

    def test_01_nlp_symptom_extraction(self):
        """Test extraction of 131-vocabulary tokens from free-text speech transcripts."""
        text = "Hello doctor, I have been having a high fever, a bad cough, and chest pain since yesterday."
        extracted = extract_symptoms(text)
        
        print(f"\n[+] Transcript: '{text}'")
        print(f"[+] Extracted symptoms: {extracted}")
        
        self.assertIn("high fever", extracted)
        self.assertIn("cough", extracted)
        self.assertIn("chest pain", extracted)
        
        alias_text = "I feel tired and have shortness of breath when walking."
        alias_extracted = extract_symptoms(alias_text)
        print(f"[+] Alias Transcript: '{alias_text}'")
        print(f"[+] Extracted symptoms: {alias_extracted}")
        self.assertIn("fatigue", alias_extracted)
        self.assertTrue("breathlessness" in alias_extracted or "shortness of breath" in alias_extracted)

    def test_02_whisper_model_loading_and_transcribe(self):
        """Test Whisper model instantiation and audio transcription on synthetic WAV."""
        print("\n[+] Testing Whisper model lazy loading...")
        model = get_whisper_model("base")
        self.assertIsNotNone(model)
        
        wav_data = generate_test_wav_bytes(duration_s=1.0)
        temp_wav = CURRENT_DIR / "temp_test.wav"
        temp_wav.write_bytes(wav_data)
        
        try:
            result = transcribe_audio(temp_wav)
            print(f"[+] Whisper transcription result: {result}")
            self.assertIn("transcript", result)
            self.assertIn("language", result)
            self.assertIn("duration_s", result)
        finally:
            if temp_wav.exists():
                os.remove(temp_wav)

    def test_03_transcribe_endpoint(self):
        """Test POST /api/transcribe Flask endpoint."""
        print("\n[+] Testing POST /api/transcribe endpoint...")
        wav_data = generate_test_wav_bytes(duration_s=1.5)
        
        response = self.client.post(
            "/api/transcribe",
            data={"audio": (io.BytesIO(wav_data), "speech.wav", "audio/wav")},
            content_type="multipart/form-data",
        )
        
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        print(f"[+] API Response: {data}")
        self.assertIn("transcript", data)
        self.assertIn("extracted_symptoms", data)
        self.assertEqual(data["vocabulary_size"], 131)

    def test_04_health_check_updated(self):
        """Test GET /api/health includes Voice Transcription."""
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        print(f"[+] Health check models: {data['models']}")
        self.assertIn("Voice Transcription (Whisper)", data["models"])

    @patch("server.transcribe_audio")
    def test_05_voice_predict_endpoint_full_pipeline(self, mock_transcribe):
        """Test POST /api/predict/voice full pipeline (transcribe -> extract -> XGBoost -> SHAP -> decision tier)."""
        print("\n[+] Testing POST /api/predict/voice full pipeline...")
        mock_transcribe.return_value = {
            "transcript": "Doctor, I have severe chest pain, shortness of breath, and sweating.",
            "language": "en",
            "duration_s": 4.5,
        }
        
        wav_data = generate_test_wav_bytes(duration_s=2.0)
        response = self.client.post(
            "/api/predict/voice",
            data={"audio": (io.BytesIO(wav_data), "patient_voice.wav", "audio/wav")},
            content_type="multipart/form-data",
        )
        
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        print(f"[+] Voice Predict Response - Predicted Disease: {data['predicted_disease']}")
        print(f"[+] Decision Tier: {data['decision_tier']}")
        print(f"[+] Extracted Symptoms: {data['extracted_symptoms']}")
        print(f"[+] SHAP XAI Method: {data['xai']['method']}")

        self.assertEqual(data["model_type"], "voice_symptom_condition")
        self.assertIn("breathlessness", data["extracted_symptoms"])
        self.assertIn("chest pain", data["extracted_symptoms"])
        self.assertIn("sweating", data["extracted_symptoms"])
        self.assertEqual(data["predicted_disease"], "Heart attack")
        self.assertEqual(data["decision_tier"], "CRITICAL")
        self.assertEqual(data["xai"]["method"], "SHAP")
        self.assertGreater(len(data["xai"]["top_positive_contributors"]), 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
