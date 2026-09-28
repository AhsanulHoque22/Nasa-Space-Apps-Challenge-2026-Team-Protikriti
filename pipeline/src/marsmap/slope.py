"""Terrain slope from an elevation grid."""

import numpy as np
from numpy.typing import NDArray


def slope_deg(elevation_m: NDArray[np.floating], pixel_size_m: float) -> NDArray[np.float32]:
    """Slope angle in degrees for each cell of a square-pixel elevation grid.

    Uses central differences (one-sided at edges). NaN (nodata) propagates to the
    cell and its neighbours, so gaps are never mistaken for flat, safe ground.
    """
    elevation = elevation_m.astype(np.float64)
    dz_dy, dz_dx = np.gradient(elevation, pixel_size_m)
    slope: NDArray[np.float64] = np.degrees(np.arctan(np.hypot(dz_dx, dz_dy)))
    # Central differences skip the centre cell, so a lone NaN would not mark itself.
    slope[np.isnan(elevation)] = np.nan
    return slope.astype(np.float32)
