import { describe, expect, it } from 'vitest'
import { buildBundle } from './bundle'
import { EVA_LIMITS } from './eva-card'
import { makeGrid } from './test-grids'

const g = {
  ...makeGrid([
    [0, 0, 0],
    [0, 0, 0],
  ]),
  west: 77,
  east: 78,
  north: 19,
  south: 18,
}
const total = {
  distanceM: 1234.56,
  ascentM: 10.4,
  descentM: 5.6,
  maxSlopeDeg: 6.234,
  durationMin: 20.5,
}
const input = {
  siteId: 'jezero',
  grid: g,
  stops: [
    { row: 0, col: 0 },
    { row: 1, col: 2 },
  ],
  hazards: [{ row: 0, col: 1 }],
  total,
  evaMin: 40.5,
  card: { verdict: 'GO' as const, tightestMarginMin: 300.4, failIndex: null },
  limitDeg: 15,
  now: new Date('2026-10-07T12:00:00Z'),
}

describe('buildBundle', () => {
  it('lists the stops and hazards with the position of each cell centre', () => {
    const b = buildBundle(input)
    expect(b.stops.map((s) => s.label)).toEqual(['Start', 'Stop 1'])
    expect(b.stops[0]).toMatchObject({ lon: 77.1667, lat: 18.75 }) // centre of cell (0,0), 3 cols x 2 rows
    expect(b.hazards[0]).toMatchObject({ label: 'Hazard 1', keepOutM: 60 })
  })

  it('rounds the route numbers sensibly and keeps the verdict', () => {
    const b = buildBundle(input)
    expect(b.route).toEqual({
      distanceM: 1235,
      ascentM: 10,
      descentM: 6,
      maxSlopeDeg: 6.2,
      walkingMin: 21,
      evaMin: 41,
    })
    expect(b.evaCheck).toMatchObject({ verdict: 'GO', tightestMarginMin: 300 })
  })

  it('records every assumption the numbers depend on, so they can be checked', () => {
    const b = buildBundle(input)
    expect(b.assumptions.slopeLimitDeg).toBe(15)
    expect(b.evaCheck.limits).toEqual(EVA_LIMITS)
    expect(b.assumptions.suitFactor).toBe(0.8)
    expect(b.assumptions.maxSpeedKmh).toBe(3.3)
    expect(b.note).toMatch(/planning aid/i)
  })

  it('states the coordinate frame and the time it was made', () => {
    const b = buildBundle(input)
    expect(b.crs).toMatch(/Mars 2000/)
    expect(b.createdUtc).toBe('2026-10-07T12:00:00.000Z')
    expect(b.site).toBe('jezero')
  })

  it('is plain JSON', () => {
    expect(JSON.parse(JSON.stringify(buildBundle(input)))).toEqual(buildBundle(input))
  })
})
