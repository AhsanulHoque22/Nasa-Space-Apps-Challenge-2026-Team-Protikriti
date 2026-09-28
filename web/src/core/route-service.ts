/** Message protocol for the routing Web Worker, kept pure so it can be unit-tested. */
import type { Cell, Grid } from './grid'
import { type RouteSummary, summarizeRoute } from './summary'
import { routeViaWaypoints } from './waypoints'

export type RouteRequest =
  { type: 'grid'; grid: Grid } | { type: 'route'; id: number; stops: Cell[]; speedFactor?: number }

export type RouteReply =
  | {
      type: 'route'
      id: number
      path: Cell[] | null
      total: RouteSummary | null
      legs: RouteSummary[]
      failedLeg?: number
      ms: number
    }
  | { type: 'error'; id: number; message: string }

export function createRouteService(): (msg: RouteRequest) => RouteReply | undefined {
  let grid: Grid | undefined
  return (msg) => {
    if (msg.type === 'grid') {
      grid = msg.grid
      return undefined
    }
    if (!grid) return { type: 'error', id: msg.id, message: 'Terrain grid not loaded yet' }
    const g = grid
    const t0 = performance.now()
    const result = routeViaWaypoints(g, msg.stops, msg.speedFactor)
    const ms = performance.now() - t0
    if (result.path === null) {
      return {
        type: 'route',
        id: msg.id,
        path: null,
        total: null,
        legs: [],
        failedLeg: result.failedLeg,
        ms,
      }
    }
    return {
      type: 'route',
      id: msg.id,
      path: result.path,
      total: summarizeRoute(g, result.path, msg.speedFactor),
      legs: result.legs.map((leg) => summarizeRoute(g, leg, msg.speedFactor)),
      ms,
    }
  }
}
