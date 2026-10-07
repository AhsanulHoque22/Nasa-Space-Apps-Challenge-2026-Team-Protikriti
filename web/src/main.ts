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
import type { Rover } from './map/raw-images'
import { renderTimelineBar } from './ui/timeline-bar'
import { positionAtSol } from './core/timeline'
import { loadPlaces, renderSearchBox } from './ui/search-box'
import { renderWeatherPanel } from './ui/weather-panel'
import { renderZonePanel } from './ui/zone-panel'
import { renderDustPanel } from './ui/dust-panel'
import { renderDosePanel } from './ui/dose-panel'
import { solarLongitudeDeg } from './core/mars-time'
import { JulianDate } from 'cesium'
import { addThermalLayer, loadThermalGrids } from './map/thermal-layer'
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
  const { viewer, hirise } = createMarsViewer(globe)
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
  const groundM = (lon: number, lat: number) => elevationAt(sites, mola, lon, lat).m
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
  const routePanel = renderRoutePanel(side, viewer, sites, {
    makeClient: createRouteClient,
    makeLayer: (g) => createRouteLayer(viewer, g),
    makeRange: (g) => createRangeLayer(viewer, g),
    onEvent: quest.notify,
  })
  // Optional validation card: a missing file must not take the planner down with it.
  void fetchOk('data/benchmark.json')
    .then((r) => r.json())
    .then((doc) => renderBenchmarkCard(side, parseBenchmark(doc)))
    .catch((error: unknown) => console.warn('Benchmark card not shown:', error))
  renderLinkPanel(side, routePanel.currentPlan, routePanel.currentBundle)
  renderDosePanel(side)
  renderDustPanel(side, sites, () =>
    solarLongitudeDeg(JulianDate.toDate(viewer.clock.currentTime).getTime()),
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
      // Start where the rover is now if it is inside the site's terrain, else the site centre.
      const positions = await roverPositions.catch(() => null)
      const rover = site.rover === 'Curiosity' ? positions?.rems : positions?.meda
      const g = site.grid
      const from =
        rover && lonLatToCell(g, rover[0], rover[1])
          ? { lon: rover[0], lat: rover[1] }
          : { lon: (g.west + g.east) / 2, lat: (g.south + g.north) / 2 }
      for (const hide of exploreHooks) hide(true)
      openExplore(viewer, site, from, () => {
        for (const hide of exploreHooks) hide(false)
        viewAoi(viewer, g)
        b.focus()
      })
    })
  }
  launcher.after(explore)
  const exploreHooks: Array<(on: boolean) => void> = []
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
  renderClock(ui, viewer)
  renderConnectionBadge(ui)
  // Production only: a service worker in dev would serve stale files under hot reload.
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    navigator.serviceWorker
      .register(new URL('sw.js', document.baseURI).href)
      .catch((error: unknown) => console.warn('Offline cache unavailable:', error))
  }
  const layerToggles = await addLayers(viewer, sites, hirise)
  const thermalLayer = await addThermalLayer(viewer, await thermalReady)
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
  let thermalWasShown = false
  exploreHooks.push(layerToggles.hideForExplore, streetView.hideForExplore, (on) => {
    // like the other paint-on overlays, ground firmness would cover the walker's view
    if (on) {
      thermalWasShown = thermalLayer.show
      thermalLayer.show = false
    } else thermalLayer.show = thermalWasShown
  })
  renderLayerPanel(ui, {
    thermal: (visible) => void (thermalLayer.show = visible),
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
