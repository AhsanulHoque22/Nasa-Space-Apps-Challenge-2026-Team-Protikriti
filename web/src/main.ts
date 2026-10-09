import './style.css'
import { type Site, elevationAt, parseMola } from './core/elevation'
import { type Grid, lonLatToCell, parseGrid } from './core/grid'
import { addLayers } from './map/layers'
import { createRouteClient } from './map/route-client'
import { type Activity, addActivities } from './map/activities-layer'
import { createReplay } from './map/replay'
import { addStreetViewStops } from './map/streetview-layer'
import { createRangeLayer } from './map/range-layer'
import { createRouteLayer } from './map/route-layer'
import { createTerrain, keepCameraAboveGround } from './map/terrain'
import { installKeyboardCamera } from './map/keyboard-camera'
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
import { renderActivityCard } from './ui/activity-card'
import { renderBenchmarkCard } from './ui/benchmark-card'
import { renderClock } from './ui/clock'
import { renderConnectionBadge } from './ui/connection-badge'
import { openExplore } from './ui/explore-hud'
import { renderDock } from './ui/dock'
import { renderHeader } from './ui/header'
import { renderLayerPanel } from './ui/layer-panel'
import { renderReadout } from './ui/readout'
import { renderSiteReport } from './ui/site-report'
import type { SwimGrid } from './core/site-report'
import { ScreenSpaceEventHandler, ScreenSpaceEventType } from 'cesium'
import { MARS_SPHERE } from './map/mars'
import { isExploring } from './map/picking'
import type { Place } from './core/search'
import { renderLinkPanel } from './ui/link-panel'
import { renderQuestPanel } from './ui/quest-panel'
import { renderRoutePanel } from './ui/route-panel'
import { openStreetView } from './ui/streetview-viewer'
import { openWalkPlayer } from './ui/walk-player'
import type { Rover } from './map/raw-images'
import { renderTimelineBar } from './ui/timeline-bar'
import { positionAtSol } from './core/timeline'
import { loadPlaces, renderSearchBox } from './ui/search-box'
import { renderWeatherPanel } from './ui/weather-panel'
import { renderZonePanel } from './ui/zone-panel'
import { renderDustPanel } from './ui/dust-panel'
import { renderScenarioPanel } from './ui/scenario-panel'
import { renderSyncPanel } from './ui/sync-panel'
import { renderGeologyPanel } from './ui/geology-panel'
import { renderComparePanel } from './ui/compare-panel'
import type { SiteId } from './core/surface-conditions'
import { renderDosePanel } from './ui/dose-panel'
import { renderDeltaCard } from './ui/delta-card'
import {
  localMeanSolarTimeHours,
  nextLocalHourMs,
  solarLongitudeDeg,
} from './core/mars-time'
import { addThermalLayer, loadThermalGrids } from './map/thermal-layer'
import { createCaveLayer } from './map/caves-layer'
import { createWalkGround } from './map/walk-ground'
import { renderCaveCard } from './ui/cave-card'
import { iceAt } from './core/site-report'

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

async function loadMola(): Promise<Grid> {
  const [meta, bin] = await Promise.all([
    fetchOk('data/mola.json').then((r) => r.json()),
    fetchOk('data/mola.bin').then((r) => r.arrayBuffer()),
  ])
  return parseMola(meta, bin)
}

async function main() {
  const globe = document.getElementById('globe')
  const ui = document.getElementById('ui')
  if (!globe || !ui) throw new Error('#globe / #ui elements missing')
  const { viewer, hirise, offFoot } = createMarsViewer(globe)
  if (import.meta.env.DEV) Object.assign(window, { viewer }) // console debugging only
  const [sites, mola] = await Promise.all([loadSites(), loadMola()])
  const home = sites[0]
  if (!home) throw new Error('sites.json lists no sites')
  renderHeader(ui, sites, (view) => {
    const site = sites.find((s) => s.id === view)
    if (site) viewAoi(viewer, site.grid)
    else
      viewGlobe(
        viewer,
        (home.grid.west + home.grid.east) / 2,
        (home.grid.south + home.grid.north) / 2,
      )
  })
  const ground = createWalkGround(viewer, sites, mola)
  const groundM = ground.height
  // Height of the ground as drawn (terrain x vertical exaggeration). Markers sit on it directly:
  // CLAMP_TO_GROUND left most of them km above the terrain, off the draped lines and clicks.
  const surfaceM = (lon: number, lat: number) =>
    (groundM(lon, lat) || 0) * viewer.scene.verticalExaggeration
  installWheelZoom(viewer, surfaceM)
  installKeyboardCamera(viewer, () =>
    document.querySelector<HTMLButtonElement>('[data-act="add"]')?.click(),
  )
  viewer.terrainProvider = createTerrain(groundM)
  keepCameraAboveGround(viewer, groundM)
  const shared = decodeView(window.location.search)
  if (shared) applyView(viewer, shared)
  else viewAoi(viewer, home.grid)
  keepUrlInSync(viewer)
  const openRef: { current?: (ref: string) => void } = {}
  const placesReady = loadPlaces()
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
  const quest = renderQuestPanel(side)
  // Filled in after streetView loads; safe because the walk player opens only after user interaction.
  let walkStreetView: ((lon: number, lat: number) => void) | undefined
  const routePanel = renderRoutePanel(side, viewer, sites, {
    makeClient: createRouteClient,
    makeLayer: (g) => createRouteLayer(viewer, g),
    makeRange: (g) => createRangeLayer(viewer, g),
    onEvent: quest.notify,
    onHazardOp: (op) => sync.record(op),
    onStartWalk: (params) => {
      openWalkPlayer(viewer, params, (lon, lat) => walkStreetView?.(lon, lat))
    },
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
    { nowMs: sceneTimeMs, setTime: (t) => clockRef.setTime(t) },
  )
  const openWeather = weatherOpener(side)
  const launcher = document.createElement('nav')
  launcher.className = 'panel wx-launch'
  launcher.setAttribute('aria-label', 'Mars weather stations')
  launcher.innerHTML = `<span>Mars weather</span>
    <button type="button" data-station="rems">Gale</button>
    <button type="button" data-station="meda">Jezero</button>`
  for (const b of launcher.querySelectorAll<HTMLButtonElement>('button'))
    b.addEventListener('click', () => openWeather(b.dataset.station as WeatherStation))
  side.prepend(launcher)
  const roverPositions = stationPositions()
  void roverPositions.then((positions) => addStationPins(viewer, positions, surfaceM, openWeather))
  const explore = document.createElement('nav')
  explore.className = 'panel wx-launch'
  explore.setAttribute('aria-label', 'Explore a site on foot')
  explore.innerHTML = `<span>Explore on foot</span>${sites
    .map((s) => `<button type="button" data-site="${s.id}">${s.name.split(' ')[0]}</button>`)
    .join('')}`
  for (const b of explore.querySelectorAll<HTMLButtonElement>('button')) {
    b.addEventListener('click', async () => {
      const site = sites.find((s) => s.id === b.dataset.site)
      if (!site) return
      const g = site.grid
      b.disabled = true // the walk patch may take a moment to arrive
      const patch = await ground.patch(site.id)
      b.disabled = false
      // Walk the high-resolution patch from its centre (a landing site) when there is one;
      // otherwise the site model, from the rover if it is inside it, else the site centre.
      let walkSite: Site = site
      let from = { lon: (g.west + g.east) / 2, lat: (g.south + g.north) / 2 }
      if (patch) {
        walkSite = { ...site, grid: patch.grid, source: patch.source }
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
      for (const hide of exploreHooks) hide(true)
      openExplore(viewer, walkSite, from, () => {
        for (const hide of exploreHooks) hide(false)
        viewAoi(viewer, g)
        b.focus()
      })
    })
  }
  launcher.after(explore)
  // On foot the walk patch and the 25 cm site mosaics fill the view: drop the layers beneath.
  let offFootShown = offFoot.show
  const exploreHooks: Array<(on: boolean) => void> = [
    (on) => {
      if (on) offFootShown = offFoot.show
      offFoot.show = on ? false : offFootShown
    },
  ]
  renderReadout(ui, viewer, sites, mola)
  // Settlement guide: right-click anywhere, or the readout's button for the view centre.
  const thermalReady = loadThermalGrids(sites)
  let swim: Promise<SwimGrid | null> | undefined
  const getSwim = () => (swim ??= loadSwim().catch(() => null))
  const openReport = async (lon: number, lat: number) => {
    const places: Place[] = await placesReady.catch(() => [])
    renderSiteReport(side, lon, lat, {
      sites,
      mola,
      places,
      swim: await getSwim(),
      thermal: (await thermalReady).map((t) => t.grid),
    })
  }
  renderZonePanel(
    side,
    async () => {
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
    },
    (zone) => flyToPlace(viewer, zone.lon, zone.lat, 200),
  )
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
  document
    .querySelector('.readout')
    ?.insertAdjacentHTML(
      'beforeend',
      '<button type="button" class="report-button">Site report for the view centre</button>',
    )
  document.querySelector('.report-button')?.addEventListener('click', () => {
    const c = viewCentre(viewer)
    if (c) void openReport(c.lon, c.lat)
  })
  Object.assign(clockRef, renderClock(ui, viewer))
  renderConnectionBadge(ui)
  installScaleBar(viewer, ui)
  // Production only: a service worker in dev would serve stale files under hot reload.
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    navigator.serviceWorker
      .register(new URL('sw.js', document.baseURI).href)
      .catch((error: unknown) => console.warn('Offline cache unavailable:', error))
  }
  const layerToggles = await addLayers(viewer, sites, hirise)
  const thermalLayer = await addThermalLayer(viewer, await thermalReady)
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
    )
  }
  const streetView = await addStreetViewStops(viewer, surfaceM, showStreetView)
  walkStreetView = (lon, lat) => {
    const stops = streetView.stops.m20
    let bestI = 0, bestDSq = Infinity
    for (let i = 0; i < stops.length; i++) {
      const s = stops[i]!
      const dSq = (lon - s.lon) ** 2 + (lat - s.lat) ** 2
      if (dSq < bestDSq) { bestDSq = dSq; bestI = i }
    }
    showStreetView('m20', bestI)
  }
  const openActivity = (activity: Activity) => {
    const card = renderActivityCard(side, activity, {
      onClose: () => card.remove(),
      onStreetView: () => {
        if (activity.sol === null) return
        const { index } = positionAtSol(streetView.stops.m20, activity.sol)
        showStreetView('m20', index)
      },
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
  renderGeologyPanel(side, (lon, lat) => flyToPlace(viewer, lon, lat, 2))
  renderDeltaCard(
    side,
    (n) => sampleByNumber(n)?.name.replace(/\s*_\(.*\)_/, '') ?? null,
    (n) => {
      const a = sampleByNumber(n)
      if (!a) return
      if (a.lon !== undefined && a.lat !== undefined) flyToPlace(viewer, a.lon, a.lat, 1)
      openActivity(a)
    },
  )
  renderDock(side)
  let thermalWasShown = false
  exploreHooks.push(layerToggles.hideForExplore, streetView.hideForExplore, (on) => {
    // like the other paint-on overlays, ground firmness would cover the walker's view
    if (on) {
      thermalWasShown = thermalLayer.show
      thermalLayer.show = false
    } else thermalLayer.show = thermalWasShown
  })
  exploreHooks.push((on) => caveLayer.setVisible(!on && cavesShown)) // a paint-on overlay too
  renderLayerPanel(ui, {
    thermal: (visible) => void (thermalLayer.show = visible),
    caves: (visible) => {
      cavesShown = visible
      caveLayer.setVisible(visible)
    },
    ...layerToggles,
    streetview: streetView.setVisible,
    samples: samples.setVisible,
  })
  const timeline = renderTimelineBar(ui, streetView.stops, createReplay(viewer, streetView.stops))
  exploreHooks.push((on) => {
    if (on) timeline.pauseForExplore()
  })
  if (import.meta.env.DEV) Object.assign(window, { streetView, openStreetView }) // console debugging
}

/** One weather panel at a time; reopening a station replaces it. */
function weatherOpener(side: HTMLElement): (station: WeatherStation) => void {
  let panel: HTMLElement | undefined
  let request = 0
  return (station) => {
    const id = ++request
    panel?.remove()
    const loading = document.createElement('p')
    loading.className = 'panel weather wx-loading'
    loading.setAttribute('role', 'status')
    loading.textContent = 'Loading Mars weather…'
    side.append(loading)
    panel = loading
    void loadWeather(station)
      .then((result) => {
        if (id !== request) return
        loading.remove()
        panel = renderWeatherPanel(side, station, result, () => panel?.remove())
      })
      .catch((error: unknown) => {
        if (id !== request) return
        loading.textContent = `Weather unavailable: ${String(error)}`
      })
  }
}

// Exploring on foot at night shows a black screen, so arrival is moved to the morning.
const EXPLORE_DAY_START_H = 6.5 // local mean solar time: the sun is up between these hours
const EXPLORE_DAY_END_H = 17.5
const EXPLORE_ARRIVAL_H = 10
const URL_SYNC_DELAY_MS = 400

/** Keep the address bar pointing at the current view so any view can be shared. */
function keepUrlInSync(viewer: Parameters<typeof currentView>[0]): void {
  let timer = 0
  viewer.camera.moveEnd.addEventListener(() => {
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
