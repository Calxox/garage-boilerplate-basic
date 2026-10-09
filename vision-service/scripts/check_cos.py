"""Check the COS credentials in your env before deploying.

Run from the vision-service folder:
    set -a; source ../.env; set +a
    python scripts/check_cos.py

Prints only OK/FAIL and object sizes. It never prints the API key.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app import storage  # noqa: E402

if not storage.is_configured():
    sys.exit("FAIL: COS_ENDPOINT / COS_API_KEY_ID / COS_INSTANCE_CRN / COS_BUCKET_NAME not all set")

cfg = storage._config()
client = storage._get_client()
key = os.getenv("COS_MODEL_KEY", "models/best_bushfire_multitask.pt")
try:
    head = client.head_object(Bucket=cfg["bucket"], Key=key)
    print(f"OK: bucket '{cfg['bucket']}' reachable; model '{key}' is {head['ContentLength']/1e6:.1f} MB")
except Exception as exc:  # noqa: BLE001
    sys.exit(f"FAIL: {type(exc).__name__}: {exc}")

test_key = storage.upload_media(b"connectivity-check", "check.txt", "text/plain")
print("OK: test upload ->", test_key if test_key else "FAILED (check Writer role on the credential)")
