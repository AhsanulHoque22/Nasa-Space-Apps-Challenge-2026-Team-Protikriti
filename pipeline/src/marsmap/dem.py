"""Load, crop and write Mars elevation rasters."""

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import rasterio
from numpy.typing import NDArray
from rasterio.transform import Affine
from rasterio.warp import transform_bounds
from rasterio.windows import Window, from_bounds

MARS_RADIUS_M = 3_396_190.0  # Mars 2000 sphere (IAU), used by USGS Mars products
MARS_LONLAT = f"+proj=longlat +R={MARS_RADIUS_M:.0f} +no_defs"
COG_MAX_Z_ERROR_M = 0.1  # lossy LERC tolerance; well below CTX DEM vertical precision


@dataclass(frozen=True)
class Dem:
    elevation_m: NDArray[np.float32]
    pixel_size_m: float
    transform: Affine
    crs: str


def load_dem(path: Path, bounds_lonlat: tuple[float, float, float, float]) -> Dem:
    """Crop a square-pixel DEM to (west, south, east, north) in Mars degrees. Nodata -> NaN."""
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
        elevation = src.read(1, window=window, masked=True).filled(np.nan).astype(np.float32)
        return Dem(
            elevation_m=elevation,
            pixel_size_m=float(res_x),
            transform=src.window_transform(window),
            crs=src.crs.to_proj4(),
        )


def write_cog(dem: Dem, path: Path) -> None:
    """Write a Cloud-Optimized GeoTIFF with LERC+ZSTD compression."""
    height, width = dem.elevation_m.shape
    with rasterio.open(
        path,
        "w",
        driver="COG",
        width=width,
        height=height,
        count=1,
        dtype="float32",
        crs=dem.crs,
        transform=dem.transform,
        nodata=np.nan,
        compress="LERC_ZSTD",
        max_z_error=COG_MAX_Z_ERROR_M,
    ) as dst:
        dst.write(dem.elevation_m, 1)


def _windows_overlap(a: Window, b: Window) -> bool:
    return bool(
        a.col_off < b.col_off + b.width
        and b.col_off < a.col_off + a.width
        and a.row_off < b.row_off + b.height
        and b.row_off < a.row_off + a.height
    )
