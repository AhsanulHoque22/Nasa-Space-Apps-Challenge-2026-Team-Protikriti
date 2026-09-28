#!/usr/bin/env bash
# Download raw vector sources for the global map layers into data/raw. Idempotent.
set -euo pipefail
RAW="$(dirname "$0")/../../data/raw"
mkdir -p "$RAW"
fetch() {  # url filename
  if [ -s "$RAW/$2" ]; then echo "exists: $2"; return; fi
  curl -fL --retry 3 -o "$RAW/$2.part" "$1" && mv "$RAW/$2.part" "$RAW/$2" && echo "downloaded: $2"
}
fetch https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/MARS_nomenclature_center_pts.kmz MARS_nomenclature_center_pts.kmz
fetch https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_traverse.json M20_traverse.json
fetch https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_traverse.json MSL_traverse.json
