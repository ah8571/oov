# Kokoro-FastAPI Queue handler for RunPod Serverless
FROM ghcr.io/remsky/kokoro-fastapi-gpu:latest

# Install runpod SDK into a local directory to avoid venv permission issues
RUN pip3 install --target=/opt/runpod-packages --break-system-packages --no-cache-dir runpod 2>/dev/null \
 || python3 -m pip install --target=/opt/runpod-packages --break-system-packages --no-cache-dir runpod 2>/dev/null \
 || (apt-get update && apt-get install -y --no-install-recommends python3-pip \
     && pip3 install --target=/opt/runpod-packages --break-system-packages --no-cache-dir runpod \
     && rm -rf /var/lib/apt/lists/*)

ENV PYTHONPATH=/opt/runpod-packages:$PYTHONPATH

COPY handler.py /handler.py

CMD ["python3", "-u", "/handler.py"]
