"""Tests for classify.py — terrain classification on pre-stitched panoramas."""
import numpy as np
import pytest

from marsmap.classify import (
    NONE,
    LabelFrame,
    extract_features,
    infer_full_grid,
    project_labels,
    render_labels_png,
    train_classifier,
)


# ── project_labels ────────────────────────────────────────────────────────────

def test_project_labels_empty():
    grid = project_labels([], out_width=64)
    assert grid.shape == (32, 64)
    assert (grid == NONE).all()


def test_project_labels_sky_frame_produces_none():
    """A frame pointing at el=80° (sky) must produce all NONE after elevation clamp."""
    cls = np.zeros((8, 8), dtype=np.uint8)
    frame = LabelFrame(cls=cls, width=8, height=8,
                       az_deg=0, el_deg=80, width_deg=60, height_deg=60)
    grid = project_labels([frame], out_width=64)
    assert (grid == NONE).all()


def test_project_labels_extreme_nadir_stays_none():
    """Pixels at el < -50° must stay NONE even when a frame looks downward.

    A frame at el=-70° with 60° FOV can still reach el=-40° (top edge), which is
    within the label band — that's fine. But el=-80° and below must stay NONE.
    """
    cls = np.zeros((8, 8), dtype=np.uint8)
    frame = LabelFrame(cls=cls, width=8, height=8,
                       az_deg=0, el_deg=-70, width_deg=60, height_deg=60)
    grid = project_labels([frame], out_width=64)
    # y=31 is the bottom row: el = 90 - (31.5/32)*180 ≈ -87° — must stay NONE
    assert grid[31, 0] == NONE


def test_project_labels_forward_frame_labels_centre():
    """A frame at az=0, el=0 with 90° FOV must label pixels near az=0, el=0."""
    cls = np.zeros((16, 16), dtype=np.uint8)  # all soil
    frame = LabelFrame(cls=cls, width=16, height=16,
                       az_deg=0, el_deg=0, width_deg=90, height_deg=90)
    grid = project_labels([frame], out_width=128)
    # el=0 row is at y = height//2 = 32
    el0_row = 32
    assert grid[el0_row, 0] == 0  # az=0 → x=0 in our convention


# ── extract_features ──────────────────────────────────────────────────────────

def test_extract_features_no_labels():
    pano = np.zeros((512, 1024, 3), dtype=np.uint8)
    grid = np.full((512, 1024), NONE, dtype=np.uint8)
    X, y = extract_features(pano, grid)
    assert X.shape == (0, 7)
    assert y.shape == (0,)


def test_extract_features_one_pixel():
    pano = np.zeros((512, 1024, 3), dtype=np.uint8)
    grid = np.full((512, 1024), NONE, dtype=np.uint8)
    # Place a labeled pixel at the horizon row, middle column
    row = 256  # el ≈ 0°
    grid[row, 512] = 0
    X, y = extract_features(pano, grid)
    assert X.shape == (1, 7)
    assert y[0] == 0


def test_extract_features_sky_pixel_excluded():
    pano = np.zeros((512, 1024, 3), dtype=np.uint8)
    grid = np.full((512, 1024), NONE, dtype=np.uint8)
    # Place a labeled pixel at y=0 (el=90°, sky) — must be excluded
    grid[0, 512] = 0
    X, y = extract_features(pano, grid)
    assert X.shape == (0, 7)


# ── train_classifier ──────────────────────────────────────────────────────────

def test_train_classifier_big_rock_recall():
    """With balanced weights big-rock recall must not be zero on training data."""
    rng = np.random.default_rng(0)
    X = rng.standard_normal((1000, 7)).astype(np.float32)
    y = np.zeros(1000, dtype=np.uint8)
    y[:100] = 3  # big rock — 10% of data
    clf = train_classifier(X, y)
    pred = clf.predict(X[:100]).astype(np.uint8)
    assert (pred == 3).any(), "big rock recall must not be zero with balanced weights"


# ── infer_full_grid ───────────────────────────────────────────────────────────

def _simple_clf() -> object:
    """Tiny RF trained on synthetic data to use in other tests."""
    rng = np.random.default_rng(1)
    X = rng.standard_normal((400, 7)).astype(np.float32)
    y = np.tile(np.arange(4, dtype=np.uint8), 100)
    return train_classifier(X, y)


def test_infer_full_grid_fills_elevation_band():
    pano = np.zeros((512, 1024, 3), dtype=np.uint8)
    human = np.full((512, 1024), NONE, dtype=np.uint8)
    clf = _simple_clf()
    result = infer_full_grid(pano, clf, human)
    # Every pixel in [-50°, +20°] must be classified (not NONE)
    for yi in range(512):
        el = 90.0 - (yi + 0.5) / 512 * 180.0
        if -50 <= el <= 20:
            assert result[yi, 0] < NONE, f"row {yi} (el={el:.1f}°) still NONE"


def test_infer_full_grid_human_labels_take_priority():
    pano = np.zeros((512, 1024, 3), dtype=np.uint8)
    human = np.full((512, 1024), NONE, dtype=np.uint8)
    human[256, 0] = 2  # sand — should survive in output
    clf = _simple_clf()
    result = infer_full_grid(pano, clf, human)
    assert result[256, 0] == 2


def test_infer_full_grid_sky_stays_none():
    pano = np.zeros((512, 1024, 3), dtype=np.uint8)
    human = np.full((512, 1024), NONE, dtype=np.uint8)
    clf = _simple_clf()
    result = infer_full_grid(pano, clf, human)
    # y=0 is el=90° — sky, must stay NONE
    assert result[0, 0] == NONE


# ── render_labels_png ─────────────────────────────────────────────────────────

def test_render_labels_png_transparent_for_none():
    import cv2
    grid = np.full((4, 8), NONE, dtype=np.uint8)
    data = render_labels_png(grid)
    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_UNCHANGED)
    assert img.shape == (4, 8, 4)
    assert (img[:, :, 3] == 0).all()


def test_render_labels_png_opaque_for_labeled():
    import cv2
    grid = np.full((4, 8), NONE, dtype=np.uint8)
    grid[2, 4] = 0  # soil
    data = render_labels_png(grid)
    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_UNCHANGED)
    assert img[2, 4, 3] == 255


def test_render_labels_png_soil_colour():
    """Soil (#c98500) must encode as B=0x00, G=0x85, R=0xC9 in OpenCV BGR."""
    import cv2
    grid = np.zeros((4, 8), dtype=np.uint8)  # all soil
    data = render_labels_png(grid)
    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_UNCHANGED)
    assert img[0, 0, 0] == 0x00  # B
    assert img[0, 0, 1] == 0x85  # G
    assert img[0, 0, 2] == 0xC9  # R
