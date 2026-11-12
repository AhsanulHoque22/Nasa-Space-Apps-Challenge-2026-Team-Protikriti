"""Write pipeline outputs in the formats the web app loads."""

import json
import math
import warnings
from pathlib import Path
from typing import Any

import numpy as np
import rasterio
from numpy.typing import NDArray
from rasterio.errors import NotGeoreferencedWarning
from rasterio.transform import array_bounds
from rasterio.warp import transform_bounds

from marsmap.dem import MARS_LONLAT, Dem

HAZARD_RGB = (230, 60, 30)  # red-orange hazard tint
HAZARD_ALPHA_STRONG, HAZARD_ALPHA_WEAK = 200, 90  # alternating diagonal stripes
STRIPE_PERIOD_PX = 6  # hatching makes hazards readable without relying on colour alone
# grid.bin is int16 steps above an offset: half the bytes of float32 and far better compression,
# which matters because the web app downloads every site grid at start.
MIN_HEIGHT_STEP_M = 0.02  # as the walk patches; max error 1 cm, within the 0.1 m DEM budget
GRID_NODATA = -32768
GRID_MAX_STEPS = 32766


def encode_grid(elevation_m: NDArray[np.floating]) -> tuple[NDArray[np.int16], float, float]:
    """Heights as int16 steps around the mid-range: (steps, offset_m, step_m), NaN -> nodata.

    The step is the smallest whole centimetre (at least 2 cm) that fits the relief, so tall
    sites such as Gale crater still fit.
    """
    finite = elevation_m[np.isfinite(elevation_m)]
    if finite.size == 0:
        raise ValueError("the DEM has no data: nothing to export")
    lo, hi = float(finite.min()), float(finite.max())
    offset = round((lo + hi) / 2, 2)
    reach = max(hi - offset, offset - lo)
    step = max(MIN_HEIGHT_STEP_M, round(math.ceil(reach / GRID_MAX_STEPS / 0.01) * 0.01, 2))
    steps = np.round((elevation_m - offset) / step)
    out = np.where(np.isfinite(steps), steps, GRID_NODATA).astype("<i2")
    return out, offset, step


def read_grid(grid_dir: Path) -> tuple[dict[str, Any], NDArray[np.float32]]:
    """grid.json and the decoded grid.bin heights (height x width, metres, NaN = nodata)."""
    meta: dict[str, Any] = json.loads((grid_dir / "grid.json").read_text())
    width, height = int(meta["width"]), int(meta["height"])
    steps = np.fromfile(grid_dir / "grid.bin", dtype="<i2")
    if steps.size != width * height:
        raise ValueError(f"{grid_dir}/grid.bin has {steps.size} cells, expected {width * height}")
    elevation = meta["height_offset_m"] + steps.astype(np.float32) * meta["height_step_m"]
    elevation[steps == meta["nodata"]] = np.nan
    return meta, elevation.astype(np.float32).reshape(height, width)


def export_grid(dem: Dem, out_dir: Path, max_safe_slope_deg: float) -> None:
    """Write grid.bin (int16 LE steps, row-major, north-up; see encode_grid) and grid.json."""
    steps, offset_m, step_m = encode_grid(dem.elevation_m)
    out_dir.mkdir(parents=True, exist_ok=True)
    steps.tofile(out_dir / "grid.bin")
    height, width = dem.elevation_m.shape
    projected = array_bounds(height, width, dem.transform)
    west, south, east, north = transform_bounds(dem.crs, MARS_LONLAT, *projected)
    meta = {
        "width": width,
        "height": height,
        "pixel_size_m": dem.pixel_size_m,
        "west": west,
        "north": north,
        "east": east,
        "south": south,
        "crs": dem.crs,
        "max_safe_slope_deg": max_safe_slope_deg,
        "height_offset_m": offset_m,
        "height_step_m": step_m,
        "nodata": GRID_NODATA,
    }
    (out_dir / "grid.json").write_text(json.dumps(meta, indent=2))


def export_slope_overlay(
    slope_deg: NDArray[np.float32], out_path: Path, max_safe_slope_deg: float
) -> None:
    """RGBA PNG: transparent where safe or nodata; hatched hazard tint where too steep."""
    height, width = slope_deg.shape
    hazard = slope_deg > max_safe_slope_deg  # NaN compares False -> transparent (not red)
    rows, cols = np.indices((height, width))
    stripe = ((rows + cols) // (STRIPE_PERIOD_PX // 2)) % 2 == 0
    alpha = np.where(stripe, HAZARD_ALPHA_STRONG, HAZARD_ALPHA_WEAK) * hazard
    rgba = np.zeros((4, height, width), dtype=np.uint8)
    rgba[:3][:, hazard] = np.array(HAZARD_RGB, dtype=np.uint8)[:, None]
    rgba[3] = alpha.astype(np.uint8)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    # The PNG is placed on the map by grid.json bounds, so no geotransform is intended.
    with (
        warnings.catch_warnings(category=NotGeoreferencedWarning, action="ignore"),
        rasterio.open(
            out_path, "w", driver="PNG", width=width, height=height, count=4, dtype="uint8"
        ) as dst,
    ):
        dst.write(rgba)
