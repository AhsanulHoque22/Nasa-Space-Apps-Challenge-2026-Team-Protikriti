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
  if (typeof meta !== 'object' || meta === null) throw new Error('grid.json: expected an object')
  const m = meta as Record<string, unknown>
  const width = numberField(m, 'width')
  const height = numberField(m, 'height')
  if (bin.byteLength !== width * height * Float32Array.BYTES_PER_ELEMENT) {
    throw new Error(`grid.bin size ${bin.byteLength} B does not match ${width}x${height} float32`)
  }
  return {
    width,
    height,
    pixelSizeM: numberField(m, 'pixel_size_m'),
    west: numberField(m, 'west'),
    north: numberField(m, 'north'),
    east: numberField(m, 'east'),
    south: numberField(m, 'south'),
    maxSafeSlopeDeg: numberField(m, 'max_safe_slope_deg'),
    elevationM: new Float32Array(bin),
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
