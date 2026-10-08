import { describe, expect, it } from 'vitest'
import { feathered, parseWalkPatch } from './walk-patch'

const meta = {
  width: 3,
  height: 2,
  west: 77,
  south: 18,
  east: 77.003,
  north: 18.002,
  start: { lon: 77.0015, lat: 18.001 },
  spacingM: 2,
  heightOffsetM: -2500,
  heightStepM: 0.02,
  nodata: -32768,
  maxSafeSlopeDeg: 15,
  tiles: { minLevel: 13, maxLevel: 17, rect: [77, 18, 77.003, 18.002] },
  source: 'test',
}

const bin = (values: number[]) => new Int16Array(values).buffer

describe('parseWalkPatch', () => {
  it('decodes heights and turns nodata into NaN', () => {
    const p = parseWalkPatch(meta, bin([0, 50, -50, 100, -32768, 1]))
    expect(Array.from(p.grid.elevationM.slice(0, 4))).toEqual([-2500, -2499, -2501, -2498])
    expect(p.grid.elevationM[4]).toBeNaN()
    expect(p.grid.pixelSizeM).toBe(2)
    expect(p.grid.maxSafeSlopeDeg).toBe(15)
    expect(p.start).toEqual({ lon: 77.0015, lat: 18.001 })
  })

  it('refuses a file whose size does not match its metadata', () => {
    expect(() => parseWalkPatch(meta, bin([1, 2, 3]))).toThrow(/6/)
  })

  it('refuses metadata without a positive size', () => {
    expect(() => parseWalkPatch({ ...meta, width: 0 }, bin([]))).toThrow(/width/)
  })
})

describe('feathered', () => {
  // A 1 x 1 degree square of fine heights at 10 m over coarse ground at 0 m.
  const fine = (lon: number, lat: number) =>
    lon >= 0 && lon <= 1 && lat >= 0 && lat <= 1 ? 10 : NaN
  const coarse = () => 0
  const bounds = { west: 0, south: 0, east: 1, north: 1 }
  const M_PER_DEG = (3_396_190 * Math.PI) / 180
  const h = feathered(fine, bounds, coarse, 0.1 * M_PER_DEG) // feather over 0.1 degree

  it('is the fine surface well inside, and the coarse one outside', () => {
    expect(h(0.5, 0.5)).toBe(10)
    expect(h(2, 2)).toBe(0)
  })

  it('blends across the feather band at the edge, with no step', () => {
    expect(h(0.0, 0.5)).toBeCloseTo(0)
    expect(h(0.05, 0.5)).toBeCloseTo(5, 0)
    expect(h(0.1, 0.5)).toBeCloseTo(10)
  })

  it('falls back to the coarse surface where the fine one has no data', () => {
    const holey = feathered(() => NaN, bounds, coarse, 1000)
    expect(holey(0.5, 0.5)).toBe(0)
  })
})
