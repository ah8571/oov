# Kokoro-FastAPI Queue handler for RunPod Serverless
FROM ghcr.io/remsky/kokoro-fastapi-gpu:latest

# Install RunPod SDK into the existing venv at /app/.venv
RUN uv pip install runpod

COPY handler.py /handler.py

CMD ["python3", "-u", "/handler.py"]
