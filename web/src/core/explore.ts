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
  const metres = paceMs(w, bearing, g, speedFactor, dtS * magnitude) * dtS * magnitude
  return { ...advance(w, bearing, metres, g), headingDeg }
}

/** Tobler walking pace along `bearing`, from the grade one flat-speed step ahead. */
function paceMs(w: Walker, bearing: number, g: Grid, speedFactor: number, probeS: number): number {
  const probeM = Math.max(1, toblerSpeedMs(0, speedFactor) * probeS)
  const [pLon, pLat] = offset(w.lon, w.lat, bearing, probeM)
  const grade = (sampleGrid(g, pLon, pLat) - sampleGrid(g, w.lon, w.lat)) / probeM
  return Number.isFinite(grade) ? toblerSpeedMs(grade, speedFactor) : 0
}

/** Move `metres` along `bearing`, refusing to leave the mapped site. */
function advance(w: Walker, bearing: number, metres: number, g: Grid): Walker {
  const [lon, lat] = offset(w.lon, w.lat, bearing, metres)
  if (lon < g.west || lon > g.east || lat < g.south || lat > g.north)
    return { ...w, warning: 'Edge of the mapped site: turn back.' }
  const cell = lonLatToCell(g, lon, lat)
  if (!cell) return { ...w, warning: 'No terrain data ahead.' }
  const steep = !passableCells(g)[cell.row * g.width + cell.col]
  return {
    ...w,
    lon,
    lat,
    distanceM: w.distanceM + metres,
    warning: steep ? `Steep ground: slope over ${g.maxSafeSlopeDeg}° here.` : null,
  }
}

/** Mars surface gravity, m/s² (IAU/JPL: GM 42,828 km³/s² over the 3,396 km radius). */
export const MARS_G = 3.721
// Grip limits how fast a walker can speed up or stop: friction coefficient ~0.7 (boot on
// regolith) times gravity. In 0.38 g that is 2.6 m/s², so starts and stops feel floaty.
const TRACTION_MS2 = 0.7 * MARS_G
// A suited astronaut's take-off speed; the same push lifts you ~2.6x higher than on Earth.
const JUMP_MS = 2.7
// Apollo and Mars-analogue studies: in low gravity people lope rather than walk fast.
const RUN_FACTOR = 2.3
// The feet follow the ground down small drops; bigger ones are a fall.
const SNAP_DOWN_M = 0.3

export type Body = Walker & {
  feetM: number // height of the feet above the datum
  vzMs: number
  speedMs: number
  bearingDeg: number // direction of the current horizontal motion
  grounded: boolean
}

/** Movement input plus run (Shift) and jump (Space). */
export type MoveInput = WalkInput & { run: boolean; jump: boolean }

export function restingBody(w: Walker, groundM: number): Body {
  return { ...w, feetM: groundM, vzMs: 0, speedMs: 0, bearingDeg: w.headingDeg, grounded: true }
}

/** One physics step on Mars: traction-limited walking and running, jumps and falls. */
export function stepBody(b: Body, input: MoveInput, dtS: number, g: Grid): Body {
  const headingDeg = mod(b.headingDeg + input.turnDeg, 360)
  const magnitude = Math.min(1, Math.hypot(input.forward, input.strafe))
  let { bearingDeg, speedMs } = b
  if (b.grounded) {
    // Only feet on the ground can change the horizontal motion.
    const wanted =
      headingDeg + (magnitude ? (Math.atan2(input.strafe, input.forward) * 180) / Math.PI : 0)
    const target = magnitude * paceMs(b, wanted, g, input.run ? RUN_FACTOR : 1, dtS)
    if (magnitude) bearingDeg = wanted
    const dv = target - speedMs
    speedMs += Math.sign(dv) * Math.min(Math.abs(dv), TRACTION_MS2 * dtS)
  }
  const moved = speedMs > 0 ? advance(b, bearingDeg, speedMs * dtS, g) : b
  if (moved.lon === b.lon && moved.lat === b.lat && speedMs > 0) speedMs = 0 // blocked at the edge
  const ground = sampleGrid(g, moved.lon, moved.lat)
  let { feetM, vzMs, grounded } = b
  if (grounded && input.jump) {
    vzMs = JUMP_MS
    grounded = false
  } else if (grounded && ground < feetM - SNAP_DOWN_M) grounded = false // walked off a ledge
  if (grounded) feetM = ground
  else {
    vzMs -= MARS_G * dtS
    feetM += vzMs * dtS
    if (feetM <= ground) [feetM, vzMs, grounded] = [ground, 0, true]
  }
  return { ...moved, headingDeg, bearingDeg, speedMs, feetM, vzMs, grounded }
}
