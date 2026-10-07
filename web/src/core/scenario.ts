/**
 * Season scenario: for a chosen solar longitude, when is the sun up at a site, which hours suit a
 * walk, and how dusty is the season typically. Climatology only: never a date or a forecast.
 */
import { localMeanSolarTimeHours, season, solarLongitudeDeg, sunPosition } from './mars-time'
import { type SiteId, dustDevilsPerHour, seasonalTau } from './surface-conditions'

const SOL_MS = 88_775_244 // one mean solar day (24 h 39 m 35.244 s)
const MARS_YEAR_MS = 686.98 * 86_400_000
const CURVE_STEP_H = 0.25
/** Sun at least this high for the whole walk: terrain lit, shadows short enough to read. Team assumption. */
export const MIN_SUN_ELEVATION_DEG = 10

const mod = (x: number, m: number) => ((x % m) + m) % m

/** The first moment at or after `fromMs` when the sun is at solar longitude `lsDeg`. */
export function utcForLs(lsDeg: number, fromMs: number): number {
  const ls0 = solarLongitudeDeg(fromMs)
  const target = mod(lsDeg - ls0, 360)
  // Ls only grows through a Mars year, so its advance since `fromMs` is monotonic: bisect it.
  const advance = (t: number) => mod(solarLongitudeDeg(t) - ls0, 360)
  let lo = fromMs
  let hi = fromMs + MARS_YEAR_MS * 0.999
  if (target < 1e-6) return fromMs
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (advance(mid) < target) lo = mid
    else hi = mid
  }
  return hi
}

/** The moment in the same sol as `utcMs` when local mean solar time at `lon` is `hours`. */
export function atLocalHour(utcMs: number, lon: number, hours: number): number {
  const shiftH = mod(hours - localMeanSolarTimeHours(utcMs, lon) + 12, 24) - 12
  return utcMs + (shiftH / 24) * SOL_MS
}

export type SunSample = { hours: number; elevationDeg: number }

/** Sun elevation through the sol containing `utcMs`, every quarter hour of local time. */
export function sunCurve(utcMs: number, lon: number, lat: number): SunSample[] {
  const midnight = atLocalHour(utcMs, lon, 0)
  const samples: SunSample[] = []
  for (let h = 0; h <= 24 + 1e-9; h += CURVE_STEP_H) {
    const t = midnight + (h / 24) * SOL_MS
    samples.push({ hours: h, elevationDeg: sunPosition(t, lon, lat).elevationDeg })
  }
  return samples
}

export type EvaWindow = { startH: number; endH: number; minElevationDeg: number }

/** The `evaHours` stretch with the highest lowest sun; null if the sun dips below the floor in all. */
export function evaWindow(
  curve: readonly SunSample[],
  evaHours: number,
  minSunDeg = MIN_SUN_ELEVATION_DEG,
): EvaWindow | null {
  const span = Math.round(evaHours / CURVE_STEP_H)
  let best: EvaWindow | null = null
  for (let i = 0; i + span < curve.length; i++) {
    let low = Infinity
    for (let k = i; k <= i + span; k++) low = Math.min(low, curve[k]?.elevationDeg ?? -90)
    if (low >= minSunDeg && (!best || low > best.minElevationDeg)) {
      best = {
        startH: curve[i]?.hours ?? 0,
        endH: curve[i + span]?.hours ?? 0,
        minElevationDeg: low,
      }
    }
  }
  return best
}

export type SeasonScenario = {
  ls: number
  season: string
  /** Typical visible column dust for the season (rover sky records), no storm. */
  typicalTau: number
  sunriseH: number | null
  sunsetH: number | null
  noonElevationDeg: number
  window: EvaWindow | null
  /** Local hours when dust devils are at least half as frequent as at their peak; null if rare. */
  devilHours: [number, number] | null
}

export function seasonScenario(at: {
  ls: number
  site: SiteId
  lon: number
  lat: number
  fromMs: number
  evaHours: number
}): SeasonScenario {
  const curve = sunCurve(utcForLs(at.ls, at.fromMs), at.lon, at.lat)
  const up = curve.filter((s) => s.elevationDeg > 0)
  const rates = curve.map((s) => dustDevilsPerHour(at.site, at.ls, s.hours))
  const peak = Math.max(...rates)
  const busy = curve.filter((_, i) => peak >= 1 && (rates[i] ?? 0) >= peak / 2)
  return {
    ls: at.ls,
    season: season(at.ls, at.lat),
    typicalTau: seasonalTau(at.ls),
    sunriseH: up[0]?.hours ?? null,
    sunsetH: up.at(-1)?.hours ?? null,
    noonElevationDeg: Math.max(...curve.map((s) => s.elevationDeg)),
    window: evaWindow(curve, at.evaHours),
    devilHours: busy.length ? [busy[0]?.hours ?? 0, busy.at(-1)?.hours ?? 0] : null,
  }
}
