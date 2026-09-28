from marsmap.stops import waypoint_stops

RAW = {
    "features": [
        {
            "properties": {
                "RMC": "3_0",
                "site": 3,
                "drive": 0,
                "sol": 13,
                "lon": 77.45088572,
                "lat": 18.44462715,
                "elev_geoid": -2569.91,
                "yaw": 130.8815,
            }
        },
        {
            "properties": {
                "RMC": "3_110",
                "site": 3,
                "drive": 110,
                "sol": 14,
                "lon": 77.4509,
                "lat": 18.4445,
                "elev_geoid": -2569.86,
                "yaw": None,
            }
        },
        {"properties": {"RMC": "bad", "site": None, "drive": 5, "sol": 15, "lon": 1, "lat": 1}},
    ]
}


def test_waypoint_stops_keeps_exact_ids_and_positions() -> None:
    stops = waypoint_stops(RAW)
    assert stops[0] == {
        "site": 3,
        "drive": 0,
        "sol": 13,
        "lon": 77.450886,
        "lat": 18.444627,
        "elevM": -2569.9,
        "yawDeg": 130.9,
    }


def test_waypoint_stops_allows_missing_yaw_but_drops_rows_without_site() -> None:
    stops = waypoint_stops(RAW)
    assert len(stops) == 2
    assert stops[1]["yawDeg"] is None


def test_waypoint_stops_are_sorted_by_sol_then_drive() -> None:
    raw = {"features": list(reversed(RAW["features"][:2]))}
    assert [s["drive"] for s in waypoint_stops(raw)] == [0, 110]
