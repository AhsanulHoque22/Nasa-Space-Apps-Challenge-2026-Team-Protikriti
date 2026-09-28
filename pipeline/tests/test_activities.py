from pathlib import Path

from marsmap.activities import parse_samples, resolve_positions

EXCERPT = (Path(__file__).parent / "fixtures" / "samples_excerpt.md").read_text()


def test_parse_samples_reads_each_official_sample() -> None:
    samples = parse_samples(EXCERPT)
    assert [s["number"] for s in samples] == [1, 2, 3, 26, 30]
    roubion = samples[0]
    assert roubion["name"] == "Roubion"  # bold markers stripped from the heading
    assert roubion["sol"] == 164
    assert roubion["sampleType"] == "Atmospheric"
    assert roubion["dateSealed"] == "Aug. 6, 2021"
    assert roubion["location"] == "Sample Depot"
    assert roubion["image"].startswith("https://science.nasa.gov/wp-content/uploads/")
    assert samples[1]["name"] == "Montdenier"
    assert samples[1]["feature"] == "Rochette"
    assert samples[1]["rockType"] == "Igneous"


def test_resolve_positions_uses_the_rover_waypoint_for_that_sol() -> None:
    waypoints = [
        {"sol": 150, "lon": 77.1, "lat": 18.1},
        {"sol": 160, "lon": 77.2, "lat": 18.2},
        {"sol": 170, "lon": 77.3, "lat": 18.3},
    ]
    placed = resolve_positions([{"sol": 164}, {"sol": 10}], waypoints)
    assert placed[0]["lon"] == 77.2  # rover was at the sol-160 waypoint on sol 164
    assert placed[0]["positionBasis"] == "rover waypoint at sol 160"
    assert placed[1]["lon"] == 77.1  # before the first waypoint -> first waypoint


def test_parse_samples_accepts_colon_outside_bold_labels() -> None:
    silver = next(s for s in parse_samples(EXCERPT) if s["number"] == 26)
    assert silver["sol"] == 1401
    assert silver["feature"] == "Shallow Bay"
    assert silver["sampleType"] == "Rock Core"


def test_samples_with_tbd_sol_are_kept_but_never_positioned() -> None:
    samples = parse_samples(EXCERPT)
    gallants = next(s for s in samples if s["number"] == 30)
    assert gallants["sol"] is None
    placed = resolve_positions([gallants], [{"sol": 1, "lon": 1.0, "lat": 2.0}])
    assert "lon" not in placed[0]
    assert placed[0]["positionBasis"] == "sol not yet published"
