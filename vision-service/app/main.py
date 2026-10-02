"""
HazardWatch vision + chat API (notebook §9–11b).

From vision-service/:
  uvicorn app.main:app --reload --port 8000

MODEL_PATH defaults to ../best_bushfire_multitask.pt
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

# Load secrets before chat/inference imports that read env
_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(_ROOT / ".env")
load_dotenv()

from app.chat import local_briefing
from app.schemas import ChatRequest, ChatResponse, SeverityJson

app = FastAPI(title="HazardWatch Vision Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_MODEL = None
_MODEL_PATH = Path(
    os.getenv("MODEL_PATH", Path(__file__).resolve().parents[2] / "best_bushfire_multitask.pt")
)


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
        from app.inference import predict_image_bytes

        result = predict_image_bytes(get_model(), data, modality=modality)
        result.explainability_note = local_briefing(result)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/v1/assess/video", response_model=SeverityJson)
async def assess_video(
    file: UploadFile = File(...),
    modality: str = Form("drone"),
):
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty upload")
    try:
        from app.inference import predict_video_bytes

        result = predict_video_bytes(get_model(), data, modality=modality)
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
