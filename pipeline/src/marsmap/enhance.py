"""Display enhancement for HiRISE orthomosaic tiles, with classical OpenCV filters only.

It makes the detail the camera captured easier to read: light denoising, an unsharp mask to undo
the softening of resampling, and a gentle local-contrast lift. It cannot add detail the camera
did not capture, and it uses no learned model: nothing here invents terrain. Brightness is no
longer radiometric afterwards, so the tiles are for looking at, never for measuring.
"""

from __future__ import annotations

import cv2
import numpy as np
from numpy.typing import NDArray

NODATA = 0  # orthomosaic value for "no image here"; enhanced pixels never fall to it
DENOISE_STRENGTH = 3.0  # grey levels: removes JPEG and stretch noise, keeps rocks and ridges
DENOISE_TEMPLATE_PX = 5
DENOISE_SEARCH_PX = 15
SHARPEN_SIGMA_PX = 1.2  # about the blur that averaging 25 cm pixels down adds
SHARPEN_AMOUNT = 0.8  # 1.0 would double the edge contrast
LOCAL_CONTRAST_CLIP = 1.5  # CLAHE clip limit: low, so flat ground stays flat
LOCAL_CONTRAST_CELL_PX = 256  # one adaptive-contrast cell is about one tile
LOCAL_CONTRAST_BLEND = 0.5  # half original, half locally equalised


def enhance_orthomosaic(image: NDArray[np.uint8]) -> NDArray[np.uint8]:
    """Enhanced copy of a grey (rows, cols) mosaic; NODATA pixels stay NODATA."""
    valid = image != NODATA
    if not valid.any():
        return image.copy()
    # No-data is filled with the typical ground level first, so black edges do not bleed inwards.
    work = np.where(valid, image, np.uint8(np.median(image[valid])))
    work = np.asarray(
        cv2.fastNlMeansDenoising(
            work, None, DENOISE_STRENGTH, DENOISE_TEMPLATE_PX, DENOISE_SEARCH_PX
        ),
        dtype=np.uint8,
    )
    blurred = cv2.GaussianBlur(work, (0, 0), SHARPEN_SIGMA_PX)
    sharp = np.asarray(
        cv2.addWeighted(work, 1 + SHARPEN_AMOUNT, blurred, -SHARPEN_AMOUNT, 0), dtype=np.uint8
    )
    grid = (
        max(1, image.shape[1] // LOCAL_CONTRAST_CELL_PX),
        max(1, image.shape[0] // LOCAL_CONTRAST_CELL_PX),
    )
    local = cv2.createCLAHE(clipLimit=LOCAL_CONTRAST_CLIP, tileGridSize=grid).apply(sharp)
    mixed = cv2.addWeighted(sharp, 1 - LOCAL_CONTRAST_BLEND, local, LOCAL_CONTRAST_BLEND, 0)
    return np.where(valid, np.maximum(mixed, NODATA + 1), NODATA).astype(np.uint8)
