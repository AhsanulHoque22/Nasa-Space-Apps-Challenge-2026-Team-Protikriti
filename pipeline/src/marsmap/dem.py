"""Load, crop and write Mars elevation rasters."""

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import rasterio
from numpy.typing import NDArray
from rasterio.enums import Resampling
from rasterio.transform import Affine
from rasterio.warp import transform_bounds
from rasterio.windows import Window, from_bounds

MARS_RADIUS_M = 3_396_190.0  # Mars 2000 sphere (IAU), used by USGS Mars products
MARS_LONLAT = f"+proj=longlat +R={MARS_RADIUS_M:.0f} +no_defs"


@dataclass(frozen=True)
class Dem:
    elevation_m: NDArray[np.float32]
    pixel_size_m: float
    transform: Affine
    crs: str


def load_dem(
    path: Path | str,
    bounds_lonlat: tuple[float, float, float, float],
    target_pixel_m: float | None = None,
) -> Dem:
    """Crop a square-pixel DEM to (west, south, east, north) in Mars degrees. Nodata -> NaN.

    With target_pixel_m coarser than the source, reads a decimated grid (GDAL uses the file's
    overviews, so a remote multi-GB mosaic costs only a few MB). Never upsamples.
    """
    with rasterio.open(path) as src:
        res_x, res_y = src.res
        if res_x != res_y:
            raise ValueError(f"DEM pixels must be square, got {src.res}")
        projected = transform_bounds(MARS_LONLAT, src.crs, *bounds_lonlat)
        window = from_bounds(*projected, transform=src.transform).round_offsets().round_lengths()
        full = Window(0, 0, src.width, src.height)
        if not _windows_overlap(window, full):
            raise ValueError(f"AOI {bounds_lonlat} is outside the DEM extent")
        window = window.intersection(full)
        factor = max(1, round((target_pixel_m or res_x) / res_x))
        shape = (max(1, round(window.height / factor)), max(1, round(window.width / factor)))
        elevation = (
            src.read(1, window=window, out_shape=shape, masked=True, resampling=Resampling.average)
            .filled(np.nan)
            .astype(np.float32)
        )
        transform = src.window_transform(window) @ Affine.scale(
            window.width / shape[1], window.height / shape[0]
        )
        return Dem(
            elevation_m=elevation,
            pixel_size_m=float(res_x * factor),
            transform=transform,
            crs=src.crs.to_proj4(),
        )


def _windows_overlap(a: Window, b: Window) -> bool:
    return bool(
        a.col_off < b.col_off + b.width
        and b.col_off < a.col_off + a.width
        and a.row_off < b.row_off + b.height
        and b.row_off < a.row_off + a.height
    )
