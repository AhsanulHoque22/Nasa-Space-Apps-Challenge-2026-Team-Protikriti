"""CLI: python -m marsmap build --dem DEM.tif --out web/public/data"""

import argparse
from collections.abc import Sequence
from pathlib import Path

from marsmap.dem import load_dem
from marsmap.export import export_grid, export_slope_overlay
from marsmap.slope import slope_deg

# Octavia E. Butler landing site + western delta front, Jezero crater (Mars 2000 degrees E/N).
JEZERO_AOI = (77.33, 18.36, 77.53, 18.56)
MAX_SAFE_SLOPE_DEG = 15.0  # conservative EVA walking limit; tune with mission guidance


def _bounds(text: str) -> tuple[float, float, float, float]:
    west, south, east, north = (float(v) for v in text.split(","))
    return west, south, east, north


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="marsmap")
    sub = parser.add_subparsers(dest="command", required=True)
    build = sub.add_parser("build", help="DEM -> grid.bin, grid.json, slope_hazard.png")
    build.add_argument("--dem", type=Path, required=True)
    build.add_argument("--out", type=Path, required=True)
    build.add_argument("--bounds", type=_bounds, default=JEZERO_AOI, help="west,south,east,north")
    build.add_argument("--max-slope", type=float, default=MAX_SAFE_SLOPE_DEG)
    args = parser.parse_args(argv)

    dem = load_dem(args.dem, args.bounds)
    export_grid(dem, args.out, args.max_slope)
    slope = slope_deg(dem.elevation_m, dem.pixel_size_m)
    export_slope_overlay(slope, args.out / "slope_hazard.png", args.max_slope)
    print(f"wrote {args.out}: {dem.elevation_m.shape[1]}x{dem.elevation_m.shape[0]} cells")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
