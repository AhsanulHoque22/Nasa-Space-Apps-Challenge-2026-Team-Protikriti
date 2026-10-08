import math

import numpy as np
import pytest

from marsmap.cahvore import Cahvore, parse_cahvore, rover_to_world, world_azimuth_elevation

# Perseverance NAVCAM_LEFT, sol 14, site 3 drive 110 (NLF_0014_0668192307_846ECM_N0030110NCAM02014)
M20_MODEL = (
    "(0.563572,0.473888,-1.90136);(-0.199471,-0.828431,0.523382);(589.435,-711.664,337.385);"
    "(-3.98773,-26.3001,884.12);(-0.198073,-0.828704,0.52348);(2e-06,0.049535,-0.015973);"
    "(-0.003612,0.013016,-0.023961);2.0;0.0"
)
M20_ATTITUDE = "(0.991281,0.00808985,-0.00342531,-0.131471)"


def _directions_near(axis: np.ndarray, max_deg: float, n: int = 200) -> np.ndarray:
    rng = np.random.default_rng(0)
    d = axis + rng.uniform(-1, 1, (n, 3)) * math.tan(math.radians(max_deg))
    d /= np.linalg.norm(d, axis=1, keepdims=True)
    inside: np.ndarray = d[np.degrees(np.arccos(d @ axis)) <= max_deg]  # in the field of view
    return inside


def test_parse_reads_vectors_and_fisheye_linearity() -> None:
    m = parse_cahvore(M20_MODEL)
    assert m.a == pytest.approx((-0.199471, -0.828431, 0.523382))
    assert m.r == pytest.approx((2e-06, 0.049535, -0.015973))
    assert m.linearity == 0.0  # type 2: fish-eye


def test_parse_rejects_malformed_models() -> None:
    with pytest.raises(ValueError, match="CAHVORE"):
        parse_cahvore("(1,2,3);(4,5,6)")


def test_axis_projects_to_the_principal_point() -> None:
    m = parse_cahvore(M20_MODEL)
    x, y = m.project(np.array([m.a]))[0]
    a, h, v = (np.array(t) for t in (m.a, m.h, m.v))
    # O differs from A by ~0.1 degrees, so the axis lands within a pixel or two of (A.H, A.V).
    assert x == pytest.approx(a @ h, abs=2)
    assert y == pytest.approx(a @ v, abs=2)


def test_pinhole_model_matches_cahv() -> None:
    m = Cahvore(
        a=(0, 0, 1), h=(500, 0, 320), v=(0, 500, 240), o=(0, 0, 1), r=(0, 0, 0), linearity=1.0
    )
    d = np.array([[0.1, -0.2, 1.0]])
    assert m.project(d)[0] == pytest.approx([320 + 50, 240 - 100])


def test_backproject_inverts_project() -> None:
    m = parse_cahvore(M20_MODEL)
    d = _directions_near(np.array(m.a), 50)
    back = m.backproject(m.project(d))
    assert np.degrees(np.arccos(np.clip((back * d).sum(axis=1), -1, 1))).max() < 1e-4


def test_directions_behind_the_camera_are_nan() -> None:
    m = parse_cahvore(M20_MODEL)
    assert np.isnan(m.project(-np.array([m.a]))).all()


def test_attitude_gives_the_rover_heading() -> None:
    # MMGIS gives this stop's rover yaw as -15.1 degrees.
    forward_world = rover_to_world(M20_ATTITUDE) @ np.array([1.0, 0.0, 0.0])
    az, _ = world_azimuth_elevation(forward_world[None])
    assert az[0] == pytest.approx(360 - 15.1, abs=0.1)


def test_model_axis_matches_the_mast_pointing() -> None:
    # The record's mastAz/mastEl are 255.64/-31.11 in the rover frame.
    m = parse_cahvore(M20_MODEL)
    az, el = world_azimuth_elevation((rover_to_world("(1,0,0,0)") @ np.array(m.a))[None])
    assert az[0] == pytest.approx(255.64, abs=1)
    assert el[0] == pytest.approx(-31.11, abs=1)
