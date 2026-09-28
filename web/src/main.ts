import './style.css'
import { parseGrid } from './core/grid'
import { addLayers } from './map/layers'
import { createRouteClient } from './map/route-client'
import { addStreetViewStops } from './map/streetview-layer'
import { createRouteLayer } from './map/route-layer'
import { createGridTerrain } from './map/terrain'
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
import { renderClock } from './ui/clock'
import { renderHeader } from './ui/header'
import { renderLayerPanel } from './ui/layer-panel'
import { renderReadout } from './ui/readout'
import { renderRoutePanel } from './ui/route-panel'
import { openStreetView } from './ui/streetview-viewer'
import { loadPlaces, renderSearchBox } from './ui/search-box'
import { renderWeatherPanel } from './ui/weather-panel'

async function fetchOk(url: string): Promise<Response> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status} (did you run make data?)`)
  return response
}

async function loadGrid() {
  const [meta, bin] = await Promise.all([
    fetchOk('data/grid.json').then((r) => r.json()),
    fetchOk('data/grid.bin').then((r) => r.arrayBuffer()),
  ])
  return parseGrid(meta, bin)
}

async function main() {
  const globe = document.getElementById('globe')
  const ui = document.getElementById('ui')
  if (!globe || !ui) throw new Error('#globe / #ui elements missing')
  const { viewer, hirise } = createMarsViewer(globe)
  if (import.meta.env.DEV) Object.assign(window, { viewer }) // console debugging only
  const gridReady = loadGrid()
  renderHeader(ui, (view) => {
    void gridReady.then((g) =>
      view === 'mars'
        ? viewGlobe(viewer, (g.west + g.east) / 2, (g.south + g.north) / 2)
        : viewAoi(viewer, g),
    )
  })
  const grid = await gridReady
  viewer.terrainProvider = createGridTerrain(grid)
  const shared = decodeView(window.location.search)
  if (shared) applyView(viewer, shared)
  else viewAoi(viewer, grid)
  keepUrlInSync(viewer)
  void loadPlaces().then((places) =>
    renderSearchBox(ui, places, (p) => flyToPlace(viewer, p.lon, p.lat, p.sizeKm)),
  )
  // Planner and readout need only the grid: paint them before the heavier layers stream in.
  const side = document.createElement('div')
  side.className = 'side'
  ui.append(side)
  renderRoutePanel(side, viewer, grid, createRouteClient(grid), createRouteLayer(viewer, grid))
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
  renderReadout(ui, viewer, grid)
  renderClock(ui, viewer)
  const layerToggles = await addLayers(viewer, grid, hirise)
  const streetView = await addStreetViewStops(viewer, (rover, index) =>
    openStreetView(rover, streetView.stops[rover], index, document.activeElement as HTMLElement),
  )
  renderLayerPanel(ui, { ...layerToggles, streetview: streetView.setVisible })
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
