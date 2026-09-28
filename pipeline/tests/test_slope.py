import numpy as np

from marsmap.slope import slope_deg

PIXEL_M = 20.0


def test_flat_plane_is_zero() -> None:
    assert np.allclose(slope_deg(np.zeros((5, 5)), PIXEL_M), 0.0)


def test_45_degree_ramp() -> None:
    dem = np.tile(np.arange(5, dtype=float) * PIXEL_M, (5, 1))  # rises 20 m per 20 m pixel
    assert np.isclose(slope_deg(dem, PIXEL_M)[2, 2], 45.0, atol=0.01)


def test_nan_propagates_not_zero() -> None:
    dem = np.zeros((5, 5))
    dem[2, 2] = np.nan
    slope = slope_deg(dem, PIXEL_M)
    assert np.isnan(slope[2, 2])
    assert np.isnan(slope[2, 3])


def test_output_is_float32_same_shape() -> None:
    slope = slope_deg(np.zeros((4, 6)), PIXEL_M)
    assert slope.shape == (4, 6)
    assert slope.dtype == np.float32
