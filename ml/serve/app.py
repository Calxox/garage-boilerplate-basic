"""
Hazard classification HTTP service.

Wraps the inference pipeline in a small FastAPI app for IBM Code Engine.
Serving uses onnxruntime only - no torch, no GPU - so the container stays
small and starts fast.

Three things here are Code Engine requirements rather than preferences, and
getting any of them wrong produces a "Revision failed" with no useful logs:

  1. Bind to 0.0.0.0, never 127.0.0.1. A container listening on loopback is
     unreachable from outside and the health check never passes.
  2. Read the port from $PORT. Code Engine injects it (8080 by default) and
     probes that port specifically.
  3. Start fast. The model is loaded lazily on first request rather than at
     import, so the port opens immediately and the readiness probe succeeds
     even if model load were slow.
"""

from __future__ import annotations

import base64
import binascii
import io
import logging
import os
import sys
import time
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("hazard-api")

MODEL_PATH = os.environ.get("MODEL_PATH", "/app/models/hazard_classifier.onnx")
CLASSES_PATH = os.environ.get("CLASSES_PATH", "/app/models/classes.json")
MAX_UPLOAD_BYTES = int(os.environ.get("MAX_UPLOAD_BYTES", 10 * 1024 * 1024))

app = FastAPI(
    title="Bushfire Hazard Classification",
    description="Classifies an image as fire / no-fire. Team 7 MVP.",
    version="0.1.0",
)

_classifier = None
_load_error: str | None = None


def get_classifier():
    """Load the model on first use.

    Deliberately lazy: the HTTP port must be listening before the model is
    ready, or Code Engine's probe can time out during startup.
    """
    global _classifier, _load_error
    if _classifier is not None:
        return _classifier
    if _load_error is not None:
        raise HTTPException(status_code=503, detail=f"Model unavailable: {_load_error}")

    try:
        from inference import HazardClassifier

        t0 = time.time()
        _classifier = HazardClassifier(MODEL_PATH, CLASSES_PATH)
        log.info("loaded model %s in %.2fs", MODEL_PATH, time.time() - t0)
        return _classifier
    except Exception as exc:  # noqa: BLE001 - surfaced to the caller as 503
        _load_error = str(exc)
        log.exception("model load failed")
        raise HTTPException(status_code=503, detail=f"Model unavailable: {_load_error}")


class Base64Request(BaseModel):
    image: str  # base64-encoded image bytes, optionally a data: URL


@app.get("/health")
def health() -> dict[str, Any]:
    """Liveness probe. Must not touch the model - it answers before load."""
    return {"status": "ok"}


@app.get("/ready")
def ready() -> dict[str, Any]:
    """Readiness probe. Loads the model, so it reports real serving state."""
    clf = get_classifier()
    return {"status": "ready", "classes": clf.classes, "model": Path(MODEL_PATH).name}


def _predict_bytes(raw: bytes) -> dict[str, Any]:
    if not raw:
        raise HTTPException(status_code=400, detail="Empty image payload")
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Image too large ({len(raw)} bytes, limit {MAX_UPLOAD_BYTES})",
        )

    clf = get_classifier()
    t0 = time.time()
    try:
        result = clf.predict_image(io.BytesIO(raw))
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001 - bad image rather than server fault
        raise HTTPException(status_code=400, detail=f"Could not read image: {exc}")

    return {
        "label": result.label,
        "confidence": round(result.confidence, 4),
        "scores": {k: round(v, 4) for k, v in result.scores.items()},
        "inference_ms": round((time.time() - t0) * 1000, 1),
    }


@app.post("/predict")
async def predict(file: UploadFile = File(...)) -> dict[str, Any]:
    """Classify an uploaded image (multipart/form-data)."""
    return _predict_bytes(await file.read())


@app.post("/predict/base64")
def predict_base64(body: Base64Request) -> dict[str, Any]:
    """Classify a base64-encoded image.

    Convenient for callers that would rather send JSON than multipart - which
    includes the backend, where the image arrives from Object Storage.
    """
    payload = body.image
    if payload.startswith("data:"):
        _, _, payload = payload.partition(",")
    try:
        raw = base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(status_code=400, detail=f"Invalid base64: {exc}")
    return _predict_bytes(raw)


if __name__ == "__main__":
    import uvicorn

    # 0.0.0.0 and $PORT are both required by Code Engine - see module docstring.
    port = int(os.environ.get("PORT", 8080))
    log.info("starting on 0.0.0.0:%d", port)
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
