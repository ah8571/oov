# Kokoro-FastAPI for RunPod Serverless — CUDA 12.4 (matching RunPod GPU drivers)
# Built from scratch instead of relying on moving prebuilt tags
FROM nvidia/cuda:12.4.0-runtime-ubuntu22.04

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 python3.11-venv python3.11-dev python3-pip git curl \
    espeak-ng libespeak-ng-dev \
    && rm -rf /var/lib/apt/lists/*

# Use Python 3.11 explicitly
RUN update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1 \
    && python3 -m pip install --upgrade pip

# Install PyTorch with CUDA 12.4 support
RUN pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu124

# Install Kokoro and audio deps
RUN pip install kokoro>=0.8.4 misaki[en] uvicorn fastapi soundfile numpy

# Install RunPod SDK
RUN pip install runpod

# Download the Kokoro model at build time (no HuggingFace download on cold start)
RUN python3 -c "from kokoro import KPipeline; KPipeline(lang_code='a'); print('Model cached OK')"

# GPU health check — verify CUDA is reachable
RUN python3 -c "import torch; assert torch.cuda.is_available(), 'CUDA not available'; print(f'CUDA OK: {torch.cuda.get_device_name(0)}')"

COPY handler.py /handler.py

CMD ["python3", "-u", "/handler.py"]
