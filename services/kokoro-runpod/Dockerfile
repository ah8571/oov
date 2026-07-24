# Kokoro-FastAPI Queue handler for RunPod Serverless
FROM ghcr.io/remsky/kokoro-fastapi-gpu:latest

# Install runpod to isolated dir (uv can't modify the venv at build time)
RUN uv pip install --target=/tmp/runpod-pkgs runpod

# /app = Kokoro-FastAPI code; /tmp/runpod-pkgs = runpod SDK
ENV PYTHONPATH=/app:/tmp/runpod-pkgs

COPY handler.py /handler.py

CMD ["python3", "-u", "/handler.py"]
