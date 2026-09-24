# Deploying the inference endpoint to IBM Code Engine

Covers Sprint 2 task **[RAW MVP] - Deploy model inference endpoint to IBM Code Engine**.

---

## Why deploys have been failing

The team has been stuck on `Revision failed` with no useful logs since August.
That error is generic - it means the container never became ready - and Code
Engine is poor at saying which of a handful of causes it was. In rough order of
likelihood:

### 1. Wrong CPU architecture (most likely)

Code Engine runs **linux/amd64**. Building on an Apple Silicon Mac (M1/M2/M3)
produces an **arm64** image by default. Code Engine accepts the push, tries to
start it, the binary format is wrong, and you get `Revision failed` with
essentially nothing in the logs.

Renil and probably Matthew are both on arm64 Macs, which makes this the first
thing to rule out.

```bash
# Always, when building from a Mac:
docker build --platform linux/amd64 -t <image> .

# Verify before pushing - must say amd64, not arm64:
docker inspect <image> --format '{{.Architecture}}'
```

The `Dockerfile` in this repo pins `FROM --platform=linux/amd64` so it is
correct even if the flag is forgotten, but check the architecture anyway.

### 2. Not listening on $PORT

Code Engine injects a `PORT` environment variable (8080 by default) and probes
exactly that port. An app hardcoded to 5000 or 3000 never passes the check.

`serve/app.py` reads `os.environ["PORT"]`.

### 3. Bound to 127.0.0.1 instead of 0.0.0.0

A container listening on loopback is unreachable from outside itself. The app
starts fine, logs look healthy, and the revision still fails.

`serve/app.py` binds `0.0.0.0`.

### 4. Slow startup

If the container takes too long to accept connections, the probe times out.
This app loads the model **lazily on first request**, so the port opens
immediately.

### 5. Memory limit

onnxruntime plus Pillow plus OpenCV needs more than the smallest Code Engine
size. Use at least **1 vCPU / 2 GB**. An OOM during startup also shows up as
`Revision failed`.

---

## Build and push

```bash
cd <repo root>

# 1. Log in
ibmcloud login --sso
ibmcloud target -g <resource-group> -r au-syd

# 2. Namespace in IBM Container Registry (once per account)
ibmcloud cr region-set au-syd
ibmcloud cr namespace-add team7
ibmcloud cr login

# 3. Build for amd64 and push
docker build --platform linux/amd64 -t au.icr.io/team7/hazard-api:v1 .
docker inspect au.icr.io/team7/hazard-api:v1 --format '{{.Architecture}}'   # expect: amd64
docker push au.icr.io/team7/hazard-api:v1
```

### Test the image locally before deploying

Catching a failure here is much cheaper than debugging a failed revision.

```bash
docker run --rm -p 8080:8080 -e PORT=8080 au.icr.io/team7/hazard-api:v1

curl localhost:8080/health
curl localhost:8080/ready
curl -F "file=@samples/sample_fire.jpg" localhost:8080/predict
```

If it does not work locally it will not work on Code Engine. If it *does* work
locally on a Mac but fails on Code Engine, it is almost certainly cause #1.

---

## Deploy

```bash
ibmcloud ce project create --name team7-mvp      # or: project select --name team7-mvp

# Registry access secret so Code Engine can pull the image
ibmcloud ce registry create --name icr-secret \
  --server au.icr.io --username iamapikey --password <IBM_CLOUD_API_KEY>

ibmcloud ce application create \
  --name hazard-api \
  --image au.icr.io/team7/hazard-api:v1 \
  --registry-secret icr-secret \
  --port 8080 \
  --cpu 1 --memory 2G \
  --min-scale 0 --max-scale 3

ibmcloud ce application get --name hazard-api --output url
```

`--min-scale 0` means it scales to zero when idle, so it costs nothing between
demos. First request after idle takes a few seconds to wake.

### Update an existing deployment

```bash
docker build --platform linux/amd64 -t au.icr.io/team7/hazard-api:v2 .
docker push au.icr.io/team7/hazard-api:v2
ibmcloud ce application update --name hazard-api --image au.icr.io/team7/hazard-api:v2
```

---

## When a revision fails anyway

```bash
ibmcloud ce application get    --name hazard-api
ibmcloud ce application events --name hazard-api      # usually the most informative
ibmcloud ce application logs   --name hazard-api
ibmcloud ce revision list      --application hazard-api
ibmcloud ce revision get       --name <revision-name>
```

`application events` tends to give the real reason (image pull failure, OOM,
probe timeout) when `logs` is empty. An empty log with a failed revision
generally means the process never started - which points back to cause #1.

---

## Using it

```bash
URL=$(ibmcloud ce application get --name hazard-api --output url)

curl $URL/health
curl -F "file=@photo.jpg" $URL/predict
```

```json
{
  "label": "fire",
  "confidence": 0.8677,
  "scores": { "fire": 0.8677, "nofire": 0.1323 },
  "inference_ms": 35.4
}
```

Base64 alternative, for callers sending JSON rather than multipart:

```bash
curl -X POST $URL/predict/base64 \
  -H "Content-Type: application/json" \
  -d "{\"image\":\"$(base64 -w0 photo.jpg)\"}"
```

| Endpoint | Method | Purpose |
|---|---|---|
| `/health` | GET | Liveness. Does not touch the model. |
| `/ready` | GET | Readiness. Loads the model, reports classes. |
| `/predict` | POST | Multipart image upload. |
| `/predict/base64` | POST | JSON with a base64 image. |
| `/docs` | GET | Swagger UI, generated by FastAPI. |

---

## What this currently serves

**fire / no-fire, not severity.** Severity labelling is still in progress, so
the deployed model is the detection baseline.

That is fine for this task - the deliverable is a working endpoint, and the
model behind it swaps without touching the deployment. When severity lands:
retrain, replace `models/hazard_classifier.onnx` and `models/classes.json`,
rebuild, update. The API shape does not change; `scores` simply carries the
severity classes instead.

## Follow-ups, deliberately left out of the first deploy

- **Load the model from Cloud Object Storage** instead of baking it into the
  image, so the model can be updated without a rebuild. Left out on purpose:
  adding COS credentials to a first deployment is a good way to produce a
  startup failure that is hard to tell apart from the ones above. Do it once
  this deploys cleanly.
- **Authentication.** The endpoint is currently public. Fine for a demo, not
  for anything real.
- **Video support.** `src/inference.py` already handles video; the endpoint
  only exposes images. Video uploads need a larger request limit and a longer
  timeout.
