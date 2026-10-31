/**
 * Fine terrain: 1 m HiRISE DTM tiles (pipeline `fine`), used on foot only: Explore loads every
 * tile around the walk at once and walks on a single 1 m grid, so the ground never changes under
 * markers or the walker. The map keeps the 2 m walk patches and the 5-32 m site grids.
 */
import { sampleGrid } from './elevation'
import type { Grid } from './grid'

export type FineIndex = {
  level: number
  samples: number
  heightStepM: number
  nodata: number
  sources: Record<string, string>
  /** "x/y" of every tile written, to its height offset (m). */
  tiles: Map<string, number>
}

type HeightFn = (lon: number, lat: number) => number
type TileXY = { x: number; y: number }

const ROUTE_SLOPE_DEG = 15 // unused by the view; Grid needs one

/** Validate terrain/index.json at the trust boundary (it comes from the laptop CDN). */
export function parseFineIndex(raw: unknown): FineIndex {
  if (typeof raw !== 'object' || raw === null) throw new Error('fine terrain index: not JSON')
  const m = raw as Record<string, unknown>
  for (const k of ['level', 'samples'] as const)
    if (!(Number.isInteger(m[k]) && (m[k] as number) > 0))
      throw new Error(`fine terrain index: bad ${k}`)
  if (typeof m.heightStepM !== 'number' || typeof m.nodata !== 'number')
    throw new Error('fine terrain index: bad height encoding')
  if (typeof m.tiles !== 'object' || m.tiles === null)
    throw new Error('fine terrain index: no tiles')
  return {
    level: m.level as number,
    samples: m.samples as number,
    heightStepM: m.heightStepM,
    nodata: m.nodata,
    sources: (m.sources ?? {}) as Record<string, string>,
    tiles: new Map(Object.entries(m.tiles as Record<string, number>)),
  }
}

const tileDeg = (level: number) => 180 / 2 ** level

/** The Cesium geographic tile at `level` under a point. */
export function fineTileXY(level: number, lon: number, lat: number): TileXY {
  const deg = tileDeg(level)
  return { x: Math.floor((lon + 180) / deg), y: Math.floor((90 - lat) / deg) }
}

/** A tile's int16 LE steps as a north-up grid over the tile, nodata as NaN. */
export function decodeFineTile(index: FineIndex, x: number, y: number, bin: ArrayBuffer): Grid {
  const n = index.samples
  if (bin.byteLength !== n * n * 2)
    throw new Error(`fine terrain tile ${x}/${y}: ${bin.byteLength} B, expected ${n * n * 2}`)
  const offset = index.tiles.get(`${x}/${y}`) ?? 0
  const steps = new Int16Array(bin)
  const elevationM = new Float32Array(n * n)
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i] as number
    elevationM[i] = s === index.nodata ? NaN : offset + s * index.heightStepM
  }
  const deg = tileDeg(index.level)
  const west = -180 + x * deg
  const north = 90 - y * deg
  return {
    width: n,
    height: n,
    pixelSizeM: (deg * Math.PI * 3_396_190) / 180 / n,
    west,
    north,
    east: west + deg,
    south: north - deg,
    maxSafeSlopeDeg: ROUTE_SLOPE_DEG,
    elevationM,
  }
}

/**
 * Heights from loaded fine tiles, the coarse ground elsewhere. No feathering at the DTM's edge:
 * the site grids are made from the same DTMs (Jezero's CTX model agrees to a few metres).
 */
export function fineHeight(
  lookup: (x: number, y: number) => Grid | undefined,
  level: number,
  coarse: HeightFn,
): HeightFn {
  return (lon, lat) => {
    const { x, y } = fineTileXY(level, lon, lat)
    const tile = lookup(x, y)
    const h = tile ? sampleGrid(tile, lon, lat) : NaN
    return Number.isFinite(h) ? h : coarse(lon, lat)
  }
}

const M_PER_DEG = (Math.PI * 3_396_190) / 180

/**
 * One 1 m grid over `like`'s bounds (cell centres) from the loaded tiles; cells with no tile or no
 * data take `fallback` (the 2 m walk patch), so the grid has no holes.
 */
export function fineGrid(
  index: FineIndex,
  tiles: ReadonlyMap<string, Grid>,
  like: Grid,
  fallback: HeightFn,
): Grid {
  const { west, east, north, south } = like
  const midLat = ((north + south) / 2) * (Math.PI / 180)
  const height = Math.max(1, Math.round((north - south) * M_PER_DEG))
  const width = Math.max(1, Math.round((east - west) * M_PER_DEG * Math.cos(midLat)))
  const sample = fineHeight((x, y) => tiles.get(`${x}/${y}`), index.level, fallback)
  const elevationM = new Float32Array(width * height)
  const dLon = (east - west) / width
  const dLat = (north - south) / height
  for (let r = 0; r < height; r++) {
    const lat = north - (r + 0.5) * dLat
    for (let c = 0; c < width; c++) elevationM[r * width + c] = sample(west + (c + 0.5) * dLon, lat)
  }
  return {
    width,
    height,
    pixelSizeM: 1,
    west,
    east,
    north,
    south,
    maxSafeSlopeDeg: like.maxSafeSlopeDeg,
    elevationM,
  }
}
