/**
 * Mars rover vehicle physics for Explore on Foot mode.
 *
 * Mars constants used:
 *   gravity = 3.72 m/s² (vs Earth 9.81)
 *   no aerodynamic drag (atmospheric pressure < 1% of Earth's)
 *   rolling resistance dominated by regolith deformation, not air
 */
import { Cartesian3, HeadingPitchRoll, Math as CesiumMath, Matrix4, Transforms } from 'cesium'
import { MARS_SPHERE } from './mars'

const MAX_SPEED_FWD = 8 // m/s  (~29 km/h — a fictional pressurised buggy)
const MAX_SPEED_REV = 3 // m/s
const ACCEL = 2.5 // m/s²  (battery-limited, not gravity-limited)
const ROLLING_DRAG = 1.8 // m/s²  (regolith surface resistance)
const TURN_DEG_S = 65 // degrees/s at full speed
export const WHEEL_RADIUS_M = 0.28 // visual-only spin rate

export type VehicleState = {
  lon: number
  lat: number
  headingDeg: number
  speedMs: number
  altM: number
  wheelRotRad: number // cumulative; used for wheel-spin animation
}

export function createVehicle(lon: number, lat: number, altM: number): VehicleState {
  return { lon, lat, headingDeg: 0, speedMs: 0, altM, wheelRotRad: 0 }
}

export function stepVehicle(
  v: VehicleState,
  keys: Set<string>,
  dtS: number,
  groundAt: (lon: number, lat: number) => number,
  mPerDeg: number,
): VehicleState {
  const fwd = keys.has('w') || keys.has('arrowup')
  const rev = keys.has('s') || keys.has('arrowdown')
  const left = keys.has('a') || keys.has('arrowleft')
  const right = keys.has('d') || keys.has('arrowright')

  // Longitudinal speed: throttle, or roll to rest against regolith drag
  let speed = v.speedMs
  if (fwd) speed = Math.min(MAX_SPEED_FWD, speed + ACCEL * dtS)
  else if (rev) speed = Math.max(-MAX_SPEED_REV, speed - ACCEL * dtS)
  else speed = Math.sign(speed) * Math.max(0, Math.abs(speed) - ROLLING_DRAG * dtS)

  // Turning: rate proportional to |speed| (pivoting in place is not allowed)
  const steer = (right ? 1 : 0) - (left ? 1 : 0)
  const speedFrac = Math.min(1, Math.abs(speed) / 2)
  const turn = steer * TURN_DEG_S * speedFrac * Math.sign(speed || 1) * dtS
  const heading = (v.headingDeg + turn + 360) % 360

  // Move along heading
  const cosLat = Math.cos(v.lat * (Math.PI / 180))
  const lon = v.lon + (speed * dtS * Math.sin(CesiumMath.toRadians(heading))) / (mPerDeg * cosLat)
  const lat = v.lat + (speed * dtS * Math.cos(CesiumMath.toRadians(heading))) / mPerDeg

  const alt = groundAt(lon, lat)

  return {
    lon,
    lat,
    headingDeg: heading,
    speedMs: speed,
    altM: isFinite(alt) ? alt : v.altM,
    wheelRotRad: v.wheelRotRad + (speed * dtS) / WHEEL_RADIUS_M,
  }
}

/** Model matrix placing rover body on terrain at given state. */
export function vehicleMatrix(v: VehicleState): Matrix4 {
  return Transforms.headingPitchRollToFixedFrame(
    Cartesian3.fromDegrees(v.lon, v.lat, v.altM + WHEEL_RADIUS_M, MARS_SPHERE),
    new HeadingPitchRoll(CesiumMath.toRadians(v.headingDeg), 0, 0),
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
