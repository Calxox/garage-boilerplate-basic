"""
HazardWatch vision + chat API (notebook §9–11b).

From vision-service/:
  uvicorn app.main:app --reload --port 8000

Model lookup: MODEL_PATH, repository root, parent folder, then repository models/.
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

# Load configuration before chat/inference imports.
# Repository values take precedence; use parent/local defaults for missing values.
_REPO_ROOT = Path(__file__).resolve().parents[2]
_PROJECT_ROOT = _REPO_ROOT.parent
load_dotenv(_REPO_ROOT / ".env")
load_dotenv(_PROJECT_ROOT / ".env")
load_dotenv()

from app.chat import local_briefing
from app.location import MAX_MEDIA_BYTES, extract_location
from app.schemas import ChatRequest, ChatResponse, SeverityJson

app = FastAPI(title="HazardWatch Vision Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001",
    ).split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_MODEL = None
def _default_model_path() -> Path:
    configured = os.getenv("MODEL_PATH", "").strip()
    candidates = ([Path(configured).expanduser()] if configured else []) + [
        _REPO_ROOT / "best_bushfire_multitask.pt",
        _PROJECT_ROOT / "best_bushfire_multitask.pt",
        _REPO_ROOT / "models" / "best_bushfire_multitask.pt",
    ]
    for path in candidates:
        if path.is_file():
            return path
    return _PROJECT_ROOT / "best_bushfire_multitask.pt"


_MODEL_PATH = _default_model_path()


def get_model():
    global _MODEL
    if _MODEL is not None:
        return _MODEL
    if not _MODEL_PATH.is_file():
        raise HTTPException(
            status_code=503,
            detail=f"Model not found at {_MODEL_PATH}. Set MODEL_PATH.",
        )
    from app.inference import load_model

    _MODEL = load_model(_MODEL_PATH)
    return _MODEL


@app.get("/health")
def health():
    return {"ok": True, "model_path": str(_MODEL_PATH), "model_loaded": _MODEL is not None}


@app.post("/v1/assess/image", response_model=SeverityJson)
async def assess_image(
    file: UploadFile = File(...),
    modality: str = Form("drone"),
):
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty upload")
    try:
        model = get_model()
        from app.inference import predict_image_bytes

        result = predict_image_bytes(model, data, modality=modality)
        result.explainability_note = local_briefing(result)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/v1/media/location")
async def media_location(file: UploadFile = File(...)):
    """Extract optional capture GPS; this endpoint never loads the vision model."""
    try:
        data = await file.read(MAX_MEDIA_BYTES + 1)
        if len(data) > MAX_MEDIA_BYTES:
            raise HTTPException(status_code=413, detail="Media must be no larger than 25 MB.")
        return extract_location(data, file.filename or "")
    finally:
        await file.close()


@app.post("/v1/assess/video", response_model=SeverityJson)
async def assess_video(
    file: UploadFile = File(...),
    modality: str = Form("drone"),
):
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty upload")
    try:
        model = get_model()
        from app.inference import predict_video_bytes

        result = predict_video_bytes(model, data, modality=modality)
        result.explainability_note = local_briefing(result)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/v1/chat", response_model=ChatResponse)
def chat(body: ChatRequest):
    try:
        from app.chat import hazardwatch_reply

        reply, refs = hazardwatch_reply(
            body.message,
            body.severity_json,
            body.history,
            body.incidents,
            body.selected_id,
        )
        return ChatResponse(reply=reply, refs=refs)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
