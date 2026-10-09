"""Tidy the planet-wide HiRISE strip mosaic: no seams between strips, strips aligned to CTX.

The HiRISE layer is a patchwork of separate observations, each with its own exposure and a
position that can be off by tens of metres. Three classical steps clean it up:

1. Seams: the long straight edges between strips are found (Hough lines), the image gradients
   across them are dropped, and the image is re-integrated (Poisson solve). Brightness steps
   between strips vanish; detail inside each strip is untouched.
2. Alignment: every strip piece is shifted to line up with the CTX orbital mosaic, which is
   controlled to MOLA (phase correlation on band-passed images, one shift per piece).
3. Edges: the data edge stays crisp; only the seams go.

Nothing here invents terrain: pixels are moved or re-balanced, never drawn.
"""

from __future__ import annotations

import cv2
import numpy as np
from numpy.typing import NDArray
from scipy.fft import dctn, idctn  # type: ignore[import-untyped]

Gray = NDArray[np.uint8]
Field = NDArray[np.float32]

NODATA_MAX = 3  # HiRISE tiles are black outside coverage; real ground is never this dark
SEAM_MIN_LENGTH_PX = 160  # a seam is long; terrain edges are not
SEAM_TILTS_DEG = (-12.0, -8.0, -4.0, 0.0, 4.0, 8.0, 12.0)  # strips run nearly along the map axes
SEAM_SIGMAS = 4.5  # a seam stands out from the typical response by this many robust sigmas
SEAM_WIDTH_PX = 5
SEAM_STEP_RUN_PX = (
    48  # the step is the average gradient along this run of a seam; the rest is texture
)
SEAM_DETECT_SCALE = 4  # seams are found on a 1/4-size copy: 16x cheaper, same seams
HOLE_FILL_SIGMA_PX = 30.0
MIN_CELL_AREA_PX = 40_000  # strip pieces smaller than this are not worth aligning
BAND_PASS_SIGMAS_PX = (1.5, 12.0)
MAX_SHIFT_PX = 8.0  # alignment moves at most this far; larger is a bad match, not a real offset
MIN_CORRELATION = 0.05  # phase-correlation peak height below which a piece is left alone
SHIFT_FIELD_SIGMA_PX = 6.0  # shifts change smoothly across a seam so no gap opens


def data_mask(mosaic: Gray) -> NDArray[np.bool_]:
    """True where a tile has image data (not the black fill outside the footprints)."""
    mask = (mosaic > NODATA_MAX).astype(np.uint8)
    opened = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    mask = np.asarray(
        cv2.morphologyEx(opened, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)), np.uint8
    )
    return mask.astype(bool)


def _fill_holes(image: Field, mask: NDArray[np.bool_]) -> Field:
    """Extend the data smoothly into the gaps, so the data edge has no giant gradient."""
    m = mask.astype(np.float32)
    blur = cv2.GaussianBlur(image * m, (0, 0), HOLE_FILL_SIGMA_PX)
    weight = np.maximum(cv2.GaussianBlur(m, (0, 0), HOLE_FILL_SIGMA_PX), 1e-3)
    return np.where(mask, image, blur / weight).astype(np.float32)


def _step_response(smooth: Field, valid: NDArray[np.bool_]) -> Field:
    """Strength of long straight brightness steps: signed gradient averaged along tilted lines.

    A seam keeps one sign along its whole length; natural edges flip and average out. Strips run
    nearly along the map axes, so lines within a few degrees of vertical and horizontal are tried.
    """
    length = max(5, SEAM_MIN_LENGTH_PX // SEAM_DETECT_SCALE)
    height, width = smooth.shape
    centre = (width / 2.0, height / 2.0)
    best = np.zeros_like(smooth)
    for angle in SEAM_TILTS_DEG:
        forward = cv2.getRotationMatrix2D(centre, angle, 1.0)
        back = cv2.getRotationMatrix2D(centre, -angle, 1.0)
        rotated = cv2.warpAffine(smooth, forward, (width, height), borderMode=cv2.BORDER_REFLECT)
        gx = cv2.Sobel(rotated, cv2.CV_32F, 1, 0)
        gy = cv2.Sobel(rotated, cv2.CV_32F, 0, 1)
        along_vertical = np.abs(cv2.blur(gx, (1, length)))
        along_horizontal = np.abs(cv2.blur(gy, (length, 1)))
        response = np.maximum(along_vertical, along_horizontal)
        best = np.maximum(best, cv2.warpAffine(response, back, (width, height)))
    return np.asarray(best * valid, dtype=np.float32)


def find_seams(image: Field, mask: NDArray[np.bool_]) -> NDArray[np.bool_]:
    """Pixels on the long straight edges between strips (and on the data edge)."""
    small = cv2.resize(
        image,
        None,
        fx=1 / SEAM_DETECT_SCALE,
        fy=1 / SEAM_DETECT_SCALE,
        interpolation=cv2.INTER_AREA,
    )
    small_mask = cv2.resize(
        mask.astype(np.uint8), (small.shape[1], small.shape[0]), interpolation=cv2.INTER_NEAREST
    ).astype(bool)
    response = _step_response(
        np.asarray(cv2.GaussianBlur(small, (0, 0), 1.2), dtype=np.float32), small_mask
    )
    values = response[small_mask]
    spread = 1.4826 * float(np.median(np.abs(values - np.median(values)))) + 1e-3
    seams_small = (response > np.median(values) + SEAM_SIGMAS * spread) & small_mask
    full = cv2.resize(
        seams_small.astype(np.uint8),
        (image.shape[1], image.shape[0]),
        interpolation=cv2.INTER_NEAREST,
    )
    return np.asarray(cv2.dilate(full, np.ones((SEAM_WIDTH_PX, SEAM_WIDTH_PX), np.uint8)) > 0)


def data_edge(mask: NDArray[np.bool_]) -> NDArray[np.bool_]:
    """A thin band along the edge of the data, where the gradient to the gap is not terrain."""
    as_u8 = mask.astype(np.uint8)
    ring = cv2.dilate(as_u8, np.ones((5, 5), np.uint8)) - cv2.erode(
        as_u8, np.ones((5, 5), np.uint8)
    )
    return np.asarray(ring > 0)


def remove_seams(image: Field, mask: NDArray[np.bool_], seams: NDArray[np.bool_]) -> Field:
    """Re-integrate the image with the gradients across the seams dropped (Poisson, DCT)."""
    work = _fill_holes(image, mask)
    height, width = work.shape
    dx = np.zeros_like(work)
    dy = np.zeros_like(work)
    dx[:, :-1] = work[:, 1:] - work[:, :-1]
    dy[:-1, :] = work[1:, :] - work[:-1, :]
    # On a seam, take out only the step: the gradient averaged along the seam. What is left is the
    # real texture of the ground, so the seam disappears without a smeared band in its place.
    step_x = cv2.blur(dx, (1, SEAM_STEP_RUN_PX))
    step_y = cv2.blur(dy, (SEAM_STEP_RUN_PX, 1))
    on_seam = seams.astype(np.float32)
    dx -= on_seam * step_x
    dy -= on_seam * step_y
    cut = data_edge(mask).astype(np.float32)  # no terrain gradient across the edge of the data
    dx *= 1 - np.maximum(cut, np.roll(cut, -1, axis=1))
    dy *= 1 - np.maximum(cut, np.roll(cut, -1, axis=0))
    divergence = np.zeros_like(work)
    divergence[:, 1:] += dx[:, 1:] - dx[:, :-1]
    divergence[:, 0] += dx[:, 0]
    divergence[1:, :] += dy[1:, :] - dy[:-1, :]
    divergence[0, :] += dy[0, :]
    cos_x = (2 * np.cos(np.pi * np.arange(width) / width) - 2)[None, :]
    cos_y = (2 * np.cos(np.pi * np.arange(height) / height) - 2)[:, None]
    denom = (cos_x + cos_y).astype(np.float32)
    denom[0, 0] = 1.0
    spectrum = dctn(divergence, type=2, norm="ortho") / denom
    spectrum[0, 0] = 0.0
    solved = idctn(spectrum, type=2, norm="ortho").astype(np.float32)
    solved += float(work[mask].mean() - solved[mask].mean())
    return np.asarray(np.clip(solved, 1.0, 255.0), dtype=np.float32)


def _band_pass(image: Field) -> Field:
    fine, coarse = (cv2.GaussianBlur(image, (0, 0), s) for s in BAND_PASS_SIGMAS_PX)
    return np.asarray(fine - coarse, dtype=np.float32)


def strip_pieces(
    mask: NDArray[np.bool_], seams: NDArray[np.bool_]
) -> tuple[int, NDArray[np.int32]]:
    """Label the pieces of ground between seams, dropping pieces too small to align."""
    free = (mask & ~seams & ~data_edge(mask)).astype(np.uint8)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(free)
    keep = np.zeros(count, dtype=np.int32)
    for i in range(1, count):
        if stats[i, cv2.CC_STAT_AREA] >= MIN_CELL_AREA_PX:
            keep[i] = i
    return count, np.asarray(keep[labels], dtype=np.int32)


def piece_shift(
    piece: Field, reference: Field, inside: NDArray[np.bool_]
) -> tuple[float, float, float]:
    """(dx, dy, correlation): where `piece` must move to line up with `reference`."""
    ys, xs = np.nonzero(inside)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    window = cv2.createHanningWindow((int(x1 - x0), int(y1 - y0)), cv2.CV_32F)
    a = _band_pass(piece)[y0:y1, x0:x1] * inside[y0:y1, x0:x1]
    b = _band_pass(reference)[y0:y1, x0:x1] * inside[y0:y1, x0:x1]
    (dx, dy), response = cv2.phaseCorrelate(b, a, window)
    return float(dx), float(dy), float(response)


def align_to_reference(
    image: Field, reference: Field, mask: NDArray[np.bool_], seams: NDArray[np.bool_]
) -> tuple[Field, NDArray[np.bool_], list[tuple[float, float, float]]]:
    """Shift each strip piece onto the reference; returns the image, its new mask and the shifts."""
    _, labels = strip_pieces(mask, seams)
    field_x = np.zeros(image.shape, dtype=np.float32)
    field_y = np.zeros(image.shape, dtype=np.float32)
    used: list[tuple[float, float, float]] = []
    for label in np.unique(labels[labels > 0]):
        inside = labels == label
        dx, dy, response = piece_shift(image, reference, inside)
        if response >= MIN_CORRELATION and np.hypot(dx, dy) <= MAX_SHIFT_PX:
            field_x[inside], field_y[inside] = -dx, -dy  # move back by the measured displacement
            used.append((dx, dy, response))
    if not used:
        return image, mask, used
    field_x = np.asarray(cv2.GaussianBlur(field_x, (0, 0), SHIFT_FIELD_SIGMA_PX), dtype=np.float32)
    field_y = np.asarray(cv2.GaussianBlur(field_y, (0, 0), SHIFT_FIELD_SIGMA_PX), dtype=np.float32)
    grid_x, grid_y = np.meshgrid(
        np.arange(image.shape[1], dtype=np.float32), np.arange(image.shape[0], dtype=np.float32)
    )
    moved = cv2.remap(
        image, grid_x - field_x, grid_y - field_y, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE
    )
    moved_mask = (
        cv2.remap(
            mask.astype(np.float32),
            grid_x - field_x,
            grid_y - field_y,
            cv2.INTER_LINEAR,
            borderMode=cv2.BORDER_CONSTANT,
        )
        > 0.5
    )
    return np.asarray(moved, dtype=np.float32), moved_mask, used


def band_correlation(a: Field, b: Field, where: NDArray[np.bool_]) -> float:
    """Correlation of the band-passed images over `where`: 1 is a perfect line-up of the detail."""
    if where.sum() < 100:
        return 0.0
    x, y = _band_pass(a)[where], _band_pass(b)[where]
    return float(np.corrcoef(x, y)[0, 1])


def tidy_strips(
    mosaic: Gray, reference: Gray | None = None
) -> tuple[Gray, NDArray[np.bool_], dict[str, float]]:
    """Seam-free, aligned version of a strip mosaic, its data mask, and a few numbers about it."""
    mask = data_mask(mosaic)
    if not mask.any():
        return mosaic.copy(), mask, {"seamPx": 0.0, "pieces": 0.0, "aligned": 0.0}
    image = mosaic.astype(np.float32)
    seams = find_seams(_fill_holes(image, mask), mask)
    flat = remove_seams(image, mask, seams)
    stats = {"seamPx": float(seams.sum()), "pieces": 0.0, "aligned": 0.0}
    if reference is not None:
        ref = reference.astype(np.float32)
        usable = mask & (reference > NODATA_MAX)
        stats["corrBefore"] = band_correlation(flat, ref, usable)
        flat, mask, shifts = align_to_reference(flat, ref, mask, seams)
        stats["aligned"] = float(len(shifts))
        stats["corrAfter"] = band_correlation(flat, ref, mask & (reference > NODATA_MAX))
        stats["meanShiftPx"] = (
            float(np.mean([np.hypot(dx, dy) for dx, dy, _ in shifts])) if shifts else 0.0
        )
    out = np.where(mask, np.clip(np.round(flat), 1, 255), 0).astype(np.uint8)
    return out, mask, stats
