from typing import Literal, Optional

from pydantic import BaseModel, Field

SeverityName = Literal["none", "low", "moderate", "high", "extreme"]
ModalityName = Literal["satellite", "drone", "ground"]
InputType = Literal["image", "video"]


class LocationMeta(BaseModel):
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    place_name: Optional[str] = None
    source: Optional[str] = None


class SeverityJson(BaseModel):
    """Matches testbed_pipeline §9 output + §11b vision_json extensions."""

    input_type: InputType = "image"
    severity: SeverityName
    severity_confidence: float = Field(ge=0, le=1)
    severity_index: int
    key_features: list[str] = Field(default_factory=list)
    key_feature_scores: dict[str, float] = Field(default_factory=dict)
    severity_scores: dict[str, float] = Field(default_factory=dict)
    modality: Optional[ModalityName] = None
    location: Optional[LocationMeta] = None
    explainability_note: Optional[str] = None
    media_key: Optional[str] = None
    duration_sec: Optional[float] = None
    frames_sampled: Optional[int] = None
    severity_frame_counts: Optional[dict[str, int]] = None


class IncidentCard(BaseModel):
    """One location/report in the review queue for ranking & comparison."""

    id: str
    name: str
    area: str = ""
    severity: SeverityName
    confidence: float = Field(ge=0, le=1)
    key_features: list[str] = Field(default_factory=list)
    supporting_images: int = 1
    source: str = ""
    reviewed: bool = False
    explainability: Optional[str] = None


class ChatRequest(BaseModel):
    message: str
    severity_json: SeverityJson
    history: list[dict[str, str]] = Field(default_factory=list)
    incidents: list[IncidentCard] = Field(default_factory=list)
    selected_id: Optional[str] = None


class ChatResponse(BaseModel):
    reply: str
    refs: list[str] = Field(default_factory=list)
