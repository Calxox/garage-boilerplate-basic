#!/usr/bin/env bash
# Tests the watsonx key + project id from ../../.env. Never prints the key.
# Run from the repo root:  bash vision-service/scripts/check_watsonx.sh
set -euo pipefail
set -a; source "${ENV_FILE:-.env}"; set +a
URL="${WATSONX_AI_URL:-https://us-south.ml.cloud.ibm.com}"
MODEL="${WATSONX_AI_MODEL_ID:-meta-llama/llama-3-3-70b-instruct}"

TOKEN=$(curl -s -X POST https://iam.cloud.ibm.com/identity/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=$WATSONX_AI_APIKEY" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('access_token') or ('ERR:'+str(d.get('errorMessage'))))")
case "$TOKEN" in ERR:*) echo "1) API key: FAIL - ${TOKEN#ERR:}"; exit 1;; esac
echo "1) API key: OK (len ${#WATSONX_AI_APIKEY})"

echo "2) project id len ${#WATSONX_AI_PROJECT_ID}, url $URL, model $MODEL"
BODY=$(python3 -c "import json,os; print(json.dumps({'model_id':os.environ.get('WATSONX_AI_MODEL_ID') or 'meta-llama/llama-3-3-70b-instruct','project_id':os.environ['WATSONX_AI_PROJECT_ID'],'messages':[{'role':'user','content':'Say hi in 3 words.'}],'max_tokens':20}))")
curl -s -X POST "$URL/ml/v1/text/chat?version=2024-10-08" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$BODY" \
  | python3 -c "
import sys,json
d=json.load(sys.stdin)
if 'choices' in d: print('3) chat: OK ->', d['choices'][0]['message']['content'])
else:
    e=(d.get('errors') or [{}])[0]
    print('3) chat: FAIL -', e.get('code'), '-', (e.get('message') or d.get('message') or str(d))[:300])"
