import pytest

from marsmap.layers import (
    landing_features,
    parse_nomenclature,
    resolve_zones,
    simplify_line,
    traverse_feature,
)

KML = """<?xml version="1.0" encoding="utf-8" ?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><Folder>
  <Placemark><name>Jezero</name><ExtendedData><SchemaData>
    <SimpleData name="clean_name">Jezero</SimpleData>
    <SimpleData name="diameter">45.43</SimpleData>
    <SimpleData name="type">Crater, craters</SimpleData>
    <SimpleData name="link">http://planetarynames.wr.usgs.gov/Feature/2885</SimpleData>
  </SchemaData></ExtendedData><Point><coordinates>77.58,18.38</coordinates></Point></Placemark>
  <Placemark><name>Blunck</name><ExtendedData><SchemaData>
    <SimpleData name="clean_name">Blunck</SimpleData>
    <SimpleData name="type">Crater, craters</SimpleData>
  </SchemaData></ExtendedData><Point><coordinates>-36.897,-27.2282</coordinates></Point></Placemark>
</Folder></Document></kml>"""


def test_parse_nomenclature_builds_point_features() -> None:
    features = parse_nomenclature(KML)
    assert len(features) == 2
    jezero = features[0]
    assert jezero["geometry"] == {"type": "Point", "coordinates": [77.58, 18.38]}
    assert jezero["properties"] == {
        "name": "Jezero",
        "type": "Crater",
        "diameter_km": 45.43,
        "link": "https://planetarynames.wr.usgs.gov/Feature/2885",
    }


def test_parse_nomenclature_tolerates_missing_diameter_and_west_longitudes() -> None:
    blunck = parse_nomenclature(KML)[1]
    assert blunck["properties"]["diameter_km"] == 0.0
    assert blunck["geometry"]["coordinates"] == [-36.897, -27.2282]


def test_simplify_line_drops_collinear_points_keeps_ends() -> None:
    line = [(0.0, 0.0), (1.0, 0.0), (2.0, 0.0), (3.0, 0.0)]
    assert simplify_line(line, 0.01) == [(0.0, 0.0), (3.0, 0.0)]


def test_simplify_line_keeps_corners() -> None:
    line = [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0)]
    assert simplify_line(line, 0.01) == line


def test_traverse_feature_merges_line_and_multiline_schemas_and_drops_z() -> None:
    raw = {
        "features": [
            {"geometry": {"type": "LineString", "coordinates": [[1, 2, -2500], [1.5, 2, -2500]]}},
            {"geometry": {"type": "MultiLineString", "coordinates": [[[3, 4, 0], [3, 5, 0]]]}},
        ]
    }
    feature = traverse_feature(raw, "Test rover", tolerance_deg=1e-6)
    assert feature["geometry"]["type"] == "MultiLineString"
    assert feature["geometry"]["coordinates"] == [[[1, 2], [1.5, 2]], [[3, 4], [3, 5]]]
    assert feature["properties"] == {"rover": "Test rover"}


def test_resolve_zones_places_zone_on_named_feature_and_reports_missing() -> None:
    names = parse_nomenclature(KML)
    zones = [
        {"name": "Jezero-Syrtis-Isidis", "anchor": "Jezero", "abstracts": [1034]},
        {"name": "Nowhere", "anchor": "Atlantis", "abstracts": [9999]},
    ]
    features, missing = resolve_zones(zones, names)
    assert missing == ["Atlantis"]
    assert len(features) == 1
    assert features[0]["geometry"]["coordinates"] == [77.58, 18.38]
    assert features[0]["properties"]["abstracts"] == [1034]
    assert features[0]["properties"]["location_basis"] == "IAU feature: Jezero"


def test_resolve_zones_honours_explicit_coordinates_from_the_abstract() -> None:
    zones = [{"name": "E Hellas rim", "lon": 104.0, "lat": -40.0, "abstracts": [1038]}]
    features, missing = resolve_zones(zones, [])
    assert missing == []
    assert features[0]["geometry"]["coordinates"] == [104.0, -40.0]
    assert features[0]["properties"]["location_basis"] == "coordinates stated in abstract"


@pytest.mark.parametrize("bad", [{"name": "x"}, {"name": "x", "lon": 1.0}])
def test_resolve_zones_rejects_zone_without_anchor_or_coordinates(bad: dict[str, object]) -> None:
    with pytest.raises(ValueError, match="anchor"):
        resolve_zones([bad], [])


def test_resolve_zones_keeps_an_explicit_location_basis() -> None:
    zones = [{"name": "Chryse", "lon": -48.2, "lat": 22.7, "location_basis": "VL-1 site"}]
    features, _ = resolve_zones(zones, [])
    assert features[0]["properties"]["location_basis"] == "VL-1 site"


def test_landing_features_validates_ranges() -> None:
    sites = [{"mission": "Spirit", "status": "landed", "lon": 175.4785, "lat": -14.5718}]
    feature = landing_features(sites)[0]
    assert feature["geometry"]["coordinates"] == [175.4785, -14.5718]
    assert feature["properties"] == {"mission": "Spirit", "status": "landed"}
    with pytest.raises(ValueError, match="Bad"):
        landing_features([{"mission": "Bad", "lon": 200.0, "lat": 0.0}])
