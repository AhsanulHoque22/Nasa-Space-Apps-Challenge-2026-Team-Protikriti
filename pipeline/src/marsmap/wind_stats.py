"""Surface wind potential from REMS (Gale) and Viking Lander 1/2 anchor measurements.

No download required — these are published constant values from peer-reviewed papers:
  Gale: Gomez-Elvira et al. 2012, Space Sci Rev doi:10.1007/s11214-012-9921-1 (REMS)
  VL1/VL2: Tillman, Landberg & Larsen 1994, J. Geophys. Res. 99, 3240-3250

Wind score is IDW-interpolated from 3 anchor sites; no global model exists for Mars surface.
The UI labels this channel: "Modeled from 3 surface measurement sites; local terrain varies."
"""

import json
import math
from pathlib import Path
from typing import Any

import numpy as np
from numpy.typing import NDArray

# Grid dimensions: 1-degree cells, row 0 = 89.5 N, col 0 = -179.5 E
GRID_ROWS = 180
GRID_COLS = 360

# Published mean and max wind speeds at each measurement site (m/s)
ANCHOR_SITES: list[dict[str, Any]] = [
    {
        "id": "gale",
        "lon": 137.44,
        "lat": -4.59,
        "mean_ms": 4.0,
        "max_ms": 22.0,
        "source": "REMS Gale (Curiosity), Gomez-Elvira et al. 2012; sensor failed sol 1491",
    },
    {
        "id": "chryse",
        "lon": 312.10,
        "lat": 22.48,
        "mean_ms": 6.0,
        "max_ms": 35.0,
        "source": "Viking Lander 1 (Chryse), Tillman et al. 1994; 3 Mars years",
    },
    {
        "id": "utopia",
        "lon": 134.30,
        "lat": 47.97,
        "mean_ms": 5.0,
        "max_ms": 30.0,
        "source": "Viking Lander 2 (Utopia), Tillman et al. 1994; 2.5 Mars years",
    },
]

_MARS_MAX_WIND_MS = 35.0  # normalisation ceiling: max recorded surface gust (VL1)
_IDW_POWER = 2.0  # inverse-distance weighting exponent
_MIN_DIST_KM = 1.0  # clamp distance floor to avoid division by zero
_R_KM = 3396.19  # Mars sphere radius (IAU convention)

# Expansion factor so scores near anchors reach close to 100
# VL1 mean 6.0 m/s / 35.0 max * 1.8 * 100 = 30.9; not a very windy planet
_SCORE_SCALE = 1.8


def _dist_km(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    """Great-circle distance on the Mars 2000 sphere (km)."""
    r = math.pi / 180.0
    d_lat = (lat2 - lat1) * r
    d_lon = (lon2 - lon1) * r
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(lat1 * r) * math.cos(lat2 * r) * math.sin(d_lon / 2) ** 2
    )
    return 2 * _R_KM * math.asin(min(1.0, math.sqrt(a)))


def _wind_score(lon: float, lat: float) -> int:
    """IDW-interpolated wind score (0-100) at (lon, lat)."""
    total_weight = 0.0
    total_speed = 0.0
    for site in ANCHOR_SITES:
        dist = max(_MIN_DIST_KM, _dist_km(lon, lat, site["lon"], site["lat"]))
        w = 1.0 / (dist**_IDW_POWER)
        total_weight += w
        total_speed += w * site["mean_ms"]
    idw_speed = total_speed / total_weight if total_weight > 0 else 0.0
    return int(min(100, round(idw_speed / _MARS_MAX_WIND_MS * 100 * _SCORE_SCALE)))


def wind_score_grid() -> NDArray[np.uint8]:
    """Return a (180, 360) uint8 IDW wind score grid (0-100) without writing to disk."""
    grid = np.zeros((GRID_ROWS, GRID_COLS), dtype=np.uint8)
    for row in range(GRID_ROWS):
        lat = 89.5 - row
        for col in range(GRID_COLS):
            lon = -179.5 + col
            grid[row, col] = _wind_score(lon, lat)
    return grid


def build_wind(out_path: Path) -> dict[str, Any]:
    """Build wind.json with anchor metadata and a 180x360 score grid.

    Args:
        out_path: Destination file path for wind.json.

    Returns:
        The dict that was serialised.
    """
    grid: list[list[int]] = []
    for row in range(GRID_ROWS):
        lat = 89.5 - row  # cell centres
        grid_row: list[int] = []
        for col in range(GRID_COLS):
            lon = -179.5 + col
            grid_row.append(_wind_score(lon, lat))
        grid.append(grid_row)

    result: dict[str, Any] = {
        "anchors": ANCHOR_SITES,
        "grid": grid,
        "source": "IDW from REMS (Gale) and Viking Lander 1/2 surface measurements",
        "caveat": (
            "Modeled from 3 surface measurement sites; surface wind varies with local terrain"
        ),
        "grid_north": 90.0,
        "grid_south": -90.0,
        "grid_west": -180.0,
        "grid_east": 180.0,
        "rows": GRID_ROWS,
        "cols": GRID_COLS,
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(result, separators=(",", ":")))
    return result
