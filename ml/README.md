# Hazard Classification Baseline — MobileNetV2

Baseline model and inference pipeline for the forest-fire severity identification
MVP (Team 7 — IBM AI for Emergency & Environmental Response).

Covers Sprint 2 task **[RAW MVP] - Build baseline model / inference pipeline**.

---

## What this is

A working end-to-end pipeline: **image or video in → hazard class + confidence out**,
running on CPU with no GPU at serving time.

It is trained on a **fire / no-fire** dataset, not on severity grades. That is
deliberate — see [Current limitation](#current-limitation). The pipeline, the
preprocessing, the training script and the serving code are all final; only the
training data needs to be swapped when the severity-graded data lands.

## Results (current baseline)

Trained on 651 images (110 fire / 541 no-fire), stratified 70/15/15 split.
Numbers below are on the 97-image **held-out test set**, never seen in training.

| Metric | Value |
|---|---|
| Accuracy | **96.9%** |
| Macro F1 | **0.945** |

| Class | Precision | Recall | F1 | n |
|---|---|---|---|---|
| fire | 0.882 | 0.938 | 0.909 | 16 |
| nofire | 0.988 | 0.975 | 0.981 | 81 |

Confusion matrix (rows = true, cols = predicted):

|  | fire | nofire |
|---|---|---|
| **fire** | 15 | 1 |
| **nofire** | 2 | 79 |

15 of 16 fires caught, 1 missed, 2 false alarms.

Metrics are reported as **macro-F1 alongside accuracy**, because the dataset is
intentionally imbalanced (~5× more no-fire than fire). A model that labelled
everything "no-fire" would score 83% accuracy while detecting zero fires —
accuracy alone would hide that completely.

**Measured inference cost (CPU, no GPU):**

| Workload | Time |
|---|---|
| Single image | ~11 ms |
| 12 s video (6 frames sampled) | ~0.13 s |
| Exported ONNX model size | 8.9 MB |

The exported ONNX was verified against the PyTorch model on the same inputs —
maximum probability difference `1.4e-07`, so serving matches training exactly.

### One finding worth carrying forward

Unfreezing the whole backbone at `1e-4` **made validation scores worse** on a
dataset this small (macro-F1 0.982 → 0.867), i.e. it overfit and degraded the
pretrained features. The training script checkpoints on validation macro-F1 and
restores the best weights, so the shipped model is unaffected — but when
retraining on the larger severity dataset, start with a lower fine-tune LR
(`--finetune-lr 1e-5`) or keep the backbone frozen.

See `outputs/training_report.json` and `outputs/train.log` for the full run.

## Architecture

```
upload → IBM Cloud Object Storage
              ↓
        fetch object
              ↓
   ┌──────────┴───────────┐
 image                  video
   │                      │
   │              frame sampling
   │            (1 frame / 2s, cap 30)
   │                      │
   └──────────┬───────────┘
              ↓
  preprocessing (224×224 RGB, ImageNet normalisation)
              ↓
   MobileNetV2 (ONNX, onnxruntime, CPU)
              ↓
     class + confidence  ──(video: aggregate frames)
              ↓
   watsonx.ai generateText → written hazard description
```

Video is **not** a separate model. Frames go through the identical image path
and the per-frame results are aggregated, so there is one model to train, test
and deploy.

## Why MobileNetV2

- **Deployable on IBM Code Engine**, which has no GPU. Inference is ~2.2M
  parameters and milliseconds per frame on CPU.
- **Transfer learning from ImageNet** means a few hundred labelled images is
  enough. Training from scratch at this dataset size would not work.
- **Exports cleanly to ONNX**, so the serving container needs `onnxruntime`
  only — no torch, no CUDA.

Training still uses a GPU where one is available (Colab/Kaggle, free). GPU is a
*training* requirement, not a *serving* one — those are separate machines.

## Layout

```
src/preprocessing.py   shared image preprocessing (training and serving both use it)
src/video_frames.py    video frame sampling
src/dataset.py         class discovery, stratified splits, class weighting, augmentation
src/model.py           MobileNetV2 + replaced classifier head, ONNX export
src/train.py           two-phase training (frozen warmup → fine-tune)
src/inference.py       deployable pipeline (onnxruntime); handles image + video
models/                pretrained backbone, trained weights, exported ONNX
outputs/               training log and metrics report
```

## Usage

### Get the data

The dataset is not committed (136 MB). Fetch it:

```bash
python src/prepare_data.py --output data      # needs `unar` or `unrar` on PATH
```

Data layout — one folder per class:

```
data/
  fire/     img001.jpg ...
  nofire/   img101.jpg ...
```

### Train

```bash
pip install -r requirements-train.txt
python src/train.py --data-dir data --epochs 12 --warmup-epochs 4
```

Runs on CPU in ~5 minutes. On a GPU (Colab/Kaggle) the same command picks up
cuda automatically — no code change.

### Infer

```bash
pip install -r requirements.txt          # serving deps only
python src/inference.py path/to/photo.jpg
python src/inference.py path/to/clip.mp4 --every-n-seconds 2 --max-frames 30
```

From Python:

```python
from inference import HazardClassifier

clf = HazardClassifier("models/hazard_classifier.onnx", "models/classes.json")
result = clf.predict("photo.jpg")
print(result.label, result.confidence)
```

## Current limitation

The public datasets available right now (this one, and the Kaggle fire sets) are
**presence-based**: fire / no-fire / smoke. They do not carry severity grades.

The severity-graded sources identified for this project — **NSW FESM** and the
**Victorian Fire Severity Map 2019/20** — are raster/GeoTIFF products, not image
folders. They need converting into labelled image patches before they can be
used here. That conversion is the remaining blocker, and it is a data task, not
a modelling one.

**Swapping to severity data requires no code change.** Point `--data-dir` at a
folder with one subdirectory per severity class and retrain:

```
data_severity/
  unburnt/
  low/
  moderate/
  high/
  extreme/
```

Class names, count and the output layer size are all derived from the folder
names at runtime.

## Deployment notes

- Serving needs `onnxruntime`, `numpy`, `Pillow`, `opencv-python-headless`.
  Deliberately **not** torch — that keeps the container small.
- `HazardClassifier(..., intra_op_threads=N)` pins thread count, which matters
  on Code Engine where the container gets fewer cores than the host reports.
- The exported ONNX takes a dynamic batch dimension, so video frames are
  batched in one call rather than one call per frame.
