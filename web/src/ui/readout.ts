/** Live position readout: pointer position, or the view centre when nothing is hovered. */
import { Cartesian2, ScreenSpaceEventHandler, ScreenSpaceEventType, type Viewer } from 'cesium'
import { COORDINATE_FRAME, formatMarsPosition } from '../core/coords'
import { type Site, elevationAt } from '../core/elevation'
import type { Grid } from '../core/grid'
import { MARS_SPHERE } from '../map/mars'

export function renderReadout(
  parent: HTMLElement,
  viewer: Viewer,
  sites: readonly Site[],
  mola: Grid,
  /** Told each place the readout reads, with its label: 'Pointer' or 'View centre'. */
  onPosition: (lon: number, lat: number, label: string) => void,
): void {
  const el = document.createElement('section')
  el.className = 'panel readout'
  el.setAttribute('aria-label', 'Surface position')
  // Two readings, one box: the view centre (what the site report describes) and the pointer.
  el.innerHTML = `
    <div class="readout-tabs" role="tablist" aria-label="Which position">
      <button type="button" role="tab" id="ro-centre" data-src="View centre" aria-selected="true" aria-controls="ro-values">View centre</button>
      <button type="button" role="tab" id="ro-pointer" data-src="Pointer" aria-selected="false" aria-controls="ro-values" tabindex="-1">Pointer</button>
    </div>
    <dl class="readout-values" id="ro-values" role="tabpanel" aria-labelledby="ro-centre">
      <div><dt>Lat</dt><dd data-k="lat">—</dd></div>
      <div><dt>Lon</dt><dd data-k="lon">—</dd></div>
      <div><dt>Elev</dt><dd data-k="elevation">—</dd></div>
    </dl>
    <p class="readout-frame" title="${COORDINATE_FRAME} · Mars has no GPS" data-k2="elevSource"></p>`
  parent.append(el)
  const tabs = [...el.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
  const panel = el.querySelector('#ro-values') as HTMLElement
  const fields = el.querySelectorAll<HTMLElement>('dd[data-k]')
  const elevSource = el.querySelector('[data-k2="elevSource"]') as HTMLElement
  const readings = new Map<string, { text: Record<string, string>; source: string }>()
  let shown = 'View centre'
  let last = shown // the reading the colony panel follows
  const paint = () => {
    const r = readings.get(shown)
    for (const f of fields) f.textContent = r?.text[f.dataset.k ?? ''] ?? '—'
    elevSource.textContent = r ? `Elevation: ${r.source}` : ''
  }
  const choose = (tab: HTMLButtonElement) => {
    shown = tab.dataset.src ?? shown
    for (const t of tabs) {
      t.setAttribute('aria-selected', String(t === tab))
      t.tabIndex = t === tab ? 0 : -1
    }
    panel.setAttribute('aria-labelledby', tab.id)
    paint()
  }
  for (const t of tabs) {
    t.addEventListener('click', () => choose(t))
    t.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      const other = tabs.find((o) => o !== t)
      if (!other) return
      e.preventDefault()
      choose(other)
      other.focus()
    })
  }

  const show = (screen: Cartesian2, label: string) => {
    const ray = viewer.camera.getPickRay(screen)
    const hit = ray && viewer.scene.globe.pick(ray, viewer.scene)
    if (!hit) return
    const carto = MARS_SPHERE.cartesianToCartographic(hit)
    const lon = (carto.longitude * 180) / Math.PI
    const lat = (carto.latitude * 180) / Math.PI
    const elevation = elevationAt(sites, mola, lon, lat)
    const text = formatMarsPosition(lon, lat, Number.isNaN(elevation.m) ? undefined : elevation.m)
    readings.set(label, { text, source: elevation.source })
    last = label
    if (label === shown) paint()
    onPosition(lon, lat, label)
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
    if (queued === 0 && last === 'View centre') centre()
  })
}
