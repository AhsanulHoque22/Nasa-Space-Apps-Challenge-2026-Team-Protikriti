/** Cesium terrain built from the pipeline elevation grid. */
import { CustomHeightmapTerrainProvider, GeographicTilingScheme } from 'cesium'
import type { Grid } from '../core/grid'
import { MARS_SPHERE } from './mars'

const HEIGHTMAP_SIZE = 32 // samples per tile edge

export type DegreeRect = { west: number; south: number; east: number; north: number }

const fallbackCache = new WeakMap<Grid, number>()

/** Mean of valid elevations: used only where every neighbouring cell is nodata. */
function fallbackHeight(g: Grid): number {
  let cached = fallbackCache.get(g)
  if (cached === undefined) {
    let sum = 0
    let count = 0
    for (const v of g.elevationM) {
      if (Number.isNaN(v)) continue
      sum += v
      count++
    }
    cached = count > 0 ? sum / count : 0
    fallbackCache.set(g, cached)
  }
  return cached
}

/** Bilinear height at (lon, lat); clamps to the grid edge outside the AOI; never NaN. */
function heightAt(g: Grid, lon: number, lat: number): number {
  const clamp = (v: number, max: number) => Math.min(Math.max(v, 0), max)
  const fc = clamp(((lon - g.west) / (g.east - g.west)) * g.width - 0.5, g.width - 1)
  const fr = clamp(((g.north - lat) / (g.north - g.south)) * g.height - 0.5, g.height - 1)
  const c0 = Math.floor(fc)
  const r0 = Math.floor(fr)
  const c1 = Math.min(c0 + 1, g.width - 1)
  const r1 = Math.min(r0 + 1, g.height - 1)
  const tc = fc - c0
  const tr = fr - r0
  const corners: ReadonlyArray<readonly [number, number, number]> = [
    [r0, c0, (1 - tr) * (1 - tc)],
    [r0, c1, (1 - tr) * tc],
    [r1, c0, tr * (1 - tc)],
    [r1, c1, tr * tc],
  ]
  let sum = 0
  let weight = 0
  for (const [row, col, w] of corners) {
    const v = g.elevationM[row * g.width + col]
    if (Number.isNaN(v) || w === 0) continue
    sum += v * w
    weight += w
  }
  if (weight > 0) return sum / weight
  // Sample sits exactly on a nodata cell centre: use any valid neighbour, else the grid mean.
  for (const [row, col] of corners) {
    const v = g.elevationM[row * g.width + col]
    if (!Number.isNaN(v)) return v
  }
  return fallbackHeight(g)
}

/** size x size heights over rect (edges inclusive), row-major from north to south. */
export function sampleHeights(g: Grid, rect: DegreeRect, size: number): Float32Array {
  const heights = new Float32Array(size * size)
  const step = (span: number) => (size > 1 ? span / (size - 1) : 0)
  const dLon = step(rect.east - rect.west)
  const dLat = step(rect.north - rect.south)
  for (let row = 0; row < size; row++)
    for (let col = 0; col < size; col++)
      heights[row * size + col] = heightAt(g, rect.west + col * dLon, rect.north - row * dLat)
  return heights
}

export function createGridTerrain(g: Grid): CustomHeightmapTerrainProvider {
  const tilingScheme = new GeographicTilingScheme({ ellipsoid: MARS_SPHERE })
  const toDeg = 180 / Math.PI
  return new CustomHeightmapTerrainProvider({
    width: HEIGHTMAP_SIZE,
    height: HEIGHTMAP_SIZE,
    tilingScheme,
    callback: (x, y, level) => {
      const r = tilingScheme.tileXYToRectangle(x, y, level)
      const rect = {
        west: r.west * toDeg,
        south: r.south * toDeg,
        east: r.east * toDeg,
        north: r.north * toDeg,
      }
      return sampleHeights(g, rect, HEIGHTMAP_SIZE)
    },
  })
}
