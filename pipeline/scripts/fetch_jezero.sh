#!/usr/bin/env bash
# Download the USGS Mars 2020 Science Investigation CTX DEM mosaic (20 m/px, ~90 MB). Idempotent.
set -euo pipefail
URL="https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/CTX/ScienceInvestigationMaps_JPL/M20_JezeroCrater_CTXDEM_20m.tif"
OUT="$(dirname "$0")/../../data/raw/jezero_ctx_dem.tif"
mkdir -p "$(dirname "$OUT")"
if [ -s "$OUT" ]; then echo "exists: $OUT"; exit 0; fi
curl -fL --retry 3 -o "$OUT.part" "$URL"
mv "$OUT.part" "$OUT"
echo "downloaded: $OUT"
