"""The strip tidy-up removes seams and misalignment without changing what the ground looks like."""

import cv2
import numpy as np

from marsmap.strips import (
    align_to_reference,
    band_correlation,
    data_mask,
    find_seams,
    remove_seams,
    tidy_strips,
)

N = 512


def _terrain(seed: int = 0, size: int = N) -> np.ndarray:
    """Fractal-ish ground: broad swells plus fine detail, like real orbital imagery."""
    rng = np.random.default_rng(seed)
    noise = lambda sigma: cv2.GaussianBlur(  # noqa: E731
        rng.normal(0, 1, (size, size)).astype(np.float32), (0, 0), sigma
    )
    layers = [(14.0, 1.0), (6.0, 0.8), (2.5, 0.5)]
    field = sum(weight * (n := noise(sigma)) / n.std() for sigma, weight in layers)
    return np.asarray(110 + 35 * field / field.std(), dtype=np.float32)


def _two_strips(offset: float = 45.0) -> tuple[np.ndarray, np.ndarray]:
    ground = _terrain()
    image = ground.copy()
    image[:, N // 2 :] += offset  # right strip was exposed brighter
    return np.clip(image, 5, 250).astype(np.float32), ground


def _step(image: np.ndarray, col: int = N // 2) -> float:
    return float(abs(image[:, col + 6 : col + 20].mean() - image[:, col - 20 : col - 6].mean()))


def test_data_mask_ignores_black_fill() -> None:
    mosaic = np.zeros((64, 64), np.uint8)
    mosaic[10:50, 10:50] = 120
    mask = data_mask(mosaic)
    assert mask[30, 30] and not mask[2, 2]


def test_find_seams_marks_a_long_straight_step() -> None:
    image, _ = _two_strips(offset=110.0)  # a clearly exposed-differently strip
    mask = np.ones(image.shape, dtype=bool)
    seams = find_seams(image, mask)
    assert seams[100:400, N // 2 - 6 : N // 2 + 6].any(axis=1).mean() > 0.8
    assert not seams[100:400, 40:80].any()  # open ground far from the seam


def test_remove_seams_cuts_the_brightness_step_and_keeps_detail() -> None:
    image, _ = _two_strips()
    mask = np.ones(image.shape, dtype=bool)
    seams = np.zeros(image.shape, dtype=bool)
    seams[:, N // 2 - 2 : N // 2 + 3] = True  # as find_seams would mark it
    flat = remove_seams(image, mask, seams)
    assert _step(image) > 25
    assert _step(flat) < 10
    detail = lambda a: cv2.GaussianBlur(a, (0, 0), 1.0) - cv2.GaussianBlur(a, (0, 0), 6.0)  # noqa: E731
    left = (slice(40, 460), slice(40, 200))
    corr = np.corrcoef(detail(image)[left].ravel(), detail(flat)[left].ravel())[0, 1]
    assert corr > 0.95


def test_a_shifted_strip_is_moved_back_onto_the_reference() -> None:
    reference = _terrain(1)
    shift_x, shift_y = 3, -2
    piece = np.roll(reference, (shift_y, shift_x), axis=(0, 1))
    mask = np.ones(reference.shape, dtype=bool)
    none = np.zeros(reference.shape, dtype=bool)
    moved, _, used = align_to_reference(piece, reference, mask, none)
    inner = (slice(40, N - 40), slice(40, N - 40))
    before = np.abs(piece - reference)[inner].mean()
    after = np.abs(moved - reference)[inner].mean()
    assert used and after < 0.5 * before


def test_a_wild_offset_is_not_applied() -> None:
    reference = _terrain(2)
    piece = np.roll(reference, 60, axis=1)  # far past the 8 px limit: a bad match, not an offset
    mask = np.ones(reference.shape, dtype=bool)
    moved, _, used = align_to_reference(piece, reference, mask, np.zeros_like(mask))
    assert not used and np.array_equal(moved, piece)


def test_tidy_strips_keeps_gaps_empty_and_never_makes_data_up() -> None:
    image, _ = _two_strips()
    mosaic = np.clip(image, 6, 250).astype(np.uint8)
    mosaic[:, 200:230] = 0  # a gap between observations
    out, mask, stats = tidy_strips(mosaic)
    assert not mask[:, 205:225].any() and (out[:, 205:225] == 0).all()
    assert mask[:, 20:180].all() and (out[:, 20:180] > 0).all()
    assert stats["seamPx"] > 0


def test_alignment_raises_the_correlation_with_the_reference() -> None:
    reference = _terrain(3)
    piece = np.roll(reference, (-2, 3), axis=(0, 1))
    mask = np.ones(reference.shape, dtype=bool)
    moved, _, _ = align_to_reference(piece, reference, mask, np.zeros_like(mask))
    inner = np.zeros(reference.shape, dtype=bool)
    inner[40:-40, 40:-40] = True
    assert (
        band_correlation(moved, reference, inner) > band_correlation(piece, reference, inner) + 0.1
    )


def test_a_step_with_texture_loses_only_the_step() -> None:
    """The dark stripe between strips goes; the ground texture across it stays."""
    ground = _terrain(4)
    image = ground.copy()
    image[:, 250:262] -= 40.0  # a dark vertical stripe like the one in Jezero
    mask = np.ones(image.shape, dtype=bool)
    seams = np.zeros(image.shape, dtype=bool)
    seams[:, 244:268] = True
    flat = remove_seams(image, mask, seams)
    dark = flat[100:400, 252:260].mean() - flat[100:400, 232:240].mean()
    texture_ground = cv2.Laplacian(ground[100:400, 244:268], cv2.CV_32F).std()
    texture_after = cv2.Laplacian(flat[100:400, 244:268], cv2.CV_32F).std()
    assert abs(dark) < 12 and texture_after > 0.6 * texture_ground
