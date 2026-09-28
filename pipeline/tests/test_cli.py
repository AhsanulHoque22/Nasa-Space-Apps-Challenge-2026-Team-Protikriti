from pathlib import Path

import numpy as np
import pytest
import rasterio
from rasterio.transform import from_origin

from marsmap.__main__ import main

JEZERO_EQC = (
    "+proj=eqc +lat_ts=18.4663 +lat_0=0 +lon_0=0 +x_0=0 +y_0=0 +R=3396190 +units=m +no_defs"
)
MARS_M_PER_DEG = 3_396_190.0 * np.pi / 180.0


@pytest.mark.filterwarnings("ignore::rasterio.errors.NotGeoreferencedWarning")
def test_build_writes_web_assets(tmp_path: Path) -> None:
    dem_path = tmp_path / "dem.tif"
    x0 = 77.40 * MARS_M_PER_DEG * np.cos(np.radians(18.4663))
    y0 = 18.50 * MARS_M_PER_DEG
    with rasterio.open(
        dem_path,
        "w",
        driver="GTiff",
        width=20,
        height=20,
        count=1,
        dtype="float32",
        crs=JEZERO_EQC,
        transform=from_origin(x0, y0, 20.0, 20.0),
    ) as dst:
        dst.write(np.zeros((20, 20), dtype=np.float32), 1)
    out = tmp_path / "web"
    bounds = "77.40,18.495,77.405,18.50"
    assert main(["build", "--dem", str(dem_path), "--out", str(out), "--bounds", bounds]) == 0
    assert (out / "grid.json").exists()
    assert (out / "grid.bin").stat().st_size > 0
    assert (out / "slope_hazard.png").exists()
