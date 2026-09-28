/** First-person explore mode: walk the real terrain of a site at 1:1 scale. */
import { Cartesian3, Cartographic, Math as CesiumMath, type Viewer } from 'cesium'
import { type Site, sampleGrid } from '../core/elevation'
import { type WalkInput, type Walker, step } from '../core/explore'
import { MARS_SPHERE } from './mars'
import { VERTICAL_EXAGGERATION } from './viewer'

const EYE_HEIGHT_M = 1.8
const LOOK_DEG_PER_PX = 0.2
const TURN_DEG_PER_S = 70
const PITCH_LIMIT_DEG = 80

export type ExploreSession = { stop(): void }

export function startExplore(
  viewer: Viewer,
  site: Site,
  from: { lon: number; lat: number },
  onUpdate: (w: Walker, pitchDeg: number) => void,
  onExit: () => void,
): ExploreSession {
  const scene = viewer.scene
  const controller = scene.screenSpaceCameraController
  scene.verticalExaggeration = 1 // walk the terrain at its true scale
  controller.enableInputs = false
  let walker: Walker = { lon: from.lon, lat: from.lat, headingDeg: 0, distanceM: 0, warning: null }
  let pitchDeg = -5
  const keys = new Set<string>()
  let last = performance.now()
  let frame = 0

  const place = () => {
    // The rendered mesh interpolates coarser than the DEM point; stand above whichever is higher
    // so the eye never ends up inside the terrain.
    const dem = sampleGrid(site.grid, walker.lon, walker.lat)
    const mesh = scene.globe.getHeight(Cartographic.fromDegrees(walker.lon, walker.lat))
    const ground = mesh === undefined ? dem : Math.max(dem, mesh)
    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(
        walker.lon,
        walker.lat,
        ground + EYE_HEIGHT_M,
        MARS_SPHERE,
      ),
      orientation: {
        heading: CesiumMath.toRadians(walker.headingDeg),
        pitch: CesiumMath.toRadians(pitchDeg),
        roll: 0,
      },
    })
  }

  const input = (dtS: number): WalkInput => ({
    forward:
      (keys.has('w') || keys.has('arrowup') ? 1 : 0) -
      (keys.has('s') || keys.has('arrowdown') ? 1 : 0),
    strafe: (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0),
    turnDeg:
      ((keys.has('arrowright') ? 1 : 0) - (keys.has('arrowleft') ? 1 : 0)) * TURN_DEG_PER_S * dtS,
  })

  const tick = (now: number) => {
    const dtS = Math.min(0.1, (now - last) / 1000) // clamp after tab switches
    last = now
    walker = step(walker, input(dtS), dtS, site.grid)
    place()
    onUpdate(walker, pitchDeg)
    frame = requestAnimationFrame(tick)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase()
    if (k === 'escape') return session.stop()
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
      keys.add(k)
      e.preventDefault()
    }
  }
  const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase())
  let drag: { x: number; y: number } | null = null
  const canvas = scene.canvas
  const onDown = (e: PointerEvent) => (drag = { x: e.clientX, y: e.clientY })
  const onMove = (e: PointerEvent) => {
    if (!drag) return
    walker = {
      ...walker,
      headingDeg: (walker.headingDeg + (e.clientX - drag.x) * LOOK_DEG_PER_PX + 360) % 360,
    }
    pitchDeg = Math.max(
      -PITCH_LIMIT_DEG,
      Math.min(PITCH_LIMIT_DEG, pitchDeg - (e.clientY - drag.y) * LOOK_DEG_PER_PX),
    )
    drag = { x: e.clientX, y: e.clientY }
  }
  const onUp = () => (drag = null)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  canvas.addEventListener('pointerdown', onDown)
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)

  const session: ExploreSession = {
    stop() {
      cancelAnimationFrame(frame)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      canvas.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      controller.enableInputs = true
      scene.verticalExaggeration = VERTICAL_EXAGGERATION
      onExit()
    },
  }
  place()
  frame = requestAnimationFrame(tick)
  return session
}
