/** Rank candidate Exploration Zones on measures the app holds from cited datasets. */

/**
 * Latitude limit on landing sites for solar power and thermal reasons, as summarised from the
 * 2015 Exploration Zone workshop criteria in our research notes. Verify against LPI Contribution
 * 1879 before quoting it.
 */
export const LATITUDE_LIMIT_DEG = 50

export type ZoneRow = {
  name: string
  lon: number
  lat: number
  /** MOLA elevation at the zone centre, metres; null if unavailable. */
  elevationM: number | null
  /** SWIM shallow-ice consistency (-1..+1) at the zone centre; null where SWIM has no data. */
  ice: number | null
}

export type Weights = { ice: number; lowElevation: number; nearEquator: number }

export type Ranked = ZoneRow & {
  /** 0..1: the weighted share of the best value on each criterion. */
  score: number
  beyondLatitudeLimit: boolean
  /** Criteria this zone has no data for (they score 0). */
  missing: Array<'ice' | 'elevation'>
}

/** Scale to 0 (worst) .. 1 (best) over the zones that have a value; 0 for all if none differ. */
function normalise(values: Array<number | null>, higherIsBetter: boolean): number[] {
  const present = values.filter((v): v is number => v !== null)
  const lo = Math.min(...present)
  const hi = Math.max(...present)
  return values.map((v) => {
    if (v === null || hi === lo) return 0
    return higherIsBetter ? (v - lo) / (hi - lo) : (hi - v) / (hi - lo)
  })
}

export function rankZones(rows: readonly ZoneRow[], weights: Weights): Ranked[] {
  const ice = normalise(
    rows.map((r) => r.ice),
    true,
  )
  const elevation = normalise(
    rows.map((r) => r.elevationM),
    false,
  )
  const equator = normalise(
    rows.map((r) => Math.abs(r.lat)),
    false,
  )
  const total = weights.ice + weights.lowElevation + weights.nearEquator
  const ranked = rows.map((row, i): Ranked => {
    const sum =
      weights.ice * (ice[i] as number) +
      weights.lowElevation * (elevation[i] as number) +
      weights.nearEquator * (equator[i] as number)
    const missing: Ranked['missing'] = []
    if (row.ice === null) missing.push('ice')
    if (row.elevationM === null) missing.push('elevation')
    return {
      ...row,
      score: total === 0 ? 0 : sum / total,
      beyondLatitudeLimit: Math.abs(row.lat) > LATITUDE_LIMIT_DEG,
      missing,
    }
  })
  return ranked.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
}

/** The zone with the most ice-consistent ground, and whether it lies beyond the latitude limit. */
export function iceVersusLatitude(
  rows: readonly ZoneRow[],
): { zone: string; lat: number; beyondLimit: boolean } | null {
  let best: ZoneRow | null = null
  for (const r of rows) if (r.ice !== null && (!best || r.ice > (best.ice as number))) best = r
  return best
    ? { zone: best.name, lat: best.lat, beyondLimit: Math.abs(best.lat) > LATITUDE_LIMIT_DEG }
    : null
}
