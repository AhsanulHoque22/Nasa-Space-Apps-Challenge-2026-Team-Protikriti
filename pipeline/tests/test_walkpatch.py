import json
import math
from pathlib import Path

import numpy as np
import pytest
import rasterio
from rasterio.transform import from_origin

from marsmap.walkpatch import (
    HEIGHT_STEP_M,
    NODATA_I16,
    build_walk_patch,
    tile_box,
    tile_range,
)

EQC = "+proj=eqc +lat_ts=0 +lat_0=0 +lon_0=0 +x_0=0 +y_0=0 +R=3396190 +units=m +no_defs"
M_PER_DEG = 3396190 * math.pi / 180


def write(
    path: Path, values: np.ndarray, west: float, north: float, pixel_m: float, **kw: object
) -> None:
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        width=values.shape[1],
        height=values.shape[0],
        count=1,
        dtype=values.dtype,
        crs=EQC,
        transform=from_origin(west * M_PER_DEG, north * M_PER_DEG, pixel_m, pixel_m),
        **kw,
    ) as dst:
        dst.write(values, 1)


class TestTiles:
    def test_tile_range_covers_the_box_in_cesium_geographic_tiles(self) -> None:
        box = (77.44, 18.43, 77.46, 18.45)
        x0, x1, y0, y1 = tile_range(box, 17)
        deg = 180 / 2**17
        assert x0 == math.floor((77.44 + 180) / deg) and x1 == math.floor((77.46 + 180) / deg)
        assert y0 == math.floor((90 - 18.45) / deg) and y1 == math.floor((90 - 18.43) / deg)

    def test_tile_box_round_trips(self) -> None:
        west, south, east, north = tile_box(5, 3, 2)  # level 2: 45 deg tiles, 8 x 4
        assert (west, north) == (-180 + 5 * 45, 90 - 3 * 45)
        assert (east - west, north - south) == (45, 45)


@pytest.fixture
def sources(tmp_path: Path) -> tuple[Path, Path]:
    """A tilted plane DEM (1 m pixels) and a ramp image (0.5 m pixels) around 77.45 E, 18.44 N."""
    west, north = 77.43, 18.46
    n = 2600
    cols = np.arange(n, dtype=np.float32)
    dem = np.tile(-2500 + 0.01 * cols, (n, 1)).astype(np.float32)  # rises 1 cm per metre east
    dem[:10, :10] = -32767
    write(tmp_path / "dem.tif", dem, west, north, 1.0, nodata=-32767)
    img = np.tile((np.arange(n * 2) % 200 + 20).astype(np.uint8), (n * 2, 1))
    write(tmp_path / "ortho.tif", img, west, north, 0.5)
    return tmp_path / "dem.tif", tmp_path / "ortho.tif"


def test_builds_dem_and_tiles(tmp_path: Path, sources: tuple[Path, Path]) -> None:
    dem, ortho = sources
    walk = {
        "lon": 77.45,
        "lat": 18.44,
        "km": 1.0,
        "levels": [15, 17],
        "dem": str(dem),
        "ortho": str(ortho),
        "source": "test",
    }
    meta = build_walk_patch("jezero", walk, tmp_path / "out")
    out = tmp_path / "out" / "walk" / "jezero"
    raw = np.fromfile(out / "dem.bin", dtype="<i2").reshape(meta["height"], meta["width"])
    assert meta["width"] == pytest.approx(1000 / meta["spacingM"], abs=1)  # 1 km at 2 m
    assert meta["height"] == pytest.approx(1000 / meta["spacingM"], abs=1)
    assert NODATA_I16 not in raw  # the nodata corner lies outside the 1 km box
    heights = meta["heightOffsetM"] + raw * HEIGHT_STEP_M
    # Plane rises 1 cm per metre of eqc x: across the patch's x extent (in eqc metres).
    span_x_m = (meta["east"] - meta["west"]) * M_PER_DEG
    assert heights[:, -1].mean() - heights[:, 0].mean() == pytest.approx(0.01 * span_x_m, rel=0.02)
    assert meta["maxSafeSlopeDeg"] == 15
    assert json.loads((out / "walk.json").read_text()) == meta
    for level in (15, 17):
        x0, x1, y0, y1 = tile_range(tuple(meta["tiles"]["rect"]), level)
        for x in range(x0, x1 + 1):
            for y in range(y0, y1 + 1):
                assert (out / "tiles" / str(level) / str(x) / f"{y}.jpg").exists()
    assert meta["tiles"]["minLevel"] == 15 and meta["tiles"]["maxLevel"] == 17
