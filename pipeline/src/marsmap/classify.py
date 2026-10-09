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

    Ports label-pano.ts:projectLabels — same pinhole model, same elevation clamp.
    """
    out_h = out_width // 2
    grid = np.full((out_h, out_width), NONE, dtype=np.uint8)
    if not frames:
        return grid

    # Pre-compute per-frame bounding info for early rejection
    radii = [max(f.width_deg, f.height_deg) / 2.0 for f in frames]

    sin_az = np.sin(np.arange(out_width) * (2 * np.pi / out_width) + np.pi / out_width)
    cos_az = np.cos(np.arange(out_width) * (2 * np.pi / out_width) + np.pi / out_width)

    for yi in range(out_h):
        el_deg = 90.0 - (yi + 0.5) / out_h * 180.0
        if el_deg > MAX_EL_DEG or el_deg < MIN_EL_DEG:
            continue

        sin_el = np.sin(el_deg * RAD)
        cos_el = np.cos(el_deg * RAD)

        # Only frames whose bounding cone spans this elevation
        cand = [
            i
            for i, (f, r) in enumerate(zip(frames, radii, strict=True))
            if abs(el_deg - f.el_deg) <= r
        ]
        if not cand:
            continue

        for xi in range(out_width):
            best_cls = NONE
            best_t2 = np.inf

            for i in cand:
                f = frames[i]
                # Project sphere direction through pinhole
                # Forward vector of the camera
                fwd_az = f.az_deg * RAD
                fwd_el = f.el_deg * RAD
                fx = np.cos(fwd_el) * np.sin(fwd_az)
                fy = np.sin(fwd_el)
                fz = np.cos(fwd_el) * np.cos(fwd_az)

                # Ray direction
                dx = cos_el * float(sin_az[xi])
                dy = sin_el
                dz = cos_el * float(cos_az[xi])

                # Project onto camera plane: t = dot(forward, direction)
                t = fx * dx + fy * dy + fz * dz
                if t <= 0:
                    continue

                # Right and up axes of camera
                rx = np.cos(fwd_az)
                ry = 0.0
                rz = -np.sin(fwd_az)

                ux = -np.sin(fwd_el) * np.sin(fwd_az)
                uy = np.cos(fwd_el)
                uz = -np.sin(fwd_el) * np.cos(fwd_az)

                # Normalised image coordinates
                px = (rx * dx + ry * dy + rz * dz) / t
                py = (ux * dx + uy * dy + uz * dz) / t

                half_w = np.tan(f.width_deg / 2 * RAD)
                half_h = np.tan(f.height_deg / 2 * RAD)
                if abs(px) > half_w or abs(py) > half_h:
                    continue  # outside frame

                t2 = (dx - fx) ** 2 + (dy - fy) ** 2 + (dz - fz) ** 2
                if t2 >= best_t2:
                    continue

                col = min(f.width - 1, int((px / half_w + 1) / 2 * f.width))
                row = min(f.height - 1, int((1 - py / half_h) / 2 * f.height))
                v = int(f.cls[row, col])
                if v == NONE:
                    continue
                best_cls = v
                best_t2 = t2

            grid[yi, xi] = best_cls

    return grid


def _elevation_mask(height: int, width: int) -> NDArray[np.bool_]:
    """Boolean mask: True where elevation is within the label band."""
    ys = np.arange(height)
    el = 90.0 - (ys + 0.5) / height * 180.0
    row_mask = (el >= MIN_EL_DEG) & (el <= MAX_EL_DEG)
    return np.broadcast_to(row_mask[:, None], (height, width)).copy()


def extract_features(
    panorama: NDArray[np.uint8],
    grid: NDArray[np.uint8],
) -> tuple[NDArray[np.float32], NDArray[np.uint8]]:
    """LAB + texture features for labeled pixels inside the elevation band.

    Returns (feats, y): feats shape (N, 7), y shape (N,), N = labeled pixel count.
    Features: L, a, b, sobel_mag, laplacian_mag, sin_el, cos_el.
    """
    h, w = grid.shape
    lab = cv2.cvtColor(panorama, cv2.COLOR_BGR2LAB).astype(np.float32)
    gray = cv2.cvtColor(panorama, cv2.COLOR_BGR2GRAY).astype(np.float32)

    sobel_x = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    sobel_y = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    sobel = np.hypot(sobel_x, sobel_y) / 1442.0  # normalise by max possible

    laplacian = np.abs(cv2.Laplacian(gray, cv2.CV_32F)) / 255.0

    ys = np.arange(h)
    el = (90.0 - (ys + 0.5) / h * 180.0) * RAD
    sin_el = np.sin(el)[:, None] * np.ones((1, w), dtype=np.float32)
    cos_el = np.cos(el)[:, None] * np.ones((1, w), dtype=np.float32)

    mask = _elevation_mask(h, w) & (grid != NONE)
    if not mask.any():
        return np.empty((0, 7), dtype=np.float32), np.empty(0, dtype=np.uint8)

    feats = np.stack(
        [
            lab[:, :, 0][mask],
            lab[:, :, 1][mask],
            lab[:, :, 2][mask],
            sobel[mask],
            laplacian[mask],
            sin_el[mask],
            cos_el[mask],
        ],
        axis=1,
    )
    y = grid[mask]
    return feats.astype(np.float32), y


def train_classifier(
    feats: NDArray[np.float32],
    y: NDArray[np.uint8],
) -> RandomForestClassifier:
    """Random Forest with balanced class weights — counters the ~2% big-rock minority."""
    clf = RandomForestClassifier(
        n_estimators=100,
        class_weight="balanced",
        n_jobs=-1,
        random_state=42,
    )
    clf.fit(feats, y)
    return clf


_BATCH = 50_000  # pixels per inference batch — keeps RAM flat


def infer_full_grid(
    panorama: NDArray[np.uint8],
    clf: RandomForestClassifier,
    human_grid: NDArray[np.uint8],
) -> NDArray[np.uint8]:
    """Full-coverage class grid: human labels where available, RF elsewhere.

    Pixels outside [-50°, +20°] elevation stay NONE.
    """
    h, w = human_grid.shape
    result = human_grid.copy()
    mask = _elevation_mask(h, w) & (human_grid == NONE)
    if not mask.any():
        return result

    # Build feature array for unlabeled pixels in batches
    lab = cv2.cvtColor(panorama, cv2.COLOR_BGR2LAB).astype(np.float32)
    gray = cv2.cvtColor(panorama, cv2.COLOR_BGR2GRAY).astype(np.float32)
    sobel_x = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    sobel_y = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    sobel = np.hypot(sobel_x, sobel_y) / 1442.0
    laplacian = np.abs(cv2.Laplacian(gray, cv2.CV_32F)) / 255.0
    ys = np.arange(h)
    el = (90.0 - (ys + 0.5) / h * 180.0) * RAD
    sin_el_2d = np.sin(el)[:, None] * np.ones((1, w), dtype=np.float32)
    cos_el_2d = np.cos(el)[:, None] * np.ones((1, w), dtype=np.float32)

    indices = np.argwhere(mask)  # (N, 2) — row, col
    n = len(indices)
    preds = np.empty(n, dtype=np.uint8)

    for start in range(0, n, _BATCH):
        end = min(start + _BATCH, n)
        idx = indices[start:end]
        rows, cols = idx[:, 0], idx[:, 1]
        feats_batch = np.stack(
            [
                lab[rows, cols, 0],
                lab[rows, cols, 1],
                lab[rows, cols, 2],
                sobel[rows, cols],
                laplacian[rows, cols],
                sin_el_2d[rows, cols],
                cos_el_2d[rows, cols],
            ],
            axis=1,
        ).astype(np.float32)
        preds[start:end] = clf.predict(feats_batch).astype(np.uint8)

    result[indices[:, 0], indices[:, 1]] = preds
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
