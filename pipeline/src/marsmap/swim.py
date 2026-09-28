"""Subsurface Water Ice Mapping (SWIM 2.0): combined 0-1 m ice consistency, for site reports."""

import json
from pathlib import Path

import numpy as np
from numpy.typing import NDArray

SWIM_URL = "https://swim.psi.edu/output/SWIM2/Global/Composite/SWIM2_c0_1.tif"
SOURCE = "SWIM 2.0 combined ice consistency, 0-1 m depth (Morgan et al. 2021; swim.psi.edu)"
NODATA_OUT = -128  # int8 sentinel; consistency itself spans -1..+1 -> -100..+100


def swim_to_web(values: NDArray[np.float32], source_nodata: float) -> NDArray[np.int8]:
    """Consistency -1..+1 -> int8 hundredths; nodata/NaN -> NODATA_OUT."""
    valid = np.isfinite(values) & (values != source_nodata)
    scaled = np.clip(np.round(np.where(valid, values, 0) * 100), -100, 100)
    return np.where(valid, scaled, NODATA_OUT).astype(np.int8)


def write_swim(grid: NDArray[np.int8], out_dir: Path, north: float, south: float) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    grid.astype(np.int8).tofile(out_dir / "swim.bin")
    height, width = grid.shape
    meta = {
        "width": width,
        "height": height,
        "west": -180.0,
        "east": 180.0,
        "north": north,
        "south": south,
        "scale": 0.01,
        "nodata": NODATA_OUT,
        "source": SOURCE,
    }
    (out_dir / "swim.json").write_text(json.dumps(meta))
