# Kokoro-FastAPI Queue handler for RunPod Serverless
# v0.4.0 — last stable before CUDA 12.6 requirement (38K downloads on RunPod)
FROM ghcr.io/remsky/kokoro-fastapi-gpu:v0.4.0

# Install runpod to isolated dir (uv can't modify the venv at build time)
RUN uv pip install --target=/tmp/runpod-pkgs runpod

# /app = Kokoro-FastAPI code; /tmp/runpod-pkgs = runpod SDK
# Models download to container local disk (~330MB) — no network volume needed
ENV PYTHONPATH=/app:/tmp/runpod-pkgs

COPY handler.py /handler.py

CMD ["python3", "-u", "/handler.py"]
