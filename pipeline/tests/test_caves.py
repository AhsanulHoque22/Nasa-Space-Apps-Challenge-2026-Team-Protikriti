import json
from pathlib import Path

import pytest

from marsmap.caves import build_caves, load_caves

# The real file's header names the first three columns (longitude, latitude, Label), but the rows
# hold (Label, longitude, latitude), as its PDS label says: rows must be read by position.
HEADER = (
    "longitude:string,latitude:string,Label:string,TypeCode:string,Priority:string,"
    "APC_Diameter:string,APC_Depth:string,Comment:string\n"
)


def write(tmp_path: Path, rows: str) -> Path:
    path = tmp_path / "Mars_Cave_Catalog.csv"
    path.write_text(HEADER + rows, encoding="latin-1")
    return path


def test_reads_columns_by_position_not_by_the_wrong_header(tmp_path: Path) -> None:
    caves = load_caves(write(tmp_path, "APC001,240.4585,-0.94678,APC,1,25,32,APC -- tiny ~25m\n"))
    assert len(caves) == 1
    cave = caves[0]
    assert cave.id == "APC001"
    assert cave.lon == pytest.approx(240.4585 - 360)  # 0-360 east -> -180..180 east
    assert cave.lat == pytest.approx(-0.94678)
    assert (cave.type_code, cave.priority) == ("APC", 1)
    assert (cave.apc_diameter_m, cave.apc_depth_m) == ("25", "32")
    assert cave.comment == "APC -- tiny ~25m"


def test_apc_sizes_stay_text_and_blank_is_none(tmp_path: Path) -> None:
    rows = "SKY010,100.5,10.25,sky,2,,,skylight\nAPC9,1,2,APC,1,135x195,60,oval\n"
    blank, oval = load_caves(write(tmp_path, rows))
    assert blank.lon == pytest.approx(100.5)
    assert blank.apc_diameter_m is None and blank.apc_depth_m is None
    assert oval.apc_diameter_m == "135x195"


@pytest.mark.parametrize(
    ("row", "message"),
    [
        ("X1,400,0,sky,1,,,c\n", "longitude"),
        ("X1,10,95,sky,1,,,c\n", "latitude"),
        ("X1,10,5,sky,7,,,c\n", "priority"),
        ("X1,10,5,sky\n", "8 columns"),
    ],
)
def test_bad_rows_fail_loudly_with_the_line_number(tmp_path: Path, row: str, message: str) -> None:
    with pytest.raises(ValueError, match=rf"line 2.*{message}"):
        load_caves(write(tmp_path, row))


def test_build_writes_compact_rows_with_the_source(tmp_path: Path) -> None:
    csv = write(tmp_path, "APC001,240.4585,-0.94678,APC,1,25,32,note\nS2,10,5,sky,0,,,x\n")
    out = tmp_path / "caves.json"
    assert build_caves(csv, out) == 2
    doc = json.loads(out.read_text())
    assert "10.17189/1519222" in doc["source"]
    assert doc["fields"][:5] == ["id", "lon", "lat", "type", "priority"]
    assert doc["caves"][0][:5] == ["APC001", -119.5415, -0.94678, "APC", 1]
    assert doc["types"]["sky"].startswith("Skylight")
