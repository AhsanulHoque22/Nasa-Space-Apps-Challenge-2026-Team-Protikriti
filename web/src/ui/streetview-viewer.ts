/**
 * Rover Street View: at each stop, the widest Navcam sweep NASA took there, stitched into one
 * seamless 360° sphere (core/stitch) and drawn with WebGL, plus walk arrows to the neighbouring
 * stops on a CSS-3D layer that shares the camera.
 */
import { FOV_RANGE, pinchFov, wheelFov } from '../core/look'
import { type PosedFrames, fillGaps, selectPanorama } from '../core/panorama'
import { distanceKm } from '../core/site-report'
import {
  type Frame,
  type Stop,
  bearingDeg,
  compassPoint,
  cssTransform,
  frameGeometry,
  latestStopIndex,
  neighbours,
} from '../core/streetview'
import { CLASSES, CLASS_COLOURS, NONE, classShares } from '../core/ai4mars'
import { type LabelSource, classAt, overlayPixels, projectLabels } from '../core/label-pano'
import { labelSource, labelsFor } from '../map/ai4mars-client'
import { openLabelTool } from './label-tool'
import { type PanoRenderer, createPanoRenderer } from '../map/pano-gl'
import { type Prestitched, prestitched, prestitchedLabels } from '../map/prestitched-client'
import { type Rover, framesForStop } from '../map/raw-images'
import { stitchPanorama } from '../map/stitch-client'

const ROVER_NAME: Record<Rover, string> = { m20: 'Perseverance', msl: 'Curiosity' }
const FOV = { ...FOV_RANGE, start: 70 }
const DRAG_DEG_PER_PX = 0.15
const KEY_STEP_DEG = 8
const SEARCH_RADIUS = 6 // stops to check each way when a stop has no usable panorama
// Gap filling: borrow frames from stops this close. Farther away, parallax shifts the foreground
// too much for the frames to line up; the horizon still matches. Stops are ~20 m apart (median).
const FILL_MAX_DISTANCE_M = 60
const FILL_MAX_STOPS = 8 // each way along the traverse
const FILL_BATCH = 4 // NASA raw-image queries in flight at once
const FULL_CIRCLE_DEG = 359.5
const GOOD_COVERAGE_DEG = 90 // a sweep this wide reads as a place, not a close-up
const ARROW_EL_DEG = -28 // walk arrows sit on the ground ahead, like Street View chevrons
const LABEL_PANO_WIDTH = 1024 // labels are 128 px per frame: finer would add nothing

type State = { yaw: number; pitch: number; fov: number }

export function openStreetView(
  rover: Rover,
  stops: Stop[],
  startIndex: number,
  returnFocus?: HTMLElement | null,
  onClose?: () => void,
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
        <button type="button" data-act="latest" title="Jump to the most recent stop">Latest stop</button>
        <button type="button" data-act="labels" aria-pressed="false" hidden>Terrain labels</button>
        <button type="button" data-act="practice" hidden>Practice labelling</button>
        <button type="button" data-act="close">Close</button>
      </div>
    </header>
    <p class="panel sv-status" role="status" aria-live="polite"></p>
    <section class="panel sv-labels" aria-label="AI4Mars terrain labels" hidden></section>
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
  const latest = root.querySelector('[data-act="latest"]') as HTMLButtonElement
  const compass = root.querySelector('.sv-compass') as HTMLElement
  const canvas = root.querySelector('.sv-canvas') as HTMLCanvasElement
  const labelsButton = root.querySelector('[data-act="labels"]') as HTMLButtonElement
  const labelsPanel = root.querySelector('.sv-labels') as HTMLElement
  const practiceButton = root.querySelector('[data-act="practice"]') as HTMLButtonElement
  let panoImage: { pixels: Uint8ClampedArray; width: number; height: number } | null = null
  let labelTool: { close(): void } | null = null
  let renderer: PanoRenderer
  try {
    renderer = createPanoRenderer(canvas)
  } catch (error) {
    status.textContent = `Street View needs WebGL2, which this browser could not start (${String(error)}).`
    root.querySelector('[data-act="close"]')?.addEventListener('click', () => {
      root.remove()
      returnFocus?.focus()
      onClose?.()
    })
    return
  }
  let stitching: AbortController | undefined
  let hasImage = false
  // Canvas redraw function for the flat equirectangular fallback; null when no fallback is shown.
  let flatRedraw: (() => void) | null = null

  // AI4Mars terrain labels: people's labels on this stop's frames, drawn over the sphere.
  let labelSources: LabelSource[] = []
  let labelGrid: ReturnType<typeof projectLabels> | null = null
  let precomputedLabels: { pixels: Uint8ClampedArray; width: number; height: number } | null = null
  let labelsOn = false
  let centreLine: HTMLElement | null = null

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
    flatRedraw?.()
    for (const arrow of sphere.querySelectorAll<HTMLElement>('.sv-arrow')) {
      const az = Number(arrow.dataset.az)
      arrow.style.transform = `translate(-50%, -50%) ${cssTransform(az, ARROW_EL_DEG, f)} rotateX(-62deg)`
    }
    const heading = ((state.yaw % 360) + 360) % 360
    compass.textContent = `Facing ${Math.round(heading).toString().padStart(3, '0')}° ${compassPoint(heading)}`
    if (centreLine && labelGrid) {
      const c = classAt(labelGrid, state.yaw, state.pitch)
      centreLine.textContent = `Centre of view: ${c === NONE ? 'not labelled' : CLASSES[c]}`
    }
  }

  /** Show or hide the labels and their legend for the current stop and toggle state. */
  const updateLabels = async () => {
    const n = labelSources.length
    practiceButton.hidden = !(panoImage && n > 0) // needs the stitched photo and people's labels
    // The pre-computed file is cleaned of sky and rover; raw frame labels are not, so it wins.
    const precomputed = precomputedLabels
    const hasPrecomputed = precomputed !== null
    labelsButton.hidden = n === 0 && !hasPrecomputed
    labelsButton.textContent = hasPrecomputed
      ? 'Terrain labels'
      : `Terrain labels (${n} frame${n === 1 ? '' : 's'})`
    labelsButton.setAttribute('aria-pressed', String(labelsOn))
    labelsPanel.hidden = !(labelsOn && (n || hasPrecomputed))
    if (!labelsOn || (!n && !hasPrecomputed)) {
      renderer.setLabels(null)
      centreLine = null
      if (hasImage) renderer.draw(state.yaw, state.pitch, state.fov)
      return
    }
    if (hasPrecomputed) {
      if (precomputed) renderer.setLabels(precomputed)
      if (hasImage) renderer.draw(state.yaw, state.pitch, state.fov)
      labelsPanel.replaceChildren()
      const title = document.createElement('h3')
      title.textContent = 'Terrain: people’s labels, completed by a model'
      const note = document.createElement('p')
      note.className = 'sv-labels-note'
      const list = document.createElement('ul')
      CLASSES.forEach((name, i) => {
        const li = document.createElement('li')
        const swatch = document.createElement('i')
        swatch.setAttribute('aria-hidden', 'true')
        swatch.style.background = CLASS_COLOURS[i] ?? ''
        li.append(swatch, name)
        list.append(li)
      })
      note.textContent =
        'Where people labelled these Navcam frames (AI4Mars) their labels are kept; elsewhere a ' +
        'Random Forest trained on them fills in the ground, and rocks are spotted by contrast. ' +
        'Sky, the rover body and the ground under the cameras are left clear. ' +
        'These are guesses to look at, not measurements, and nothing in the planner uses them.'
      labelsPanel.append(title, list, note)
      return
    }
    labelGrid ??= projectLabels(labelSources, LABEL_PANO_WIDTH)
    renderer.setLabels({ ...labelGrid, pixels: overlayPixels(labelGrid) })
    const shares = classShares(labelGrid.cls)
    const meta = await labelSource()
    labelsPanel.replaceChildren()
    const title = document.createElement('h3')
    title.textContent = 'Terrain labelled by people (AI4Mars)'
    const list = document.createElement('ul')
    CLASSES.forEach((name, i) => {
      const li = document.createElement('li')
      const swatch = document.createElement('i')
      swatch.setAttribute('aria-hidden', 'true')
      swatch.style.background = CLASS_COLOURS[i] ?? ''
      li.append(swatch, `${name} · ${Math.round((shares[i] ?? 0) * 100)}%`)
      list.append(li)
    })
    centreLine = document.createElement('p')
    centreLine.className = 'sv-labels-centre'
    const note = document.createElement('p')
    note.className = 'sv-labels-note'
    note.textContent =
      `Labels people drew on ${n} of these Navcam frames: no model classified anything. ` +
      'Shares are of the labelled ground; pixels people disagreed on are left clear. ' +
      (meta ? `${meta.source}. Licence: ${meta.license}.` : '')
    labelsPanel.append(title, list, centreLine, note)
    layout()
  }
  practiceButton.addEventListener('click', () => {
    if (!panoImage || labelSources.length === 0) return
    labelTool?.close()
    labelGrid ??= projectLabels(labelSources, LABEL_PANO_WIDTH)
    // Practise only on ground: where the cleaned file is clear (sky, rover) there is nothing to label.
    const expert = { ...labelGrid, cls: labelGrid.cls.slice() }
    const clean = precomputedLabels
    if (clean && clean.width === expert.width && clean.height === expert.height)
      for (let i = 0; i < expert.cls.length; i++)
        if (clean.pixels[i * 4 + 3] === 0) expert.cls[i] = NONE
    labelTool = openLabelTool(root, {
      stop: title.textContent ?? 'stop',
      panorama: panoImage,
      expert,
    })
  })
  labelsButton.addEventListener('click', () => {
    labelsOn = !labelsOn
    void updateLabels()
  })

  const describe = (stop: Stop) => {
    title.textContent = `${ROVER_NAME[rover]} · Sol ${stop.sol}${index === latestStopIndex(stops) ? ' · latest stop' : ''}`
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
    latest.disabled = index === latestStopIndex(stops)
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

  /**
   * Flat equirectangular fallback when the WebGL stitcher can't fetch images (proxy blocked).
   * Draws frames directly onto a 2D canvas with correct az/el projection on every pan.
   * Cross-origin images taint the canvas but it still renders — we never read pixels back.
   * Returns a wrapper div (overflow:hidden) to insert behind the CSS-3D sphere.
   */
  const createPhotoCanvas = (frames: Frame[], yawDeg: number): HTMLDivElement => {
    const wrap = document.createElement('div')
    wrap.className = 'sv-flat-wrap'
    const cvs = document.createElement('canvas')
    cvs.className = 'sv-flat'
    wrap.append(cvs)
    const ctx = cvs.getContext('2d')!

    const loaded: Array<{
      img: HTMLImageElement
      azDeg: number
      elDeg: number
      wDeg: number
      hDeg: number
    }> = []

    flatRedraw = () => {
      const W = view.clientWidth
      const H = view.clientHeight
      if (!W || !H) return
      if (cvs.width !== W) cvs.width = W
      if (cvs.height !== H) cvs.height = H

      // Sky: dusty amber at the top, darkening to reddish ground.
      const skyH = H * 0.55
      const sky = ctx.createLinearGradient(0, 0, 0, skyH)
      sky.addColorStop(0, '#c4944a')
      sky.addColorStop(0.6, '#b07828')
      sky.addColorStop(1, '#7a4814')
      ctx.fillStyle = '#3a1c08'
      ctx.fillRect(0, 0, W, H)
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, W, skyH)

      // Linear az/el projection centred on the current view — correct for narrow FOV,
      // acceptable at 70°. Handles 0/360 wrap via modular arithmetic.
      const PX = W / state.fov
      for (const { img, azDeg, elDeg, wDeg, hDeg } of loaded) {
        const dAz = ((azDeg - state.yaw + 540) % 360) - 180
        const cx = W / 2 + dAz * PX
        const w = wDeg * PX
        if (cx + w / 2 < 0 || cx - w / 2 > W) continue // entirely off-screen
        const dEl = elDeg - state.pitch
        const cy = H / 2 - dEl * PX
        const h = hDeg * PX
        ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h)
      }
    }

    for (const f of frames) {
      const g = frameGeometry(f)
      if (g.elDeg + g.heightDeg / 2 > 75) continue // skip sky-only
      const azDeg = g.azDeg + yawDeg
      const { elDeg, widthDeg: wDeg, heightDeg: hDeg } = g
      const img = new Image()
      img.onload = () => {
        loaded.push({ img, azDeg, elDeg, wDeg, hDeg })
        flatRedraw?.()
      }
      img.src = f.url // cross-origin: <img> loads without CORS; canvas taints on drawImage but still displays
    }

    return wrap
  }

  const show = async (stop: Stop, found: Frame[], id: number, borrowedStops = 0) => {
    const pano = selectPanorama(found, stop)
    const first = pano.frames[0]
    if (!first) return
    const yawDeg = stop.yawDeg ?? 0 // mast azimuths are rover-frame; yaw makes them compass
    void labelsFor(rover, pano.frames, yawDeg).then((labelled) => {
      if (id !== request) return
      labelSources = labelled
      labelGrid = null
      void updateLabels()
    })
    const sweep =
      (pano.coverageDeg >= 359 ? '360°' : `${Math.round(pano.coverageDeg)}°`) +
      (borrowedStops
        ? ` (gaps filled from ${borrowedStops} nearby stop${borrowedStops > 1 ? 's' : ''})`
        : '')
    status.textContent = `Stitching ${pano.frames.length} NASA Navcam frames into a ${sweep} view…`
    stitching?.abort()
    stitching = new AbortController()
    // Open looking at the middle of the sweep, level with the horizon, once something is shown.
    const reveal = (text: string, layers: Element[]) => {
      detail.textContent += text
      sphere.replaceChildren(...layers)
      const mid = pano.frames[Math.floor(pano.frames.length / 2)] ?? first
      state.yaw = frameGeometry(mid).azDeg + yawDeg
      state.pitch = 0
      credit.href = first.link
      status.hidden = true
      layout()
    }
    const paint = (p: { pixels: Uint8ClampedArray; width: number; height: number }) => {
      renderer.setImage(p.pixels, p.width, p.height)
      hasImage = true
      canvas.hidden = false
      layout()
    }
    let previewed = false
    try {
      const full = await stitchPanorama(
        pano,
        stop,
        {
          progress: (loaded, total) => {
            if (id !== request) return
            status.textContent =
              loaded < total
                ? `Downloading Navcam frames ${loaded}/${total}…`
                : `Stitching ${total} frames into a panorama… (may take a moment)`
          },
          preview: (p) => {
            if (id !== request) return
            paint(p)
            reveal(
              ` · ${sweep} panorama stitched from ${p.used} Navcam frames, sol ${first.sol}`,
              walkArrows(),
            )
            previewed = true
          },
        },
        stitching.signal,
      )
      if (id === request) paint(full) // sharpen in place, keeping where the viewer is looking
    } catch (err) {
      console.error('[sv] stitch failed:', err)
      if (id !== request || previewed) return
      // Proxy blocked by NASA: show frames on a flat equirectangular canvas instead.
      // Insert the canvas wrap before the sphere so walk arrows still render on top.
      const flatWrap = createPhotoCanvas(pano.frames, yawDeg)
      sphere.before(flatWrap)
      reveal(
        ` · ${sweep} Navcam sweep, ${pano.frames.length} frames, sol ${first.sol}`,
        walkArrows(),
      )
    }
  }

  // One query per stop per session: the search and the gap filling ask for the same stops.
  const fetched = new Map<number, Promise<Frame[]>>()
  const framesAt = (i: number, s: Stop) => {
    let frames = fetched.get(i)
    if (!frames) {
      frames = framesForStop(rover, s, stops[i + 1]?.sol)
      fetched.set(i, frames)
      frames.catch(() => fetched.delete(i)) // let "Try again" ask NASA again
    }
    return frames
  }

  /** Real frames from nearby stops that look where this stop's own sweep does not. */
  const filled = async (at: number, own: Frame[], id: number) => {
    const here = stops[at]
    // Can't rotate borrowed frames into the correct compass frame without a known heading.
    if (!here || here.yawDeg === null || selectPanorama(own, here).coverageDeg >= FULL_CIRCLE_DEG)
      return null
    const near = [...Array(2 * FILL_MAX_STOPS).keys()]
      .map((k) => at + (k % 2 ? -1 : 1) * (Math.floor(k / 2) + 1))
      .flatMap((i) => {
        const s = stops[i]
        const m = s && distanceKm(here.lon, here.lat, s.lon, s.lat) * 1000
        return s && m !== undefined && m <= FILL_MAX_DISTANCE_M ? [{ i, s, m }] : []
      })
      .sort((a, b) => a.m - b.m)
    if (near.length === 0) return null
    status.textContent = 'Filling the gaps with Navcam frames from nearby stops…'
    const posed: PosedFrames[] = []
    for (let k = 0; k < near.length; k += FILL_BATCH) {
      const batch = near.slice(k, k + FILL_BATCH)
      const frames = await Promise.all(batch.map(({ i, s }) => framesAt(i, s).catch(() => [])))
      if (id !== request) return null
      batch.forEach(({ s }, j) => {
        if (s.yawDeg === null) return // unknown heading — can't rotate frames to our compass frame
        posed.push({ frames: selectPanorama(frames[j] ?? [], s).frames, yawDeg: s.yawDeg })
      })
      const soFar = fillGaps({ frames: own, yawDeg: here.yawDeg }, posed)
      if (selectPanorama(soFar.frames).coverageDeg >= FULL_CIRCLE_DEG) return soFar
    }
    return fillGaps({ frames: own, yawDeg: here.yawDeg }, posed)
  }

  /** A panorama the pipeline stitched ahead of time: no NASA request needed to show it. */
  const showPrestitched = (
    stop: Stop,
    { pano, pixels, width, height }: Prestitched,
    id: number,
  ) => {
    stitching?.abort()
    renderer.setImage(pixels, width, height)
    panoImage = { pixels, width, height }
    hasImage = true
    canvas.hidden = false
    detail.textContent +=
      ` · 360° panorama of ${pano.frameCount} Navcam frames, sol ${pano.sol}, ` +
      `stitched with JPL camera models (aligned to ${pano.alignment.rmsAfterDeg}°)`
    sphere.replaceChildren(...walkArrows())
    state.yaw = stop.yawDeg ?? 0 // open looking where the rover faces
    state.pitch = 0
    credit.href = pano.link || credit.href
    status.hidden = true
    layout()
    // Pre-computed label PNG: try CDN first, show immediately when it arrives.
    void prestitchedLabels(rover, pano.file)
      .then((result) => {
        if (id !== request) return
        precomputedLabels = result
        void updateLabels()
      })
      .catch(() => undefined)
    // Live AI4Mars labels override the pre-computed ones when NASA answers.
    if (stop.yawDeg === null) return
    void framesAt(index, stop)
      .then((frames) => labelsFor(rover, selectPanorama(frames, stop).frames, stop.yawDeg ?? 0))
      .then((labelled) => {
        if (id !== request) return
        labelSources = labelled
        labelGrid = null
        void updateLabels()
      })
      .catch(() => undefined) // offline: the panorama shows without labels
  }

  const load = async (target: number) => {
    const id = ++request
    index = target
    const stop = stops[index]
    if (!stop) return
    describe(stop)
    view.querySelector('.sv-flat-wrap')?.remove()
    flatRedraw = null
    sphere.replaceChildren()
    hasImage = false
    labelSources = []
    labelGrid = null
    precomputedLabels = null
    panoImage = null
    labelTool?.close()
    void updateLabels()
    canvas.hidden = true // hide the previous stop while loading
    status.hidden = false
    status.textContent = 'Loading NASA Navcam panorama…'
    const ready = await prestitched(rover, stop).catch((error: unknown) => {
      console.error('[sv] pre-stitched panorama failed, stitching live:', error)
      return null
    })
    if (id !== request) return
    if (ready) return showPrestitched(stop, ready, id)
    try {
      // This stop first, then outward: take the first wide sweep, else the widest seen.
      let best: { at: number; frames: Frame[]; coverage: number } | undefined
      for (let d = 0; d <= SEARCH_RADIUS; d++) {
        for (const candidate of d === 0 ? [index] : [index - d, index + d]) {
          const s = stops[candidate]
          if (!s) continue
          const found = await framesAt(candidate, s)
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
      const more = await filled(best.at, best.frames, id)
      if (id !== request) return
      await show(s, more?.frames ?? best.frames, id, more?.borrowedStops ?? 0)
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
    onClose?.()
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
  latest.addEventListener('click', () => void load(latestStopIndex(stops)))
  root.querySelector('[data-act="close"]')?.addEventListener('click', close)
  view.focus()
  void load(startIndex)
}
