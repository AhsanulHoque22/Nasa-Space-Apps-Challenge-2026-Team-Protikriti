"""Mars solar longitude and Mars-year starts: the Mars24 algorithm (Allison & McEwen 2000).

The same equations as the web app's mars-time.ts (B-1 to B-5), so pipeline and app agree.
"""

import math

DAY_MS = 86_400_000
J2000_JD = 2451545.0
# TT - UTC: 32.184 s + 37 leap seconds (since 2017). Over 1999-2026 the true value differs by at
# most 5 s, which moves Ls by about 0.00003 deg: irrelevant here.
TT_MINUS_UTC_S = 69.184
# Mars year 1 began at Ls 0 on 1955-04-11 (Clancy et al. 2000; Piqueux et al. 2015).
MY1_START_MS = -464_659_200_000.0  # 1955-04-11T00:00Z
MARS_YEAR_DAYS = 686.9725

# B-3: perturbations by other planets: (amplitude deg, period Julian years, phase deg)
PERTURBERS = (
    (0.0071, 2.2353, 49.409),
    (0.0057, 2.7543, 168.173),
    (0.0039, 1.1177, 191.837),
    (0.0037, 15.7866, 21.736),
    (0.0021, 2.1354, 15.704),
    (0.002, 2.4694, 95.528),
    (0.0018, 32.8493, 49.095),
)


def solar_longitude_deg(utc_ms: float) -> float:
    jd_tt = 2440587.5 + utc_ms / DAY_MS + TT_MINUS_UTC_S / 86400
    dt = jd_tt - J2000_JD
    m = math.radians(19.3871 + 0.52402073 * dt)  # B-1
    alpha_fms = 270.3871 + 0.524038496 * dt  # B-2
    pbs = sum(a * math.cos(math.radians(0.985626 * dt / tau + phi)) for a, tau, phi in PERTURBERS)
    nu_minus_m = (
        (10.691 + 3.0e-7 * dt) * math.sin(m)
        + 0.623 * math.sin(2 * m)
        + 0.05 * math.sin(3 * m)
        + 0.005 * math.sin(4 * m)
        + 0.0005 * math.sin(5 * m)
        + pbs
    )  # B-4
    return (alpha_fms + nu_minus_m) % 360  # B-5


def mars_year_start_ms(year: int) -> float:
    """UTC ms when Mars year `year` began (Ls crossed 0), to about a second."""
    guess = MY1_START_MS + (year - 1) * MARS_YEAR_DAYS * DAY_MS
    lo, hi = guess - 10 * DAY_MS, guess + 10 * DAY_MS

    def wrapped(t: float) -> float:  # signed distance from Ls 0, in -180..180
        return (solar_longitude_deg(t) + 180) % 360 - 180

    if not (wrapped(lo) < 0 < wrapped(hi)):
        raise ValueError(f"could not bracket the start of Mars year {year}")
    for _ in range(60):
        mid = (lo + hi) / 2
        if wrapped(mid) < 0:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2
