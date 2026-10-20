import json
from pathlib import Path

import numpy as np
import pytest
import rasterio
from rasterio.transform import from_origin

from marsmap.crism import NODATA_CODE, classify_crism, export_crism_grid

# Mars sphere equirectangular — the same projection USGS Mars products use.
EQC = "+proj=eqc +lat_ts=0 +lat_0=0 +lon_0=0 +x_0=0 +y_0=0 +R=3396190 +units=m +no_defs"
M_PER_DEG = 3396190 * np.pi / 180


def write_crism_tile(path: Path, codes: np.ndarray, west_deg: float, north_deg: float) -> None:
    pixel = 100.0  # 100 m/px
    transform = from_origin(west_deg * M_PER_DEG, north_deg * M_PER_DEG, pixel, pixel)
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        width=codes.shape[1],
        height=codes.shape[0],
        count=1,
        dtype="uint8",
        crs=EQC,
        transform=transform,
        nodata=NODATA_CODE,
    ) as dst:
        dst.write(codes.astype("uint8"), 1)


class TestClassifyCrism:
    def test_output_is_float32_same_shape(self) -> None:
        codes = np.array([[1, 2], [3, 4]], dtype=np.uint8)
        result = classify_crism(codes)
        assert result.dtype == np.float32
        assert result.shape == codes.shape

    def test_all_finite_values_in_unit_interval(self) -> None:
        codes = np.arange(10, dtype=np.uint8).reshape(2, 5)
        result = classify_crism(codes)
        finite = result[np.isfinite(result)]
        assert np.all(finite >= 0) and np.all(finite <= 1)

    def test_nodata_code_becomes_nan(self) -> None:
        codes = np.array([[NODATA_CODE, 1]], dtype=np.uint8)
        result = classify_crism(codes)
        assert np.isnan(result[0, 0])
        assert np.isfinite(result[0, 1])

    def test_unknown_code_returns_neutral_not_nan(self) -> None:
        # Codes not in the hazard table fall back to the neutral weight.
        codes = np.array([[200]], dtype=np.uint8)  # unknown code
        result = classify_crism(codes)
        assert np.isfinite(result[0, 0])


class TestExportCrismGrid:
    def test_writes_bin_and_json_matching_shape(self, tmp_path: Path) -> None:
        codes = np.ones((40, 40), dtype=np.uint8) * 2  # all one mineral class
        tif = tmp_path / "jezeroFinal.tif"
        write_crism_tile(tif, codes, west_deg=77.0, north_deg=18.6)
        out = tmp_path / "site"
        meta = export_crism_grid(
            "jezero",
            (77.001, 18.55, 77.05, 18.59),
            tif,
            out,
        )
        assert meta is not None
        grid = np.fromfile(out / "crism.bin", dtype="<f4").reshape(meta["height"], meta["width"])
        assert grid.dtype == np.float32
        assert grid.shape == (meta["height"], meta["width"])
        saved = json.loads((out / "crism.json").read_text())
        assert saved["width"] == meta["width"]
        assert saved["height"] == meta["height"]
        assert "source" in saved
        assert "Salvatore" in saved["source"]
        assert saved["p02"] is not None
        assert saved["p98"] is not None

    def test_skips_gracefully_when_tif_absent(
        self, tmp_path: Path, capsys: pytest.CaptureFixture[str]
    ) -> None:
        out = tmp_path / "site"
        result = export_crism_grid(
            "jezero",
            (77.0, 18.4, 77.2, 18.6),
            tmp_path / "missing.tif",
            out,
        )
        assert result is None
        captured = capsys.readouterr()
        assert "missing.tif" in captured.out or "missing.tif" in captured.err

    def test_outside_bounds_raises(self, tmp_path: Path) -> None:
        codes = np.ones((10, 10), dtype=np.uint8)
        tif = tmp_path / "t.tif"
        write_crism_tile(tif, codes, west_deg=77.0, north_deg=18.6)
        out = tmp_path / "site"
        with pytest.raises(ValueError, match="outside"):
            export_crism_grid("jezero", (10.0, 10.0, 10.1, 10.1), tif, out)
