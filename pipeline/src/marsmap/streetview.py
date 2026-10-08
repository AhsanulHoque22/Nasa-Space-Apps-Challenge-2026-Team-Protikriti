"""Pre-stitched Street View panoramas: a stop's Navcam frames -> one equirectangular JPEG.

The browser can stitch live, but only through a proxy NASA may block, and only from mast
pointing. Stitched here, the demo stops open offline, aligned by JPL's camera models and refined
against the images themselves.
"""

import json
import time
from collections.abc import Callable
from pathlib import Path
from typing import Any

import cv2
import numpy as np

from marsmap.cahvore import Array, Cahvore
from marsmap.navcam import (
    NavcamFrame,
    download,
    exposure_id,
    fetch_pages,
    mosaic,
    normalize,
    read_image,
    select_frames,
)
from marsmap.pano import Image, View, pick_covering, refine_rotations, render, shows_ground

LATEST_STOP_SOLS = 30  # the latest stop has no successor: search this far ahead (as the web app)
# Navcam's Sun shots for dust opacity are exposed so short the scene is black around the Sun.
DARK_MEDIAN = 12
# Navcam brightness falls off as cos^n off the axis: M20 frames drop to about half at the 48°
# sensor edge, so n ≈ ln 0.5 / ln cos 48° ≈ 1.7 (measured in web/src/core/pinhole.ts).
M20_VIGNETTE_EXP = 1.7
# Perseverance Navcam frames are black beyond tan² ≈ 1.66 off-axis and dim from 1.52 (measured
# on sol 400 frames, web/src/map/stitch-client.ts): keep within tan² 1.5, i.e. 50.8 degrees.
M20_IMAGE_CIRCLE_DEG = 50.8
# Lens settings per rover: (vignetting exponent, image-circle radius in degrees). Curiosity's 45°
# Navcam stays well inside its image circle and is stitched as shot.
OPTICS = {"m20": (M20_VIGNETTE_EXP, M20_IMAGE_CIRCLE_DEG), "msl": (0.0, 90.0)}
GREY_TOLERANCE = 2  # mean |R-G|+|G-B| below this: a greyscale (autonav or engineering) frame
JPEG_QUALITY = 88


def _frames(rover: str, stop: dict[str, Any], next_sol: int | None, raw: Path) -> list[NavcamFrame]:
    """The stop's frames, from the saved API answer if there is one (raw data never changes)."""
    saved = raw / f"api_{stop['site']}_{stop['drive']}.json"
    if not saved.exists():
        to_sol = next_sol if next_sol is not None else stop["sol"] + LATEST_STOP_SOLS
        saved.parent.mkdir(parents=True, exist_ok=True)
        saved.write_text(json.dumps(fetch_pages(rover, stop["sol"], to_sol)))
    pages = json.loads(saved.read_text())
    frames = [f for page in pages for f in normalize(rover, page)]
    return select_frames(frames, stop["site"], stop["drive"])


def _greyscale(image: np.ndarray) -> bool:
    b, g, r = (image[..., k].astype(np.int16) for k in range(3))
    return float(np.abs(r - g).mean() + np.abs(g - b).mean()) < GREY_TOLERANCE


def _mosaic_size(tiles: list[NavcamFrame]) -> tuple[int, int]:
    """Width and height of the image rebuilt from a shot's tiles (see navcam.mosaic)."""
    x0 = min(round(f.offset[0]) for f in tiles)
    y0 = min(round(f.offset[1]) for f in tiles)
    x1 = max(round(f.offset[0]) + f.width for f in tiles)
    y1 = max(round(f.offset[1]) + f.height for f in tiles)
    return x1 - x0, y1 - y0


def _loader(tiles: list[NavcamFrame], paths: dict[NavcamFrame, Path]) -> Callable[[], Image]:
    return lambda: mosaic([(f, read_image(paths[f], f)) for f in tiles])[0]


def build_panorama(
    rover: str,
    stop: dict[str, Any],
    next_sol: int | None,
    paths_out: tuple[Path, Path],
    width: int,
    discard_frames: bool = False,
) -> dict[str, Any]:
    """Stitch one stop into out/{site}_{drive}.jpg; returns its provenance record."""
    raw, out = paths_out
    frames = _frames(rover, stop, next_sol, raw)
    if not frames:
        raise ValueError(f"site {stop['site']} drive {stop['drive']}: no Navcam frames")
    started = time.monotonic()

    def log(stage: str) -> None:
        print(f"  {stage} ({time.monotonic() - started:.0f} s)", flush=True)

    paths = download(frames, raw / "frames")
    try:
        return _stitch(rover, stop, frames, paths, (out, width), log)
    finally:
        if (
            discard_frames
        ):  # the raw cache is re-downloadable; the whole mission would fill the disk
            for path in paths.values():
                path.unlink(missing_ok=True)


def _stitch(
    rover: str,
    stop: dict[str, Any],
    frames: list[NavcamFrame],
    paths: dict[NavcamFrame, Path],
    target: tuple[Path, int],
    log: Callable[[str], None],
) -> dict[str, Any]:
    out, width = target
    log(f"downloaded {len(paths)} of {len(frames)} frames")
    shots: dict[str, list[NavcamFrame]] = {}
    for f in frames:  # subframe tiles of one exposure go back together as one image
        shots.setdefault(exposure_id(f.url), []).append(f)
    # Each shot read once to screen it; only its geometry is kept, so a stop imaged for weeks
    # (800+ frames) never sits in memory whole. The stitcher reads the frames again as it goes.
    usable: dict[str, tuple[bool, Cahvore]] = {}
    for shot, tiles in shots.items():
        if any(f not in paths for f in tiles):
            continue  # a tile would not download: the shot would have a hole
        try:
            image, model = mosaic([(f, read_image(paths[f], f)) for f in tiles])
        except ValueError as err:  # NASA served a different size than it listed
            print(f"  skipping {shot}: {err}")
            continue
        if np.median(cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)) < DARK_MEDIAN:
            continue  # a Sun shot for dust opacity: black around the Sun
        if shows_ground(View.of(image, model, tiles[0].rotation, shot)):
            usable[shot] = (_greyscale(image), model)
    # Every colour shot is used. Greyscale shots are stretched differently and would show as grey
    # patches among colour ones, so they fill only what no colour shot sees (at a stop with no
    # colour shots, all of them are used).
    colour = [k for k, (grey, _) in usable.items() if not grey]
    grey = [k for k, (is_grey, _) in usable.items() if is_grey]

    def geometry(shot: str) -> tuple[Cahvore, Array, int, int]:
        first = shots[shot][0]
        size = sizes[shot]
        return usable[shot][1], first.rotation, size[0], size[1]

    sizes = {k: _mosaic_size(shots[k]) for k in usable}
    if colour:
        fill = pick_covering([geometry(k) for k in grey], len(grey), [geometry(k) for k in colour])
        kept = colour + [grey[i] for i in fill]
    else:
        kept = grey
    views = [
        View(
            _loader(shots[shot], paths),
            *sizes[shot],
            usable[shot][1],
            shots[shot][0].rotation,
            shot,
            *OPTICS[rover],
        )
        for shot in kept
    ]
    used = [f for shot in kept for f in shots[shot]]
    log(f"screened: {len(views)} of {len(shots)} shots usable")
    if not views:
        raise ValueError(f"site {stop['site']} drive {stop['drive']}: no usable Navcam frames")
    rotations, report = refine_rotations(views)
    log(f"aligned: {report.pairs} pairs")
    pano, covered = render(views, rotations, width)
    log("rendered")
    out.mkdir(parents=True, exist_ok=True)
    name = f"{stop['site']}_{stop['drive']}.jpg"
    cv2.imwrite(str(out / name), pano, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
    return {
        "file": name,
        "width": width,
        "sol": stop["sol"],
        "coveredFraction": round(float(covered.mean()), 3),
        "alignment": {
            "pairs": report.pairs,
            "matches": report.matches,
            "rmsBeforeDeg": round(report.rms_before_deg, 3),
            "rmsAfterDeg": round(report.rms_after_deg, 3),
        },
        "frames": [{"id": f.image_id, "sol": f.sol, "link": f.link} for f in used],
    }


def update_index(out: Path, key: str, record: dict[str, Any]) -> None:
    """Add a stop: its full provenance to out/{key}.json, and a slim entry to out/index.json (the
    viewer loads the index for every stop, so it carries no per-frame lists)."""
    frames = record["frames"]
    (out / f"{key}.json").write_text(json.dumps({"frames": frames}, separators=(",", ":")))
    path = out / "index.json"
    index = json.loads(path.read_text()) if path.exists() else {}
    slim = {k: v for k, v in record.items() if k != "frames"}
    index[key] = {
        **slim,
        "frameCount": len(frames),
        "link": frames[0]["link"] if frames else "",
        "provenance": f"{key}.json",
    }
    path.write_text(json.dumps(index, separators=(",", ":"), sort_keys=True))
