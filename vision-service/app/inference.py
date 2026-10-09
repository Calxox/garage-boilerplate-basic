"""Image / video inference — port of testbed_pipeline §9–10 / §11b."""

from __future__ import annotations

import io
import os
import shutil
import tempfile
from collections import Counter
from pathlib import Path
from typing import Any

import torch
from PIL import Image, ImageFile
from torchvision import transforms

from app.model import BushfireMultiTaskNet
from app.schemas import SeverityJson

ImageFile.LOAD_TRUNCATED_IMAGES = True
Image.MAX_IMAGE_PIXELS = None

IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)

# Below this top-class probability a non-"none" verdict is treated as unreliable
# (e.g. everyday photos that the model has never seen score ~0.35 across 3 classes).
MIN_SEVERITY_CONFIDENCE = float(os.getenv("MIN_SEVERITY_CONFIDENCE", "0.5"))

DEFAULT_SEVERITY = ("none", "low", "moderate", "high", "extreme")
DEFAULT_FEATURES = (
    "actual_flames",
    "smoke",
    "heavy_smoke",
    "burn_scars",
    "burnt_vegetation",
    "thermal_hotspots",
)
DEFAULT_MODALITIES = ("satellite", "drone", "ground")


def _cfg_from_ckpt(ckpt: dict[str, Any]) -> dict[str, Any]:
    cfg = dict(ckpt.get("cfg") or {})
    return {
        "severity_names": tuple(cfg.get("severity_names") or DEFAULT_SEVERITY),
        "feature_names": tuple(cfg.get("feature_names") or DEFAULT_FEATURES),
        "modality_names": tuple(cfg.get("modality_names") or DEFAULT_MODALITIES),
        "img_size": int(cfg.get("img_size") or 224),
        "feature_thresh": float(cfg.get("feature_thresh") or 0.4),
    }


def _build_transforms(img_size: int) -> transforms.Compose:
    return transforms.Compose(
        [
            transforms.Resize((img_size, img_size)),
            transforms.ToTensor(),
            transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
        ]
    )


def load_model(checkpoint_path: Path) -> dict[str, Any]:
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    ckpt = torch.load(checkpoint_path, map_location=device, weights_only=False)
    if not isinstance(ckpt, dict) or "model_state" not in ckpt:
        raise ValueError("Unexpected checkpoint format")

    cfg = _cfg_from_ckpt(ckpt)
    model = BushfireMultiTaskNet(
        n_severity=len(cfg["severity_names"]),
        n_features=len(cfg["feature_names"]),
        n_modalities=len(cfg["modality_names"]),
        pretrained=False,
    )
    model.load_state_dict(ckpt["model_state"])
    model.to(device)
    model.eval()

    return {
        "model": model,
        "device": device,
        "cfg": cfg,
        "tfm": _build_transforms(cfg["img_size"]),
        "path": checkpoint_path,
    }


def _modality_idx(cfg: dict[str, Any], modality: str) -> int:
    names = cfg["modality_names"]
    return names.index(modality) if modality in names else names.index("drone") if "drone" in names else 1


@torch.no_grad()
def _predict_pil(bundle: dict[str, Any], img: Image.Image, modality: str) -> dict[str, Any]:
    cfg = bundle["cfg"]
    device = bundle["device"]
    model = bundle["model"]
    tensor = bundle["tfm"](img.convert("RGB")).unsqueeze(0).to(device)
    mod = torch.tensor([_modality_idx(cfg, modality)], device=device)

    sev_logits, feat_logits = model(tensor, mod)
    sev_prob = torch.softmax(sev_logits, dim=1)[0].cpu().numpy()
    feat_prob = torch.sigmoid(feat_logits)[0].cpu().numpy()

    sev_idx = int(sev_prob.argmax())
    severity_names = cfg["severity_names"]
    feature_names = cfg["feature_names"]
    thresh = cfg["feature_thresh"]

    active = [feature_names[i] for i, p in enumerate(feat_prob) if p >= thresh]
    return {
        "severity": severity_names[sev_idx],
        "severity_index": sev_idx,
        "severity_confidence": float(sev_prob[sev_idx]),
        "severity_scores": {severity_names[i]: float(sev_prob[i]) for i in range(len(severity_names))},
        "key_features": active,
        "key_feature_scores": {feature_names[i]: float(feat_prob[i]) for i in range(len(feature_names))},
        "modality": modality if modality in cfg["modality_names"] else "drone",
    }


def apply_confidence_gate(result: SeverityJson) -> SeverityJson:
    """Flag shaky verdicts for human review and drop the (unreliable) feature claims."""
    if result.severity != "none" and result.severity_confidence < MIN_SEVERITY_CONFIDENCE:
        result.needs_review = True
        result.review_reason = (
            f"Low confidence ({result.severity_confidence:.0%} for '{result.severity}'). "
            "This may not be a bushfire scene - human review required."
        )
        result.key_features = []
    return result


def predict_image_bytes(bundle: dict[str, Any], data: bytes, modality: str = "drone") -> SeverityJson:
    img = Image.open(io.BytesIO(data)).convert("RGB")
    result = _predict_pil(bundle, img, modality)
    return apply_confidence_gate(SeverityJson(input_type="image", **result))


def aggregate_video_predictions(
    frame_preds: list[dict[str, Any]],
    severity_rule: str = "mode",
    feature_min_frac: float = 0.30,
) -> dict[str, Any]:
    if not frame_preds:
        raise ValueError("frame_preds is empty")

    cfg_sev = DEFAULT_SEVERITY
    sev_to_idx = {n: i for i, n in enumerate(cfg_sev)}
    feat_to_idx = {n: i for i, n in enumerate(DEFAULT_FEATURES)}

    sev_counts = Counter(fp["severity"] for fp in frame_preds)
    ranked = sev_counts.most_common()

    if severity_rule == "mode":
        overall = ranked[0][0]
    elif severity_rule == "peak":
        present = set(sev_counts)
        overall = max(present, key=lambda s: sev_to_idx.get(s, -1))
    else:
        raise ValueError("severity_rule must be 'mode' or 'peak'")

    matching_idx = [i for i, fp in enumerate(frame_preds) if fp["severity"] == overall]
    matching = [frame_preds[i] for i in matching_idx]

    feat_counts: Counter[str] = Counter()
    for fp in matching:
        feat_counts.update(fp.get("key_features", []))
    n_match = max(len(matching), 1)
    frequent_features = [
        f for f, c in feat_counts.items() if (c / n_match) >= feature_min_frac
    ]
    frequent_features = sorted(frequent_features, key=lambda f: feat_to_idx.get(f, 99))

    median_pos = matching_idx[len(matching_idx) // 2]
    confs = [float(fp.get("severity_confidence", 0.0)) for fp in matching]
    overall_confidence = float(sum(confs) / max(len(confs), 1))

    # Mean feature confidence across ALL sampled frames (same averaging idea as severity confidence)
    n_all = max(len(frame_preds), 1)
    score_sums: dict[str, float] = {f: 0.0 for f in DEFAULT_FEATURES}
    for fp in frame_preds:
        for k, v in (fp.get("key_feature_scores") or {}).items():
            if k in score_sums:
                score_sums[k] += float(v)
    key_feature_scores = {k: score_sums[k] / n_all for k in DEFAULT_FEATURES}

    return {
        "overall_severity": overall,
        "overall_severity_confidence": overall_confidence,
        "severity_rule": severity_rule,
        "severity_frame_counts": dict(sev_counts),
        "n_frames": len(frame_preds),
        "key_features": frequent_features,
        "key_feature_scores": key_feature_scores,
        "exemplar_frame_index": median_pos,
    }


def _sample_frame_indices(n_total: int, fps: float, sample_every_sec: float, max_frames: int):
    import numpy as np

    if n_total <= 0:
        return np.array([], dtype=int)
    sample_every_sec = max(float(sample_every_sec), 0.1)
    max_frames = max(int(max_frames), 4)
    duration = n_total / max(fps, 1e-3)
    ideal_n = int(np.floor(duration / sample_every_sec)) + 1
    ideal_n = max(ideal_n, 1)
    n_take = max_frames if ideal_n > max_frames else min(ideal_n, n_total)
    return np.unique(np.linspace(0, n_total - 1, num=n_take, dtype=int))


def predict_video_bytes(
    bundle: dict[str, Any],
    data: bytes,
    modality: str = "drone",
    sample_every_sec: float = 2.5,
    max_frames: int = 240,
) -> SeverityJson:
    import cv2

    suffix = ".mp4"
    tmp = Path(tempfile.mkdtemp(prefix="hazardwatch_vid_"))
    video_path = tmp / f"upload{suffix}"
    try:
        video_path.write_bytes(data)
        cap = cv2.VideoCapture(str(video_path))
        if not cap.isOpened():
            raise RuntimeError("Could not open uploaded video")

        n_total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
        fps = float(cap.get(cv2.CAP_PROP_FPS) or 0.0) or 25.0
        duration = (n_total / fps) if n_total > 0 else 0.0

        if n_total <= 0:
            frames_bgr = []
            while True:
                ok, frame = cap.read()
                if not ok:
                    break
                frames_bgr.append(frame)
            n_total = len(frames_bgr)
            if n_total == 0:
                raise RuntimeError("Video contained no readable frames")
            duration = n_total / fps
            idxs = _sample_frame_indices(n_total, fps, sample_every_sec, max_frames)
            chosen = [frames_bgr[int(i)] for i in idxs]
        else:
            idxs = _sample_frame_indices(n_total, fps, sample_every_sec, max_frames)
            chosen = []
            for i in idxs:
                cap.set(cv2.CAP_PROP_POS_FRAMES, int(i))
                ok, frame = cap.read()
                if ok and frame is not None:
                    chosen.append(frame)
            if not chosen:
                raise RuntimeError("Failed to decode any sampled frames")
        cap.release()

        preds = []
        for frame in chosen:
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            img = Image.fromarray(rgb)
            preds.append(_predict_pil(bundle, img, modality))

        summary = aggregate_video_predictions(preds, severity_rule="mode")
        sev_names = bundle["cfg"]["severity_names"]
        overall = summary["overall_severity"]
        return apply_confidence_gate(SeverityJson(
            input_type="video",
            severity=overall,
            severity_confidence=float(summary["overall_severity_confidence"]),
            severity_index=int(sev_names.index(overall)) if overall in sev_names else -1,
            key_features=list(summary.get("key_features") or []),
            key_feature_scores={
                k: float(v) for k, v in (summary.get("key_feature_scores") or {}).items()
            },
            modality=modality if modality in bundle["cfg"]["modality_names"] else "drone",
            duration_sec=round(duration, 2),
            frames_sampled=len(chosen),
            severity_frame_counts=summary.get("severity_frame_counts"),
            explainability_note=None,
        ))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
