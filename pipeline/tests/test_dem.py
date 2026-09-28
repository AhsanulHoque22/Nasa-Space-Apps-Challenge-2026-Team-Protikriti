from pathlib import Path

import numpy as np
import pytest
import rasterio
from rasterio.transform import from_origin
from rasterio.warp import transform_bounds

from marsmap.dem import MARS_LONLAT, load_dem

# Same projection as the USGS Jezero CTX DEM mosaic.
JEZERO_EQC = (
    "+proj=eqc +lat_ts=18.4663 +lat_0=0 +lon_0=0 +x_0=0 +y_0=0 +R=3396190 +units=m +no_defs"
)
PIXEL_M = 20.0
X0, Y0 = 4_330_000.0, 1_100_000.0
NODATA = -9999.0


@pytest.fixture
def dem_path(tmp_path: Path) -> Path:
    elevation = np.arange(100, dtype=np.float32).reshape(10, 10) - 2500.0
    elevation[4, 4] = NODATA
    path = tmp_path / "dem.tif"
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        width=10,
        height=10,
        count=1,
        dtype="float32",
        crs=JEZERO_EQC,
        transform=from_origin(X0, Y0, PIXEL_M, PIXEL_M),
        nodata=NODATA,
    ) as dst:
        dst.write(elevation, 1)
    return path


def lonlat_box(col0: int, row0: int, col1: int, row1: int) -> tuple[float, float, float, float]:
    """Lon/lat bounds of the pixel block [row0:row1, col0:col1] of the fixture."""
    west, south, east, north = transform_bounds(
        JEZERO_EQC,
        MARS_LONLAT,
        X0 + col0 * PIXEL_M,
        Y0 - row1 * PIXEL_M,
        X0 + col1 * PIXEL_M,
        Y0 - row0 * PIXEL_M,
    )
    return float(west), float(south), float(east), float(north)


def test_crop_returns_requested_block(dem_path: Path) -> None:
    dem = load_dem(dem_path, lonlat_box(2, 2, 7, 7))
    assert dem.elevation_m.shape == (5, 5)
    assert dem.elevation_m[0, 0] == pytest.approx(22 - 2500.0)


def test_nodata_becomes_nan(dem_path: Path) -> None:
    dem = load_dem(dem_path, lonlat_box(2, 2, 7, 7))
    assert np.isnan(dem.elevation_m[2, 2])  # source pixel (4, 4)


def test_pixel_size_and_crs(dem_path: Path) -> None:
    dem = load_dem(dem_path, lonlat_box(0, 0, 10, 10))
    assert dem.pixel_size_m == PIXEL_M
    assert "eqc" in dem.crs


def test_aoi_outside_extent_raises(dem_path: Path) -> None:
    with pytest.raises(ValueError, match="outside"):
        load_dem(dem_path, (0.0, 0.0, 1.0, 1.0))
