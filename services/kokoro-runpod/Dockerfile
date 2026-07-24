# Kokoro-FastAPI Queue handler for RunPod Serverless
FROM ghcr.io/remsky/kokoro-fastapi-gpu:latest

# Install runpod into venv — uv is the base image's native package manager
RUN uv pip install runpod

COPY handler.py /handler.py

CMD ["python3", "-u", "/handler.py"]
