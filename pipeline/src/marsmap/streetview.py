"""Pre-stitched Street View panoramas: a stop's Navcam frames -> one equirectangular JPEG.

The browser can stitch live, but only through a proxy NASA may block, and only from mast
pointing. Stitched here, the demo stops open offline, aligned by JPL's camera models and refined
against the images themselves.
"""

import json
from pathlib import Path
from typing import Any

import cv2
import numpy as np

from marsmap.navcam import (
    NavcamFrame,
    download,
    exposure_id,
    fetch_pages,
    mosaic,
    normalize_m20,
    read_image,
    select_frames,
)
from marsmap.pano import View, refine_rotations, render, shows_ground

LATEST_STOP_SOLS = 30  # the latest stop has no successor: search this far ahead (as the web app)
# Navcam's Sun shots for dust opacity are exposed so short the scene is black around the Sun.
DARK_MEDIAN = 12
# Navcam brightness falls off as cos^n off the axis: M20 frames drop to about half at the 48°
# sensor edge, so n ≈ ln 0.5 / ln cos 48° ≈ 1.7 (measured in web/src/core/pinhole.ts).
M20_VIGNETTE_EXP = 1.7
# Perseverance Navcam frames are black beyond tan² ≈ 1.66 off-axis and dim from 1.52 (measured
# on sol 400 frames, web/src/map/stitch-client.ts): keep within tan² 1.5, i.e. 50.8 degrees.
M20_IMAGE_CIRCLE_DEG = 50.8
GREY_TOLERANCE = 2  # mean |R-G|+|G-B| below this: a greyscale (autonav or engineering) frame
JPEG_QUALITY = 88


def _frames(stop: dict[str, Any], next_sol: int | None, raw: Path) -> list[NavcamFrame]:
    """The stop's frames, from the saved API answer if there is one (raw data never changes)."""
    saved = raw / f"api_{stop['site']}_{stop['drive']}.json"
    if not saved.exists():
        to_sol = next_sol if next_sol is not None else stop["sol"] + LATEST_STOP_SOLS
        saved.parent.mkdir(parents=True, exist_ok=True)
        saved.write_text(json.dumps(fetch_pages(stop["sol"], to_sol)))
    pages = json.loads(saved.read_text())
    frames = [f for page in pages for f in normalize_m20(page)]
    return select_frames(frames, stop["site"], stop["drive"])


def _greyscale(image: np.ndarray) -> bool:
    b, g, r = (image[..., k].astype(np.int16) for k in range(3))
    return float(np.abs(r - g).mean() + np.abs(g - b).mean()) < GREY_TOLERANCE


def build_panorama(
    stop: dict[str, Any], next_sol: int | None, raw: Path, out: Path, width: int
) -> dict[str, Any]:
    """Stitch one stop into out/{site}_{drive}.jpg; returns its provenance record."""
    frames = _frames(stop, next_sol, raw)
    if not frames:
        raise ValueError(f"site {stop['site']} drive {stop['drive']}: no Navcam frames")
    paths = download(frames, raw / "frames")
    shots: dict[str, list[NavcamFrame]] = {}
    for f in frames:  # subframe tiles of one exposure go back together as one image
        shots.setdefault(exposure_id(f.url), []).append(f)
    built = {}
    for shot, tiles in shots.items():
        image, model = mosaic([(f, read_image(paths[f], f)) for f in tiles])
        if np.median(cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)) >= DARK_MEDIAN:
            built[shot] = (image, model, tiles)
    # Greyscale shots are stretched differently and would show as grey patches among colour
    # ones: use them only at stops with no colour shots.
    colour = {k: v for k, v in built.items() if not _greyscale(v[0])}
    chosen = colour or built
    every = {
        shot: View(image, model, tiles[0].rotation, shot, M20_VIGNETTE_EXP, M20_IMAGE_CIRCLE_DEG)
        for shot, (image, model, tiles) in chosen.items()
    }
    kept = [shot for shot, view in every.items() if shows_ground(view)]
    views = [every[shot] for shot in kept]
    used = [f for shot in kept for f in chosen[shot][2]]
    rotations, report = refine_rotations(views)
    pano, covered = render(views, rotations, width)
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
    """Add a stop to out/index.json, keeping the stops stitched before."""
    path = out / "index.json"
    index = json.loads(path.read_text()) if path.exists() else {}
    index[key] = record
    path.write_text(json.dumps(index, separators=(",", ":"), sort_keys=True))
