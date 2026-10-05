from pathlib import Path
import json
import zipfile

import cv2
import numpy as np
import tensorflow as tf
from tensorflow.keras.applications.densenet import preprocess_input
from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing import image


ROOT_DIR = Path(__file__).resolve().parents[2]
MODEL_PATH = ROOT_DIR / "models" / "chest_xray" / "mediassist_phase2_best.keras"
COMPAT_MODEL_PATH = ROOT_DIR / "backend" / "runtime" / "mediassist_phase2_compatible.keras"

# This model has a 14-node sigmoid output, trained for the standard MIMIC-CXR
# observation set.  Keep this order aligned with the training-label columns.
CLASS_NAMES = [
    "Atelectasis",
    "Cardiomegaly",
    "Consolidation",
    "Edema",
    "Enlarged Cardiomediastinum",
    "Fracture",
    "Lung Lesion",
    "Lung Opacity",
    "No Finding",
    "Pleural Effusion",
    "Pleural Other",
    "Pneumonia",
    "Pneumothorax",
    "Support Devices",
]


def _remove_unsupported_config_fields(value):
    """Remove metadata unknown to older Keras without altering model weights."""
    if isinstance(value, dict):
        value.pop("quantization_config", None)
        for nested_value in value.values():
            _remove_unsupported_config_fields(nested_value)
    elif isinstance(value, list):
        for nested_value in value:
            _remove_unsupported_config_fields(nested_value)


def _get_compatible_model_path():
    """Build a local runtime copy for Keras releases older than 3.13."""
    COMPAT_MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    if COMPAT_MODEL_PATH.exists() and (
        COMPAT_MODEL_PATH.stat().st_mtime >= MODEL_PATH.stat().st_mtime
    ):
        return COMPAT_MODEL_PATH

    with zipfile.ZipFile(MODEL_PATH, "r") as source:
        config = json.loads(source.read("config.json"))
        _remove_unsupported_config_fields(config)

        temporary_path = COMPAT_MODEL_PATH.with_suffix(".tmp.keras")
        with zipfile.ZipFile(temporary_path, "w", compression=zipfile.ZIP_STORED) as target:
            for item in source.infolist():
                contents = (
                    json.dumps(config, separators=(",", ":")).encode("utf-8")
                    if item.filename == "config.json"
                    else source.read(item.filename)
                )
                target.writestr(item.filename, contents)

    temporary_path.replace(COMPAT_MODEL_PATH)
    return COMPAT_MODEL_PATH


model = load_model(_get_compatible_model_path(), compile=False)


def preprocess_image(image_path):
    """Load a chest X-ray using the DenseNet-121 training preprocessing."""
    img = image.load_img(image_path, target_size=(224, 224), color_mode="rgb")
    array = image.img_to_array(img)
    array = preprocess_input(array)
    return np.expand_dims(array, axis=0)


from decision_support_service import evaluate_decision_support


def analyze_chest_xray(image_path):
    image_batch = preprocess_image(image_path)
    probabilities = model.predict(image_batch, verbose=0)[0]
    ranked_indices = np.argsort(probabilities)[::-1]
    class_index = int(ranked_indices[0])

    scores = {CLASS_NAMES[i]: float(probabilities[i]) for i in range(len(CLASS_NAMES))}
    decision_support = evaluate_decision_support("chest_xray", {"scores": scores})

    # All 14 observations evaluated
    top_predictions = [
        {
            "label": CLASS_NAMES[int(index)],
            "confidence": round(float(probabilities[int(index)]), 4),
            "model_score": round(float(probabilities[int(index)]), 4),
        }
        for index in ranked_indices
    ]

    # Combine detected pathologies and hardware without contradictory No Finding
    detected_findings = []
    for p in decision_support["detected_pathologies"]:
        detected_findings.append({
            "label": p["label"],
            "confidence": p["model_score"],
            "model_score": p["model_score"],
            "class_index": CLASS_NAMES.index(p["label"]),
            "clinical_urgency": p["clinical_urgency"],
        })
    for h in decision_support["hardware_observations"]:
        detected_findings.append({
            "label": h["label"],
            "confidence": h["model_score"],
            "model_score": h["model_score"],
            "class_index": CLASS_NAMES.index(h["label"]),
            "clinical_urgency": h["clinical_urgency"],
        })

    # If unremarkable, expose No Acute Finding cleanly
    if decision_support["finding_status"] == "UNREMARKABLE":
        detected_findings = [{
            "label": "No Acute Finding",
            "confidence": decision_support["headline_score"],
            "model_score": decision_support["headline_score"],
            "class_index": CLASS_NAMES.index("No Finding"),
            "clinical_urgency": "MILD",
        }]

    # Determine headline class_index for Grad-CAM
    headline_label = decision_support["headline_finding"]
    headline_idx = CLASS_NAMES.index(headline_label) if headline_label in CLASS_NAMES else class_index

    return {
        "class_index": headline_idx,
        "predicted_disease": headline_label,
        "prediction": headline_label,
        "confidence": decision_support["headline_score"],
        "model_score": decision_support["headline_score"],
        "decision_tier": decision_support["decision_tier"],
        "finding_status": decision_support["finding_status"],
        "decision_support": decision_support,
        "top_predictions": top_predictions,
        "detected_findings": detected_findings,
        "all_scores": scores,
    }


def generate_gradcam(image_path, output_path, class_index=None):
    """Create a Grad-CAM overlay for the selected chest finding."""
    image_batch = preprocess_image(image_path)
    last_conv_layer = model.get_layer("relu")
    grad_model = tf.keras.Model(
        inputs=model.inputs,
        outputs=[last_conv_layer.output, model.output],
    )

    with tf.GradientTape() as tape:
        conv_outputs, predictions = grad_model(image_batch, training=False)
        if class_index is None:
            class_index = int(tf.argmax(predictions[0]))
        class_channel = predictions[:, class_index]

    gradients = tape.gradient(class_channel, conv_outputs)
    if gradients is None:
        raise ValueError("Could not compute gradients for the selected finding.")

    pooled_gradients = tf.reduce_mean(gradients, axis=(0, 1, 2))
    heatmap = tf.reduce_sum(conv_outputs[0] * pooled_gradients, axis=-1)
    heatmap = tf.maximum(heatmap, 0)
    maximum = tf.reduce_max(heatmap)
    heatmap = tf.zeros_like(heatmap) if maximum == 0 else heatmap / maximum

    original = cv2.imread(str(image_path))
    if original is None:
        raise ValueError(f"Could not read image at {image_path}")

    heatmap = cv2.resize(heatmap.numpy(), (original.shape[1], original.shape[0]))
    heatmap = cv2.applyColorMap(np.uint8(255 * heatmap), cv2.COLORMAP_JET)
    overlay = cv2.addWeighted(original, 0.6, heatmap, 0.4, 0)

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if not cv2.imwrite(str(output_path), overlay):
        raise ValueError(f"Could not write Grad-CAM image to {output_path}")

    return output_path
