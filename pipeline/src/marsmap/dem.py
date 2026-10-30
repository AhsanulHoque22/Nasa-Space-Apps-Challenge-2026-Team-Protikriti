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
# HiRISE DTEEC failed stereo is 0.0 or a denormal such as 3.5e-43; no real ground in these DTMs
# is within a micrometre of the datum.
FAILED_STEREO_M = 1e-6


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
    zero_is_nodata: bool = False,
) -> Dem:
    """Crop a square-pixel DEM to (west, south, east, north) in Mars degrees. Nodata -> NaN.

    With target_pixel_m coarser than the source, reads a decimated grid (GDAL uses the file's
    overviews, so a remote multi-GB mosaic costs only a few MB). Never upsamples.

    zero_is_nodata: HiRISE DTEEC DTMs also write 0.0 where stereo matching failed. Those files
    are read at full resolution, zeros masked, and each coarse cell averaged only when every
    source pixel in it is valid, so failed stereo never blends into real ground (it had made
    walls km high along the strip edges).
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
        if zero_is_nodata:
            full_res = src.read(1, window=window, masked=True).filled(np.nan).astype(np.float32)
            full_res[np.abs(full_res) < FAILED_STEREO_M] = np.nan
            elevation = _block_mean_all_valid(full_res, factor)
            shape = elevation.shape
            window = Window(window.col_off, window.row_off, shape[1] * factor, shape[0] * factor)
        else:
            elevation = (
                src.read(
                    1, window=window, out_shape=shape, masked=True, resampling=Resampling.average
                )
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


def _block_mean_all_valid(elevation: NDArray[np.float32], factor: int) -> NDArray[np.float32]:
    """Mean of each factor x factor block; NaN if any pixel in the block is NaN.

    Rows and columns past the last whole block are dropped.
    """
    rows, cols = (elevation.shape[0] // factor, elevation.shape[1] // factor)
    blocks = elevation[: rows * factor, : cols * factor].reshape(rows, factor, cols, factor)
    return blocks.mean(axis=(1, 3)).astype(np.float32)  # any NaN in a block makes it NaN


def _windows_overlap(a: Window, b: Window) -> bool:
    return bool(
        a.col_off < b.col_off + b.width
        and b.col_off < a.col_off + a.width
        and a.row_off < b.row_off + b.height
        and b.row_off < a.row_off + a.height
    )
