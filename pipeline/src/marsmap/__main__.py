"""CLI.

python -m marsmap build  --dem DEM.tif --out web/public/data
python -m marsmap layers --raw data/raw --curated pipeline/data --out web/public/data/layers
"""

import argparse
import json
import zipfile
from collections.abc import Sequence
from pathlib import Path
from typing import Any

from marsmap.dem import load_dem
from marsmap.export import export_grid, export_slope_overlay
from marsmap.layers import (
    Feature,
    landing_features,
    parse_nomenclature,
    resolve_zones,
    traverse_feature,
)
from marsmap.slope import slope_deg

# Octavia E. Butler landing site + western delta front, Jezero crater (Mars 2000 degrees E/N).
JEZERO_AOI = (77.33, 18.36, 77.53, 18.56)
MAX_SAFE_SLOPE_DEG = 15.0  # conservative EVA walking limit; tune with mission guidance
TRAVERSE_TOLERANCE_DEG = 2e-5  # ~1.2 m on Mars: invisible at map scale, ~10x fewer points
ROVER_TRAVERSES = {"Perseverance": "M20_traverse.json", "Curiosity": "MSL_traverse.json"}
NOMENCLATURE_KMZ = "MARS_nomenclature_center_pts.kmz"


def _bounds(text: str) -> tuple[float, float, float, float]:
    west, south, east, north = (float(v) for v in text.split(","))
    return west, south, east, north


def _write_collection(path: Path, features: list[Feature], **extra: Any) -> None:
    collection = {"type": "FeatureCollection", **extra, "features": features}
    path.write_text(json.dumps(collection, ensure_ascii=False, separators=(",", ":")))


def _build(args: argparse.Namespace) -> None:
    dem = load_dem(args.dem, args.bounds)
    export_grid(dem, args.out, args.max_slope)
    slope = slope_deg(dem.elevation_m, dem.pixel_size_m)
    export_slope_overlay(slope, args.out / "slope_hazard.png", args.max_slope)
    print(f"wrote {args.out}: {dem.elevation_m.shape[1]}x{dem.elevation_m.shape[0]} cells")


def _layers(args: argparse.Namespace) -> None:
    raw: Path = args.raw
    out: Path = args.out
    out.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(raw / NOMENCLATURE_KMZ) as kmz:
        kml_name = next(n for n in kmz.namelist() if n.endswith(".kml"))
        names = parse_nomenclature(kmz.read(kml_name).decode("utf-8"))
    _write_collection(
        out / "names.geojson", names, source="USGS Gazetteer of Planetary Nomenclature"
    )

    traverses = [
        traverse_feature(json.loads((raw / file).read_text()), rover, TRAVERSE_TOLERANCE_DEG)
        for rover, file in ROVER_TRAVERSES.items()
    ]
    _write_collection(out / "traverses.geojson", traverses, source="NASA/JPL MMGIS")

    sites = json.loads((args.curated / "landing_sites.json").read_text())
    _write_collection(
        out / "landing_sites.geojson", landing_features(sites["sites"]), source=sites["source"]
    )

    zones_doc = json.loads((args.curated / "exploration_zones.json").read_text())
    zones, missing = resolve_zones(zones_doc["zones"], names)
    if missing:
        print(f"warning: exploration-zone anchors not in gazetteer (skipped): {missing}")
    _write_collection(
        out / "exploration_zones.geojson",
        zones,
        source=zones_doc["source"],
        radius_km=zones_doc["radius_km"],
    )
    print(f"wrote {out}: {len(names)} names, {len(zones)} zones, {len(traverses)} traverses")


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="marsmap")
    sub = parser.add_subparsers(dest="command", required=True)
    build = sub.add_parser("build", help="DEM -> grid.bin, grid.json, slope_hazard.png")
    build.add_argument("--dem", type=Path, required=True)
    build.add_argument("--out", type=Path, required=True)
    build.add_argument("--bounds", type=_bounds, default=JEZERO_AOI, help="west,south,east,north")
    build.add_argument("--max-slope", type=float, default=MAX_SAFE_SLOPE_DEG)
    layers = sub.add_parser("layers", help="names, traverses, landing sites, zones -> GeoJSON")
    layers.add_argument("--raw", type=Path, required=True)
    layers.add_argument("--curated", type=Path, required=True)
    layers.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)

    {"build": _build, "layers": _layers}[args.command](args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
