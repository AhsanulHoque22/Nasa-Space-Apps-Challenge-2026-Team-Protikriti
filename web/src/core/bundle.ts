/** A plan as a file: what was planned, the numbers, and every assumption behind them. */
import { type EvaCard, EVA_LIMITS } from './eva-card'
import { type Cell, type Grid, cellToLonLat } from './grid'
import { HAZARD_RADIUS_M } from './hazards'
import { DEFAULT_SUIT_FACTOR, MAX_SUIT_SPEED_KMH } from './route'
import { SCIENCE_STOP_MIN, type RouteSummary } from './summary'

export type BundleInput = {
  siteId: string
  grid: Grid
  stops: Cell[]
  hazards: Cell[]
  total: RouteSummary
  /** Walking plus science time at every stop after the start. */
  evaMin: number
  card: Pick<EvaCard, 'verdict' | 'tightestMarginMin' | 'failIndex'>
  limitDeg: number
  /** Minutes at each stop after the start; Emergency plans spend none. */
  stopMin?: number
  now?: Date
}

const place = (g: Grid, cell: Cell) => {
  const [lon, lat] = cellToLonLat(g, cell)
  return { lon: Number(lon.toFixed(4)), lat: Number(lat.toFixed(4)) }
}

export function buildBundle(b: BundleInput) {
  return {
    app: 'Martian Map',
    createdUtc: (b.now ?? new Date()).toISOString(),
    site: b.siteId,
    crs: 'IAU Mars 2000 (planetocentric latitude, east longitude)',
    stops: b.stops.map((c, i) => ({ label: i === 0 ? 'Start' : `Stop ${i}`, ...place(b.grid, c) })),
    hazards: b.hazards.map((c, i) => ({
      label: `Hazard ${i + 1}`,
      ...place(b.grid, c),
      keepOutM: HAZARD_RADIUS_M,
    })),
    route: {
      distanceM: Math.round(b.total.distanceM),
      ascentM: Math.round(b.total.ascentM),
      descentM: Math.round(b.total.descentM),
      maxSlopeDeg: Number(b.total.maxSlopeDeg.toFixed(1)),
      walkingMin: Math.round(b.total.durationMin),
      evaMin: Math.round(b.evaMin),
    },
    evaCheck: {
      verdict: b.card.verdict,
      tightestMarginMin: Math.round(b.card.tightestMarginMin),
      limits: EVA_LIMITS,
    },
    assumptions: {
      slopeLimitDeg: b.limitDeg,
      paceModel: "Tobler's hiking function x suit factor, capped",
      suitFactor: DEFAULT_SUIT_FACTOR,
      maxSpeedKmh: MAX_SUIT_SPEED_KMH,
      stopMin: b.stopMin ?? SCIENCE_STOP_MIN,
    },
    note:
      'Planning aid from the Martian Map demo. The pace, EVA limits and terrain error are team ' +
      'assumptions, not NASA values; terrain is a 20-32 m model that cannot see boulders.',
  }
}

export type PlanBundle = ReturnType<typeof buildBundle>
