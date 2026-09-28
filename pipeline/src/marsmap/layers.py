"""Vector map layers: IAU names, rover traverses, exploration zones (GeoJSON, lon east +-180)."""

import math
import xml.etree.ElementTree as ET
from collections.abc import Sequence
from typing import Any

Feature = dict[str, Any]
Point2 = tuple[float, float]

_KML = {"k": "http://www.opengis.net/kml/2.2"}


def parse_nomenclature(kml: str) -> list[Feature]:
    """USGS Gazetteer of Planetary Nomenclature KML -> point features (one per named feature)."""
    features: list[Feature] = []
    for placemark in ET.fromstring(kml).iterfind(".//k:Placemark", _KML):
        data = {d.get("name"): d.text or "" for d in placemark.iterfind(".//k:SimpleData", _KML)}
        coords = placemark.findtext(".//k:Point/k:coordinates", default="", namespaces=_KML)
        lon, lat = (float(v) for v in coords.strip().split(",")[:2])
        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
                "properties": {
                    "name": data.get("clean_name", ""),
                    # "Crater, craters" -> "Crater"
                    "type": data.get("type", "").split(",")[0],
                    "diameter_km": float(data.get("diameter") or 0.0),
                    "link": data.get("link", "").replace("http://", "https://"),
                },
            }
        )
    return features


def simplify_line(line: Sequence[Point2], tolerance: float) -> list[Point2]:
    """Douglas-Peucker: drop points closer than `tolerance` to the simplified line."""
    if len(line) < 3:
        return list(line)
    (x0, y0), (x1, y1) = line[0], line[-1]
    length = math.hypot(x1 - x0, y1 - y0)
    far_index, far_distance = 0, -1.0
    for i in range(1, len(line) - 1):
        x, y = line[i]
        if length == 0:
            distance = math.hypot(x - x0, y - y0)
        else:
            distance = abs((x1 - x0) * (y0 - y) - (x0 - x) * (y1 - y0)) / length
        if distance > far_distance:
            far_index, far_distance = i, distance
    if far_distance <= tolerance:
        return [line[0], line[-1]]
    head = simplify_line(line[: far_index + 1], tolerance)
    return head[:-1] + simplify_line(line[far_index:], tolerance)


def traverse_feature(raw: dict[str, Any], rover: str, tolerance_deg: float) -> Feature:
    """NASA MMGIS traverse GeoJSON (LineString or MultiLineString parts) -> one MultiLineString."""
    lines: list[list[list[float]]] = []
    for feature in raw["features"]:
        geometry = feature["geometry"]
        parts = geometry["coordinates"]
        for part in [parts] if geometry["type"] == "LineString" else parts:
            flat = [(float(p[0]), float(p[1])) for p in part]
            lines.append([[x, y] for x, y in simplify_line(flat, tolerance_deg)])
    return {
        "type": "Feature",
        "geometry": {"type": "MultiLineString", "coordinates": lines},
        "properties": {"rover": rover},
    }


def resolve_zones(
    zones: Sequence[dict[str, Any]], names: Sequence[Feature]
) -> tuple[list[Feature], list[str]]:
    """Place each exploration zone on stated coordinates or its IAU anchor feature.

    Never guesses: zones whose anchor is not in the gazetteer are returned in `missing`.
    """
    by_name = {f["properties"]["name"]: f["geometry"]["coordinates"] for f in names}
    features: list[Feature] = []
    missing: list[str] = []
    for zone in zones:
        if "lon" in zone and "lat" in zone:
            coords = [zone["lon"], zone["lat"]]
            basis = zone.get("location_basis", "coordinates stated in abstract")
        elif "anchor" in zone:
            if zone["anchor"] not in by_name:
                missing.append(zone["anchor"])
                continue
            coords, basis = list(by_name[zone["anchor"]]), f"IAU feature: {zone['anchor']}"
        else:
            raise ValueError(f"zone {zone.get('name')!r} needs an anchor or lon/lat")
        skip = ("lon", "lat", "anchor", "location_basis")
        properties = {k: v for k, v in zone.items() if k not in skip}
        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": coords},
                "properties": {**properties, "location_basis": basis},
            }
        )
    return features, missing


def landing_features(sites: Sequence[dict[str, Any]]) -> list[Feature]:
    """Curated landing sites -> point features; rejects coordinates outside lon/lat ranges."""
    features: list[Feature] = []
    for site in sites:
        lon, lat = float(site["lon"]), float(site["lat"])
        if not (-180 <= lon <= 180 and -90 <= lat <= 90):
            raise ValueError(f"{site.get('mission')}: lon/lat out of range ({lon}, {lat})")
        properties = {k: v for k, v in site.items() if k not in ("lon", "lat")}
        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
                "properties": properties,
            }
        )
    return features
