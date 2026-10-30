"""Fine terrain: each site's 1 m HiRISE DTM cut into Cesium geographic tiles for the 3D view.

Route planning keeps the 5-32 m site grids; these tiles only shape the ground drawn near the
camera. Too big for the repo (about 1 GB), they are served from the laptop CDN beside the
panoramas, and the app falls back to the site grids when the CDN is off.
"""

import json
from pathlib import Path
from typing import Any

import numpy as np
import rasterio
from numpy.typing import NDArray
from rasterio.crs import CRS
from rasterio.enums import Resampling
from rasterio.transform import Affine
from rasterio.transform import from_bounds as transform_from_bounds
from rasterio.warp import reproject, transform_bounds
from rasterio.windows import Window, from_bounds

from marsmap.dem import FAILED_STEREO_M, MARS_LONLAT
from marsmap.walkpatch import HEIGHT_STEP_M, NODATA_I16, Box, encode_heights, tile_box, tile_range

LEVEL = 15  # a level-15 tile is 180 / 2^15 deg, about 326 m north-south
SAMPLES = 326  # per tile edge: about 1 m apart, the DTMs' own post spacing
MARGIN = 0.1  # of a tile, read around it so bilinear samples at the edge have neighbours

__all__ = ["HEIGHT_STEP_M", "LEVEL", "NODATA_I16", "SAMPLES", "build_fine_terrain"]


Source = tuple[NDArray[np.float32], Affine, CRS]


def _read(src: rasterio.DatasetReader, box: Box, zero_is_nodata: bool) -> Source | None:
    """The source pixels over box plus a margin, nodata as NaN, or None with no data there."""
    west, south, east, north = box
    pad = (north - south) * MARGIN
    padded = (west - pad, south - pad, east + pad, north + pad)
    window = from_bounds(*transform_bounds(MARS_LONLAT, src.crs, *padded), src.transform)
    window = window.round_offsets().round_lengths()
    if not (
        window.col_off < src.width
        and window.row_off < src.height
        and window.col_off + window.width > 0
        and window.row_off + window.height > 0
    ):
        return None
    window = window.intersection(Window(0, 0, src.width, src.height))
    pixels = src.read(1, window=window, masked=True).filled(np.nan).astype(np.float32)
    if zero_is_nodata:
        pixels[np.abs(pixels) < FAILED_STEREO_M] = np.nan  # HiRISE DTEEC failed stereo
    if not np.isfinite(pixels).any():
        return None
    return pixels, src.window_transform(window), src.crs


def _tile_heights(source: Source, box: Box) -> NDArray[np.float32] | None:
    """SAMPLES x SAMPLES heights at cell centres over box (north-up), or None with no data."""
    pixels, transform, crs = source
    heights = np.full((SAMPLES, SAMPLES), np.nan, np.float32)
    reproject(
        pixels,
        heights,
        src_transform=transform,
        src_crs=crs,
        src_nodata=np.nan,
        dst_transform=transform_from_bounds(*box, SAMPLES, SAMPLES),
        dst_crs=MARS_LONLAT,
        dst_nodata=np.nan,
        resampling=Resampling.bilinear,
    )
    return heights if np.isfinite(heights).any() else None


def build_fine_terrain(sites: list[dict[str, Any]], out_dir: Path) -> dict[str, Any]:
    """Write terrain/<LEVEL>/<x>/<y>.bin (int16 LE steps, north-up) and terrain/index.json.

    index.json maps each written tile "x/y" to its height offset (m); a tile's heights are
    offset + step * HEIGHT_STEP_M, NODATA_I16 where the DTM has no data. Tiles with no data at
    all are not written. The index is saved after each site and keeps the other sites already in
    it, so one site can be rebuilt without fetching the remote mosaics again.
    """
    out = out_dir / "terrain"
    path = out / "index.json"
    earlier: dict[str, Any] = json.loads(path.read_text()) if path.exists() else {}
    index: dict[str, Any] = {
        "level": LEVEL,
        "samples": SAMPLES,
        "heightStepM": HEIGHT_STEP_M,
        "nodata": NODATA_I16,
        "sources": earlier.get("sources", {}),
        "tiles": earlier.get("tiles", {}),
    }
    out.mkdir(parents=True, exist_ok=True)
    for site in sites:
        fine = site.get("fine")
        if not fine:
            continue
        index["tiles"].update(_build_site(site, fine["dem"], out))
        index["sources"][site["id"]] = fine["source"]
        path.write_text(json.dumps(index, separators=(",", ":")))
    path.write_text(json.dumps(index, separators=(",", ":")))
    return index


def _build_site(site: dict[str, Any], dem: str, out: Path) -> dict[str, float]:
    """Write one site's tiles; returns their offsets by "x/y"."""
    tiles: dict[str, float] = {}
    x0, x1, y0, y1 = tile_range(tuple(site["bounds"]), LEVEL)
    with rasterio.open(dem) as src:
        # One read per row of tiles: the remote mosaics are stored in full-width strips.
        for y in range(y0, y1 + 1):
            _, south, _, north = tile_box(x0, y, LEVEL)
            row = (tile_box(x0, y, LEVEL)[0], south, tile_box(x1, y, LEVEL)[2], north)
            source = _read(src, row, site.get("zero_is_nodata", False))
            if source is None:
                continue
            for x in range(x0, x1 + 1):
                heights = _tile_heights(source, tile_box(x, y, LEVEL))
                if heights is None:
                    continue
                steps, offset = encode_heights(heights)
                tile = out / str(LEVEL) / str(x) / f"{y}.bin"
                tile.parent.mkdir(parents=True, exist_ok=True)
                steps.tofile(tile)
                tiles[f"{x}/{y}"] = offset
    return tiles
