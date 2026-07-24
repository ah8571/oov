# Kokoro-FastAPI Queue handler for RunPod Serverless
FROM ghcr.io/remsky/kokoro-fastapi-gpu:latest

# Install runpod system-wide — the ONLY approach that works with this base image
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3-pip \
 && pip3 install --break-system-packages runpod \
 && rm -rf /var/lib/apt/lists/*

# Let the venv Python see system packages where runpod is installed
ENV PYTHONPATH=/usr/lib/python3/dist-packages

COPY handler.py /handler.py

CMD ["python3", "-u", "/handler.py"]
