"""Perseverance Navcam frames from NASA's raw-image API, with each frame's own camera model.

Every record carries the CAHVORE model JPL calibrated for that image (already mapped to its
subframe and downsampling) and the rover's attitude, so a frame's pixels have exact compass
directions, rover tilt included, with no field-of-view guesses.
"""

import concurrent.futures
import dataclasses
import json
import re
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from numpy.typing import NDArray

from marsmap.cahvore import Array, Cahvore, parse_cahvore, rover_to_world

API_URL = "https://mars.nasa.gov/rss/api/"
PAGE_SIZE = 100
TIMEOUT_S = 60
RETRY_DELAYS_S = (2, 6, 15)  # the NASA API times out intermittently
DOWNLOAD_WORKERS = 8
NAVCAMS = "|NAVCAM_LEFT|NAVCAM_RIGHT"


@dataclass(frozen=True)
class NavcamFrame:
    image_id: str
    url: str  # lossless full-resolution PNG
    link: str  # NASA's page for the image
    sol: int
    site: int
    drive: int
    width: int
    height: int
    model: Cahvore
    rotation: Array  # camera-model (rover) frame -> world (x east, y up, z north)
    right_eye: bool
    taken_utc: str
    # Top-left of this image on the binned sensor: tiles of one shot sit side by side there.
    offset: tuple[float, float] = (0.0, 0.0)

    def __eq__(self, other: object) -> bool:
        return isinstance(other, NavcamFrame) and self.image_id == other.image_id

    def __hash__(self) -> int:
        return hash(self.image_id)


def exposure_id(url: str) -> str:
    """Tiles cut from one shot share camera, sol and clock: "NLF_0014_0668192307_..." prefix."""
    name = url.rsplit("/", 1)[-1]
    match = re.match(r"[A-Z]{3}_\d{4}_\d{10}", name)
    return match.group(0) if match else name


def _https(value: Any) -> str:
    url = str(value or "")
    return url if urllib.parse.urlparse(url).scheme == "https" else ""


def _frame(r: dict[str, Any]) -> NavcamFrame | None:
    camera = r.get("camera") or {}
    url = _https((r.get("image_files") or {}).get("full_res"))
    size = re.fullmatch(r"\((\d+),(\d+)\)", str((r.get("extended") or {}).get("dimension", "")))
    model_text = camera.get("camera_model_component_list")
    if r.get("sample_type") != "Full" or not r.get("attitude") or not url or not size:
        return None
    if camera.get("camera_model_type") not in (None, "CAHVORE") or not model_text:
        return None
    sub = re.fullmatch(r"\((\d+),(\d+),\d+,\d+\)", str(r["extended"].get("subframeRect", "")))
    scale = float(r["extended"].get("scaleFactor") or 1)
    offset = (
        ((int(sub.group(1)) - 1) / scale, (int(sub.group(2)) - 1) / scale) if sub else (0.0, 0.0)
    )
    try:
        model = parse_cahvore(model_text)
        rotation = rover_to_world(str(r["attitude"]))
    except ValueError:
        return None
    return NavcamFrame(
        image_id=str(r["imageid"]),
        url=url,
        link=_https(r.get("link")),
        sol=int(r["sol"]),
        site=int(r["site"]),
        drive=int(r["drive"]),
        width=int(size.group(1)),
        height=int(size.group(2)),
        model=model,
        rotation=rotation,
        right_eye="RIGHT" in str(camera.get("instrument", "")),
        taken_utc=str(r.get("date_taken_utc", "")),
        offset=offset,
    )


def normalize_m20(payload: dict[str, Any]) -> list[NavcamFrame]:
    """API page -> frames; records without a camera model, attitude or https PNG are skipped."""
    images = payload.get("images")
    if not isinstance(images, list):
        raise ValueError('raw images: expected an "images" array')
    return [f for f in (_frame(r) for r in images) if f is not None]


def shift_model(model: Cahvore, dx: float, dy: float) -> Cahvore:
    """The same camera with its image coordinates moved by (dx, dy) pixels."""
    a = np.array(model.a)
    h = tuple(float(x) for x in np.array(model.h) + dx * a)
    v = tuple(float(x) for x in np.array(model.v) + dy * a)
    return dataclasses.replace(model, h=(h[0], h[1], h[2]), v=(v[0], v[1], v[2]))


MIN_STRIP_PX = 200  # shared pixels needed to match one tile's stretch to its neighbour's


def mosaic(tiles: list[tuple[NavcamFrame, NDArray[np.uint8]]]) -> tuple[NDArray[np.uint8], Cahvore]:
    """Rebuild one camera shot from its subframe tiles and give it the shot's camera model.

    Tiles of one exposure are pixel-exact pieces of one sensor image, but NASA stretches each
    tile's contrast on its own: every tile is matched (gain and offset per channel) to the tiles
    already placed, on the strip they share, starting from the largest tile.
    """
    order = sorted(tiles, key=lambda t: -t[1].shape[0] * t[1].shape[1])
    x0 = min(round(f.offset[0]) for f, _ in tiles)
    y0 = min(round(f.offset[1]) for f, _ in tiles)
    x1 = max(round(f.offset[0]) + img.shape[1] for f, img in tiles)
    y1 = max(round(f.offset[1]) + img.shape[0] for f, img in tiles)
    canvas = np.zeros((y1 - y0, x1 - x0, 3), np.float32)
    placed = np.zeros(canvas.shape[:2], bool)
    for f, img in order:
        x, y = round(f.offset[0]) - x0, round(f.offset[1]) - y0
        region = (slice(y, y + img.shape[0]), slice(x, x + img.shape[1]))
        tile = img.astype(np.float32)
        shared = placed[region]
        if shared.sum() >= MIN_STRIP_PX:
            for c in range(3):
                b, a = tile[..., c][shared], canvas[region][..., c][shared]
                gain, bias = np.linalg.lstsq(np.stack([b, np.ones_like(b)], 1), a, rcond=None)[0]
                tile[..., c] = tile[..., c] * gain + bias
        canvas[region] = np.where(shared[..., None], canvas[region], tile)
        placed[region] = True
    ref, _ = order[0]
    model = shift_model(ref.model, ref.offset[0] - x0, ref.offset[1] - y0)
    return np.clip(canvas + 0.5, 0, 255).astype(np.uint8), model


def _sees(frame: NavcamFrame, world_dir: Array) -> bool:
    x, y = frame.model.project((frame.rotation.T @ world_dir)[None])[0]
    return bool(0 <= x < frame.width and 0 <= y < frame.height)


def select_frames(frames: list[NavcamFrame], site: int, drive: int) -> list[NavcamFrame]:
    """The stop's frames. Right-eye frames only fill where no left-eye frame looks: the right
    Navcam sits 42 cm from the left, so near rocks would show twice."""
    here = [f for f in frames if f.site == site and f.drive == drive]
    left = [f for f in here if not f.right_eye]
    right = [
        f
        for f in here
        if f.right_eye and not any(_sees(lf, f.rotation @ np.array(f.model.a)) for lf in left)
    ]
    return left + right


def _get(url: str) -> bytes:
    for delay in (*RETRY_DELAYS_S, None):
        try:
            with urllib.request.urlopen(url, timeout=TIMEOUT_S) as response:
                body: bytes = response.read()
                return body
        except OSError:
            if delay is None:
                raise
            time.sleep(delay)
    raise AssertionError("unreachable")


def fetch_pages(from_sol: int, to_sol: int) -> list[dict[str, Any]]:
    """Every Navcam API page between two sols (inclusive)."""
    pages: list[dict[str, Any]] = []
    page, total = 0, None
    while total is None or page * PAGE_SIZE < total:
        query = urllib.parse.urlencode(
            {
                "feed": "raw_images",
                "category": "mars2020",
                "feedtype": "json",
                "num": PAGE_SIZE,
                "page": page,
                "order": "sol desc",
                "search": NAVCAMS,
                "condition_2": f"{from_sol}:sol:gte",
                "condition_3": f"{to_sol}:sol:lte",
            }
        )
        data = json.loads(_get(f"{API_URL}?{query}"))
        total = int(data.get("total_results", 0))
        pages.append(data)
        page += 1
    return pages


def read_image(path: Path, frame: NavcamFrame) -> NDArray[np.uint8]:
    """Decode a downloaded frame; untrusted bytes must decode to the size the API promised."""
    image = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if image is None or image.shape[:2] != (frame.height, frame.width):
        shape = None if image is None else image.shape
        raise ValueError(f"{frame.image_id}: expected {frame.width}x{frame.height}, got {shape}")
    return np.asarray(image, np.uint8)


def download(frames: list[NavcamFrame], cache: Path) -> dict[NavcamFrame, Path]:
    """Fetch each frame's PNG into the raw cache (download-only, never modified)."""
    cache.mkdir(parents=True, exist_ok=True)

    def one(f: NavcamFrame) -> Path:
        path = cache / f"{f.image_id}.png"
        if not path.exists():
            part = path.with_suffix(".part")
            part.write_bytes(_get(f.url))
            part.rename(path)
        return path

    with concurrent.futures.ThreadPoolExecutor(DOWNLOAD_WORKERS) as pool:
        return dict(zip(frames, pool.map(one, frames), strict=True))
