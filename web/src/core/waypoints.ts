/** Multi-stop Marswalk: chain the fastest safe route between consecutive stops. */
import type { Cell, Grid } from './grid'
import { DEFAULT_SUIT_FACTOR, findRoute } from './route'

export type WaypointRoute =
  { path: Cell[]; legs: Cell[][] } | { path: null; legs: []; failedLeg: number }

export function routeViaWaypoints(
  g: Grid,
  stops: Cell[],
  speedFactor = DEFAULT_SUIT_FACTOR,
): WaypointRoute {
  if (stops.length === 0) return { path: null, legs: [], failedLeg: 0 }
  const legs: Cell[][] = []
  const path: Cell[] = [stops[0]]
  for (let i = 1; i < stops.length; i++) {
    const leg = findRoute(g, stops[i - 1], stops[i], speedFactor)
    if (!leg) return { path: null, legs: [], failedLeg: i - 1 } // zero-based leg index
    legs.push(leg)
    path.push(...leg.slice(1)) // leg starts where the previous one ended
  }
  return { path, legs }
}
