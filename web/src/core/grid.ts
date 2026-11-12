/** Elevation grid produced by the pipeline (grid.json + grid.bin). Equirectangular over the AOI. */

export type Cell = { row: number; col: number }

export interface Grid {
  width: number
  height: number
  pixelSizeM: number
  west: number
  north: number
  east: number
  south: number
  maxSafeSlopeDeg: number
  /** Row-major, north-up, metres; NaN = nodata. */
  elevationM: Float32Array
}

function numberField(meta: Record<string, unknown>, key: string): number {
  const value = meta[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`grid.json: "${key}" must be a finite number, got ${JSON.stringify(value)}`)
  }
  return value
}

/** Validate pipeline output at the trust boundary. Throws with an actionable message. */
export function parseGrid(meta: unknown, bin: ArrayBuffer): Grid {
  const grid = emptyGrid(meta)
  fillHeights(grid, meta, bin)
  return grid
}

function metaObject(meta: unknown): Record<string, unknown> {
  if (typeof meta !== 'object' || meta === null) throw new Error('grid.json: expected an object')
  return meta as Record<string, unknown>
}

/**
 * The grid from grid.json alone, every height NaN (nodata) until fillHeights. grid.json is under
 * 1 kB, so the app knows every site's bounds at start and downloads heights only for sites it shows.
 */
export function emptyGrid(meta: unknown): Grid {
  const m = metaObject(meta)
  const width = numberField(m, 'width')
  const height = numberField(m, 'height')
  return {
    width,
    height,
    pixelSizeM: numberField(m, 'pixel_size_m'),
    west: numberField(m, 'west'),
    north: numberField(m, 'north'),
    east: numberField(m, 'east'),
    south: numberField(m, 'south'),
    maxSafeSlopeDeg: numberField(m, 'max_safe_slope_deg'),
    elevationM: new Float32Array(width * height).fill(NaN),
  }
}

/** Decode grid.bin into grid.elevationM in place, so code holding the grid sees the heights. */
export function fillHeights(grid: Grid, meta: unknown, bin: ArrayBuffer): void {
  const m = metaObject(meta)
  // int16 steps above an offset (pipeline export_grid): half the bytes of float32 to download.
  const offsetM = numberField(m, 'height_offset_m')
  const stepM = numberField(m, 'height_step_m')
  const nodata = numberField(m, 'nodata')
  if (bin.byteLength !== grid.width * grid.height * Int16Array.BYTES_PER_ELEMENT) {
    throw new Error(
      `grid.bin size ${bin.byteLength} B does not match ${grid.width}x${grid.height} int16`,
    )
  }
  const steps = new Int16Array(bin)
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i] as number
    grid.elevationM[i] = s === nodata ? NaN : offsetM + s * stepM
  }
}

export function elevationAt(g: Grid, c: Cell): number {
  if (c.row < 0 || c.row >= g.height || c.col < 0 || c.col >= g.width) return NaN
  return g.elevationM[c.row * g.width + c.col]
}

/** Cell containing (lon, lat), or null if outside the AOI or on nodata. */
export function lonLatToCell(g: Grid, lon: number, lat: number): Cell | null {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null
  const col = Math.floor(((lon - g.west) / (g.east - g.west)) * g.width)
  const row = Math.floor(((g.north - lat) / (g.north - g.south)) * g.height)
  if (col < 0 || col >= g.width || row < 0 || row >= g.height) return null
  const cell = { row, col }
  return Number.isNaN(elevationAt(g, cell)) ? null : cell
}

/** Centre of a cell as [lon, lat]. */
export function cellToLonLat(g: Grid, c: Cell): [number, number] {
  const lon = g.west + ((c.col + 0.5) / g.width) * (g.east - g.west)
  const lat = g.north - ((c.row + 0.5) / g.height) * (g.north - g.south)
  return [lon, lat]
}
