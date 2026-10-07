import json
from pathlib import Path

import numpy as np
import pytest

from marsmap.benchmark import GridGeo, cell_of, replay, run_benchmark

# 10 x 10 cells over lon 0..10, lat 0..10: one cell per degree, row 0 at the north edge.
GEO = GridGeo(west=0.0, north=10.0, east=10.0, south=0.0)
LIMIT = 15.0


def flat() -> np.ndarray:
    return np.full((10, 10), 3.0, dtype=np.float32)


def at(lon: float, lat: float) -> tuple[float, float]:
    return (lon, lat)


class TestCellOf:
    def test_maps_like_the_web_grid(self) -> None:
        assert cell_of(GEO, (10, 10), 0.5, 9.5) == (0, 0)  # north-west cell
        assert cell_of(GEO, (10, 10), 9.5, 0.5) == (9, 9)  # south-east cell
        assert cell_of(GEO, (10, 10), 3.2, 6.9) == (3, 3)

    def test_outside_is_none_and_east_south_edges_are_exclusive(self) -> None:
        assert cell_of(GEO, (10, 10), -0.1, 5) is None
        assert cell_of(GEO, (10, 10), 10.0, 5) is None
        assert cell_of(GEO, (10, 10), 5, 0.0) is None
        assert cell_of(GEO, (10, 10), float("nan"), 5) is None


class TestLegs:
    def test_leg_over_gentle_ground_is_allowed(self) -> None:
        result = replay(flat(), GEO, [[at(1.5, 5.5), at(4.5, 5.5)]], [], LIMIT)
        assert (result.legs_total, result.legs_allowed, result.legs_blocked) == (1, 1, 0)

    def test_leg_crossing_a_steep_cell_is_blocked_even_though_the_rover_drove_it(self) -> None:
        slope = flat()
        slope[4, 3] = 20.0  # lat 5.5 is row 4; lon 3.5 is col 3
        result = replay(slope, GEO, [[at(1.5, 5.5), at(3.5, 5.5), at(5.5, 5.5)]], [], LIMIT)
        assert result.legs_blocked == 1 and result.legs_allowed == 0

    def test_nodata_blocks_a_leg_instead_of_counting_as_flat(self) -> None:
        slope = flat()
        slope[4, 3] = np.nan
        result = replay(slope, GEO, [[at(2.5, 5.5), at(3.5, 5.5)]], [], LIMIT)
        assert result.legs_blocked == 1

    def test_leg_entirely_off_the_map_is_counted_but_not_judged(self) -> None:
        result = replay(flat(), GEO, [[at(-5, 5), at(-4, 5)]], [], LIMIT)
        assert result.legs_total == 1
        assert result.legs_outside_grid == 1
        assert result.legs_allowed == result.legs_blocked == 0

    def test_leg_leaving_the_map_is_judged_on_the_part_inside(self) -> None:
        slope = flat()
        slope[4, 0] = 30.0
        result = replay(slope, GEO, [[at(-3, 5.5), at(0.5, 5.5)]], [], LIMIT)
        assert result.legs_blocked == 1 and result.legs_outside_grid == 0

    def test_the_limit_itself_is_allowed(self) -> None:
        slope = flat()
        slope[4, 3] = LIMIT
        assert replay(slope, GEO, [[at(3.5, 5.5), at(3.6, 5.5)]], [], LIMIT).legs_allowed == 1


class TestTilt:
    def test_steep_rover_tilt_where_the_map_says_gentle_is_a_false_pass(self) -> None:
        result = replay(flat(), GEO, [], [(2.5, 5.5, 20.0)], LIMIT)
        assert result.steep_waypoints == 1
        assert result.steep_missed == 1
        assert result.false_pass_rate_pct == 100.0

    def test_steep_rover_tilt_where_the_map_shows_hazard_is_caught(self) -> None:
        slope = flat()
        slope[4, 2] = 25.0
        result = replay(slope, GEO, [], [(2.5, 5.5, 20.0)], LIMIT)
        assert result.steep_missed == 0
        assert result.false_pass_rate_pct == 0.0

    def test_no_steep_waypoints_means_no_rate_not_zero(self) -> None:
        result = replay(flat(), GEO, [], [(2.5, 5.5, 5.0)], LIMIT)
        assert result.steep_waypoints == 0
        assert result.false_pass_rate_pct is None

    def test_waypoints_off_the_map_or_on_nodata_are_not_compared(self) -> None:
        slope = flat()
        slope[4, 2] = np.nan
        result = replay(slope, GEO, [], [(2.5, 5.5, 20.0), (50, 50, 20.0)], LIMIT)
        assert result.waypoints_in_grid == 0
        assert result.steep_waypoints == 0

    def test_correlation_needs_variation_and_matches_numpy(self) -> None:
        slope = flat()
        slope[4, 1], slope[4, 2], slope[4, 3] = 2.0, 6.0, 10.0
        pts = [(1.5, 5.5, 3.0), (2.5, 5.5, 7.0), (3.5, 5.5, 12.0)]
        result = replay(slope, GEO, [], pts, LIMIT)
        assert result.correlation == pytest.approx(
            np.corrcoef([2, 6, 10], [3, 7, 12])[0, 1], abs=1e-3
        )
        assert replay(flat(), GEO, [], pts, LIMIT).correlation is None  # constant slope


class TestRunBenchmark:
    def write_site(self, tmp_path: Path, elevation: np.ndarray) -> Path:
        height, width = elevation.shape
        grid = tmp_path / "grid"
        grid.mkdir()
        elevation.astype("<f4").tofile(grid / "grid.bin")
        (grid / "grid.json").write_text(
            json.dumps(
                {
                    "width": width,
                    "height": height,
                    "pixel_size_m": 20.0,
                    "west": 0.0,
                    "north": 10.0,
                    "east": 10.0,
                    "south": 0.0,
                    "max_safe_slope_deg": 15.0,
                }
            )
        )
        return grid

    def test_reads_the_real_file_shapes(self, tmp_path: Path) -> None:
        grid = self.write_site(tmp_path, np.zeros((10, 10)))
        traverse = tmp_path / "traverse.json"
        traverse.write_text(
            json.dumps(
                {
                    "features": [
                        {"geometry": {"coordinates": [[1.5, 5.5, -2500], [4.5, 5.5, -2500]]}}
                    ]
                }
            )
        )
        waypoints = tmp_path / "waypoints.json"
        waypoints.write_text(
            json.dumps(
                {
                    "features": [
                        {"properties": {"lon": 2.5, "lat": 5.5, "tilt": 4.0}},
                        {"properties": {"lon": 3.5, "lat": 5.5, "tilt": None}},
                    ]
                }
            )
        )
        out = run_benchmark(traverse, waypoints, grid)
        assert out["result"]["legs_allowed"] == 1
        assert out["result"]["waypoints_in_grid"] == 1  # the tilt-less waypoint is skipped
        assert "CTX" in out["source"]["terrain"]

    def test_rejects_a_grid_whose_size_does_not_match_its_metadata(self, tmp_path: Path) -> None:
        grid = self.write_site(tmp_path, np.zeros((10, 10)))
        (grid / "grid.bin").write_bytes(b"\0" * 12)
        with pytest.raises(ValueError, match="expected 100"):
            run_benchmark(tmp_path / "t.json", tmp_path / "w.json", grid)
