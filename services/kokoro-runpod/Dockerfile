# Kokoro-FastAPI Queue handler for RunPod Serverless
FROM ghcr.io/remsky/kokoro-fastapi-gpu:latest

# Install runpod into the Python environment already provided by the base image
RUN python3 -m pip install --no-cache-dir runpod

COPY handler.py /handler.py

CMD ["python3", "-u", "/handler.py"]
