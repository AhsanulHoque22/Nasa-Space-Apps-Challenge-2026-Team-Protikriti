"""Fetch Esri OnMars tiles, tidy a region of the HiRISE strip mosaic, and cut it into web tiles.

Esri's OnMars layers are geographic (plate carree) with 512 px tiles: level L has 2 x 1 root
tiles and a tile spans 180 / 2^L degrees, the same scheme Cesium's GeographicTilingScheme uses,
so the output tiles drop straight into the globe.
"""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from numpy.typing import NDArray

from marsmap.strips import Gray, tidy_strips

TILE_PX = 512
ESRI = "https://astro.arcgis.com/arcgis/rest/services/OnMars/{service}/MapServer/tile/{z}/{y}/{x}"
FETCH_WORKERS = 8  # polite to the server, and the link is slow per connection
FETCH_ATTEMPTS = 4
FETCH_TIMEOUT_S = 90
WEBP_QUALITY = 88
MIN_OUTPUT_LEVEL = 5  # coarser than this the strips are specks


def tile_deg(level: int) -> float:
    return float(180.0 / 2**level)


def tile_range(
    level: int, west: float, south: float, east: float, north: float
) -> tuple[int, int, int, int]:
    """(x0, x1, y0, y1) inclusive tile indices covering a lon/lat box (degrees, east longitude)."""
    size = tile_deg(level)
    return (
        int((west + 180) // size),
        int((east + 180) // size),
        int((90 - north) // size),
        int((90 - south) // size),
    )


def fetch_tile(
    service: str,
    level: int,
    x: int,
    y: int,
    cache: Path,
    get: Callable[[str], bytes | None] | None = None,
) -> Gray | None:
    """One 512 px grey tile, or None where the layer has no image. Cached on disk."""
    path = cache / service / str(level) / f"{y}_{x}.png"
    if path.exists():
        cached = path.read_bytes()
        if not cached:
            return None  # remembered: the layer has no image here
        tile = _decode(cached)
        if tile is not None:
            return tile
        path.unlink()  # a truncated download from an earlier run: fetch it again
    url = ESRI.format(service=service, z=level, y=y, x=x)
    body: bytes | None = (get or _download)(url)
    tile = None if not body else _decode(body)
    if body and tile is None:  # once more: the first download may have been cut short
        body = (get or _download)(url)
        tile = None if not body else _decode(body)
        if body and tile is None:
            print(f"warning: {url} is broken on the server; treating it as no image")
            body = None
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(body or b"")  # an empty file remembers "no image here"
    return tile


def _decode(data: bytes) -> Gray | None:
    image = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_GRAYSCALE)
    return None if image is None else np.asarray(image, dtype=np.uint8)


def _download(url: str) -> bytes | None:
    """Tile bytes; None for 404 (no coverage); other failures are retried, then raised."""
    for attempt in range(1, FETCH_ATTEMPTS + 1):
        try:
            with urllib.request.urlopen(url, timeout=FETCH_TIMEOUT_S) as response:
                return bytes(response.read())
        except urllib.error.HTTPError as error:
            if error.code in (400, 404):
                return None
            if attempt == FETCH_ATTEMPTS:
                raise
        except OSError:
            if attempt == FETCH_ATTEMPTS:
                raise
        time.sleep(2 * attempt)
    raise AssertionError("unreachable")


def fetch_mosaic(
    service: str,
    level: int,
    box: tuple[int, int, int, int],
    cache: Path,
    workers: int = FETCH_WORKERS,
    get: Callable[[str], bytes | None] | None = None,
) -> Gray:
    """Tiles (x0, x1, y0, y1) joined into one grey image; missing tiles are black (no data)."""
    x0, x1, y0, y1 = box
    mosaic = np.zeros(((y1 - y0 + 1) * TILE_PX, (x1 - x0 + 1) * TILE_PX), dtype=np.uint8)
    jobs = [(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)]
    with ThreadPoolExecutor(workers) as pool:
        tiles = pool.map(lambda xy: fetch_tile(service, level, xy[0], xy[1], cache, get), jobs)
        for (x, y), tile in zip(jobs, tiles, strict=True):
            if tile is not None and tile.shape == (TILE_PX, TILE_PX):
                r, c = (y - y0) * TILE_PX, (x - x0) * TILE_PX
                mosaic[r : r + TILE_PX, c : c + TILE_PX] = tile
    return mosaic


def pyramid(
    image: Gray, mask: NDArray[np.bool_], finest: int, box: tuple[int, int, int, int]
) -> dict[int, tuple[Gray, NDArray[np.bool_], tuple[int, int, int, int]]]:
    """Coarser levels by alpha-aware 2x2 averaging; each level keeps its own tile box.

    A level's tile box is tile-aligned, so boxes are padded to even tile counts as needed.
    """
    x0, x1, y0, y1 = box
    levels: dict[int, tuple[Gray, NDArray[np.bool_], tuple[int, int, int, int]]] = {
        finest: (image, mask, box)
    }
    level = finest
    while level > MIN_OUTPUT_LEVEL:
        px0, px1, py0, py1 = x0 // 2, x1 // 2, y0 // 2, y1 // 2
        canvas = np.zeros(
            ((py1 - py0 + 1) * 2 * TILE_PX, (px1 - px0 + 1) * 2 * TILE_PX), np.float32
        )
        weight = np.zeros_like(canvas)
        r0, c0 = (y0 - py0 * 2) * TILE_PX, (x0 - px0 * 2) * TILE_PX
        canvas[r0 : r0 + image.shape[0], c0 : c0 + image.shape[1]] = image * mask
        weight[r0 : r0 + image.shape[0], c0 : c0 + image.shape[1]] = mask
        small = cv2.resize(canvas, None, fx=0.5, fy=0.5, interpolation=cv2.INTER_AREA)
        wsmall = cv2.resize(weight, None, fx=0.5, fy=0.5, interpolation=cv2.INTER_AREA)
        new_mask = wsmall > 0.5
        image = np.where(
            new_mask, np.clip(np.round(small / np.maximum(wsmall, 1e-3)), 1, 255), 0
        ).astype(np.uint8)
        mask = new_mask
        level, x0, x1, y0, y1 = level - 1, px0, px1, py0, py1
        levels[level] = (image, mask, (x0, x1, y0, y1))
    return levels


def write_tiles(
    levels: dict[int, tuple[Gray, NDArray[np.bool_], tuple[int, int, int, int]]], out: Path
) -> int:
    """WebP (grey + alpha) tiles at out/{z}/{x}/{y}.webp, only where there is data."""
    written = 0
    for level, (image, mask, (x0, x1, y0, y1)) in levels.items():
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                r, c = (y - y0) * TILE_PX, (x - x0) * TILE_PX
                tile_mask = mask[r : r + TILE_PX, c : c + TILE_PX]
                if tile_mask.shape != (TILE_PX, TILE_PX) or not tile_mask.any():
                    continue
                grey = image[r : r + TILE_PX, c : c + TILE_PX]
                rgba = np.dstack([grey, grey, grey, tile_mask.astype(np.uint8) * 255])
                ok, data = cv2.imencode(".webp", rgba, [cv2.IMWRITE_WEBP_QUALITY, WEBP_QUALITY])
                if not ok:
                    raise RuntimeError(f"WebP encode failed for tile {level}/{x}/{y}")
                path = out / str(level) / str(x) / f"{y}.webp"
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(data.tobytes())
                written += 1
    return written


def build_region(
    name: str,
    region: tuple[float, float, float, float],
    level: int,
    out_dir: Path,
    cache: Path,
    align: bool = True,
) -> dict[str, Any]:
    """Tidy the strips of one region at `level` and write its tile pyramid; returns a summary."""
    box = tile_range(level, *region)
    strips = fetch_mosaic("HiRISE", level, box, cache)
    reference = fetch_mosaic("CTX", level, box, cache) if align else None
    tidy, mask, stats = tidy_strips(strips, reference)
    levels = pyramid(tidy, mask, level, box)
    out = out_dir / "strips"
    count = write_tiles(levels, out)
    if count == 0:  # the layer has nothing here (it stops short of the poles): record nothing
        return {"name": name, "tiles": 0, "seamPx": 0.0, "aligned": 0.0}
    size = tile_deg(level)
    rect = [
        box[0] * size - 180,
        90 - (box[3] + 1) * size,
        (box[1] + 1) * size - 180,
        90 - box[2] * size,
    ]
    summary: dict[str, Any] = {
        "name": name,
        "rect": rect,
        "maxLevel": level,
        "minLevel": MIN_OUTPUT_LEVEL,
        "tiles": count,
        "aligned": bool(align),
        **{k: round(v, 3) for k, v in stats.items()},
    }
    manifest_path = out / "manifest.json"
    manifest: dict[str, Any] = (
        json.loads(manifest_path.read_text()) if manifest_path.exists() else {"regions": []}
    )
    manifest["regions"] = [r for r in manifest["regions"] if r["name"] != name] + [summary]
    out.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, indent=1))
    return summary
