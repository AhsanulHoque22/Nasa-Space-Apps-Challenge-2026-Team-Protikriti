/** Clear-sky sunlight on the terrain over one sol: slope, aspect and cast shadows. Geometry only. */
import type { Grid } from './grid'
import { marsTime, sunPosition } from './mars-time'

/** Total solar irradiance at 1 AU (Kopp & Lean 2011, Geophysical Research Letters 38). */
export const SOLAR_CONSTANT_W_M2 = 1361
/** One Mars sol in seconds (24 h 39 min 35 s). */
export const SOL_SECONDS = 88_775.244
export const SOLAR_SAMPLES = 48 // sun positions per sol: every ~31 minutes

const DEG = Math.PI / 180

/** Sun-Mars distance in AU (Mars24 algorithm, Allison & McEwen 2000). */
export function heliocentricDistanceAu(utcMs: number): number {
  const M = marsTime(utcMs).meanAnomalyDeg * DEG
  return (
    1.523679 *
    (1.00436 -
      0.09309 * Math.cos(M) -
      0.004336 * Math.cos(2 * M) -
      0.00031 * Math.cos(3 * M) -
      0.00003 * Math.cos(4 * M))
  )
}

/**
 * 1 where the cell's centre sees the sun, 0 where terrain shadows it. Sweeps the grid away from
 * the sun, carrying the height a shadow would have to clear (O(cells) per sun position).
 * `azimuthDeg` is clockwise from north; cells with no data never block.
 */
export function sunlitMask(g: Grid, azimuthDeg: number, elevationDeg: number): Uint8Array {
  const { width, height, elevationM: z, pixelSizeM: px } = g
  const lit = new Uint8Array(width * height)
  if (elevationDeg <= 0) return lit
  const towardCol = Math.sin(azimuthDeg * DEG) // +col is east
  const towardRow = -Math.cos(azimuthDeg * DEG) // +row is south
  const colMajor = Math.abs(towardCol) >= Math.abs(towardRow)
  const major = colMajor ? towardCol : towardRow
  const minorPerStep = (colMajor ? towardRow : towardCol) / Math.abs(major)
  const drop = (px / Math.abs(major)) * Math.tan(elevationDeg * DEG) // shadow fall per step
  const shadow = new Float64Array(width * height).fill(-Infinity)
  const ground = (i: number) => {
    const v = z[i] as number
    return Number.isNaN(v) ? -Infinity : v
  }
  const lines = colMajor ? width : height
  const along = colMajor ? height : width
  const stepSign = Math.sign(major)
  // Visit lines nearest the sun first, so each cell's upstream line is already done.
  for (let k = 0; k < lines; k++) {
    const line = stepSign > 0 ? lines - 1 - k : k
    const upstream = line + stepSign
    for (let j = 0; j < along; j++) {
      const i = colMajor ? j * width + line : line * width + j
      let blockAt = -Infinity
      if (upstream >= 0 && upstream < lines) {
        const pos = j + minorPerStep
        const j0 = Math.floor(pos)
        const f = pos - j0
        const height0 = (jj: number) => {
          if (jj < 0 || jj >= along) return -Infinity
          const u = colMajor ? jj * width + upstream : upstream * width + jj
          return Math.max(ground(u), shadow[u] as number)
        }
        const a = height0(j0)
        const b = f > 0 ? height0(j0 + 1) : a
        // Interpolate between the two upstream cells; next to the edge or a gap use the one we have.
        const between =
          Number.isFinite(a) && Number.isFinite(b) ? (1 - f) * a + f * b : Math.max(a, b)
        blockAt = between - drop
      }
      shadow[i] = blockAt
      if (ground(i) >= blockAt) lit[i] = 1
    }
  }
  return lit
}

/**
 * Sunlight energy per square metre of ground over the sol starting at `utcMs`, in kWh/m², at the
 * top of the atmosphere: slope, aspect and terrain shadows, but no dust and no air. NaN where the
 * grid has no data.
 */
export function solarEnergyKwh(
  g: Grid,
  utcMs: number,
  lon: number,
  lat: number,
  samples = SOLAR_SAMPLES,
): Float32Array {
  const { width, height, elevationM: z, pixelSizeM: px } = g
  const energy = new Float32Array(width * height)
  const flux = SOLAR_CONSTANT_W_M2 / heliocentricDistanceAu(utcMs) ** 2
  const dtHours = SOL_SECONDS / samples / 3600
  // Unit surface normals from the same central differences the router uses.
  const nx = new Float32Array(width * height)
  const ny = new Float32Array(width * height)
  const nz = new Float32Array(width * height)
  const at = (r: number, c: number) => z[r * width + c] as number
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const c0 = Math.max(c - 1, 0)
      const c1 = Math.min(c + 1, width - 1)
      const r0 = Math.max(r - 1, 0)
      const r1 = Math.min(r + 1, height - 1)
      const east = c1 > c0 ? (at(r, c1) - at(r, c0)) / ((c1 - c0) * px) : 0
      const north = r1 > r0 ? (at(r0, c) - at(r1, c)) / ((r1 - r0) * px) : 0
      const n = Math.hypot(east, north, 1)
      const i = r * width + c
      nx[i] = -east / n
      ny[i] = -north / n
      nz[i] = 1 / n
      if (Number.isNaN(at(r, c))) energy[i] = NaN
    }
  }
  for (let s = 0; s < samples; s++) {
    const sun = sunPosition(utcMs + ((s + 0.5) * SOL_SECONDS * 1000) / samples, lon, lat)
    if (sun.elevationDeg <= 0) continue
    const e = sun.elevationDeg * DEG
    const a = sun.azimuthDeg * DEG
    const sx = Math.cos(e) * Math.sin(a)
    const sy = Math.cos(e) * Math.cos(a)
    const sz = Math.sin(e)
    const lit = sunlitMask(g, sun.azimuthDeg, sun.elevationDeg)
    const kwh = (flux * dtHours) / 1000
    for (let i = 0; i < energy.length; i++) {
      if (!lit[i]) continue
      const cos = (nx[i] as number) * sx + (ny[i] as number) * sy + (nz[i] as number) * sz
      if (cos > 0) energy[i] = (energy[i] as number) + kwh * cos
    }
  }
  return energy
}
