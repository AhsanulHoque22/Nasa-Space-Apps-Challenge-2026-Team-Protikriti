import json
from pathlib import Path

import numpy as np
import pytest
import rasterio
from numpy.typing import NDArray
from rasterio.transform import from_origin

from marsmap.dem import Dem
from marsmap.export import export_grid, export_slope_overlay

JEZERO_EQC = (
    "+proj=eqc +lat_ts=18.4663 +lat_0=0 +lon_0=0 +x_0=0 +y_0=0 +R=3396190 +units=m +no_defs"
)
MARS_M_PER_DEG = 3_396_190.0 * np.pi / 180.0
MAX_SAFE = 15.0


@pytest.fixture
def dem() -> Dem:
    elevation = np.arange(12, dtype=np.float32).reshape(3, 4)
    elevation[1, 2] = np.nan
    x0 = 77.4 * MARS_M_PER_DEG * np.cos(np.radians(18.4663))
    y0 = 18.5 * MARS_M_PER_DEG
    return Dem(elevation, 20.0, from_origin(x0, y0, 20.0, 20.0), JEZERO_EQC)


def test_grid_bin_round_trips(dem: Dem, tmp_path: Path) -> None:
    export_grid(dem, tmp_path, MAX_SAFE)
    back = np.fromfile(tmp_path / "grid.bin", dtype="<f4").reshape(3, 4)
    assert np.array_equal(back, dem.elevation_m, equal_nan=True)


def test_grid_json_metadata(dem: Dem, tmp_path: Path) -> None:
    export_grid(dem, tmp_path, MAX_SAFE)
    meta = json.loads((tmp_path / "grid.json").read_text())
    assert (meta["width"], meta["height"], meta["pixel_size_m"]) == (4, 3, 20.0)
    assert meta["max_safe_slope_deg"] == MAX_SAFE
    assert meta["west"] == pytest.approx(77.4)
    assert meta["north"] == pytest.approx(18.5)
    lat_scale = np.cos(np.radians(18.4663))
    assert meta["east"] == pytest.approx(77.4 + 80.0 / (MARS_M_PER_DEG * lat_scale))
    assert meta["south"] == pytest.approx(18.5 - 60.0 / MARS_M_PER_DEG)
    assert "eqc" in meta["crs"]


def read_alpha(path: Path) -> NDArray[np.uint8]:
    with rasterio.open(path) as src:
        assert src.count == 4
        alpha: NDArray[np.uint8] = src.read(4)
        return alpha


@pytest.mark.filterwarnings("ignore::rasterio.errors.NotGeoreferencedWarning")
def test_overlay_safe_is_transparent_hazard_is_visible(tmp_path: Path) -> None:
    slope = np.array([[5.0, 30.0], [np.nan, 14.9]], dtype=np.float32)
    out = tmp_path / "slope_hazard.png"
    export_slope_overlay(slope, out, MAX_SAFE)
    alpha = read_alpha(out)
    assert alpha[0, 0] == 0
    assert alpha[0, 1] > 0
    assert alpha[1, 0] > 0  # nodata is a hazard, never "safe"
    assert alpha[1, 1] == 0
