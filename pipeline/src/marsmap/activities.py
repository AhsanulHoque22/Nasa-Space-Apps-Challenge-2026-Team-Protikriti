"""Rover science activities at exact positions: official NASA sample records + MMGIS waypoints."""

import re
from bisect import bisect_right
from typing import Any

# NASA's page mixes "**Key:** value" and "**Key**: value".
_FIELD = re.compile(r"\*\*(?P<key>[^*:]+)(?::\*\*|\*\*:)\s*(?P<value>.+?)\s*$", re.MULTILINE)
_IMAGE = re.compile(r"!\[[^\]]*\]\((?P<url>https://science\.nasa\.gov/[^)\s]+)\)")
_KEYS = {
    "Feature Name": "feature",
    "Sample Type": "sampleType",
    "Date Sealed": "dateSealed",
    "Rock Type": "rockType",
    "Sample Height": "height",
    "Current Location": "location",
}


def parse_samples(markdown: str) -> list[dict[str, Any]]:
    """NASA 'Mars Rock Samples' page (markdown) -> one record per numbered sample."""
    samples: list[dict[str, Any]] = []
    blocks = re.split(r"^## ", markdown, flags=re.MULTILINE)
    for block in blocks:
        number = re.search(r"^Sample No\.\s*(\d+)", block, flags=re.MULTILINE)
        if not number:
            continue
        fields = {m.group("key").strip(): m.group("value").strip() for m in _FIELD.finditer(block)}
        sol_text = fields.get("Sol Sealed", "")
        record: dict[str, Any] = {
            "number": int(number.group(1)),
            "name": block.splitlines()[0].replace("*", "").strip(),
            "sol": int(sol_text) if sol_text.isdigit() else None,  # "TBD" until NASA publishes
        }
        for label, key in _KEYS.items():
            if label in fields:
                record[key] = fields[label]
        image = _IMAGE.search(block)
        if image:
            record["image"] = image.group("url")
        samples.append(record)
    return samples


def resolve_positions(
    activities: list[dict[str, Any]], waypoints: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """Place each activity at the rover's latest localized waypoint on or before its sol."""
    ordered = sorted(waypoints, key=lambda w: w["sol"])
    sols = [w["sol"] for w in ordered]
    placed = []
    for activity in activities:
        if activity.get("sol") is None:
            placed.append({**activity, "positionBasis": "sol not yet published"})
            continue
        i = max(bisect_right(sols, activity["sol"]) - 1, 0)
        w = ordered[i]
        placed.append(
            {
                **activity,
                "lon": w["lon"],
                "lat": w["lat"],
                "positionBasis": f"rover waypoint at sol {w['sol']}",
            }
        )
    return placed
