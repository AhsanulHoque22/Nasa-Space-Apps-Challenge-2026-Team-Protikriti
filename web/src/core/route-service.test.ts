import { describe, expect, it } from 'vitest'
import { createRouteService } from './route-service'
import { WALL, makeGrid } from './test-grids'

const flat = makeGrid(Array.from({ length: 3 }, () => [0, 0, 0]))
const stops = (...cols: number[]) => cols.map((col) => ({ row: 0, col }))

describe('route service (worker protocol)', () => {
  it('rejects a route request before a grid is loaded', () => {
    const reply = createRouteService()({ type: 'route', id: 1, stops: stops(0, 2) })
    expect(reply).toMatchObject({ type: 'error', id: 1 })
  })

  it('returns path, total and per-leg summaries for the matching id', () => {
    const handle = createRouteService()
    expect(handle({ type: 'grid', grid: flat })).toBeUndefined()
    const reply = handle({ type: 'route', id: 7, stops: stops(0, 1, 2) })
    if (reply?.type !== 'route') throw new Error('expected route reply')
    expect(reply.id).toBe(7)
    expect(reply.path).toHaveLength(3)
    expect(reply.total?.distanceM).toBe(40)
    expect(reply.legs.map((l) => l.distanceM)).toEqual([20, 20])
  })

  it('reports which leg has no safe route', () => {
    const handle = createRouteService()
    handle({ type: 'grid', grid: makeGrid([[0, 0, 0, WALL, 0]]) })
    const reply = handle({ type: 'route', id: 2, stops: stops(0, 1, 4) })
    expect(reply).toMatchObject({ type: 'route', id: 2, path: null, total: null, failedLeg: 1 })
  })
})
