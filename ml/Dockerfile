# Hazard classification service for IBM Code Engine.
#
# Built by Code Engine from source (`--build-source`), so the image is always
# produced on amd64 infrastructure. That sidesteps the arm64/amd64 mismatch
# that makes local Mac builds fail on Code Engine with an unhelpful
# "Revision failed" - see docs/DEPLOY_CODE_ENGINE.md.
#
# Build context is this directory (ml/), so all paths below are relative to it.

FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    MODEL_PATH=/app/models/hazard_classifier.onnx \
    CLASSES_PATH=/app/models/classes.json

WORKDIR /app

# libgl/libglib are required by opencv even in headless builds.
RUN apt-get update \
 && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
 && rm -rf /var/lib/apt/lists/*

COPY serve/requirements.txt /app/serve/requirements.txt
RUN pip install --no-cache-dir -r /app/serve/requirements.txt

COPY src/ /app/src/
COPY serve/ /app/serve/
COPY models/hazard_classifier.onnx models/classes.json /app/models/

RUN useradd --create-home --uid 1001 appuser && chown -R appuser /app
USER appuser

EXPOSE 8080
CMD ["python", "/app/serve/app.py"]
