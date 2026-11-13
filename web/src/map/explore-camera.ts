/** First-person explore mode: walk the real terrain of a site at 1:1 scale, in Mars conditions. */
import { type Suit, suitAfter, walkResolution } from '../core/walk-suit'
import {
  BillboardCollection,
  Cartesian2,
  Cartesian3,
  Cartographic,
  Color,
  Math as CesiumMath,
  LabelCollection,
  Material,
  Model,
  PolylineCollection,
  type Viewer,
} from 'cesium'
import type { Hardware } from '../core/hardware'
import { fitScale, footprintRadiusM, liftToGround } from '../core/hardware'
import { type Obstacle, pushOut } from '../core/obstacles'
import { stormAhead } from '../core/seasonal-storms'
import { earthMarsLink } from '../core/light-time'
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
  panelDustFactor,
  surfaceConditions,
  underStorm,
  withHaze,
} from '../core/surface-conditions'
import type { SolWeather } from '../core/weather'
import { type DustDevil, createMarsAtmosphere } from './mars-atmosphere'
import { loadSiteModels, siteModelObstacles } from './site-models'
import {
  type VehicleState,
  createVehicle,
  stepVehicle,
  vehicleMatrix,
  distM as vehicleDistM,
  DEFAULT_TOP_SPEED_MS,
} from './explore-vehicle'
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
const WALKER_RADIUS_M = 0.4 // a suited astronaut's half-width, with the backpack
// Arrive by descending from this height: the fine terrain and HiRISE tiles load on the way down
// instead of popping in around a walker already standing on coarse, blurry ground.
const DESCENT_FROM_M = 400
const DESCENT_S = 3.5
const DESCENT_PITCH_DEG = -40
// Chase camera behind and above the rover: about two rover lengths back.
const CHASE_BACK_M = 14
const CHASE_UP_M = 5
// The guide line floats this far above the ground so the terrain never swallows it.
const GUIDE_LIFT_M = 0.4
const GUIDE_STEP_M = 4
// How far ahead the tablet looks for a simulated storm (sols).
const STORM_LOOKAHEAD_SOLS = 5

/**
 * The pressurised rover. Model: "mars_rover (1).glb" from the team's 3D models folder, compressed
 * with glTF-Transform (meshopt, WebP). Extent and floor measured from its bounding box in glTF
 * units. Real size: the NASA Multi-Mission Space Exploration Vehicle stands about 3 m tall
 * (NASA JSC fact sheet FS-2011-07-016-JSC), so the model is scaled to 3 m high.
 */
const PRESSURISED_ROVER: Hardware = {
  id: 'pressurised-rover',
  label: 'Pressurised rover',
  url: 'models/pressurised-rover.glb',
  extent: { x: 6.55, y: 5.0, z: 11.062 },
  floorY: -2.75,
  real: { dimension: 'height', metres: 3 },
  realSource: 'About 3 m tall like NASA’s Space Exploration Vehicle (NASA JSC FS-2011-07-016-JSC)',
  credit: 'Pressurised Mars rover model from the team’s 3D models folder (Sketchfab)',
}
// Its footprint as a circle: walkers stop at it, and a driven rover stops at the base.
const ROVER_RADIUS_M = footprintRadiusM(PRESSURISED_ROVER)
// glTF faces +Z; Cesium turns that into the model's +X, which heading 0 points east.
const ROVER_HEADING_OFFSET_DEG = -90
const ROVER_LIFT_M = liftToGround(PRESSURISED_ROVER)

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
  /** The rover: where it is relative to the walker and how it is driving; null if none. */
  vehicle: {
    inside: boolean
    distanceM: number
    speedMs: number
    pitchDeg: number
    rollDeg: number
    blocked: string | null
    topSpeedMs: number
  } | null
  /** The nearest dust devil in sight, if any. */
  devil: { distanceM: number; bearingDeg: number; driftToDeg: number; heightM: number } | null
  /** Share of light the solar arrays still pass after the dust settled since arrival (1 = clean). */
  panelClean: number
  /** Sunlight reaching the ground straight through the dust column, 0-1 (Beer-Lambert). */
  directSun: number
  /** A simulated storm due within a few sols, for the warning. */
  stormAhead: { name: string; inSols: number } | null
  /** Sols of dust settling since arrival on the map clock. */
  solsHere: number
}

export type ExploreSession = {
  stop(): void
  /** Show the 2018 global dust storm at this moment instead of the actual conditions. */
  setStormReplay(on: boolean): void
  /** Dust opacity set by hand for the look of the sky, or null for the actual conditions. */
  setHaze(tau: number | null): void
  /** Enter build mode for the given module type, or pass null to exit build mode. */
  setBuildMode(type: ModuleType | null): void
  /** Game-speed boost for walking (1 = a suited astronaut's real pace). */
  setWalkBoost(factor: number): void
  /** The rover's top speed, m/s. */
  setTopSpeed(ms: number): void
  /** Draw a line on the ground to follow, or null to clear it. `checked` = safe planned route. */
  setGuide(points: Array<{ lon: number; lat: number }> | null, checked: boolean): void
  /** Fine visual grain on the near ground (see mars-atmosphere.ts). */
  setGrain(on: boolean): void
}

export type ExploreColonyOpts = {
  /** Other solid things on the ground (the Story base), read each frame. */
  obstacles?: () => readonly Obstacle[]
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
  const walkRes = walkResolution(window.devicePixelRatio || 1)
  viewer.useBrowserRecommendedResolution = walkRes.useBrowserRecommendedResolution
  viewer.resolutionScale = walkRes.resolutionScale
  // 4x MSAA makes the atmosphere pass resolve multisampled colour and depth every frame: 58 ms
  // vs 24 ms a frame measured on Iris Xe at 1808x873. FXAA smooths edges for a fraction of that.
  scene.msaaSamples = 1
  scene.postProcessStages.fxaa.enabled = true

  const siteId: SiteId = site.id === 'gale' ? 'gale' : 'jezero'
  let sols: readonly SolWeather[] = []
  void weather.then((s) => (sols = s)).catch(() => undefined) // climatology until it arrives
  const groundAt = (lon: number, lat: number) => sampleGrid(site.grid, lon, lat)
  const removeSiteModels = loadSiteModels(scene, site.id, groundAt)

  // Driveable rover — placed at the site's historical landing coordinates.
  // jezero: Perseverance Mars 2020 landing (JPL EDL), offset 20 m south so it doesn't
  //         overlap the static perseverance.glb placed by site-models.ts.
  // viking2: DEM patch centre (actual Viking 2 lander at 48.27°N is outside the patch).
  const ROVER_COORDS: Partial<Record<string, { lon: number; lat: number }>> = {
    jezero: { lon: 77.4508, lat: 18.4444 }, // 20 m south of exact landing
    viking2: { lon: 134.2856, lat: 47.6603 },
  }
  let vehicle: VehicleState | null = null
  let inVehicle = false
  let vehicleModel: Model | null = null
  const roverSpawn = ROVER_COORDS[site.id] ?? {
    lon: from.lon + 20 / (M_PER_DEG * Math.cos((from.lat * Math.PI) / 180)),
    lat: from.lat,
  }
  const roverAlt = groundAt(roverSpawn.lon, roverSpawn.lat)
  if (isFinite(roverAlt)) {
    vehicle = createVehicle(roverSpawn.lon, roverSpawn.lat, roverAlt)
    void Model.fromGltfAsync({
      url: PRESSURISED_ROVER.url,
      modelMatrix: vehicleMatrix(vehicle, ROVER_LIFT_M, ROVER_HEADING_OFFSET_DEG),
      scale: fitScale(PRESSURISED_ROVER.extent, PRESSURISED_ROVER.real),
    })
      .then((m) => {
        scene.primitives.add(m)
        vehicleModel = m
      })
      .catch(() => undefined)
  }

  const siteSolids = siteModelObstacles(site.id)
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

  let suit: Suit = { o2Pct: 100, powerPct: 100 }

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
  let walkBoost = 1
  let topSpeedMs = DEFAULT_TOP_SPEED_MS
  let grain = true
  // Dust settles on the arrays from arrival onwards, as the map clock runs (it can be sped up).
  const arrivedAtMs = sceneTimeMs()
  const SOL_MS = 88_775_244
  const measure = () => {
    const utcMs = sceneTimeMs()
    const lmstHours = localMeanSolarTimeHours(utcMs, body.lon)
    const actual = surfaceConditions({
      utcMs,
      ls: solarLongitudeDeg(utcMs),
      lmstHours,
      site: siteId,
      sols,
    })
    const sunElDeg = sunPosition(utcMs, body.lon, body.lat).elevationDeg
    const shown = stormReplay
      ? underStorm(actual, lmstHours)
      : hazeTau === null
        ? actual
        : withHaze(actual, hazeTau)
    const sinEl = Math.sin((sunElDeg * Math.PI) / 180)
    return {
      lmstHours,
      sunElDeg,
      // The replay and the haze slider change the sky only; panels follow the actual dust.
      panelClean: panelDustFactor(arrivedAtMs, utcMs, siteId),
      // Beer-Lambert along the slant path (airmass ~ 1/sin elevation).
      directSun: sinEl > 0 ? Math.exp(-shown.tau / Math.max(sinEl, 0.03)) : 0,
      stormAhead: stormReplay ? null : stormAhead(utcMs, STORM_LOOKAHEAD_SOLS),
      solsHere: Math.max(0, (utcMs - arrivedAtMs) / SOL_MS),
      conditions: shown,
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
      grain,
    }
  }

  /** The nearest live dust devil, as the walker sees it. */
  const nearestDevil = (): ExploreFrame['devil'] => {
    const here = {
      east: (body.lon - from.lon) * M_PER_DEG * Math.cos((from.lat * Math.PI) / 180),
      north: (body.lat - from.lat) * M_PER_DEG,
    }
    let best: ExploreFrame['devil'] = null
    for (const d of devils) {
      const de = d.east - here.east
      const dn = d.north - here.north
      const distanceM = Math.hypot(de, dn)
      if (best && best.distanceM <= distanceM) continue
      best = {
        distanceM,
        bearingDeg: ((Math.atan2(de, dn) * 180) / Math.PI + 360) % 360,
        driftToDeg: WIND_TO_DEG,
        heightM: d.heightM,
      }
    }
    return best
  }

  // The guide line to a chosen place, hugging the ground.
  const guideLines = scene.primitives.add(new PolylineCollection()) as PolylineCollection
  const setGuide = (points: Array<{ lon: number; lat: number }> | null, checked: boolean) => {
    guideLines.removeAll()
    if (!points || points.length < 2) return
    const dense: Cartesian3[] = []
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i] as { lon: number; lat: number }
      const b = points[i + 1] as { lon: number; lat: number }
      const lenM = vehicleDistM(a.lon, a.lat, b.lon, b.lat, M_PER_DEG)
      const n = Math.max(1, Math.ceil(lenM / GUIDE_STEP_M))
      for (let k = 0; k < n; k++) {
        const lon = a.lon + ((b.lon - a.lon) * k) / n
        const lat = a.lat + ((b.lat - a.lat) * k) / n
        const h = groundAt(lon, lat)
        if (Number.isFinite(h))
          dense.push(Cartesian3.fromDegrees(lon, lat, h + GUIDE_LIFT_M, MARS_SPHERE))
      }
    }
    const last = points.at(-1) as { lon: number; lat: number }
    const hEnd = groundAt(last.lon, last.lat)
    if (Number.isFinite(hEnd))
      dense.push(Cartesian3.fromDegrees(last.lon, last.lat, hEnd + GUIDE_LIFT_M, MARS_SPHERE))
    guideLines.add({
      positions: dense,
      width: checked ? 10 : 6,
      material: checked
        ? Material.fromType(Material.PolylineGlowType, {
            color: Color.fromCssColorString('#3fe0c5'),
            glowPower: 0.25,
          })
        : Material.fromType(Material.PolylineDashType, {
            color: Color.fromCssColorString('#ffb347'),
            dashLength: 24,
          }),
    })
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
    if (inVehicle && vehicle) {
      // Third-person camera: 12 m behind, 4 m above the rover
      const hRad = CesiumMath.toRadians(vehicle.headingDeg)
      const cosLat = Math.cos((vehicle.lat * Math.PI) / 180)
      const camLon = vehicle.lon - (CHASE_BACK_M * Math.sin(hRad)) / (M_PER_DEG * cosLat)
      const camLat = vehicle.lat - (CHASE_BACK_M * Math.cos(hRad)) / M_PER_DEG
      viewer.camera.setView({
        destination: Cartesian3.fromDegrees(
          camLon,
          camLat,
          Math.max(vehicle.altM, groundAt(camLon, camLat) || vehicle.altM) + CHASE_UP_M,
          MARS_SPHERE,
        ),
        orientation: { heading: hRad, pitch: CesiumMath.toRadians(-12), roll: 0 },
      })
      return
    }
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

    const solid = [...siteSolids, ...(colony?.obstacles?.() ?? [])]
    if (inVehicle && vehicle) {
      vehicle = stepVehicle(vehicle, keys, dtS, groundAt, M_PER_DEG, topSpeedMs)
      // A rover that drives into hardware stops against it, sliding along if it hit at an angle.
      const out = pushOut(vehicle.lon, vehicle.lat, solid, ROVER_RADIUS_M)
      if (out.hit) vehicle = { ...vehicle, lon: out.lon, lat: out.lat, speedMs: 0 }
      if (vehicleModel)
        vehicleModel.modelMatrix = vehicleMatrix(vehicle, ROVER_LIFT_M, ROVER_HEADING_OFFSET_DEG)
      // The walker rides along, so the tablet's position and guide follow the rover.
      body = {
        ...body,
        lon: vehicle.lon,
        lat: vehicle.lat,
        feetM: vehicle.altM,
        speedMs: Math.abs(vehicle.speedMs),
        headingDeg: vehicle.headingDeg,
      }
    } else {
      const before = body
      body = stepBody(body, input(dtS), dtS, site.grid, walkBoost)
      // Nobody walks through a rover or the base: back to its edge, keeping the sideways step.
      const parked = vehicle
        ? [{ lon: vehicle.lon, lat: vehicle.lat, radiusM: ROVER_RADIUS_M }]
        : []
      const out = pushOut(body.lon, body.lat, [...solid, ...parked], WALKER_RADIUS_M)
      // Pressing against it is not distance walked.
      if (out.hit) body = { ...body, lon: out.lon, lat: out.lat, distanceM: before.distanceM }
      jumpQueued = false
      if (!before.grounded && body.grounded) landingDipM = Math.min(0.25, -before.vzMs * 0.05)
    }
    if (t - measuredAt > CONDITIONS_EVERY_MS) {
      now = measure()
      measuredAt = t
    }
    updateDevils(dtS, Date.now())
    atmosphere.setState(atmosphereState())
    place(dtS)

    // Suit consumables: the boost is game speed, so the suit is charged for the real pace; inside
    // the pressurised rover the suit is not in use.
    if (!inVehicle) suit = suitAfter(suit, body.grounded ? body.speedMs / walkBoost : 0, dtS)

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
      suitO2Pct: suit.o2Pct,
      suitPowerPct: suit.powerPct,
      radiationMsvPerHr: activeDoseRate,
      cumulativeMsv,
      spe,
      marsquake,
      resourceScore,
      commsDelayMin: earthMarsLink(Date.now()).delayMin,
      vehicle: vehicle
        ? {
            inside: inVehicle,
            distanceM: vehicleDistM(body.lon, body.lat, vehicle.lon, vehicle.lat, M_PER_DEG),
            speedMs: vehicle.speedMs,
            pitchDeg: vehicle.pitchDeg,
            rollDeg: vehicle.rollDeg,
            blocked: vehicle.blocked,
            topSpeedMs,
          }
        : null,
      devil: nearestDevil(),
    })
    colony?.colonyLayer?.setSolarDust(1 - now.panelClean)
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
  // Typing in the tablet (place search) must not walk the astronaut; Esc just leaves the field.
  const typing = (e: KeyboardEvent) =>
    e.target instanceof HTMLInputElement && e.target.type !== 'range' && e.target.type !== 'button'
  const onKeyDown = (e: KeyboardEvent) => {
    if (typing(e)) {
      if (e.key === 'Escape') (e.target as HTMLElement).blur()
      return
    }
    const k = e.key.toLowerCase()
    if (k === 'escape') return session.stop()
    if (k === 'f') {
      if (!inVehicle && vehicle) {
        if (vehicleDistM(body.lon, body.lat, vehicle.lon, vehicle.lat, M_PER_DEG) < 15) {
          inVehicle = true
        }
      } else if (inVehicle && vehicle) {
        inVehicle = false
        // Drop the player just beside the rover on exit
        body = restingBody(
          {
            lon: vehicle.lon,
            lat: vehicle.lat,
            headingDeg: vehicle.headingDeg,
            distanceM: body.distanceM,
            warning: null,
          },
          vehicle.altM,
        )
      }
      e.preventDefault()
    } else if (k === ' ') {
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
    // Grab the view: the ground follows the pointer, as when dragging the map.
    body = {
      ...body,
      headingDeg: (body.headingDeg - (e.clientX - drag.x) * LOOK_DEG_PER_PX + 360) % 360,
    }
    pitchDeg = Math.max(
      -PITCH_LIMIT_DEG,
      Math.min(PITCH_LIMIT_DEG, pitchDeg + (e.clientY - drag.y) * LOOK_DEG_PER_PX),
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
    setWalkBoost(factor) {
      walkBoost = factor
    },
    setTopSpeed(ms) {
      topSpeedMs = ms
    },
    setGuide,
    setGrain(on) {
      grain = on
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
      if (vehicleModel) scene.primitives.remove(vehicleModel)
      scene.primitives.remove(guideLines)
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
