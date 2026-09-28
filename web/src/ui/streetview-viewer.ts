/** Rover Street View: NASA Navcam frames placed on a CSS-3D sphere at their true pointing. */
import { type Frame, type Stop, cssTransform, frameGeometry, neighbours } from '../core/streetview'
import { type Rover, framesForStop } from '../map/raw-images'

const ROVER_NAME: Record<Rover, string> = { m20: 'Perseverance', msl: 'Curiosity' }
const FOV = { min: 25, max: 100, start: 70 }
const DRAG_DEG_PER_PX = 0.15
const KEY_STEP_DEG = 8
const SEARCH_RADIUS = 8 // stops to check each way when a stop has no imagery

type State = { yaw: number; pitch: number; fov: number }

export function openStreetView(
  rover: Rover,
  stops: Stop[],
  startIndex: number,
  returnFocus?: HTMLElement | null,
): void {
  document.querySelector('.sv')?.remove()
  const root = document.createElement('div')
  root.className = 'sv'
  root.setAttribute('role', 'dialog')
  root.setAttribute('aria-modal', 'true')
  root.setAttribute('aria-labelledby', 'sv-title')
  root.innerHTML = `
    <div class="sv-view" tabindex="0"
      aria-label="Look around: drag, or arrow keys; plus and minus to zoom">
      <div class="sv-sphere"></div>
    </div>
    <header class="panel sv-bar">
      <div class="sv-heading">
        <h2 id="sv-title"></h2>
        <p class="sv-detail"></p>
      </div>
      <div class="sv-nav">
        <button type="button" data-act="prev" aria-label="Previous stop">‹ Prev</button>
        <button type="button" data-act="next" aria-label="Next stop">Next ›</button>
        <button type="button" data-act="close">Close</button>
      </div>
    </header>
    <p class="panel sv-status" role="status" aria-live="polite"></p>
    <p class="sv-credit">Navcam raw images: NASA/JPL-Caltech · <a target="_blank" rel="noopener">view this frame on NASA</a></p>`
  document.body.append(root)
  const view = root.querySelector('.sv-view') as HTMLElement
  const sphere = root.querySelector('.sv-sphere') as HTMLElement
  const title = root.querySelector('#sv-title') as HTMLElement
  const detail = root.querySelector('.sv-detail') as HTMLElement
  const status = root.querySelector('.sv-status') as HTMLElement
  const credit = root.querySelector('.sv-credit a') as HTMLAnchorElement
  const prev = root.querySelector('[data-act="prev"]') as HTMLButtonElement
  const next = root.querySelector('[data-act="next"]') as HTMLButtonElement

  const state: State = { yaw: 0, pitch: 0, fov: FOV.start }
  let frames: Frame[] = []
  let index = startIndex
  let request = 0

  const focalPx = () => view.clientWidth / 2 / Math.tan((state.fov * Math.PI) / 360)

  const layout = () => {
    const f = focalPx()
    view.style.perspective = `${f}px`
    sphere.style.transform = `translateZ(${f}px) rotateX(${-state.pitch}deg) rotateY(${state.yaw}deg)`
    for (const tile of sphere.children as HTMLCollectionOf<HTMLElement>) {
      const g = JSON.parse(tile.dataset.geom ?? '{}') as ReturnType<typeof frameGeometry>
      tile.style.width = `${2 * f * Math.tan((g.widthDeg * Math.PI) / 360)}px`
      tile.style.height = `${2 * f * Math.tan((g.heightDeg * Math.PI) / 360)}px`
      tile.style.transform = `translate(-50%, -50%) ${cssTransform(g.azDeg, g.elDeg, f)}`
    }
  }

  const describe = (stop: Stop) => {
    title.textContent = `${ROVER_NAME[rover]} · Sol ${stop.sol}`
    const lat = `${Math.abs(stop.lat).toFixed(5)}° ${stop.lat < 0 ? 'S' : 'N'}`
    const lon = `${(((stop.lon % 360) + 360) % 360).toFixed(5)}° E`
    detail.textContent = `Site ${stop.site} · Drive ${stop.drive} · ${lat} ${lon}${
      stop.elevM == null
        ? ''
        : ` · ${Math.round(stop.elevM).toLocaleString('en-US').replace('-', '−')} m`
    }`
    const n = neighbours(stops, index)
    prev.disabled = n.previous === null
    next.disabled = n.next === null
  }

  const show = (found: Frame[]) => {
    frames = found
    const sols = frames.map((f) => f.sol)
    const [lo, hi] = [Math.min(...sols), Math.max(...sols)]
    detail.textContent += ` · ${frames.length} frames, sol${lo === hi ? ` ${lo}` : `s ${lo}–${hi}`}`
    sphere.replaceChildren(
      ...frames.map((f) => {
        const img = document.createElement('img')
        img.className = 'sv-tile'
        img.src = f.url
        img.alt = f.caption
        img.loading = 'lazy'
        img.decoding = 'async'
        img.referrerPolicy = 'no-referrer'
        img.draggable = false
        img.dataset.geom = JSON.stringify(frameGeometry(f))
        img.addEventListener('pointerenter', () => (credit.href = f.link))
        return img
      }),
    )
    const first = frames[0]
    if (first) {
      const g = frameGeometry(first)
      state.yaw = g.azDeg
      state.pitch = Math.max(-40, Math.min(40, g.elDeg))
      credit.href = first.link
    }
    layout()
  }

  const load = async (target: number) => {
    const id = ++request
    index = target
    const stop = stops[index]
    if (!stop) return
    describe(stop)
    sphere.replaceChildren()
    status.hidden = false
    status.textContent = 'Loading NASA Navcam frames…'
    try {
      const found = await framesForStop(rover, stop, stops[index + 1]?.sol)
      if (id !== request) return
      if (found.length) {
        status.hidden = true
        show(found)
        return
      }
      status.textContent =
        'No Navcam frames at this stop. Looking for the nearest stop with imagery…'
      for (let d = 1; d <= SEARCH_RADIUS; d++) {
        for (const candidate of [index - d, index + d]) {
          const s = stops[candidate]
          if (!s) continue
          const near = await framesForStop(rover, s, stops[candidate + 1]?.sol)
          if (id !== request) return
          if (near.length) {
            index = candidate
            describe(s)
            status.hidden = true
            show(near)
            return
          }
        }
      }
      status.textContent = 'No Navcam imagery near this stop.'
    } catch (error) {
      if (id === request)
        status.textContent = `NASA image service unavailable (${String(error)}). Try again shortly.`
    }
  }

  const close = () => {
    request++
    root.remove()
    document.removeEventListener('keydown', onKey)
    returnFocus?.focus()
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close()
  }
  document.addEventListener('keydown', onKey)

  // Look around: drag, keys, wheel.
  let dragging: { x: number; y: number } | null = null
  view.addEventListener('pointerdown', (e) => {
    dragging = { x: e.clientX, y: e.clientY }
    view.setPointerCapture(e.pointerId)
  })
  view.addEventListener('pointermove', (e) => {
    if (!dragging) return
    const scale = DRAG_DEG_PER_PX * (state.fov / FOV.start)
    state.yaw -= (e.clientX - dragging.x) * scale
    state.pitch = Math.max(-85, Math.min(85, state.pitch + (e.clientY - dragging.y) * scale))
    dragging = { x: e.clientX, y: e.clientY }
    layout()
  })
  view.addEventListener('pointerup', () => (dragging = null))
  view.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault()
      state.fov = Math.max(FOV.min, Math.min(FOV.max, state.fov + Math.sign(e.deltaY) * 5))
      layout()
    },
    { passive: false },
  )
  view.addEventListener('keydown', (e) => {
    const moves: Record<string, () => void> = {
      ArrowLeft: () => (state.yaw -= KEY_STEP_DEG),
      ArrowRight: () => (state.yaw += KEY_STEP_DEG),
      ArrowUp: () => (state.pitch = Math.min(85, state.pitch + KEY_STEP_DEG)),
      ArrowDown: () => (state.pitch = Math.max(-85, state.pitch - KEY_STEP_DEG)),
      '+': () => (state.fov = Math.max(FOV.min, state.fov - 5)),
      '=': () => (state.fov = Math.max(FOV.min, state.fov - 5)),
      '-': () => (state.fov = Math.min(FOV.max, state.fov + 5)),
    }
    const move = moves[e.key]
    if (!move) return
    e.preventDefault()
    move()
    layout()
  })
  window.addEventListener('resize', layout)
  prev.addEventListener('click', () => void load(index - 1))
  next.addEventListener('click', () => void load(index + 1))
  root.querySelector('[data-act="close"]')?.addEventListener('click', close)
  view.focus()
  void load(startIndex)
}
