"""Terrain classification on pre-stitched panoramas.

Workflow:
  1. project_labels()  - project AI4Mars labels to equirectangular (port of label-pano.ts)
  2. extract_features() — LAB + texture features from labeled pixels
  3. train_classifier() — scikit-learn Random Forest (class_weight='balanced')
  4. infer_full_grid()  — full-sphere coverage; human labels take priority
  5. render_labels_png() — RGBA PNG ready for WebGL renderer.setLabels()

Class indices match ai4mars.py: soil=0, bedrock=1, sand=2, big rock=3, NONE=4.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import TYPE_CHECKING

import cv2
import numpy as np
from numpy.typing import NDArray
from sklearn.ensemble import RandomForestClassifier  # type: ignore[import-untyped]

from marsmap.terrain_mask import terrain_mask

if TYPE_CHECKING:
    from marsmap.navcam import NavcamFrame

NONE = 4  # no label — matches ai4mars.py and ai4mars.ts
# BGR order (OpenCV) — matches CLASS_COLOURS in ai4mars.ts
CLASS_BGR_ALPHA: list[tuple[int, int, int, int]] = [
    (0x00, 0x85, 0xC9, 255),  # soil     #c98500
    (0xE5, 0x87, 0x39, 255),  # bedrock  #3987e5
    (0x81, 0x51, 0xD5, 255),  # sand     #d55181
    (0x70, 0x9E, 0x19, 255),  # big rock #199e70
]

MAX_EL_DEG = 20.0  # sky above this is not terrain
MIN_EL_DEG = -50.0  # rover nadir below this is not terrain

RAD = np.pi / 180.0


@dataclass(frozen=True)
class LabelFrame:
    cls: NDArray[np.uint8]  # (height, width) uint8, values 0-NONE
    width: int
    height: int
    az_deg: float  # camera optical axis azimuth (clockwise from north)
    el_deg: float  # camera optical axis elevation
    width_deg: float  # horizontal FOV
    height_deg: float  # vertical FOV


def project_labels(
    frames: list[LabelFrame],
    out_width: int = 1024,
) -> NDArray[np.uint8]:
    """Equirectangular class grid (out_width x out_width/2), NONE where no frame labels a pixel.

    Ports label-pano.ts:projectLabels (same pinhole model and elevation clamp), vectorised per
    frame: where frames overlap, the one whose optical axis is nearest the pixel wins.
    """
    out_h = out_width // 2
    grid = np.full((out_h, out_width), NONE, dtype=np.uint8)
    best_t2 = np.full((out_h, out_width), np.inf)
    az = (np.arange(out_width) + 0.5) * (2 * np.pi / out_width)
    sin_az, cos_az = np.sin(az)[None, :], np.cos(az)[None, :]
    el_deg = 90.0 - (np.arange(out_h) + 0.5) / out_h * 180.0
    in_band = (el_deg <= MAX_EL_DEG) & (el_deg >= MIN_EL_DEG)

    for f in frames:
        rows = np.flatnonzero(
            in_band & (np.abs(el_deg - f.el_deg) <= max(f.width_deg, f.height_deg) / 2)
        )
        if rows.size == 0:
            continue
        sin_el = np.sin(el_deg[rows] * RAD)[:, None]
        cos_el = np.cos(el_deg[rows] * RAD)[:, None]
        dx, dy, dz = cos_el * sin_az, sin_el, cos_el * cos_az  # ray directions, broadcast

        fwd_az, fwd_el = f.az_deg * RAD, f.el_deg * RAD
        fx = np.cos(fwd_el) * np.sin(fwd_az)
        fy = np.sin(fwd_el)
        fz = np.cos(fwd_el) * np.cos(fwd_az)
        t = fx * dx + fy * dy + fz * dz
        ahead = t > 0
        t_safe = np.where(ahead, t, 1.0)
        # Camera right axis has no vertical part; up axis tilts with the camera elevation.
        px = (np.cos(fwd_az) * dx - np.sin(fwd_az) * dz) / t_safe
        py = (
            -np.sin(fwd_el) * np.sin(fwd_az) * dx
            + np.cos(fwd_el) * dy
            - np.sin(fwd_el) * np.cos(fwd_az) * dz
        ) / t_safe
        half_w = np.tan(f.width_deg / 2 * RAD)
        half_h = np.tan(f.height_deg / 2 * RAD)
        inside = ahead & (np.abs(px) <= half_w) & (np.abs(py) <= half_h)

        col = np.clip(((px / half_w + 1) / 2 * f.width).astype(np.int64), 0, f.width - 1)
        row = np.clip(((1 - py / half_h) / 2 * f.height).astype(np.int64), 0, f.height - 1)
        value = f.cls[row, col]
        t2 = (dx - fx) ** 2 + (dy - fy) ** 2 + (dz - fz) ** 2
        take = inside & (value != NONE) & (t2 < best_t2[rows])
        grid[rows] = np.where(take, value, grid[rows])
        best_t2[rows] = np.where(take, t2, best_t2[rows])
    return grid


N_FEATURES = 10
ROCK_BLOB_SIGMAS_PX = (
    2.0,
    6.0,
)  # difference of Gaussians: rock-sized blobs against their surroundings
LOCAL_CONTRAST_SIGMA_PX = (
    20.0  # brightness against the wider neighbourhood: rocks and shadows stand out
)
LOCAL_STD_WINDOW_PX = 9  # roughness: rocky ground varies more than soil or sand


def feature_stack(panorama: NDArray[np.uint8]) -> NDArray[np.float32]:
    """(height, width, N_FEATURES): colour, edges, rock-scale texture and elevation per pixel."""
    h, w = panorama.shape[:2]
    lab = cv2.cvtColor(panorama, cv2.COLOR_BGR2LAB).astype(np.float32)
    lightness = lab[:, :, 0]
    gray = cv2.cvtColor(panorama, cv2.COLOR_BGR2GRAY).astype(np.float32)
    sobel = np.hypot(
        cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3), cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    )
    laplacian = np.abs(cv2.Laplacian(gray, cv2.CV_32F)) / 255.0
    fine, coarse = (cv2.GaussianBlur(lightness, (0, 0), s) for s in ROCK_BLOB_SIGMAS_PX)
    mean = cv2.blur(lightness, (LOCAL_STD_WINDOW_PX, LOCAL_STD_WINDOW_PX))
    mean_sq = cv2.blur(lightness * lightness, (LOCAL_STD_WINDOW_PX, LOCAL_STD_WINDOW_PX))
    local_std = np.sqrt(np.maximum(mean_sq - mean * mean, 0.0))
    el = (90.0 - (np.arange(h) + 0.5) / h * 180.0) * RAD
    column = np.ones((1, w), dtype=np.float32)
    return np.dstack(
        [
            lab[:, :, 0],
            lab[:, :, 1],
            lab[:, :, 2],
            sobel / 1442.0,
            laplacian,
            fine - coarse,
            local_std,
            lightness - cv2.GaussianBlur(lightness, (0, 0), LOCAL_CONTRAST_SIGMA_PX),
            np.sin(el)[:, None] * column,
            np.cos(el)[:, None] * column,
        ]
    ).astype(np.float32)


ROCK_CLASS = 3  # "big rock" in the AI4Mars classes
ROCK_SIGMAS_PX = (1.5, 6.0)  # blob detector: a rock is a patch that differs from its surroundings
ROCK_PERCENTILE = 97.5  # per stop: contrast above this share of the ground is rock-like
ROCK_MIN_CONTRAST = 8.0  # lightness levels: below this there is nothing rock-like to find
ROCK_MIN_AREA_PX = 12  # smaller specks are noise
ROCK_MAX_AREA_PX = 900  # larger patches are shadows, ruts or slopes, not a rock
ROCK_GROW_PX = 3  # a rock's outline is wider than its sharpest contrast
ROVER_CLEARANCE_PX = 25  # rover edges and shadows look like rocks: keep this far away


def rock_mask(
    panorama: NDArray[np.uint8],
    ground: NDArray[np.bool_],
    rover_world: NDArray[np.bool_] | None = None,
) -> NDArray[np.bool_]:
    """Rock-sized blobs on the ground, found by contrast. A rule, not a trained model.

    Rocks are 0.4% of the human-labelled pixels, too few for the forest to learn, so they are
    found directly. The threshold follows each stop's own contrast.
    """
    lightness = cv2.cvtColor(panorama, cv2.COLOR_BGR2LAB)[:, :, 0].astype(np.float32)
    fine, coarse = (cv2.GaussianBlur(lightness, (0, 0), s) for s in ROCK_SIGMAS_PX)
    contrast = np.abs(fine - coarse)
    if not ground.any():
        return np.zeros_like(ground)
    threshold = max(ROCK_MIN_CONTRAST, float(np.percentile(contrast[ground], ROCK_PERCENTILE)))
    candidate = ((contrast > threshold) & ground).astype(np.uint8)
    candidate = np.asarray(
        cv2.morphologyEx(candidate, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8)), dtype=np.uint8
    )
    _, labels, stats, _ = cv2.connectedComponentsWithStats(candidate)
    area = stats[:, cv2.CC_STAT_AREA]
    keep = np.flatnonzero((area >= ROCK_MIN_AREA_PX) & (area <= ROCK_MAX_AREA_PX))
    keep = keep[keep != 0]
    rocks = np.isin(labels, keep).astype(np.uint8)
    grown = cv2.dilate(rocks, np.ones((ROCK_GROW_PX, ROCK_GROW_PX), np.uint8))
    rocks_on_ground = grown.astype(bool) & ground
    if rover_world is not None:
        size = 2 * ROVER_CLEARANCE_PX + 1
        near = cv2.dilate(rover_world.astype(np.uint8), np.ones((size, size), np.uint8))
        rocks_on_ground &= ~near.astype(bool)
    return rocks_on_ground


def extract_features(
    panorama: NDArray[np.uint8],
    grid: NDArray[np.uint8],
    rover_world: NDArray[np.bool_] | None = None,
) -> tuple[NDArray[np.float32], NDArray[np.uint8]]:
    """Features and class of every labelled pixel that is photographed ground.

    Returns (feats, y): feats shape (N, N_FEATURES), y shape (N,). Labels that fall on sky,
    nadir fill or the rover body are dropped: they are projection spill, not terrain.
    """
    mask = terrain_mask(panorama, rover_world) & (grid != NONE)
    if not mask.any():
        return np.empty((0, N_FEATURES), dtype=np.float32), np.empty(0, dtype=np.uint8)
    return feature_stack(panorama)[mask], grid[mask]


def train_classifier(
    feats: NDArray[np.float32],
    y: NDArray[np.uint8],
) -> RandomForestClassifier:
    """Random Forest with balanced class weights: counters the ~2% big-rock minority."""
    clf = RandomForestClassifier(
        n_estimators=100,
        class_weight="balanced",
        n_jobs=-1,
        random_state=42,
    )
    clf.fit(feats, y)
    return clf


def per_class_recall(
    clf: RandomForestClassifier, feats: NDArray[np.float32], y: NDArray[np.uint8]
) -> list[float]:
    """Share of each class's true pixels that the classifier gets right (NaN: class absent)."""
    pred = clf.predict(feats)
    return [
        float((pred[y == c] == c).mean()) if (y == c).any() else float("nan") for c in range(NONE)
    ]


_BATCH = 50_000  # pixels per inference batch: keeps RAM flat


def infer_full_grid(
    panorama: NDArray[np.uint8],
    clf: RandomForestClassifier,
    human_grid: NDArray[np.uint8],
    rover_world: NDArray[np.bool_] | None = None,
) -> NDArray[np.uint8]:
    """Full-coverage class grid: human labels where available, RF on the rest of the ground,
    then rock blobs found by contrast on top.

    Sky, nadir fill and the rover body stay NONE, human labels there included.
    """
    ground = terrain_mask(panorama, rover_world)
    result = np.where(ground, human_grid, NONE).astype(np.uint8)
    todo = ground & (result == NONE)
    if not todo.any():
        result[rock_mask(panorama, ground, rover_world)] = ROCK_CLASS
        return result
    features = feature_stack(panorama)
    indices = np.argwhere(todo)  # (N, 2): row, col
    for start in range(0, len(indices), _BATCH):
        rows, cols = indices[start : start + _BATCH].T
        result[rows, cols] = clf.predict(features[rows, cols]).astype(np.uint8)
    result[rock_mask(panorama, ground, rover_world)] = ROCK_CLASS
    return result


def render_labels_png(grid: NDArray[np.uint8]) -> bytes:
    """RGBA PNG like overlayPixels() in label-pano.ts: class colour, transparent for NONE."""
    h, w = grid.shape
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    for cls_idx, (b, g, r, a) in enumerate(CLASS_BGR_ALPHA):
        m = grid == cls_idx
        rgba[m] = [b, g, r, a]
    ok, buf = cv2.imencode(".png", rgba)
    if not ok:
        raise RuntimeError("cv2.imencode failed")
    return buf.tobytes()


def frame_geometry(f: NavcamFrame) -> tuple[float, float, float, float]:
    """(az_deg, el_deg, width_deg, height_deg) of a NavcamFrame in world coordinates.

    Uses the frame centre direction as the optical axis and corner backprojections for FOV.
    """
    w, h = f.width, f.height
    cx, cy = (w - 1) / 2, (h - 1) / 2
    centre = f.rotation @ f.model.backproject(np.array([[cx, cy]]))[0]
    az_deg = math.degrees(math.atan2(float(centre[0]), float(centre[2]))) % 360
    el_deg = math.degrees(math.asin(float(np.clip(centre[1], -1, 1))))
    corners = f.model.backproject(np.array([[0.0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]))
    world = corners @ f.rotation.T
    el_corners = np.degrees(np.arcsin(np.clip(world[:, 1], -1.0, 1.0)))
    daz = (np.degrees(np.arctan2(world[:, 0], world[:, 2])) - az_deg + 180) % 360 - 180
    return az_deg, el_deg, float(daz.max() - daz.min()), float(el_corners.max() - el_corners.min())
