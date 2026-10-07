/** Message protocol for the routing Web Worker, kept pure so it can be unit-tested. */
import type { Cell, Grid } from './grid'
import { gentlestLimitDeg } from './blocker'
import { hazardMask, touchesHazard } from './hazards'
import { cellToLonLat } from './grid'
import { solarEnergyKwh } from './solar'
import { viewshed } from './viewshed'
import { passableCells, timesHomeS, travelTimesS } from './route'
import { type RouteSummary, summarizeRoute } from './summary'
import { routeViaWaypoints } from './waypoints'

export type RouteRequest =
  | { type: 'grid'; grid: Grid }
  | {
      type: 'route'
      id: number
      stops: Cell[]
      speedFactor?: number
      hazards?: Cell[]
      /** A different slope limit (e.g. a haul road's), in place of the walking limit. */
      limitDeg?: number
    }
  | { type: 'range'; id: number; start: Cell; hazards?: Cell[] }
  | { type: 'sight'; id: number; observer: Cell }
  | { type: 'solar'; id: number; utcMs: number }

export type RouteReply =
  | {
      type: 'route'
      id: number
      path: Cell[] | null
      total: RouteSummary | null
      legs: RouteSummary[]
      failedLeg?: number
      /** For a failed leg without hazards: the slope limit that would open a route, or null. */
      needsDeg?: number | null
      /** The route with no hazards, to compare against; null when no hazard is marked. */
      baseline: { path: Cell[]; total: RouteSummary; hitsHazard: boolean } | null
      /** Seconds of the fastest walk home from each point of `path` (hazards respected). */
      homeS: number[] | null
      ms: number
    }
  | { type: 'error'; id: number; message: string }

/** Seconds to walk out from `start` to every cell, and back from every cell to it. */
/** Clear-sky sunlight per cell over the sol starting at utcMs, kWh/m². */
export type SolarReply =
  | { type: 'solar'; id: number; kwh: Float32Array; ms: number }
  | { type: 'error'; id: number; message: string }

/** 1 where the observer can see a standing person (geometric line of sight). */
export type SightReply =
  | { type: 'sight'; id: number; visible: Uint8Array; ms: number }
  | { type: 'error'; id: number; message: string }

export type RangeReply =
  | { type: 'range'; id: number; outS: Float64Array; backS: Float64Array; ms: number }
  | { type: 'error'; id: number; message: string }

export function createRouteService(): (
  msg: RouteRequest,
) => RouteReply | RangeReply | SightReply | SolarReply | undefined {
  let grid: Grid | undefined
  // One grid object per slope limit, so passableCells' per-grid cache is reused across requests.
  const limited = new Map<number, Grid>()
  const withLimit = (base: Grid, limitDeg: number | undefined): Grid => {
    if (limitDeg === undefined || limitDeg === base.maxSafeSlopeDeg) return base
    let g = limited.get(limitDeg)
    if (!g) {
      g = { ...base, maxSafeSlopeDeg: limitDeg }
      limited.set(limitDeg, g)
    }
    return g
  }
  return (msg) => {
    if (msg.type === 'grid') {
      grid = msg.grid
      limited.clear()
      passableCells(grid) // precompute once so the first route request is not slower
      return undefined
    }
    if (!grid) return { type: 'error', id: msg.id, message: 'Terrain grid not loaded yet' }
    const g = msg.type === 'route' ? withLimit(grid, msg.limitDeg) : grid
    const t0 = performance.now()
    if (msg.type === 'solar') {
      // One sun position serves the whole site: it is ~11 km across.
      const [lon, lat] = cellToLonLat(g, { row: g.height >> 1, col: g.width >> 1 })
      const kwh = solarEnergyKwh(g, msg.utcMs, lon, lat)
      return { type: 'solar', id: msg.id, kwh, ms: performance.now() - t0 }
    }
    if (msg.type === 'sight') {
      return {
        type: 'sight',
        id: msg.id,
        visible: viewshed(g, msg.observer),
        ms: performance.now() - t0,
      }
    }
    if (msg.type === 'range') {
      const blocked = msg.hazards?.length ? hazardMask(g, msg.hazards) : undefined
      const outS = travelTimesS(g, msg.start, undefined, 'out', blocked)
      const backS = travelTimesS(g, msg.start, undefined, 'back', blocked)
      return { type: 'range', id: msg.id, outS, backS, ms: performance.now() - t0 }
    }
    const mask = msg.hazards?.length ? hazardMask(g, msg.hazards) : undefined
    const result = routeViaWaypoints(g, msg.stops, msg.speedFactor, mask)
    let baseline: Extract<RouteReply, { type: 'route' }>['baseline'] = null
    if (mask) {
      const free = routeViaWaypoints(g, msg.stops, msg.speedFactor)
      if (free.path) {
        baseline = {
          path: free.path,
          total: summarizeRoute(g, free.path, msg.speedFactor),
          hitsHazard: touchesHazard(free.path, g.width, mask),
        }
      }
    }
    const ms = performance.now() - t0
    if (result.path === null) {
      const from = msg.stops[result.failedLeg]
      const to = msg.stops[result.failedLeg + 1]
      const terrainBlocked = !baseline && from && to
      const needsDeg = terrainBlocked ? gentlestLimitDeg(g, from, to, msg.speedFactor) : undefined
      return {
        type: 'route',
        id: msg.id,
        path: null,
        total: null,
        legs: [],
        failedLeg: result.failedLeg,
        needsDeg,
        baseline,
        homeS: null,
        ms,
      }
    }
    return {
      type: 'route',
      id: msg.id,
      path: result.path,
      total: summarizeRoute(g, result.path, msg.speedFactor),
      legs: result.legs.map((leg) => summarizeRoute(g, leg, msg.speedFactor)),
      baseline,
      homeS: timesHomeS(g, msg.stops[0] as Cell, result.path, msg.speedFactor, mask),
      ms,
    }
  }
}
