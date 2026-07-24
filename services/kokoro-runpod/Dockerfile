# Kokoro-FastAPI Queue handler for RunPod Serverless
FROM ghcr.io/remsky/kokoro-fastapi-gpu:latest

# Install RunPod SDK — base image has externally-managed Python
RUN python3 -m pip install --break-system-packages --no-cache-dir runpod requests

COPY handler.py /handler.py

CMD ["python3", "-u", "/handler.py"]
