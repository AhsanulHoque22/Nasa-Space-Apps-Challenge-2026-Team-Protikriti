/**
 * Rover Street View: at each stop, the widest Navcam sweep NASA took there, stitched into one
 * seamless 360° sphere (core/stitch) and drawn with WebGL, plus walk arrows to the neighbouring
 * stops on a CSS-3D layer that shares the camera.
 */
import { FOV_RANGE, pinchFov, wheelFov } from '../core/look'
import { selectPanorama } from '../core/panorama'
import {
  type Frame,
  type Stop,
  bearingDeg,
  compassPoint,
  cssTransform,
  frameGeometry,
  neighbours,
} from '../core/streetview'
import { type PanoRenderer, createPanoRenderer } from '../map/pano-gl'
import { type Rover, framesForStop } from '../map/raw-images'
import { stitchPanorama } from '../map/stitch-client'

const ROVER_NAME: Record<Rover, string> = { m20: 'Perseverance', msl: 'Curiosity' }
const FOV = { ...FOV_RANGE, start: 70 }
const DRAG_DEG_PER_PX = 0.15
const KEY_STEP_DEG = 8
const SEARCH_RADIUS = 6 // stops to check each way when a stop has no usable panorama
const GOOD_COVERAGE_DEG = 90 // a sweep this wide reads as a place, not a close-up
const ARROW_EL_DEG = -28 // walk arrows sit on the ground ahead, like Street View chevrons

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
      <canvas class="sv-canvas"></canvas>
      <div class="sv-sphere"></div>
    </div>
    <p class="sv-compass" aria-live="off"></p>
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
    <p class="sv-credit">Navcam raw images: NASA/JPL-Caltech · <a target="_blank" rel="noopener">view the source frames on NASA</a></p>`
  document.body.append(root)
  const view = root.querySelector('.sv-view') as HTMLElement
  const sphere = root.querySelector('.sv-sphere') as HTMLElement
  const title = root.querySelector('#sv-title') as HTMLElement
  const detail = root.querySelector('.sv-detail') as HTMLElement
  const status = root.querySelector('.sv-status') as HTMLElement
  const credit = root.querySelector('.sv-credit a') as HTMLAnchorElement
  const prev = root.querySelector('[data-act="prev"]') as HTMLButtonElement
  const next = root.querySelector('[data-act="next"]') as HTMLButtonElement
  const compass = root.querySelector('.sv-compass') as HTMLElement
  const canvas = root.querySelector('.sv-canvas') as HTMLCanvasElement
  let renderer: PanoRenderer
  try {
    renderer = createPanoRenderer(canvas)
  } catch (error) {
    status.textContent = `Street View needs WebGL2, which this browser could not start (${String(error)}).`
    root.querySelector('[data-act="close"]')?.addEventListener('click', () => {
      root.remove()
      returnFocus?.focus()
    })
    return
  }
  let stitching: AbortController | undefined
  let hasImage = false

  const state: State = { yaw: 0, pitch: 0, fov: FOV.start }
  let index = startIndex
  let request = 0

  const focalPx = () =>
    Math.max(view.clientWidth, view.clientHeight) / 2 / Math.tan((state.fov * Math.PI) / 360)

  const layout = () => {
    const f = focalPx()
    view.style.perspective = `${f}px`
    sphere.style.transform = `translateZ(${f}px) rotateX(${state.pitch}deg) rotateY(${state.yaw}deg)`
    if (hasImage) renderer.draw(state.yaw, state.pitch, state.fov)
    for (const tile of sphere.querySelectorAll<HTMLElement>('.sv-tile')) {
      const g = JSON.parse(tile.dataset.geom ?? '{}') as ReturnType<typeof frameGeometry>
      tile.style.width = `${2 * f * Math.tan((g.widthDeg * Math.PI) / 360)}px`
      tile.style.height = `${2 * f * Math.tan((g.heightDeg * Math.PI) / 360)}px`
      tile.style.transform = `translate(-50%, -50%) ${cssTransform(g.azDeg, g.elDeg, f)}`
    }
    for (const arrow of sphere.querySelectorAll<HTMLElement>('.sv-arrow')) {
      const az = Number(arrow.dataset.az)
      arrow.style.transform = `translate(-50%, -50%) ${cssTransform(az, ARROW_EL_DEG, f)} rotateX(-62deg)`
    }
    const heading = ((state.yaw % 360) + 360) % 360
    compass.textContent = `Facing ${Math.round(heading).toString().padStart(3, '0')}° ${compassPoint(heading)}`
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

  const walkArrows = () =>
    (['previous', 'next'] as const).flatMap((which) => {
      const target = neighbours(stops, index)[which]
      const here = stops[index]
      const there = target === null ? undefined : stops[target]
      if (!here || !there || (here.lon === there.lon && here.lat === there.lat)) return []
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'sv-arrow'
      button.dataset.az = String(bearingDeg(here, there))
      button.setAttribute('aria-label', `Walk to the ${which} stop (sol ${there.sol})`)
      button.addEventListener('click', () => void load(target as number))
      return [button]
    })

  const photoTiles = (frames: Frame[], yawDeg: number) =>
    frames.map((f) => {
      const img = document.createElement('img')
      img.className = 'sv-tile'
      img.src = f.url
      img.alt = f.caption
      img.decoding = 'async'
      img.referrerPolicy = 'no-referrer'
      img.draggable = false
      const g = frameGeometry(f)
      img.dataset.geom = JSON.stringify({ ...g, azDeg: g.azDeg + yawDeg })
      return img
    })

  const show = async (stop: Stop, found: Frame[], id: number) => {
    const pano = selectPanorama(found, stop)
    const first = pano.frames[0]
    if (!first) return
    const yawDeg = stop.yawDeg ?? 0 // mast azimuths are rover-frame; yaw makes them compass
    const sweep = pano.coverageDeg >= 359 ? '360°' : `${Math.round(pano.coverageDeg)}°`
    status.textContent = `Stitching ${pano.frames.length} NASA Navcam frames into a ${sweep} view…`
    stitching?.abort()
    stitching = new AbortController()
    try {
      const stitched = await stitchPanorama(
        pano.frames,
        yawDeg,
        (loaded, total) => {
          if (id === request) status.textContent = `Downloading Navcam frames ${loaded}/${total}…`
        },
        stitching.signal,
      )
      if (id !== request) return
      renderer.setImage(stitched.pixels, stitched.width, stitched.height)
      hasImage = true
      canvas.hidden = false
      detail.textContent += ` · ${sweep} panorama stitched from ${stitched.used} Navcam frames, sol ${first.sol}`
      sphere.replaceChildren(...walkArrows())
    } catch {
      if (id !== request) return
      // No same-origin image proxy (e.g. a static host): show the sweep as positioned photos.
      detail.textContent += ` · ${sweep} Navcam sweep, ${pano.frames.length} frames, sol ${first.sol}`
      sphere.replaceChildren(...photoTiles(pano.frames, yawDeg), ...walkArrows())
    }
    // Open looking at the middle of the sweep, level with the horizon.
    const mid = pano.frames[Math.floor(pano.frames.length / 2)] ?? first
    state.yaw = frameGeometry(mid).azDeg + yawDeg
    state.pitch = 0
    credit.href = first.link
    status.hidden = true
    layout()
  }

  const load = async (target: number) => {
    const id = ++request
    index = target
    const stop = stops[index]
    if (!stop) return
    describe(stop)
    sphere.replaceChildren()
    hasImage = false
    canvas.hidden = true // hide the previous stop while loading
    status.hidden = false
    status.textContent = 'Loading NASA Navcam panorama…'
    try {
      // This stop first, then outward: take the first wide sweep, else the widest seen.
      let best: { at: number; frames: Frame[]; coverage: number } | undefined
      for (let d = 0; d <= SEARCH_RADIUS; d++) {
        for (const candidate of d === 0 ? [index] : [index - d, index + d]) {
          const s = stops[candidate]
          if (!s) continue
          const found = await framesForStop(rover, s, stops[candidate + 1]?.sol)
          if (id !== request) return
          const coverage = selectPanorama(found, s).coverageDeg
          if (found.length && coverage > (best?.coverage ?? -1))
            best = { at: candidate, frames: found, coverage }
          if (best && best.coverage >= GOOD_COVERAGE_DEG) break
        }
        if (best && best.coverage >= GOOD_COVERAGE_DEG) break
        if (d === 0 && !best) status.textContent = 'No panorama at this stop. Looking nearby…'
      }
      const s = best && stops[best.at]
      if (!best || !s) {
        status.textContent = 'No Navcam imagery near this stop.'
        return
      }
      index = best.at
      describe(s)
      await show(s, best.frames, id)
    } catch (error) {
      if (id !== request) return
      status.replaceChildren(
        `NASA's raw-image service did not answer (${error instanceof Error ? error.message : String(error)}). `,
      )
      const again = document.createElement('button')
      again.type = 'button'
      again.className = 'sv-retry'
      again.textContent = 'Try again'
      again.addEventListener('click', () => void load(target))
      status.append(again)
      again.focus()
    }
  }

  const close = () => {
    request++
    stitching?.abort()
    root.remove()
    document.removeEventListener('keydown', onKey)
    window.removeEventListener('resize', layout)
    returnFocus?.focus()
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close()
  }
  document.addEventListener('keydown', onKey)

  // Look around: one finger or mouse drags the view, two fingers pinch to zoom, wheel zooms.
  const pointers = new Map<number, { x: number; y: number }>()
  const gesture = () => {
    const [a, b] = [...pointers.values()]
    if (!a) return null
    if (!b) return { x: a.x, y: a.y, dist: 0 }
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, dist: Math.hypot(a.x - b.x, a.y - b.y) }
  }
  let last = gesture()
  const release = (e: PointerEvent) => {
    pointers.delete(e.pointerId)
    last = gesture() // re-anchor so lifting one finger of a pinch doesn't jump the view
  }
  view.addEventListener('pointerdown', (e) => {
    if ((e.target as Element).closest('.sv-arrow')) return // let the arrow's click through
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    view.setPointerCapture(e.pointerId)
    last = gesture()
  })
  view.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const now = gesture()
    if (!now || !last) return
    if (now.dist > 0 && last.dist > 0) state.fov = pinchFov(state.fov, last.dist, now.dist)
    const scale = DRAG_DEG_PER_PX * (state.fov / FOV.start)
    state.yaw -= (now.x - last.x) * scale
    state.pitch = Math.max(-85, Math.min(85, state.pitch + (now.y - last.y) * scale))
    last = now
    layout()
  })
  for (const type of ['pointerup', 'pointercancel'] as const) view.addEventListener(type, release)
  view.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault()
      const px = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? e.deltaY * 16 : e.deltaY
      state.fov = wheelFov(state.fov, px)
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
