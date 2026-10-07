from datetime import UTC, datetime

import numpy as np
import pytest

from marsmap.dust import bin_by_ls, cell_of
from marsmap.mars24 import mars_year_start_ms, solar_longitude_deg

DAY_MS = 86_400_000


def utc_ms(y: int, m: int, d: int) -> float:
    return datetime(y, m, d, tzinfo=UTC).timestamp() * 1000


class TestMars24:
    @pytest.mark.parametrize(
        ("year", "date"),
        [(34, (2017, 5, 5)), (35, (2019, 3, 23)), (36, (2021, 2, 7)), (37, (2022, 12, 26))],
    )
    def test_mars_years_start_on_the_published_dates(
        self, year: int, date: tuple[int, int, int]
    ) -> None:
        # Mars year calendar of Clancy et al. 2000 / Piqueux et al. 2015: MY1 began 1955-04-11.
        assert abs(mars_year_start_ms(year) - utc_ms(*date)) < 1.5 * DAY_MS

    def test_ls_is_zero_at_the_start_of_a_year_and_grows_through_it(self) -> None:
        start = mars_year_start_ms(34)
        assert min(solar_longitude_deg(start), 360 - solar_longitude_deg(start)) < 0.01
        assert 80 < solar_longitude_deg(start + 190 * DAY_MS) < 100  # about a quarter of the way


class TestBinByLs:
    def test_averages_each_ls_bin_and_ignores_missing_values(self) -> None:
        ls = np.array([1.0, 5.0, 12.0, 15.0, 355.0])
        values = np.array([0.1, 0.3, 0.2, np.nan, 0.9])
        bins = bin_by_ls(values, ls, 10)
        assert len(bins) == 36
        assert bins[0] == pytest.approx(0.2)
        assert bins[1] == pytest.approx(0.2)
        assert bins[35] == pytest.approx(0.9)
        assert bins[2] is None  # no data in 20-30


class TestCellOf:
    def test_finds_the_3_degree_cell_holding_a_site(self) -> None:
        # Grid cells span lon -181.5..178.5 and lat 90..-90 in 3 deg steps, row 0 at the north.
        assert cell_of(77.45, 18.44) == (23, 86)  # Jezero: centred 78E, 19.5N
        assert cell_of(137.4, -4.7) == (31, 106)  # Gale: centred 138E, 4.5S

    def test_wraps_east_longitudes_beyond_180(self) -> None:
        assert cell_of(259.29, -30.74) == cell_of(259.29 - 360, -30.74)
        assert cell_of(179.9, 0) == (30, 0)  # the cell centred on 180 deg spans the dateline
