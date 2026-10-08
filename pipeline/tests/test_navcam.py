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


MSL_RECORD: dict[str, Any] = {
    "imageid": "NLB_663825389EDR_F0850000NCAM00312M_",
    "sol": 3000,
    "site": 85,
    "drive": 0,
    "instrument": "NAV_LEFT_B",
    "is_thumbnail": False,
    "attitude": "(0.96844,-0.0245114,-0.0217826,0.247079)",
    "camera_model_type": "CAHVOR",
    "camera_model_component_list": (
        "(0.939641,0.75466,-1.84547);(-0.340077,0.596884,0.726678);(-1237.1,-302.686,367.626);"
        "(268.703,-474.285,1206.33);(-0.340075,0.596885,0.726678);(0.0,0.000114235,0.00639706)"
    ),
    "subframe_rect": "(1,1,1024,1024)",
    "scale_factor": 1,
    "date_taken": "2021-01-13T16:40:35.000Z",
    "link": "/raw_images/883244",
    "https_url": "https://mars.nasa.gov/msl-raw-images/proj/msl/redops/ods/surface/sol/03000/opgs/"
    "edr/ncam/NLB_663825389EDR_F0850000NCAM00312M_.JPG",
    "extended": {"sample_type": "full", "mast_az": "119.969", "mast_el": "-47.0461"},
}


def test_normalize_msl_reads_curiosity_records() -> None:
    from marsmap.navcam import normalize_msl

    [f] = normalize_msl({"items": [MSL_RECORD, {**MSL_RECORD, "is_thumbnail": True}]})
    assert (f.site, f.drive, f.sol) == (85, 0, 3000)
    assert (f.width, f.height) == (1024, 1024)
    assert f.link == "https://mars.nasa.gov/raw_images/883244"
    assert f.model.linearity == 1.0 and not f.right_eye
    # In the rover's own frame the model looks where the mast points (az 119.97, el -47.05).
    from marsmap.cahvore import rover_to_world, world_azimuth_elevation

    az, el = world_azimuth_elevation((rover_to_world("(1,0,0,0)") @ np.array(f.model.a))[None])
    assert (az[0], el[0]) == pytest.approx((119.97, -47.05), abs=1)
    # The attitude tilts that by the rover's ~4 degrees of roll and pitch, no more.
    world_el = np.degrees(np.arcsin((f.rotation @ np.array(f.model.a))[1]))
    assert abs(world_el - el[0]) < 6


def test_normalize_msl_sizes_binned_subframes() -> None:
    from marsmap.navcam import normalize_msl

    record = {**MSL_RECORD, "subframe_rect": "(1,513,1024,512)", "scale_factor": 2}
    [f] = normalize_msl({"items": [record]})
    assert (f.width, f.height) == (512, 256)
    assert f.offset == (0.0, 256.0)


def test_index_is_slim_and_provenance_is_per_stop(tmp_path: Any) -> None:
    import json

    from marsmap.streetview import update_index

    frames = [{"id": f"F{k}", "sol": 14, "link": f"https://mars.nasa.gov/{k}"} for k in range(3)]
    record = {"file": "3_110.jpg", "width": 4096, "sol": 14, "frames": frames}
    update_index(tmp_path, "3_110", record)
    entry = json.loads((tmp_path / "index.json").read_text())["3_110"]
    assert "frames" not in entry
    assert entry["frameCount"] == 3 and entry["link"] == "https://mars.nasa.gov/0"
    assert json.loads((tmp_path / entry["provenance"]).read_text())["frames"] == frames


def test_batch_resumes_records_crashes_and_failures(tmp_path: Any, monkeypatch: Any) -> None:
    import json

    import marsmap.__main__ as cli

    stops = [{"site": 1, "drive": d, "sol": 10 + d} for d in range(4)]
    (tmp_path / "stops.json").write_text(json.dumps(stops))
    out = tmp_path / "pano"
    out.mkdir()
    (out / ".current").write_text("1_0")  # the last run died on stop 1_0
    (out / "index.json").write_text(json.dumps({"1_1": {"file": "1_1.jpg"}}))  # already built
    built = []

    def fake(rover: str, stop: dict[str, Any], *rest: Any) -> dict[str, Any]:
        if stop["drive"] == 2:
            raise ValueError("no usable Navcam frames")
        built.append(stop["drive"])
        frames = [{"id": "F", "sol": stop["sol"], "link": ""}]
        return {
            "file": "x.jpg",
            "sol": stop["sol"],
            "coveredFraction": 0.5,
            "frames": frames,
            "alignment": {"pairs": 0, "rmsBeforeDeg": 0, "rmsAfterDeg": 0},
        }

    monkeypatch.setattr(cli, "build_panorama", fake)
    args = ["panorama", "--all", "--stops", str(tmp_path / "stops.json"), "--raw", str(tmp_path)]
    cli.main([*args, "--out", str(out)])
    assert built == [3]  # 1_0 crashed before, 1_1 was done, 1_2 has nothing to stitch
    failures = json.loads((out / "failures.json").read_text())
    assert set(failures) == {"1_0", "1_2"}
    assert set(json.loads((out / "index.json").read_text())) == {"1_1", "1_3"}
    assert not (out / ".current").exists()
