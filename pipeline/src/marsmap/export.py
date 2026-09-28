"""Write pipeline outputs in the formats the web app loads."""

import json
import warnings
from pathlib import Path

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


def export_grid(dem: Dem, out_dir: Path, max_safe_slope_deg: float) -> None:
    """Write grid.bin (float32 LE, row-major, north-up, NaN = nodata) and grid.json."""
    out_dir.mkdir(parents=True, exist_ok=True)
    dem.elevation_m.astype("<f4").tofile(out_dir / "grid.bin")
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
    }
    (out_dir / "grid.json").write_text(json.dumps(meta, indent=2))


def export_slope_overlay(
    slope_deg: NDArray[np.float32], out_path: Path, max_safe_slope_deg: float
) -> None:
    """RGBA PNG: transparent where safe; hatched hazard tint where too steep or nodata."""
    height, width = slope_deg.shape
    hazard = ~(slope_deg <= max_safe_slope_deg)  # NaN compares False -> hazard
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
