# Kokoro-FastAPI Queue handler for RunPod Serverless
FROM ghcr.io/remsky/kokoro-fastapi-gpu:latest

# Install runpod system-wide. The base image apt sources may be stale.
RUN (apt-get update || true) \
 && apt-get install -y --no-install-recommends --fix-missing python3-pip \
 && pip3 install --break-system-packages runpod \
 && rm -rf /var/lib/apt/lists/*

ENV PYTHONPATH=/usr/lib/python3/dist-packages

COPY handler.py /handler.py

CMD ["python3", "-u", "/handler.py"]
