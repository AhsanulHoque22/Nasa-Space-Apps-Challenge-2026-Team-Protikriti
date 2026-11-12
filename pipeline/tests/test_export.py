import json
from pathlib import Path

import numpy as np
import pytest
import rasterio
from numpy.typing import NDArray
from rasterio.transform import from_origin

from marsmap.dem import Dem
from marsmap.export import export_grid, export_slope_overlay, read_grid

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


def test_grid_bin_round_trips_within_half_a_step(dem: Dem, tmp_path: Path) -> None:
    export_grid(dem, tmp_path, MAX_SAFE)
    assert (tmp_path / "grid.bin").stat().st_size == 12 * 2  # int16: half the float32 bytes
    meta, back = read_grid(tmp_path)
    assert meta["height_step_m"] == pytest.approx(0.02)
    assert np.isnan(back[1, 2])
    finite = np.isfinite(dem.elevation_m)
    assert np.isnan(back[~finite]).all()
    assert np.abs(back[finite] - dem.elevation_m[finite]).max() <= 0.01 + 1e-6


def test_tall_relief_gets_a_coarser_step_that_still_fits(tmp_path: Path, dem: Dem) -> None:
    # Gale crater: Mount Sharp rises about 2 km over the grid, beyond 2 cm int16 steps.
    dem.elevation_m[:] = -4000.0
    dem.elevation_m[0, 0], dem.elevation_m[2, 3] = -4500.0, -2478.0
    export_grid(dem, tmp_path, MAX_SAFE)
    meta, back = read_grid(tmp_path)
    assert meta["height_step_m"] == pytest.approx(0.04)
    assert back[0, 0] == pytest.approx(-4500.0, abs=0.02)
    assert back[2, 3] == pytest.approx(-2478.0, abs=0.02)


def test_grid_with_no_data_is_rejected(tmp_path: Path, dem: Dem) -> None:
    dem.elevation_m[:] = np.nan
    with pytest.raises(ValueError, match="no data"):
        export_grid(dem, tmp_path, MAX_SAFE)


def test_read_grid_rejects_a_size_mismatch(dem: Dem, tmp_path: Path) -> None:
    export_grid(dem, tmp_path, MAX_SAFE)
    (tmp_path / "grid.bin").write_bytes(b"\0" * 12)
    with pytest.raises(ValueError, match="expected 12"):
        read_grid(tmp_path)


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
    assert alpha[1, 0] == 0  # nodata (NaN slope) is transparent, not a hazard
    assert alpha[1, 1] == 0
