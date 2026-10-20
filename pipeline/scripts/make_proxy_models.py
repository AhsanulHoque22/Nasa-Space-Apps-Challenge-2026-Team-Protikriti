#!/usr/bin/env python3
"""Generate proxy GLB models for colony module placement.

Creates simple geometric shapes for each colony module type:
  habitat      → tall cylinder (radius=4m, height=8m)
  solar-array  → flat box (16m × 8m × 0.3m)
  isru         → cube (3m × 3m × 3m)
  greenhouse   → wider cylinder (radius=6m, height=3m)
  garage       → box (12m × 6m × 4m)

Run from repo root: uv run python pipeline/scripts/make_proxy_models.py
"""

import sys
from pathlib import Path

try:
    import trimesh
    import numpy as np
except ImportError as e:
    sys.exit(f"Missing dependency: {e}. Run: uv add trimesh")

OUT_DIR = Path(__file__).parent.parent.parent / "web" / "public" / "models"


def _export(mesh: "trimesh.Trimesh", name: str) -> None:
    out = OUT_DIR / f"{name}.glb"
    mesh.export(str(out))
    size_kb = out.stat().st_size // 1024
    print(f"  {name}.glb  {size_kb} KB")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Writing proxy GLBs to {OUT_DIR}")

    # habitat: cylinder (white-grey)
    hab = trimesh.creation.cylinder(radius=4.0, height=8.0, sections=16)
    hab.apply_translation([0, 0, 4.0])  # place base at z=0
    hab.visual.face_colors = [200, 200, 210, 255]
    _export(hab, "habitat")

    # solar-array: flat box (gold/yellow)
    solar = trimesh.creation.box(extents=[16.0, 8.0, 0.3])
    solar.apply_translation([0, 0, 0.15])
    solar.visual.face_colors = [220, 180, 40, 255]
    _export(solar, "solar-array")

    # isru: cube (orange-red — MOXIE-inspired)
    isru = trimesh.creation.box(extents=[3.0, 3.0, 3.0])
    isru.apply_translation([0, 0, 1.5])
    isru.visual.face_colors = [200, 80, 40, 255]
    _export(isru, "isru")

    # greenhouse: wide short cylinder (green)
    gh = trimesh.creation.cylinder(radius=6.0, height=3.0, sections=20)
    gh.apply_translation([0, 0, 1.5])
    gh.visual.face_colors = [60, 160, 60, 255]
    _export(gh, "greenhouse")

    # garage: box (steel blue)
    garage = trimesh.creation.box(extents=[12.0, 6.0, 4.0])
    garage.apply_translation([0, 0, 2.0])
    garage.visual.face_colors = [80, 100, 130, 255]
    _export(garage, "garage")

    print("Done.")


if __name__ == "__main__":
    main()
