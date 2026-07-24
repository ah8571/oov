# Kokoro-FastAPI Queue handler for RunPod Serverless
FROM ghcr.io/remsky/kokoro-fastapi-gpu:latest

# Install runpod into the uv-managed virtual environment provided by the base image
RUN uv pip install --python /app/.venv/bin/python3 runpod

COPY handler.py /handler.py

CMD ["python3", "-u", "/handler.py"]
