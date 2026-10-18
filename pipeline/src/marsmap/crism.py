"""CRISM mineralogy for Jezero crater: chemical hazard weights per pixel.

Source: Salvatore et al. 2021, Zenodo DOI 10.5281/zenodo.5575824 (CC BY 4.0).
`jezeroFinal.tif` is a classified uint8 raster; each integer code is one mineral unit.
We map codes to a 0–1 hazard weight: higher = more hazardous for EVA crew contact.

Hazard rationale (team planning assumption, not a mission standard):
  - Perchlorates / chlorides are toxic and reactive with organics.
  - Carbonates and Fe/Mg smectites are chemically benign but signal past water.
  - Basaltic / mafic units are structurally stable and chemically low-risk.
  - Unknown codes fall back to a neutral weight.

Verify the code-to-unit mapping against the dataset's colour table once
`jezeroFinal.tif` is downloaded; `rasterio.open(tif).colormap(1)` lists it.
"""

import json
import logging
from pathlib import Path
from typing import Any

import numpy as np
from numpy.typing import NDArray
from rasterio.warp import transform_bounds
from rasterio.windows import Window, from_bounds

from marsmap.dem import MARS_LONLAT

SOURCE = (
    "CRISM Jezero mineralogy map, Salvatore et al. 2021, "
    "Zenodo DOI 10.5281/zenodo.5575824 (CC BY 4.0)"
)

# Pixel value used by the dataset's nodata / unclassified category.
# Verify against the actual tif: `rasterio.open(tif).nodata` or `colormap(1)`.
NODATA_CODE: int = 0

# Hazard weights per mineral class code [0, 1]; higher = more hazardous.
# 0.3 = neutral/unknown, used as the fallback for any unlisted code.
HAZARD_WEIGHTS: dict[int, float] = {
    1: 0.1,  # basalt / dust-covered basalt — low chemical risk
    2: 0.5,  # Fe/Mg smectite (clay) — past water, moderate concern
    3: 0.4,  # Mg-carbonate — low chemical risk, mineralogically interesting
    4: 0.6,  # Al-smectite — moderate
    5: 0.8,  # sulfate — elevated risk (acidic alteration products)
    6: 1.0,  # chloride / perchlorate-bearing — highest risk (toxic, reactive)
    7: 0.5,  # olivine — moderate (weathering products may be reactive)
    8: 0.4,  # mafic / pyroxene — low to moderate
    9: 0.2,  # dust-covered terrain — low direct contact risk
}

_NEUTRAL = 0.3  # fallback for any code not in HAZARD_WEIGHTS


def classify_crism(codes: NDArray[np.uint8]) -> NDArray[np.float32]:
    """Map integer mineral-class codes to [0, 1] hazard weights.

    NODATA_CODE becomes NaN; all other codes get a weight from HAZARD_WEIGHTS
    or the neutral fallback.
    """
    out = np.full(codes.shape, _NEUTRAL, dtype=np.float32)
    for code, weight in HAZARD_WEIGHTS.items():
        out[codes == code] = weight
    out[codes == NODATA_CODE] = np.nan
    return out


def _read_window(
    tif_path: Path, bounds: tuple[float, float, float, float]
) -> tuple[NDArray[np.float32], tuple[float, float, float, float]]:
    """Read and classify a lon/lat bounding box from the CRISM tif.

    Returns the classified float32 array and the actual pixel bounds in lon/lat.
    Raises ValueError when the requested bounds fall outside the file.
    """
    import rasterio
    import rasterio.env

    with (
        rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR"),
        rasterio.open(tif_path) as src,
    ):
        projected = transform_bounds(MARS_LONLAT, src.crs, *bounds)
        window = from_bounds(*projected, transform=src.transform)
        window = window.round_offsets().round_lengths()
        full = Window(0, 0, src.width, src.height)
        if (
            window.col_off < 0
            or window.row_off < 0
            or window.col_off + window.width > full.width
            or window.row_off + window.height > full.height
            or window.width <= 0
            or window.height <= 0
        ):
            raise ValueError(f"bounds {bounds} are outside {tif_path}")
        raw = src.read(1, window=window, masked=True)
        codes = raw.filled(NODATA_CODE).astype(np.uint8)
        w_m, s_m, e_m, n_m = rasterio.windows.bounds(window, src.transform)
        lonlat = transform_bounds(src.crs, MARS_LONLAT, w_m, s_m, e_m, n_m)
    return classify_crism(codes), (lonlat[0], lonlat[1], lonlat[2], lonlat[3])


def export_crism_grid(
    site_id: str,
    site_bounds: tuple[float, float, float, float],
    tif_path: Path,
    out_dir: Path,
) -> dict[str, Any] | None:
    """Write crism.bin + crism.json for one site.

    Returns the metadata dict on success, or None when the tif is absent
    (skips gracefully so the pipeline can run without the raw file).
    """
    if not tif_path.exists():
        logging.warning("CRISM tif not found, skipping %s: %s", site_id, tif_path)
        print(f"warning: CRISM tif not found for {site_id}: {tif_path}")
        return None

    data, (w, s, e, n) = _read_window(tif_path, site_bounds)
    out_dir.mkdir(parents=True, exist_ok=True)
    data.astype("<f4").tofile(out_dir / "crism.bin")
    finite = data[np.isfinite(data)]
    meta: dict[str, Any] = {
        "width": int(data.shape[1]),
        "height": int(data.shape[0]),
        "west": w,
        "south": s,
        "east": e,
        "north": n,
        "source": SOURCE,
        "p02": float(np.percentile(finite, 2)) if finite.size else None,
        "p98": float(np.percentile(finite, 98)) if finite.size else None,
    }
    (out_dir / "crism.json").write_text(json.dumps(meta, indent=1))
    return meta
