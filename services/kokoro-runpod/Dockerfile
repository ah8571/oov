# Kokoro-FastAPI Queue handler for RunPod Serverless
FROM ghcr.io/remsky/kokoro-fastapi-gpu:latest

# Install runpod into an isolated environment so the base app venv stays untouched
RUN uv venv /tmp/runpod-env \
 && uv pip install --python /tmp/runpod-env/bin/python runpod \
 && ln -s /tmp/runpod-env/lib/python*/site-packages /tmp/runpod-site-packages

COPY handler.py /handler.py

CMD ["python3", "-u", "/handler.py"]
