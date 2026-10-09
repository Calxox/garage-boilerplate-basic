#!/usr/bin/env bash
# Deploy the vision-service to IBM Code Engine from LOCAL source (nothing is pushed to git).
#
# Prereqs:  ibmcloud CLI + code-engine plugin, logged in to the right account
#           (ibmcloud login --sso), and a .env at the repo root holding COS_* / WATSONX_* values.
# Usage:    cd <repo root> && bash vision-service/deploy.sh
set -euo pipefail

REGION="${REGION:-au-syd}"
RG="${RG:-Default}"
PROJECT="${PROJECT:-team7-hazardwatch}"
APP="${APP:-vision-service}"
ENV_FILE="${ENV_FILE:-.env}"
# Set both when Code Engine cannot create registry access for you automatically:
#   REGISTRY_IMAGE=au.icr.io/<namespace>/vision-service  REGISTRY_SECRET=<ce registry secret name>
REGISTRY_IMAGE="${REGISTRY_IMAGE:-}"
REGISTRY_SECRET="${REGISTRY_SECRET:-}"
REG_ARGS=()
[ -n "$REGISTRY_IMAGE" ] && REG_ARGS+=(--image "$REGISTRY_IMAGE")
[ -n "$REGISTRY_SECRET" ] && REG_ARGS+=(--registry-secret "$REGISTRY_SECRET")
CORS_ORIGINS="${CORS_ORIGINS:-*}"   # tighten to the frontend URL once it exists

[ -f "$ENV_FILE" ] || { echo "No $ENV_FILE found (run from the repo root)"; exit 1; }

# Only the variables the service reads go into the secret - nothing else from .env.
SECRET_FILE="$(mktemp)"; trap 'rm -f "$SECRET_FILE"' EXIT
# Skip empty values (the CLI rejects them) and map the backend's WATSONX_AI_* names
# to the WATSONX_* names the vision-service reads.
awk -F= '
  /^(COS_|WATSONX_)[A-Z_]*=/ {
    k=$1; v=substr($0,index($0,"=")+1)
    if (v=="") next
    if (k=="WATSONX_AI_APIKEY") k="WATSONX_API_KEY"
    else if (k ~ /^WATSONX_AI_/) sub(/^WATSONX_AI_/,"WATSONX_",k)
    print k "=" v
  }' "$ENV_FILE" > "$SECRET_FILE"
for v in COS_API_KEY_ID COS_INSTANCE_CRN COS_BUCKET_NAME COS_ENDPOINT; do
  grep -q "^$v=" "$SECRET_FILE" || { echo "Missing $v in $ENV_FILE"; exit 1; }
done
grep -q '^WATSONX_API_KEY=' "$SECRET_FILE" || echo "Note: no WATSONX_API_KEY - /v1/chat will not work until it is added."

ibmcloud target -r "$REGION" -g "$RG" >/dev/null
ibmcloud ce project select -n "$PROJECT" 2>/dev/null || ibmcloud ce project create -n "$PROJECT"

# Recreate the secret so changes in .env take effect.
ibmcloud ce secret delete -n vision-secrets -f 2>/dev/null || true
ibmcloud ce secret create -n vision-secrets --from-env-file "$SECRET_FILE"

# 4 GB memory: torch + EfficientNet + OpenCV video frames. Min scale 1 avoids model re-download on cold start.
if ibmcloud ce app get -n "$APP" >/dev/null 2>&1; then
  ibmcloud ce app update -n "$APP" --build-source ./vision-service --build-strategy dockerfile ${REG_ARGS[@]+"${REG_ARGS[@]}"} --wait
else
  ibmcloud ce app create -n "$APP" \
    --build-source ./vision-service --build-strategy dockerfile ${REG_ARGS[@]+"${REG_ARGS[@]}"} \
    --port 8080 --cpu 2 --memory 4G --min-scale 1 --max-scale 2 \
    --env-from-secret vision-secrets \
    --env CORS_ORIGINS="$CORS_ORIGINS" \
    --wait
fi

URL="$(ibmcloud ce app get -n "$APP" -o url)"
echo "Deployed: $URL"
echo "Health:   curl -s $URL/health"
