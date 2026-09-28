import './style.css'
import { parseGrid } from './core/grid'
import { createGridTerrain } from './map/terrain'
import { createMarsViewer, viewAoi } from './map/viewer'

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
  const container = document.getElementById('app')
  if (!container) throw new Error('#app element missing')
  const viewer = createMarsViewer(container)
  if (import.meta.env.DEV) Object.assign(window, { viewer }) // console debugging only
  const grid = await loadGrid()
  viewer.terrainProvider = createGridTerrain(grid)
  viewAoi(viewer, grid)
}

main().catch((error: unknown) => {
  console.error(error)
  document.body.insertAdjacentHTML(
    'beforeend',
    `<p role="alert" class="fatal">Could not load the map: ${String(error)}</p>`,
  )
})
