import { describe, expect, it } from 'vitest'
import { decodeFineTile, fineHeight, fineTileOf, fineTileXY, parseFineIndex } from './fine-terrain'

const raw = {
  level: 15,
  samples: 2,
  heightStepM: 0.02,
  nodata: -32768,
  sources: { gale: 'USGS MSL Gale DEM Mosaic, 1 m' },
  tiles: { '10/20': -2500 },
}
const DEG = 180 / 2 ** 15

describe('parseFineIndex', () => {
  it('reads the tiles and their height offsets', () => {
    const index = parseFineIndex(raw)
    expect(index.level).toBe(15)
    expect(index.tiles.get('10/20')).toBe(-2500)
    expect(index.sources).toEqual(raw.sources)
  })

  it('rejects an index that is not from the pipeline', () => {
    expect(() => parseFineIndex({ ...raw, samples: 0 })).toThrow(/samples/)
    expect(() => parseFineIndex('<html>ngrok warning</html>')).toThrow(/index/)
  })
})

describe('fine tile lookup', () => {
  it('finds the Cesium geographic tile under a point', () => {
    expect(fineTileXY(15, -180 + 10.5 * DEG, 90 - 20.5 * DEG)).toEqual({ x: 10, y: 20 })
  })

  it('maps a deeper Cesium tile to the fine tile holding it, and none above the fine level', () => {
    expect(fineTileOf(15, 10 * 8 + 7, 20 * 8 + 3, 18)).toEqual({ x: 10, y: 20 })
    expect(fineTileOf(15, 10, 20, 15)).toEqual({ x: 10, y: 20 })
    expect(fineTileOf(15, 5, 10, 14)).toBeNull()
  })
})

describe('decodeFineTile', () => {
  it('turns int16 steps into a north-up grid over the tile, nodata as NaN', () => {
    const index = parseFineIndex(raw)
    const grid = decodeFineTile(index, 10, 20, new Int16Array([0, 50, -32768, 100]).buffer)
    expect(grid.west).toBeCloseTo(-180 + 10 * DEG, 12)
    expect(grid.north).toBeCloseTo(90 - 20 * DEG, 12)
    expect(grid.east - grid.west).toBeCloseTo(DEG, 12)
    expect([...grid.elevationM.slice(0, 2)]).toEqual([-2500, -2499])
    expect(grid.elevationM[2]).toBeNaN()
    expect(grid.elevationM[3]).toBeCloseTo(-2498, 6)
  })

  it('rejects a tile of the wrong size', () => {
    expect(() => decodeFineTile(parseFineIndex(raw), 10, 20, new ArrayBuffer(6))).toThrow(/8/)
  })
})

describe('fineHeight', () => {
  const index = parseFineIndex(raw)
  const tile = decodeFineTile(index, 10, 20, new Int16Array([0, 0, 0, -32768]).buffer)
  const lookup = (x: number, y: number) => (x === 10 && y === 20 ? tile : undefined)
  const height = fineHeight(lookup, 15, () => -9999)

  it('uses a loaded fine tile', () => {
    expect(height(-180 + 10.25 * DEG, 90 - 20.25 * DEG)).toBe(-2500)
  })

  it('falls back to the coarse ground off the loaded tiles and where the DTM has no data', () => {
    expect(height(-180 + 11.5 * DEG, 90 - 20.5 * DEG)).toBe(-9999)
    // The south-east sample is nodata: its corner falls back, between samples the others count.
    expect(height(-180 + 10.99 * DEG, 90 - 20.99 * DEG)).toBe(-9999)
    expect(height(-180 + 10.5 * DEG, 90 - 20.5 * DEG)).toBe(-2500)
  })
})
