import './style.css'
import { parseGrid } from './core/grid'
import { createMarsViewer, flyToBounds } from './map/viewer'

async function loadGrid() {
  const [meta, bin] = await Promise.all([
    fetch('data/grid.json').then((r) => r.json()),
    fetch('data/grid.bin').then((r) => r.arrayBuffer()),
  ])
  return parseGrid(meta, bin)
}

async function main() {
  const container = document.getElementById('app')
  if (!container) throw new Error('#app element missing')
  const viewer = createMarsViewer(container)
  if (import.meta.env.DEV) Object.assign(window, { viewer }) // console debugging only
  const grid = await loadGrid()
  flyToBounds(viewer, grid.west, grid.south, grid.east, grid.north)
}

main().catch((error: unknown) => {
  console.error(error)
  document.body.insertAdjacentHTML(
    'beforeend',
    `<p role="alert" class="fatal">Could not load the map: ${String(error)}</p>`,
  )
})
