import { describe, expect, it } from 'vitest'
import { findRoute } from './route'
import { WALL, makeGrid } from './test-grids'
import { routeViaWaypoints } from './waypoints'

const flat = makeGrid(Array.from({ length: 3 }, () => [0, 0, 0, 0, 0]))

describe('routeViaWaypoints', () => {
  it('collinear stops give the same length as a single leg', () => {
    const stops = [
      { row: 1, col: 0 },
      { row: 1, col: 2 },
      { row: 1, col: 4 },
    ]
    const direct = findRoute(flat, { row: 1, col: 0 }, { row: 1, col: 4 })
    const result = routeViaWaypoints(flat, stops)
    expect(result?.path).toHaveLength(direct?.length ?? -1)
  })

  it('each join cell appears exactly once', () => {
    const stops = [
      { row: 0, col: 0 },
      { row: 2, col: 2 },
      { row: 0, col: 4 },
    ]
    const path = routeViaWaypoints(flat, stops)?.path ?? []
    const joins = path.filter((c) => c.row === 2 && c.col === 2)
    expect(joins).toHaveLength(1)
  })

  it('returns per-leg paths so each stop can be summarised', () => {
    const stops = [
      { row: 0, col: 0 },
      { row: 0, col: 2 },
      { row: 0, col: 4 },
    ]
    const result = routeViaWaypoints(flat, stops)
    expect(result?.legs).toHaveLength(2)
    expect(result?.legs[0]?.at(-1)).toEqual({ row: 0, col: 2 })
  })

  it('returns null with the failing leg index if any leg is blocked', () => {
    const walled = makeGrid([[0, 0, WALL, 0]])
    const stops = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 3 },
    ]
    expect(routeViaWaypoints(walled, stops)).toEqual({ path: null, legs: [], failedLeg: 1 })
  })

  it('a single stop is a zero-length route', () => {
    expect(routeViaWaypoints(flat, [{ row: 1, col: 1 }])?.path).toEqual([{ row: 1, col: 1 }])
  })
})
