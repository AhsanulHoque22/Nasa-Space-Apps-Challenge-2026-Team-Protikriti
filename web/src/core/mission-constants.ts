/**
 * Story mode's fixed mission facts. Each value names its source; see
 * docs/superpowers/specs/2026-10-25-mission-journey-design.md §3.
 */

/** Crew of four: NASA CHAPEA analog and the EMC operations in Rucker et al. 2016. Team choice. */
export const CREW_SIZE = 4

/** 539 days on the surface (DRA 5.0, Drake 2009) = 524.6 sols, rounded up. */
export const SURFACE_STAY_SOLS = 525

/** One mean solar day, 88,775.244 s (Allison & McEwen 2000, Mars24), in Earth days. */
export const DAYS_PER_SOL = 88_775.244 / 86_400

/** Food supply planning mass incl. packaging, kg per crew member per day. BVAD Rev2 (2022) §3.3, ISS value. */
export const FOOD_PACKED_KG_PER_CM_DAY = 2.39

/** Potable water content, kg per crew member per day. BVAD Rev2 (2022) Table 3-31. */
export const POTABLE_WATER_KG_PER_CM_DAY = 3.217

/** Surface habitat power from an external source, kWe. DRA 5.0 (Drake 2009), Commuter habitat. */
export const HABITAT_EXTERNAL_KWE = 12.1

/** Surface habitat mass, kg. DRA 5.0 (Drake 2009), Commuter habitat incl. 20% design factor. */
export const HABITAT_KG = 21_500

/**
 * Landed payload per cargo lander: DRA 5.0 gives 30–50 t. One 40 t lander is a team choice inside
 * that range; NASA's Jezero study (Rucker et al. 2016) spreads the same hardware over several landers.
 */
export const CARGO_LIMIT_KG = 40_000

/** Return-propellant oxygen the plant must make before the crew launches, kg (Rucker et al. 2016). */
export const LOX_TARGET_KG = 22_728
/** Time allowed for it: 14 Earth months, 420 days (Rucker et al. 2016). */
export const LOX_WINDOW_DAYS = 420
/** ISRU plant power at full rate during the cargo phase, kW (Rucker et al. 2016, Table 3). */
export const ISRU_FULL_POWER_KW = 19.7
/** Ascent-vehicle propellant conditioning, kW, always on (Rucker et al. 2016, Table 3). */
export const MAV_CONDITIONING_KW = 6.655
/** Delivered power per Kilopower unit: four units give "up to 35 kWe" (Rucker et al. 2016). */
export const KILOPOWER_DELIVERED_KWE = 35 / 4
/** One battery bank: 2,437 kg of Li-S cells at 270 Wh/kg (Rucker et al. 2016, Table 7). Nameplate. */
export const BATTERY_KWH_PER_BANK = (2437 * 270) / 1000
/** One solar set: four UltraFlex wings 12 m across (Rucker et al. 2016). Area in m². */
export const SOLAR_SET_AREA_M2 = 4 * Math.PI * 6 ** 2
/** Clear-season dust optical depth assumed at Jezero (Rucker et al. 2016). Applied to every site. */
export const CLEAR_TAU = 1.0
