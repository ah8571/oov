"""
RunPod Serverless Queue handler for Kokoro-FastAPI.
Receives text → generates speech → returns base64 audio.
"""
import subprocess
import sys

# Install runpod SDK at startup (base image's venv has permission issues at build time)
subprocess.run(["uv", "pip", "install", "runpod"], check=True)

import base64
import io
import runpod
import uvicorn
import requests
import threading
import time
from api.src.main import app


def start_server():
    """Start FastAPI in a background thread so the handler can call it."""
    uvicorn.run(app, host="127.0.0.1", port=8880, log_level="warning")


# Start the server on module load (cold start)
_thread = threading.Thread(target=start_server, daemon=True)
_thread.start()

# Wait for server to be ready
for _ in range(30):
    try:
        requests.get("http://127.0.0.1:8880/health", timeout=1)
        break
    except Exception:
        time.sleep(1)


def handler(event):
    """
    Process a TTS job.

    Expected input:
    {
        "input": {
            "text": "Hello world",
            "voice": "af_heart",       # optional, default af_heart
            "speed": 1.0               # optional
        }
    }
    """
    job_input = event.get("input", {})

    text = job_input.get("text", "")
    if not text:
        return {"error": "No text provided"}

    voice = job_input.get("voice", "af_heart")
    speed = job_input.get("speed", 1.0)

    response = requests.post(
        "http://127.0.0.1:8880/v1/audio/speech",
        json={"model": "kokoro", "voice": voice, "input": text, "speed": speed},
        timeout=120,
    )

    if response.status_code != 200:
        return {"error": f"TTS failed: {response.status_code}"}

    return {"audio_base64": base64.b64encode(response.content).decode("utf-8")}


if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})
