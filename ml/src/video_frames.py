"""
Video frame extraction.

MobileNetV2 classifies single images, so video is handled by sampling frames
and reusing the image pipeline unchanged. A 60s clip at 30fps is 1800 frames;
hazard severity does not change frame to frame, so sampling every few seconds
gives the same answer for ~1% of the compute.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterator

import cv2
import numpy as np
from PIL import Image

SUPPORTED_VIDEO_EXTS = {".mp4", ".mov", ".avi", ".mkv", ".webm"}


@dataclass
class VideoFrame:
    index: int          # frame number in the source video
    timestamp_s: float  # position in seconds
    image: Image.Image  # RGB frame


def probe_video(path: str) -> dict:
    """Return basic video metadata without decoding the whole file."""
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        raise ValueError(f"Could not open video: {path}")
    try:
        fps = cap.get(cv2.CAP_PROP_FPS) or 0.0
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        return {
            "fps": fps,
            "frame_count": frame_count,
            "duration_s": (frame_count / fps) if fps > 0 else 0.0,
            "width": int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0),
            "height": int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0),
        }
    finally:
        cap.release()


def extract_frames(
    path: str,
    every_n_seconds: float = 2.0,
    max_frames: int = 30,
) -> list[VideoFrame]:
    """Sample frames at a fixed time interval.

    Args:
        path: video file path.
        every_n_seconds: sampling interval. 2s is a sensible default for fire
            footage - fast enough to catch a flare-up, sparse enough to stay cheap.
        max_frames: hard ceiling so a long video cannot blow up inference time.

    Returns:
        Sampled frames, oldest first. Always at least one frame for a readable video.
    """
    return list(iter_frames(path, every_n_seconds=every_n_seconds, max_frames=max_frames))


def iter_frames(
    path: str,
    every_n_seconds: float = 2.0,
    max_frames: int = 30,
) -> Iterator[VideoFrame]:
    """Streaming version of extract_frames - avoids holding every frame in memory."""
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        raise ValueError(f"Could not open video: {path}")

    try:
        fps = cap.get(cv2.CAP_PROP_FPS)
        # Some containers report 0 or nonsense fps; fall back to a sane default
        # rather than dividing by zero.
        if not fps or fps <= 0 or np.isnan(fps):
            fps = 25.0

        step = max(1, int(round(fps * every_n_seconds)))
        frame_index = 0
        yielded = 0

        while yielded < max_frames:
            ok, frame_bgr = cap.read()
            if not ok:
                break

            if frame_index % step == 0:
                # OpenCV decodes BGR; the model expects RGB.
                rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
                yield VideoFrame(
                    index=frame_index,
                    timestamp_s=frame_index / fps,
                    image=Image.fromarray(rgb),
                )
                yielded += 1

            frame_index += 1
    finally:
        cap.release()
