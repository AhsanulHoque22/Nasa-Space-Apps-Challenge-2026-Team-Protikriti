import { describe, expect, it } from 'vitest'
import { cellToLonLat, lonLatToCell, parseGrid } from './grid'

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
}

function bin(values: number[]): ArrayBuffer {
  return new Float32Array(values).buffer
}

const elevations = [0, 1, 2, 3, 4, 5, NaN, 7, 8, 9, 10, 11]

describe('parseGrid', () => {
  it('maps metadata to camelCase fields and keeps elevations', () => {
    const g = parseGrid(meta, bin(elevations))
    expect(g).toMatchObject({ width: 4, height: 3, pixelSizeM: 20, maxSafeSlopeDeg: 15 })
    expect(g.elevationM[5]).toBe(5)
  })

  it('rejects a binary whose size does not match width*height', () => {
    expect(() => parseGrid(meta, bin([1, 2, 3]))).toThrow(/size/)
  })

  it('rejects malformed metadata', () => {
    expect(() => parseGrid({ ...meta, width: 'four' }, bin(elevations))).toThrow(/width/)
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

  it('returns null on a nodata cell', () => {
    const [lon, lat] = cellToLonLat(g, { row: 1, col: 2 })
    expect(lonLatToCell(g, lon, lat)).toBeNull()
  })
})
