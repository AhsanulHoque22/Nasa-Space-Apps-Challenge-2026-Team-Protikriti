/**
 * Mission 1.2: which NASA Exploration Zones a crew could land at. The hard limits are NASA's
 * preliminary human-landing bounds (latitude within ±50°, elevation no higher than +2 km above
 * the MOLA areoid). The final pick must be a zone with high-resolution terrain in ATLAS, since no
 * crew would be sent to a site that has not been imaged in detail.
 */
import type { ZoneRow } from './zone-rank'

export const LANDING_LATITUDE_LIMIT_DEG = 50
export const LANDING_ELEVATION_LIMIT_M = 2000

/** Exploration Zones (LPI Contribution 1879 names) that sit on an ATLAS terrain site. */
export const CERTIFIED_ZONES: Readonly<Record<string, string>> = {
  'Jezero-Syrtis-Isidis': 'jezero',
  'Gale Crater': 'gale',
  'Gusev Crater': 'columbia_hills',
  'Meridiani Planum': 'meridiani',
}

export type ZoneJudgement = { excluded: string | null; siteId: string | null }

export function judgeZone(z: ZoneRow): ZoneJudgement {
  const siteId = CERTIFIED_ZONES[z.name] ?? null
  if (Math.abs(z.lat) > LANDING_LATITUDE_LIMIT_DEG) {
    return { excluded: 'Beyond the ±50° latitude limit for landing and ascent.', siteId }
  }
  if (z.elevationM === null) {
    return { excluded: 'No elevation data to check the +2 km limit.', siteId }
  }
  if (z.elevationM > LANDING_ELEVATION_LIMIT_M) {
    return { excluded: 'Above the +2 km limit: too little air to slow a heavy lander.', siteId }
  }
  return { excluded: null, siteId }
}
