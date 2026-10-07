#!/usr/bin/env bash
# Download raw vector sources for the global map layers into data/raw. Idempotent.
set -euo pipefail
RAW="$(dirname "$0")/../../data/raw"
mkdir -p "$RAW"
fetch() {  # url filename
  if [ -s "$RAW/$2" ]; then echo "exists: $2"; return; fi
  curl -fL --retry 3 --retry-all-errors -o "$RAW/$2.part" "$1" && mv "$RAW/$2.part" "$RAW/$2" && echo "downloaded: $2"
}
fetch https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/MARS_nomenclature_center_pts.kmz MARS_nomenclature_center_pts.kmz
fetch https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_traverse.json M20_traverse.json
fetch https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_traverse.json MSL_traverse.json
fetch https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json M20_waypoints.json
fetch https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json MSL_waypoints.json
# NASA 3D Resources: official Perseverance rover model (glTF binary, ~5 MB), used in mission replay.
fetch "https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/3D%20Models/Mars%202020%20Perseverance%20Rover/Mars%202020%20Perseverance%20Rover.glb" perseverance.glb

# Montabone et al. column dust optical depth, kriged daily maps, Mars years 24-36 (about 730 MB,
# CC BY-SA 3.0). https://www-mars.lmd.jussieu.fr/mars/dust_climatology/
mkdir -p "$RAW/dust"
DUST=https://www-mars.lmd.jussieu.fr/mars/dust_climatology/dataset_v2
for my in 24 25 26 27 28 29 30 31 32 33 34 35 36; do
  case $my in 33) v=2-1 ;; 34 | 35 | 36) v=2-5 ;; *) v=2-0 ;; esac
  fetch "$DUST/dustscenario_MY${my}_v${v}.nc" "dust/dustscenario_MY${my}_v${v}.nc"
done

# USGS Mars Global Cave Candidate Catalog (MGC3, public domain, 1.7 MB zip), doi:10.17189/1519222.
fetch "https://astrogeology.usgs.gov/ckan/dataset/c2960f77-ee20-4cc6-ac85-abbecc0fc7f6/resource/ccd54fb2-9a50-46bf-8971-80c241bb2f40/download/mars_cave_catalog.zip" mars_cave_catalog.zip
[ -s "$RAW/Mars_Cave_Catalog.csv" ] || unzip -p "$RAW/mars_cave_catalog.zip" data/Mars_Cave_Catalog.csv > "$RAW/Mars_Cave_Catalog.csv"
