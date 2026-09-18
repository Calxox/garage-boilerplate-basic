"""
Model construction: ImageNet-pretrained MobileNetV2 with a new classifier head.

The backbone is loaded from the ONNX MobileNetV2 (ImageNet weights) and
converted to a trainable torch module, then its 1000-class ImageNet classifier
is replaced with a head sized to our own classes. Everything before that head
keeps its pretrained weights - that is what makes this transfer learning rather
than training from scratch, and it is why a few hundred images is enough.
"""

from __future__ import annotations

from pathlib import Path

import torch
import torch.nn as nn

# Name of the final Linear layer inside the converted graph (ImageNet classifier).
CLASSIFIER_ATTR = "Gemm_104"
FEATURE_DIM = 1280  # MobileNetV2 pooled feature width

DEFAULT_ONNX = Path(__file__).resolve().parent.parent / "models" / "mobilenetv2_imagenet.onnx"


def build_model(
    num_classes: int,
    onnx_path: str | Path = DEFAULT_ONNX,
    dropout: float = 0.2,
) -> nn.Module:
    """Build MobileNetV2 with pretrained backbone and a fresh classifier head.

    Args:
        num_classes: number of output classes.
        onnx_path: ImageNet-pretrained MobileNetV2 in ONNX form.
        dropout: regularisation before the final layer. Matters here because the
            dataset is small enough to memorise.
    """
    from onnx2torch import convert

    model = convert(str(onnx_path))

    if not hasattr(model, CLASSIFIER_ATTR):
        raise RuntimeError(
            f"Expected classifier layer '{CLASSIFIER_ATTR}' in the converted graph. "
            f"Found: {[n for n, _ in model.named_children()][-5:]}"
        )

    setattr(
        model,
        CLASSIFIER_ATTR,
        nn.Sequential(
            nn.Dropout(p=dropout),
            nn.Linear(FEATURE_DIM, num_classes),
        ),
    )
    return model


def set_backbone_trainable(model: nn.Module, trainable: bool) -> None:
    """Freeze or unfreeze everything except the classifier head.

    Freezing first is deliberate: a randomly initialised head produces large
    early gradients, and letting those flow into pretrained weights degrades
    the features we are trying to reuse.
    """
    head = getattr(model, CLASSIFIER_ATTR)
    head_params = {id(p) for p in head.parameters()}
    for param in model.parameters():
        if id(param) not in head_params:
            param.requires_grad = trainable


def trainable_parameter_count(model: nn.Module) -> tuple[int, int]:
    """Return (trainable, total) parameter counts."""
    total = sum(p.numel() for p in model.parameters())
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    return trainable, total


def export_onnx(
    model: nn.Module,
    output_path: str | Path,
    opset: int = 13,
) -> Path:
    """Export a trained model to ONNX for CPU-only serving.

    ONNX is what gets deployed: onnxruntime serves it without torch installed,
    which keeps the Code Engine container small and CPU inference fast.
    """
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    model.eval()
    dummy = torch.randn(1, 3, 224, 224)

    kwargs = dict(
        input_names=["input"],
        output_names=["logits"],
        dynamic_axes={"input": {0: "batch"}, "logits": {0: "batch"}},
        opset_version=opset,
    )

    # torch>=2.9 defaults to the dynamo exporter, which cannot trace the
    # dynamic Reshape that onnx2torch emits after global average pooling.
    # The TorchScript exporter handles it, so prefer that and only fall back
    # to the default path on older torch versions that lack the flag.
    try:
        torch.onnx.export(model, dummy, str(output_path), dynamo=False, **kwargs)
    except TypeError:
        torch.onnx.export(model, dummy, str(output_path), **kwargs)

    return output_path
