"""
Train the hazard classifier.

Two-phase transfer learning:
  1. Warmup - backbone frozen, train only the new head. Stops large random-init
     gradients from damaging pretrained features.
  2. Fine-tune - unfreeze the backbone at a much lower learning rate.

Runs on CPU. On GPU (Colab/Kaggle) the same script runs unchanged and simply
picks up cuda, which is the intended path once the full severity dataset lands.

Usage:
    python src/train.py --data-dir data --epochs 8 --warmup-epochs 3
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader

sys.path.insert(0, str(Path(__file__).resolve().parent))

from dataset import (  # noqa: E402
    FireImageDataset,
    class_weights,
    discover_classes,
    discover_samples,
    stratified_split,
)
from model import (  # noqa: E402
    build_model,
    export_onnx,
    set_backbone_trainable,
    trainable_parameter_count,
)


def evaluate(model, loader, device, num_classes):
    """Run the model over a loader and return metrics plus a confusion matrix."""
    model.eval()
    confusion = np.zeros((num_classes, num_classes), dtype=np.int64)
    correct = 0
    total = 0

    with torch.no_grad():
        for images, labels in loader:
            images = images.to(device)
            logits = model(images)
            preds = logits.argmax(dim=1).cpu()

            for t, p in zip(labels.numpy(), preds.numpy()):
                confusion[t, p] += 1
            correct += int((preds == labels).sum())
            total += labels.numel()

    accuracy = correct / max(total, 1)

    # Per-class precision/recall/F1 from the confusion matrix.
    per_class = []
    for c in range(num_classes):
        tp = int(confusion[c, c])
        fp = int(confusion[:, c].sum() - tp)
        fn = int(confusion[c, :].sum() - tp)
        precision = tp / (tp + fp) if (tp + fp) else 0.0
        recall = tp / (tp + fn) if (tp + fn) else 0.0
        f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0
        per_class.append({"precision": precision, "recall": recall, "f1": f1, "support": int(confusion[c, :].sum())})

    macro_f1 = float(np.mean([m["f1"] for m in per_class])) if per_class else 0.0
    return {"accuracy": accuracy, "macro_f1": macro_f1, "per_class": per_class, "confusion": confusion.tolist()}


def run_epoch(model, loader, criterion, optimizer, device):
    """One training pass. Returns mean loss."""
    model.train()
    running = 0.0
    seen = 0
    for images, labels in loader:
        images = images.to(device)
        labels = labels.to(device)

        optimizer.zero_grad()
        logits = model(images)
        loss = criterion(logits, labels)
        loss.backward()
        optimizer.step()

        running += float(loss) * labels.size(0)
        seen += labels.size(0)
    return running / max(seen, 1)


def main() -> int:
    parser = argparse.ArgumentParser(description="Train the MobileNetV2 hazard classifier")
    parser.add_argument("--data-dir", default="data", help="directory with one subfolder per class")
    parser.add_argument("--epochs", type=int, default=8, help="total epochs (warmup + fine-tune)")
    parser.add_argument("--warmup-epochs", type=int, default=3, help="epochs with the backbone frozen")
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--head-lr", type=float, default=1e-3, help="LR while the backbone is frozen")
    parser.add_argument("--finetune-lr", type=float, default=1e-4, help="LR once the backbone unfreezes")
    parser.add_argument("--workers", type=int, default=2)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--output-dir", default="models")
    parser.add_argument("--metrics-dir", default="outputs")
    args = parser.parse_args()

    torch.manual_seed(args.seed)
    np.random.seed(args.seed)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"device: {device}")

    classes = discover_classes(args.data_dir)
    samples = discover_samples(args.data_dir, classes)
    train_s, val_s, test_s = stratified_split(samples, seed=args.seed)

    print(f"classes: {classes}")
    print(f"samples: total={len(samples)} train={len(train_s)} val={len(val_s)} test={len(test_s)}")
    for i, c in enumerate(classes):
        print(f"  {c}: {sum(1 for s in samples if s.label == i)}")

    train_loader = DataLoader(
        FireImageDataset(train_s, augment=True),
        batch_size=args.batch_size, shuffle=True, num_workers=args.workers,
    )
    val_loader = DataLoader(
        FireImageDataset(val_s), batch_size=args.batch_size, num_workers=args.workers
    )
    test_loader = DataLoader(
        FireImageDataset(test_s), batch_size=args.batch_size, num_workers=args.workers
    )

    model = build_model(num_classes=len(classes)).to(device)

    weights = class_weights(train_s, len(classes)).to(device)
    print(f"class weights: {[round(float(w), 3) for w in weights]}")
    criterion = nn.CrossEntropyLoss(weight=weights)

    # Phase 1: head only.
    set_backbone_trainable(model, False)
    trainable, total = trainable_parameter_count(model)
    print(f"warmup - trainable {trainable:,} / {total:,}")
    optimizer = torch.optim.Adam([p for p in model.parameters() if p.requires_grad], lr=args.head_lr)

    best_f1 = -1.0
    best_state = None
    history = []
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    for epoch in range(1, args.epochs + 1):
        if epoch == args.warmup_epochs + 1:
            # Phase 2: unfreeze everything, drop the LR.
            set_backbone_trainable(model, True)
            trainable, total = trainable_parameter_count(model)
            print(f"fine-tune - trainable {trainable:,} / {total:,}")
            optimizer = torch.optim.Adam(model.parameters(), lr=args.finetune_lr)

        t0 = time.time()
        loss = run_epoch(model, train_loader, criterion, optimizer, device)
        val_metrics = evaluate(model, val_loader, device, len(classes))
        dt = time.time() - t0

        phase = "warmup" if epoch <= args.warmup_epochs else "finetune"
        print(
            f"epoch {epoch:2d}/{args.epochs} [{phase:8s}] "
            f"loss={loss:.4f} val_acc={val_metrics['accuracy']:.4f} "
            f"val_macroF1={val_metrics['macro_f1']:.4f} ({dt:.1f}s)"
        )
        history.append({"epoch": epoch, "phase": phase, "loss": loss,
                        "val_accuracy": val_metrics["accuracy"], "val_macro_f1": val_metrics["macro_f1"]})

        # Select on macro-F1, not accuracy: with an imbalanced set, accuracy
        # rewards a model that ignores the minority (fire) class.
        if val_metrics["macro_f1"] > best_f1:
            best_f1 = val_metrics["macro_f1"]
            best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
            print(f"  ^ new best (val macro-F1 {best_f1:.4f}) - checkpointing")

    if best_state is not None:
        model.load_state_dict(best_state)

    print("\n=== test set (held out, never seen during training) ===")
    test_metrics = evaluate(model, test_loader, device, len(classes))
    print(f"accuracy : {test_metrics['accuracy']:.4f}")
    print(f"macro F1 : {test_metrics['macro_f1']:.4f}")
    for i, c in enumerate(classes):
        m = test_metrics["per_class"][i]
        print(f"  {c:10s} precision={m['precision']:.3f} recall={m['recall']:.3f} "
              f"f1={m['f1']:.3f} n={m['support']}")
    print("confusion matrix (rows=true, cols=pred):")
    print(f"  {'':10s}" + "".join(f"{c:>10s}" for c in classes))
    for i, c in enumerate(classes):
        print(f"  {c:10s}" + "".join(f"{v:>10d}" for v in test_metrics["confusion"][i]))

    weights_path = output_dir / "hazard_classifier.pt"
    torch.save({"state_dict": model.state_dict(), "classes": classes}, weights_path)
    print(f"\nsaved weights -> {weights_path}")

    onnx_path = export_onnx(model, output_dir / "hazard_classifier.onnx")
    print(f"exported onnx -> {onnx_path}")

    metrics_dir = Path(args.metrics_dir)
    metrics_dir.mkdir(parents=True, exist_ok=True)
    report = {
        "classes": classes,
        "counts": {c: sum(1 for s in samples if s.label == i) for i, c in enumerate(classes)},
        "split": {"train": len(train_s), "val": len(val_s), "test": len(test_s)},
        "history": history,
        "test_metrics": test_metrics,
        "args": vars(args),
    }
    (metrics_dir / "training_report.json").write_text(json.dumps(report, indent=2))
    (output_dir / "classes.json").write_text(json.dumps(classes, indent=2))
    print(f"saved metrics -> {metrics_dir / 'training_report.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
