import { describe, expect, it } from 'vitest'
import { type Site, elevationAt, parseMola, sampleGrid, siteAt } from './elevation'
import { makeGrid } from './test-grids'

// makeGrid spans lon 0..1, lat 0..1
const jezero: Site = {
  id: 'j',
  name: 'J',
  rover: 'Perseverance',
  source: 'CTX',
  grid: makeGrid([
    [-2600, -2500],
    [-2400, -2300],
  ]),
}
const mola = parseMola(
  { width: 4, height: 2, west: -180, north: 90, east: 180, south: -90 },
  new Int16Array([100, 200, 300, 400, -100, -200, -300, -400]).buffer,
)

describe('sampleGrid', () => {
  it('interpolates bilinearly between cell centres and clamps outside', () => {
    expect(sampleGrid(jezero.grid, 0.5, 0.5)).toBeCloseTo(-2450)
    expect(sampleGrid(jezero.grid, -5, 5)).toBe(-2600)
  })
})

describe('siteAt', () => {
  it('finds the site whose bounds contain the point', () => {
    expect(siteAt([jezero], 0.5, 0.5)?.id).toBe('j')
    expect(siteAt([jezero], 2, 2)).toBeUndefined()
  })
})

describe('elevationAt', () => {
  it('prefers the site DEM inside a site', () => {
    expect(elevationAt([jezero], mola, 0.25, 0.75)).toEqual({ m: -2600, source: 'CTX' })
  })
  it('falls back to global MOLA elsewhere', () => {
    const e = elevationAt([jezero], mola, -135, 45)
    expect(e.source).toMatch(/MOLA/)
    expect(e.m).toBe(100) // first MOLA cell centre: lon -135, lat 45
  })
})

describe('parseMola', () => {
  it('rejects a size mismatch', () => {
    expect(() =>
      parseMola(
        { width: 4, height: 2, west: -180, north: 90, east: 180, south: -90 },
        new ArrayBuffer(4),
      ),
    ).toThrow(/size/)
  })
})
