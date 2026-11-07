/**
 * Pressurised rover physics for Explore on foot.
 *
 * Mars constants used:
 *   gravity = 3.72 m/s² (vs Earth 9.81)
 *   no aerodynamic drag (atmospheric pressure < 1% of Earth's)
 *   rolling resistance dominated by regolith deformation, not air
 */
import { Cartesian3, HeadingPitchRoll, Math as CesiumMath, Matrix4, Transforms } from 'cesium'
import { MARS_SPHERE } from './mars'

/**
 * Top speed the driver picks on the tablet. Real crewed rovers are slow: NASA's Space Exploration
 * Vehicle ~10 km/h (2.8 m/s), the Apollo LRV 13 km/h (3.6 m/s; NASA LRV Operations Handbook 1971).
 * Anything above that is game speed, and the tablet says so.
 */
export const DEFAULT_TOP_SPEED_MS = 8
export const REAL_ROVER_TOP_SPEED_MS = 3.6
const MAX_SPEED_REV = 3 // m/s
const ACCEL = 2.5 // m/s²  (battery-limited, not gravity-limited)
const ROLLING_DRAG = 1.8 // m/s²  (regolith surface resistance)
const TURN_DEG_S = 65 // degrees/s at full speed
export const WHEEL_RADIUS_M = 0.28 // visual-only spin rate
/**
 * Steepest ground the rover drives on, up or down: the Apollo LRV was rated for 25° slopes
 * (NASA LRV Operations Handbook, LS006-002-2H, 1971). Uphill the motors slow it in proportion.
 */
export const CLIMB_LIMIT_DEG = 25
// The slowest crawl on a slope just under the limit, as a share of the top speed (team assumption).
const MIN_CLIMB_SHARE = 0.15
// Ground is sampled this far ahead/behind and to each side for slope, pitch and roll.
const PROBE_M = 2

export type VehicleState = {
  lon: number
  lat: number
  headingDeg: number
  speedMs: number
  altM: number
  wheelRotRad: number // cumulative; used for wheel-spin animation
  pitchDeg: number // nose up positive
  rollDeg: number // right side down positive
  /** Why the rover stopped, e.g. "Too steep: 27° > 25° limit"; null when it is free to move. */
  blocked: string | null
}

export function createVehicle(lon: number, lat: number, altM: number): VehicleState {
  return {
    lon,
    lat,
    headingDeg: 0,
    speedMs: 0,
    altM,
    wheelRotRad: 0,
    pitchDeg: 0,
    rollDeg: 0,
    blocked: null,
  }
}

const deg = (rad: number) => (rad * 180) / Math.PI

export function stepVehicle(
  v: VehicleState,
  keys: Set<string>,
  dtS: number,
  groundAt: (lon: number, lat: number) => number,
  mPerDeg: number,
  topSpeedMs = DEFAULT_TOP_SPEED_MS,
): VehicleState {
  const fwd = keys.has('w') || keys.has('arrowup')
  const rev = keys.has('s') || keys.has('arrowdown')
  const left = keys.has('a') || keys.has('arrowleft')
  const right = keys.has('d') || keys.has('arrowright')
  const cosLat = Math.cos(v.lat * (Math.PI / 180))
  const at = (bearingDeg: number, m: number): [number, number] => {
    const b = CesiumMath.toRadians(bearingDeg)
    return [v.lon + (m * Math.sin(b)) / (mPerDeg * cosLat), v.lat + (m * Math.cos(b)) / mPerDeg]
  }
  const rise = (bearingDeg: number) => {
    const ahead = groundAt(...at(bearingDeg, PROBE_M))
    const behind = groundAt(...at(bearingDeg + 180, PROBE_M))
    return deg(Math.atan2(ahead - behind, 2 * PROBE_M))
  }
  const pitch = rise(v.headingDeg)
  const roll = -rise(v.headingDeg + 90)

  // Slope along the direction of travel: positive is uphill.
  const dir = v.speedMs < 0 || (rev && !fwd) ? -1 : 1
  const climb = pitch * dir
  const tooSteep = Math.abs(climb) > CLIMB_LIMIT_DEG || !Number.isFinite(climb)
  const cap =
    climb > 0 ? topSpeedMs * Math.max(MIN_CLIMB_SHARE, 1 - climb / CLIMB_LIMIT_DEG) : topSpeedMs

  // Longitudinal speed: throttle, or roll to rest against regolith drag
  let speed = v.speedMs
  if (fwd) speed = Math.min(cap, speed + ACCEL * dtS)
  else if (rev) speed = Math.max(-Math.min(MAX_SPEED_REV, cap), speed - ACCEL * dtS)
  else speed = Math.sign(speed) * Math.max(0, Math.abs(speed) - ROLLING_DRAG * dtS)
  if (Math.abs(speed) > cap) speed = Math.sign(speed) * Math.max(cap, Math.abs(speed) - ACCEL * dtS)

  // Turning: rate proportional to |speed| (pivoting in place is not allowed)
  const steer = (right ? 1 : 0) - (left ? 1 : 0)
  const speedFrac = Math.min(1, Math.abs(speed) / 2)
  const turn = steer * TURN_DEG_S * speedFrac * Math.sign(speed || 1) * dtS
  const heading = (v.headingDeg + turn + 360) % 360

  const blockedBy = (slope: number) =>
    Number.isFinite(slope)
      ? `Too steep: ${Math.round(Math.abs(slope))}° > ${CLIMB_LIMIT_DEG}° limit`
      : 'No terrain data ahead'
  if (tooSteep && (fwd || rev || speed !== 0)) {
    return {
      ...v,
      headingDeg: heading,
      speedMs: 0,
      pitchDeg: pitch,
      rollDeg: roll,
      blocked: blockedBy(climb),
    }
  }

  const [lon, lat] = at(heading, speed * dtS)
  const alt = groundAt(lon, lat)
  if (!Number.isFinite(alt))
    return { ...v, headingDeg: heading, speedMs: 0, blocked: 'No terrain data ahead' }

  return {
    lon,
    lat,
    headingDeg: heading,
    speedMs: speed,
    altM: alt,
    wheelRotRad: v.wheelRotRad + (speed * dtS) / WHEEL_RADIUS_M,
    pitchDeg: Number.isFinite(pitch) ? pitch : 0,
    rollDeg: Number.isFinite(roll) ? roll : 0,
    blocked: null,
  }
}

/** Model matrix placing the rover body on the terrain, tilted to the ground under it. */
export function vehicleMatrix(v: VehicleState, liftM: number, headingOffsetDeg: number): Matrix4 {
  return Transforms.headingPitchRollToFixedFrame(
    Cartesian3.fromDegrees(v.lon, v.lat, v.altM + liftM, MARS_SPHERE),
    new HeadingPitchRoll(
      CesiumMath.toRadians(v.headingDeg + headingOffsetDeg),
      CesiumMath.toRadians(v.pitchDeg),
      CesiumMath.toRadians(v.rollDeg),
    ),
    MARS_SPHERE,
  )
}

/** Flat distance between two lon/lat points in metres. */
export function distM(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number,
  mPerDeg: number,
): number {
  const cosLat = Math.cos(lat1 * (Math.PI / 180))
  const dx = (lon2 - lon1) * mPerDeg * cosLat
  const dy = (lat2 - lat1) * mPerDeg
  return Math.sqrt(dx * dx + dy * dy)
}
