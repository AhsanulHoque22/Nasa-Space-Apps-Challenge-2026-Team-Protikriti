/** Cesium terrain from any height function: site DEMs where available, global MOLA elsewhere. */
import { CustomHeightmapTerrainProvider, GeographicTilingScheme } from 'cesium'
import { MARS_SPHERE } from './mars'

const HEIGHTMAP_SIZE = 32 // samples per tile edge

export type DegreeRect = { west: number; south: number; east: number; north: number }
export type HeightFn = (lon: number, lat: number) => number

/** size x size heights over rect (edges inclusive), row-major from north to south. NaN -> 0. */
export function sampleHeights(height: HeightFn, rect: DegreeRect, size: number): Float32Array {
  const heights = new Float32Array(size * size)
  const step = (span: number) => (size > 1 ? span / (size - 1) : 0)
  const dLon = step(rect.east - rect.west)
  const dLat = step(rect.north - rect.south)
  for (let row = 0; row < size; row++)
    for (let col = 0; col < size; col++) {
      const h = height(rect.west + col * dLon, rect.north - row * dLat)
      heights[row * size + col] = Number.isNaN(h) ? 0 : h
    }
  return heights
}

export function createTerrain(height: HeightFn): CustomHeightmapTerrainProvider {
  const tilingScheme = new GeographicTilingScheme({ ellipsoid: MARS_SPHERE })
  const toDeg = 180 / Math.PI
  return new CustomHeightmapTerrainProvider({
    width: HEIGHTMAP_SIZE,
    height: HEIGHTMAP_SIZE,
    tilingScheme,
    callback: (x, y, level) => {
      const r = tilingScheme.tileXYToRectangle(x, y, level)
      return sampleHeights(
        height,
        {
          west: r.west * toDeg,
          south: r.south * toDeg,
          east: r.east * toDeg,
          north: r.north * toDeg,
        },
        HEIGHTMAP_SIZE,
      )
    },
  })
}
