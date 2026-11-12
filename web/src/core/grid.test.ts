import { describe, expect, it } from 'vitest'
import { cellToLonLat, emptyGrid, fillHeights, lonLatToCell, parseGrid } from './grid'

const meta = {
  width: 4,
  height: 3,
  pixel_size_m: 20,
  west: 77.4,
  north: 18.5,
  east: 77.44,
  south: 18.47,
  crs: '+proj=eqc',
  max_safe_slope_deg: 15,
  height_offset_m: -2600,
  height_step_m: 0.5,
  nodata: -32768,
}

/** grid.bin as the pipeline writes it: int16 steps above the offset, nodata for NaN. */
function bin(values: number[]): ArrayBuffer {
  return Int16Array.from(values, (v) =>
    Number.isNaN(v) ? meta.nodata : (v - meta.height_offset_m) / meta.height_step_m,
  ).buffer
}

const elevations = [0, 1, 2, 3, 4, 5, NaN, 7, 8, 9, 10, 11].map((v) => -2600 + v / 2)

describe('parseGrid', () => {
  it('maps metadata to camelCase fields and keeps elevations', () => {
    const g = parseGrid(meta, bin(elevations))
    expect(g).toMatchObject({ width: 4, height: 3, pixelSizeM: 20, maxSafeSlopeDeg: 15 })
    expect(g.elevationM[5]).toBe(-2597.5)
    expect(g.elevationM[0]).toBe(-2600)
    expect(g.elevationM[6]).toBeNaN()
  })

  it('rejects metadata without the height encoding', () => {
    expect(() => parseGrid({ ...meta, height_step_m: undefined }, bin(elevations))).toThrow(
      /height_step_m/,
    )
  })

  it('rejects a binary whose size does not match width*height', () => {
    expect(() => parseGrid(meta, bin([1, 2, 3]))).toThrow(/size/)
  })

  it('rejects malformed metadata', () => {
    expect(() => parseGrid({ ...meta, width: 'four' }, bin(elevations))).toThrow(/width/)
  })
})

describe('emptyGrid + fillHeights', () => {
  it('starts as all nodata and fills the same array in place', () => {
    const g = emptyGrid(meta)
    const array = g.elevationM
    expect(g).toMatchObject({ width: 4, height: 3, west: 77.4 })
    expect([...g.elevationM].every(Number.isNaN)).toBe(true)
    fillHeights(g, meta, bin(elevations))
    expect(g.elevationM).toBe(array)
    expect(g.elevationM[5]).toBe(-2597.5)
    expect(g.elevationM[6]).toBeNaN()
  })

  it('rejects a binary of the wrong size', () => {
    expect(() => fillHeights(emptyGrid(meta), meta, bin([1, 2, 3]))).toThrow(/size/)
  })
})

describe('coordinates', () => {
  const g = parseGrid(meta, bin(elevations))

  it('round-trips every cell through its centre lon/lat', () => {
    for (let row = 0; row < g.height; row++)
      for (let col = 0; col < g.width; col++) {
        if (row === 1 && col === 2) continue // NaN cell
        const [lon, lat] = cellToLonLat(g, { row, col })
        expect(lonLatToCell(g, lon, lat)).toEqual({ row, col })
      }
  })

  it('cell (0,0) centre is half a cell in from the north-west corner', () => {
    const [lon, lat] = cellToLonLat(g, { row: 0, col: 0 })
    expect(lon).toBeCloseTo(77.405)
    expect(lat).toBeCloseTo(18.495)
  })

  it('returns null outside the AOI', () => {
    expect(lonLatToCell(g, 77.39, 18.49)).toBeNull()
    expect(lonLatToCell(g, 77.42, 18.51)).toBeNull()
    expect(lonLatToCell(g, 77.44, 18.49)).toBeNull() // east edge is exclusive
  })

  it('returns null for non-finite coordinates instead of a NaN cell', () => {
    expect(lonLatToCell(g, NaN, 18.49)).toBeNull()
    expect(lonLatToCell(g, 77.42, Infinity)).toBeNull()
  })

  it('returns null on a nodata cell', () => {
    const [lon, lat] = cellToLonLat(g, { row: 1, col: 2 })
    expect(lonLatToCell(g, lon, lat)).toBeNull()
  })
})
