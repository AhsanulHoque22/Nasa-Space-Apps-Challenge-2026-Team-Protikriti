/**
 * What it is like to stand at a rover site at a given moment: dust, visibility, wind, dust
 * devils and air temperature. Station readings (REMS, MEDA) are used when they cover the date;
 * the rest is a seasonal climatology from the rovers' own sky and weather records.
 */
import type { SolWeather } from './weather'

export type SiteId = 'jezero' | 'gale'

const DEG = Math.PI / 180

// Visible (880 nm) column dust opacity at Gale and Jezero: ~0.4 near aphelion (Ls 70), ~0.9 in
// the perihelion dusty season (Ls ~250). Lemmon et al. 2015 (Icarus 251), Lemmon et al. 2022
// (GRL 49, Mastcam-Z). ponytail: a smooth mean year; real years have storms on top of it.
const TAU_CLEAR = 0.4
const TAU_DUSTY_EXTRA = 0.5
const DUSTY_SEASON_LS = 250

/** Documented dust events at the rovers (visible opacity), [start, peak, end] UTC. */
const EVENTS: ReadonlyArray<{
  name: string
  sites: readonly SiteId[]
  start: string
  peak: string
  end: string
  peakTau: number
}> = [
  // MY34 planet-encircling storm: Curiosity measured tau ~8.5 in June 2018 (Guzewich et al. 2019).
  {
    name: '2018 global dust storm',
    sites: ['gale', 'jezero'],
    start: '2018-05-30',
    peak: '2018-06-20',
    end: '2018-09-30',
    peakTau: 8.5,
  },
  // Regional storm over Jezero, early January 2022 (MEDA; Lemmon et al. 2022): tau ~2.
  {
    name: 'Jezero regional dust storm (Jan 2022)',
    sites: ['jezero'],
    start: '2022-01-04',
    peak: '2022-01-08',
    end: '2022-01-25',
    peakTau: 2,
  },
]

/** Column dust opacity and the named event causing it, if any. */
export function dustOpacity(
  utcMs: number,
  ls: number,
  site: SiteId = 'jezero',
): { tau: number; event: string | null } {
  const season = ((1 + Math.cos((ls - DUSTY_SEASON_LS) * DEG)) / 2) ** 2
  const tau = TAU_CLEAR + TAU_DUSTY_EXTRA * season
  for (const e of EVENTS) {
    const [start, peak, end] = [e.start, e.peak, e.end].map(Date.parse) as [number, number, number]
    if (!e.sites.includes(site) || utcMs < start || utcMs > end) continue
    const f = utcMs < peak ? (utcMs - start) / (peak - start) : 1 - (utcMs - peak) / (end - peak)
    return { tau: Math.max(tau, tau + (e.peakTau - tau) * f), event: e.name }
  }
  return { tau, event: null }
}

// Dust is mixed through ~8 km near the ground; Koschmieder's law (2% contrast) turns the
// column opacity into a horizontal visibility: V = 3.9 H / tau.
const DUST_SCALE_HEIGHT_KM = 8

export function visibilityKm(tau: number): number {
  return (3.9 * DUST_SCALE_HEIGHT_KM) / Math.max(0.05, tau)
}

// Mars air is coldest just before sunrise and warmest about 14:00 local (REMS, MEDA).
const COLDEST_H = 5
const WARMEST_H = 14

/** Air temperature at local mean solar time `lmstH` between the sol's min and max. */
export function airTempC(minC: number, maxC: number, lmstH: number): number {
  const h = (((lmstH - COLDEST_H) % 24) + 24) % 24 // hours since the coldest moment
  const rise = WARMEST_H - COLDEST_H
  const f =
    h <= rise
      ? (1 - Math.cos((Math.PI * h) / rise)) / 2
      : (1 + Math.cos((Math.PI * (h - rise)) / (24 - rise))) / 2
  return minC + (maxC - minC) * f
}

/**
 * Dust-lifting whirlwinds per hour within sight: Jezero has many around midday (Newman et al.
 * 2022, Sci. Adv. 8), Gale very few (Kahanpää et al. 2016). ponytail: a peak-shaped rate, not
 * a statistical model.
 */
export function dustDevilsPerHour(site: SiteId, ls: number, lmstH: number): number {
  if (lmstH < 9 || lmstH > 17) return 0
  const peak = site === 'jezero' ? 3 : 0.3
  const season = 0.6 + 0.4 * ((1 + Math.cos((ls - DUSTY_SEASON_LS) * DEG)) / 2)
  return peak * season * Math.exp(-(((lmstH - 12.5) / 1.5) ** 2) / 2)
}

/** Near-surface wind (m/s): calm nights, convective afternoons (MEDA), stronger in storms. */
export function windMs(lmstH: number, tau: number): number {
  const day = Math.max(0, Math.sin(((lmstH - 8) / 12) * Math.PI)) // 08:00–20:00
  return 2 + 6 * day + Math.min(12, 3 * Math.max(0, tau - 1))
}

export type Conditions = {
  tau: number
  event: string | null
  sky: string
  visibilityKm: number
  windMs: number
  dustDevilsPerHour: number
  airTempC: number
  pressurePa: number | null
  source: string
}

// Typical sol extremes when no reading covers the date (MEDA at Jezero, REMS at Gale).
const CLIMATE: Record<SiteId, { minC: number; maxC: number }> = {
  jezero: { minC: -80, maxC: -20 },
  gale: { minC: -75, maxC: -5 },
}
const READING_WINDOW_MS = 3 * 86_400_000

export function surfaceConditions(at: {
  utcMs: number
  ls: number
  lmstHours: number
  site: SiteId
  sols: readonly SolWeather[]
}): Conditions {
  const { tau, event } = dustOpacity(at.utcMs, at.ls, at.site)
  const reading = at.sols.find(
    (s) =>
      s.minC !== null &&
      s.maxC !== null &&
      Math.abs(Date.parse(`${s.earthDate}T12:00:00Z`) - at.utcMs) <= READING_WINDOW_MS,
  )
  const range =
    reading?.minC != null && reading.maxC != null
      ? { minC: reading.minC, maxC: reading.maxC }
      : CLIMATE[at.site]
  return {
    tau,
    event,
    sky: event ?? (tau > 1.5 ? 'Dusty' : tau > 0.7 ? 'Hazy (dusty season)' : 'Clear'),
    visibilityKm: visibilityKm(tau),
    windMs: windMs(at.lmstHours, tau),
    dustDevilsPerHour: dustDevilsPerHour(at.site, at.ls, at.lmstHours),
    airTempC: airTempC(range.minC, range.maxC, at.lmstHours),
    pressurePa: reading?.pressurePa ?? null,
    source: reading
      ? `${at.site === 'gale' ? 'REMS' : 'MEDA'} station, sol ${reading.sol}`
      : 'Seasonal climatology',
  }
}

// Peak visible opacity Curiosity measured in the 2018 global storm (Guzewich et al. 2019).
const STORM_2018_TAU = 8.5

/** The same moment under the 2018 global dust storm, for showing what one looks like. */
export function underStorm(c: Conditions, lmstHours: number): Conditions {
  return {
    ...c,
    tau: STORM_2018_TAU,
    event: '2018 global dust storm',
    sky: '2018 global dust storm (replay)',
    visibilityKm: visibilityKm(STORM_2018_TAU),
    windMs: windMs(lmstHours, STORM_2018_TAU),
    dustDevilsPerHour: 0, // storms shut down the convection that makes dust devils
  }
}
