import './style.css'
import { parseGrid } from './core/grid'
import { addLayers } from './map/layers'
import { createGridTerrain } from './map/terrain'
import { createMarsViewer, viewAoi, viewGlobe } from './map/viewer'
import { renderHeader } from './ui/header'
import { renderLayerPanel } from './ui/layer-panel'
import { renderReadout } from './ui/readout'

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
  const grid = await loadGrid()
  viewer.terrainProvider = createGridTerrain(grid)
  viewAoi(viewer, grid)
  renderHeader(ui, (view) =>
    view === 'mars'
      ? viewGlobe(viewer, (grid.west + grid.east) / 2, (grid.south + grid.north) / 2)
      : viewAoi(viewer, grid),
  )
  renderLayerPanel(ui, await addLayers(viewer, grid, hirise))
  renderReadout(ui, viewer, grid)
}

main().catch((error: unknown) => {
  console.error(error)
  document.body.insertAdjacentHTML(
    'beforeend',
    `<p role="alert" class="fatal">Could not load the map: ${String(error)}</p>`,
  )
})
