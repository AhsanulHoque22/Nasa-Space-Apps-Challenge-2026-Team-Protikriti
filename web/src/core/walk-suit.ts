/**
 * What an on-foot walk does to a suit, the render settings it needs, and the wording of its drills.
 * Suit basis: 8 hours of oxygen and battery (NASA EVA-EXP-0075, 2020); walking adds 2x base oxygen
 * per 1 m/s (team assumption, see docs/data-sources.md).
 */
const FULL_SUIT_S = 8 * 3600
const BASE_PCT_PER_S = 100 / FULL_SUIT_S
const WALK_O2_PCT_PER_S_PER_MS = BASE_PCT_PER_S * 2
/** Above this the fill rate outruns a phone's GPU for little visible gain. */
const MAX_WALK_PIXEL_RATIO = 2

export type Suit = { o2Pct: number; powerPct: number }

/** The suit after `dtS` seconds at `speedMs` (0 when standing or in the air). */
export function suitAfter(suit: Suit, speedMs: number, dtS: number): Suit {
  return {
    o2Pct: Math.max(0, suit.o2Pct - (BASE_PCT_PER_S + WALK_O2_PCT_PER_S_PER_MS * speedMs) * dtS),
    powerPct: Math.max(0, suit.powerPct - BASE_PCT_PER_S * dtS),
  }
}

/**
 * Keep the browser's resolution rule on: with it off Cesium multiplies resolutionScale by the device
 * ratio, so a scale that already holds that ratio squares it (about 8x the pixels at DPR 2.75).
 */
export function walkResolution(devicePixelRatio: number): {
  useBrowserRecommendedResolution: boolean
  resolutionScale: number
} {
  return {
    useBrowserRecommendedResolution: true,
    resolutionScale: Math.min(MAX_WALK_PIXEL_RATIO, devicePixelRatio),
  }
}

/** On-foot solar events and quakes are random practice, never data: every word has to say so. */
export const solarDrillAlert = (): string =>
  'Drill: solar particle event. Practise getting under cover. Not a real forecast.'

export const solarDrillReadout = (doseMsvPerHr: number): string =>
  `${doseMsvPerHr.toFixed(2)} mSv/hr, solar event drill`

export const quakeDrillAlert = (magnitude: number, distanceKm: number): string =>
  `Drill: marsquake M${magnitude.toFixed(1)}, about ${Math.round(distanceKm)} km away. Not a real event.`
