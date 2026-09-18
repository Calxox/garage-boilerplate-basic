"""
Export a trained checkpoint to ONNX and regenerate the metrics report.

Separate from train.py so the export can be re-run without retraining - for
example after changing opset, or when the deployment target needs a rebuild.
Re-evaluates on the same held-out test split (same seed, same stratification),
so the numbers in the report are reproducible rather than copied from a log.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import torch
from torch.utils.data import DataLoader

sys.path.insert(0, str(Path(__file__).resolve().parent))

from dataset import (  # noqa: E402
    FireImageDataset,
    discover_classes,
    discover_samples,
    stratified_split,
)
from model import build_model, export_onnx  # noqa: E402
from train import evaluate  # noqa: E402


def main() -> int:
    import argparse

    parser = argparse.ArgumentParser(description="Export trained model to ONNX and write metrics")
    parser.add_argument("--checkpoint", default="models/hazard_classifier.pt")
    parser.add_argument("--data-dir", default="data")
    parser.add_argument("--output-dir", default="models")
    parser.add_argument("--metrics-dir", default="outputs")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    ckpt = torch.load(args.checkpoint, map_location="cpu", weights_only=False)
    classes = ckpt["classes"]

    model = build_model(num_classes=len(classes))
    model.load_state_dict(ckpt["state_dict"])
    model.eval()
    print(f"loaded checkpoint: {args.checkpoint} | classes={classes}")

    # Rebuild the identical split used during training.
    disc_classes = discover_classes(args.data_dir)
    samples = discover_samples(args.data_dir, disc_classes)
    train_s, val_s, test_s = stratified_split(samples, seed=args.seed)
    test_loader = DataLoader(FireImageDataset(test_s), batch_size=16)

    metrics = evaluate(model, test_loader, torch.device("cpu"), len(classes))

    print(f"\ntest accuracy : {metrics['accuracy']:.4f}")
    print(f"test macro F1 : {metrics['macro_f1']:.4f}")
    for i, c in enumerate(classes):
        m = metrics["per_class"][i]
        print(f"  {c:10s} precision={m['precision']:.3f} recall={m['recall']:.3f} f1={m['f1']:.3f} n={m['support']}")

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "classes.json").write_text(json.dumps(classes, indent=2))
    print(f"\nwrote {output_dir / 'classes.json'}")

    onnx_path = export_onnx(model, output_dir / "hazard_classifier.onnx")
    size_mb = onnx_path.stat().st_size / 1e6
    print(f"exported {onnx_path} ({size_mb:.1f} MB)")

    metrics_dir = Path(args.metrics_dir)
    metrics_dir.mkdir(parents=True, exist_ok=True)
    report = {
        "classes": classes,
        "counts": {c: sum(1 for s in samples if s.label == i) for i, c in enumerate(disc_classes)},
        "split": {"train": len(train_s), "val": len(val_s), "test": len(test_s)},
        "test_metrics": metrics,
        "onnx_size_mb": round(size_mb, 2),
    }
    (metrics_dir / "training_report.json").write_text(json.dumps(report, indent=2))
    print(f"wrote {metrics_dir / 'training_report.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
