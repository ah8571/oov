# Kokoro-FastAPI Queue handler for RunPod Serverless
# Pinned to v0.0.5post2 — latest requires CUDA 12.6, RunPod GPUs have 12.4
FROM ghcr.io/remsky/kokoro-fastapi-gpu:v0.0.5post2

# Install runpod to isolated dir (uv can't modify the venv at build time)
RUN uv pip install --target=/tmp/runpod-pkgs runpod

# /app = Kokoro-FastAPI code; /tmp/runpod-pkgs = runpod SDK
# Models download to container local disk (~330MB) — no network volume needed
ENV PYTHONPATH=/app:/tmp/runpod-pkgs

COPY handler.py /handler.py

CMD ["python3", "-u", "/handler.py"]
