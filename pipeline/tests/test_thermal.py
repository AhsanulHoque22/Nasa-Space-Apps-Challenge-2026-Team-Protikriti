import json
from pathlib import Path

import numpy as np
import pytest
import rasterio
from rasterio.transform import from_origin

from marsmap.thermal import build_thermal, read_window, tile_name

# The USGS tiles' own projection: simple cylindrical on the Mars sphere, metres.
EQC = "+proj=eqc +lat_ts=0 +lat_0=0 +lon_0=0 +x_0=0 +y_0=0 +R=3396190 +units=m +no_defs"
M_PER_DEG = 3396190 * np.pi / 180


class TestTileName:
    def test_names_the_tile_by_its_south_west_corner(self) -> None:
        assert tile_name(77.4, 18.4) == "00N060E"  # Jezero
        assert tile_name(137.4, -4.7) == "30S120E"  # Gale
        assert tile_name(10.0, 45.0) == "30N000E"
        assert tile_name(100.0, -45.0) == "60S060E"

    def test_refuses_places_outside_the_mosaic_or_west_longitudes(self) -> None:
        with pytest.raises(ValueError, match="60"):
            tile_name(77.0, 70.0)
        with pytest.raises(ValueError, match="east"):
            tile_name(-100.0, 10.0)


def write_tile(path: Path, values: np.ndarray, west_deg: float, north_deg: float) -> None:
    pixel = 100.0
    transform = from_origin(west_deg * M_PER_DEG, north_deg * M_PER_DEG, pixel, pixel)
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        width=values.shape[1],
        height=values.shape[0],
        count=1,
        dtype="float32",
        crs=EQC,
        transform=transform,
        nodata=-3.4e38,
    ) as dst:
        dst.write(values.astype("float32"), 1)


class TestReadWindow:
    def test_reads_only_the_requested_area_with_nodata_as_nan(self, tmp_path: Path) -> None:
        values = np.arange(100 * 100, dtype=np.float32).reshape(100, 100) + 100
        values[50, 50] = -3.4e38
        tif = tmp_path / "ti.tif"
        write_tile(tif, values, west_deg=77.0, north_deg=18.6)
        span = 30 * 100 / M_PER_DEG  # 30 pixels
        a, bounds = read_window(
            str(tif),
            (
                77.0 + 40 * 100 / M_PER_DEG,
                18.6 - 60 * 100 / M_PER_DEG,
                77.0 + 40 * 100 / M_PER_DEG + span,
                18.6 - 30 * 100 / M_PER_DEG,
            ),
        )
        assert a.shape == (30, 30)
        assert a.dtype == np.float32
        assert np.isnan(a).sum() == 1  # the nodata pixel at (50, 50)
        west, south, east, north = bounds
        assert east > west and north > south

    def test_treats_non_physical_values_as_missing(self, tmp_path: Path) -> None:
        values = np.full((20, 20), 250, dtype=np.float32)
        values[3, 3] = 0
        values[4, 4] = -5
        tif = tmp_path / "ti.tif"
        write_tile(tif, values, west_deg=77.0, north_deg=18.6)
        a, _ = read_window(
            str(tif), (77.0, 18.6 - 20 * 100 / M_PER_DEG, 77.0 + 20 * 100 / M_PER_DEG, 18.6)
        )
        assert np.isnan(a).sum() == 2

    def test_raises_when_the_area_is_outside_the_tile(self, tmp_path: Path) -> None:
        tif = tmp_path / "ti.tif"
        write_tile(tif, np.full((10, 10), 250, dtype=np.float32), west_deg=77.0, north_deg=18.6)
        with pytest.raises(ValueError, match="outside"):
            read_window(str(tif), (10.0, 10.0, 10.1, 10.1))


def test_build_thermal_writes_grid_and_metadata(tmp_path: Path) -> None:
    tif = tmp_path / "ti.tif"
    write_tile(tif, np.full((40, 40), 300, dtype=np.float32), west_deg=77.0, north_deg=18.6)
    out = tmp_path / "site"
    meta = build_thermal((77.001, 18.55, 77.05, 18.59), out, url_template=str(tif))
    grid = np.fromfile(out / "thermal.bin", dtype="<f4").reshape(meta["height"], meta["width"])
    assert np.allclose(grid, 300)
    saved = json.loads((out / "thermal.json").read_text())
    assert saved["units"] == "J m-2 K-1 s-1/2"
    assert "Fergason" in saved["source"]
    assert saved["width"] == meta["width"]
