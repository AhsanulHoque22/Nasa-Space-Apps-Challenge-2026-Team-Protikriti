"""Rover Street View stops: every localized rover waypoint (NASA/JPL MMGIS) with its site/drive."""

from typing import Any

COORD_DECIMALS = 6  # ~6 cm on Mars


def waypoint_stops(raw: dict[str, Any]) -> list[dict[str, Any]]:
    """MMGIS waypoint GeoJSON -> [{site, drive, sol, lon, lat, elevM, yawDeg}] sorted by time."""
    stops: list[dict[str, Any]] = []
    for feature in raw["features"]:
        p = feature["properties"]
        if p.get("site") is None or p.get("drive") is None:
            continue  # cannot be matched to raw images without site/drive
        yaw = p.get("yaw")
        stops.append(
            {
                "site": int(p["site"]),
                "drive": int(p["drive"]),
                "sol": int(p["sol"]),
                "lon": round(float(p["lon"]), COORD_DECIMALS),
                "lat": round(float(p["lat"]), COORD_DECIMALS),
                "elevM": round(float(p["elev_geoid"]), 1)
                if p.get("elev_geoid") is not None
                else None,
                "yawDeg": round(float(yaw), 1) if yaw is not None else None,
            }
        )
    return sorted(stops, key=lambda s: (s["sol"], s["site"], s["drive"]))
