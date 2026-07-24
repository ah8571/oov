# Kokoro-FastAPI Queue handler for RunPod Serverless
FROM ghcr.io/remsky/kokoro-fastapi-gpu:latest

# Install runpod to isolated dir — uv is the only working package manager
RUN uv pip install --target=/tmp/runpod-pkgs runpod

ENV PYTHONPATH=/tmp/runpod-pkgs

COPY handler.py /handler.py

CMD ["python3", "-u", "/handler.py"]
