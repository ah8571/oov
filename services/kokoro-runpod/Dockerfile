# Kokoro-FastAPI Queue handler for RunPod Serverless
FROM ghcr.io/remsky/kokoro-fastapi-gpu:latest

# Install RunPod SDK for queue handler
RUN pip install --no-cache-dir runpod requests

COPY handler.py /handler.py

CMD ["python", "-u", "/handler.py"]
