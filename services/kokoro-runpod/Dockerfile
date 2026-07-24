# Kokoro-FastAPI Queue handler for RunPod Serverless
FROM ghcr.io/remsky/kokoro-fastapi-gpu:latest

# Base image already has uv (no need for apt-get/python3-pip).
# Install runpod to an isolated directory to avoid venv write conflicts.
RUN uv pip install --target=/tmp/runpod-pkgs runpod

ENV PYTHONPATH=/tmp/runpod-pkgs

COPY handler.py /handler.py

CMD ["python3", "-u", "/handler.py"]
