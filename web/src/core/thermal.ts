/** THEMIS thermal inertia at a site: how loose (low) or firm and rocky (high) the ground is. */

export type ThermalGrid = {
  width: number
  height: number
  west: number
  south: number
  east: number
  north: number
  /** 2nd and 98th percentiles, for the colour stretch. */
  p02: number
  p98: number
  /** Row-major, north-up, J m-2 K-1 s-1/2; NaN = no data. */
  values: Float32Array
}

const num = (m: Record<string, unknown>, key: string): number => {
  const v = m[key]
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error(`thermal.json: "${key}" must be a finite number, got ${JSON.stringify(v)}`)
  }
  return v
}

/** Validate the pipeline's thermal.json + thermal.bin at the trust boundary. */
export function parseThermal(meta: unknown, bin: ArrayBuffer): ThermalGrid {
  if (typeof meta !== 'object' || meta === null) throw new Error('thermal.json: expected an object')
  const m = meta as Record<string, unknown>
  const width = num(m, 'width')
  const height = num(m, 'height')
  if (bin.byteLength !== width * height * 4) {
    throw new Error(
      `thermal.bin size ${bin.byteLength} B does not match ${width}x${height} float32`,
    )
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

/** Thermal inertia at a point, or null outside the grid or where there is no data. */
export function thermalAt(t: ThermalGrid, lon: number, lat: number): number | null {
  const col = Math.floor(((lon - t.west) / (t.east - t.west)) * t.width)
  const row = Math.floor(((t.north - lat) / (t.north - t.south)) * t.height)
  if (!(col >= 0 && col < t.width && row >= 0 && row < t.height)) return null
  const v = t.values[row * t.width + col] as number
  return Number.isNaN(v) ? null : v
}

/** Percentage of the site's mapped ground with lower thermal inertia than `value`. */
export function firmerThanPct(t: ThermalGrid, value: number): number {
  let below = 0
  let total = 0
  for (const v of t.values) {
    if (Number.isNaN(v)) continue
    total++
    if (v < value) below++
  }
  return total === 0 ? 0 : (below / total) * 100
}
