"""NLP and Voice Transcription Service for MediAssist AI.

Uses OpenAI Whisper ('base' model) for local audio transcription and token matching
against the exact 131-symptom vocabulary used by the XGBoost model.
"""

from functools import lru_cache
from pathlib import Path
import wave
import numpy as np

from symptom_predictor import get_symptom_vocabulary, _matched_symptoms

_WHISPER_MODEL = None


def get_whisper_model(model_name: str = "base"):
    """Lazy-load the OpenAI Whisper model instance."""
    global _WHISPER_MODEL
    if _WHISPER_MODEL is None:
        import whisper
        _WHISPER_MODEL = whisper.load_model(model_name)
    return _WHISPER_MODEL


def load_wav_file(file_path: str | Path, target_sr: int = 16000) -> np.ndarray:
    """Read a WAV file using Python standard library wave module (ffmpeg-free)."""
    file_path = str(Path(file_path).resolve())
    with wave.open(file_path, 'rb') as wf:
        n_channels = wf.getnchannels()
        sampwidth = wf.getsampwidth()
        framerate = wf.getframerate()
        n_frames = wf.getnframes()
        
        raw_bytes = wf.readframes(n_frames)
        
        if sampwidth == 2:
            dtype = np.int16
            denom = 32768.0
        elif sampwidth == 4:
            dtype = np.int32
            denom = 2147483648.0
        elif sampwidth == 1:
            dtype = np.uint8
            denom = 128.0
        else:
            raise ValueError(f"Unsupported sample width: {sampwidth}")

        if dtype == np.uint8:
            data = (np.frombuffer(raw_bytes, dtype=dtype).astype(np.float32) - 128.0) / denom
        else:
            data = np.frombuffer(raw_bytes, dtype=dtype).astype(np.float32) / denom
        
        if n_channels > 1:
            data = data.reshape(-1, n_channels).mean(axis=1)
            
        if framerate != target_sr:
            duration = len(data) / framerate
            new_samples = int(duration * target_sr)
            if new_samples > 0:
                data = np.interp(
                    np.linspace(0, len(data), new_samples, endpoint=False),
                    np.arange(len(data)),
                    data
                ).astype(np.float32)
            
        return data


def transcribe_audio(audio_path: str | Path) -> dict:
    """Transcribe an audio file using OpenAI Whisper.

    Args:
        audio_path: Path to the input audio file (WAV, WEBM, MP3, OGG, etc.)

    Returns:
        dict: {
            "transcript": str,
            "language": str,
            "duration_s": float,
        }
    """
    audio_path_obj = Path(audio_path).resolve()
    model = get_whisper_model("base")

    audio_input = str(audio_path_obj)
    
    # Try reading directly as WAV if suffix is .wav
    if audio_path_obj.suffix.lower() == ".wav":
        try:
            audio_input = load_wav_file(audio_path_obj)
        except Exception:
            # Fall back to file path for ffmpeg decoding
            audio_input = str(audio_path_obj)

    try:
        result = model.transcribe(audio_input)
    except FileNotFoundError as fnf_err:
        if isinstance(audio_input, str):
            try:
                audio_np = load_wav_file(audio_input)
                result = model.transcribe(audio_np)
            except Exception:
                raise RuntimeError(
                    "Audio transcription requires ffmpeg to be installed on PATH for non-WAV formats. "
                    "Please submit audio as a standard 16kHz WAV file or install ffmpeg."
                ) from fnf_err
        else:
            raise fnf_err

    transcript = (result.get("text") or "").strip()
    language = result.get("language") or "en"
    
    duration_s = 0.0
    segments = result.get("segments") or []
    if segments:
        duration_s = round(float(segments[-1].get("end", 0.0)), 2)

    return {
        "transcript": transcript,
        "language": language,
        "duration_s": duration_s,
    }


def extract_symptoms(transcript: str) -> list[str]:
    """Extract symptom tokens matching the 131-symptom vocabulary from free text.

    Args:
        transcript: Transcribed or typed patient text.

    Returns:
        list[str]: Matched symptom names present in the XGBoost vocabulary.
    """
    if not transcript or not transcript.strip():
        return []

    vocabulary = get_symptom_vocabulary()
    return _matched_symptoms(transcript, vocabulary)
