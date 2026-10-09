# HazardWatch vision service — IBM Code Engine.
#
# Build for linux/amd64. Code Engine runs amd64; an image built on an Apple
# Silicon Mac defaults to arm64, is accepted, never starts, and surfaces only
# as "Revision failed" with empty logs. The platform is pinned below, but
# prefer Code Engine build-from-source, which runs on amd64 anyway.
#
# The big one: torch from PyPI pulls the CUDA build, which is 2-3GB and will
# not fit or start in a sensible Code Engine size. The CPU-only wheel index
# below drops that to roughly 200MB. There is no GPU on Code Engine, so the
# CUDA build would be dead weight even if it fitted.

FROM --platform=linux/amd64 python:3.11-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# libgl/libglib are required by opencv for video decoding, even headless.
RUN apt-get update \
 && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
 && rm -rf /var/lib/apt/lists/*

# Torch first, from the CPU index, so the CUDA build is never resolved.
# Pinned apart from requirements.txt because the index URL differs.
RUN pip install --no-cache-dir \
      --index-url https://download.pytorch.org/whl/cpu \
      torch==2.5.1 torchvision==0.20.1

# Everything else from PyPI. torch/torchvision are already satisfied above,
# so these lines are no-ops for them rather than a re-download.
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

# The trained checkpoint is deliberately NOT baked in: it is gitignored, so a
# build-from-source build would not have it anyway. It is fetched from Cloud
# Object Storage on first request — see app/storage.py.
ENV MODEL_PATH=/tmp/best_bushfire_multitask.pt

RUN useradd --create-home --uid 1001 appuser && chown -R appuser /app
USER appuser

# Documentation only — Code Engine injects $PORT and the command reads it.
EXPOSE 8080

# 0.0.0.0 and $PORT are both Code Engine requirements. One worker: the model
# is held in memory per worker, so more workers multiply the footprint for no
# throughput gain on a CPU-bound model.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080} --workers 1"]
