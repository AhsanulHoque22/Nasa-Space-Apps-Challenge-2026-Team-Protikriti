import json
from pathlib import Path

import numpy as np

from marsmap.swim import NODATA_OUT, swim_to_web, write_swim


def test_swim_to_web_scales_to_int8_and_marks_nodata() -> None:
    values = np.array([[1.0, -0.54, -100.0], [0.5, np.nan, 0.0]], dtype=np.float32)
    grid = swim_to_web(values, source_nodata=-100.0)
    assert grid.dtype == np.int8
    assert grid.tolist() == [[100, -54, NODATA_OUT], [50, NODATA_OUT, 0]]


def test_write_swim_records_extent_and_meaning(tmp_path: Path) -> None:
    write_swim(np.zeros((2, 4), dtype=np.int8), tmp_path, north=60.0, south=-60.0)
    back = np.fromfile(tmp_path / "swim.bin", dtype=np.int8).reshape(2, 4)
    assert back.tolist() == [[0, 0, 0, 0], [0, 0, 0, 0]]
    meta = json.loads((tmp_path / "swim.json").read_text())
    assert (meta["width"], meta["height"], meta["north"], meta["south"]) == (4, 2, 60.0, -60.0)
    assert meta["scale"] == 0.01
    assert meta["nodata"] == NODATA_OUT
