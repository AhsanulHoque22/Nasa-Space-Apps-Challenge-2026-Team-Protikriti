"""THEMIS thermal inertia for each site: a proxy for how loose or firm the ground is."""

import json
import math
from pathlib import Path
from typing import Any

import numpy as np
import rasterio
from numpy.typing import NDArray
from rasterio.warp import transform_bounds
from rasterio.windows import Window, from_bounds

from marsmap.dem import MARS_LONLAT

# USGS Astrogeology: THEMIS Thermal Inertia Mosaic, Quantitative 32-bit, 100 m/px (Fergason et al.
# 2006). Tiles are 30 deg of latitude by 60 deg of longitude, named by their south-west corner,
# covering +/-60 deg. The cubes are 2.4 GB each; GDAL reads only the site window over HTTP.
THEMIS_TI_URL = (
    "/vsicurl/https://asc-astropedia.s3.us-west-2.amazonaws.com/Mars/Odyssey/"
    "THEMIS-Global-Thermal-Inertia-Mosaic/Quantitative-32-Bit/"
    "THEMIS_TI_Mosaic_Quant_{tile}_100mpp.cub"
)
SOURCE = (
    "THEMIS quantitative thermal inertia mosaic, 100 m/px, USGS Astrogeology "
    "(Fergason et al. 2006, doi:10.1029/2006JE002735)"
)
UNITS = "J m-2 K-1 s-1/2"
MOSAIC_LAT_LIMIT = 60.0


def tile_name(lon: float, lat: float) -> str:
    """Name of the tile holding (lon, lat), e.g. 00N060E for Jezero."""
    if abs(lat) >= MOSAIC_LAT_LIMIT:
        raise ValueError(f"latitude {lat} is outside the mosaic's +/-60 deg coverage")
    if lon < 0:
        raise ValueError(f"longitude {lon}: use east longitude 0-360; west-named tiles unverified")
    south = math.floor(lat / 30) * 30
    west = math.floor(lon / 60) * 60
    return f"{abs(south):02d}{'N' if south >= 0 else 'S'}{west:03d}E"


def read_window(
    path: str, bounds: tuple[float, float, float, float]
) -> tuple[NDArray[np.float32], tuple[float, float, float, float]]:
    """Thermal inertia over lon/lat `bounds` (west, south, east, north) at the file's resolution.

    Nodata and non-physical values (<= 0) become NaN. Returns the array and the lon/lat bounds of
    the pixels actually read.
    """
    with (
        rasterio.Env(
            GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".cub,.tif"
        ),
        rasterio.open(path) as src,
    ):
        projected = transform_bounds(MARS_LONLAT, src.crs, *bounds)
        window = from_bounds(*projected, transform=src.transform)
        window = window.round_offsets().round_lengths()
        full = Window(0, 0, src.width, src.height)
        if (
            window.col_off < 0
            or window.row_off < 0
            or window.col_off + window.width > full.width
            or window.row_off + window.height > full.height
            or window.width <= 0
            or window.height <= 0
        ):
            raise ValueError(f"bounds {bounds} are outside {path}")
        data = src.read(1, window=window, masked=True).astype(np.float32).filled(np.nan)
        west_m, south_m, east_m, north_m = rasterio.windows.bounds(window, src.transform)
        lonlat = transform_bounds(src.crs, MARS_LONLAT, west_m, south_m, east_m, north_m)
    data[~(data > 0)] = np.nan  # also catches NaN
    return data, (lonlat[0], lonlat[1], lonlat[2], lonlat[3])


def build_thermal(
    bounds: tuple[float, float, float, float], out_dir: Path, url_template: str = THEMIS_TI_URL
) -> dict[str, Any]:
    """Write thermal.bin (float32 LE, row-major, north-up, NaN = no data) and thermal.json."""
    west, south, east, north = bounds
    tile = tile_name((west + east) / 2, (south + north) / 2)
    if tile_name(west, south) != tile or tile_name(east, north) != tile:
        raise ValueError(f"site {bounds} crosses a tile edge; not supported")
    data, (w, s, e, n) = read_window(url_template.format(tile=tile), bounds)
    out_dir.mkdir(parents=True, exist_ok=True)
    data.astype("<f4").tofile(out_dir / "thermal.bin")
    finite = data[np.isfinite(data)]
    meta: dict[str, Any] = {
        "width": int(data.shape[1]),
        "height": int(data.shape[0]),
        "west": w,
        "south": s,
        "east": e,
        "north": n,
        "units": UNITS,
        "source": SOURCE,
        "tile": tile,
        "p02": float(np.percentile(finite, 2)) if finite.size else None,
        "p98": float(np.percentile(finite, 98)) if finite.size else None,
    }
    (out_dir / "thermal.json").write_text(json.dumps(meta, indent=1))
    return meta
