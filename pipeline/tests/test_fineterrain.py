import json
import math
from pathlib import Path

import numpy as np
import rasterio
from rasterio.transform import from_origin

from marsmap.fineterrain import HEIGHT_STEP_M, LEVEL, NODATA_I16, SAMPLES, build_fine_terrain
from marsmap.walkpatch import tile_box

EQC = "+proj=eqc +lat_ts=0 +lat_0=0 +lon_0=0 +x_0=0 +y_0=0 +R=3396190 +units=m +no_defs"
M_PER_DEG = 3396190 * math.pi / 180
DEG = 180 / 2**LEVEL


def write_dem(path: Path, values: np.ndarray, west: float, north: float) -> None:
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        width=values.shape[1],
        height=values.shape[0],
        count=1,
        dtype="float32",
        crs=EQC,
        transform=from_origin(west * M_PER_DEG, north * M_PER_DEG, 1.0, 1.0),
        nodata=-32767,
    ) as dst:
        dst.write(values, 1)


def test_cuts_a_1m_dem_into_level_tiles_at_1m(tmp_path: Path) -> None:
    # A 1 m DEM over exactly one tile and a bit of its east neighbour, rising 1 cm per metre east.
    x, y = 2**LEVEL + 100, 2 ** (LEVEL - 1) - 50  # just north of the equator, east of lon 0
    west, south, east, north = tile_box(x, y, LEVEL)
    cols = round((east - west) * M_PER_DEG) + 40
    rows = round((north - south) * M_PER_DEG)
    dem = np.tile(-2500 + 0.01 * np.arange(cols, dtype=np.float32), (rows, 1))
    write_dem(tmp_path / "dem.tif", dem, west, north)
    site = {
        "id": "s",
        "bounds": [west, south, east, north],
        "fine": {"dem": str(tmp_path / "dem.tif"), "source": "test DTM"},
    }

    index = build_fine_terrain([site], tmp_path / "out")

    assert index["level"] == LEVEL and index["samples"] == SAMPLES
    assert index["sources"] == {"s": "test DTM"}
    key = f"{x}/{y}"
    assert key in index["tiles"]
    tile_m = (north - south) * M_PER_DEG
    assert abs(tile_m / SAMPLES - 1.0) < 0.01  # one sample per metre
    steps = np.fromfile(tmp_path / "out" / "terrain" / str(LEVEL) / str(x) / f"{y}.bin", "<i2")
    assert steps.size == SAMPLES * SAMPLES
    heights = index["tiles"][key] + steps.reshape(SAMPLES, SAMPLES) * HEIGHT_STEP_M
    # Cell centres: column c sits (c + 0.5) * tile_m / SAMPLES metres east of the tile's west edge.
    for c in (0, SAMPLES // 2, SAMPLES - 1):
        expected = -2500 + 0.01 * ((c + 0.5) * tile_m / SAMPLES - 0.5)
        assert abs(heights[SAMPLES // 2, c] - expected) < 0.03
    saved = json.loads((tmp_path / "out" / "terrain" / "index.json").read_text())
    assert saved == index


def test_skips_tiles_with_no_data_and_masks_zeros_when_asked(tmp_path: Path) -> None:
    x, y = 2**LEVEL + 100, 2 ** (LEVEL - 1) - 50
    west, south, east, north = tile_box(x, y, LEVEL)
    n = round((north - south) * M_PER_DEG)
    dem = np.full((n, n), -2000, np.float32)
    dem[:, : n // 2] = 0.0  # failed stereo in a HiRISE DTEEC
    dem[n // 2, 3 * n // 4] = 3.52e-43  # also failed stereo: a denormal, not exactly 0
    write_dem(tmp_path / "dem.tif", dem, west, north)
    site = {
        "id": "s",
        "bounds": [west - DEG, south, east, north],  # the west neighbour has no DEM at all
        "zero_is_nodata": True,
        "fine": {"dem": str(tmp_path / "dem.tif"), "source": "t"},
    }

    index = build_fine_terrain([site], tmp_path / "out")

    assert list(index["tiles"]) == [f"{x}/{y}"]
    steps = np.fromfile(tmp_path / "out" / "terrain" / str(LEVEL) / str(x) / f"{y}.bin", "<i2")
    grid = steps.reshape(SAMPLES, SAMPLES)
    assert (grid[:, 5] == NODATA_I16).all() and (grid[:, -5] != NODATA_I16).all()
    # No failed-stereo zero may leak into the tile as real ground at the edge of the gap.
    valid = grid[grid != NODATA_I16] * HEIGHT_STEP_M + index["tiles"][f"{x}/{y}"]
    assert np.abs(valid + 2000).max() < 1


def test_sites_without_a_fine_dem_are_skipped(tmp_path: Path) -> None:
    index = build_fine_terrain([{"id": "insight", "bounds": [0, 0, 1, 1]}], tmp_path / "out")
    assert index["tiles"] == {} and index["sources"] == {}


def test_a_rebuild_keeps_the_other_sites_tiles(tmp_path: Path) -> None:
    x, y = 2**LEVEL + 100, 2 ** (LEVEL - 1) - 50
    west, south, east, north = tile_box(x, y, LEVEL)
    n = round((north - south) * M_PER_DEG)
    write_dem(tmp_path / "dem.tif", np.full((n, n), -2000, np.float32), west, north)
    out = tmp_path / "out"
    (out / "terrain").mkdir(parents=True)
    earlier = {"sources": {"gale": "g"}, "tiles": {"1/2": -4400.0}}
    (out / "terrain" / "index.json").write_text(json.dumps(earlier))
    site = {
        "id": "s",
        "bounds": [west, south, east, north],
        "fine": {"dem": str(tmp_path / "dem.tif"), "source": "t"},
    }

    index = build_fine_terrain([site], out)

    assert index["sources"] == {"gale": "g", "s": "t"}
    assert index["tiles"]["1/2"] == -4400.0 and f"{x}/{y}" in index["tiles"]
