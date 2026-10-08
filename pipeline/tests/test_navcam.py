import copy
import dataclasses
from typing import Any

import numpy as np
import pytest
from test_cahvore import M20_ATTITUDE, M20_MODEL

from marsmap.navcam import exposure_id, normalize_m20, select_frames

RECORD: dict[str, Any] = {
    "imageid": "NLF_0014_0668192307_846ECM_N0030110NCAM02014_01_285J",
    "sol": 14,
    "site": 3,
    "drive": "110",
    "sample_type": "Full",
    "attitude": M20_ATTITUDE,
    "date_taken_utc": "2021-03-05T05:00:08.982",
    "link": "https://mars.nasa.gov/mars2020/multimedia/raw-images/NLF_0014",
    "camera": {"instrument": "NAVCAM_LEFT", "camera_model_component_list": M20_MODEL},
    "extended": {"dimension": "(1280,960)", "mastAz": "255.64", "mastEl": "-31.1084"},
    "image_files": {
        "full_res": "https://mars.nasa.gov/mars2020-raw-images/pub/ods/surface/sol/00014/ids/"
        "edr/browse/ncam/NLF_0014_0668192307_846ECM_N0030110NCAM02014_01_285J01.png"
    },
}


def _with(**changes: Any) -> dict[str, Any]:
    r = copy.deepcopy(RECORD)
    r.update(changes)
    return r


def test_normalize_reads_model_attitude_and_size() -> None:
    [f] = normalize_m20({"images": [RECORD]})
    assert (f.site, f.drive, f.sol) == (3, 110, 14)
    assert (f.width, f.height) == (1280, 960)
    assert f.right_eye is False
    assert f.url.endswith("285J01.png")
    # Model and attitude together put the camera axis at the mast azimuth turned by the yaw.
    axis = f.rotation @ np.array(f.model.a)
    az = np.degrees(np.arctan2(axis[0], axis[2])) % 360
    assert az == pytest.approx((255.64 - 15.1) % 360, abs=1)


@pytest.mark.parametrize(
    "bad",
    [
        _with(sample_type="Thumbnail"),
        _with(attitude=None),
        _with(camera={"instrument": "NAVCAM_LEFT"}),
        _with(image_files={"full_res": "http://insecure.example/x.png"}),
        _with(extended={"dimension": "unknown"}),
    ],
)
def test_normalize_skips_unusable_records(bad: dict[str, Any]) -> None:
    assert normalize_m20({"images": [bad]}) == []


def test_normalize_rejects_unexpected_payload() -> None:
    with pytest.raises(ValueError, match="images"):
        normalize_m20({"items": []})


def test_exposure_id_groups_tiles_of_one_shot() -> None:
    a = "https://x/NLF_0014_0668192307_846ECM_N0030110NCAM02014_01_285J01.png"
    b = "https://x/NLF_0014_0668192307_846ECM_N0030110NCAM02014_02_285J01.png"
    assert exposure_id(a) == exposure_id(b) == "NLF_0014_0668192307"


def test_select_keeps_the_stop_and_right_eye_only_where_left_misses() -> None:
    left = normalize_m20({"images": [RECORD]})[0]
    right_same = normalize_m20(
        {
            "images": [
                _with(imageid="NRF_X", camera={**RECORD["camera"], "instrument": "NAVCAM_RIGHT"})
            ]
        }
    )[0]
    elsewhere = normalize_m20({"images": [_with(drive="200")]})[0]
    chosen = select_frames([left, right_same, elsewhere], site=3, drive=110)
    assert chosen == [left]


def _tile(sub: str, scale: int, dims: str, index: int) -> dict[str, Any]:
    r = _with(imageid=f"NLF_0014_0668192307_846ECM_N0030110NCAM02014_{index:02d}_285J")
    r["extended"] = {
        **r["extended"],
        "subframeRect": sub,
        "scaleFactor": str(scale),
        "dimension": dims,
    }
    return r


def test_mosaic_rebuilds_one_sensor_image_from_its_tiles() -> None:
    from marsmap.navcam import mosaic, shift_model

    # Two side-by-side tiles of one 2x-binned shot sharing a 16-pixel strip.
    left, right = normalize_m20(
        {
            "images": [
                _tile("(1,1,2576,1936)", 2, "(1288,968)", 1),
                _tile("(2545,1,2576,1936)", 2, "(1288,968)", 2),
            ]
        }
    )
    # NASA's model for each tile is the shot's model in that tile's pixel coordinates.
    right = dataclasses.replace(right, model=shift_model(left.model, -1272, 0))
    rng = np.random.default_rng(0)
    scene = rng.integers(40, 200, (968, 2560, 3)).astype(np.uint8)
    # NASA stretches each tile on its own: the right tile came out brighter.
    tiles = [
        (left, scene[:, :1288]),
        (right, np.clip(scene[:, 1272:] * 1.2 + 10, 0, 255).astype(np.uint8)),
    ]
    image, model = mosaic(tiles)
    assert image.shape == (968, 2560, 3)
    assert np.abs(image.astype(int) - scene.astype(int)).mean() < 2
    # The mosaic's model sees a direction where the left tile's does, shifted by nothing,
    # and where the right tile's does, shifted by its 1272-pixel offset.
    d = right.model.backproject(np.array([[100.0, 500.0]]))
    assert model.project(d)[0] == pytest.approx([1372.0, 500.0], abs=0.05)
