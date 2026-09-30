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


def test_layers_writes_geojson_for_every_layer(tmp_path: Path) -> None:
    import json
    import zipfile

    raw = tmp_path / "raw"
    raw.mkdir()
    kml = (
        '<kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark><ExtendedData>'
        '<SchemaData><SimpleData name="clean_name">Gale</SimpleData></SchemaData>'
        "</ExtendedData><Point><coordinates>137.8,-5.4</coordinates></Point></Placemark>"
        "</Document></kml>"
    )
    with zipfile.ZipFile(raw / "MARS_nomenclature_center_pts.kmz", "w") as kmz:
        kmz.writestr("MARS_nomenclature_center_pts.kml", kml)
    line = {"features": [{"geometry": {"type": "LineString", "coordinates": [[1, 1], [2, 2]]}}]}
    for name in ("M20_traverse.json", "MSL_traverse.json"):
        (raw / name).write_text(json.dumps(line))
    curated = tmp_path / "curated"
    curated.mkdir()
    (curated / "landing_sites.json").write_text(
        json.dumps({"source": "s", "sites": [{"mission": "M", "lon": 1.0, "lat": 2.0}]})
    )
    (curated / "exploration_zones.json").write_text(
        json.dumps({"source": "s", "radius_km": 100, "zones": [{"name": "G", "anchor": "Gale"}]})
    )
    out = tmp_path / "layers"

    code = main(["layers", "--raw", str(raw), "--curated", str(curated), "--out", str(out)])

    assert code == 0
    for layer in ("names", "traverses", "landing_sites", "exploration_zones"):
        collection = json.loads((out / f"{layer}.geojson").read_text())
        assert collection["type"] == "FeatureCollection"
        assert collection["features"], layer
    zones = json.loads((out / "exploration_zones.geojson").read_text())
    assert zones["radius_km"] == 100


class _FakeResponse:
    def __enter__(self) -> "_FakeResponse":
        return self

    def __exit__(self, *_: object) -> None:
        return None

    def read(self) -> bytes:
        return b"payload"


def test_download_retries_a_stalled_server(monkeypatch: pytest.MonkeyPatch) -> None:
    import urllib.request

    from marsmap import __main__ as cli

    calls: list[str] = []

    def flaky(url: str, timeout: float) -> _FakeResponse:
        calls.append(url)
        if len(calls) < 3:
            raise TimeoutError("The read operation timed out")
        return _FakeResponse()

    monkeypatch.setattr(urllib.request, "urlopen", flaky)
    monkeypatch.setattr(cli, "DOWNLOAD_RETRY_WAIT_S", 0)
    assert cli._download_bytes("https://example.test/f.tif") == b"payload"
    assert len(calls) == 3


def test_download_gives_up_after_the_last_attempt(monkeypatch: pytest.MonkeyPatch) -> None:
    import urllib.request

    from marsmap import __main__ as cli

    def dead(url: str, timeout: float) -> _FakeResponse:
        raise TimeoutError("The read operation timed out")

    monkeypatch.setattr(urllib.request, "urlopen", dead)
    monkeypatch.setattr(cli, "DOWNLOAD_RETRY_WAIT_S", 0)
    with pytest.raises(TimeoutError):
        cli._download_bytes("https://example.test/f.tif")
