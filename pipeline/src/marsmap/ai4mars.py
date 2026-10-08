"""AI4Mars human terrain labels for the Navcam frames Street View shows.

Crowdsourced labels (soil, bedrock, sand, big rock), merged where at least 3 people labelled a
pixel and 2/3 agreed. No model: these are people's labels, drawn over the photos they labelled.
Only the label PNGs are read out of the 16 GB archive, by HTTP range requests.
"""

import base64
import io
import json
import re
import urllib.request
import warnings
import zipfile
from pathlib import Path
from typing import Any, BinaryIO

import numpy as np
from numpy.typing import NDArray
from rasterio.errors import NotGeoreferencedWarning
from rasterio.io import MemoryFile

AI4MARS_URL = "https://zenodo.org/api/records/15995036/files/ai4mars-dataset-merged-0.6.zip/content"
SOURCE = (
    "AI4Mars merged dataset v0.6 (Swan et al. 2021, CVPR Workshops; Zenodo "
    "doi:10.5281/zenodo.15995036): crowdsourced NAV labels, at least 3 labellers with 2/3 "
    "agreement per pixel; ground beyond 30 m and the rover are not labelled"
)
LICENSE = "CC BY 4.0"
CLASSES = ["soil", "bedrock", "sand", "big rock"]
NONE = len(CLASSES)  # "no label" (255 in the dataset)
LABEL_WIDTH_PX = 128  # crowd polygons are coarse; 128 px keeps every labelled patch
# Label folders inside the archive, per Street View rover.
FOLDERS = {
    "msl": "ai4mars-dataset-merged-0.6/msl/ncam/labels/train/",
    "m20": "ai4mars-dataset-merged-0.6/m2020/labels/NAV/",
}
MSL_ID = re.compile(r"^(N[LR][AB]_(\d{9})EDR_\w+?)(?:_merged)?\.png$")
M20_ID = re.compile(r"^N([LR])[A-Z]_(\d{4})_(\d{10})_(\d{3})")
MSL_GROUP_SCLK = 100_000  # ~1.1 sols of spacecraft clock per group file


def label_key(rover: str, name: str) -> str | None:
    """The key a frame and its label share. Perseverance labels are on full-frame products,
    while the raw API serves tiles of the same exposure: match on eye and exposure clock."""
    if rover == "msl":
        # Labels are on version-1 products (...M1); the raw API serves ...M_ of the same shot.
        m = MSL_ID.match(name)
        return m.group(1)[:-1] if m else None
    m = M20_ID.match(name)
    return f"N{m.group(1)}_{m.group(3)}_{m.group(4)}" if m else None


def group_of(rover: str, image_id: str) -> str | None:
    """Which group file holds an image's label: the sol (Perseverance) or a clock bucket."""
    if rover == "msl":
        m = re.match(r"^N[LR][AB]_(\d{9})", image_id)
        return str(int(m.group(1)) // MSL_GROUP_SCLK) if m else None
    m = M20_ID.match(image_id)
    return str(int(m.group(2))) if m else None


def shrink(labels: NDArray[np.uint8], width: int = LABEL_WIDTH_PX) -> NDArray[np.uint8]:
    """Nearest-neighbour resize to `width` keeping aspect; values outside 0..3 become NONE."""
    h, w = labels.shape
    height = max(1, round(width * h / w))
    rows = (np.arange(height) + 0.5) * h / height
    cols = (np.arange(width) + 0.5) * w / width
    out = labels[rows.astype(int)[:, None], cols.astype(int)[None, :]]
    result: NDArray[np.uint8] = np.where(out < NONE, out, NONE).astype(np.uint8)
    return result


def encode_rle(cls: NDArray[np.uint8]) -> bytes:
    """(value, run) byte pairs, runs of at most 255."""
    out = bytearray()
    flat = cls.ravel()
    i = 0
    while i < flat.size:
        v = flat[i]
        run = 1
        while i + run < flat.size and run < 255 and flat[i + run] == v:
            run += 1
        out += bytes((int(v), run))
        i += run
    return bytes(out)


def decode_rle(data: bytes, cells: int) -> NDArray[np.uint8]:
    values = np.frombuffer(data, dtype=np.uint8)
    out = np.repeat(values[0::2], values[1::2])
    if out.size != cells:
        raise ValueError(f"RLE holds {out.size} cells, expected {cells}")
    return out


class HttpRangeFile(io.RawIOBase):
    """A seekable read-only view of a remote file through HTTP range requests."""

    def __init__(self, url: str) -> None:
        self.url, self.pos = url, 0
        with urllib.request.urlopen(urllib.request.Request(url, method="HEAD"), timeout=60) as r:
            self.size = int(r.headers["Content-Length"])

    def seekable(self) -> bool:
        return True

    def readable(self) -> bool:
        return True

    def tell(self) -> int:
        return self.pos

    def seek(self, offset: int, whence: int = 0) -> int:
        self.pos = {0: offset, 1: self.pos + offset, 2: self.size + offset}[whence]
        return self.pos

    def readinto(self, buffer: Any) -> int:
        n = min(len(buffer), self.size - self.pos)
        if n <= 0:
            return 0
        headers = {"Range": f"bytes={self.pos}-{self.pos + n - 1}"}
        with urllib.request.urlopen(
            urllib.request.Request(self.url, headers=headers), timeout=120
        ) as r:
            data = r.read()
        buffer[: len(data)] = data
        self.pos += len(data)
        return len(data)


def _open(source: str) -> BinaryIO:
    if source.startswith("https://"):
        # A 1 MB buffer turns the many small label reads into a few large range requests.
        return io.BufferedReader(HttpRangeFile(source), buffer_size=1 << 20)
    return open(source, "rb")


def _decode_png(data: bytes) -> NDArray[np.uint8]:
    with (
        warnings.catch_warnings(category=NotGeoreferencedWarning, action="ignore"),
        MemoryFile(data) as mem,
        mem.open() as src,
    ):
        band: NDArray[np.uint8] = src.read(1).astype(np.uint8)
        return band


def build_labels(source: str, out_dir: Path) -> dict[str, Any]:
    """Write <rover>/<group>.json ({key: {w, h, rle(base64)}}) and index.json."""
    groups: dict[str, dict[str, dict[str, dict[str, Any]]]] = {"m20": {}, "msl": {}}
    with _open(source) as f, zipfile.ZipFile(f) as z:
        members = sorted(z.infolist(), key=lambda i: i.header_offset)  # read in file order
        for info in members:
            rover = next((r for r, d in FOLDERS.items() if info.filename.startswith(d)), None)
            name = info.filename.rsplit("/", 1)[-1]
            key = rover and label_key(rover, name)
            group = rover and key and group_of(rover, name)
            if not (rover and key and group):
                continue
            cls = shrink(_decode_png(z.read(info)))
            groups[rover].setdefault(group, {})[key] = {
                "w": int(cls.shape[1]),
                "h": int(cls.shape[0]),
                "rle": base64.b64encode(encode_rle(cls)).decode("ascii"),
            }
    for rover, by_group in groups.items():
        (out_dir / rover).mkdir(parents=True, exist_ok=True)
        for group, labels in by_group.items():
            (out_dir / rover / f"{group}.json").write_text(
                json.dumps(labels, separators=(",", ":"))
            )
    index: dict[str, Any] = {
        "source": SOURCE,
        "license": LICENSE,
        "classes": CLASSES,
        "groups": {r: sorted(g, key=int) for r, g in groups.items()},
        "counts": {r: sum(len(v) for v in g.values()) for r, g in groups.items()},
    }
    (out_dir / "index.json").write_text(json.dumps(index))
    return index
