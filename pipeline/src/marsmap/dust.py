"""Site dust climatology from the Montabone et al. column dust optical depth scenarios."""

import json
import re
from pathlib import Path
from typing import Any

import numpy as np
import rasterio
from numpy.typing import NDArray

from marsmap.mars24 import mars_year_start_ms, solar_longitude_deg

SOL_MS = 88_775_244.0
# Kriged daily maps: 3 deg cells, lon -181.5..178.5 west edge first, lat 90 at the top row.
GRID_WEST = -181.5
GRID_NORTH = 90.0
GRID_STEP = 3.0
NODATA_ABOVE = 1e30  # the files use 9.97e36 for missing values
LS_BIN_DEG = 10
VARIABLE = "cdod610"
SOURCE = (
    "Montabone et al. dust scenarios MY24-36, kriged daily maps v2 (LMD): "
    "Icarus 251, 65-95 (2015), doi:10.1016/j.icarus.2014.12.034; "
    "MY34 onward: JGR Planets (2020), doi:10.1029/2019JE006111"
)
LICENSE = "CC BY-SA 3.0 (Creative Commons Attribution-ShareAlike 3.0 Unported); derived values"
QUANTITY = "Column dust optical depth, 9.3 um absorption, normalised to 610 Pa"
VISIBLE_FACTOR = 2.6  # the dataset's stated factor to an equivalent visible optical depth


def cell_of(lon: float, lat: float) -> tuple[int, int]:
    """(row, col) of the 3 deg cell holding (lon, lat); longitudes wrap at the dateline."""
    lon = (lon - GRID_WEST) % 360 + GRID_WEST
    return int((GRID_NORTH - lat) // GRID_STEP), int((lon - GRID_WEST) // GRID_STEP)


def bin_by_ls(
    values: NDArray[np.floating[Any]], ls_deg: NDArray[np.floating[Any]], bin_deg: int
) -> list[float | None]:
    """Mean of the finite values in each Ls bin of `bin_deg`; None where a bin has none."""
    out: list[float | None] = []
    for start in range(0, 360, bin_deg):
        in_bin = (ls_deg >= start) & (ls_deg < start + bin_deg) & np.isfinite(values)
        out.append(round(float(values[in_bin].mean()), 4) if in_bin.any() else None)
    return out


def read_site_series(path: Path, lon: float, lat: float) -> NDArray[np.float64]:
    """The variable's value at the site's cell for every daily map in the file (NaN = missing)."""
    row, col = cell_of(lon, lat)
    with rasterio.open(f'netcdf:"{path}":{VARIABLE}') as src:
        values = np.array(
            [src.read(b, window=((row, row + 1), (col, col + 1)))[0, 0] for b in src.indexes],
            dtype=np.float64,
        )
    values[~(values < NODATA_ABOVE)] = np.nan
    return values


def build_dust(raw_dir: Path, sites: list[dict[str, Any]], out_path: Path) -> dict[str, Any]:
    files = sorted(raw_dir.glob("dustscenario_MY*_v*.nc"))
    if not files:
        raise FileNotFoundError(f"no dustscenario_MY*.nc files in {raw_dir}")
    result: dict[str, Any] = {
        "source": SOURCE,
        "license": LICENSE,
        "quantity": QUANTITY,
        "visibleFactor": VISIBLE_FACTOR,
        "binDeg": LS_BIN_DEG,
        "sites": {},
    }
    for site in sites:
        west, south, east, north = site["bounds"]
        lon, lat = (west + east) / 2, (south + north) / 2
        row, col = cell_of(lon, lat)
        years: dict[str, list[float | None]] = {}
        for f in files:
            match = re.search(r"MY(\d+)", f.name)
            if not match:
                continue
            year = int(match.group(1))
            series = read_site_series(f, lon, lat)
            start = mars_year_start_ms(year)
            # Time is the fractional sol since the start of the year; map i is at sol i + 0.5.
            ls = np.array(
                [solar_longitude_deg(start + (i + 0.5) * SOL_MS) for i in range(series.size)],
                dtype=np.float64,
            )
            years[str(year)] = bin_by_ls(series, ls, LS_BIN_DEG)
        result["sites"][site["id"]] = {
            "cellLon": GRID_WEST + (col + 0.5) * GRID_STEP,
            "cellLat": GRID_NORTH - (row + 0.5) * GRID_STEP,
            "years": years,
        }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(result, separators=(",", ":")))
    return result
