import { describe, expect, it } from 'vitest'
import { createRouteService } from './route-service'
import { WALL, makeGrid } from './test-grids'

const flat = makeGrid(Array.from({ length: 3 }, () => [0, 0, 0]))

describe('route service (worker protocol)', () => {
  it('rejects a route request before a grid is loaded', () => {
    const handle = createRouteService()
    const reply = handle({
      type: 'route',
      id: 1,
      start: { row: 0, col: 0 },
      goal: { row: 0, col: 2 },
    })
    expect(reply).toMatchObject({ type: 'error', id: 1 })
  })

  it('returns path and summary for the matching request id', () => {
    const handle = createRouteService()
    expect(handle({ type: 'grid', grid: flat })).toBeUndefined()
    const reply = handle({
      type: 'route',
      id: 7,
      start: { row: 0, col: 0 },
      goal: { row: 0, col: 2 },
    })
    expect(reply).toMatchObject({ type: 'route', id: 7 })
    if (reply?.type !== 'route') throw new Error('expected route reply')
    expect(reply.path).toHaveLength(3)
    expect(reply.summary?.distanceM).toBe(40)
  })

  it('reports no safe route with a null path and summary', () => {
    const walled = makeGrid([[0, WALL, 0]])
    const handle = createRouteService()
    handle({ type: 'grid', grid: walled })
    const reply = handle({
      type: 'route',
      id: 2,
      start: { row: 0, col: 0 },
      goal: { row: 0, col: 2 },
    })
    expect(reply).toMatchObject({ type: 'route', id: 2, path: null, summary: null })
  })
})
