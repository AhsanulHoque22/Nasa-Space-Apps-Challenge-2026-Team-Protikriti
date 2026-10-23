/** First-person explore mode: walk the real terrain of a site at 1:1 scale, in Mars conditions. */
import {
  BillboardCollection,
  Cartesian2,
  Cartesian3,
  Cartographic,
  Math as CesiumMath,
  LabelCollection,
  type Viewer,
} from 'cesium'
import { earthMarsDelayMin } from '../core/mars-time'
import { GCR_SURFACE_MSV_HR } from '../core/surface-conditions'
import type { ColonyLayer } from './colony-modules'
import type { ModuleType } from '../core/colony-budget'
import type { ColonyScore } from '../core/colony-score'
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
import { loadSiteModels } from './site-models'
import { MARS_SPHERE } from './mars'
import { sceneTimeMs } from './sun'
import { VERTICAL_EXAGGERATION } from './viewer'

const EYE_HEIGHT_M = 1.8
const LOOK_DEG_PER_PX = 0.2
const TURN_DEG_PER_S = 70
const PITCH_LIMIT_DEG = 80
const CONDITIONS_EVERY_MS = 1000
// SSE 1 forces highest-res tiles to load right under the camera — crisp ground at feet.
// On Iris Xe this costs ~9 fps vs 27 fps at SSE 3, but HiRISE clarity is worth it for demo.
const WALK_SCREEN_SPACE_ERROR = 1
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
  // Suit consumables
  suitO2Pct: number
  suitPowerPct: number
  // Radiation
  radiationMsvPerHr: number // current dose rate including SPE spike
  cumulativeMsv: number // accumulated this EVA
  spe: boolean // Solar Particle Event active
  // Seismic
  marsquake: { mag: number; distKm: number } | null
  // Resources at current position
  resourceScore: ColonyScore | null
  // Communications
  commsDelayMin: number
}

export type ExploreSession = {
  stop(): void
  /** Show the 2018 global dust storm at this moment instead of the actual conditions. */
  setStormReplay(on: boolean): void
  /** Dust opacity set by hand for the look of the sky, or null for the actual conditions. */
  setHaze(tau: number | null): void
  /** Enter build mode for the given module type, or pass null to exit build mode. */
  setBuildMode(type: ModuleType | null): void
}

export type ExploreColonyOpts = {
  colonyLayer?: ColonyLayer
  scoreAt?: (lon: number, lat: number) => ColonyScore
  onPlace?: () => void
}

export function startExplore(
  viewer: Viewer,
  site: Site,
  from: { lon: number; lat: number },
  weather: Promise<readonly SolWeather[]>,
  onUpdate: (f: ExploreFrame) => void,
  onExit: () => void,
  colony?: ExploreColonyOpts,
): ExploreSession {
  const scene = viewer.scene
  const globe = scene.globe
  const controller = scene.screenSpaceCameraController
  const cam = scene.camera
  const saved = {
    sse: globe.maximumScreenSpaceError,
    fog: scene.fog.enabled,
    fogDrawn: scene.fog.renderable,
    scale: viewer.resolutionScale,
    browserRes: viewer.useBrowserRecommendedResolution,
    collision: controller.enableCollisionDetection,
    msaa: scene.msaaSamples,
    fxaa: scene.postProcessStages.fxaa.enabled,
    near: (cam.frustum as { near?: number }).near,
    tileCache: globe.tileCacheSize,
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
  // Load the maximum tile resolution and keep a large cache so underfoot tiles stay sharp.
  globe.tileCacheSize = 1000
  globe.preloadAncestors = true
  globe.preloadSiblings = true
  // Small near-clip so terrain geometry right under the feet isn't skipped by the frustum.
  ;(cam.frustum as { near?: number }).near = 0.01
  // Fog culls and coarsens distant tiles; the atmosphere pass draws the Mars haze, not Cesium.
  scene.fog.enabled = true
  scene.fog.renderable = false
  viewer.useBrowserRecommendedResolution = false
  viewer.resolutionScale = Math.min(2, window.devicePixelRatio || 1)
  // 4x MSAA makes the atmosphere pass resolve multisampled colour and depth every frame: 58 ms
  // vs 24 ms a frame measured on Iris Xe at 1808x873. FXAA smooths edges for a fraction of that.
  scene.msaaSamples = 1
  scene.postProcessStages.fxaa.enabled = true

  const siteId: SiteId = site.id === 'gale' ? 'gale' : 'jezero'
  let sols: readonly SolWeather[] = []
  void weather.then((s) => (sols = s)).catch(() => undefined) // climatology until it arrives
  const groundAt = (lon: number, lat: number) => sampleGrid(site.grid, lon, lat)
  const removeSiteModels = loadSiteModels(scene, site.id, groundAt)
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

  // Build mode (aim-and-place colony modules)
  let buildMode = false
  let buildType: ModuleType = 'habitat'
  let ghostPos: { lon: number; lat: number; altM: number } | null = null
  if (colony?.colonyLayer) colony.colonyLayer.show = true

  // Suit consumables — NASA xEMU PLSS baseline: 8-hour O2, 8-hour power (ESAS 2005)
  // Depletion: base rate + activity factor proportional to walking speed
  let suitO2Pct = 100
  let suitPowerPct = 100
  const O2_BASE_PCT_S = 100 / (8 * 3600) // 8 h full charge
  const PWR_BASE_PCT_S = 100 / (8 * 3600) // 8 h full charge
  const O2_WALK_PCT_S_PER_MS = O2_BASE_PCT_S * 2 // 2× base per 1 m/s of walking

  // Radiation tracking
  let cumulativeMsv = 0
  let spe = false // Solar Particle Event active
  let speRemainingS = 0 // seconds left in current SPE
  // SPE dose rate: median large event ~0.5 mSv/hr measured by Curiosity RAD
  // (e.g. Sep 2017 event; Zeitlin et al. 2018). Large events 5–50 mSv/hr.
  const SPE_DOSE_MSV_HR = 5.0
  // ponytail: demo frequency 1/5 min; real rate ~2 large SPEs/year (NASA HEOMD SPE table)
  const SPE_RATE_PER_S = 1 / 300
  const SPE_DURATION_S = 20 // demo duration; real events last hours

  // Marsquakes (InSight SEIS catalog, Giardini et al. 2020, Ceylan et al. 2022)
  // ~3/week above M2 in active seasons; ponytail: demo rate 1/3 min
  let marsquake: ExploreFrame['marsquake'] = null
  let marsquakeRemainingS = 0
  const QUAKE_RATE_PER_S = 1 / 180 // ponytail: real 3/(7×86400) ≈ 5e-6/s; demo 1/180
  const QUAKE_DISPLAY_S = 8

  // Resources at walker position (refreshed every ~1 s)
  let resourceScore: ColonyScore | null = null
  let resourceTick = 0

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

    // Suit consumables
    const walkRate = body.grounded ? body.speedMs : 0
    suitO2Pct = Math.max(
      0,
      suitO2Pct - (O2_BASE_PCT_S + O2_WALK_PCT_S_PER_MS * walkRate) * dtS * 100,
    )
    suitPowerPct = Math.max(0, suitPowerPct - PWR_BASE_PCT_S * dtS * 100)

    // Radiation dose accumulation
    const activeDoseRate = spe ? SPE_DOSE_MSV_HR : GCR_SURFACE_MSV_HR
    cumulativeMsv += (activeDoseRate * dtS) / 3600

    // SPE lifecycle
    if (spe) {
      speRemainingS -= dtS
      if (speRemainingS <= 0) spe = false
    } else if (Math.random() < SPE_RATE_PER_S * dtS) {
      spe = true
      speRemainingS = SPE_DURATION_S
    }

    // Marsquakes
    if (marsquakeRemainingS > 0) {
      marsquakeRemainingS -= dtS
      if (marsquakeRemainingS <= 0) marsquake = null
    } else if (Math.random() < QUAKE_RATE_PER_S * dtS) {
      // Magnitude from InSight catalog distribution: mostly 2.0–3.5, tail to 5.0
      const mag = 2.0 + -Math.log(1 - Math.random()) * 0.7
      const distKm = 50 + Math.random() * 450
      marsquake = { mag: Math.min(5.0, mag), distKm }
      marsquakeRemainingS = QUAKE_DISPLAY_S
    }

    // Resources at position (update ~once per second)
    if (++resourceTick % 60 === 0 && colony?.scoreAt) {
      resourceScore = colony.scoreAt(body.lon, body.lat)
    }

    onUpdate({
      body,
      pitchDeg,
      ...now,
      suitO2Pct,
      suitPowerPct,
      radiationMsvPerHr: activeDoseRate,
      cumulativeMsv,
      spe,
      marsquake,
      resourceScore,
      commsDelayMin: earthMarsDelayMin(Date.now()),
    })
    // Update ghost aim position every 3rd frame (terrain pick is ~1 ms; throttle anyway)
    if (buildMode && colony?.colonyLayer && frame % 3 === 0) {
      const canvas = scene.canvas
      const center = new Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2)
      const ray = viewer.camera.getPickRay(center)
      const hit = ray && globe.pick(ray, scene)
      if (hit) {
        const cg = MARS_SPHERE.cartesianToCartographic(hit)
        ghostPos = {
          lon: CesiumMath.toDegrees(cg.longitude),
          lat: CesiumMath.toDegrees(cg.latitude),
          altM: cg.height + 1,
        }
        colony.colonyLayer.setGhost(buildType, ghostPos.lon, ghostPos.lat, ghostPos.altM)
      } else {
        ghostPos = null
        colony.colonyLayer.hideGhost()
      }
    }
    frame = requestAnimationFrame(tick)
  }

  const MOVE_KEYS = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift']
  const EMPTY_SCORE: ColonyScore = {
    solar: null,
    ice: null,
    minerals: null,
    shelter: null,
    stability: null,
    wind: null,
  }
  const onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase()
    if (k === 'escape') return session.stop()
    if (k === ' ') {
      if (!e.repeat) jumpQueued = true
      e.preventDefault()
    } else if (k === 'b') {
      session.setBuildMode(buildMode ? null : buildType)
      e.preventDefault()
    } else if (k === 'e' && buildMode && ghostPos && colony?.colonyLayer) {
      const score = colony.scoreAt?.(ghostPos.lon, ghostPos.lat) ?? EMPTY_SCORE
      colony.colonyLayer.place(buildType, ghostPos.lon, ghostPos.lat, ghostPos.altM, score)
      colony.onPlace?.()
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
    setBuildMode(type) {
      buildMode = type !== null
      buildType = type ?? 'habitat'
      if (!buildMode) colony?.colonyLayer?.hideGhost()
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
      removeSiteModels()
      if (colony?.colonyLayer) colony.colonyLayer.show = false
      markers.forEach((m, i) => (m.show = markersShown[i] ?? m.show))
      controller.enableInputs = true
      controller.enableCollisionDetection = saved.collision
      scene.verticalExaggeration = VERTICAL_EXAGGERATION
      globe.maximumScreenSpaceError = saved.sse
      scene.fog.enabled = saved.fog
      scene.fog.renderable = saved.fogDrawn
      viewer.resolutionScale = saved.scale
      viewer.useBrowserRecommendedResolution = saved.browserRes
      scene.msaaSamples = saved.msaa
      scene.postProcessStages.fxaa.enabled = saved.fxaa
      if (saved.near !== undefined) (cam.frustum as { near?: number }).near = saved.near
      globe.tileCacheSize = saved.tileCache
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
