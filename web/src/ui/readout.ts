/** Live position readout: pointer position, or the view centre when nothing is hovered. */
import { Cartesian2, ScreenSpaceEventHandler, ScreenSpaceEventType, type Viewer } from 'cesium'
import { COORDINATE_FRAME, formatMarsPosition } from '../core/coords'
import { type Grid, elevationAt, lonLatToCell } from '../core/grid'
import { MARS_SPHERE } from '../map/mars'

export function renderReadout(parent: HTMLElement, viewer: Viewer, grid: Grid): void {
  const el = document.createElement('section')
  el.className = 'panel readout'
  el.setAttribute('aria-label', 'Surface position')
  el.innerHTML = `
    <p class="readout-source">View centre</p>
    <dl class="readout-values">
      <div><dt>Lat</dt><dd data-k="lat">—</dd></div>
      <div><dt>Lon</dt><dd data-k="lon">—</dd></div>
      <div><dt>Elev</dt><dd data-k="elevation">—</dd></div>
    </dl>
    <p class="readout-frame">${COORDINATE_FRAME} · Mars has no GPS</p>`
  parent.append(el)
  const source = el.querySelector('.readout-source') as HTMLElement
  const fields = el.querySelectorAll<HTMLElement>('dd[data-k]')

  const show = (screen: Cartesian2, label: string) => {
    const ray = viewer.camera.getPickRay(screen)
    const hit = ray && viewer.scene.globe.pick(ray, viewer.scene)
    if (!hit) return
    const carto = MARS_SPHERE.cartesianToCartographic(hit)
    const lon = (carto.longitude * 180) / Math.PI
    const lat = (carto.latitude * 180) / Math.PI
    // Elevation only where we have the DEM: terrain outside the grid is a placeholder.
    const cell = lonLatToCell(grid, lon, lat)
    const elevation = cell ? elevationAt(grid, cell) : undefined
    const text = formatMarsPosition(lon, lat, elevation)
    for (const f of fields) f.textContent = text[f.dataset.k as keyof typeof text]
    source.textContent = label
  }

  const centre = () => {
    const canvas = viewer.scene.canvas
    show(new Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2), 'View centre')
  }
  let frame = 0
  const handler = new ScreenSpaceEventHandler(viewer.scene.canvas)
  handler.setInputAction((move: ScreenSpaceEventHandler.MotionEvent) => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => show(move.endPosition, 'Pointer'))
  }, ScreenSpaceEventType.MOUSE_MOVE)
  viewer.scene.canvas.addEventListener('pointerleave', centre)
  viewer.camera.moveEnd.addEventListener(centre)
  // First terrain tiles arrive after load; read the centre once the queue drains.
  viewer.scene.globe.tileLoadProgressEvent.addEventListener((queued: number) => {
    if (queued === 0 && source.textContent === 'View centre') centre()
  })
}
