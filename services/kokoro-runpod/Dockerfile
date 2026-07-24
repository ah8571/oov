# Kokoro-FastAPI Queue handler for RunPod Serverless
FROM ghcr.io/remsky/kokoro-fastapi-gpu:latest

# Install runpod to isolated dir (venv is read-only during build)
RUN python3 -m pip install --target=/tmp/runpod-pkgs --no-cache-dir runpod 2>/dev/null \
 || (python3 -m ensurepip && python3 -m pip install --target=/tmp/runpod-pkgs --no-cache-dir runpod)

ENV PYTHONPATH=/tmp/runpod-pkgs

COPY handler.py /handler.py

CMD ["python3", "-u", "/handler.py"]
