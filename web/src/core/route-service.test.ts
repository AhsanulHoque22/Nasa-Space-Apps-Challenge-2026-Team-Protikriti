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

  it('keeps the walking range out of hazard keep-outs, like the route', () => {
    const open = makeGrid([Array(12).fill(0)]) // one row, 20 m cells
    const handle = createRouteService()
    handle({ type: 'grid', grid: open })
    const start = { row: 0, col: 0 }
    const free = handle({ type: 'range', id: 1, start })
    const blocked = handle({ type: 'range', id: 2, start, hazards: [{ row: 0, col: 6 }] })
    if (free?.type !== 'range' || blocked?.type !== 'range')
      throw new Error('expected range replies')
    expect(Number.isFinite(free.outS[11])).toBe(true)
    expect(blocked.outS[11]).toBe(Infinity) // the only way east runs through the hazard
    expect(blocked.backS[11]).toBe(Infinity)
    expect(blocked.outS[2]).toBe(free.outS[2]) // ground short of the keep-out is unchanged
  })

  it('sends the fastest walk home from every point of the route', () => {
    const handle = createRouteService()
    handle({ type: 'grid', grid: makeGrid([Array(10).fill(0)]) })
    const reply = handle({ type: 'route', id: 3, stops: stops(0, 8, 1) })
    if (reply?.type !== 'route' || !reply.path) throw new Error('expected a route')
    expect(reply.homeS).toHaveLength(reply.path.length)
    expect(reply.homeS?.[0]).toBe(0)
    const last = reply.homeS?.at(-1) as number
    expect(last).toBeLessThan(reply.homeS?.[8] as number) // the last stop is next to home
  })

  it('works out a sol of sunlight on the terrain', () => {
    const handle = createRouteService()
    handle({
      type: 'grid',
      grid: makeGrid([
        [0, 0, 0],
        [0, 0, 0],
      ]),
    })
    const reply = handle({ type: 'solar', id: 12, utcMs: Date.UTC(2025, 5, 1) })
    if (reply?.type !== 'solar') throw new Error('expected solar reply')
    expect(reply.kwh).toHaveLength(6)
    expect(reply.kwh[0]).toBeGreaterThan(0)
  })

  it('routes under a stricter limit when asked (haul roads), and says what it would need', () => {
    const handle = createRouteService()
    handle({ type: 'grid', grid: makeGrid([[0, 4, 8]]) }) // ~11° all along: fine on foot
    const walk = handle({ type: 'route', id: 5, stops: stops(0, 2) })
    expect(walk).toMatchObject({ type: 'route', id: 5 })
    if (walk?.type !== 'route') throw new Error('expected route reply')
    expect(walk.path).not.toBeNull()
    const haul = handle({ type: 'route', id: 6, stops: stops(0, 2), limitDeg: 5 })
    if (haul?.type !== 'route') throw new Error('expected route reply')
    expect(haul.path).toBeNull()
    expect(haul.needsDeg).toBeGreaterThan(5)
    expect(haul.needsDeg).toBeLessThan(15)
  })
})
