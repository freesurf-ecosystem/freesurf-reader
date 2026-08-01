# Kokoro TTS for RunPod Serverless — CUDA 12.4
FROM nvidia/cuda:12.4.0-runtime-ubuntu22.04

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 python3.11-venv python3.11-dev python3-pip git curl \
    espeak-ng libespeak-ng-dev \
    && rm -rf /var/lib/apt/lists/*

RUN update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1 \
    && python3 -m pip install --upgrade pip

RUN pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu124

RUN pip install kokoro>=0.8.4 misaki[en] soundfile numpy

RUN pip install runpod

# Pre-download the Kokoro model at build time — no HuggingFace fetch on cold start
RUN python3 -c "from kokoro import KPipeline; KPipeline(lang_code='a'); print('Model cached OK')"

COPY handler.py /handler.py

CMD ["python3", "-u", "/handler.py"]
