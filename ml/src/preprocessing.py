"""
Image preprocessing for the MobileNetV2 hazard classifier.

Single source of truth for how pixels are prepared. Training, evaluation and
inference all call into here, so a model can never be served with different
preprocessing from the one it was trained with.
"""

from __future__ import annotations

from typing import Iterable

import numpy as np
from PIL import Image

# MobileNetV2 was pretrained on ImageNet at 224x224 with these channel stats.
# Changing these means the pretrained weights no longer apply.
INPUT_SIZE = (224, 224)
IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)

SUPPORTED_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def load_image(path_or_file) -> Image.Image:
    """Open an image from a path or file-like object as RGB.

    RGB conversion is not optional: PNGs with alpha and greyscale JPEGs would
    otherwise produce 4- or 1-channel arrays and fail at the first conv layer.
    """
    img = Image.open(path_or_file)
    return img.convert("RGB")


def resize_image(img: Image.Image, size: tuple[int, int] = INPUT_SIZE) -> Image.Image:
    """Resize to the network's expected input size.

    Uses a straight resize rather than centre-crop. For hazard imagery the fire
    or smoke is often near a frame edge, and cropping can remove the only
    evidence in the picture.
    """
    return img.resize(size, Image.BILINEAR)


def to_model_array(img: Image.Image) -> np.ndarray:
    """Convert a PIL image to a normalised CHW float32 array."""
    arr = np.asarray(img, dtype=np.float32) / 255.0
    arr = (arr - IMAGENET_MEAN) / IMAGENET_STD
    return np.transpose(arr, (2, 0, 1)).astype(np.float32)


def preprocess_image(path_or_file, size: tuple[int, int] = INPUT_SIZE) -> np.ndarray:
    """Path/file -> (3, H, W) float32 array ready for the model."""
    return to_model_array(resize_image(load_image(path_or_file), size))


def preprocess_pil(img: Image.Image, size: tuple[int, int] = INPUT_SIZE) -> np.ndarray:
    """Same as preprocess_image but for an already-open PIL image.

    Used by the video path, where frames arrive as arrays rather than files.
    """
    return to_model_array(resize_image(img.convert("RGB"), size))


def batch(arrays: Iterable[np.ndarray]) -> np.ndarray:
    """Stack single-image arrays into an (N, 3, H, W) batch."""
    return np.stack(list(arrays), axis=0).astype(np.float32)
