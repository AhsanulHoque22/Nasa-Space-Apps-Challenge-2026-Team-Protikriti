/** Explore mode: walking on real terrain at human pace, stopping at the edge of the data. */
import { sampleGrid } from './elevation'
import { type Grid, lonLatToCell } from './grid'
import { passableCells, toblerSpeedMs } from './route'

const M_PER_DEG = (3_396_190 * Math.PI) / 180 // Mars 2000 sphere
const mod = (x: number, m: number) => ((x % m) + m) % m

export type Walker = {
  lon: number
  lat: number
  headingDeg: number
  distanceM: number
  warning: string | null
}

/** forward/strafe in -1..1; turnDeg is added to the heading this step. */
export type WalkInput = { forward: number; strafe: number; turnDeg: number }

function offset(lon: number, lat: number, bearingDeg: number, metres: number): [number, number] {
  const b = (bearingDeg * Math.PI) / 180
  const dLat = (metres * Math.cos(b)) / M_PER_DEG
  const dLon = (metres * Math.sin(b)) / (M_PER_DEG * Math.cos((lat * Math.PI) / 180))
  return [lon + dLon, lat + dLat]
}

export function step(w: Walker, input: WalkInput, dtS: number, g: Grid, speedFactor = 1): Walker {
  const headingDeg = mod(w.headingDeg + input.turnDeg, 360)
  const magnitude = Math.min(1, Math.hypot(input.forward, input.strafe))
  if (magnitude === 0) return { ...w, headingDeg }
  const bearing = headingDeg + (Math.atan2(input.strafe, input.forward) * 180) / Math.PI
  // Grade along the direction of travel sets the pace (probe one flat-speed step ahead).
  const probeM = Math.max(1, toblerSpeedMs(0, speedFactor) * dtS * magnitude)
  const [pLon, pLat] = offset(w.lon, w.lat, bearing, probeM)
  const grade = (sampleGrid(g, pLon, pLat) - sampleGrid(g, w.lon, w.lat)) / probeM
  const metres = (Number.isFinite(grade) ? toblerSpeedMs(grade, speedFactor) : 0) * dtS * magnitude
  const [lon, lat] = offset(w.lon, w.lat, bearing, metres)
  if (lon < g.west || lon > g.east || lat < g.south || lat > g.north)
    return { ...w, headingDeg, warning: 'Edge of the mapped site: turn back.' }
  const cell = lonLatToCell(g, lon, lat)
  if (!cell) return { ...w, headingDeg, warning: 'No terrain data ahead.' }
  const steep = !passableCells(g)[cell.row * g.width + cell.col]
  return {
    lon,
    lat,
    headingDeg,
    distanceM: w.distanceM + metres,
    warning: steep ? `Steep ground: slope over ${g.maxSafeSlopeDeg}° here.` : null,
  }
}
