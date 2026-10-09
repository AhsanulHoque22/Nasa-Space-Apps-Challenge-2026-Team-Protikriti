"""Where is terrain? Sky and the rover's own body are not terrain, so labels must skip both.

Sky: the skyline is the strongest bright-to-dark step in each column near the horizon.
Rover: the body is fixed in the rover's frame, so across many stops (aligned by each stop's yaw)
it survives in the median image while terrain averages out smooth; the mask is its outline.
"""

from __future__ import annotations

import cv2
import numpy as np
from numpy.typing import NDArray
from scipy.ndimage import median_filter  # type: ignore[import-untyped]

MIN_EL_DEG = -50.0  # below this the panorama is hole-filled nadir, not photographed ground
SKY_SEARCH_EL_DEG = (14.0, -8.0)  # the horizon, including hills and haze, lies in this window
DEFAULT_HORIZON_EL_DEG = 5.0  # used for columns with no visible horizon edge
MIN_HORIZON_STEP = 4.0  # grey levels: weaker steps are noise, not a horizon
HORIZON_EDGE_ROWS = 3  # compare the rows this far above and below a candidate horizon row
SKYLINE_SMOOTHING_COLS = 31  # median over neighbouring columns drops single-column outliers

ROVER_EDGE_STRENGTH = 10.0  # Sobel magnitude of the median image that counts as rover structure
ROVER_SAMPLE_STOPS = 150  # stops averaged to find the rover; more adds nothing
ROVER_TOP_EL_DEG = (
    5.0  # rover structure above the horizon is the mast against sky: not terrain anyway
)
ROVER_GROW_PX = 31  # dilate edges into solid body
ROVER_CLOSE_PX = 41  # bridge gaps between parts
ROVER_OPEN_PX = 41  # drop thin strips such as the horizon line itself
ROVER_SHRINK_PX = 15  # undo the growth at the outline


def row_of_elevation(el_deg: float, height: int) -> int:
    return round((90.0 - el_deg) / 180.0 * height - 0.5)


def skyline_rows(panorama: NDArray[np.uint8]) -> NDArray[np.int64]:
    """Row of the skyline in every column; rows at or above it are sky."""
    h, w = panorama.shape[:2]
    gray = cv2.cvtColor(panorama, cv2.COLOR_BGR2GRAY).astype(np.float32)
    smooth = cv2.GaussianBlur(gray, (0, 0), sigmaX=1.0, sigmaY=2.0)
    top = row_of_elevation(SKY_SEARCH_EL_DEG[0], h)
    bottom = row_of_elevation(SKY_SEARCH_EL_DEG[1], h)
    k = HORIZON_EDGE_ROWS
    rows = np.arange(top, bottom + 1)
    drop = smooth[rows - k] - smooth[rows + k]  # sky is brighter than the ground below it
    best = drop.argmax(axis=0)
    strength = drop.max(axis=0)
    candidate = (rows[best]).astype(np.int64)
    strong = strength >= MIN_HORIZON_STEP
    fallback = (
        int(np.median(candidate[strong]))
        if strong.any()
        else row_of_elevation(DEFAULT_HORIZON_EL_DEG, h)
    )
    line = np.where(strong, candidate, fallback)
    smoothed = median_filter(line, size=SKYLINE_SMOOTHING_COLS, mode="wrap")
    return np.asarray(smoothed, dtype=np.int64).reshape(w)


def roll_to_rover_frame(image: NDArray[np.generic], yaw_deg: float) -> NDArray[np.generic]:
    """World-frame panorama (azimuth from north) to rover frame (azimuth from the rover's nose)."""
    w = image.shape[1]
    return np.asarray(np.roll(image, -round(yaw_deg / 360.0 * w), axis=1))


def roll_to_world_frame(image: NDArray[np.generic], yaw_deg: float) -> NDArray[np.generic]:
    w = image.shape[1]
    return np.roll(image, round(yaw_deg / 360.0 * w), axis=1)


def _ellipse(size: int) -> NDArray[np.uint8]:
    return np.asarray(cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (size, size)), dtype=np.uint8)


def build_rover_mask(median_gray: NDArray[np.uint8]) -> NDArray[np.bool_]:
    """Rover outline (rover frame) from the median of many aligned stops."""
    h = median_gray.shape[0]
    blurred = cv2.GaussianBlur(median_gray.astype(np.float32), (0, 0), 1.5)
    edges = np.hypot(cv2.Sobel(blurred, cv2.CV_32F, 1, 0), cv2.Sobel(blurred, cv2.CV_32F, 0, 1))
    mask = (edges > ROVER_EDGE_STRENGTH).astype(np.uint8)
    mask[: row_of_elevation(ROVER_TOP_EL_DEG, h)] = 0
    mask = np.asarray(cv2.dilate(mask, _ellipse(ROVER_GROW_PX)), dtype=np.uint8)
    mask = np.asarray(
        cv2.morphologyEx(mask, cv2.MORPH_CLOSE, _ellipse(ROVER_CLOSE_PX)), dtype=np.uint8
    )
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    solid = np.zeros_like(mask)
    cv2.drawContours(solid, contours, -1, 1, thickness=-1)  # fill the outline: a body, not a ring
    solid = np.asarray(
        cv2.morphologyEx(solid, cv2.MORPH_OPEN, _ellipse(ROVER_OPEN_PX)), dtype=np.uint8
    )
    return cv2.erode(solid, _ellipse(ROVER_SHRINK_PX)).astype(bool)


def median_in_rover_frame(
    grays: list[NDArray[np.uint8]], yaws_deg: list[float]
) -> NDArray[np.uint8]:
    """Median over stops, each rolled into the rover frame by its yaw."""
    aligned = [roll_to_rover_frame(g, y) for g, y in zip(grays, yaws_deg, strict=True)]
    return np.asarray(np.median(np.stack(aligned), axis=0), dtype=np.uint8)


def terrain_mask(
    panorama: NDArray[np.uint8], rover_world: NDArray[np.bool_] | None = None
) -> NDArray[np.bool_]:
    """True where a pixel is ground: below the skyline, above the nadir fill, off the rover."""
    h, w = panorama.shape[:2]
    rows = np.arange(h)[:, None]
    ground = rows > skyline_rows(panorama)[None, :]
    ground &= rows <= row_of_elevation(MIN_EL_DEG, h)
    if rover_world is not None:
        ground &= ~rover_world
    return np.asarray(ground & np.ones((h, w), dtype=bool))
