"""Tile math, the pyramid and the written files for the tidied HiRISE strips."""

import json
from pathlib import Path

import cv2
import numpy as np

from marsmap.strip_tiles import (
    TILE_PX,
    build_region,
    fetch_mosaic,
    pyramid,
    tile_deg,
    tile_range,
    write_tiles,
)


def test_tile_range_matches_the_geographic_scheme() -> None:
    # Jezero (77.45 E, 18.44 N) at level 10: tiles are 0.17578125 degrees
    x0, x1, y0, y1 = tile_range(10, 77.4, 18.4, 77.5, 18.5)
    size = tile_deg(10)
    assert x0 == int((77.4 + 180) // size) and x1 == int((77.5 + 180) // size)
    assert y0 == int((90 - 18.5) // size) and y1 == int((90 - 18.4) // size)
    assert (x0 * size - 180) <= 77.4 and ((x1 + 1) * size - 180) >= 77.5


def test_missing_tiles_are_black_and_present_tiles_land_in_place() -> None:
    def get(url: str) -> bytes | None:
        if url.endswith("/5/3"):  # y=5, x=3 exists
            ok, data = cv2.imencode(".png", np.full((TILE_PX, TILE_PX), 90, np.uint8))
            return data.tobytes() if ok else None
        return None

    tmp = Path(__import__("tempfile").mkdtemp())
    mosaic = fetch_mosaic("HiRISE", 7, (3, 4, 5, 6), tmp, workers=2, get=get)
    assert mosaic.shape == (2 * TILE_PX, 2 * TILE_PX)
    assert (mosaic[:TILE_PX, :TILE_PX] == 90).all()
    assert (mosaic[TILE_PX:, :] == 0).all() and (mosaic[:, TILE_PX:] == 0).all()


def test_pyramid_halves_each_level_and_keeps_edges_clear() -> None:
    image = np.zeros((2 * TILE_PX, 2 * TILE_PX), np.uint8)
    image[:TILE_PX, :] = 100
    mask = image > 0
    levels = pyramid(image, mask, 10, (400, 401, 200, 201))
    assert set(levels) == {10, 9, 8, 7, 6, 5}
    coarse, coarse_mask, box = levels[9]
    assert box == (200, 200, 100, 100) and coarse.shape == (TILE_PX, TILE_PX)
    assert coarse_mask[:, :255].all() is np.True_ or coarse_mask[:200].all()
    assert not coarse_mask[300:].any()  # the empty half stays empty, not averaged in as dark
    assert (coarse[coarse_mask] == 100).all()


def test_write_tiles_stores_alpha_only_where_there_is_data(tmp_path: Path) -> None:
    image = np.zeros((TILE_PX, TILE_PX), np.uint8)
    image[:, :200] = 150
    levels = {10: (image, image > 0, (7, 7, 9, 9))}
    assert write_tiles(levels, tmp_path) == 1
    tile = cv2.imread(str(tmp_path / "10" / "7" / "9.webp"), cv2.IMREAD_UNCHANGED)
    assert tile.shape == (TILE_PX, TILE_PX, 4)
    assert tile[10, 10, 3] == 255 and tile[10, 300, 3] == 0


def test_build_region_writes_tiles_and_a_manifest(tmp_path: Path, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    ground = cv2.GaussianBlur(
        np.random.default_rng(0).normal(0, 1, (TILE_PX, TILE_PX)).astype(np.float32), (0, 0), 8
    )
    tile = np.clip(110 + 30 * ground / ground.std(), 8, 250).astype(np.uint8)

    def fake(url: str) -> bytes | None:
        ok, data = cv2.imencode(".png", tile)
        return data.tobytes() if ok else None

    monkeypatch.setattr("marsmap.strip_tiles._download", fake)
    summary = build_region(
        "test", (77.45, 18.44, 77.46, 18.45), 10, tmp_path, tmp_path / "cache", align=False
    )
    manifest = json.loads((tmp_path / "strips" / "manifest.json").read_text())
    assert manifest["regions"][0]["name"] == "test" and summary["tiles"] >= 6
    assert (tmp_path / "strips" / "10").is_dir()


def test_a_corrupt_cached_tile_is_fetched_again(tmp_path: Path) -> None:
    from marsmap.strip_tiles import fetch_tile

    cached = tmp_path / "CTX" / "10" / "5_7.png"
    cached.parent.mkdir(parents=True)
    cached.write_bytes(b"\x89PNG truncated")  # an interrupted download left this behind
    good = np.full((TILE_PX, TILE_PX), 80, np.uint8)

    def get(url: str) -> bytes | None:
        ok, data = cv2.imencode(".png", good)
        return data.tobytes() if ok else None

    tile = fetch_tile("CTX", 10, 7, 5, tmp_path, get)
    assert tile is not None and (tile == 80).all()
    assert cv2.imread(str(cached), cv2.IMREAD_GRAYSCALE) is not None


def test_a_region_with_no_coverage_writes_nothing(tmp_path: Path, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    monkeypatch.setattr("marsmap.strip_tiles._download", lambda url: None)
    summary = build_region(
        "pole", (10.0, 80.0, 10.5, 80.5), 10, tmp_path, tmp_path / "c", align=False
    )
    assert summary["tiles"] == 0
    assert not (tmp_path / "strips" / "manifest.json").exists()


def test_a_tile_that_is_broken_on_the_server_counts_as_no_image(tmp_path: Path) -> None:
    from marsmap.strip_tiles import fetch_tile

    assert fetch_tile("CTX", 10, 7, 5, tmp_path, lambda url: b"\x89PNG not really") is None
    assert (tmp_path / "CTX" / "10" / "5_7.png").read_bytes() == b""  # not fetched again next run
