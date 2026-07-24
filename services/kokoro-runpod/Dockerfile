# Kokoro-FastAPI Queue handler for RunPod Serverless
FROM ghcr.io/remsky/kokoro-fastapi-gpu:latest

# Install runpod into venv
RUN uv pip install runpod

# Kokoro-FastAPI code is at /app — make it importable
ENV PYTHONPATH=/app

COPY handler.py /handler.py

CMD ["python3", "-u", "/handler.py"]
