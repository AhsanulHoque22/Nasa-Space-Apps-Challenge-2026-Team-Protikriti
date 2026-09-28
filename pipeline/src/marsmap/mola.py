"""Global Mars topography for the web globe: MGS MOLA MEGDR at 4 pixels per degree."""

import json
from pathlib import Path

import numpy as np
from numpy.typing import NDArray

MEGDR_URL = (
    "https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg004/"
    "megt90n000cb.img"
)
SOURCE = "MGS MOLA MEGDR megt90n000cb (4 px/deg), NASA PDS Geosciences Node"


def megdr_to_web(raw: bytes, width: int = 1440, height: int = 720) -> NDArray[np.int16]:
    """PDS MEGDR (MSB int16, rows north->south, east lon 0..360) -> native int16, lon -180..180."""
    grid = np.frombuffer(raw, dtype=">i2").reshape(height, width).astype(np.int16)
    return np.roll(grid, -width // 2, axis=1)


def write_mola(grid: NDArray[np.int16], out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    grid.astype("<i2").tofile(out_dir / "mola.bin")
    height, width = grid.shape
    meta = {
        "width": width,
        "height": height,
        "west": -180.0,
        "north": 90.0,
        "east": 180.0,
        "south": -90.0,
        "units": "m above MOLA areoid",
        "source": SOURCE,
    }
    (out_dir / "mola.json").write_text(json.dumps(meta))
