/** Elevation anywhere on Mars: high-resolution site DEMs where we have them, global MOLA elsewhere. */
import type { Grid } from './grid'

export type Site = { id: string; name: string; rover: string; source: string; grid: Grid }

const MARS_RADIUS_M = 3_396_190
export const MOLA_SOURCE = 'MGS MOLA global topography (4 px/deg)'

/** Bilinear height at (lon, lat) on a grid; clamps to the edge outside it; never NaN if any data. */
export function sampleGrid(g: Grid, lon: number, lat: number): number {
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
  for (const [row, col] of corners) {
    const v = g.elevationM[row * g.width + col]
    if (!Number.isNaN(v)) return v
  }
  return NaN
}

export function siteAt(sites: readonly Site[], lon: number, lat: number): Site | undefined {
  return sites.find(
    (s) => lon >= s.grid.west && lon <= s.grid.east && lat >= s.grid.south && lat <= s.grid.north,
  )
}

export function elevationAt(
  sites: readonly Site[],
  mola: Grid,
  lon: number,
  lat: number,
): { m: number; source: string } {
  const site = siteAt(sites, lon, lat)
  if (site) {
    const m = sampleGrid(site.grid, lon, lat)
    if (!Number.isNaN(m)) return { m, source: site.source }
  }
  return { m: sampleGrid(mola, lon, lat), source: MOLA_SOURCE }
}

/** MOLA MEGDR (int16 metres, lon -180..180, north-up) as a Grid. */
export function parseMola(
  meta: { width: number; height: number; west: number; north: number; east: number; south: number },
  bin: ArrayBuffer,
): Grid {
  const { width, height } = meta
  if (bin.byteLength !== width * height * Int16Array.BYTES_PER_ELEMENT)
    throw new Error(`mola.bin size ${bin.byteLength} B does not match ${width}x${height} int16`)
  return {
    ...meta,
    pixelSizeM: (((meta.east - meta.west) / width) * Math.PI * MARS_RADIUS_M) / 180,
    maxSafeSlopeDeg: Infinity, // global context only; never used for routing
    elevationM: Float32Array.from(new Int16Array(bin)),
  }
}
