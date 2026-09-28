import json
from pathlib import Path

import pytest

from marsmap.weather import FEEDS, snapshot_weather


def test_snapshot_writes_each_feed_with_fetch_time(tmp_path: Path) -> None:
    payloads = {FEEDS["rems"]: b'{"soles": [{"sol": "1"}]}', FEEDS["meda"]: b'{"sols": []}'}
    snapshot_weather(tmp_path, fetch=payloads.__getitem__, now_iso="2026-09-29T00:00:00Z")
    rems = json.loads((tmp_path / "rems.json").read_text())
    assert rems["soles"] == [{"sol": "1"}]
    assert rems["snapshot_utc"] == "2026-09-29T00:00:00Z"
    assert json.loads((tmp_path / "meda.json").read_text())["sols"] == []


def test_snapshot_refuses_non_json_and_keeps_the_previous_file(tmp_path: Path) -> None:
    (tmp_path / "rems.json").write_text('{"soles": ["old"]}')
    payloads = {FEEDS["rems"]: b"<html>maintenance</html>", FEEDS["meda"]: b'{"sols": []}'}
    with pytest.raises(ValueError, match="rems"):
        snapshot_weather(tmp_path, fetch=payloads.__getitem__, now_iso="x")
    assert json.loads((tmp_path / "rems.json").read_text()) == {"soles": ["old"]}
