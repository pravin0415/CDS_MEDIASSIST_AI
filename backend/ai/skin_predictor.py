from pathlib import Path
import json
import zipfile

import cv2
import numpy as np
import tensorflow as tf
from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing import image

from skin_class_names import class_names
from decision_support_service import evaluate_decision_support


ROOT_DIR = Path(__file__).resolve().parents[2]
MODEL_PATH = ROOT_DIR / "models" / "skin_disease" / "skin_disease_model.keras"
COMPAT_MODEL_PATH = ROOT_DIR / "backend" / "runtime" / "skin_disease_model_compatible_v2.keras"


def _remove_unsupported_config_fields(value):
    """Remove newer-Keras metadata that does not affect learned weights."""
    if isinstance(value, dict):
        for field in (
            "quantization_config",
            "input_axes",
            "output_axes",
            "renorm",
            "renorm_clipping",
            "renorm_momentum",
        ):
            value.pop(field, None)
        for nested_value in value.values():
            _remove_unsupported_config_fields(nested_value)
    elif isinstance(value, list):
        for nested_value in value:
            _remove_unsupported_config_fields(nested_value)


def _get_compatible_model_path():
    """Create a runtime-only Keras archive compatible with the installed Keras."""
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
    img = image.load_img(image_path, target_size=(224, 224))
    img = image.img_to_array(img)
    img = img / 255.0
    return np.expand_dims(img, axis=0)


def analyze_skin_disease(image_path):
    img = preprocess_image(image_path)
    prediction = model.predict(img, verbose=0)[0]
    class_index = int(np.argmax(prediction))
    confidence = float(prediction[class_index])

    decision_support = evaluate_decision_support("skin", {
        "predicted_disease": class_names[class_index],
        "model_score": confidence,
    })

    top_indices = np.argsort(prediction)[::-1]
    top_predictions = [
        {
            "label": class_names[int(index)],
            "confidence": round(float(prediction[int(index)]), 4),
            "model_score": round(float(prediction[int(index)]), 4),
        }
        for index in top_indices
    ]

    return {
        "class_index": class_index,
        "predicted_disease": class_names[class_index],
        "prediction": class_names[class_index],
        "confidence": round(confidence, 4),
        "model_score": round(confidence, 4),
        "decision_tier": decision_support["decision_tier"],
        "decision_support": decision_support,
        "top_predictions": top_predictions,
    }


def _build_gradcam_model():
    base_model = model.layers[0]
    last_conv_layer = base_model.get_layer("Conv_1")
    return tf.keras.Model(
        inputs=base_model.input,
        outputs=[last_conv_layer.output, base_model.output],
    )


base_grad_model = _build_gradcam_model()


def _classifier_prediction(base_output):
    x = base_output
    for layer in model.layers[1:]:
        x = layer(x, training=False)
    return x


def generate_gradcam(img_path, output_path, class_index=None):
    img = preprocess_image(img_path)

    with tf.GradientTape() as tape:
        conv_outputs, base_output = base_grad_model(img)
        predictions = _classifier_prediction(base_output)

        if class_index is None:
            class_index = tf.argmax(predictions[0])

        class_channel = predictions[:, class_index]

    grads = tape.gradient(class_channel, conv_outputs)

    if grads is None:
        raise ValueError("Could not compute gradients for the selected class.")

    pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))
    conv_outputs = conv_outputs[0]
    heatmap = tf.reduce_sum(conv_outputs * pooled_grads, axis=-1)
    heatmap = tf.maximum(heatmap, 0)

    max_value = tf.reduce_max(heatmap)
    heatmap = tf.zeros_like(heatmap) if max_value == 0 else heatmap / max_value
    heatmap = heatmap.numpy()

    original = cv2.imread(str(img_path))
    if original is None:
        raise ValueError(f"Could not read image at {img_path}")

    heatmap = cv2.resize(heatmap, (original.shape[1], original.shape[0]))
    heatmap = np.uint8(255 * heatmap)
    heatmap = cv2.applyColorMap(heatmap, cv2.COLORMAP_JET)

    output = cv2.addWeighted(original, 0.6, heatmap, 0.4, 0)

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(output_path), output)

    return output_path
