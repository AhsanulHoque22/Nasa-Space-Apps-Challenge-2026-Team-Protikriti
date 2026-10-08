/**
 * Walk patch: high-resolution ground around a site's walk start (2 m HiRISE stereo heights), so
 * walking on foot uses real metre-scale terrain instead of the 20-32 m site model.
 */
import type { Grid } from './grid'

export type WalkPatch = {
  grid: Grid
  start: { lon: number; lat: number }
  tiles: { minLevel: number; maxLevel: number; rect: [number, number, number, number] }
  source: string
}

type Meta = {
  width: number
  height: number
  west: number
  south: number
  east: number
  north: number
  start: { lon: number; lat: number }
  spacingM: number
  heightOffsetM: number
  heightStepM: number
  nodata: number
  maxSafeSlopeDeg: number
  tiles: WalkPatch['tiles']
  source: string
}

/** Validate walk.json + dem.bin (int16 LE steps above an offset) at the trust boundary. */
export function parseWalkPatch(raw: unknown, bin: ArrayBuffer): WalkPatch {
  const m = raw as Meta
  for (const k of ['width', 'height'] as const)
    if (!(Number.isInteger(m?.[k]) && m[k] > 0)) throw new Error(`walk.json: bad ${k}`)
  const cells = m.width * m.height
  if (bin.byteLength !== cells * 2)
    throw new Error(`walk dem.bin: ${bin.byteLength} B, expected ${cells * 2} (${cells} int16)`)
  const steps = new Int16Array(bin)
  const elevationM = new Float32Array(cells)
  for (let i = 0; i < cells; i++) {
    const s = steps[i] as number
    elevationM[i] = s === m.nodata ? NaN : m.heightOffsetM + s * m.heightStepM
  }
  return {
    grid: {
      width: m.width,
      height: m.height,
      west: m.west,
      south: m.south,
      east: m.east,
      north: m.north,
      pixelSizeM: m.spacingM,
      maxSafeSlopeDeg: m.maxSafeSlopeDeg,
      elevationM,
    },
    start: m.start,
    tiles: m.tiles,
    source: m.source,
  }
}

const M_PER_DEG = (3_396_190 * Math.PI) / 180

type Bounds = { west: number; south: number; east: number; north: number }
type HeightFn = (lon: number, lat: number) => number

/**
 * The fine surface inside `bounds`, blended into the coarse one over `featherM` at its edges, so
 * there is no cliff where two elevation models of different resolution (and datum) meet.
 */
export function feathered(
  fine: HeightFn,
  bounds: Bounds,
  coarse: HeightFn,
  featherM: number,
): HeightFn {
  return (lon, lat) => {
    const cosLat = Math.cos((lat * Math.PI) / 180)
    const insideM = Math.min(
      (lon - bounds.west) * M_PER_DEG * cosLat,
      (bounds.east - lon) * M_PER_DEG * cosLat,
      (lat - bounds.south) * M_PER_DEG,
      (bounds.north - lat) * M_PER_DEG,
    )
    if (insideM <= 0) return coarse(lon, lat)
    const f = fine(lon, lat)
    if (!Number.isFinite(f)) return coarse(lon, lat)
    const w = Math.min(1, insideM / featherM)
    return w === 1 ? f : w * f + (1 - w) * coarse(lon, lat)
  }
}
