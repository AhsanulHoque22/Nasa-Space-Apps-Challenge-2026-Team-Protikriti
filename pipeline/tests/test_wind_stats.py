"""Tests for Mars wind stats (REMS/Viking anchor measurements)."""

import json
from pathlib import Path

from marsmap.wind_stats import ANCHOR_SITES, GRID_COLS, GRID_ROWS, build_wind


def test_wind_json_structure(tmp_path: Path) -> None:
    out = tmp_path / "wind.json"
    build_wind(out)
    data = json.loads(out.read_text())
    assert "anchors" in data
    assert len(data["anchors"]) == len(ANCHOR_SITES)
    for a in data["anchors"]:
        assert "id" in a and "lon" in a and "lat" in a
        assert "mean_ms" in a and "max_ms" in a
        assert a["mean_ms"] > 0


def test_wind_score_grid(tmp_path: Path) -> None:
    out = tmp_path / "wind.json"
    build_wind(out)
    data = json.loads(out.read_text())
    assert "grid" in data
    assert len(data["grid"]) == GRID_ROWS
    assert len(data["grid"][0]) == GRID_COLS
    assert all(0 <= v <= 100 for row in data["grid"] for v in row)


def test_wind_score_near_anchor_high(tmp_path: Path) -> None:
    out = tmp_path / "wind.json"
    build_wind(out)
    data = json.loads(out.read_text())
    # Gale crater anchor: lon=137.44, lat=-4.59 → row≈85, col≈317
    row = int((90.0 - (-4.59)) / 180.0 * GRID_ROWS)
    col = int((137.44 + 180.0) / 360.0 * GRID_COLS)
    score = data["grid"][min(row, GRID_ROWS - 1)][min(col, GRID_COLS - 1)]
    # Near the anchor, score should be relatively high
    assert score > 20, f"Expected > 20 near Gale anchor, got {score}"
