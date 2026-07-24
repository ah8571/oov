# Kokoro-FastAPI Queue handler for RunPod Serverless
FROM ghcr.io/remsky/kokoro-fastapi-gpu:latest

# Install pip then runpod system-wide
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3-pip \
 && pip3 install --break-system-packages --no-cache-dir runpod \
 && rm -rf /var/lib/apt/lists/*

COPY handler.py /handler.py

# Use venv python (for api.src.main) but let it see system packages (for runpod)
ENV PYTHONPATH=/usr/lib/python3/dist-packages
CMD ["python3", "-u", "/handler.py"]
