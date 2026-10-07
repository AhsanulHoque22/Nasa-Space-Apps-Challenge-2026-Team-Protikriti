/**
 * Mission purpose. Choosing a site (Water-ISRU, Habitat, Logistics, Explore): hard rules drop
 * zones, then purpose weights rank the rest. Walking a route (Explore, Emergency): the purpose
 * sets the time spent at each stop. Ice and latitude only differ between zones, not inside an
 * 11 km site, so the site-choosing purposes act on the zone ranking.
 */
import { SCIENCE_STOP_MIN } from './summary'
import { LATITUDE_LIMIT_DEG, type Ranked, type Weights, type ZoneRow, rankZones } from './zone-rank'

/** SWIM consistency above 0: the radar, thermal and neutron evidence leans towards shallow ice. */
export const ICE_THRESHOLD = 0

export type ZonePurpose = 'explore' | 'water' | 'habitat' | 'logistics'

type ZonePurposeSpec = {
  label: string
  weights: Weights
  /** Why a zone is ruled out for this purpose, or null to keep it. */
  exclude: (z: ZoneRow) => string | null
  why: string
}

const beyondLatitude = (z: ZoneRow) =>
  Math.abs(z.lat) > LATITUDE_LIMIT_DEG ? `beyond the ±${LATITUDE_LIMIT_DEG}° latitude limit` : null

export const ZONE_PURPOSES: Record<ZonePurpose, ZonePurposeSpec> = {
  explore: {
    label: 'Explore',
    weights: { ice: 1, lowElevation: 1, nearEquator: 1 },
    exclude: () => null,
    why: 'Every zone stays in; all three measures count equally.',
  },
  water: {
    label: 'Water (ISRU)',
    weights: { ice: 3, lowElevation: 1, nearEquator: 0 },
    exclude: (z) =>
      z.ice === null
        ? 'no SWIM ice data'
        : z.ice <= ICE_THRESHOLD
          ? `SWIM ice consistency ${z.ice.toFixed(2)}, not above ${ICE_THRESHOLD}`
          : null,
    why: `Only zones where SWIM leans towards shallow ice (consistency above ${ICE_THRESHOLD}); ice counts most.`,
  },
  habitat: {
    label: 'Habitat',
    weights: { ice: 1, lowElevation: 2, nearEquator: 1 },
    exclude: beyondLatitude,
    why: `Within ±${LATITUDE_LIMIT_DEG}° for solar power and warmth; low ground counts double, as more air overhead means less radiation.`,
  },
  logistics: {
    label: 'Logistics',
    weights: { ice: 0, lowElevation: 3, nearEquator: 2 },
    exclude: beyondLatitude,
    why: `Within ±${LATITUDE_LIMIT_DEG}°; low ground counts most (more air to slow a landing), then nearness to the equator.`,
  },
}

/** Hard rules first, then the ranking; `weights` defaults to the purpose's own. */
export function applyPurpose(
  rows: readonly ZoneRow[],
  purpose: ZonePurpose,
  weights: Weights = ZONE_PURPOSES[purpose].weights,
): { ranked: Ranked[]; excluded: Array<{ zone: ZoneRow; reason: string }> } {
  const spec = ZONE_PURPOSES[purpose]
  const kept: ZoneRow[] = []
  const excluded: Array<{ zone: ZoneRow; reason: string }> = []
  for (const z of rows) {
    const reason = spec.exclude(z)
    if (reason === null) kept.push(z)
    else excluded.push({ zone: z, reason })
  }
  return { ranked: rankZones(kept, weights), excluded }
}

export type RoutePurpose = 'explore' | 'emergency'

export const ROUTE_PURPOSES: Record<RoutePurpose, { label: string; stopMin: number; why: string }> =
  {
    explore: {
      label: 'Explore',
      stopMin: SCIENCE_STOP_MIN,
      why: `${SCIENCE_STOP_MIN} min of science at every stop.`,
    },
    emergency: {
      label: 'Emergency',
      stopMin: 0,
      why: 'Reach each point as fast as possible: no time spent at stops.',
    },
  }
