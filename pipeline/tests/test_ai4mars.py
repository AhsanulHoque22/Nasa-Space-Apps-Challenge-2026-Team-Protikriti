import base64
import json
import warnings
import zipfile
from pathlib import Path

import numpy as np
import pytest
from rasterio.errors import NotGeoreferencedWarning
from rasterio.io import MemoryFile

from marsmap.ai4mars import (
    NONE,
    build_labels,
    decode_rle,
    encode_rle,
    group_of,
    label_key,
    shrink,
)


def png(values: np.ndarray) -> bytes:
    with (
        warnings.catch_warnings(category=NotGeoreferencedWarning, action="ignore"),
        MemoryFile() as mem,
    ):
        with mem.open(
            driver="PNG", width=values.shape[1], height=values.shape[0], count=1, dtype="uint8"
        ) as dst:
            dst.write(values, 1)
        return bytes(mem.read())


class TestKeys:
    def test_curiosity_labels_key_on_the_product_id_without_its_version(self) -> None:
        # Labels are on version 1 products ("...M1"); the raw API serves "...M_" of the same shot.
        name = "NLA_409036068EDR_F0051606NCAM00348M1.png"
        assert label_key("msl", name) == "NLA_409036068EDR_F0051606NCAM00348M"
        assert label_key("msl", "NLA_409036068EDR_F0051606NCAM00348M1_merged.png") == (
            "NLA_409036068EDR_F0051606NCAM00348M"
        )
        assert label_key("msl", "NLA_409036068EDR_F0051606NCAM00348M_.png") == (
            "NLA_409036068EDR_F0051606NCAM00348M"
        )
        assert group_of("msl", "NLA_409036068EDR_F0051606NCAM00348M1") == "4090"

    def test_perseverance_labels_key_on_eye_and_exposure_clock(self) -> None:
        # The label is on the full-frame product; the raw API serves tiles of the same exposure.
        label = "NLF_0009_0667755959_167ECM_N0030000NCAM05000_01_295J_merged60.png"
        tile = "NLF_0009_0667755959_167EBY_N0030000NCAM05000_08_0LLJ"
        assert label_key("m20", label) == label_key("m20", tile) == "NL_0667755959_167"
        assert group_of("m20", tile) == "9"

    def test_unknown_names_are_rejected(self) -> None:
        assert label_key("m20", "VgncRawLeft_0709292134-43706-1_rectified_merged13.png") is None
        assert label_key("msl", "README.txt") is None


class TestEncoding:
    def test_rle_round_trips_long_runs(self) -> None:
        cls = np.array([0] * 300 + [1, 1, 2] + [NONE] * 10, dtype=np.uint8)
        assert np.array_equal(decode_rle(encode_rle(cls), cls.size), cls)

    def test_shrink_keeps_classes_and_aspect(self) -> None:
        big = np.full((960, 1280), 255, dtype=np.uint8)
        big[:480, :] = 1
        small = shrink(big, 128)
        assert small.shape == (96, 128)
        assert set(np.unique(small)) == {1, NONE}  # 255 (no label) becomes NONE


def test_build_writes_groups_and_index(tmp_path: Path) -> None:
    zpath = tmp_path / "ai4mars.zip"
    label = np.zeros((96, 128), dtype=np.uint8)
    label[:, 64:] = 3
    with zipfile.ZipFile(zpath, "w") as z:
        z.writestr(
            "ai4mars-dataset-merged-0.6/msl/ncam/labels/train/NLA_409036068EDR_F0051606NCAM00348M1.png",
            png(label),
        )
        z.writestr(
            "ai4mars-dataset-merged-0.6/m2020/labels/NAV/NLF_0009_0667755959_167ECM_N0030000NCAM05000_01_295J_merged60.png",
            png(label),
        )
        z.writestr("ai4mars-dataset-merged-0.6/m2020/labels/NAV/VgncRawLeft_1_merged13.png", b"x")
    index = build_labels(str(zpath), tmp_path / "out")
    assert index["counts"] == {"m20": 1, "msl": 1}
    assert index["groups"] == {"m20": ["9"], "msl": ["4090"]}
    assert "CC BY 4.0" in index["license"]
    doc = json.loads((tmp_path / "out" / "msl" / "4090.json").read_text())
    entry = doc["NLA_409036068EDR_F0051606NCAM00348M"]
    cls = decode_rle(base64.b64decode(entry["rle"]), entry["w"] * entry["h"])
    assert (entry["w"], entry["h"]) == (128, 96)
    assert cls.reshape(96, 128)[0, 0] == 0 and cls.reshape(96, 128)[0, 127] == 3
    assert json.loads((tmp_path / "out" / "index.json").read_text()) == index


def test_rle_rejects_bad_runs() -> None:
    with pytest.raises(ValueError, match="cells"):
        decode_rle(bytes([0, 5]), 10)
