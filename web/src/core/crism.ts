/** CRISM chemical hazard at a site: 0 (safe) to 1 (hazardous) per pixel. */

export type CrismGrid = {
  width: number
  height: number
  west: number
  south: number
  east: number
  north: number
  /** 2nd and 98th percentiles, for the colour stretch. */
  p02: number
  p98: number
  /** Row-major, north-up, [0, 1] hazard weight; NaN = no data. */
  values: Float32Array
}

const num = (m: Record<string, unknown>, key: string): number => {
  const v = m[key]
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error(`crism.json: "${key}" must be a finite number, got ${JSON.stringify(v)}`)
  }
  return v
}

/** Validate the pipeline's crism.json + crism.bin at the trust boundary. */
export function parseCrism(meta: unknown, bin: ArrayBuffer): CrismGrid {
  if (typeof meta !== 'object' || meta === null) throw new Error('crism.json: expected an object')
  const m = meta as Record<string, unknown>
  const width = num(m, 'width')
  const height = num(m, 'height')
  if (bin.byteLength !== width * height * 4) {
    throw new Error(`crism.bin size ${bin.byteLength} B does not match ${width}x${height} float32`)
  }
  return {
    width,
    height,
    west: num(m, 'west'),
    south: num(m, 'south'),
    east: num(m, 'east'),
    north: num(m, 'north'),
    p02: num(m, 'p02'),
    p98: num(m, 'p98'),
    values: new Float32Array(bin),
  }
}

/** Chemical hazard weight at a point, or null outside the grid or where there is no data. */
export function crismAt(g: CrismGrid, lon: number, lat: number): number | null {
  const col = Math.floor(((lon - g.west) / (g.east - g.west)) * g.width)
  const row = Math.floor(((g.north - lat) / (g.north - g.south)) * g.height)
  if (!(col >= 0 && col < g.width && row >= 0 && row < g.height)) return null
  const v = g.values[row * g.width + col] as number
  return Number.isNaN(v) ? null : v
}
