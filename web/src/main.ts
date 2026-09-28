import './style.css'
import { parseGrid } from './core/grid'
import { addLayers } from './map/layers'
import { createRouteClient } from './map/route-client'
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
import { renderClock } from './ui/clock'
import { renderHeader } from './ui/header'
import { renderLayerPanel } from './ui/layer-panel'
import { renderReadout } from './ui/readout'
import { renderRoutePanel } from './ui/route-panel'
import { loadPlaces, renderSearchBox } from './ui/search-box'

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
  renderRoutePanel(ui, viewer, grid, createRouteClient(grid), createRouteLayer(viewer, grid))
  renderReadout(ui, viewer, grid)
  renderClock(ui, viewer)
  renderLayerPanel(ui, await addLayers(viewer, grid, hirise))
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
