import './style.css'
import { type Site, elevationAt, parseMola } from './core/elevation'
import { type Grid, lonLatToCell, parseGrid } from './core/grid'
import { addLayers } from './map/layers'
import { createRouteClient } from './map/route-client'
import { type Activity, addActivities } from './map/activities-layer'
import { createReplay } from './map/replay'
import { addStreetViewStops } from './map/streetview-layer'
import { createRouteLayer } from './map/route-layer'
import { createTerrain, keepCameraAboveGround } from './map/terrain'
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
import { renderActivityCard } from './ui/activity-card'
import { renderClock } from './ui/clock'
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
import { renderRoutePanel } from './ui/route-panel'
import { openStreetView } from './ui/streetview-viewer'
import type { Rover } from './map/raw-images'
import { renderTimelineBar } from './ui/timeline-bar'
import { positionAtSol } from './core/timeline'
import { loadPlaces, renderSearchBox } from './ui/search-box'
import { renderWeatherPanel } from './ui/weather-panel'

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
  renderRoutePanel(side, viewer, sites, createRouteClient, (g) => createRouteLayer(viewer, g))
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
  void roverPositions.then((positions) => addStationPins(viewer, positions, openWeather))
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
  let swim: Promise<SwimGrid | null> | undefined
  const openReport = async (lon: number, lat: number) => {
    swim ??= loadSwim().catch(() => null)
    const places: Place[] = await placesReady.catch(() => [])
    renderSiteReport(side, lon, lat, { sites, mola, places, swim: await swim })
  }
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
  const layerToggles = await addLayers(viewer, sites, hirise)
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
  const streetView = await addStreetViewStops(
    viewer,
    (lon, lat) => (groundM(lon, lat) || 0) * viewer.scene.verticalExaggeration,
    showStreetView,
  )
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
  const samples = await addActivities(viewer, openActivity)
  openRef.current = (ref) => {
    const match = /^activity:(\d+)$/.exec(ref)
    const activity = match ? samples.activities[Number(match[1])] : undefined
    if (activity) openActivity(activity)
  }
  exploreHooks.push(layerToggles.hideForExplore, streetView.hideForExplore)
  renderLayerPanel(ui, {
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
  document.body.insertAdjacentHTML(
    'beforeend',
    `<p role="alert" class="fatal">Could not load the map: ${String(error)}</p>`,
  )
})
