"""
Build recognisable colony module GLB proxies with trimesh.

Each model fits in a ~2 m bounding box (colony-modules.ts multiplies by
MODULE_SCALE, so 2 m x 5 = 10 m habitat on screen).  All geometry is
created from primitive operations — no external data files needed.

Run from repo root:
    cd pipeline && uv run python scripts/make_proxy_models.py
"""

from pathlib import Path

import numpy as np
import trimesh
import trimesh.transformations as tf

OUT = Path(__file__).parent.parent.parent / "web" / "public" / "models"
OUT.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _colored(mesh: trimesh.Trimesh, rgba: tuple[int, int, int, int]) -> trimesh.Trimesh:
    mesh.visual = trimesh.visual.ColorVisuals(mesh=mesh, vertex_colors=rgba)
    return mesh


def _export(scene: trimesh.Scene, name: str) -> None:
    path = OUT / name
    data = scene.export(file_type="glb")
    path.write_bytes(data)
    print(f"  {name}: {len(data):,} bytes")


def _translate(mesh: trimesh.Trimesh, xyz: tuple[float, float, float]) -> trimesh.Trimesh:
    m = mesh.copy()
    m.apply_translation(xyz)
    return m


def _rotate_z(mesh: trimesh.Trimesh, deg: float) -> trimesh.Trimesh:
    m = mesh.copy()
    m.apply_transform(tf.rotation_matrix(np.radians(deg), [0, 0, 1]))
    return m


# ---------------------------------------------------------------------------
# Habitat  — white pressure cylinder with two orange end-rings
#            (represents an inflatable Mars habitat module like BEAM)
# ---------------------------------------------------------------------------


def make_habitat() -> None:
    print("habitat …")
    # main body: cylinder R=1, H=2 — translated +1 so base sits at z=0
    body = trimesh.creation.cylinder(radius=1.0, height=2.0, sections=32)
    body.apply_translation([0, 0, 1.0])
    _colored(body, (230, 230, 235, 255))  # off-white / aluminium

    # orange end-rings (thin cylinders at top and bottom)
    ring_top = trimesh.creation.cylinder(radius=1.05, height=0.12, sections=32)
    ring_top.apply_translation([0, 0, 1.94])
    _colored(ring_top, (210, 100, 30, 255))  # NASA orange

    ring_bot = ring_top.copy()
    ring_bot.apply_translation([0, 0, -1.88])
    _colored(ring_bot, (210, 100, 30, 255))

    # small airlock box on the side
    airlock = trimesh.creation.box([0.4, 0.5, 0.5])
    airlock.apply_translation([1.0, 0, 0.5])
    _colored(airlock, (180, 180, 190, 255))

    scene = trimesh.Scene([body, ring_top, ring_bot, airlock])
    _export(scene, "habitat.glb")


# ---------------------------------------------------------------------------
# Solar Array  — two dark-blue panels on a thin pole (like InSight/Phoenix)
# ---------------------------------------------------------------------------


def make_solar_array() -> None:
    print("solar-array …")
    # mast: thin cylinder
    mast = trimesh.creation.cylinder(radius=0.04, height=1.2, sections=8)
    mast.apply_translation([0, 0, 0.6])
    _colored(mast, (150, 140, 130, 255))  # mast grey

    # two panels, one each side
    panel = trimesh.creation.box([1.8, 0.7, 0.04])  # flat panel
    _colored(panel, (20, 40, 160, 255))  # deep blue (solar cell colour)

    panel_l = panel.copy()
    panel_l.apply_translation([-0.95, 0, 1.0])

    panel_r = panel.copy()
    panel_r.apply_translation([0.95, 0, 1.0])

    # panel frame (thin white border)
    frame_l = trimesh.creation.box([1.84, 0.72, 0.02])
    _colored(frame_l, (200, 200, 200, 255))
    frame_l.apply_translation([-0.95, 0, 1.02])

    frame_r = frame_l.copy()
    frame_r.apply_translation([1.90, 0, 0])

    scene = trimesh.Scene([mast, panel_l, panel_r, frame_l, frame_r])
    _export(scene, "solar-array.glb")


# ---------------------------------------------------------------------------
# ISRU  — MOXIE-style unit: main box + two small cylinders (O₂ tanks)
# ---------------------------------------------------------------------------


def make_isru() -> None:
    print("isru …")
    # main processing box (orange — Mars-regolith color)
    box = trimesh.creation.box([1.0, 0.8, 0.9])
    box.apply_translation([0, 0, 0.45])
    _colored(box, (195, 110, 50, 255))

    # two small O₂ tank cylinders on top
    tank = trimesh.creation.cylinder(radius=0.15, height=0.5, sections=16)
    tank_l = tank.copy()
    tank_l.apply_translation([-0.25, 0, 1.15])
    _colored(tank_l, (230, 230, 240, 255))  # white tanks

    tank_r = tank.copy()
    tank_r.apply_translation([0.25, 0, 1.15])
    _colored(tank_r, (230, 230, 240, 255))

    # inlet pipe
    pipe = trimesh.creation.cylinder(radius=0.05, height=0.4, sections=8)
    pipe.apply_translation([0, -0.45, 0.5])
    _colored(pipe, (140, 130, 120, 255))

    scene = trimesh.Scene([box, tank_l, tank_r, pipe])
    _export(scene, "isru.glb")


# ---------------------------------------------------------------------------
# Greenhouse  — hemispherical dome on a cylindrical base (green glass)
# ---------------------------------------------------------------------------


def make_greenhouse() -> None:
    print("greenhouse …")
    # cylindrical base
    base = trimesh.creation.cylinder(radius=0.9, height=0.35, sections=32)
    base.apply_translation([0, 0, 0.175])
    _colored(base, (160, 180, 155, 255))  # muted green base

    # dome: top half of a sphere
    sphere = trimesh.creation.icosphere(subdivisions=3, radius=0.92)
    verts = sphere.vertices
    top_mask = verts[:, 2] >= 0
    top_faces = np.array([f for f in sphere.faces if all(top_mask[v] for v in f)])
    if len(top_faces):
        dome = trimesh.Trimesh(vertices=verts, faces=top_faces)
        dome.apply_translation([0, 0, 0.35])
        _colored(dome, (80, 185, 90, 220))  # translucent green
    else:
        # fallback full sphere if hemisphere fails
        dome = sphere.copy()
        dome.apply_translation([0, 0, 0.35])
        _colored(dome, (80, 185, 90, 220))

    scene = trimesh.Scene([base, dome])
    _export(scene, "greenhouse.glb")


# ---------------------------------------------------------------------------
# Garage / Pressurised Rover Bay  — wide low box with a ridge-line roof
# ---------------------------------------------------------------------------


def make_garage() -> None:
    print("garage …")
    # main building body
    body = trimesh.creation.box([2.0, 1.4, 0.8])
    body.apply_translation([0, 0, 0.4])
    _colored(body, (210, 205, 190, 255))  # sand-white

    # ridge roof (triangular prism approximated as a thin tilted box)
    roof_l = trimesh.creation.box([2.04, 0.76, 0.08])
    roof_l.apply_transform(tf.rotation_matrix(np.radians(25), [1, 0, 0], point=[0, -0.35, 0.80]))
    _colored(roof_l, (170, 165, 155, 255))

    roof_r = trimesh.creation.box([2.04, 0.76, 0.08])
    roof_r.apply_transform(tf.rotation_matrix(np.radians(-25), [1, 0, 0], point=[0, 0.35, 0.80]))
    _colored(roof_r, (170, 165, 155, 255))

    # door (dark rectangle on front face)
    door = trimesh.creation.box([0.7, 0.04, 0.65])
    door.apply_translation([0, -0.72, 0.35])
    _colored(door, (90, 85, 80, 255))

    scene = trimesh.Scene([body, roof_l, roof_r, door])
    _export(scene, "garage.glb")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print(f"Writing models to {OUT}")
    make_habitat()
    make_solar_array()
    make_isru()
    make_greenhouse()
    make_garage()
    print("Done.")
