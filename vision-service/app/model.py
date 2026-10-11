"""BushfireMultiTaskNet — mirrored from testbed_pipeline.ipynb §5."""

from __future__ import annotations

import torch
import torch.nn as nn
from torchvision.models import EfficientNet_B0_Weights, efficientnet_b0


class BushfireMultiTaskNet(nn.Module):
    """Shared EfficientNet-B0 + severity classifier + multilabel feature head."""

    def __init__(
        self,
        n_severity: int = 5,
        n_features: int = 6,
        n_modalities: int = 3,
        modality_dim: int = 16,
        pretrained: bool = False,
    ):
        super().__init__()
        weights = EfficientNet_B0_Weights.IMAGENET1K_V1 if pretrained else None
        backbone = efficientnet_b0(weights=weights)
        in_feats = backbone.classifier[1].in_features  # 1280
        backbone.classifier = nn.Identity()
        self.backbone = backbone

        self.modality_emb = nn.Embedding(n_modalities, modality_dim)
        fused = in_feats + modality_dim

        self.severity_head = nn.Sequential(
            nn.Dropout(p=0.3),
            nn.Linear(fused, n_severity),
        )
        self.feature_head = nn.Sequential(
            nn.Dropout(p=0.3),
            nn.Linear(fused, n_features),
        )

    def forward(self, images: torch.Tensor, modality_idx: torch.Tensor):
        feats = self.backbone(images)
        mod = self.modality_emb(modality_idx)
        fused = torch.cat([feats, mod], dim=1)
        return self.severity_head(fused), self.feature_head(fused)
