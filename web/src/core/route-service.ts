/** Message protocol for the routing Web Worker, kept pure so it can be unit-tested. */
import type { Cell, Grid } from './grid'
import { passableCells, travelTimesS } from './route'
import { type RouteSummary, summarizeRoute } from './summary'
import { routeViaWaypoints } from './waypoints'

export type RouteRequest =
  | { type: 'grid'; grid: Grid }
  | { type: 'route'; id: number; stops: Cell[]; speedFactor?: number }
  | { type: 'range'; id: number; start: Cell }

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

/** Seconds to walk out from `start` to every cell, and back from every cell to it. */
export type RangeReply =
  | { type: 'range'; id: number; outS: Float64Array; backS: Float64Array; ms: number }
  | { type: 'error'; id: number; message: string }

export function createRouteService(): (msg: RouteRequest) => RouteReply | RangeReply | undefined {
  let grid: Grid | undefined
  return (msg) => {
    if (msg.type === 'grid') {
      grid = msg.grid
      passableCells(grid) // precompute once so the first route request is not slower
      return undefined
    }
    if (!grid) return { type: 'error', id: msg.id, message: 'Terrain grid not loaded yet' }
    const g = grid
    const t0 = performance.now()
    if (msg.type === 'range') {
      const outS = travelTimesS(g, msg.start)
      const backS = travelTimesS(g, msg.start, undefined, 'back')
      return { type: 'range', id: msg.id, outS, backS, ms: performance.now() - t0 }
    }
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
