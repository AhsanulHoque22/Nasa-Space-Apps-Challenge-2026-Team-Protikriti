import json
from pathlib import Path

import numpy as np

from marsmap.mola import megdr_to_web, write_mola


def test_megdr_to_web_reads_big_endian_and_recentres_on_minus_180() -> None:
    # 2 rows x 4 cols, longitudes 0-90-180-270 east; values are their column index * 100
    raw = np.array([[0, 100, 200, 300], [-1, -2, -3, -4]], dtype=">i2").tobytes()
    grid = megdr_to_web(raw, width=4, height=2)
    assert grid.dtype == np.int16
    # -180..180: the column that was at 180°E (index 2) now comes first
    assert grid[0].tolist() == [200, 300, 0, 100]
    assert grid[1].tolist() == [-3, -4, -1, -2]


def test_write_mola_writes_little_endian_bin_and_metadata(tmp_path: Path) -> None:
    grid = np.array([[1, 2], [3, 4]], dtype=np.int16)
    write_mola(grid, tmp_path)
    back = np.fromfile(tmp_path / "mola.bin", dtype="<i2").reshape(2, 2)
    assert back.tolist() == [[1, 2], [3, 4]]
    meta = json.loads((tmp_path / "mola.json").read_text())
    assert meta == {
        "width": 2,
        "height": 2,
        "west": -180.0,
        "north": 90.0,
        "east": 180.0,
        "south": -90.0,
        "units": "m above MOLA areoid",
        "source": "MGS MOLA MEGDR megt90n000cb (4 px/deg), NASA PDS Geosciences Node",
    }
