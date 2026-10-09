"""Enhancement must sharpen real detail, leave flat ground and no-data alone, and add no noise."""

import cv2
import numpy as np

from marsmap.enhance import NODATA, enhance_orthomosaic


def _sharpness(a: np.ndarray) -> float:
    return float(cv2.Laplacian(a, cv2.CV_64F).var())


def _soft_edges() -> np.ndarray:
    img = np.full((512, 512), 90, dtype=np.uint8)
    img[:, 256:] = 170
    img[100:160, 60:120] = 30  # a dark rock
    return cv2.GaussianBlur(img, (0, 0), 2.0)  # softened, as after resampling


def test_sharpens_soft_detail() -> None:
    img = _soft_edges()
    assert _sharpness(enhance_orthomosaic(img)) > 1.5 * _sharpness(img)


def test_flat_ground_stays_flat_and_noise_is_not_amplified() -> None:
    rng = np.random.default_rng(0)
    noisy = np.clip(rng.normal(100, 4, (512, 512)), 1, 255).astype(np.uint8)
    out = enhance_orthomosaic(noisy)
    assert out.std() <= noisy.std() * 1.1
    assert abs(float(out.mean()) - float(noisy.mean())) < 5


def test_nodata_stays_nodata_and_valid_pixels_never_become_nodata() -> None:
    img = _soft_edges()
    img[:, :40] = NODATA
    img[200:210, 300:310] = 1  # darkest valid pixel
    out = enhance_orthomosaic(img)
    assert (out[:, :40] == NODATA).all()
    assert (out[:, 40:] > NODATA).all()


def test_all_nodata_is_returned_unchanged() -> None:
    img = np.zeros((64, 64), dtype=np.uint8)
    assert np.array_equal(enhance_orthomosaic(img), img)
