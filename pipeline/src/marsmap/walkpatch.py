"""Walk patch: high-resolution ground for exploring a site on foot.

A small square around each site's walk start gets a HiRISE stereo DEM resampled to 2 m (the
walker's terrain and footing) and the 25 cm HiRISE orthomosaic cut into Cesium geographic tiles,
so the ground near the eye is real data served with the app instead of a 20 m model and slow,
remote tiles. Sources are read by range requests (GDAL /vsicurl/, /vsizip/).
"""

import json
import math
from pathlib import Path
from typing import Any

import numpy as np
import rasterio
from numpy.typing import NDArray
from rasterio.enums import Resampling
from rasterio.warp import transform_bounds
from rasterio.windows import from_bounds

from marsmap.compare import MARS_RADIUS_KM, box_deg, write_jpeg
from marsmap.dem import MARS_LONLAT
from marsmap.enhance import enhance_orthomosaic

DEM_SPACING_M = 2.0  # HiRISE stereo DEMs resolve ~3x their 1 m posts; 2 m keeps that detail
HEIGHT_STEP_M = 0.02  # int16 quantisation: +/-655 m around the patch median, 2 cm steps
NODATA_I16 = -32768
TILE_PX = 256
MAX_SAFE_SLOPE_DEG = 15.0  # the route planner's walking limit, for slope warnings on foot
TILE_JPEG_QUALITY = 90  # above the usual 85: fine ground texture is the point of these tiles
STRETCH_PCT = (0.5, 99.5)  # contrast stretch of the orthomosaic, ignoring 0 (no data)
M_PER_DEG = MARS_RADIUS_KM * 1000 * math.pi / 180

Box = tuple[float, float, float, float]  # west, south, east, north (degrees)


def tile_range(box: Box, level: int) -> tuple[int, int, int, int]:
    """x0, x1, y0, y1 (inclusive) of Cesium geographic tiles covering box; y counts from north."""
    deg = 180 / 2**level
    west, south, east, north = box
    return (
        math.floor((west + 180) / deg),
        math.floor((east + 180) / deg),
        math.floor((90 - north) / deg),
        math.floor((90 - south) / deg),
    )


def tile_box(x: int, y: int, level: int) -> Box:
    deg = 180 / 2**level
    west, north = -180 + x * deg, 90 - y * deg
    return (west, north - deg, west + deg, north)


def read_lonlat(
    path: str, box: Box, shape: tuple[int, int], resampling: Resampling
) -> NDArray[np.float32]:
    """Band 1 over a lon/lat box, resampled to shape (rows, cols); nodata becomes NaN.

    The sources are equirectangular (lat_ts 0) on the Mars sphere, so a lon/lat box is an
    axis-aligned pixel window and no warping is needed.
    """
    with (
        rasterio.Env(
            GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR",
            CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif,.zip",
            GDAL_HTTP_MAX_RETRY="4",
            GDAL_HTTP_RETRY_DELAY="2",
        ),
        rasterio.open(path) as src,
    ):
        window = from_bounds(*transform_bounds(MARS_LONLAT, src.crs, *box), transform=src.transform)
        data = src.read(
            1, window=window, out_shape=shape, resampling=resampling, masked=True, boundless=True
        )
        return np.ma.filled(data.astype(np.float32), np.nan)


def _dem(walk: dict[str, Any], box: Box) -> tuple[NDArray[np.float32], dict[str, Any]]:
    west, south, east, north = box
    lat = (south + north) / 2
    rows = round((north - south) * M_PER_DEG / DEM_SPACING_M)
    cols = round((east - west) * M_PER_DEG * math.cos(math.radians(lat)) / DEM_SPACING_M)
    dem = read_lonlat(walk["dem"], box, (rows, cols), Resampling.average)
    return dem, {"width": cols, "height": rows}


def _encode(dem: NDArray[np.float32]) -> tuple[NDArray[np.int16], float]:
    finite = dem[np.isfinite(dem)]
    if finite.size == 0:
        raise ValueError("walk patch: the DEM has no data over the patch")
    offset = float(np.round(np.median(finite), 2))
    steps = np.round((dem - offset) / HEIGHT_STEP_M)
    if np.nanmax(np.abs(steps)) >= 32767:
        raise ValueError("walk patch: relief exceeds the int16 range; raise HEIGHT_STEP_M")
    out = np.where(np.isfinite(steps), steps, NODATA_I16).astype("<i2")
    return out, offset


def _tiles(walk: dict[str, Any], box: Box, out: Path) -> None:
    """Cut the orthomosaic into tiles for every level, reading the source only once.

    The finest level is read over its whole tile extent; each coarser tile is the average of the
    2^k x 2^k finest tiles under it (geographic quadtree tiles nest exactly). Parts outside the
    read extent are 0 (no data); Cesium only draws the provider's rectangle anyway.
    """
    levels: list[int] = sorted(walk["levels"])
    top = levels[-1]
    x0, x1, y0, y1 = tile_range(box, top)
    west, _, _, north = tile_box(x0, y0, top)
    _, south, east, _ = tile_box(x1, y1, top)
    shape = ((y1 - y0 + 1) * TILE_PX, (x1 - x0 + 1) * TILE_PX)
    img = read_lonlat(walk["ortho"], (west, south, east, north), shape, Resampling.average)
    covered = np.isfinite(img) & (img > 0)
    lo, hi = np.percentile(img[covered], STRETCH_PCT) if covered.any() else (0.0, 255.0)
    stretched = np.clip((np.nan_to_num(img, nan=0.0) - lo) / max(hi - lo, 1) * 255, 0, 255)
    del img
    # Valid pixels are at least 1 so that 0 can mean "no data"; the enhancer keeps that promise.
    grey = np.where(covered, np.maximum(np.round(stretched), 1), 0).astype(np.uint8)
    del stretched
    finest = enhance_orthomosaic(grey).astype(np.float32)
    del grey
    for level in levels:
        k = 2 ** (top - level)
        tx0, tx1, ty0, ty1 = tile_range(box, level)
        for tx in range(tx0, tx1 + 1):
            for ty in range(ty0, ty1 + 1):
                # This tile's pixels in the finest mosaic, padded with 0 outside it.
                px0, py0 = (tx * k - x0) * TILE_PX, (ty * k - y0) * TILE_PX
                span = k * TILE_PX
                block = np.zeros((span, span), dtype=np.float32)
                sx0, sy0 = max(px0, 0), max(py0, 0)
                sx1 = min(px0 + span, finest.shape[1])
                sy1 = min(py0 + span, finest.shape[0])
                if sx1 > sx0 and sy1 > sy0:
                    block[sy0 - py0 : sy1 - py0, sx0 - px0 : sx1 - px0] = finest[sy0:sy1, sx0:sx1]
                tile = block.reshape(TILE_PX, k, TILE_PX, k).mean(axis=(1, 3))
                grey = np.round(tile).astype(np.uint8)
                path = out / "tiles" / str(level) / str(tx) / f"{ty}.jpg"
                path.parent.mkdir(parents=True, exist_ok=True)
                write_jpeg(path, grey[None, :, :], TILE_JPEG_QUALITY)


def build_walk_patch(
    site_id: str, walk: dict[str, Any], out_dir: Path, tiles_only: bool = False
) -> dict[str, Any]:
    """Write walk/<site>/dem.bin (int16 LE, north-up), walk.json and tiles/{z}/{x}/{y}.jpg.

    tiles_only redraws just the imagery tiles and returns the walk.json already there.
    """
    box = box_deg(walk["lon"], walk["lat"], walk["km"], MARS_RADIUS_KM)
    out = out_dir / "walk" / site_id
    out.mkdir(parents=True, exist_ok=True)
    if tiles_only:
        _tiles(walk, box, out)
        existing: dict[str, Any] = json.loads((out / "walk.json").read_text())
        return existing
    dem, size = _dem(walk, box)
    encoded, offset = _encode(dem)
    encoded.tofile(out / "dem.bin")
    _tiles(walk, box, out)
    meta: dict[str, Any] = {
        **size,
        "west": box[0],
        "south": box[1],
        "east": box[2],
        "north": box[3],
        "start": {"lon": walk["lon"], "lat": walk["lat"]},
        "spacingM": DEM_SPACING_M,
        "heightOffsetM": offset,
        "heightStepM": HEIGHT_STEP_M,
        "nodata": NODATA_I16,
        "maxSafeSlopeDeg": MAX_SAFE_SLOPE_DEG,
        "tiles": {
            "minLevel": min(walk["levels"]),
            "maxLevel": max(walk["levels"]),
            "rect": list(box),
        },
        "source": walk["source"],
    }
    (out / "walk.json").write_text(json.dumps(meta, indent=1))
    return meta
