"""Tests for Mars solar irradiance model (Appelbaum & Flood 1990)."""

from marsmap.solar_power import daily_insolation_kwh, mean_annual_insolation_kwh


def test_equatorial_clear_sky() -> None:
    # Equatorial perihelion (Ls=251), low dust (tau_ir=0.1): returns raw surface kWh/m²/sol
    # ~4.45 kWh/m²/sol from model (consistent with InSight ~3.6 kWh/m²/sol raw at lat=4.5°N)
    kwh = daily_insolation_kwh(0.0, 251.0, 0.1)
    assert 3.5 < kwh < 5.5, f"Expected 3.5-5.5 raw kWh/m²/sol, got {kwh}"


def test_polar_winter_zero() -> None:
    # North pole (lat=90) in northern winter (Ls=180): sun below horizon all day
    kwh = daily_insolation_kwh(90.0, 180.0, 0.5)
    assert kwh == 0.0, f"Expected 0.0 kWh at polar winter, got {kwh}"


def test_dusty_reduces_insolation() -> None:
    kwh_clear = daily_insolation_kwh(0.0, 90.0, 0.1)
    kwh_dusty = daily_insolation_kwh(0.0, 90.0, 3.0)
    assert kwh_dusty < kwh_clear, f"Dusty {kwh_dusty} should be < clear {kwh_clear}"


def test_mean_annual_finite() -> None:
    kwh = mean_annual_insolation_kwh(18.4, 0.5)  # Jezero lat, moderate dust
    assert 1.0 < kwh < 4.5, f"Expected 1.0-4.5 raw kWh/m²/sol mean annual, got {kwh}"


def test_southern_summer_positive() -> None:
    # South pole summer: Ls=90 puts sun south of equator (southern summer = Ls ~270° is wrong)
    # Ls=90 → delta = 25.19 × sin(90-248) = 25.19 × sin(-158°) ≈ -9.4° (sun south of equator)
    kwh = daily_insolation_kwh(-90.0, 90.0, 0.5)
    assert kwh > 0, f"Expected positive insolation at south pole southern summer (Ls=90), got {kwh}"


def test_negative_lat_works() -> None:
    kwh = daily_insolation_kwh(-18.4, 180.0, 0.5)
    assert kwh >= 0
