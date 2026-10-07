/**
 * Storm-shelter check: with a solar-storm warning, can the crew reach cover in time? Cover is the
 * habitat (the route start) or the nearest cave candidate. How well a cave shields is unknown.
 */
import { type Cave, nearestCave } from './caves'
import { MAX_SUIT_SPEED_KMH } from './route'

export type ShelterOptions = {
  habitat: { walkMin: number; inTime: boolean; spareMin: number }
  /** Straight-line distance at the suit's top pace: a floor, the real walk is only longer. */
  cave: { cave: Cave; distanceKm: number; walkMinAtLeast: number; inTime: boolean } | null
}

export function shelterOptions(
  from: { lon: number; lat: number },
  caves: readonly Cave[],
  at: { homeMin: number; warningMin: number },
): ShelterOptions {
  const near = nearestCave(caves, from.lon, from.lat)
  const walkMinAtLeast = near ? (near.distanceKm / MAX_SUIT_SPEED_KMH) * 60 : Infinity
  return {
    habitat: {
      walkMin: at.homeMin,
      inTime: at.homeMin <= at.warningMin,
      spareMin: at.warningMin - at.homeMin,
    },
    cave: near && { ...near, walkMinAtLeast, inTime: walkMinAtLeast <= at.warningMin },
  }
}
