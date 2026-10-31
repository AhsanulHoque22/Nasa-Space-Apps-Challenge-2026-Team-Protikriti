import { describe, expect, it } from 'vitest'
import { decodeFineTile, fineGrid, fineHeight, fineTileXY, parseFineIndex } from './fine-terrain'

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

describe('fineGrid', () => {
  // One level-15 tile of 2 x 2 samples: west half 100 m, east half 200 m; a box inside it.
  const index = parseFineIndex({ ...raw, tiles: { '10/20': 0 } })
  const tile = decodeFineTile(index, 10, 20, new Int16Array([5000, 10000, 5000, 10000]).buffer)
  const west = -180 + 10 * DEG
  const north = 90 - 20 * DEG
  const like = {
    width: 1,
    height: 1,
    pixelSizeM: 2,
    maxSafeSlopeDeg: 15,
    elevationM: new Float32Array([0]),
    west: west + DEG * 0.1,
    east: west + DEG * 0.3,
    north: north - DEG * 0.4,
    south: north - DEG * 0.6,
  }

  it('samples the tiles at 1 m over the box, keeping its bounds and slope limit', () => {
    const g = fineGrid(index, new Map([['10/20', tile]]), like, () => -1)
    expect(g.pixelSizeM).toBe(1)
    expect([g.west, g.east, g.north, g.south, g.maxSafeSlopeDeg]).toEqual([
      like.west,
      like.east,
      like.north,
      like.south,
      15,
    ])
    expect(g.height).toBe(Math.round(DEG * 0.2 * ((Math.PI * 3_396_190) / 180)))
    expect(g.elevationM[0]).toBe(100) // west part of the box lies in the 100 m half
  })

  it('fills cells with no tile from the fallback ground', () => {
    const g = fineGrid(index, new Map(), like, () => -1)
    expect(g.elevationM.every((h) => h === -1)).toBe(true)
  })
})
