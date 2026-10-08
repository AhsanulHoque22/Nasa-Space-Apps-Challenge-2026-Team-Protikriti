"""Stitch calibrated rover frames into one equirectangular 360-degree panorama with OpenCV.

1. Pointing: every frame starts from its own JPL camera model and the rover attitude, so it is
   already within a fraction of a degree. SIFT matches between overlapping frames, filtered by
   RANSAC, then drive a rotation-only bundle adjustment (Brown & Lowe, IJCV 2007, section 4) with
   a prior that holds each frame near its calibrated pointing: frames with no texture to match
   (sky, featureless sand) stay where JPL put them instead of drifting.
2. Warp: each frame is projected straight onto the sphere through its CAHVORE lens model.
3. Blend: a gain and offset per frame (Brown & Lowe exposure matching), then OpenCV's block gain
   compensation, graph-cut seams and multi-band blending (cv2.detail, the pipeline behind
   cv2.Stitcher). The sphere wraps at north: frames that cross it
   are blended on a canvas twice as wide with copies on both sides, then cut to 360 degrees.
4. Fill: directions no frame saw are filled by push-pull interpolation (Gortler et al., 1996).

Frames are read from disk only when needed, and full-resolution warps are blended one at a time
(exposure, block gains and seams are found on quarter-scale copies), so a stop imaged for weeks,
with hundreds of frames, stitches whole in a few GB.
"""

import math
from collections.abc import Callable
from dataclasses import dataclass

import cv2
import numpy as np
from numpy.typing import NDArray

from marsmap.cahvore import Array, Cahvore

Image = NDArray[np.uint8]

SIFT_FEATURES = 4000
# Features are found on a copy no larger than this: still ~17 px per degree for Navcam, finer
# than the 11 px per degree panorama, while SIFT on a 5120 x 3840 full-resolution shot needs GBs.
FEATURE_MAX_PX = 1600
RATIO_TEST = 0.75  # Lowe's ratio test
GATE_DEG = 3.0  # calibrated pointing is better than this: farther matches are wrong
INLIER_DEG = 0.12  # ~1.5 Navcam pixels at full resolution
RANSAC_ITERATIONS = 300
MIN_INLIERS = 12
MAX_MATCHES_PER_PAIR = 600
# Each frame is matched with its nearest overlapping frames that look in distinct directions:
# enough links to tie the sphere together, without matching every pair of a 600-frame stop.
MAX_NEIGHBOURS = 12
DISTINCT_DIRECTION_DEG = 2.0
SIGMA_MATCH_DEG = 0.05  # how well a matched feature locates its direction
SIGMA_PRIOR_DEG = 0.5  # how far JPL's pointing may be off (mast backlash, thermal)
HUBER_DEG = 0.1
SOLVER_ITERATIONS = 6
BLACK_LEVEL = 4  # Navcam frames are black outside the lens's image circle: not data
EDGE_ERODE_PX = 8  # frame borders: soft from on-board downsampling, mixed with black when resampled
SEAM_WIDTH = 1024  # seams and block gains are found on a panorama this wide
# Exposure matching (Brown & Lowe, IJCV 2007, section 6), with an offset as well as a gain per
# frame and channel: NASA stretches each browse image's contrast on its own, and a gain alone can
# match the ground or the sky but not both (as in web/src/core/stitch.ts).
SIGMA_NOISE = 10.0  # grey-level noise in overlapping pixels
SIGMA_GAIN = 1.0  # prior spread of the gains around 1: Navcam exposures differ 2-3x (sol 14)
SIGMA_OFFSET = 20.0  # prior spread of the offsets around 0, in grey levels
# Overlap pixels whose brightness ratio strays this far (log units, ~±40%) from the pair's median
# show something that changed between shots (a shadow, the arm), not exposure.
OUTLIER_LOG_RATIO = 0.35
MIN_OVERLAP_PX = 20
# Photos are used up to this elevation. Above it Navcam sees only sky, shot over many hours, so it
# brings Sun glare and exposure arcs; the fill paints a smooth sky instead. Jezero's rim and the
# delta-front scarps stay well below it.
MAX_PHOTO_EL_DEG = 25.0
FILL_CONFIDENCE = 4.0  # coarse levels count as known once a quarter of their pixels are

SIFT = cv2.SIFT_create(nfeatures=SIFT_FEATURES)  # type: ignore[attr-defined]  # not in stubs
CLAHE = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
KERNEL_3X3 = np.ones((3, 3), np.uint8)


def _u8(image: object) -> Image:
    """OpenCV's stubs type every result as a generic array; ours are 8-bit."""
    return np.asarray(image, np.uint8)


@dataclass(frozen=True)
class View:
    load: Callable[[], Image]  # the BGR frame, read on demand so hundreds of frames fit in memory
    width: int
    height: int
    model: Cahvore
    rotation: Array  # model frame -> world (x east, y up, z north)
    group: str  # tiles of one exposure share a pointing correction
    # Brightness falls off as cos^n of the angle off the optical axis; 0 leaves it as shot.
    vignette_exp: float = 0.0
    # Pixels farther off the optical axis lie outside the lens's image circle: dark, not data.
    image_circle_deg: float = 90.0

    @staticmethod
    def of(image: Image, model: Cahvore, rotation: Array, group: str, *rest: float) -> "View":
        """A view of an image already in memory."""
        h, w = image.shape[:2]
        return View(lambda: image, w, h, model, rotation, group, *rest)


@dataclass(frozen=True)
class RefineReport:
    pairs: int
    matches: int
    rms_before_deg: float
    rms_after_deg: float


def _skew(v: Array) -> Array:
    """Cross-product matrices for (N, 3) vectors: _skew(a) @ b == cross(a, b)."""
    z = np.zeros(len(v))
    return np.stack(
        [
            np.stack([z, -v[:, 2], v[:, 1]], 1),
            np.stack([v[:, 2], z, -v[:, 0]], 1),
            np.stack([-v[:, 1], v[:, 0], z], 1),
        ],
        1,
    )


def _angle_deg(a: Array, b: Array) -> Array:
    out: Array = np.degrees(np.arctan2(np.linalg.norm(np.cross(a, b), axis=1), (a * b).sum(1)))
    return out


def _kabsch(src: Array, dst: Array) -> Array:
    """Rotation Q minimising |Q src - dst| over unit vectors (N, 3)."""
    u, _, vt = np.linalg.svd(dst.T @ src)
    d = np.sign(np.linalg.det(u @ vt))
    out: Array = u @ np.diag([1, 1, d]) @ vt
    return out


def _valid_mask(image: Image) -> Image:
    """255 where the frame holds data: black only counts as outside the lens's image circle
    where it reaches the frame's border; a black rock or shadow inside the frame is data."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    _, labels = cv2.connectedComponents((gray <= BLACK_LEVEL).astype(np.uint8))
    border = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    outside = np.isin(labels, border[border > 0])
    mask = np.where(outside, 0, 255).astype(np.uint8)
    return _u8(cv2.erode(mask, KERNEL_3X3, iterations=EDGE_ERODE_PX, borderValue=0))


@dataclass(frozen=True)
class _Features:
    rays: Array  # unit directions in the model frame
    descriptors: Image  # SIFT descriptors rounded to bytes: a quarter of the memory, same matches
    centre: Array  # world direction of the image centre
    radius_deg: float


def _features(v: View) -> _Features:
    h, w = v.height, v.width
    image = v.load()
    shrink = min(1.0, FEATURE_MAX_PX / max(h, w))
    small = image
    if shrink < 1:
        small = _u8(cv2.resize(image, None, fx=shrink, fy=shrink, interpolation=cv2.INTER_AREA))
    gray = CLAHE.apply(cv2.cvtColor(small, cv2.COLOR_BGR2GRAY))
    keypoints, descriptors = SIFT.detectAndCompute(gray, _valid_mask(small))
    # Back to full-resolution pixel coordinates (pixel centres stay centres).
    xy = (np.array([k.pt for k in keypoints], np.float64).reshape(-1, 2) + 0.5) / shrink - 0.5
    rays = v.model.backproject(xy) if len(xy) else np.zeros((0, 3))
    corners = v.model.backproject(np.array([[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]], float))
    centre = v.rotation @ v.model.backproject(np.array([[(w - 1) / 2, (h - 1) / 2]]))[0]
    radius = float(_angle_deg(corners @ v.rotation.T, np.tile(centre, (4, 1))).max())
    compact = (
        np.zeros((0, 128), np.uint8) if descriptors is None else _u8(np.clip(descriptors, 0, 255))
    )
    return _Features(rays, compact, centre, radius)


def _match(a: _Features, b: _Features, ra: Array, rb: Array) -> tuple[Array, Array]:
    """Indices of RANSAC-verified matches between two views, given their current rotations."""
    if len(a.descriptors) < 2 or len(b.descriptors) < 2:
        return np.zeros(0, int), np.zeros(0, int)
    knn = cv2.BFMatcher(cv2.NORM_L2).knnMatch(
        a.descriptors.astype(np.float32), b.descriptors.astype(np.float32), k=2
    )
    pairs = np.array(
        [
            (m.queryIdx, m.trainIdx)
            for m, n in (p for p in knn if len(p) == 2)
            if m.distance < RATIO_TEST * n.distance
        ],
        int,
    ).reshape(-1, 2)
    wa, wb = a.rays[pairs[:, 0]] @ ra.T, b.rays[pairs[:, 1]] @ rb.T
    near = _angle_deg(wa, wb) < GATE_DEG
    pairs, wa, wb = pairs[near], wa[near], wb[near]
    if len(pairs) < MIN_INLIERS:
        return np.zeros(0, int), np.zeros(0, int)
    rng = np.random.default_rng(0)
    best = np.zeros(len(pairs), bool)
    for _ in range(RANSAC_ITERATIONS):
        pick = rng.choice(len(pairs), 2, replace=False)
        q = _kabsch(wb[pick], wa[pick])
        inliers = _angle_deg(wb @ q.T, wa) < INLIER_DEG
        if inliers.sum() > best.sum():
            best = inliers
    if best.sum() < MIN_INLIERS:
        return np.zeros(0, int), np.zeros(0, int)
    q = _kabsch(wb[best], wa[best])  # refit on every inlier, then take the final consensus
    best = _angle_deg(wb @ q.T, wa) < INLIER_DEG
    keep = np.flatnonzero(best)
    if len(keep) > MAX_MATCHES_PER_PAIR:
        keep = rng.choice(keep, MAX_MATCHES_PER_PAIR, replace=False)
    return pairs[keep, 0], pairs[keep, 1]


def _neighbour_pairs(feats: list[_Features], gid: list[int]) -> list[tuple[int, int]]:
    """Pairs to match: for each frame, its nearest overlapping frames of other shots, skipping
    any that looks within DISTINCT_DIRECTION_DEG of one already taken (repeat looks add nothing)."""
    centres = np.array([f.centre for f in feats]).reshape(-1, 3)
    radii = np.array([f.radius_deg for f in feats])
    pairs: set[tuple[int, int]] = set()
    for i in range(len(feats)):
        sep = np.degrees(np.arccos(np.clip(centres @ centres[i], -1, 1)))
        taken: list[int] = []
        for j in np.argsort(sep):
            j = int(j)
            if len(taken) >= MAX_NEIGHBOURS or sep[j] >= radii[i] + radii[j]:
                break
            if gid[j] == gid[i]:
                continue  # tiles of one shot cannot correct each other
            if any(
                math.degrees(math.acos(min(1.0, float(centres[j] @ centres[t]))))
                < DISTINCT_DIRECTION_DEG
                for t in taken
            ):
                continue
            taken.append(j)
            pairs.add((min(i, j), max(i, j)))
    return sorted(pairs)


def refine_rotations(views: list[View]) -> tuple[list[Array], RefineReport]:
    """Rotation-only bundle adjustment of the views' pointing against matched SIFT features."""
    feats = [_features(v) for v in views]
    groups = sorted({v.group for v in views})
    gid = [groups.index(v.group) for v in views]
    links: list[tuple[int, int, Array, Array]] = []  # view i, view j, rays i, rays j (model)
    for i, j in _neighbour_pairs(feats, gid):
        ia, ib = _match(feats[i], feats[j], views[i].rotation, views[j].rotation)
        if len(ia):
            links.append((i, j, feats[i].rays[ia], feats[j].rays[ib]))

    corrections = [np.eye(3) for _ in groups]

    def residuals() -> list[Array]:
        out = []
        for i, j, ra, rb in links:
            wa = ra @ (corrections[gid[i]] @ views[i].rotation).T
            wb = rb @ (corrections[gid[j]] @ views[j].rotation).T
            out.append(_angle_deg(wa, wb))
        return out

    def rms() -> float:
        r = np.concatenate(residuals()) if links else np.zeros(0)
        return float(np.sqrt((r**2).mean())) if len(r) else 0.0

    before = rms()
    n = 3 * len(groups)
    w_match = 1 / math.radians(SIGMA_MATCH_DEG) ** 2
    w_prior = 1 / math.radians(SIGMA_PRIOR_DEG) ** 2
    huber = math.radians(HUBER_DEG)
    for _ in range(SOLVER_ITERATIONS if links else 0):
        normal = np.eye(n) * w_prior
        gradient = np.zeros(n)
        for g, c in enumerate(corrections):  # prior: the total correction stays small
            gradient[3 * g : 3 * g + 3] += w_prior * cv2.Rodrigues(c)[0].ravel()
        for i, j, ra, rb in links:
            wa = ra @ (corrections[gid[i]] @ views[i].rotation).T
            wb = rb @ (corrections[gid[j]] @ views[j].rotation).T
            r = wa - wb
            size = np.linalg.norm(r, axis=1)
            w = w_match * np.where(size < huber, 1.0, huber / np.maximum(size, 1e-12))
            blocks = {gid[i]: -_skew(wa), gid[j]: _skew(wb)}  # d r / d (small rotation)
            for gp, jp in blocks.items():
                gradient[3 * gp : 3 * gp + 3] += np.einsum("k,kab,ka->b", w, jp, r)
                for gq, jq in blocks.items():
                    normal[3 * gp : 3 * gp + 3, 3 * gq : 3 * gq + 3] += np.einsum(
                        "k,kab,kac->bc", w, jp, jq
                    )
        step = -np.linalg.solve(normal, gradient)
        corrections = [
            cv2.Rodrigues(step[3 * g : 3 * g + 3])[0] @ c for g, c in enumerate(corrections)
        ]
    rotations = [corrections[gid[k]] @ v.rotation for k, v in enumerate(views)]
    report = RefineReport(
        pairs=len(links),
        matches=sum(len(ra) for _, _, ra, _ in links),
        rms_before_deg=before,
        rms_after_deg=rms(),
    )
    return rotations, report


COVER_CELL_DEG = 2.0  # sphere grid on which shot footprints are compared
# A shot must add this share of its own footprint to the sphere to be worth stitching.
MIN_NEW_SHARE = 0.05
# Only a shot's inner part counts as covering, so the shots kept still overlap their neighbours
# (seams and exposure matching need shared pixels) and trimmed edges leave no gaps.
COVER_MARGIN = 0.1


def _cover_grid() -> tuple[Array, Array]:
    """Unit directions of the grid cells' centres and each cell's area (cos of elevation)."""
    az = np.radians(np.arange(0, 360, COVER_CELL_DEG) + COVER_CELL_DEG / 2)
    el = np.radians(np.arange(-90, 90, COVER_CELL_DEG) + COVER_CELL_DEG / 2)
    a, e = np.meshgrid(az, el)
    dirs = np.stack([np.cos(e) * np.sin(a), np.sin(e), np.cos(e) * np.cos(a)], -1).reshape(-1, 3)
    return dirs, np.cos(e).ravel()


Shot = tuple[Cahvore, Array, int, int]  # model, rotation, width, height


def _sees(shots: list[Shot], dirs: Array) -> list[NDArray[np.bool_]]:
    """Which grid directions each shot's inner part sees."""
    seen_by = []
    for model, rotation, w, h in shots:
        xy = model.project(dirs @ rotation)  # rows: world -> model frame
        with np.errstate(invalid="ignore"):
            mx, my = COVER_MARGIN * w, COVER_MARGIN * h
            inside_x = (xy[:, 0] >= mx) & (xy[:, 0] < w - mx)
            seen_by.append(inside_x & (xy[:, 1] >= my) & (xy[:, 1] < h - my))
    return seen_by


def pick_covering(
    shots: list[Shot], max_shots: int, already: list[Shot] | None = None
) -> list[int]:
    """Indices of shots that add the most of the sphere beyond what `already` sees: greedily the
    shot adding the most unseen area, until none adds a fair share of its own or `max_shots` are
    picked. Repeat looks at one place are left out."""
    dirs, area = _cover_grid()
    seen_by = _sees(shots, dirs)
    covered = np.zeros(len(dirs), bool)
    for s in _sees(already or [], dirs):
        covered |= s
    chosen: list[int] = []
    while len(chosen) < max_shots:
        gains = [
            -1.0 if k in chosen else float(area[s & ~covered].sum()) for k, s in enumerate(seen_by)
        ]
        best = int(np.argmax(gains))
        if gains[best] <= MIN_NEW_SHARE * area[seen_by[best]].sum():
            break
        chosen.append(best)
        covered |= seen_by[best]
    return chosen


def shows_ground(v: View) -> bool:
    """Whether any of the frame's lower edge looks below the horizon; sky-only shots, taken at
    other hours, bring glare and exposure seams and nothing the sky fill could not paint."""
    h, w = v.height, v.width
    bottom = np.stack([np.linspace(0, w - 1, 16), np.full(16, h - 1.0)], 1)
    return bool(((v.model.backproject(bottom) @ v.rotation.T)[:, 1] < 0).any())


@dataclass(frozen=True)
class _Patch:
    view: int
    image: Image
    mask: Image
    x: int  # left column on the double-width canvas
    y: int


def _footprint(v: View, rotation: Array, width: int) -> tuple[int, int, int, int]:
    """Columns (unwrapped, may exceed the 0..width range) and rows the view covers."""
    h, w = v.height, v.width
    t = np.linspace(0, 1, 64)
    edge = np.concatenate(
        [
            np.stack([t * (w - 1), 0 * t], 1),
            np.stack([t * (w - 1), 0 * t + h - 1], 1),
            np.stack([0 * t, t * (h - 1)], 1),
            np.stack([0 * t + w - 1, t * (h - 1)], 1),
        ]
    )
    d = v.model.backproject(edge) @ rotation.T
    centre = rotation @ v.model.backproject(np.array([[(w - 1) / 2, (h - 1) / 2]]))[0]
    az = np.degrees(np.arctan2(d[:, 0], d[:, 2]))
    caz = math.degrees(math.atan2(centre[0], centre[2])) % 360
    daz = (az - caz + 180) % 360 - 180
    el = np.degrees(np.arcsin(np.clip(d[:, 1], -1, 1)))
    lo_az, hi_az = caz + float(daz.min()), caz + float(daz.max())
    lo_el, hi_el = float(el.min()), float(el.max())
    for pole in (1.0, -1.0):  # a frame looking straight up or down spans every azimuth
        xy = v.model.project((rotation.T @ np.array([0.0, pole, 0.0]))[None])[0]
        if 0 <= xy[0] < w and 0 <= xy[1] < h:
            lo_az, hi_az = caz - 180.0, caz + 180.0
            lo_el, hi_el = (lo_el, 90.0) if pole > 0 else (-90.0, hi_el)
    height = width // 2
    x0 = math.floor(lo_az / 360 * width) - 2
    x1 = min(math.ceil(hi_az / 360 * width) + 2, x0 + width)
    y0 = max(0, math.floor((90 - hi_el) / 180 * height) - 2)
    y1 = min(height, math.ceil((90 - lo_el) / 180 * height) + 2)
    return x0, x1, y0, y1


def _warp(v: View, rotation: Array, width: int, pad: int) -> _Patch | None:
    x0, x1, y0, y1 = _footprint(v, rotation, width)
    if x1 <= x0 or y1 <= y0:
        return None
    height = width // 2
    xs, ys = np.meshgrid(np.arange(x0, x1) + 0.5, np.arange(y0, y1) + 0.5)
    az = xs / width * 2 * np.pi
    el = (0.5 - ys / height) * np.pi
    world = np.stack([np.cos(el) * np.sin(az), np.sin(el), np.cos(el) * np.cos(az)], -1)
    model_dirs = world.reshape(-1, 3) @ rotation  # inverse rotation, row-wise
    xy = v.model.project(model_dirs).reshape(*xs.shape, 2).astype(np.float32)
    source = v.load()
    h, w = source.shape[:2]
    inside = np.isfinite(xy).all(-1) & (xy[..., 0] >= 0) & (xy[..., 0] <= w - 1)
    inside &= (xy[..., 1] >= 0) & (xy[..., 1] <= h - 1)
    xy[~inside] = -1
    image = _u8(cv2.remap(source, xy[..., 0], xy[..., 1], cv2.INTER_LINEAR))
    valid = cv2.remap(_valid_mask(source), xy[..., 0], xy[..., 1], cv2.INTER_NEAREST)
    cos_off_axis = np.clip(model_dirs @ np.asarray(v.model.o), 1e-3, 1).reshape(xs.shape)
    inside &= cos_off_axis > math.cos(math.radians(v.image_circle_deg))
    inside &= el <= math.radians(MAX_PHOTO_EL_DEG)
    mask = np.where(inside & (valid > 0), 255, 0).astype(np.uint8)
    if v.vignette_exp:
        gain = cos_off_axis**-v.vignette_exp
        image = np.clip(image * gain[..., None], 0, 255).astype(np.uint8)
    if not mask.any():
        return None
    return _Patch(view=-1, image=image, mask=mask, x=x0 + pad, y=y0)


def _shifted(p: _Patch, shift: int, canvas_w: int) -> _Patch | None:
    """The patch moved by `shift` columns and cut to the canvas, or None if it falls off."""
    left = max(0, p.x + shift)
    right = min(canvas_w, p.x + shift + p.image.shape[1])
    if right - left <= 0:
        return None
    a, b = left - p.x - shift, right - p.x - shift
    if not p.mask[:, a:b].any():
        return None
    return _Patch(p.view, p.image[:, a:b], p.mask[:, a:b], left, p.y)


def fill_holes(image: NDArray[np.float32], known: NDArray[np.bool_]) -> NDArray[np.float32]:
    """Push-pull: fill unknown pixels from ever coarser averages of the known ones."""
    colour: list[NDArray[np.float32]] = [image * known[..., None]]
    weight: list[NDArray[np.float32]] = [known.astype(np.float32)]
    while min(weight[-1].shape) > 2:
        colour.append(np.asarray(cv2.pyrDown(colour[-1]), np.float32))
        weight.append(np.asarray(cv2.pyrDown(weight[-1]), np.float32))
    filled = colour[-1] / np.maximum(weight[-1], 1e-6)[..., None]
    if not weight[-1].any():
        filled[:] = 0
    for level in range(len(colour) - 2, -1, -1):
        h, w = weight[level].shape
        up = cv2.pyrUp(filled, dstsize=(w, h))
        mean = colour[level] / np.maximum(weight[level], 1e-6)[..., None]
        trust = np.clip(weight[level] * FILL_CONFIDENCE, 0, 1)[..., None]
        filled = mean * trust + up * (1 - trust)
    out: NDArray[np.float32] = np.where(known[..., None], image, filled).astype(np.float32)
    return out


def _overlap(a: _Patch, b: _Patch, width: int) -> tuple[Array, Array]:
    """Pixels of two low-resolution patches that look the same way (sphere `width` wide, wrapping
    at north), as two (N, 3) arrays."""
    ha, wa = a.mask.shape
    hb, wb = b.mask.shape
    pa: list[Array] = []
    pb: list[Array] = []
    for shift in (-width, 0, width):
        x0, x1 = max(a.x, b.x + shift), min(a.x + wa, b.x + shift + wb)
        y0, y1 = max(a.y, b.y), min(a.y + ha, b.y + hb)
        if x1 <= x0 or y1 <= y0:
            continue
        sa = (slice(y0 - a.y, y1 - a.y), slice(x0 - a.x, x1 - a.x))
        sb = (slice(y0 - b.y, y1 - b.y), slice(x0 - b.x - shift, x1 - b.x - shift))
        both = (a.mask[sa] > 0) & (b.mask[sb] > 0)
        pa.append(a.image[sa][both].astype(np.float64))
        pb.append(b.image[sb][both].astype(np.float64))
    if not pa:
        return np.zeros((0, 3)), np.zeros((0, 3))
    return np.concatenate(pa), np.concatenate(pb)


def _exposures(small: list[_Patch], width: int) -> tuple[Array, Array]:
    """Gain and offset per patch and channel (each (N, 3)) that make overlaps agree, fitted on
    low-resolution patches of a sphere `width` wide."""
    n = len(small)
    normal = np.zeros((3, 2 * n, 2 * n))  # unknowns per channel: gains 0..n-1, offsets n..2n-1
    overlap = np.zeros(n)
    for i in range(n):
        for j in range(i + 1, n):
            a, b = _overlap(small[i], small[j], width)
            if len(a) < MIN_OVERLAP_PX:
                continue
            ratio = np.log((a.mean(1) + 1) / (b.mean(1) + 1))
            keep = np.abs(ratio - np.median(ratio)) < OUTLIER_LOG_RATIO
            a, b = a[keep], b[keep]
            overlap[[i, j]] += len(a)
            for c in range(3):  # residual g_i a + o_i - g_j b - o_j, per sample
                jac = np.stack([a[:, c], np.ones(len(a)), -b[:, c], -np.ones(len(a))], 1)
                idx = [i, n + i, j, n + j]
                normal[c][np.ix_(idx, idx)] += jac.T @ jac / SIGMA_NOISE**2
    target = np.zeros((3, 2 * n))
    for k in range(n):  # priors, scaled by the overlap so they weigh per sample like the data
        weight = max(1.0, overlap[k])
        normal[:, k, k] += weight / SIGMA_GAIN**2
        target[:, k] += weight / SIGMA_GAIN**2
        normal[:, n + k, n + k] += weight / SIGMA_OFFSET**2
    solved = np.stack([np.linalg.solve(normal[c], target[c]) for c in range(3)], 1)
    gains, offsets = solved[:n], solved[n:]
    # Overall brightness and colour are arbitrary: keep the area-weighted mean colour of the frames
    # as NASA shows them. One scale per channel for every frame keeps each overlap matched.
    pixels = [p.image[p.mask > 0].astype(np.float64) for p in small]
    shot = sum((px.sum(0) for px in pixels), np.zeros(3))
    shown = sum(((px * gains[k] + offsets[k]).sum(0) for k, px in enumerate(pixels)), np.zeros(3))
    level = shot / np.maximum(shown, 1e-6)
    return gains * level, offsets * level


# Overall tone: NASA stretches some stops' frames near white (sol 565: frame means 200-255). A
# gamma curve takes the photographed area's median luma to the level of the stops that look
# natural (107-120 at Hawksbill Gap), leaving black and white in place.
TONE_MEDIAN = 112.0
TONE_GAMMA_RANGE = (0.4, 2.5)  # beyond this the curve would invent contrast


def tone(image: Image, seen: NDArray[np.bool_]) -> Image:
    """Gamma-correct `image` so the median luma of the `seen` pixels is TONE_MEDIAN."""
    luma = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)[seen]
    median = float(np.median(luma)) if luma.size else TONE_MEDIAN
    if not 0 < median < 255:
        return image
    gamma = math.log(TONE_MEDIAN / 255) / math.log(median / 255)
    gamma = min(max(gamma, TONE_GAMMA_RANGE[0]), TONE_GAMMA_RANGE[1])
    lut = np.clip(np.round(255 * (np.arange(256) / 255) ** gamma), 0, 255).astype(np.uint8)
    return _u8(cv2.LUT(image, lut))


def _adjust(image: Image, gain: Array, offset: Array) -> Image:
    return np.clip(image * gain + offset, 0, 255).astype(np.uint8)


def render(
    views: list[View], rotations: list[Array], width: int
) -> tuple[Image, NDArray[np.bool_]]:
    """Equirectangular panorama (width x width/2, row 0 at the zenith, column 0 at north) and
    which of its pixels some frame saw."""
    height = width // 2
    pad = width // 2  # every frame fits unclipped on a canvas half a turn wider on each side
    canvas_w = width + 2 * pad
    scale = SEAM_WIDTH / width

    def full(k: int) -> _Patch | None:
        p = _warp(views[k], rotations[k], width, pad)
        return None if p is None else _Patch(k, p.image, p.mask, p.x, p.y)

    # Pass 1: every frame warped straight onto a quarter-scale sphere (a sixteenth of the work).
    small: list[_Patch] = []
    for k in range(len(views)):
        p = _warp(views[k], rotations[k], SEAM_WIDTH, SEAM_WIDTH // 2)
        if p is not None:
            small.append(_Patch(k, p.image, p.mask, p.x, p.y))
    if not small:
        raise ValueError("no frame lands on the panorama")

    gains, offsets = _exposures(small, SEAM_WIDTH)
    small = [
        _Patch(p.view, _adjust(p.image, g, o), p.mask, p.x, p.y)
        for p, g, o in zip(small, gains, offsets, strict=True)
    ]
    # What a gain per frame cannot reach (uneven light within a frame): OpenCV's block gains,
    # fitted on the low-resolution patches and applied to the full ones.
    detail = cv2.detail  # its classes are missing from OpenCV's stubs
    compensator = detail.ExposureCompensator_createDefault(  # type: ignore[attr-defined]
        detail.ExposureCompensator_CHANNELS_BLOCKS
    )
    compensator.feed(
        corners=[(p.x, p.y) for p in small],
        images=[p.image for p in small],
        masks=[p.mask for p in small],
    )

    # Copies one turn left and right, so frames meet across north as they do everywhere else.
    small_w = round(canvas_w * scale)
    placed = [
        (k, shift, s)
        for k, p in enumerate(small)
        for shift in (-width, 0, width)
        if (s := _shifted(p, round(shift * scale), small_w))
    ]
    seams = cv2.detail_GraphCutSeamFinder("COST_COLOR_GRAD").find(  # type: ignore[attr-defined]
        [s.image.astype(np.float32) for _, _, s in placed],
        [(s.x, s.y) for _, _, s in placed],
        [s.mask for _, _, s in placed],
    )

    # Pass 2: each frame warped again at full resolution and blended, one at a time.
    blender = cv2.detail_MultiBandBlender()  # type: ignore[attr-defined]
    blender.setNumBands(max(1, int(math.log2(width * 0.05 / 4))))
    blender.prepare((0, 0, canvas_w, height))
    for k, p_small in enumerate(small):
        p = full(p_small.view)
        if p is None:
            continue
        image = _adjust(p.image, gains[k], offsets[k])
        image = _u8(compensator.apply(k, (p.x, p.y), image, p.mask))
        p = _Patch(p.view, image, p.mask, p.x, p.y)
        for (kk, shift, _), seam in zip(placed, seams, strict=True):
            if kk != k or (s := _shifted(p, shift, canvas_w)) is None:
                continue
            seam_px = seam.get() if isinstance(seam, cv2.UMat) else seam  # the finder gives UMats
            seam_mask = cv2.dilate(np.asarray(seam_px, np.uint8), KERNEL_3X3)
            seam_mask = cv2.resize(
                seam_mask, s.mask.shape[::-1], interpolation=cv2.INTER_LINEAR_EXACT
            )
            blender.feed(s.image.astype(np.int16), cv2.bitwise_and(seam_mask, s.mask), (s.x, s.y))
    result, result_mask = blender.blend(None, None)
    pano = result[:, pad : pad + width].astype(np.float32)
    covered = result_mask[:, pad : pad + width] > 0
    filled = fill_holes(pano, covered)
    return tone(np.clip(filled + 0.5, 0, 255).astype(np.uint8), covered), covered
