"""Mars Global Cave Candidate Catalog (MGC3) -> compact caves.json for the web map."""

import csv
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

SOURCE = (
    "Mars Global Cave Candidate Catalog v1 (MGC3), G. E. Cushing, USGS Astrogeology, 2017; "
    "PDS bundle mars_mro.odyssey_multi_cavecatalog_cushing_2016, doi:10.17189/1519222"
)
URL = "https://astrogeology.usgs.gov/search/map/mars_global_cave_candidate_catalog_v1_cushing"
LICENSE = "Public domain (USGS)"

# Type codes, from the archive description (section C-4).
TYPES = {
    "APC": "Atypical pit crater",
    "crk": "Deep, dark crack or fracture",
    "end": "At the end of a channel, fracture or trough",
    "flr": "In the floor of a channel, fracture or trough",
    "irr": "Irregular shape",
    "kst": "In karst-like (periglacial or thermokarst) terrain",
    "lat": "Lateral entrance, often in a cliff wall",
    "pin": "Pinhole: a sharp hole a few pixels across",
    "pit": "Small, non-circular collapse pit",
    "pol": "In polar ice",
    "rim": "On the rim of a pit, channel or trough",
    "sky": "Skylight into a lava tube",
    "srp": "Small, shallow, rimless collapse pit",
}
COLUMNS = 8  # ID, longitude, latitude, type, priority, APC diameter, APC depth, comment


@dataclass(frozen=True)
class Cave:
    id: str
    lon: float  # east, -180..180
    lat: float
    type_code: str
    priority: int  # 1 highest targeting priority .. 3 lowest; 0 = already imaged by HiRISE
    apc_diameter_m: str | None
    apc_depth_m: str | None
    comment: str


def _size(text: str) -> str | None:
    """APC sizes are text in metres (some are "135x195"), as the PDS label types them."""
    return None if text.strip() in ("", "n/a") else text.strip()


def _parse(row: list[str], line: int) -> Cave:
    if len(row) != COLUMNS:
        raise ValueError(f"line {line}: expected {COLUMNS} columns, got {len(row)}")
    cave_id, lon_text, lat_text, type_code, priority_text, diameter, depth, comment = row
    try:
        lon, lat, priority = float(lon_text), float(lat_text), int(priority_text)
    except ValueError as error:
        raise ValueError(f"line {line}: {error}") from error
    if not 0 <= lon <= 360:
        raise ValueError(f"line {line}: longitude {lon} outside 0..360 east")
    if not -90 <= lat <= 90:
        raise ValueError(f"line {line}: latitude {lat} outside -90..90")
    if priority not in (0, 1, 2, 3):
        raise ValueError(f"line {line}: priority {priority} is not 0, 1, 2 or 3")
    return Cave(
        id=cave_id.strip(),
        lon=lon - 360 if lon > 180 else lon,
        lat=lat,
        type_code=type_code.strip(),
        priority=priority,
        apc_diameter_m=_size(diameter),
        apc_depth_m=_size(depth),
        comment=comment.strip(),
    )


def load_caves(path: Path) -> list[Cave]:
    """Rows by position: the CSV header mislabels the first three columns (see the PDS label)."""
    with path.open(encoding="latin-1", newline="") as f:
        rows = list(csv.reader(f))
    return [_parse(row, i + 1) for i, row in enumerate(rows) if i > 0 and row]


def build_caves(csv_path: Path, out: Path) -> int:
    caves = load_caves(csv_path)
    doc: dict[str, Any] = {
        "source": SOURCE,
        "url": URL,
        "license": LICENSE,
        "types": TYPES,
        "fields": ["id", "lon", "lat", "type", "priority", "apcDiameterM", "apcDepthM", "comment"],
        "caves": [
            [
                c.id,
                round(c.lon, 5),
                round(c.lat, 5),
                c.type_code,
                c.priority,
                c.apc_diameter_m,
                c.apc_depth_m,
                c.comment,
            ]
            for c in caves
        ],
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(doc, separators=(",", ":")))
    return len(caves)
