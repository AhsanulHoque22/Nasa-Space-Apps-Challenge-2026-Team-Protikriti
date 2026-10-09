"""Sky and rover masks keep labels off everything that is not photographed ground."""

import numpy as np

from marsmap.terrain_mask import (
    build_rover_mask,
    median_in_rover_frame,
    roll_to_rover_frame,
    roll_to_world_frame,
    row_of_elevation,
    skyline_rows,
    terrain_mask,
)

H, W = 512, 1024


def _scene(horizon_row: int) -> np.ndarray:
    pano = np.full((H, W, 3), 60, dtype=np.uint8)  # dark ground
    pano[:horizon_row] = 200  # bright sky
    return pano


def test_skyline_found_where_bright_sky_meets_dark_ground() -> None:
    line = skyline_rows(_scene(240))
    assert np.all(np.abs(line - 240) <= 3)


def test_skyline_without_an_edge_uses_the_default_horizon() -> None:
    line = skyline_rows(np.full((H, W, 3), 128, dtype=np.uint8))
    assert np.all(line == row_of_elevation(5.0, H))


def test_terrain_mask_excludes_sky_nadir_and_rover() -> None:
    rover = np.zeros((H, W), dtype=bool)
    rover[300:350, 100:200] = True
    t = terrain_mask(_scene(240), rover)
    assert not t[100, 500]  # sky
    assert not t[500, 500]  # nadir fill
    assert not t[320, 150]  # rover body
    assert t[320, 500]  # open ground


def test_rolls_are_inverses() -> None:
    img = np.arange(H * W, dtype=np.uint32).reshape(H, W)
    assert np.array_equal(roll_to_world_frame(roll_to_rover_frame(img, 73.0), 73.0), img)


def test_rover_mask_finds_a_structure_that_stays_put_across_stops() -> None:
    rng = np.random.default_rng(0)
    grays, yaws = [], []
    for yaw in np.linspace(0, 340, 21):
        g = rng.integers(90, 110, (H, W), dtype=np.uint8)  # terrain: different every stop
        body = np.roll(np.zeros((H, W), dtype=bool), 0)
        body[300:420, 400:520] = True
        stop = np.roll(g, round(yaw / 360 * W), axis=1)  # world frame
        stop = np.roll(np.where(np.roll(body, round(yaw / 360 * W), axis=1), 230, stop), 0, axis=1)
        grays.append(stop.astype(np.uint8))
        yaws.append(float(yaw))
    mask = build_rover_mask(median_in_rover_frame(grays, yaws))
    assert mask[360, 460]  # inside the body
    assert not mask[360, 800]  # open ground
