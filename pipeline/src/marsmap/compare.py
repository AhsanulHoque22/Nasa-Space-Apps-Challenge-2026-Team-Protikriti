"""Jezero and the Jamuna at the same ground scale: one Mars image, and Earth images over decades.

Mars: NASA Trek WMTS tiles of a Jezero mosaic, stitched. Earth: NASA GIBS WMS, dry-season scenes
chosen by eye for full coverage and no cloud (Landsat WELD annual composites, HLS).
"""

import json
import math
import warnings
from collections.abc import Callable
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

import numpy as np
from numpy.typing import NDArray
from rasterio.errors import NotGeoreferencedWarning
from rasterio.io import MemoryFile
from rasterio.shutil import copy

MARS_RADIUS_KM = 3396.19  # IAU Mars 2000 sphere
EARTH_RADIUS_KM = 6371.0088  # IUGG mean Earth radius
BOX_KM = 20  # wide enough for the Jezero delta and the Jamuna braid belt
PX = 640
TILE_PX = 256
TREK_LEVEL = 11  # 0.088 deg tiles, ~40 m/px on Mars: finer than the 31 m/px output needs

JEZERO = (77.38, 18.50)  # western delta, centre of the box (east lon, lat)
JEZERO_LAYER = "NES_JEZ_MID_Visible_Mosaic_HiRISE_CTX_HRSC_GCS_MARS_07-10-2018"
TREK = "https://trek.nasa.gov/tiles/Mars/EQ"
JAMUNA = (89.74, 24.45)  # braid belt east of Sirajganj, Bangladesh
GIBS_WMS = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi"
WELD = "Landsat_WELD_CorrectedReflectance_TrueColor_Global_Annual"
# (year shown, GIBS layer, date asked for, source line)
JAMUNA_SCENES = [
    (1989, WELD, "1989-12-01", "Landsat WELD annual true-colour composite, Dec 1989-Nov 1990"),
    (1999, WELD, "1999-12-01", "Landsat WELD annual true-colour composite, Dec 1999-Nov 2000"),
    (
        2020,
        "HLS_L30_Nadir_BRDF_Adjusted_Reflectance",
        "2020-02-02",
        "HLS Landsat (L30), 2 Feb 2020",
    ),
    (
        2024,
        "HLS_S30_Nadir_BRDF_Adjusted_Reflectance",
        "2024-03-09",
        "HLS Sentinel-2 (S30), 9 Mar 2024",
    ),
]
CAVEAT = (
    "The Jamuna (Brahmaputra) is not a recognised Mars analog. It is shown beside Jezero at the "
    "same scale only to compare shapes: a living braided river against an ancient delta. "
    "Recognised analogs for Jezero's delta include the Wax Lake Delta (Louisiana)."
)

Box = tuple[float, float, float, float]  # west, south, east, north


def box_deg(lon: float, lat: float, km: float, radius_km: float) -> Box:
    """A km x km square centred on lon/lat, in degrees on a sphere of radius_km."""
    half_lat = km / 2 / (math.pi * radius_km / 180)
    half_lon = half_lat / math.cos(math.radians(lat))
    return (lon - half_lon, lat - half_lat, lon + half_lon, lat + half_lat)


def trek_tiles(box: Box, level: int) -> tuple[list[tuple[int, int]], tuple[float, ...]]:
    """(row, col) of every tile over the box, and the box's pixel window in the stitched tiles."""
    deg = 180 / 2**level
    west, south, east, north = box
    col0, col1 = math.floor((west + 180) / deg), math.floor((east + 180) / deg)
    row0, row1 = math.floor((90 - north) / deg), math.floor((90 - south) / deg)
    tiles = [(r, c) for r in range(row0, row1 + 1) for c in range(col0, col1 + 1)]
    px = TILE_PX / deg
    window = (
        (west + 180 - col0 * deg) * px,
        (90 - north - row0 * deg) * px,
        (east + 180 - col0 * deg) * px,
        (90 - south - row0 * deg) * px,
    )
    return tiles, window


def gibs_url(layer: str, date: str, box: Box, px: int) -> str:
    west, south, east, north = box
    query = {
        "SERVICE": "WMS",
        "REQUEST": "GetMap",
        "VERSION": "1.3.0",
        "LAYERS": layer,
        "CRS": "EPSG:4326",
        "BBOX": f"{south},{west},{north},{east}",  # WMS 1.3.0 EPSG:4326 is lat, lon
        "WIDTH": str(px),
        "HEIGHT": str(px),
        "FORMAT": "image/jpeg",
        "TIME": date,
    }
    return f"{GIBS_WMS}?{urlencode(query)}"


def _decode(data: bytes) -> NDArray[np.uint8]:
    """RGB array (3, h, w) from PNG or JPEG bytes; a grey image gains three bands."""
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", NotGeoreferencedWarning)  # plain pictures, by design
        with MemoryFile(data) as mem, mem.open() as src:
            bands = src.read()
    rgb = bands[:3] if bands.shape[0] >= 3 else np.repeat(bands[:1], 3, axis=0)
    return rgb.astype(np.uint8)


def _resample(rgb: NDArray[np.uint8], window: tuple[float, ...], px: int) -> NDArray[np.uint8]:
    """Crop the window and resample it to px x px (nearest neighbour)."""
    x0, y0, x1, y1 = window
    cols = np.clip((x0 + (np.arange(px) + 0.5) * (x1 - x0) / px).astype(int), 0, rgb.shape[2] - 1)
    rows = np.clip((y0 + (np.arange(px) + 0.5) * (y1 - y0) / px).astype(int), 0, rgb.shape[1] - 1)
    out: NDArray[np.uint8] = rgb[:, rows[:, None], cols[None, :]]
    return out


def write_jpeg(path: Path, rgb: NDArray[np.uint8]) -> None:
    """JPEG from a (bands, rows, cols) uint8 array: 1 band grey or 3 bands RGB."""
    bands, height, width = rgb.shape
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", NotGeoreferencedWarning)  # placed by the page, not a CRS
        with MemoryFile() as mem:
            with mem.open(
                driver="GTiff", width=width, height=height, count=bands, dtype="uint8"
            ) as tmp:
                tmp.write(rgb)
            with mem.open() as src:
                copy(src, str(path), driver="JPEG", quality=85)


def _jezero(fetch: Callable[[str], bytes], px: int) -> NDArray[np.uint8]:
    box = box_deg(*JEZERO, BOX_KM, MARS_RADIUS_KM)
    tiles, window = trek_tiles(box, TREK_LEVEL)
    rows = sorted({r for r, _ in tiles})
    cols = sorted({c for _, c in tiles})
    mosaic = np.zeros((3, len(rows) * TILE_PX, len(cols) * TILE_PX), dtype=np.uint8)
    for r, c in tiles:
        url = f"{TREK}/{JEZERO_LAYER}/1.0.0//default/default028mm/{TREK_LEVEL}/{r}/{c}.png"
        tile = _decode(fetch(url))[:, :TILE_PX, :TILE_PX]
        y, x = (r - rows[0]) * TILE_PX, (c - cols[0]) * TILE_PX
        mosaic[:, y : y + tile.shape[1], x : x + tile.shape[2]] = tile
    return _resample(mosaic, window, px)


def build_compare(out_dir: Path, fetch: Callable[[str], bytes], px: int = PX) -> dict[str, Any]:
    out_dir.mkdir(parents=True, exist_ok=True)
    write_jpeg(out_dir / "jezero.jpg", _jezero(fetch, px))
    scenes = []
    box = box_deg(*JAMUNA, BOX_KM, EARTH_RADIUS_KM)
    for year, layer, date, source in JAMUNA_SCENES:
        rgb = _decode(fetch(gibs_url(layer, date, box, px)))
        write_jpeg(
            out_dir / f"jamuna_{year}.jpg", _resample(rgb, (0, 0, rgb.shape[2], rgb.shape[1]), px)
        )
        scenes.append(
            {
                "year": year,
                "file": f"jamuna_{year}.jpg",
                "layer": layer,
                "date": date,
                "source": f"{source}; NASA GIBS ({layer})",
            }
        )
    manifest: dict[str, Any] = {
        "boxKm": BOX_KM,
        "px": px,
        "caveat": CAVEAT,
        "jezero": {
            "file": "jezero.jpg",
            "center": list(JEZERO),
            "source": f"NASA Trek mosaic {JEZERO_LAYER} (HiRISE, CTX, HRSC), Mars 2000 sphere",
        },
        "jamuna": {"center": list(JAMUNA), "scenes": scenes},
    }
    (out_dir / "compare.json").write_text(json.dumps(manifest, indent=2))
    return manifest
