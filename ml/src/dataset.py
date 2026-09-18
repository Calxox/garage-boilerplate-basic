"""
Dataset loading and splitting.

Expects one folder per class:

    data/
      fire/    img001.jpg ...
      nofire/  img101.jpg ...

Class names are read from the folder names, so swapping in the severity-graded
data later (unburnt/low/moderate/high/extreme) needs no code change - only a
different data directory.
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from torch.utils.data import Dataset

from preprocessing import (
    INPUT_SIZE,
    SUPPORTED_IMAGE_EXTS,
    load_image,
    preprocess_pil,
    resize_image,
    to_model_array,
)


@dataclass
class Sample:
    path: Path
    label: int


def discover_classes(data_dir: str | Path) -> list[str]:
    """Class names from sorted subdirectory names, so label order is stable."""
    data_dir = Path(data_dir)
    classes = sorted(d.name for d in data_dir.iterdir() if d.is_dir())
    if not classes:
        raise ValueError(f"No class subdirectories found in {data_dir}")
    return classes


def discover_samples(data_dir: str | Path, classes: list[str]) -> list[Sample]:
    """Collect every readable image under each class folder."""
    data_dir = Path(data_dir)
    samples: list[Sample] = []
    for label, cls in enumerate(classes):
        for path in sorted((data_dir / cls).iterdir()):
            if path.suffix.lower() in SUPPORTED_IMAGE_EXTS:
                samples.append(Sample(path=path, label=label))
    if not samples:
        raise ValueError(f"No images found under {data_dir}")
    return samples


def stratified_split(
    samples: list[Sample],
    val_frac: float = 0.15,
    test_frac: float = 0.15,
    seed: int = 42,
) -> tuple[list[Sample], list[Sample], list[Sample]]:
    """Split per class so every split keeps the original class balance.

    Stratifying matters here: the dataset is intentionally imbalanced, and a
    random split could leave the test set with almost no fire images, making the
    reported accuracy meaningless.
    """
    rng = random.Random(seed)
    by_label: dict[int, list[Sample]] = {}
    for s in samples:
        by_label.setdefault(s.label, []).append(s)

    train: list[Sample] = []
    val: list[Sample] = []
    test: list[Sample] = []

    for label, items in by_label.items():
        items = list(items)
        rng.shuffle(items)
        n = len(items)
        n_test = max(1, int(round(n * test_frac)))
        n_val = max(1, int(round(n * val_frac)))
        test.extend(items[:n_test])
        val.extend(items[n_test : n_test + n_val])
        train.extend(items[n_test + n_val :])

    rng.shuffle(train)
    return train, val, test


def class_weights(samples: list[Sample], num_classes: int) -> torch.Tensor:
    """Inverse-frequency weights to stop the majority class dominating the loss.

    With ~5x more 'nofire' than 'fire', an unweighted model can score well by
    calling everything 'nofire' - which is exactly the failure mode that matters
    most for a hazard detector.
    """
    counts = np.zeros(num_classes, dtype=np.float64)
    for s in samples:
        counts[s.label] += 1
    counts = np.maximum(counts, 1.0)
    weights = counts.sum() / (num_classes * counts)
    return torch.tensor(weights, dtype=torch.float32)


class FireImageDataset(Dataset):
    """Torch dataset applying the shared preprocessing, plus light augmentation.

    Augmentation is training-only. Horizontal flips and small brightness jitter
    are safe for this domain: a mirrored fire is still a fire. Vertical flips are
    deliberately excluded - smoke rises, and an upside-down scene is not
    something the deployed model will ever see.
    """

    def __init__(self, samples: list[Sample], augment: bool = False, size=INPUT_SIZE):
        self.samples = samples
        self.augment = augment
        self.size = size

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int):
        sample = self.samples[idx]
        img = load_image(sample.path)

        if self.augment:
            img = self._augment(img)

        arr = to_model_array(resize_image(img, self.size))
        return torch.from_numpy(arr), sample.label

    def _augment(self, img: Image.Image) -> Image.Image:
        if random.random() < 0.5:
            img = img.transpose(Image.FLIP_LEFT_RIGHT)

        if random.random() < 0.3:
            from PIL import ImageEnhance

            factor = random.uniform(0.75, 1.25)
            img = ImageEnhance.Brightness(img).enhance(factor)

        return img
