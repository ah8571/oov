"""
RunPod Serverless handler for Kokoro TTS.
Uses Kokoro directly as a Python library — no HTTP wrapper needed.
"""
print("BOOT: handler.py starting", flush=True)

import base64
import io
import runpod
import traceback
import sys
import time

# Validate imports
try:
    import torch
    import soundfile as sf
    from kokoro import KPipeline

    print(f"CUDA available: {torch.cuda.is_available()}", flush=True)
    if torch.cuda.is_available():
        print(f"GPU: {torch.cuda.get_device_name(0)}", flush=True)
    print("All imports OK", flush=True)
except Exception:
    traceback.print_exc()
    sys.stderr.flush()
    raise

# Pipeline cache: one per language code to avoid reloading
_pipelines = {}

SAMPLE_RATE = 24000


def get_pipeline(lang_code="a"):
    """Get or create a cached KPipeline for the given language."""
    if lang_code not in _pipelines:
        _pipelines[lang_code] = KPipeline(lang_code=lang_code)
    return _pipelines[lang_code]


def handler(event):
    """
    Process a TTS job.

    Expected input:
    {
        "input": {
            "text": "Hello world",
            "voice": "af_heart",       # optional, default af_heart
            "speed": 1.0,              # optional
            "response_format": "mp3"   # optional
        }
    }
    """
    job_input = event.get("input", {})

    text = job_input.get("text", "")
    if not text:
        return {"error": "No text provided"}

    voice = job_input.get("voice", "af_heart")
    speed = job_input.get("speed", 1.0)
    response_format = job_input.get("response_format", "mp3")

    # Determine language from voice prefix
    # af = American female, bf = British female, ef = Spanish female, etc.
    lang_code = voice[0]  # 'a' for American English, 'b' for British, 'e' for Spanish

    try:
        pipeline = get_pipeline(lang_code)

        # Generate audio samples
        generator = pipeline(text, voice=voice, speed=speed)
        all_samples = []
        for _, _, audio in generator:
            all_samples.append(audio)

        if not all_samples:
            return {"error": "No audio generated"}

        # Concatenate all chunks
        import numpy as np
        audio_array = np.concatenate(all_samples)

        # Write to buffer in requested format
        buf = io.BytesIO()

        if response_format == "wav":
            sf.write(buf, audio_array, SAMPLE_RATE, format="WAV")
        else:
            # Default to MP3 — soundfile doesn't do MP3, use WAV as fallback
            # (Kokoro outputs raw samples; browser/mobile handles WAV fine)
            sf.write(buf, audio_array, SAMPLE_RATE, format="WAV")

        buf.seek(0)
        return {"audio_base64": base64.b64encode(buf.read()).decode("utf-8")}

    except Exception as e:
        return {"error": f"TTS error: {str(e)}"}


if __name__ == "__main__":
    try:
        # Pre-warm the pipeline on cold start
        print("Pre-warming Kokoro pipeline...", flush=True)
        _ = get_pipeline("a")
        print("Pipeline ready!", flush=True)
        runpod.serverless.start({"handler": handler})
    except Exception:
        traceback.print_exc()
        sys.stderr.flush()
        raise
