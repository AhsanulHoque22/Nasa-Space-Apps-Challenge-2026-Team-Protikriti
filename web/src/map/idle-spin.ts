/** Opening view: the whole planet, turning on its axis, whenever altitude is above the threshold. */
import { Cartesian3, Math as CesiumMath, type Viewer } from 'cesium'
import { IDLE_SPIN_ALTITUDE_M, IDLE_SPIN_THRESHOLD_M, idleSpinStepRad } from '../core/idle-spin'
import { MARS_SPHERE } from './mars'

const OPENING_PITCH_DEG = -90 // straight down at the planet, so the poles sit at top and bottom

export type IdleSpin = { readonly spinning: boolean }

export function startIdleSpin(viewer: Viewer, lon: number, lat: number): IdleSpin {
  viewer.camera.setView({
    destination: Cartesian3.fromDegrees(lon, lat, IDLE_SPIN_ALTITUDE_M, MARS_SPHERE),
    orientation: { heading: 0, pitch: CesiumMath.toRadians(OPENING_PITCH_DEG), roll: 0 },
  })
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced) return { get spinning() { return false } }

  let last = performance.now()

  // Camera.rotate negates its angle, so a positive step carries the camera west about the pole
  // and the ground drifts east, the way Mars really turns.
  const tick = () => {
    const now = performance.now()
    const alt = viewer.camera.positionCartographic?.height ?? 0
    if (alt > IDLE_SPIN_THRESHOLD_M) {
      viewer.camera.rotate(Cartesian3.UNIT_Z, idleSpinStepRad((now - last) / 1000))
    }
    last = now
  }
  viewer.scene.preRender.addEventListener(tick)

  return {
    get spinning() {
      return (viewer.camera.positionCartographic?.height ?? 0) > IDLE_SPIN_THRESHOLD_M
    },
  }
}
