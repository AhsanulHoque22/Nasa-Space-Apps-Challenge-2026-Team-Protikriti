/** Message protocol for the routing Web Worker, kept pure so it can be unit-tested. */
import type { Cell, Grid } from './grid'
import { findRoute } from './route'
import { type RouteSummary, summarizeRoute } from './summary'

export type RouteRequest =
  | { type: 'grid'; grid: Grid }
  | { type: 'route'; id: number; start: Cell; goal: Cell; speedFactor?: number }

export type RouteReply =
  | { type: 'route'; id: number; path: Cell[] | null; summary: RouteSummary | null; ms: number }
  | { type: 'error'; id: number; message: string }

export function createRouteService(): (msg: RouteRequest) => RouteReply | undefined {
  let grid: Grid | undefined
  return (msg) => {
    if (msg.type === 'grid') {
      grid = msg.grid
      return undefined
    }
    if (!grid) return { type: 'error', id: msg.id, message: 'Terrain grid not loaded yet' }
    const t0 = performance.now()
    const path = findRoute(grid, msg.start, msg.goal, msg.speedFactor)
    const summary = path ? summarizeRoute(grid, path, msg.speedFactor) : null
    return { type: 'route', id: msg.id, path, summary, ms: performance.now() - t0 }
  }
}
