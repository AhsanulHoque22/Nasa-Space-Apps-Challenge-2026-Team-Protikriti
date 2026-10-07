/** First-person explore mode: walk the real terrain of a site at 1:1 scale, in Mars conditions. */
import {
  BillboardCollection,
  Cartesian3,
  Cartographic,
  Math as CesiumMath,
  LabelCollection,
  type Viewer,
} from 'cesium'
import { type Site, sampleGrid } from '../core/elevation'
import { type Body, type MoveInput, restingBody, stepBody } from '../core/explore'
import { localMeanSolarTimeHours, solarLongitudeDeg, sunPosition } from '../core/mars-time'
import {
  type Conditions,
  type SiteId,
  surfaceConditions,
  underStorm,
  withHaze,
} from '../core/surface-conditions'
import type { SolWeather } from '../core/weather'
import { type DustDevil, createMarsAtmosphere } from './mars-atmosphere'
import { MARS_SPHERE } from './mars'
import { sceneTimeMs } from './sun'
import { VERTICAL_EXAGGERATION } from './viewer'

const EYE_HEIGHT_M = 1.8
const LOOK_DEG_PER_PX = 0.2
const TURN_DEG_PER_S = 70
const PITCH_LIMIT_DEG = 80
const CONDITIONS_EVERY_MS = 1000
// At eye height every screen-space-error step multiplies the tiles drawn: 1 drew ~1,200 tiles
// (9 fps on Iris Xe), 3 with fog culling ~50 (27 fps) with the same near-ground detail, which
// HiRISE's 25 cm pixels limit anyway.
const WALK_SCREEN_SPACE_ERROR = 3
// Daytime winds at Jezero blow mostly from the east-southeast (MEDA, Viúdez-Moreiras et al.
// 2022), i.e. towards ~290°. ponytail: one direction for both sites.
const WIND_TO_DEG = 290
const M_PER_DEG = (MARS_SPHERE.maximumRadius * Math.PI) / 180
// Arrive by descending from this height: the fine terrain and HiRISE tiles load on the way down
// instead of popping in around a walker already standing on coarse, blurry ground.
const DESCENT_FROM_M = 400
const DESCENT_S = 3.5
const DESCENT_PITCH_DEG = -40

export type ExploreFrame = {
  body: Body
  pitchDeg: number
  sunElDeg: number
  lmstHours: number
  conditions: Conditions
}

export type ExploreSession = {
  stop(): void
  /** Show the 2018 global dust storm at this moment instead of the actual conditions. */
  setStormReplay(on: boolean): void
  /** Dust opacity set by hand for the look of the sky, or null for the actual conditions. */
  setHaze(tau: number | null): void
}

export function startExplore(
  viewer: Viewer,
  site: Site,
  from: { lon: number; lat: number },
  weather: Promise<readonly SolWeather[]>,
  onUpdate: (f: ExploreFrame) => void,
  onExit: () => void,
): ExploreSession {
  const scene = viewer.scene
  const globe = scene.globe
  const controller = scene.screenSpaceCameraController
  const saved = {
    sse: globe.maximumScreenSpaceError,
    fog: scene.fog.enabled,
    fogDrawn: scene.fog.renderable,
    scale: viewer.resolutionScale,
    browserRes: viewer.useBrowserRecommendedResolution,
    collision: controller.enableCollisionDetection,
  }
  // Map pins, labels and lines don't exist on the real ground: hide every one, restore on exit.
  const markers: Array<{ show: boolean }> = []
  for (let i = 0; i < viewer.dataSources.length; i++) markers.push(viewer.dataSources.get(i))
  for (let i = 0; i < scene.primitives.length; i++) {
    const p: unknown = scene.primitives.get(i)
    if (p instanceof LabelCollection || p instanceof BillboardCollection) markers.push(p)
  }
  const markersShown = markers.map((m) => m.show)
  for (const m of markers) m.show = false
  scene.verticalExaggeration = 1 // walk the terrain at its true scale
  controller.enableInputs = false
  // The map's 20 m ground clearance would fight the 1.8 m eye; walking keeps its own footing.
  controller.enableCollisionDetection = false
  globe.maximumScreenSpaceError = WALK_SCREEN_SPACE_ERROR
  // Fog culls and coarsens distant tiles; the atmosphere pass draws the Mars haze, not Cesium.
  scene.fog.enabled = true
  scene.fog.renderable = false
  viewer.useBrowserRecommendedResolution = false
  viewer.resolutionScale = Math.min(2, window.devicePixelRatio || 1)

  const siteId: SiteId = site.id === 'gale' ? 'gale' : 'jezero'
  let sols: readonly SolWeather[] = []
  void weather.then((s) => (sols = s)).catch(() => undefined) // climatology until it arrives
  const groundAt = (lon: number, lat: number) => sampleGrid(site.grid, lon, lat)
  let body = restingBody(
    { lon: from.lon, lat: from.lat, headingDeg: 0, distanceM: 0, warning: null },
    groundAt(from.lon, from.lat),
  )
  let pitchDeg = -5
  let bobPhase = 0
  let landingDipM = 0
  const keys = new Set<string>()
  let jumpQueued = false
  const startedAt = performance.now()
  let last = startedAt
  let frame = 0

  let stormReplay = false
  let hazeTau: number | null = null
  const measure = (): { conditions: Conditions; sunElDeg: number; lmstHours: number } => {
    const utcMs = sceneTimeMs()
    const lmstHours = localMeanSolarTimeHours(utcMs, body.lon)
    const actual = surfaceConditions({
      utcMs,
      ls: solarLongitudeDeg(utcMs),
      lmstHours,
      site: siteId,
      sols,
    })
    return {
      lmstHours,
      sunElDeg: sunPosition(utcMs, body.lon, body.lat).elevationDeg,
      conditions: stormReplay
        ? underStorm(actual, lmstHours)
        : hazeTau === null
          ? actual
          : withHaze(actual, hazeTau),
    }
  }
  let now = measure()
  let measuredAt = performance.now()
  const devils: Array<DustDevil & { until: number }> = []
  const atmosphere = createMarsAtmosphere(viewer, atmosphereState())

  function atmosphereState() {
    const c = now.conditions
    return {
      tau: c.tau,
      visibilityKm: c.visibilityKm,
      windMs: c.windMs,
      windToDeg: WIND_TO_DEG,
      origin: from,
      devils,
    }
  }

  /** Dust devils come and go at the site's rate, drift with the wind, last minutes. */
  const updateDevils = (dtS: number, t: number) => {
    for (let i = devils.length - 1; i >= 0; i--)
      if ((devils[i]?.until ?? 0) < t) devils.splice(i, 1)
    const a = (WIND_TO_DEG * Math.PI) / 180
    for (const d of devils) {
      d.east += Math.sin(a) * now.conditions.windMs * dtS
      d.north += Math.cos(a) * now.conditions.windMs * dtS
    }
    const perS = now.conditions.dustDevilsPerHour / 3600
    if (devils.length < 3 && Math.random() < perS * dtS) spawnDevil(t)
  }

  const spawnDevil = (t: number) => {
    const bearing = Math.random() * 2 * Math.PI
    const distM = 300 + Math.random() * 2200
    const here = {
      east: (body.lon - from.lon) * M_PER_DEG * Math.cos((from.lat * Math.PI) / 180),
      north: (body.lat - from.lat) * M_PER_DEG,
    }
    const east = here.east + Math.sin(bearing) * distM
    const north = here.north + Math.cos(bearing) * distM
    const lat = from.lat + north / M_PER_DEG
    const lon = from.lon + east / (M_PER_DEG * Math.cos((from.lat * Math.PI) / 180))
    const baseM = groundAt(lon, lat)
    if (!Number.isFinite(baseM)) return
    devils.push({
      east,
      north,
      baseM,
      radiusM: 4 + Math.random() * 20,
      heightM: 150 + Math.random() * 550,
      until: t + (3 + Math.random() * 9) * 60_000,
    })
  }

  const place = (dtS: number) => {
    // The rendered mesh interpolates coarser than the DEM point; stand above whichever is higher
    // so the eye never ends up inside the terrain.
    const mesh = globe.getHeight(Cartographic.fromDegrees(body.lon, body.lat))
    const feet = mesh === undefined ? body.feetM : Math.max(body.feetM, mesh)
    // Head bob: one step per ~stride; low gravity makes long, slow strides.
    if (body.grounded) bobPhase += (body.speedMs * dtS) / (0.7 + 0.45 * body.speedMs)
    const bob = body.grounded ? 0.035 * Math.sin(bobPhase * Math.PI) * Math.min(1, body.speedMs) : 0
    landingDipM *= Math.exp(-dtS * 6)
    const k = Math.min(1, (performance.now() - startedAt) / 1000 / DESCENT_S)
    const ease = 1 - (1 - k) ** 3
    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(
        body.lon,
        body.lat,
        feet + EYE_HEIGHT_M + bob - landingDipM + DESCENT_FROM_M * (1 - ease),
        MARS_SPHERE,
      ),
      orientation: {
        heading: CesiumMath.toRadians(body.headingDeg),
        pitch: CesiumMath.toRadians(pitchDeg + (DESCENT_PITCH_DEG - pitchDeg) * (1 - ease)),
        roll: 0,
      },
    })
  }

  const input = (dtS: number): MoveInput => ({
    forward:
      (keys.has('w') || keys.has('arrowup') ? 1 : 0) -
      (keys.has('s') || keys.has('arrowdown') ? 1 : 0),
    strafe: (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0),
    turnDeg:
      ((keys.has('arrowright') ? 1 : 0) - (keys.has('arrowleft') ? 1 : 0)) * TURN_DEG_PER_S * dtS,
    run: keys.has('shift'),
    jump: jumpQueued,
  })

  const tick = (t: number) => {
    const dtS = Math.min(0.1, (t - last) / 1000) // clamp after tab switches
    last = t
    const before = body
    body = stepBody(body, input(dtS), dtS, site.grid)
    jumpQueued = false
    if (!before.grounded && body.grounded) landingDipM = Math.min(0.25, -before.vzMs * 0.05)
    if (t - measuredAt > CONDITIONS_EVERY_MS) {
      now = measure()
      measuredAt = t
    }
    updateDevils(dtS, Date.now())
    atmosphere.setState(atmosphereState())
    place(dtS)
    onUpdate({ body, pitchDeg, ...now })
    frame = requestAnimationFrame(tick)
  }

  const MOVE_KEYS = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift']
  const onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase()
    if (k === 'escape') return session.stop()
    if (k === ' ') {
      if (!e.repeat) jumpQueued = true
      e.preventDefault()
    } else if (MOVE_KEYS.includes(k)) {
      keys.add(k)
      e.preventDefault()
    }
  }
  const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase())
  const onBlur = () => keys.clear() // a key released in another window never sends keyup
  let drag: { x: number; y: number } | null = null
  const canvas = scene.canvas
  const onDown = (e: PointerEvent) => (drag = { x: e.clientX, y: e.clientY })
  const onMove = (e: PointerEvent) => {
    if (!drag) return
    body = {
      ...body,
      headingDeg: (body.headingDeg + (e.clientX - drag.x) * LOOK_DEG_PER_PX + 360) % 360,
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
  window.addEventListener('blur', onBlur)
  canvas.addEventListener('pointerdown', onDown)
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)

  const session: ExploreSession = {
    setStormReplay(on) {
      stormReplay = on
      now = measure()
    },
    setHaze(tau) {
      hazeTau = tau
      now = measure()
    },
    stop() {
      cancelAnimationFrame(frame)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      canvas.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      atmosphere.destroy()
      markers.forEach((m, i) => (m.show = markersShown[i] ?? m.show))
      controller.enableInputs = true
      controller.enableCollisionDetection = saved.collision
      scene.verticalExaggeration = VERTICAL_EXAGGERATION
      globe.maximumScreenSpaceError = saved.sse
      scene.fog.enabled = saved.fog
      scene.fog.renderable = saved.fogDrawn
      viewer.resolutionScale = saved.scale
      viewer.useBrowserRecommendedResolution = saved.browserRes
      onExit()
    },
  }
  // A walk starting at midday may meet a dust devil already on its way.
  // (expected number alive = rate x mean lifetime of 7.5 min)
  if (Math.random() < now.conditions.dustDevilsPerHour * 0.125) spawnDevil(Date.now())
  if (import.meta.env.DEV) Object.assign(window, { exploreDebug: { devils, spawnDevil } })
  place(0)
  frame = requestAnimationFrame(tick)
  return session
}
