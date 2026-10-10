/** Opening view: the whole planet, turning on its axis, until the user takes over. */
import { Cartesian3, Math as CesiumMath, type Viewer } from 'cesium'
import { IDLE_SPIN_ALTITUDE_M, idleSpinStepRad } from '../core/idle-spin'
import { MARS_SPHERE } from './mars'

const OPENING_PITCH_DEG = -90 // straight down at the planet, so the poles sit at top and bottom
const STOP_EVENTS = ['pointerdown', 'wheel', 'keydown', 'touchstart'] as const

export type IdleSpin = { readonly active: boolean; stop: () => void }

export function startIdleSpin(viewer: Viewer, lon: number, lat: number): IdleSpin {
  viewer.camera.setView({
    destination: Cartesian3.fromDegrees(lon, lat, IDLE_SPIN_ALTITUDE_M, MARS_SPHERE),
    orientation: { heading: 0, pitch: CesiumMath.toRadians(OPENING_PITCH_DEG), roll: 0 },
  })
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let active = !reduced
  let last = performance.now()

  // Camera.rotate negates its angle, so a positive step carries the camera west about the pole
  // and the ground drifts east, the way Mars really turns.
  const tick = () => {
    const now = performance.now()
    viewer.camera.rotate(Cartesian3.UNIT_Z, idleSpinStepRad((now - last) / 1000))
    last = now
  }
  const stop = () => {
    if (!active) return
    active = false
    viewer.scene.preRender.removeEventListener(tick)
    for (const type of STOP_EVENTS) window.removeEventListener(type, stop, true)
  }
  if (active) {
    viewer.scene.preRender.addEventListener(tick)
    for (const type of STOP_EVENTS) window.addEventListener(type, stop, true)
  }
  return {
    get active() {
      return active
    },
    stop,
  }
}
