#!/usr/bin/env bash
# False-positive check: sends NON-fire images to /v1/assess/image and prints the raw scores.
# Usage: bash vision-service/scripts/fp_check.sh <vision-service-url> [extra_image ...]
URL="${1:?usage: fp_check.sh <vision-service-url> [image ...]}"; shift
D=$(mktemp -d)
python3 - "$D" <<'PY'
import sys, random
from PIL import Image, ImageDraw, ImageFilter
d = sys.argv[1]
random.seed(1)
Image.new("RGB",(640,480),(20,20,22)).save(f"{d}/solid_black.jpg")
Image.new("RGB",(640,480),(110,110,115)).save(f"{d}/solid_grey.jpg")
Image.new("RGB",(640,480),(90,170,215)).save(f"{d}/solid_blue.jpg")
im = Image.new("RGB",(640,480))
px = im.load()
for x in range(640):
    for y in range(480):
        v = random.randint(25,70); px[x,y]=(v,v,v+3)
im.filter(ImageFilter.GaussianBlur(6)).save(f"{d}/dark_noise.jpg")
im = Image.new("RGB",(640,480),(120,80,50)); g = ImageDraw.Draw(im)
g.rectangle((0,300,640,480), fill=(60,40,25)); g.rectangle((200,80,420,300), fill=(80,190,220))
im.save(f"{d}/indoor_blocks.jpg")
PY
for f in "$D"/*.jpg "$@"; do
  echo "=== $(basename "$f")"
  for m in ground drone; do
    echo "--- modality=$m"
    curl -s -X POST "$URL/v1/assess/image" -F "file=@$f" -F "modality=$m" | python3 -c '
import sys,json
try:
    r=json.load(sys.stdin)
    print("severity:",r["severity"],round(r["severity_confidence"],3))
    print("sev scores:",{k:round(v,3) for k,v in r["severity_scores"].items()})
    print("features >=0.4:",r["key_features"])
    print("feat scores:",{k:round(v,3) for k,v in r["key_feature_scores"].items()})
except Exception as e: print("ERR",e)'
  done
done
