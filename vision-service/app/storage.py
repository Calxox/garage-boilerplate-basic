"""IBM Cloud Object Storage: model checkpoint in, uploaded media out.

Two jobs, both optional:

1. Fetch the trained checkpoint at startup. The .pt is gitignored on purpose,
   so a Code Engine build-from-source image cannot contain it. Baking it in
   would also mean rebuilding the image to ship a retrained model. It is
   pulled from COS on first use instead and cached on local disk, so the cost
   is paid once per container rather than once per request.

2. Store uploaded images and video, so a report can be reopened later with the
   evidence still attached rather than the prediction alone.

Both degrade rather than fail. If COS is not configured, a checkpoint already
on disk is used as-is and uploads are skipped - that keeps the local
development flow (model sitting next to the repo, no credentials) working
exactly as it does today.
"""

from __future__ import annotations

import logging
import os
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

log = logging.getLogger("hazardwatch.storage")

_MEDIA_PREFIX = os.getenv("COS_MEDIA_PREFIX", "uploads")
_MODEL_KEY = os.getenv("COS_MODEL_KEY", "models/best_bushfire_multitask.pt")

_client = None
_client_lock = threading.Lock()
_download_lock = threading.Lock()


class StorageUnavailable(RuntimeError):
    """COS is not configured, or the SDK could not be initialised."""


def _config() -> dict[str, str]:
    cfg = {
        "endpoint": os.getenv("COS_ENDPOINT", ""),
        "api_key": os.getenv("COS_API_KEY_ID", ""),
        "instance_crn": os.getenv("COS_INSTANCE_CRN", ""),
        "bucket": os.getenv("COS_BUCKET_NAME", ""),
    }
    missing = [k for k, v in cfg.items() if not v]
    if missing:
        raise StorageUnavailable(f"COS not configured, missing: {', '.join(missing)}")
    return cfg


def is_configured() -> bool:
    try:
        _config()
        return True
    except StorageUnavailable:
        return False


def _get_client():
    """Build the COS client once. Thread-safe: uvicorn serves concurrently."""
    global _client
    if _client is not None:
        return _client
    with _client_lock:
        if _client is not None:
            return _client
        cfg = _config()
        try:
            import ibm_boto3
            from ibm_botocore.client import Config
        except ImportError as exc:  # pragma: no cover - dependency is declared
            raise StorageUnavailable(f"ibm-cos-sdk not installed: {exc}") from exc

        endpoint = cfg["endpoint"]
        if not endpoint.startswith("http"):
            endpoint = f"https://{endpoint}"

        _client = ibm_boto3.client(
            "s3",
            ibm_api_key_id=cfg["api_key"],
            ibm_service_instance_id=cfg["instance_crn"],
            config=Config(signature_version="oauth"),
            endpoint_url=endpoint,
        )
        return _client


def ensure_model(local_path: Path) -> Path:
    """Return a usable checkpoint path, downloading from COS if needed.

    A checkpoint already on disk always wins - that is the local development
    case, and re-downloading it would be pointless. The download is guarded by
    a lock so that two simultaneous first requests cannot both write the same
    file and leave it half-written.
    """
    if local_path.is_file():
        return local_path

    with _download_lock:
        if local_path.is_file():  # another thread won the race
            return local_path

        cfg = _config()  # raises StorageUnavailable, surfaced as 503 upstream
        local_path.parent.mkdir(parents=True, exist_ok=True)
        # Download to a temp name and rename, so a crash mid-download cannot
        # leave a truncated file that looks valid to the is_file() check above.
        tmp_path = local_path.with_suffix(local_path.suffix + ".part")

        log.info("downloading checkpoint cos://%s/%s", cfg["bucket"], _MODEL_KEY)
        _get_client().download_file(cfg["bucket"], _MODEL_KEY, str(tmp_path))
        tmp_path.replace(local_path)
        log.info("checkpoint ready at %s (%d bytes)", local_path, local_path.stat().st_size)
        return local_path


def build_media_key(filename: str) -> str:
    """A unique object key per upload.

    uuid4 rather than a counter or the original filename: two people uploading
    IMG_0001.jpg a second apart must not collide, and a counter would need
    shared state across containers that scale to zero.
    """
    suffix = Path(filename or "").suffix.lower()[:10]
    day = datetime.now(timezone.utc).strftime("%Y/%m/%d")
    return f"{_MEDIA_PREFIX}/{day}/{uuid.uuid4().hex}{suffix}"


def upload_media(data: bytes, filename: str, content_type: str | None = None) -> str | None:
    """Store an upload and return its object key, or None if storage is off.

    Returns None rather than raising when COS is unconfigured: losing the
    stored copy should never cost the caller their classification result.
    A genuine upload failure is logged and also swallowed, for the same reason.
    """
    if not is_configured():
        return None
    try:
        key = build_media_key(filename)
        _get_client().put_object(
            Bucket=_config()["bucket"],
            Key=key,
            Body=data,
            ContentType=content_type or "application/octet-stream",
        )
        return key
    except Exception:  # noqa: BLE001 - never fail a prediction over storage
        log.exception("media upload failed; continuing without stored copy")
        return None
