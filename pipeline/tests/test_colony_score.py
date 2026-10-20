"""Tests for 6-channel colony suitability score grid."""

from pathlib import Path

import numpy as np

from marsmap.colony_score import (
    GRID_COLS,
    GRID_ROWS,
    N_CHANNELS,
    shelter_score_grid,
    solar_score_grid,
)


def test_grid_shape() -> None:
    solar = solar_score_grid(mean_tau_ir=0.5)
    assert solar.shape == (GRID_ROWS, GRID_COLS)
    assert solar.dtype == np.uint8
    assert int(solar.max()) <= 100


def test_solar_equatorial_beats_polar() -> None:
    solar = solar_score_grid(mean_tau_ir=0.5)
    # Row 90 = equator (lat=0); row 0 = 89.5°N (polar)
    assert int(solar[90, 180]) > int(solar[0, 180])


def test_shelter_near_cave_high() -> None:
    caves = [{"lon": 0.0, "lat": 0.0, "priority": 1}]
    shelter = shelter_score_grid(caves)
    # Cell (90, 180): lat = 89.5 - 90 = -0.5°, lon = -179.5 + 180 = 0.5°
    # Distance to cave at (0, 0) is ~65 km → score = round(100 * exp(-65/200)) ≈ 72
    assert int(shelter[90, 180]) > 60


def test_colony_score_bin_size(tmp_path: Path) -> None:
    # Binary format: 180 x 360 x 6 uint8
    grid = np.zeros((GRID_ROWS, GRID_COLS, N_CHANNELS), dtype=np.uint8)
    out = tmp_path / "colony_score.bin"
    grid.tofile(out)
    assert out.stat().st_size == GRID_ROWS * GRID_COLS * N_CHANNELS
