import { KILOPOWER_FACTS } from './core/hardware-facts'
import { openHardwareCard } from './ui/hardware-card'
import { type Progress, loadProgress } from './core/mission-progress'
import { MISSIONS } from './core/missions'
import { loadProfile } from './core/profile'
import { type HardwareLayer, createHardwareLayer } from './map/hardware-layer'
import { placeBase, placeRovers } from './map/hardware-placement'
import { type BasePlacer, createBasePlacer } from './map/base-placer'
import { type LandingScene, createLandingScene } from './map/landing-scene'
import { type FeaturePins, createFeaturePins } from './map/feature-pins'
import './style.css'
import './episodes.css'
import { type Site, elevationAt, parseMola, siteAt } from './core/elevation'
import { heroReadings } from './core/hero-readings'
import { pushExploreKPIs, pushScienceKPIs } from './ui/hero-state'
import { type Grid, lonLatToCell, parseGrid } from './core/grid'
import { type LayerId, addLayers } from './map/layers'
import { createRouteClient } from './map/route-client'
import { type WalkMap, createWalkMap } from './map/marswalk-map'
import { type Activity, addActivities } from './map/activities-layer'
import { createReplay } from './map/replay'
import { addStreetViewStops } from './map/streetview-layer'
import { createRangeLayer } from './map/range-layer'
import { createRouteLayer } from './map/route-layer'
import { createTerrain, keepCameraAboveGround } from './map/terrain'
import { installKeyboardCamera } from './map/keyboard-camera'
import { startIdleSpin } from './map/idle-spin'
import { installScaleBar } from './map/scale-bar'
import { sceneTimeMs } from './map/sun'
import { installWheelZoom } from './map/wheel-zoom'
import { decodeView, encodeView } from './core/deeplink'
import {
  applyView,
  createMarsViewer,
  currentView,
  flyToPlace,
  viewAoi,
  viewCentre,
  viewGlobe,
} from './map/viewer'
import { loadWeather, type WeatherStation } from './map/weather-client'
import { addStationPins, stationPositions } from './map/weather-stations'
import { parseBenchmark } from './core/benchmark'
import { activityDetails } from './ui/activity-card'
import { asPopup, closePopup, openPopup } from './ui/popup'
import { renderBenchmarkCard } from './ui/benchmark-card'
import { renderClock } from './ui/clock'
import { renderConnectionBadge } from './ui/connection-badge'
import { openExplore } from './ui/explore-hud'
import { renderDock, showDockTab } from './ui/dock'
import { renderInstrumentDrawer } from './ui/instrument-drawer'
import { renderHeader } from './ui/header'
import { dismissFirstScreen, openProfileGate } from './ui/profile-gate'
import { renderLayerPanel } from './ui/layer-panel'
import { renderReadout } from './ui/readout'
import { installAskAtlas } from './ui/ask-atlas'
import { askScreen } from './ui/ask-atlas-screen'
import { renderSiteReport } from './ui/site-report'
import { installCentreMarker, settledSnapshot, viewSnapshot } from './ui/centre-marker'
import type { SwimGrid } from './core/site-report'
import { Cartesian3, ScreenSpaceEventHandler, ScreenSpaceEventType } from 'cesium'
import { MARS_SPHERE } from './map/mars'
import { isExploring } from './map/picking'
import type { Place } from './core/search'
import { renderLinkPanel } from './ui/link-panel'
import { renderQuestPanel } from './ui/quest-panel'
import { renderRoutePanel } from './ui/route-panel'
import { nearestRoverStop, rememberVisit } from './core/streetview'
import { setGlobePause } from './ui/stage-loop'
import { watchContextLoss } from './ui/context-loss'
import { openStreetView } from './ui/streetview-viewer'
import { createLineLegend } from './ui/line-legend'
import { openWalkPlayer, updateWalkPlayer } from './ui/walk-player'
import type { Rover } from './map/raw-images'
import { renderTimelineBar } from './ui/timeline-bar'
import { positionAtSol } from './core/timeline'
import { loadPlaces, renderSearchBox } from './ui/search-box'
import { type TraverseMap, createTraverseMap } from './map/traverse-map'
import { renderWeatherPanel } from './ui/weather-panel'
import { renderZonePanel } from './ui/zone-panel'
import type { ZoneRow } from './core/zone-rank'
import { renderDustPanel } from './ui/dust-panel'
import { renderScenarioPanel } from './ui/scenario-panel'
import { renderSyncPanel } from './ui/sync-panel'
import { renderGeologyPanel } from './ui/geology-panel'
import { renderComparePanel } from './ui/compare-panel'
import type { SiteId } from './core/surface-conditions'
import { renderDosePanel } from './ui/dose-panel'
import { renderDeltaCard } from './ui/delta-card'
import { localMeanSolarTimeHours, nextLocalHourMs, solarLongitudeDeg } from './core/mars-time'
import { firmerThanPct, thermalAt } from './core/thermal'
import { type SiteThermal, addThermalLayer, loadThermalGrids } from './map/thermal-layer'
import { addCrismLayer, loadCrismGrids } from './map/crism-layer'
import { createCaveLayer } from './map/caves-layer'
import { createWalkGround } from './map/walk-ground'
import { renderCaveCard } from './ui/cave-card'
import { iceAt } from './core/site-report'
import { type ColonyScoreGrid, loadColonyScore, colonyScoreAt } from './core/colony-score'
import { computeBudget } from './core/colony-budget'

import { createColonyLayer } from './map/colony-modules'
import { renderColonyPanel } from './ui/colony-panel'
import { renderColonySummary } from './ui/colony-summary-panel'

async function fetchOk(url: string): Promise<Response> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status} (did you run make data?)`)
  return response
}

type SiteInfo = { id: string; name: string; rover: string; source: string }

async function loadSites(): Promise<Site[]> {
  const index = (await fetchOk('data/sites.json').then((r) => r.json())) as { sites: SiteInfo[] }
  return Promise.all(
    index.sites.map(async (info) => {
      const [meta, bin] = await Promise.all([
        fetchOk(`data/sites/${info.id}/grid.json`).then((r) => r.json()),
        fetchOk(`data/sites/${info.id}/grid.bin`).then((r) => r.arrayBuffer()),
      ])
      return { ...info, grid: parseGrid(meta, bin) }
    }),
  )
}

async function loadSwim(): Promise<SwimGrid> {
  const [meta, bin] = await Promise.all([
    fetchOk('data/swim.json').then((r) => r.json()),
    fetchOk('data/swim.bin').then((r) => r.arrayBuffer()),
  ])
  return { ...(meta as Omit<SwimGrid, 'values'>), values: new Int8Array(bin) }
}

/** Named places (IAU nomenclature and more), loaded once for search and Story mission 1.9. */
const placesOnce = loadPlaces().catch(() => [] as Place[])

/** SWIM shallow ice, loaded once for the Site Report and Story mission 1.8. */
let swimOnce: Promise<SwimGrid | null> | undefined
const getSwim = () => (swimOnce ??= loadSwim().catch(() => null))

async function loadMola(): Promise<Grid> {
  const [meta, bin] = await Promise.all([
    fetchOk('data/mola.json').then((r) => r.json()),
    fetchOk('data/mola.bin').then((r) => r.arrayBuffer()),
  ])
  return parseMola(meta, bin)
}

/** localStorage, or undefined where touching it throws (some private windows). */
function browserStorage(): Storage | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

/** This browser's saved Story progress, if a profile exists. */
function savedProgress(): Progress | null {
  const store = browserStorage()
  const profile = loadProfile(store).profile
  if (!profile) return null
  return loadProgress(
    store,
    profile.createdAt,
    MISSIONS.map((m) => m.id),
  ).progress
}

async function main() {
  const globe = document.getElementById('globe')
  const ui = document.getElementById('ui')
  if (!globe || !ui) throw new Error('#globe / #ui elements missing')
  // A shared map link goes straight to the map; everyone else starts at the profile and mode choice.
  // Story mode opens before the map data arrives; its zone list resolves once data is in.
  let resolveZones: (rows: ZoneRow[] | Promise<ZoneRow[]>) => void = () => undefined
  const zonesReady = new Promise<ZoneRow[]>((resolve) => (resolveZones = resolve))
  let resolveSites: (sites: Site[]) => void = () => undefined
  const sitesReady = new Promise<Site[]>((resolve) => (resolveSites = resolve))
  let resolveMola: (mola: Grid) => void = () => undefined
  const molaReady = new Promise<Grid>((resolve) => (resolveMola = resolve))
  // Missions can ask for a site before the terrain data has loaded; remember the latest ask.
  const siteView: {
    show?: (id: string) => void
    globe?: () => void
    pending?: string
    imageryWanted?: boolean
    pins?: FeaturePins
    landing?: LandingScene
    base?: BasePlacer
    hardware?: HardwareLayer
    walk?: WalkMap
    traverse?: TraverseMap
    declutter?: (on: boolean) => void
    imagery?: () => void
  } = {}
  // A mission can start before the rover stops have loaded: remember its wish, apply it on load.
  let stopsWanted = true
  let missionDeclutter = false
  let applyDeclutter = () => {}
  siteView.declutter = (on) => {
    missionDeclutter = on
    applyDeclutter()
  }
  const walkMap = () => {
    if (!siteView.walk) throw new Error('The map is still loading; try the walk again in a moment.')
    return siteView.walk
  }
  const showSite = (id: string) => (siteView.show ? siteView.show(id) : (siteView.pending = id))
  const openStart = (resume?: 'story') =>
    openProfileGate(
      browserStorage(),
      [globe, ui],
      () => {},
      {
        loadZones: () => zonesReady,
        showSite,
        showImagery: () =>
          siteView.imagery ? siteView.imagery() : (siteView.imageryWanted = true),
        // Before the viewer exists the opening view is already the turning globe.
        showGlobe: () => siteView.globe?.(),
        pins: {
          show: (features, onPick) => siteView.pins?.show(features, onPick),
          select: (index) => siteView.pins?.select(index),
        },
        landing: {
          show: (t) => siteView.landing?.show(t),
          clear: () => siteView.landing?.clear(),
        },
        base: {
          pick: (cb) => siteView.base?.pick(cb),
          draw: (layout, failing) => siteView.base?.draw(layout, failing),
          view: (c, r) => siteView.base?.view(c, r),
          clear: () => siteView.base?.clear(),
        },
        declutter: (on) => siteView.declutter?.(on),
        walk: {
          layer: (g) => walkMap().layer(g),
          client: (g) => walkMap().client(g),
          overlay: (g, kind) => walkMap().overlay(g, kind),
          crew: (lon, lat, heading, follow) => siteView.walk?.crew(lon, lat, heading, follow),
          zoom: (factor) => siteView.walk?.zoom(factor),
          release: () => siteView.walk?.release(),
          view: (points) => siteView.walk?.view(points),
          clear: () => siteView.walk?.clear(),
        },
        siteGrid: (id) => sitesReady.then((list) => list.find((x) => x.id === id)?.grid),
        swim: getSwim,
        mola: () => molaReady,
        places: () => placesOnce,
        traverse: {
          draw: (b, s, r, p) => siteView.traverse?.draw(b, s, r, p),
          rover: (p, t, h) => siteView.traverse?.rover(p, t, h),
          follow: (on) => siteView.traverse?.follow(on),
          zoom: (factor) => siteView.traverse?.zoom(factor),
          view: (pts) => siteView.traverse?.view(pts),
          clear: () => siteView.traverse?.clear(),
        },
        showBase: (progress) => siteView.hardware && placeBase(siteView.hardware, progress),
      },
      resume,
    )
  if (decodeView(window.location.search)) dismissFirstScreen()
  else openStart()
  const { viewer, hirise, offFoot } = createMarsViewer(globe)
  setGlobePause((paused) => {
    viewer.useDefaultRenderLoop = !paused
  })
  watchContextLoss(viewer.scene.canvas)
  if (import.meta.env.DEV) Object.assign(window, { viewer }) // console debugging only
  const [sites, mola] = await Promise.all([loadSites(), loadMola()])
  resolveSites(sites)
  resolveMola(mola)
  const home = sites[0]
  if (!home) throw new Error('sites.json lists no sites')
  const shared = decodeView(window.location.search)
  const setLayer: { current?: (id: LayerId, visible: boolean) => void } = {}
  siteView.show = (id) => {
    const site = sites.find((x) => x.id === id)
    if (!site) return
    viewAoi(viewer, site.grid)
    // As the header's site buttons do: a site view needs its imagery.
    if (setLayer.current) setLayer.current('imagery', true)
    else siteView.imageryWanted = true
  }
  if (siteView.pending) siteView.show(siteView.pending)
  siteView.imagery = () => {
    if (setLayer.current) setLayer.current('imagery', true)
    else siteView.imageryWanted = true
  }
  siteView.globe = () =>
    viewGlobe(
      viewer,
      (home.grid.west + home.grid.east) / 2,
      (home.grid.south + home.grid.north) / 2,
    )
  const exploreRef: { current?: (siteId: string, b: HTMLButtonElement) => Promise<void> } = {}
  renderHeader(ui, sites, {
    onView: (view) => {
      const site = sites.find((s) => s.id === view)
      if (site) {
        viewAoi(viewer, site.grid)
        setLayer.current?.('imagery', true) // a site view is about its imagery
      } else
        viewGlobe(
          viewer,
          (home.grid.west + home.grid.east) / 2,
          (home.grid.south + home.grid.north) / 2,
        )
    },
    onStory: () => openStart('story'),
    onExploreOnFoot: (id, button) => void exploreRef.current?.(id, button),
    initialView: shared ? undefined : 'mars',
  })
  const ground = createWalkGround(viewer, sites, mola)
  const groundM = ground.height
  // Height of the ground as drawn (terrain x vertical exaggeration). Markers sit on it directly:
  // CLAMP_TO_GROUND left most of them km above the terrain, off the draped lines and clicks.
  const surfaceM = (lon: number, lat: number) =>
    (groundM(lon, lat) || 0) * viewer.scene.verticalExaggeration
  siteView.pins = createFeaturePins(viewer, surfaceM)
  siteView.landing = createLandingScene(viewer, surfaceM)
  siteView.base = createBasePlacer(viewer, surfaceM)
  siteView.walk = createWalkMap(viewer, surfaceM)
  siteView.traverse = createTraverseMap(viewer, surfaceM)
  // Hardware on Mars at true size: the Story base from this browser's saved progress.
  const hardware = createHardwareLayer(viewer, (lon, lat) => groundM(lon, lat) || 0)
  siteView.hardware = hardware
  if (import.meta.env.DEV) Object.assign(window, { hardware }) // console debugging only
  placeBase(hardware, savedProgress())
  hardware.onPick((key) => {
    if (key.startsWith('base:kilopower')) openHardwareCard(KILOPOWER_FACTS)
  })
  installWheelZoom(viewer, surfaceM)
  installKeyboardCamera(viewer, () =>
    document.querySelector<HTMLButtonElement>('[data-act="add"]')?.click(),
  )
  viewer.terrainProvider = createTerrain(groundM)
  keepCameraAboveGround(viewer, groundM)
  // A shared link opens on its own view; a plain visit opens on Mars, 500 km up, turning slowly.
  const spin = shared
    ? null
    : startIdleSpin(
        viewer,
        (home.grid.west + home.grid.east) / 2,
        (home.grid.south + home.grid.north) / 2,
      )
  if (shared) applyView(viewer, shared)
  keepUrlInSync(viewer, () => spin?.spinning === true)
  const openRef: { current?: (ref: string) => void } = {}
  const placesReady = placesOnce
  let loadedPlaces: Place[] = [] // for the walk dashboard's "near you"
  void placesReady.then((p) => (loadedPlaces = p)).catch(() => undefined)
  let thermalGrids: SiteThermal[] = [] // ground firmness, once it has loaded
  void placesReady.then((places) =>
    renderSearchBox(ui, places, (p) => {
      flyToPlace(viewer, p.lon, p.lat, p.sizeKm)
      if (p.ref) openRef.current?.(p.ref)
    }),
  )
  // Planner and readout need only the grid: paint them before the heavier layers stream in.
  const side = document.createElement('div')
  side.className = 'side'
  ui.append(side)
  const lineLegend = createLineLegend(viewer)
  const quest = renderQuestPanel(side)
  // Filled in after streetView loads; safe because the walk player opens only after user interaction.
  // eslint-disable-next-line prefer-const
  let walkStreetView: ((lon: number, lat: number) => void) | undefined
  const routePanel = renderRoutePanel(side, viewer, sites, {
    makeClient: createRouteClient,
    makeLayer: (g) => createRouteLayer(viewer, g, { surfaceM, legend: lineLegend }),
    makeRange: (g) => createRangeLayer(viewer, g),
    onEvent: quest.notify,
    onHazardOp: (op) => sync.record(op),
    onStartWalk: (params) => {
      openWalkPlayer(viewer, params, (lon, lat) => walkStreetView?.(lon, lat), {
        surfaceM,
        legend: lineLegend,
        siteName: sites.find((s) => s.id === params.siteId)?.name.split(' (')[0],
        places: () => loadedPlaces,
        nowMs: sceneTimeMs,
        firmnessAt: (lon, lat) => {
          const grid = thermalGrids.find((t) => t.site.id === params.siteId)?.grid
          const value = grid ? thermalAt(grid, lon, lat) : null
          return grid && value !== null ? { value, softerPct: firmerThanPct(grid, value) } : null
        },
      })
    },
    onWalkPlan: updateWalkPlayer,
  })
  const sync = renderSyncPanel(side, routePanel.restoreHazards)
  // Optional validation card: a missing file must not take the planner down with it.
  void fetchOk('data/benchmark.json')
    .then((r) => r.json())
    .then((doc) => renderBenchmarkCard(side, parseBenchmark(doc)))
    .catch((error: unknown) => console.warn('Benchmark card not shown:', error))
  renderLinkPanel(side, routePanel.currentPlan, routePanel.currentBundle)
  renderDosePanel(side)
  renderDustPanel(side, sites, () => solarLongitudeDeg(sceneTimeMs()))
  asPopup(side.lastElementChild as HTMLDetailsElement, 'dust')
  // The clock is drawn further down; until then a time jump has nothing to move.
  const clockRef: { setTime: (utcMs: number) => void } = { setTime: () => {} }
  renderScenarioPanel(
    side,
    sites.map((s) => ({
      id: s.id as SiteId,
      name: s.name.split(' (')[0] ?? s.name,
      lon: (s.grid.west + s.grid.east) / 2,
      lat: (s.grid.south + s.grid.north) / 2,
    })),
    {
      nowMs: sceneTimeMs,
      setTime: (t) => {
        closePopup() // the season shows on the map, which the window covers
        clockRef.setTime(t)
      },
    },
  )
  asPopup(side.lastElementChild as HTMLDetailsElement, 'scenario')
  const openWeather = weatherOpener(() => launcher)
  const launcher = document.createElement('nav')
  launcher.className = 'panel wx-launch wx-panel'
  launcher.setAttribute('aria-label', 'Mars weather stations')
  launcher.innerHTML = `<span>Mars weather</span>
    <button type="button" data-station="rems">Gale</button>
    <button type="button" data-station="meda">Jezero</button>`
  for (const b of launcher.querySelectorAll<HTMLButtonElement>('button'))
    b.addEventListener('click', () => openWeather(b.dataset.station as WeatherStation))
  side.prepend(launcher)
  const roverPositions = stationPositions()
  void roverPositions.then((positions) => addStationPins(viewer, positions, surfaceM, openWeather))
  // Explore on foot: the header's button for the selected site.
  exploreRef.current = async (siteId, b) => {
    const site = sites.find((s) => s.id === siteId)
    if (!site || b.disabled) return
    const g = site.grid
    b.disabled = true // the walk patch may take a moment to arrive
    const patch = await ground.patch(site.id)
    b.disabled = false
    // Walk the high-resolution patch from its centre (a landing site) when there is one;
    // otherwise the site model, from the rover if it is inside it, else the site centre.
    let walkSite: Site = site
    let from = { lon: (g.west + g.east) / 2, lat: (g.south + g.north) / 2 }
    if (patch) {
      // On foot, the walk area is 1 m ground when the laptop CDN has it; else the 2 m patch.
      b.disabled = true
      const fine = await ground.startFineWalk(patch)
      b.disabled = false
      walkSite = fine
        ? { ...site, grid: fine, source: `${patch.source}; 1 m HiRISE DTM on foot` }
        : { ...site, grid: patch.grid, source: patch.source }
      from = patch.start
    } else {
      const positions = await roverPositions.catch(() => null)
      const rover = site.rover === 'Curiosity' ? positions?.rems : positions?.meda
      if (rover && lonLatToCell(g, rover[0], rover[1])) from = { lon: rover[0], lat: rover[1] }
    }
    // At night the whole view is black and nothing seems to open: arrive in the morning.
    const arriveAt = from
    const lmst = localMeanSolarTimeHours(sceneTimeMs(), arriveAt.lon)
    if (lmst < EXPLORE_DAY_START_H || lmst >= EXPLORE_DAY_END_H)
      clockRef.setTime(nextLocalHourMs(sceneTimeMs(), arriveAt.lon, EXPLORE_ARRIVAL_H))
    const emptyScore = {
      solar: null,
      ice: null,
      minerals: null,
      shelter: null,
      stability: null,
      wind: null,
    }
    for (const hide of exploreHooks) hide(true)
    openExplore(
      viewer,
      walkSite,
      from,
      () => {
        ground.endFineWalk()
        for (const hide of exploreHooks) hide(false)
        viewAoi(viewer, g)
        b.focus()
      },
      {
        colonyLayer,
        scoreAt: (lon, lat) => (colonyGrid ? colonyScoreAt(colonyGrid, lon, lat) : emptyScore),
        onPlace: () => colonySummaryCtrl.update(computeBudget([...colonyLayer.modules])),
      },
    )
  }
  // On foot the walk patch and the 25 cm site mosaics fill the view: drop the layers beneath.
  let offFootShown = offFoot.show
  const exploreHooks: Array<(on: boolean) => void> = [
    (on) => {
      if (on) offFootShown = offFoot.show
      offFoot.show = on ? false : offFootShown
    },
  ]
  // The colony panel is built further down; it reads the same place as the readout.
  let readPlace: { lon: number; lat: number; where: string } | null = null
  let onReadPlace = () => {}
  renderReadout(ui, viewer, sites, mola, (lon, lat, where) => {
    readPlace = { lon, lat, where }
    onReadPlace()
  })
  installAskAtlas(
    askScreen({ viewer, sites, mola, plan: routePanel.currentBundle, progress: savedProgress }),
  )
  // Settlement guide: right-click anywhere, or the readout's button for the view centre.
  const thermalReady = loadThermalGrids(sites)
  void thermalReady.then((t) => (thermalGrids = t)).catch(() => undefined)
  const crismReady = loadCrismGrids(sites)
  let colonyGrid: ColonyScoreGrid | null = null // set once the score grid loads, further down
  const openReport = async (lon: number, lat: number) => {
    const places: Place[] = await placesReady.catch(() => [])
    renderSiteReport(lon, lat, {
      sites,
      mola,
      places,
      swim: await getSwim(),
      thermal: (await thermalReady).map((t) => t.grid),
      score: colonyGrid ? colonyScoreAt(colonyGrid, lon, lat) : null,
      snapshot: viewSnapshot(viewer),
      utcMs: sceneTimeMs(),
    })
  }
  const loadZoneRows = async (): Promise<ZoneRow[]> => {
    const [places, swimGrid] = await Promise.all([placesReady, getSwim()])
    return places
      .filter((p) => p.kind === 'zone')
      .map((p) => ({
        name: p.name,
        lon: p.lon,
        lat: p.lat,
        elevationM: elevationAt(sites, mola, p.lon, p.lat).m ?? null,
        ice: swimGrid ? iceAt(swimGrid, p.lon, p.lat) : null,
      }))
  }
  resolveZones(loadZoneRows())
  renderZonePanel(side, loadZoneRows, (zone) => {
    closePopup()
    flyToPlace(viewer, zone.lon, zone.lat, 200)
  })
  asPopup(side.lastElementChild as HTMLDetailsElement, 'zones')
  new ScreenSpaceEventHandler(viewer.scene.canvas).setInputAction(
    (click: ScreenSpaceEventHandler.PositionedEvent) => {
      if (isExploring()) return // explore mode owns input
      const ray = viewer.camera.getPickRay(click.position)
      const hit = ray && viewer.scene.globe.pick(ray, viewer.scene)
      if (!hit) return
      const c = MARS_SPHERE.cartesianToCartographic(hit)
      void openReport((c.longitude * 180) / Math.PI, (c.latitude * 180) / Math.PI)
    },
    ScreenSpaceEventType.RIGHT_CLICK,
  )
  const readout = document.querySelector('.readout')
  readout?.insertAdjacentHTML(
    'beforeend',
    `<div class="report-actions">
      <button type="button" class="report-button">Site report for the view centre</button>
      <button type="button" class="centre-toggle" aria-pressed="true" title="Show or hide the view-centre marker">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/></svg>
        <span class="visually-hidden">View-centre marker</span>
      </button>
    </div>`,
  )
  readout?.querySelector('.report-button')?.addEventListener('click', () => {
    const c = viewCentre(viewer)
    if (c) void openReport(c.lon, c.lat)
  })
  installCentreMarker(globe, readout?.querySelector<HTMLButtonElement>('.centre-toggle') ?? null)
  Object.assign(clockRef, renderClock(ui, viewer))
  // The workbench strips read the view centre: after each camera move and as the clock runs.
  let swimGrid: SwimGrid | null = null
  const refreshHero = () => {
    const c = viewCentre(viewer)
    if (!c) return
    const firm = thermalGrids
      .map((t) => {
        const v = thermalAt(t.grid, c.lon, c.lat)
        return v === null ? null : firmerThanPct(t.grid, v)
      })
      .find((v) => v !== null)
    const r = heroReadings({
      lon: c.lon,
      lat: c.lat,
      elevationM: elevationAt(sites, mola, c.lon, c.lat).m ?? null,
      utcMs: sceneTimeMs(),
      station: siteAt(sites, c.lon, c.lat)?.id === 'gale' ? 'gale' : 'jezero',
      ice: swimGrid ? iceAt(swimGrid, c.lon, c.lat) : null,
      firmerThanPct: firm ?? null,
    })
    pushExploreKPIs(r.explore)
    pushScienceKPIs(r.science)
  }
  viewer.camera.moveEnd.addEventListener(refreshHero)
  window.setInterval(refreshHero, HERO_REFRESH_MS)
  refreshHero()
  void getSwim().then((g) => {
    swimGrid = g
    refreshHero()
  })
  renderConnectionBadge(ui)
  installScaleBar(viewer, ui)
  // Production only: a service worker in dev would serve stale files under hot reload.
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    navigator.serviceWorker
      .register(new URL('sw.js', document.baseURI).href)
      .catch((error: unknown) => console.warn('Offline cache unavailable:', error))
  }
  const layerToggles = await addLayers(viewer, sites, hirise, surfaceM)
  const thermalLayer = await addThermalLayer(viewer, await thermalReady)
  const crismLayer = await addCrismLayer(viewer, await crismReady)
  const siteCentres = sites.map((s) => ({
    name: s.name.split(' (')[0] ?? s.name,
    lon: (s.grid.west + s.grid.east) / 2,
    lat: (s.grid.south + s.grid.north) / 2,
  }))
  const caveLayer = createCaveLayer(viewer, (cave, doc) =>
    renderCaveCard(side, cave, doc, siteCentres),
  )
  let cavesShown = false
  // The globe is hidden behind Street View: stop redrawing it so the panorama gets the device.
  const showStreetView = (rover: Rover, index: number) => {
    viewer.useDefaultRenderLoop = false
    openStreetView(
      rover,
      streetView.stops[rover],
      index,
      document.activeElement as HTMLElement,
      () => {
        viewer.useDefaultRenderLoop = true
      },
      (visited) => {
        const stop = streetView.stops[rover][visited]
        if (stop) {
          try {
            rememberVisit(localStorage, rover, stop)
          } catch {
            // storage blocked: the pointer just won't survive a reload
          }
        }
        streetView.markVisited(rover, visited)
      },
    )
  }
  const streetView = await addStreetViewStops(viewer, surfaceM, showStreetView)
  // A mission hides the rover stops; the layer panel's own toggle must not bring them back.
  const showStops = () => streetView.setVisible(stopsWanted && !missionDeclutter)
  applyDeclutter = showStops
  showStops()
  placeRovers(hardware, streetView.stops)
  walkStreetView = (lon, lat) => {
    const near = nearestRoverStop(streetView.stops, lon, lat)
    if (near) showStreetView(near.rover, near.index)
  }
  /** A sample's window: its map view (the camera flies there behind it) and its NASA record. */
  const openActivity = (activity: Activity, back?: { label: string; onClick: () => void }) => {
    const map = document.createElement('figure')
    map.className = 'sample-map'
    map.innerHTML = '<p class="wx-loading" role="status">Loading the map view…</p>'
    const panorama = () => {
      if (activity.sol === null) return
      closePopup()
      const { index } = positionAtSol(streetView.stops.m20, activity.sol)
      showStreetView('m20', index)
    }
    openPopup({
      title: `Sample ${activity.number} · ${activity.name}`,
      subtitle: 'Perseverance rock sample · official NASA record',
      body: [map, activityDetails(activity, panorama)],
      back,
    })
    if (activity.lon === undefined || activity.lat === undefined) return map.remove()
    setLayer.current?.('imagery', true) // the map view is of the HiRISE ground
    const groundM = elevationAt(sites, mola, activity.lon, activity.lat).m
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(
        activity.lon,
        activity.lat,
        (Number.isFinite(groundM) ? groundM : 0) + SAMPLE_VIEW_HEIGHT_M,
        MARS_SPHERE,
      ),
      duration: 1.2,
    })
    void settledSnapshot(viewer).then((url) => {
      if (!url) return map.remove()
      map.innerHTML = `<div class="sample-map-frame"><img alt="Map view around sample ${activity.number}: HiRISE imagery, the sample at the centre"/></div><figcaption>Map view · the sample is at the centre · HiRISE (MRO)</figcaption>`
      ;(map.querySelector('img') as HTMLImageElement).src = url
    })
  }
  const samples = await addActivities(viewer, surfaceM, openActivity)
  openRef.current = (ref) => {
    const match = /^activity:(\d+)$/.exec(ref)
    const activity = match ? samples.activities[Number(match[1])] : undefined
    if (activity) openActivity(activity)
  }
  const sampleByNumber = (n: number) => samples.activities.find((a) => a.number === n)
  renderComparePanel(side)
  asPopup(side.lastElementChild as HTMLDetailsElement, 'compare')
  renderGeologyPanel(side, (lon, lat) => flyToPlace(viewer, lon, lat, 2))
  renderDeltaCard(
    side,
    (n) => sampleByNumber(n)?.name.replace(/\s*_\(.*\)_/, '') ?? null,
    (n) => {
      const a = sampleByNumber(n)
      if (a) openActivity(a, { label: "Jezero's delta", onClick: openDelta })
    },
  )
  const openDelta = asPopup(side.lastElementChild as HTMLDetailsElement, 'delta')
  renderDock(side)
  renderInstrumentDrawer()

  // Colony: score grid and placement layer (modules live in explore mode, not the map)
  const colonyPanel = renderColonyPanel(side)
  onReadPlace = () => {
    if (colonyGrid && readPlace)
      colonyPanel.update(colonyScoreAt(colonyGrid, readPlace.lon, readPlace.lat), readPlace.where)
  }
  loadColonyScore()
    .then((grid) => {
      colonyGrid = grid
      colonyPanel.showSources(grid.sources, grid.caveat)
      onReadPlace()
    })
    .catch((error: unknown) => {
      console.error('Colony scores failed to load:', error)
      colonyPanel.fail()
    })
  const colonyLayer = createColonyLayer(viewer)
  const colonySummaryCtrl = renderColonySummary(side)

  let thermalWasShown = false
  let crismWasShown = false
  exploreHooks.push(layerToggles.hideForExplore, streetView.hideForExplore, (on) => {
    // like the other paint-on overlays, ground firmness/chemistry would cover the walker's view
    if (on) {
      thermalWasShown = thermalLayer.show
      thermalLayer.show = false
      crismWasShown = crismLayer.show
      crismLayer.show = false
    } else {
      thermalLayer.show = thermalWasShown
      crismLayer.show = crismWasShown
    }
  })
  exploreHooks.push((on) => caveLayer.setVisible(!on && cavesShown)) // a paint-on overlay too
  // The opening Mars view starts with plain terrain; imagery comes on when a site is chosen.
  setLayer.current = renderLayerPanel(
    ui,
    {
      thermal: (visible) => void (thermalLayer.show = visible),
      crism: (visible) => void (crismLayer.show = visible),
      caves: (visible) => {
        cavesShown = visible
        caveLayer.setVisible(visible)
      },
      ...layerToggles,
      streetview: (visible) => {
        stopsWanted = visible
        showStops()
      },
      samples: samples.setVisible,
    },
    shared ? {} : { imagery: false },
  )
  // A mission asked for imagery before the layer controls existed: switch it on now.
  if (siteView.imageryWanted) setLayer.current?.('imagery', true)
  const timeline = renderTimelineBar(ui, streetView.stops, createReplay(viewer, streetView.stops))
  exploreHooks.push((on) => {
    if (on) timeline.pauseForExplore()
  })
  if (import.meta.env.DEV) Object.assign(window, { streetView, openStreetView }) // console debugging
}

/** One weather panel at a time, right under its station buttons; reopening replaces it. */
function weatherOpener(launcher: () => HTMLElement): (station: WeatherStation) => void {
  let panel: HTMLElement | undefined
  let request = 0
  return (station) => {
    const id = ++request
    panel?.remove()
    showDockTab('explore') // a station pin on the map may be clicked from any tab
    const loading = document.createElement('p')
    loading.className = 'panel weather wx-panel wx-loading'
    loading.setAttribute('role', 'status')
    loading.textContent = 'Loading Mars weather…'
    launcher().after(loading)
    panel = loading
    void loadWeather(station)
      .then((result) => {
        if (id !== request) return
        panel = renderWeatherPanel(station, result, () => panel?.remove())
        loading.replaceWith(panel)
        panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      })
      .catch((error: unknown) => {
        if (id !== request) return
        loading.textContent = `Weather unavailable: ${String(error)}`
      })
  }
}

// A sample's map view: about a kilometre of ground around it, enough to see where it was taken.
const SAMPLE_VIEW_HEIGHT_M = 1200

// Exploring on foot at night shows a black screen, so arrival is moved to the morning.
const EXPLORE_DAY_START_H = 6.5 // local mean solar time: the sun is up between these hours
const EXPLORE_DAY_END_H = 17.5
const EXPLORE_ARRIVAL_H = 10
const URL_SYNC_DELAY_MS = 400
const HERO_REFRESH_MS = 5000 // the map clock can run fast; air and time follow it

/** Keep the address bar pointing at the current view so any view can be shared. */
function keepUrlInSync(viewer: Parameters<typeof currentView>[0], paused: () => boolean): void {
  let timer = 0
  viewer.camera.moveEnd.addEventListener(() => {
    if (paused()) return // the opening spin must not leak into the address bar and block the next visit
    window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      history.replaceState(null, '', `?${encodeView(currentView(viewer))}`)
    }, URL_SYNC_DELAY_MS)
  })
}

main().catch((error: unknown) => {
  console.error(error)
  const alert = document.createElement('p')
  alert.setAttribute('role', 'alert')
  alert.className = 'fatal'
  alert.textContent = `Could not load the map: ${String(error)}`
  document.body.append(alert)
})
