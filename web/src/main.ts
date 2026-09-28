import './style.css'
import { type Site, elevationAt, parseMola } from './core/elevation'
import { type Grid, parseGrid } from './core/grid'
import { addLayers } from './map/layers'
import { createRouteClient } from './map/route-client'
import { type Activity, addActivities } from './map/activities-layer'
import { createReplay } from './map/replay'
import { addStreetViewStops } from './map/streetview-layer'
import { createRouteLayer } from './map/route-layer'
import { createTerrain } from './map/terrain'
import { decodeView, encodeView } from './core/deeplink'
import {
  applyView,
  createMarsViewer,
  currentView,
  flyToPlace,
  viewAoi,
  viewGlobe,
} from './map/viewer'
import { loadWeather, type WeatherStation } from './map/weather-client'
import { addStationPins, stationPositions } from './map/weather-stations'
import { renderActivityCard } from './ui/activity-card'
import { renderClock } from './ui/clock'
import { renderHeader } from './ui/header'
import { renderLayerPanel } from './ui/layer-panel'
import { renderReadout } from './ui/readout'
import { renderRoutePanel } from './ui/route-panel'
import { openStreetView } from './ui/streetview-viewer'
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
  viewer.terrainProvider = createTerrain((lon, lat) => elevationAt(sites, mola, lon, lat).m)
  const shared = decodeView(window.location.search)
  if (shared) applyView(viewer, shared)
  else viewAoi(viewer, home.grid)
  keepUrlInSync(viewer)
  const openRef: { current?: (ref: string) => void } = {}
  void loadPlaces().then((places) =>
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
  void stationPositions().then((positions) => addStationPins(viewer, positions, openWeather))
  renderReadout(ui, viewer, sites, mola)
  renderClock(ui, viewer)
  const layerToggles = await addLayers(viewer, sites, hirise)
  const streetView = await addStreetViewStops(viewer, (rover, index) =>
    openStreetView(rover, streetView.stops[rover], index, document.activeElement as HTMLElement),
  )
  const openActivity = (activity: Activity) => {
    const card = renderActivityCard(side, activity, {
      onClose: () => card.remove(),
      onStreetView: () => {
        if (activity.sol === null) return
        const { index } = positionAtSol(streetView.stops.m20, activity.sol)
        openStreetView('m20', streetView.stops.m20, index, document.activeElement as HTMLElement)
      },
    })
  }
  const samples = await addActivities(viewer, openActivity)
  openRef.current = (ref) => {
    const match = /^activity:(\d+)$/.exec(ref)
    const activity = match ? samples.activities[Number(match[1])] : undefined
    if (activity) openActivity(activity)
  }
  renderLayerPanel(ui, {
    ...layerToggles,
    streetview: streetView.setVisible,
    samples: samples.setVisible,
  })
  renderTimelineBar(ui, streetView.stops, createReplay(viewer, streetView.stops))
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
