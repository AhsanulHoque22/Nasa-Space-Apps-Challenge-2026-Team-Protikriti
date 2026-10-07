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

  it('floods the walking times out from a start and back to it', () => {
    const handle = createRouteService()
    handle({ type: 'grid', grid: flat })
    const reply = handle({ type: 'range', id: 4, start: { row: 0, col: 0 } })
    if (reply?.type !== 'range') throw new Error('expected range reply')
    expect(reply.id).toBe(4)
    expect(reply.outS).toHaveLength(9)
    expect(reply.backS).toHaveLength(9)
    expect(reply.outS[0]).toBe(0)
    expect(reply.outS[2]).toBeGreaterThan(0)
  })

  it('rejects a range request before a grid is loaded', () => {
    const reply = createRouteService()({ type: 'range', id: 5, start: { row: 0, col: 0 } })
    expect(reply).toMatchObject({ type: 'error', id: 5 })
  })

  it('routes around hazard cells and reports what the unhindered route would have been', () => {
    const open = makeGrid(Array.from({ length: 9 }, () => Array(9).fill(0)))
    const handle = createRouteService()
    handle({ type: 'grid', grid: open })
    const stops = [
      { row: 4, col: 0 },
      { row: 4, col: 8 },
    ]
    const clear = handle({ type: 'route', id: 1, stops })
    if (clear?.type !== 'route') throw new Error('expected route reply')
    expect(clear.baseline).toBeNull() // no hazards, nothing to compare with

    const reply = handle({ type: 'route', id: 2, stops, hazards: [{ row: 4, col: 4 }] })
    if (reply?.type !== 'route' || !reply.baseline) throw new Error('expected a baseline')
    expect(reply.baseline.hitsHazard).toBe(true)
    expect(reply.path?.some((c) => c.row === 4 && c.col === 4)).toBe(false)
    expect(reply.total?.distanceM).toBeGreaterThan(reply.baseline.total.distanceM)
  })

  it('says the route is unaffected when it already keeps clear of the hazards', () => {
    const open = makeGrid(Array.from({ length: 9 }, () => Array(9).fill(0)))
    const handle = createRouteService()
    handle({ type: 'grid', grid: open })
    const stops = [
      { row: 0, col: 0 },
      { row: 0, col: 8 },
    ]
    const reply = handle({ type: 'route', id: 3, stops, hazards: [{ row: 8, col: 4 }] })
    if (reply?.type !== 'route' || !reply.baseline) throw new Error('expected a baseline')
    expect(reply.baseline.hitsHazard).toBe(false)
  })

  it('says what slope limit would open a route when a leg has none', () => {
    const handle = createRouteService()
    handle({ type: 'grid', grid: makeGrid([[0, 0, 6, 6, 6]]) })
    const reply = handle({ type: 'route', id: 9, stops: stops(0, 4) })
    if (reply?.type !== 'route') throw new Error('expected route reply')
    expect(reply.path).toBeNull()
    expect(reply.needsDeg as number).toBeGreaterThan(16.6)
  })

  it('works out what the observer can see', () => {
    const handle = createRouteService()
    handle({ type: 'grid', grid: makeGrid([[0, 0, 12, 0]]) })
    const reply = handle({ type: 'sight', id: 11, observer: { row: 0, col: 0 } })
    if (reply?.type !== 'sight') throw new Error('expected sight reply')
    expect(Array.from(reply.visible)).toEqual([1, 1, 1, 0]) // the ridge hides the last cell
  })
})
