/**
 * Sunlight at the preview site (Jezero), computed once and shared by mission 1.1's charts:
 * a Mars year of daily sunlight, and the half-hour profile of the darkest sol in it.
 */
import { CLEAR_TAU, PREVIEW_SITE } from '../../core/mission-constants'
import { type SolSample, solProfile, sunYear, yearStartUtc } from '../../core/surface-solar'
import { SOL_SECONDS } from '../../core/solar'
import { nextLocalHourMs } from '../../core/mars-time'

type Profile = SolSample[] & { stepHours: number }
let cache: { year: ReturnType<typeof sunYear>; darkest: Profile } | null = null

export function previewSun(): { year: ReturnType<typeof sunYear>; darkest: Profile } {
  if (cache) return cache
  const year = sunYear(PREVIEW_SITE.latDeg, PREVIEW_SITE.lonDeg, CLEAR_TAU)
  let darkest = 0
  year.forEach((sol, i) => {
    if (sol.kwhPerM2 < (year[darkest]?.kwhPerM2 ?? Infinity)) darkest = i
  })
  // Start at local midnight so the chart reads as a day: night, sunrise, noon, sunset, night.
  const start = nextLocalHourMs(
    yearStartUtc() + darkest * SOL_SECONDS * 1000,
    PREVIEW_SITE.lonDeg,
    0,
  )
  cache = { year, darkest: solProfile(PREVIEW_SITE.latDeg, PREVIEW_SITE.lonDeg, start, CLEAR_TAU) }
  return cache
}
