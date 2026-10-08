"""JPL CAHVORE camera models, as NASA publishes them with every Mars 2020 raw image.

Projection follows cmod_cahvore_3d_to_2d_general (JPL libcmod, as ported in mrcal's cahvore.cc,
Apache-2.0; Gennery, "Generalized camera calibration including fish-eye lenses", IJCV 2006).
Only directions are projected (the scene is far compared to the lens), so the E terms, which move
the entrance pupil a few millimetres along the axis, shift nothing and are left out.

Frames: the model is in the rover frame (x forward, y right, z down); the rover attitude
quaternion turns that into the site frame (x north, y east, z down). Stitching works in a world
frame of x east, y up, z north, the convention of web/src/core/pinhole.ts.
"""

from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

Vec3 = tuple[float, float, float]
Array = NDArray[np.float64]

LINEARITY_BY_TYPE = {1: 1.0, 2: 0.0}  # perspective, fish-eye; type 3 carries its own value
SMALL_ANGLE_RAD = 1e-8
BACKPROJECT_ITERATIONS = 20
NEWTON_STEP_PX = 1e-3
BACKPROJECT_TOL_PX = 1e-7
# Site frame (north, east, down) -> world (east, up, north).
NED_TO_WORLD = np.array([[0.0, 1.0, 0.0], [0.0, 0.0, -1.0], [1.0, 0.0, 0.0]])


@dataclass(frozen=True)
class Cahvore:
    """Camera axis A, horizontal H and vertical V image vectors, optical axis O, radial terms R."""

    a: Vec3
    h: Vec3
    v: Vec3
    o: Vec3
    r: Vec3
    linearity: float

    def project(self, d: Array) -> Array:
        """Unit directions (N, 3) in the model's frame -> pixels (N, 2); NaN behind the camera."""
        a, h, v, o = (np.asarray(t) for t in (self.a, self.h, self.v, self.o))
        zeta = d @ o
        ll = d - zeta[:, None] * o
        lmag = np.linalg.norm(ll, axis=1)
        theta = np.arctan2(lmag, zeta)
        lin = self.linearity
        with np.errstate(divide="ignore", invalid="ignore"):
            if lin < -1e-15:
                chi = np.sin(lin * theta) / lin
            elif lin > 1e-15:
                chi = np.tan(lin * theta) / lin
            else:
                chi = theta
            mu = self.r[0] + self.r[1] * chi**2 + self.r[2] * chi**4
            zetap = np.where(theta > SMALL_ANGLE_RAD, lmag / chi, zeta)
            p = zetap[:, None] * o + ll * (1 + np.where(theta > SMALL_ANGLE_RAD, mu, 0))[:, None]
            depth = p @ a
            xy = np.stack([p @ h / depth, p @ v / depth], axis=1)
        bad = (zeta <= 0) | (depth <= 0) | (theta * abs(lin) >= np.pi / 2)
        xy[bad] = np.nan
        return xy

    def _cahv_ray(self, xy: Array) -> Array:
        """The undistorted (CAHV) ray through each pixel."""
        a, h, v = (np.asarray(t) for t in (self.a, self.h, self.v))
        ray = np.cross(v - xy[:, 1:2] * a, h - xy[:, 0:1] * a)
        ray *= np.sign(ray @ a)[:, None]
        out: Array = ray / np.linalg.norm(ray, axis=1, keepdims=True)
        return out

    def backproject(self, xy: Array) -> Array:
        """Pixels (N, 2) -> unit directions (N, 3): Newton's method on the undistorted pixel."""
        guess = xy.copy()

        def f(t: Array) -> Array:
            return self.project(self._cahv_ray(t))

        for _ in range(BACKPROJECT_ITERATIONS):
            fx = f(guess)
            error = xy - fx
            if not np.nanmax(np.abs(error), initial=0) > BACKPROJECT_TOL_PX:
                break
            # Finite-difference 2x2 Jacobian per pixel; the map is smooth and nearly diagonal.
            jx = (f(guess + np.array([NEWTON_STEP_PX, 0])) - fx) / NEWTON_STEP_PX
            jy = (f(guess + np.array([0, NEWTON_STEP_PX])) - fx) / NEWTON_STEP_PX
            det = jx[:, 0] * jy[:, 1] - jy[:, 0] * jx[:, 1]
            guess[:, 0] += (jy[:, 1] * error[:, 0] - jy[:, 0] * error[:, 1]) / det
            guess[:, 1] += (jx[:, 0] * error[:, 1] - jx[:, 1] * error[:, 0]) / det
        return self._cahv_ray(guess)


def _vectors(text: str) -> list[list[float]]:
    return [[float(x) for x in part.strip("() ").split(",")] for part in text.split(";")]


def _vec(x: list[float]) -> Vec3:
    return (x[0], x[1], x[2])


def parse_cahvore(text: str) -> Cahvore:
    """NASA raw-image API `camera_model_component_list` -> Cahvore; ValueError if malformed."""
    try:
        parts = _vectors(text)
        c, a, h, v, o, r, e = (p for p in parts[:7])
        model_type = round(parts[7][0])
        parameter = parts[8][0] if len(parts) > 8 else 0.0
    except (ValueError, IndexError) as err:
        raise ValueError(f"not a CAHVORE model: {text[:80]!r}") from err
    if len(parts) < 8 or any(len(x) != 3 for x in (c, a, h, v, o, r, e)):
        raise ValueError(f"not a CAHVORE model: {text[:80]!r}")
    linearity = LINEARITY_BY_TYPE.get(model_type, parameter)
    return Cahvore(a=_vec(a), h=_vec(h), v=_vec(v), o=_vec(o), r=_vec(r), linearity=linearity)


def rover_to_world(attitude: str) -> Array:
    """Rover attitude quaternion "(w,x,y,z)" (rover -> site) -> 3x3 rover -> world rotation."""
    w, x, y, z = (float(t) for t in attitude.strip("() ").split(","))
    n = np.sqrt(w * w + x * x + y * y + z * z)
    w, x, y, z = w / n, x / n, y / n, z / n
    site_from_rover = np.array(
        [
            [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)],
            [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)],
            [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)],
        ]
    )
    out: Array = NED_TO_WORLD @ site_from_rover
    return out


def world_azimuth_elevation(d: Array) -> tuple[Array, Array]:
    """World directions (N, 3) -> compass azimuth (0..360, clockwise from north), elevation, deg."""
    az = np.degrees(np.arctan2(d[:, 0], d[:, 2])) % 360
    el = np.degrees(np.arcsin(np.clip(d[:, 1] / np.linalg.norm(d, axis=1), -1, 1)))
    return az, el
