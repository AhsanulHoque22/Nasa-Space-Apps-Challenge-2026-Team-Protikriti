"""Mars surface solar irradiance model (Appelbaum & Flood 1990, NASA TM-102299).

Computes daily insolation on a horizontal surface at any Mars latitude, solar
longitude, and dust optical depth.  All physical constants cite the source paper.
"""

import math

# Mars orbital constants (Appelbaum & Flood §2)
_MARS_OBLIQUITY_DEG = 25.19  # axial tilt, degrees
_PERIHELION_LS_DEG = 251.0  # Ls at perihelion
_ECCENTRICITY = 0.0934  # Mars orbital eccentricity
_H_TOA_MEAN_W_M2 = 590.0  # W/m² at mean Mars-Sun distance (1.524 AU)
_MARS_SOL_HOURS = 24.6597  # hours in a Mars sol

# Raw surface irradiance constants (no panel efficiency applied here)
_VISIBLE_FACTOR = 2.6  # IR to visible optical depth factor (Montabone dust.py constant)

# Reference maximum for normalising score grids: raw surface kWh/m²/sol
# Equatorial perihelion (Ls=251, lat=0, tau_ir=0.1): ~4.45 kWh/m²/sol from model
# InSight ~5 kWh/sol from 7 m² at ~20% efficiency → raw ≈ 3.6 kWh/m²/sol. Use 4.5 as ceiling.
INSOLATION_MAX_KWH = 4.5  # kWh/m²/sol raw surface (used for score normalisation)

# Mean annual Ls step for annual-average computation
_LS_STEPS = 36


def daily_insolation_kwh(lat_deg: float, ls_deg: float, tau_ir: float) -> float:
    """Daily solar energy on a horizontal 1 m² panel at Mars surface.

    Args:
        lat_deg: Planetocentric latitude, degrees (+ = north).
        ls_deg:  Solar longitude, degrees (0 = northern spring equinox).
        tau_ir:  Column dust optical depth at IR (9.3 µm, normalised to 610 Pa),
                 as in the Montabone dust climatology.

    Returns:
        kWh/m²/sol delivered to the panel surface (>= 0).
    """
    # Solar declination: Mars axial tilt x seasonal phase; 248 deg offsets Ls to declination cycle
    delta_rad = math.radians(_MARS_OBLIQUITY_DEG * math.sin(math.radians(ls_deg - 248.0)))

    phi_rad = math.radians(lat_deg)
    tan_prod = math.tan(phi_rad) * math.tan(delta_rad)

    if tan_prod <= -1.0:
        return 0.0  # polar night: sun never rises

    # Half-day angle (radians); pi = midnight sun, 0 = polar night
    omega_s = math.pi if tan_prod >= 1.0 else math.acos(-tan_prod)

    # Top-of-atmosphere flux adjusted for orbital eccentricity
    h_toa = _H_TOA_MEAN_W_M2 * (
        1.0 + _ECCENTRICITY * math.cos(math.radians(ls_deg - _PERIHELION_LS_DEG))
    )

    # Atmospheric transmittance: simplified mean-zenith approximation
    tau_vis = tau_ir * _VISIBLE_FACTOR
    tau_trans = math.exp(-tau_vis / 2.0)

    # Daily integrated geometric factor (Appelbaum & Flood eq. 3)
    geo = omega_s * math.sin(phi_rad) * math.sin(delta_rad) + math.cos(phi_rad) * math.cos(
        delta_rad
    ) * math.sin(omega_s)

    h_surface_w = (h_toa / math.pi) * tau_trans * geo

    # Return raw surface kWh/m²/sol (no panel efficiency; apply that in the budget module)
    return max(0.0, h_surface_w * _MARS_SOL_HOURS / 1000.0)


def mean_annual_insolation_kwh(lat_deg: float, mean_tau_ir: float) -> float:
    """Mean daily insolation averaged over a full Mars year at a given latitude.

    Args:
        lat_deg:     Planetocentric latitude, degrees.
        mean_tau_ir: Mean annual IR optical depth (use site mean from dust.json).

    Returns:
        Mean kWh/m²/sol over the Mars year.
    """
    ls_values = [i * (360.0 / _LS_STEPS) for i in range(_LS_STEPS)]
    total = sum(daily_insolation_kwh(lat_deg, ls, mean_tau_ir) for ls in ls_values)
    return total / _LS_STEPS
