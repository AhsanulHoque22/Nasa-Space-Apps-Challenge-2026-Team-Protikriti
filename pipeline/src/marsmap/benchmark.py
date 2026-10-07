"""Replay benchmark: check the planner's terrain rule against what Perseverance really did."""

import json
import math
from collections.abc import Sequence
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import numpy as np
from numpy.typing import NDArray

from marsmap.slope import slope_deg

LonLat = tuple[float, float]


@dataclass(frozen=True)
class GridGeo:
    """Lon/lat bounds of a north-up equirectangular grid, as in grid.json."""

    west: float
    north: float
    east: float
    south: float


@dataclass(frozen=True)
class BenchmarkResult:
    limit_deg: float
    # Every real drive leg: the planner allows it (all ground within the limit) or blocks it.
    legs_total: int
    legs_outside_grid: int
    legs_allowed: int
    legs_blocked: int
    # Waypoints with a measured rover tilt, on mapped ground.
    waypoints_in_grid: int
    steep_waypoints: int  # rover tilt above the limit
    steep_missed: int  # ... where the map shows ground within the limit: a false pass
    false_pass_rate_pct: float | None  # None when no steep waypoint was mapped
    correlation: float | None  # map slope vs rover tilt (Pearson r); None if undefined


def cell_of(geo: GridGeo, shape: tuple[int, int], lon: float, lat: float) -> tuple[int, int] | None:
    """(row, col) of the cell holding lon/lat; same mapping as the web app's lonLatToCell."""
    if not (math.isfinite(lon) and math.isfinite(lat)):
        return None
    height, width = shape
    col = math.floor((lon - geo.west) / (geo.east - geo.west) * width)
    row = math.floor((geo.north - lat) / (geo.north - geo.south) * height)
    return (row, col) if 0 <= row < height and 0 <= col < width else None


def replay(
    slope: NDArray[np.floating[Any]],
    geo: GridGeo,
    legs: Sequence[Sequence[LonLat]],
    waypoints: Sequence[tuple[float, float, float]],
    limit_deg: float,
) -> BenchmarkResult:
    """Judge real drive legs and measured tilts against the slope map.

    A leg is blocked when any mapped point on it is steeper than the limit or has no data,
    the rule the router applies. Legs and waypoints off the map are not judged.
    """
    shape = (slope.shape[0], slope.shape[1])
    outside = allowed = blocked = 0
    for leg in legs:
        cells = [c for lon, lat in leg if (c := cell_of(geo, shape, lon, lat)) is not None]
        if not cells:
            outside += 1
        elif all(slope[c] <= limit_deg for c in cells):  # NaN compares False -> blocked
            allowed += 1
        else:
            blocked += 1

    map_slopes: list[float] = []
    tilts: list[float] = []
    for lon, lat, tilt in waypoints:
        cell = cell_of(geo, shape, lon, lat)
        if cell is not None and not math.isnan(float(slope[cell])):
            map_slopes.append(float(slope[cell]))
            tilts.append(tilt)
    steep = [s for s, t in zip(map_slopes, tilts, strict=True) if t > limit_deg]
    missed = sum(1 for s in steep if s <= limit_deg)
    correlated = len(tilts) >= 2 and np.std(map_slopes) > 0 and np.std(tilts) > 0
    return BenchmarkResult(
        limit_deg=limit_deg,
        legs_total=len(legs),
        legs_outside_grid=outside,
        legs_allowed=allowed,
        legs_blocked=blocked,
        waypoints_in_grid=len(tilts),
        steep_waypoints=len(steep),
        steep_missed=missed,
        false_pass_rate_pct=round(100 * missed / len(steep), 1) if steep else None,
        correlation=round(float(np.corrcoef(map_slopes, tilts)[0, 1]), 3) if correlated else None,
    )


def run_benchmark(traverse: Path, waypoints: Path, grid_dir: Path) -> dict[str, Any]:
    """Replay the real Perseverance path over a site grid written by the `sites` command."""
    meta = json.loads((grid_dir / "grid.json").read_text())
    width, height = int(meta["width"]), int(meta["height"])
    elevation = np.fromfile(grid_dir / "grid.bin", dtype="<f4")
    if elevation.size != width * height:
        raise ValueError(
            f"{grid_dir}/grid.bin has {elevation.size} cells, expected {width * height}"
        )
    slope = slope_deg(elevation.reshape(height, width), float(meta["pixel_size_m"]))
    geo = GridGeo(meta["west"], meta["north"], meta["east"], meta["south"])

    # Coordinates are Mars lon/lat although the file is tagged CRS84; only the numbers are used.
    legs = [
        [(c[0], c[1]) for c in f["geometry"]["coordinates"]]
        for f in json.loads(traverse.read_text())["features"]
    ]
    tilts = [
        (p["lon"], p["lat"], p["tilt"])
        for f in json.loads(waypoints.read_text())["features"]
        if (p := f["properties"]).get("tilt") is not None
    ]
    result = replay(slope, geo, legs, tilts, float(meta["max_safe_slope_deg"]))
    return {
        "result": asdict(result),
        "source": {
            "traverse": "Perseverance traverse, NASA MMGIS / PDS PLACES (M20_traverse.json)",
            "tilt": "Rover tilt at each localized waypoint (M20_waypoints.json)",
            "terrain": f"CTX DEM grid, {meta['pixel_size_m']:g} m pixels",
        },
    }
