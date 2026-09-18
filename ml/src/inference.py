"""
Inference pipeline - the piece that gets deployed.

Serves the exported ONNX model with onnxruntime, so the deployment container
needs neither torch nor a GPU. Handles images and video through one entry
point: video is sampled into frames, every frame goes through the identical
image path, and the per-frame results are aggregated into one verdict.

Usage:
    from inference import HazardClassifier
    clf = HazardClassifier("models/hazard_classifier.onnx", "models/classes.json")
    print(clf.predict("photo.jpg"))
    print(clf.predict("clip.mp4"))
"""

from __future__ import annotations

import json
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path

import numpy as np
import onnxruntime as ort

sys.path.insert(0, str(Path(__file__).resolve().parent))

from preprocessing import (  # noqa: E402
    SUPPORTED_IMAGE_EXTS,
    batch,
    preprocess_image,
    preprocess_pil,
)
from video_frames import SUPPORTED_VIDEO_EXTS, iter_frames, probe_video  # noqa: E402


@dataclass
class Prediction:
    """Result for a single image (or a single video frame)."""
    label: str
    confidence: float
    scores: dict[str, float]
    timestamp_s: float | None = None  # set only for video frames


@dataclass
class VideoPrediction:
    """Aggregated result for a video."""
    label: str
    confidence: float
    scores: dict[str, float]
    frames_analysed: int
    duration_s: float
    frames: list[Prediction] = field(default_factory=list)


def softmax(logits: np.ndarray) -> np.ndarray:
    """Numerically stable softmax over the last axis."""
    shifted = logits - np.max(logits, axis=-1, keepdims=True)
    exp = np.exp(shifted)
    return exp / np.sum(exp, axis=-1, keepdims=True)


class HazardClassifier:
    """CPU-only hazard classifier backed by onnxruntime."""

    def __init__(
        self,
        model_path: str | Path,
        classes_path: str | Path | None = None,
        intra_op_threads: int = 0,
    ):
        model_path = Path(model_path)
        if not model_path.exists():
            raise FileNotFoundError(f"Model not found: {model_path}")

        options = ort.SessionOptions()
        if intra_op_threads:
            # Pinning threads matters on Code Engine, where the container may be
            # limited to fewer cores than the host advertises.
            options.intra_op_num_threads = intra_op_threads

        self.session = ort.InferenceSession(
            str(model_path), sess_options=options, providers=["CPUExecutionProvider"]
        )
        self.input_name = self.session.get_inputs()[0].name

        if classes_path is None:
            classes_path = model_path.parent / "classes.json"
        self.classes: list[str] = json.loads(Path(classes_path).read_text())

    # ---------- core ----------

    def _run(self, arrays: list[np.ndarray]) -> np.ndarray:
        """Run a batch of preprocessed arrays and return per-row probabilities."""
        logits = self.session.run(None, {self.input_name: batch(arrays)})[0]
        return softmax(np.asarray(logits, dtype=np.float32))

    def _to_prediction(self, probs: np.ndarray, timestamp_s: float | None = None) -> Prediction:
        idx = int(np.argmax(probs))
        return Prediction(
            label=self.classes[idx],
            confidence=float(probs[idx]),
            scores={c: float(p) for c, p in zip(self.classes, probs)},
            timestamp_s=timestamp_s,
        )

    # ---------- public API ----------

    def predict_image(self, path_or_file) -> Prediction:
        """Classify a single image."""
        probs = self._run([preprocess_image(path_or_file)])[0]
        return self._to_prediction(probs)

    def predict_video(
        self,
        path: str | Path,
        every_n_seconds: float = 2.0,
        max_frames: int = 30,
        aggregation: str = "max_risk",
        batch_size: int = 8,
    ) -> VideoPrediction:
        """Classify a video by sampling frames and combining the results.

        Args:
            aggregation:
                "max_risk" - report the most severe class seen in any frame.
                    Correct default for hazard detection: a fire visible in one
                    frame is a fire, even if the other 29 frames look clear.
                "mean"     - average the probabilities across frames. Steadier,
                    but can average a real detection away into nothing.
        """
        path = str(path)
        meta = probe_video(path)

        frame_preds: list[Prediction] = []
        pending: list[np.ndarray] = []
        pending_ts: list[float] = []

        def flush():
            if not pending:
                return
            for probs, ts in zip(self._run(pending), pending_ts):
                frame_preds.append(self._to_prediction(probs, timestamp_s=ts))
            pending.clear()
            pending_ts.clear()

        for frame in iter_frames(path, every_n_seconds=every_n_seconds, max_frames=max_frames):
            pending.append(preprocess_pil(frame.image))
            pending_ts.append(frame.timestamp_s)
            if len(pending) >= batch_size:
                flush()
        flush()

        if not frame_preds:
            raise ValueError(f"No frames could be read from {path}")

        stacked = np.array([[p.scores[c] for c in self.classes] for p in frame_preds], dtype=np.float32)

        if aggregation == "mean":
            agg = stacked.mean(axis=0)
        elif aggregation == "max_risk":
            # Highest per-class probability across frames, renormalised so the
            # result still reads as a probability distribution.
            agg = stacked.max(axis=0)
            agg = agg / agg.sum()
        else:
            raise ValueError(f"Unknown aggregation: {aggregation}")

        idx = int(np.argmax(agg))
        return VideoPrediction(
            label=self.classes[idx],
            confidence=float(agg[idx]),
            scores={c: float(p) for c, p in zip(self.classes, agg)},
            frames_analysed=len(frame_preds),
            duration_s=float(meta["duration_s"]),
            frames=frame_preds,
        )

    def predict(self, path: str | Path, **kwargs):
        """Dispatch on file extension - images and video share one entry point."""
        suffix = Path(path).suffix.lower()
        if suffix in SUPPORTED_IMAGE_EXTS:
            return self.predict_image(path)
        if suffix in SUPPORTED_VIDEO_EXTS:
            return self.predict_video(path, **kwargs)
        raise ValueError(
            f"Unsupported file type '{suffix}'. "
            f"Images: {sorted(SUPPORTED_IMAGE_EXTS)} Video: {sorted(SUPPORTED_VIDEO_EXTS)}"
        )


def _cli() -> int:
    import argparse

    parser = argparse.ArgumentParser(description="Classify an image or video")
    parser.add_argument("path", help="image or video file")
    parser.add_argument("--model", default="models/hazard_classifier.onnx")
    parser.add_argument("--classes", default=None)
    parser.add_argument("--every-n-seconds", type=float, default=2.0)
    parser.add_argument("--max-frames", type=int, default=30)
    args = parser.parse_args()

    clf = HazardClassifier(args.model, args.classes)
    result = clf.predict(args.path, **(
        {"every_n_seconds": args.every_n_seconds, "max_frames": args.max_frames}
        if Path(args.path).suffix.lower() in SUPPORTED_VIDEO_EXTS else {}
    ))

    payload = asdict(result)
    if isinstance(result, VideoPrediction):
        payload["frames"] = [asdict(f) for f in result.frames]
    print(json.dumps(payload, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(_cli())
