import os
from pathlib import Path
import tempfile
from uuid import uuid4

import requests
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename

from chest_predictor import analyze_chest_xray, generate_gradcam as generate_chest_gradcam
from geolocation_service import get_nearby_doctors
from nlp_service import transcribe_audio, extract_symptoms, get_whisper_model
from skin_predictor import analyze_skin_disease, generate_gradcam as generate_skin_gradcam
from symptom_predictor import analyze_symptoms, get_symptom_vocabulary, _load_artifacts
from case_synthesis_service import synthesize_case


ROOT_DIR = Path(__file__).resolve().parents[2]
RUNTIME_DIR = ROOT_DIR / "backend" / "runtime"
UPLOAD_DIR = RUNTIME_DIR / "uploads"
HEATMAP_DIR = RUNTIME_DIR / "heatmaps"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
HEATMAP_DIR.mkdir(parents=True, exist_ok=True)

app = Flask(__name__)
CORS(app)


DISEASE_EXPLANATIONS = {
    "Actinic Keratoses": {
        "about": "A rough, scaly lesion often linked with cumulative sun exposure. It can be precancerous, so clinical review is important.",
        "signals": ["Rough or crusted texture", "Sun-exposed skin pattern", "Pink, red, or brown color variation"],
    },
    "Basal Cell Carcinoma": {
        "about": "A common skin cancer that may appear pearly, shiny, ulcerated, or slowly enlarging.",
        "signals": ["Rolled or raised border", "Pearly or translucent areas", "Local contrast around the lesion edge"],
    },
    "Benign Keratosis": {
        "about": "A non-cancerous growth category that can look waxy, stuck-on, or scaly.",
        "signals": ["Well-defined lesion border", "Waxy or keratin-like texture", "Brown or tan pigmentation pattern"],
    },
    "Dermatofibroma": {
        "about": "A usually benign firm skin nodule that can appear brown, pink, or scar-like.",
        "signals": ["Compact rounded region", "Central color or texture change", "Border contrast with surrounding skin"],
    },
    "Melanoma": {
        "about": "A serious skin cancer associated with irregular pigment, border, shape, or color changes.",
        "signals": ["Asymmetric color distribution", "Irregular lesion edges", "Dark or multi-toned pigment regions"],
    },
    "Melanocytic Nevus": {
        "about": "A mole-like melanocytic lesion that is often benign, though changes should be checked.",
        "signals": ["Pigmented lesion body", "Relatively organized shape", "Color concentration within the mole"],
    },
    "Vascular Lesions": {
        "about": "A group of blood-vessel-related lesions, often with red, purple, or blue coloration.",
        "signals": ["Red or purple vascular color", "Clustered color intensity", "Smooth lesion boundaries"],
    },
}


def build_xai_explanation(result):
    disease = result["predicted_disease"]
    confidence = result["confidence"] * 100
    explanation = DISEASE_EXPLANATIONS.get(disease, {})

    if confidence >= 80:
        confidence_note = "The model is strongly weighted toward this class compared with the alternatives."
    elif confidence >= 55:
        confidence_note = "The model found this class most likely, but nearby alternatives should be reviewed."
    else:
        confidence_note = "The model confidence is low, so treat this as a weak screening signal."

    return {
        "about": explanation.get("about", "The model matched visual patterns learned from the HAM10000 classes."),
        "signals": explanation.get("signals", ["Lesion color", "Texture", "Border and shape pattern"]),
        "confidence_note": confidence_note,
        "gradcam_note": "The heatmap highlights image regions that most influenced the predicted class. Warmer colors contributed more to the score.",
    }


def build_chest_xai_explanation(result):
    finding = result["predicted_disease"]
    confidence = result["confidence"] * 100
    if confidence >= 80:
        confidence_note = "The model assigned a high probability to this observation on this X-ray."
    elif confidence >= 50:
        confidence_note = "The model found this observation more likely than the other learned findings."
    else:
        confidence_note = "The highest model score is low; this should be treated as a weak screening signal."

    return {
        "about": (
            f"The chest X-ray model identified {finding} as the strongest learned observation. "
            "This is an AI screening output, not a radiology diagnosis."
        ),
        "signals": [
            "Lung-field opacity and density patterns",
            "Cardiomediastinal silhouette and pleural regions",
            "Spatial areas emphasized by the Grad-CAM overlay",
        ],
        "confidence_note": confidence_note,
        "gradcam_note": (
            "Warmer heatmap regions contributed more to the selected chest finding. "
            "Use this only as an explanation of model attention, not as a diagnostic annotation."
        ),
    }


def build_symptom_xai_explanation(result):
    return {
        "about": (
            "This screening result comes from the supplied structured symptom model. "
            "It is not a diagnosis and requires clinician assessment with history, examination, and appropriate tests."
        ),
        "signals": result["matched_symptoms"],
        "confidence_note": (
            "Confidence ranks this model's known condition classes for the matched symptoms; "
            "it does not establish disease probability in a clinical population."
        ),
    }


def build_self_care_guidance(result):
    """Conservative, patient-facing support; never a substitute for assessment."""
    condition = result["predicted_disease"]
    symptoms = set(result["matched_symptoms"])
    emergency_symptoms = {
        "chest pain", "sharp chest pain", "burning chest pain",
        "breathlessness", "shortness of breath", "difficulty breathing", "breathing fast",
        "blood in sputum", "hemoptysis", "vomiting blood", "stomach bleeding", "bloody stool",
        "focal weakness", "weakness of one body side", "slurring words", "altered sensorium", "coma", "fainting",
    }

    if symptoms & emergency_symptoms:
        return {
            "level": "urgent",
            "title": "Get urgent medical help now",
            "steps": [],
            "warning": "Chest pain, breathing difficulty, bleeding, confusion, fainting, or one-sided weakness can be emergency warning signs. Contact your local emergency service or go to an emergency department.",
        }

    advice = [
        "Rest and avoid strenuous activity while you feel unwell.",
        "Drink water regularly; take small, frequent sips if nausea is present.",
        "Seek advice from a pharmacist or clinician before taking any medicine, especially during pregnancy or if you have long-term conditions.",
    ]
    if condition in {"Common Cold", "Allergy", "Bronchial Asthma"}:
        advice = [
            "Rest and drink plenty of non-alcoholic fluids.",
            "A clean humidifier or warm shower may make nasal or throat discomfort feel easier.",
            "Avoid smoke and other triggers that worsen coughing or wheeze.",
        ]
    elif condition in {"Gastroenteritis", "Typhoid"} or {"vomiting", "diarrhoea"} & symptoms:
        advice = [
            "Take small, frequent sips of water or an oral rehydration drink.",
            "Rest and eat light foods only when you can keep fluids down.",
            "Avoid alcohol and very fatty or spicy foods while symptoms continue.",
        ]

    return {
        "level": "self_care",
        "title": "Supportive self-care while arranging clinical review",
        "steps": advice,
        "warning": "Get medical advice promptly if symptoms worsen, do not improve, or you cannot keep fluids down. This guidance does not confirm the model's suggested condition.",
    }


def download_image(image_url, original_name="skin-image.jpg"):
    suffix = Path(secure_filename(original_name)).suffix.lower() or ".jpg"
    image_path = UPLOAD_DIR / f"{uuid4().hex}{suffix}"

    response = requests.get(image_url, timeout=30)
    response.raise_for_status()
    image_path.write_bytes(response.content)

    return image_path


@app.get("/api/health")
def health():
    return jsonify({"ok": True, "models": ["Skin Disease Predictor", "Chest X-ray Findings Predictor", "Symptom Condition Predictor", "Voice Transcription (Whisper)"]})


@app.get("/api/models/status")
def models_status():
    """Return live load readiness status for all 4 AI screening models."""
    status = {}
    
    # 1. XGBoost Symptom Model
    try:
        _load_artifacts()
        status["symptom_model"] = {"loaded": True, "type": "XGBoost (131 features -> 41 classes)", "xai": "Tree SHAP"}
    except Exception as err:
        status["symptom_model"] = {"loaded": False, "error": str(err)}

    # 2. Chest X-Ray DenseNet-121 Model
    try:
        import chest_predictor
        if hasattr(chest_predictor, "model") and chest_predictor.model is not None:
            status["chest_xray_model"] = {"loaded": True, "type": "DenseNet-121 (14 findings, Sigmoid)", "xai": "Grad-CAM (relu)"}
        else:
            status["chest_xray_model"] = {"loaded": False, "error": "Model not initialized"}
    except Exception as err:
        status["chest_xray_model"] = {"loaded": False, "error": str(err)}

    # 3. Skin Disease MobileNetV2 Model
    try:
        import skin_predictor
        if hasattr(skin_predictor, "model") and skin_predictor.model is not None:
            status["skin_disease_model"] = {"loaded": True, "type": "MobileNetV2 (7 lesion classes, Softmax)", "xai": "Grad-CAM (Conv_1)"}
        else:
            status["skin_disease_model"] = {"loaded": False, "error": "Model not initialized"}
    except Exception as err:
        status["skin_disease_model"] = {"loaded": False, "error": str(err)}

    # 4. Whisper Voice Transcription
    try:
        get_whisper_model("base")
        status["voice_transcription"] = {"loaded": True, "type": "OpenAI Whisper (base, local CPU)"}
    except Exception as err:
        status["voice_transcription"] = {"loaded": False, "error": str(err)}

    return jsonify({"ok": True, "models": status})


@app.get("/api/nearby-doctors")
def nearby_doctors():
    """Fetch mapped hospitals or doctor/clinic locations within a bounded GPS radius."""
    lat = request.args.get("lat", type=float)
    lon = request.args.get("lon", type=float)
    radius_km = request.args.get("radius_km", default=3.0, type=float)
    kind = request.args.get("kind", default="hospital")

    if lat is None or lon is None or not (-90 <= lat <= 90) or not (-180 <= lon <= 180) or radius_km is None:
        return jsonify({
            "error": "Latitude ('lat') and Longitude ('lon') query parameters are required.",
            "example": "/api/nearby-doctors?lat=12.9716&lon=77.5946&radius_km=3.0"
        }), 400

    if kind not in {"hospital", "doctor"}:
        return jsonify({"error": "kind must be hospital or doctor"}), 400

    result = get_nearby_doctors(lat, lon, radius_km=radius_km, kind=kind)
    return jsonify(result)


@app.get("/api/ai/heatmaps/<path:filename>")
def heatmap(filename):
    return send_from_directory(HEATMAP_DIR, filename)


@app.get("/api/ai/symptoms")
def available_symptoms():
    return jsonify({"symptoms": get_symptom_vocabulary()})


@app.post("/api/cases/synthesize")
def synthesize_case_endpoint():
    """Summarize independent modality outputs without claiming multimodal inference."""
    payload = request.get_json(silent=True) or {}
    try:
        return jsonify(synthesize_case(payload.get("assessments")))
    except ValueError as error:
        return jsonify({"error": str(error)}), 422


# --- MODULAR PREDICTION ENDPOINTS ---

@app.post("/api/predict/symptoms")
def predict_symptoms_modular():
    payload = request.get_json(silent=True) or {}
    description = payload.get("description", "")
    selected_symptoms = payload.get("selected_symptoms")

    try:
        result = analyze_symptoms(description, selected_symptoms)
    except Exception as error:
        app.logger.exception("Modular symptom prediction failed")
        return jsonify({"error": str(error)}), 422

    return jsonify({
        **result,
        "model": "Symptom Condition Predictor (XGBoost)",
        "model_type": "symptom_condition",
        "supported_conditions": result["supported_conditions"],
        "decision_support": result.get("decision_support"),
        "decision_tier": result.get("decision_tier"),
        "model_score": result.get("model_score"),
        "disclaimer": result.get("decision_support", {}).get("disclaimer"),
        "xai": result.get("xai") or build_symptom_xai_explanation(result),
        "self_care": build_self_care_guidance(result),
        "summary": f"Highest-ranked symptom condition: {result['predicted_disease']} ({result['confidence'] * 100:.1f}%).",
    })


def _process_image_prediction(is_skin: bool):
    """Helper to process image predictions from both URL and multipart upload."""
    uploaded_file = request.files.get("file") or request.files.get("image")
    
    if uploaded_file and uploaded_file.filename:
        filename = secure_filename(uploaded_file.filename) or ("skin-image.jpg" if is_skin else "chest-xray.jpg")
        suffix = Path(filename).suffix.lower() or ".jpg"
        image_path = UPLOAD_DIR / f"{uuid4().hex}{suffix}"
        uploaded_file.save(image_path)
    else:
        payload = request.get_json(silent=True) or {}
        image_url = payload.get("image_url")
        if not image_url:
            return jsonify({"error": "Missing image file upload or 'image_url' in request payload."}), 400
        image_path = download_image(image_url, payload.get("file_name") or ("skin-image.jpg" if is_skin else "chest-xray.jpg"))

    try:
        result = analyze_skin_disease(image_path) if is_skin else analyze_chest_xray(image_path)

        heatmap_name = f"gradcam_{uuid4().hex}.jpg"
        heatmap_generator = generate_skin_gradcam if is_skin else generate_chest_gradcam
        heatmap_path = heatmap_generator(
            image_path,
            HEATMAP_DIR / heatmap_name,
            class_index=result["class_index"],
        )
    except Exception:
        app.logger.exception("Image AI prediction failed")
        return jsonify({"error": "AI prediction failed. Ensure model dependencies are installed."}), 500

    return jsonify({
        **result,
        "model": "Skin Disease Predictor" if is_skin else "Chest X-ray Findings Predictor",
        "model_type": "skin_disease" if is_skin else "chest_xray_findings",
        "decision_support": result.get("decision_support"),
        "decision_tier": result.get("decision_tier"),
        "finding_status": result.get("finding_status"),
        "model_score": result.get("model_score"),
        "disclaimer": result.get("decision_support", {}).get("disclaimer"),
        "xai": build_xai_explanation(result) if is_skin else build_chest_xai_explanation(result),
        "heatmap_url": f"http://localhost:8000/api/ai/heatmaps/{heatmap_path.name}",
        "summary": (
            f"Predicted {result['predicted_disease']} with {result['confidence'] * 100:.1f}% confidence."
            if is_skin
            else f"Highest chest finding: {result['predicted_disease']} ({result['confidence'] * 100:.1f}%)."
        ),
    })


@app.post("/api/predict/chest-xray")
def predict_chest_xray_modular():
    return _process_image_prediction(is_skin=False)


@app.post("/api/predict/skin")
def predict_skin_modular():
    return _process_image_prediction(is_skin=True)


# --- LEGACY COMBINED ENDPOINT (FULL BACKWARD COMPATIBILITY) ---

@app.post("/api/ai/predict")
def predict():
    payload = request.get_json(silent=True) or {}
    submission_type = payload.get("submission_type")

    if submission_type == "symptoms":
        return predict_symptoms_modular()

    if submission_type in {"skin_image", "chest_xray"}:
        return _process_image_prediction(is_skin=(submission_type == "skin_image"))

    return jsonify({"error": "No AI model is configured for this submission type."}), 400


# --- VOICE ENDPOINTS ---

@app.post("/api/transcribe")
def transcribe_endpoint():
    audio_file = request.files.get("audio") or request.files.get("file")
    if not audio_file or not audio_file.filename:
        return jsonify({"error": "No audio file provided. Please upload an audio file in the 'audio' field."}), 400

    filename = secure_filename(audio_file.filename) or "recording.wav"
    suffix = Path(filename).suffix.lower() or ".wav"

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_audio:
        audio_file.save(temp_audio.name)
        temp_path = Path(temp_audio.name)

    try:
        transcription_data = transcribe_audio(temp_path)
        transcript = transcription_data["transcript"]
        extracted_symptoms = extract_symptoms(transcript)

        return jsonify({
            "transcript": transcript,
            "language": transcription_data["language"],
            "duration_s": transcription_data["duration_s"],
            "extracted_symptoms": extracted_symptoms,
            "symptom_count": len(extracted_symptoms),
            "vocabulary_size": len(get_symptom_vocabulary()),
        })
    except Exception as error:
        app.logger.exception("Audio transcription failed")
        return jsonify({"error": f"Audio transcription failed: {str(error)}"}), 500
    finally:
        if temp_path.exists():
            try:
                os.remove(temp_path)
            except Exception:
                pass


@app.post("/api/predict/voice")
def voice_predict_endpoint():
    audio_file = request.files.get("audio") or request.files.get("file")
    if not audio_file or not audio_file.filename:
        return jsonify({"error": "No audio file provided. Please upload an audio file in the 'audio' field."}), 400

    filename = secure_filename(audio_file.filename) or "recording.wav"
    suffix = Path(filename).suffix.lower() or ".wav"

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_audio:
        audio_file.save(temp_audio.name)
        temp_path = Path(temp_audio.name)

    try:
        transcription_data = transcribe_audio(temp_path)
        transcript = transcription_data["transcript"]
        extracted_symptoms = extract_symptoms(transcript)

        if not extracted_symptoms:
            return jsonify({
                "error": "No recognizable symptoms were found in the spoken transcript.",
                "transcript": transcript,
                "extracted_symptoms": [],
                "supported_vocabulary": get_symptom_vocabulary(),
            }), 422

        result = analyze_symptoms(
            transcript,
            selected_symptoms=extracted_symptoms,
        )

        return jsonify({
            **result,
            "model": "Voice & Symptom Condition Predictor (Whisper + XGBoost)",
            "model_type": "voice_symptom_condition",
            "transcript": transcript,
            "extracted_symptoms": extracted_symptoms,
            "supported_conditions": result["supported_conditions"],
            "decision_support": result.get("decision_support"),
            "decision_tier": result.get("decision_tier"),
            "model_score": result.get("model_score"),
            "disclaimer": result.get("decision_support", {}).get("disclaimer"),
            "xai": result.get("xai") or build_symptom_xai_explanation(result),
            "self_care": build_self_care_guidance(result),
            "summary": (
                f"Transcribed '{transcript[:60]}...'. Highest-ranked condition: {result['predicted_disease']} "
                f"({result['confidence'] * 100:.1f}%)."
            ),
        })
    except ValueError as val_err:
        return jsonify({"error": str(val_err), "transcript": transcript if 'transcript' in locals() else ""}), 422
    except Exception as error:
        app.logger.exception("Voice prediction failed")
        return jsonify({"error": f"Voice prediction failed: {str(error)}"}), 500
    finally:
        if temp_path.exists():
            try:
                os.remove(temp_path)
            except Exception:
                pass


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
