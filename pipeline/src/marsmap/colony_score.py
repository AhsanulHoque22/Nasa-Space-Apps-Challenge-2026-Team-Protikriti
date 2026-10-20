"""6-channel global colony suitability grid (180x360, 1 deg/cell, uint8 0-100, nodata=255).

Channels (in order):
  0 solar       - mean annual surface insolation (Appelbaum & Flood 1990)
  1 ice         - subsurface water ice (SWIM 2.0, Morgan et al. 2021)
  2 minerals    - mineralogical suitability (OMEGA global map, Bibring et al. 2006)
  3 shelter     - proximity to candidate lava-tube cave entrances (MGC3)
  4 stability   - terrain stability proxy from MOLA roughness (MEGDR)
  5 wind        - wind power potential (IDW from REMS/Viking, Tillman et al. 1994)
"""

import json
import math
from pathlib import Path
from typing import Any

import numpy as np
from numpy.typing import NDArray

from marsmap.solar_power import INSOLATION_MAX_KWH, mean_annual_insolation_kwh
from marsmap.wind_stats import wind_score_grid

GRID_ROWS = 180
GRID_COLS = 360
N_CHANNELS = 6  # solar, ice, minerals, shelter, stability, wind
NODATA = 255

CH_SOLAR, CH_ICE, CH_MINERALS, CH_SHELTER, CH_STABILITY, CH_WIND = range(6)

_R_KM = 3396.19  # Mars sphere radius (IAU)


def _dist_km(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    r = math.pi / 180.0
    a = (
        math.sin((lat2 - lat1) * r / 2) ** 2
        + math.cos(lat1 * r) * math.cos(lat2 * r) * math.sin((lon2 - lon1) * r / 2) ** 2
    )
    return 2 * _R_KM * math.asin(min(1.0, math.sqrt(a)))


def solar_score_grid(mean_tau_ir: float = 0.5) -> NDArray[np.uint8]:
    """Mean annual solar insolation normalised to 0-100 per 1 degree cell."""
    out = np.zeros((GRID_ROWS, GRID_COLS), dtype=np.uint8)
    for row in range(GRID_ROWS):
        lat = 89.5 - row
        kwh = mean_annual_insolation_kwh(lat, mean_tau_ir)
        score = int(min(100, round(kwh / INSOLATION_MAX_KWH * 100)))
        out[row, :] = score  # solar score does not vary with longitude
    return out


def ice_score_grid(swim_path: Path) -> NDArray[np.uint8]:
    """SWIM 2.0 water-ice consistency mapped to 0-100; 255=nodata outside +-60 deg."""
    # swim.bin: int8, 1440x480 (1/4 deg/cell), covers lat -60 to +60 deg
    raw = np.frombuffer(swim_path.read_bytes(), dtype=np.int8).reshape(480, 1440)
    swim_nodata: int = -128
    out = np.full((GRID_ROWS, GRID_COLS), NODATA, dtype=np.uint8)
    # Rows 30..149 of the 1 deg grid correspond to lat 59.5 to -59.5 (SWIM coverage)
    for row_1deg in range(30, 150):
        lat = 89.5 - row_1deg
        # SWIM row 0 = 59.875 N, row 479 = -59.875 N; 480 rows at 1/4 deg = 120 deg
        swim_row0 = round((59.875 - lat) / 0.25)
        for col_1deg in range(GRID_COLS):
            swim_col0 = col_1deg * 4  # 4 SWIM cols per 1 deg longitude cell
            block = raw[
                max(0, swim_row0 - 1) : min(480, swim_row0 + 3),
                swim_col0 : min(1440, swim_col0 + 4),
            ]
            valid = block[block != swim_nodata]
            if valid.size == 0:
                out[row_1deg, col_1deg] = NODATA
            else:
                # int8 value is consistency * 100 (range -100 to +100); map to 0..100
                mean_val = float(valid.mean())
                out[row_1deg, col_1deg] = int(min(100, round((mean_val + 100) / 2)))
    return out


def minerals_score_grid() -> NDArray[np.uint8]:
    """Approximate mineralogical suitability from OMEGA global map (Bibring et al. 2006).

    Three static zones (labeled approximate in metadata):
      Jezero region      -> 90  (perchlorate-rich, hydrated minerals, ISRU value)
      Noachian terrain   -> 70  (phyllosilicates, ancient mineralogy)
      Everything else    -> 40  (basaltic, lower ISRU value)
    """
    # ponytail: static zones, not a pixel-level OMEGA map; add CRISM/OMEGA GeoTIFF if needed
    out = np.full((GRID_ROWS, GRID_COLS), 40, dtype=np.uint8)
    for row in range(GRID_ROWS):
        lat = 89.5 - row
        for col in range(GRID_COLS):
            lon = -179.5 + col
            # Jezero (lon 77E +-5 deg, lat 18N +-3 deg)
            if 72 <= lon <= 82 and 15 <= lat <= 21:
                out[row, col] = 90
            # Noachian terrain (lat 30-70 S, lon 0-60 E - Terra Noachis / Hellas region)
            elif -70 <= lat <= -30 and 0 <= lon <= 60:
                out[row, col] = 70
    return out


def shelter_score_grid(caves: list[dict[str, Any]]) -> NDArray[np.uint8]:
    """Proximity to MGC3 cave candidates: score = 100 * exp(-dist_km / 200).

    Priority 0/1 caves count as twice as close (effective dist halved).
    """
    c_lon = np.array([c["lon"] for c in caves], dtype=np.float64)
    c_lat = np.array([c["lat"] for c in caves], dtype=np.float64)
    c_pri = np.array([c.get("priority", 2) for c in caves], dtype=np.int32)

    out = np.zeros((GRID_ROWS, GRID_COLS), dtype=np.uint8)
    r = math.pi / 180.0
    c_lon_r = c_lon * r
    c_lat_r = c_lat * r
    for row in range(GRID_ROWS):
        lat = 89.5 - row
        lat_r = lat * r
        for col in range(GRID_COLS):
            lon = -179.5 + col
            lon_r = lon * r
            a = (
                np.sin((c_lat_r - lat_r) / 2) ** 2
                + math.cos(lat_r) * np.cos(c_lat_r) * np.sin((c_lon_r - lon_r) / 2) ** 2
            )
            dists = 2 * _R_KM * np.arcsin(np.minimum(1.0, np.sqrt(a)))
            # Priority 0/1: halve effective distance (cave is more significant)
            dists = np.where(c_pri <= 1, dists * 0.5, dists)
            min_dist = float(dists.min())
            out[row, col] = int(min(100, round(100 * math.exp(-min_dist / 200.0))))
    return out


def stability_score_grid(mola_path: Path) -> NDArray[np.uint8]:
    """Terrain stability from MOLA roughness: score = clamp(100 - roughness * 5, 0, 100).

    Reads mola.bin (int16, 1440x720, 4 px/deg). Coarsens to 1 deg/cell.
    Roughness = elevation std within each 1 deg cell (proxy for terrain complexity).
    |lat| > 80 deg: NODATA (polar caps unreliable).
    """
    raw = np.frombuffer(mola_path.read_bytes(), dtype="<i2").reshape(720, 1440)
    # Coarsen 1440x720 (4px/deg) to 360x180 (1px/deg) by averaging 4x4 blocks
    blocks = raw.reshape(180, 4, 360, 4)
    elev_std = blocks.std(axis=(1, 3))  # std over 4x4 block -> (180, 360)
    # Typical flat terrain: std ~10-50 m; rough: >200 m
    # Score = clamp(100 - std / 5, 0, 100)  (200 m std -> score 60, >500 m -> 0)
    scores = np.clip(100 - elev_std / 5.0, 0, 100).round().astype(np.uint8)
    # Polar caps (|lat| > 80 deg): rows 0-9 and 170-179
    nodata_val = np.uint8(NODATA)
    scores[:10, :] = nodata_val
    scores[170:, :] = nodata_val
    return scores


def _load_caves(caves_path: Path) -> list[dict[str, Any]]:
    """Load caves.json array format -> list of {lon, lat, priority} dicts."""
    data = json.loads(caves_path.read_text())
    fields: list[str] = data["fields"]  # ['id','lon','lat','type','priority',...]
    i_lon = fields.index("lon")
    i_lat = fields.index("lat")
    i_pri = fields.index("priority")
    return [
        {"lon": row[i_lon], "lat": row[i_lat], "priority": int(row[i_pri])}
        for row in data["caves"]
    ]


def build_colony_score(raw_dir: Path, data_dir: Path, out_dir: Path) -> None:
    """Build 6-channel colony suitability grid and write bin + JSON metadata.

    Args:
        raw_dir:  Path to data/raw/ (reserved for future raw-file reads).
        data_dir: Path to web/public/data/ (contains swim.bin, mola.bin, caves.json).
        out_dir:  Output directory for colony_score.bin + colony_score.json.
    """
    _ = raw_dir  # reserved; all inputs come from data_dir
    swim_path = data_dir / "swim.bin"
    mola_path = data_dir / "mola.bin"
    caves_path = data_dir / "caves.json"

    caves = _load_caves(caves_path)

    solar = solar_score_grid(mean_tau_ir=0.5)
    ice = ice_score_grid(swim_path)
    minerals = minerals_score_grid()
    shelter = shelter_score_grid(caves)
    stability = stability_score_grid(mola_path)
    wind = wind_score_grid()

    grid = np.stack([solar, ice, minerals, shelter, stability, wind], axis=-1)
    assert grid.shape == (GRID_ROWS, GRID_COLS, N_CHANNELS)

    out_dir.mkdir(parents=True, exist_ok=True)
    grid.tofile(out_dir / "colony_score.bin")

    meta: dict[str, Any] = {
        "rows": GRID_ROWS,
        "cols": GRID_COLS,
        "channels": N_CHANNELS,
        "north": 90.0,
        "south": -90.0,
        "west": -180.0,
        "east": 180.0,
        "nodata": NODATA,
        "channel_names": ["solar", "ice", "minerals", "shelter", "stability", "wind"],
        "channel_sources": [
            "Appelbaum & Flood 1990 Mars irradiance model (NASA TM-102299)",
            "SWIM 2.0 combined ice consistency 0-1m (Morgan et al. 2021; swim.psi.edu)",
            "Approximate zones from OMEGA global mineralogy map (Bibring et al. 2006)",
            (
                "MGC3 Mars Global Cave Catalog 1062 candidates"
                " (Cushing 2012; doi:10.1029/2012JE004111)"
            ),
            "MOLA MEGDR terrain roughness (Smith et al. 2001; NASA PDS Geosciences Node)",
            "IDW from REMS (Gale) and Viking Lander 1/2 surface measurements",
        ],
        "caveat": (
            "Colony scores are a planning aid."
            " All channels require ground-truth validation."
        ),
    }
    (out_dir / "colony_score.json").write_text(json.dumps(meta, separators=(",", ":")))
