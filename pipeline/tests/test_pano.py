import math

import cv2
import numpy as np
import pytest
from numpy.typing import NDArray

from marsmap.cahvore import Array, Cahvore
from marsmap.pano import View, fill_holes, refine_rotations, render

FRAME_W, FRAME_H = 320, 240
WORLD_W = 1024
# Navcam-like: fish-eye (linearity 0) with Perseverance's radial terms, ~90 degrees across.
MODEL = Cahvore(
    a=(0, 0, 1),
    h=(200, 0, FRAME_W / 2),
    v=(0, 200, FRAME_H / 2),
    o=(0, 0, 1),
    r=(2e-06, 0.049535, -0.015973),
    linearity=0.0,
)


def _world() -> NDArray[np.uint8]:
    """A deterministic textured sphere (equirectangular) with features at many scales."""
    rng = np.random.default_rng(1)
    h, w = WORLD_W // 2, WORLD_W
    img = np.zeros((h, w), np.float32)
    for size in (4, 16, 64):
        noise = cv2.resize(rng.random((h // size, w // size), dtype=np.float32), (w, h))
        img += noise * size
    img = (img - img.min()) / (img.max() - img.min()) * 255
    for _ in range(300):  # sharp blobs give SIFT something to lock on
        c = (int(rng.integers(0, w)), int(rng.integers(h // 4, 3 * h // 4)))
        cv2.circle(img, c, int(rng.integers(2, 8)), float(rng.integers(0, 255)), -1)
    return np.asarray(cv2.cvtColor(img.astype(np.uint8), cv2.COLOR_GRAY2BGR), np.uint8)


def _rotation(az_deg: float, el_deg: float) -> Array:
    """Model frame (x right, y down, z forward) -> world (x east, y up, z north)."""
    az, el = math.radians(az_deg), math.radians(el_deg)
    f = [math.cos(el) * math.sin(az), math.sin(el), math.cos(el) * math.cos(az)]
    r = [math.cos(az), 0, -math.sin(az)]
    u = [-math.sin(el) * math.sin(az), math.cos(el), -math.sin(el) * math.cos(az)]
    return np.array([r, [-x for x in u], f]).T


def _shoot(world: NDArray[np.uint8], rotation: Array) -> NDArray[np.uint8]:
    ys, xs = np.mgrid[0:FRAME_H, 0:FRAME_W].astype(np.float64)
    # JPL image coordinates put the first pixel's centre at (0, 0), as OpenCV does.
    d = MODEL.backproject(np.stack([xs.ravel(), ys.ravel()], 1)) @ rotation.T
    az = np.arctan2(d[:, 0], d[:, 2]) % (2 * np.pi)
    el = np.arcsin(np.clip(d[:, 1], -1, 1))
    mx = (az / (2 * np.pi) * WORLD_W - 0.5).reshape(FRAME_H, FRAME_W).astype(np.float32)
    my = ((0.5 - el / np.pi) * WORLD_W / 2 - 0.5).reshape(FRAME_H, FRAME_W).astype(np.float32)
    out = cv2.remap(world, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_WRAP)
    return np.asarray(out, np.uint8)


def _ring(world: NDArray[np.uint8], perturb_deg: float) -> tuple[list[View], list[Array]]:
    rng = np.random.default_rng(2)
    views, truth = [], []
    for k, az in enumerate(range(0, 360, 45)):
        true = _rotation(az, 5)
        noise, _ = cv2.Rodrigues(rng.normal(0, math.radians(perturb_deg), 3))
        views.append(View(_shoot(world, true), MODEL, noise @ true, group=str(k)))
        truth.append(true)
    return views, truth


def _angle_deg(a: Array, b: Array) -> float:
    return math.degrees(np.linalg.norm(cv2.Rodrigues(a @ b.T)[0]))


def _relative_error_deg(rotations: list[Array], truth: list[Array]) -> float:
    """Worst error in the frames' pointing relative to frame 0 (blind to a global rotation)."""
    return max(
        _angle_deg(r.T @ rotations[0], t.T @ truth[0])
        for r, t in zip(rotations, truth, strict=True)
    )


def test_refinement_recovers_the_true_relative_pointing() -> None:
    views, truth = _ring(_world(), perturb_deg=1.0)
    before = _relative_error_deg([v.rotation for v in views], truth)
    rotations, report = refine_rotations(views)
    assert before > 0.5
    assert _relative_error_deg(rotations, truth) < 0.1
    assert report.pairs >= 7  # the neighbours around the ring
    assert report.rms_after_deg < report.rms_before_deg


def test_frames_without_overlap_keep_their_pointing() -> None:
    world = _world()
    lone = [View(_shoot(world, _rotation(a, 0)), MODEL, _rotation(a, 0), str(a)) for a in (0, 180)]
    rotations, report = refine_rotations(lone)
    assert report.pairs == 0
    for v, r in zip(lone, rotations, strict=True):
        assert _angle_deg(v.rotation, r) < 1e-9


def test_render_reproduces_the_world_where_frames_look() -> None:
    world = _world()
    views, truth = _ring(world, perturb_deg=0.0)
    pano, covered = render(views, truth, width=WORLD_W)
    assert pano.shape == (WORLD_W // 2, WORLD_W, 3)
    band = slice(WORLD_W // 2 // 2 - 60, WORLD_W // 2 // 2 + 60)  # +-21 degrees about the horizon
    assert covered[band].all()
    diff = np.abs(pano[band].astype(int) - world[band].astype(int))
    assert diff.mean() < 6  # blending and resampling soften, but nothing is misplaced


def test_render_fills_the_unseen_sphere() -> None:
    views, truth = _ring(_world(), perturb_deg=0.0)
    pano, covered = render(views, truth, width=512)
    assert not covered.all()  # the poles were never photographed
    assert pano.min() >= 0 and np.isfinite(pano).all()
    assert pano[0].std() > 0 or pano[0].mean() > 0  # zenith is painted, not left black


def test_fill_holes_extends_the_known_colour() -> None:
    img = np.full((64, 128, 3), 100, np.float32)
    known = np.zeros((64, 128), bool)
    known[20:40] = True
    filled = fill_holes(img * known[..., None], known)
    assert filled == pytest.approx(np.full_like(img, 100), abs=1)


def test_render_evens_out_frames_exposed_differently() -> None:
    world = _world()
    views, truth = _ring(world, perturb_deg=0.0)
    dim = views[3]
    views[3] = View((dim.image * 0.45).astype(np.uint8), dim.model, dim.rotation, dim.group)
    pano, _ = render(views, truth, width=WORLD_W)
    band = slice(WORLD_W // 4 - 60, WORLD_W // 4 + 60)
    # The overall level is a choice (render keeps the frames' mean), so compare after removing it.
    level = world[band].mean() / pano[band].mean()
    # Frame 3 looks at 135 degrees: its stretch of the horizon must match the world again.
    cols = slice(int(120 / 360 * WORLD_W), int(150 / 360 * WORLD_W))
    assert np.abs(pano[band, cols] * level - world[band, cols]).mean() < 8


def test_sky_only_frames_are_recognised() -> None:
    from marsmap.pano import shows_ground

    blank = np.zeros((FRAME_H, FRAME_W, 3), np.uint8)
    # ~90 degrees across: a frame aimed 60 degrees up never reaches the horizon.
    assert not shows_ground(View(blank, MODEL, _rotation(0, 60), "a"))
    assert shows_ground(View(blank, MODEL, _rotation(0, 30), "b"))
    assert shows_ground(View(blank, MODEL, _rotation(0, -40), "c"))
