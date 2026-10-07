import json
import math
import warnings
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import numpy as np
import pytest
from rasterio.errors import NotGeoreferencedWarning
from rasterio.io import MemoryFile

from marsmap.compare import (
    EARTH_RADIUS_KM,
    MARS_RADIUS_KM,
    box_deg,
    build_compare,
    gibs_url,
    trek_tiles,
)


def test_box_is_the_same_ground_size_on_both_planets() -> None:
    for lon, lat, radius in [(77.42, 18.47, MARS_RADIUS_KM), (89.74, 24.45, EARTH_RADIUS_KM)]:
        west, south, east, north = box_deg(lon, lat, 20, radius)
        km_per_deg = math.pi * radius / 180
        assert (north - south) * km_per_deg == pytest.approx(20)
        assert (east - west) * km_per_deg * math.cos(math.radians(lat)) == pytest.approx(20)
        assert (west + east) / 2 == pytest.approx(lon)


def test_trek_tiles_cover_the_box_with_pixel_offsets() -> None:
    box = (77.24, 18.30, 77.60, 18.64)
    tiles, window = trek_tiles(box, level=11)
    deg = 180 / 2**11
    cols = sorted({c for _, c in tiles})
    rows = sorted({r for r, _ in tiles})
    assert cols[0] == math.floor((box[0] + 180) / deg)
    assert rows[0] == math.floor((90 - box[3]) / deg)
    assert len(tiles) == len(cols) * len(rows)
    x0, y0, x1, y1 = window
    assert 0 <= x0 < 256 and 0 <= y0 < 256
    assert x1 - x0 == pytest.approx((box[2] - box[0]) / deg * 256, abs=1)
    assert y1 - y0 == pytest.approx((box[3] - box[1]) / deg * 256, abs=1)


def test_gibs_url_asks_for_the_box_in_lat_lon_order() -> None:
    q = parse_qs(urlparse(gibs_url("L", "2020-02-02", (89.6, 24.3, 89.8, 24.5), 640)).query)
    assert q["BBOX"] == ["24.3,89.6,24.5,89.8"]  # WMS 1.3.0 EPSG:4326 axis order
    assert q["TIME"] == ["2020-02-02"]
    assert q["WIDTH"] == q["HEIGHT"] == ["640"]


def png(width: int, height: int, value: int) -> bytes:
    with (
        warnings.catch_warnings(category=NotGeoreferencedWarning, action="ignore"),
        MemoryFile() as mem,
    ):
        with mem.open(driver="PNG", width=width, height=height, count=3, dtype="uint8") as dst:
            dst.write(np.full((3, height, width), value, dtype=np.uint8))
        return bytes(mem.read())


def test_build_writes_images_and_a_manifest_with_sources(tmp_path: Path) -> None:
    calls: list[str] = []

    def fake(url: str) -> bytes:
        calls.append(url)
        return png(256, 256, 120) if "trek" in url else png(64, 64, 90)

    manifest = build_compare(tmp_path, fetch=fake, px=64)
    assert (tmp_path / manifest["jezero"]["file"]).exists()
    years = [s["year"] for s in manifest["jamuna"]["scenes"]]
    assert years == sorted(years) and len(years) >= 3
    for s in manifest["jamuna"]["scenes"]:
        assert (tmp_path / s["file"]).exists()
        assert "GIBS" in s["source"]
    assert "not" in manifest["caveat"].lower() and "analog" in manifest["caveat"].lower()
    assert json.loads((tmp_path / "compare.json").read_text()) == manifest
