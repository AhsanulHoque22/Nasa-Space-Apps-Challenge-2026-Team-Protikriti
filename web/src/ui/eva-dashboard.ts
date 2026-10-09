/**
 * The EVA wrist console: an astronaut's forearm rises at the bottom of the screen, and the walk
 * dashboard is the screen on the wrist. Flat HTML screens are tilted onto the two glass panels of
 * the photograph with a perspective transform, so the text stays sharp and the buttons work.
 */
import type { Profile } from '../core/eva-telemetry'
import { type Quad, cssMatrix3d, homography } from '../core/homography'

export type Tone = 'ok' | 'warn' | 'bad'
export type Tile = { label: string; value: string; tone?: Tone; hint?: string }
export type TabId = 'now' | 'route' | 'nearby' | 'profile' | 'know' | 'tools'

export type DashView = {
  siteName: string
  summaryLine: string
  verdict: 'GO' | 'NO-GO'
  verdictLine: string
  progress: { fraction: number; text: string }
  clock: string[]
  numbers: Tile[]
  stops: { name: string; detail: string; near: string | null; current: boolean; done: boolean }[]
  words: string
  checks: string[]
  position: { title: string; tiles: Tile[] }
  next: { label: string; value: string; sub: string }
  conditions: { tiles: Tile[]; note: string }
  nearby: { name: string; kind: string; where: string; note: string | null }[]
  know: string[]
  profile: { data: Profile; currentM: number } | null
  minimap: Minimap | null
  navigation: { name: string; count: number; canPrev: boolean; canNext: boolean }
  handheld: boolean
  reducedMotion: boolean
}

/** The route drawn small: north up, one unit per metre, you and the next stop marked. */
export type Minimap = {
  path: [number, number][]
  stops: [number, number][]
  you: [number, number]
  next: [number, number] | null
  size: number // the drawing's width and height, in the same units as the points
}

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}
export const esc = (text: string): string => text.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c)

// --- The photograph: where the two glass panels are, in its own pixels (1763 x 892) ---------------
export const ARM_W = 1763
export const ARM_H = 892
/** Glass corners, top-left clockwise, drawn a few pixels inside the bezel. */
export const MAIN_GLASS: Quad = [
  [207, 212],
  [1062, 138],
  [1142, 556],
  [272, 690],
]
export const SIDE_GLASS: Quad = [
  [1114, 150],
  [1316, 163],
  [1337, 520],
  [1171, 533],
]
export const MAIN_SIZE = { w: 760, h: 400 } // the flat screens, in their own CSS pixels
export const SIDE_SIZE = { w: 230, h: 380 }

export const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'now', label: 'Map', icon: '<path d="m4 11 16-7-7 16-2-7z"/>' },
  {
    id: 'route',
    label: 'Route',
    icon: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  },
  {
    id: 'nearby',
    label: 'Nearby',
    icon: '<path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z"/><circle cx="12" cy="11" r="2"/>',
  },
  { id: 'profile', label: 'Profile', icon: '<path d="m3 19 6-9 4 5 3-4 5 8z"/>' },
  {
    id: 'know',
    label: 'Know',
    icon: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
  },
  {
    id: 'tools',
    label: 'Tools',
    icon: '<path d="M14 6a4 4 0 0 0 5 5l-9 9a2.1 2.1 0 0 1-3-3l9-9a4 4 0 0 0-2-2z"/>',
  },
]

const tile = (t: Tile) =>
  `<div class="ws-tile"${t.tone ? ` data-tone="${t.tone}"` : ''}${t.hint ? ` title="${esc(t.hint)}"` : ''}>` +
  `<dt>${esc(t.label)}</dt><dd>${esc(t.value)}</dd></div>`

const PROFILE_W = 700
const PROFILE_H = 150
const PAD = { l: 8, r: 8, t: 10, b: 8 }

function nearest(points: Profile['points'], d: number): number {
  let best = 0
  points.forEach((p, i) => {
    if (Math.abs(p.d - d) < Math.abs((points[best]?.d ?? 0) - d)) best = i
  })
  return best
}

/** Elevation along the route: the stops, and a marker where you are. */
export function profileSvg(profile: Profile, currentM: number, stopNames: string[]): string {
  const { points, stopD, minE, maxE, totalM } = profile
  if (points.length < 2 || totalM <= 0) return ''
  const w = PROFILE_W - PAD.l - PAD.r
  const h = PROFILE_H - PAD.t - PAD.b
  const span = Math.max(maxE - minE, 1)
  const x = (d: number) => PAD.l + (d / totalM) * w
  const y = (e: number) => PAD.t + (1 - (e - minE) / span) * h
  const line = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.d).toFixed(1)} ${y(p.e).toFixed(1)}`)
    .join(' ')
  const area = `${line} L${x(totalM).toFixed(1)} ${PROFILE_H - PAD.b} L${x(0).toFixed(1)} ${PROFILE_H - PAD.b} Z`
  const stops = stopD
    .map(
      (d, i) =>
        `<line x1="${x(d).toFixed(1)}" x2="${x(d).toFixed(1)}" y1="${PAD.t}" y2="${PROFILE_H - PAD.b}" class="ws-pf-stop"/>` +
        `<circle cx="${x(d).toFixed(1)}" cy="${y(points[nearest(points, d)]?.e ?? minE).toFixed(1)}" r="4" class="ws-pf-dot"><title>${esc(stopNames[i] ?? '')}</title></circle>`,
    )
    .join('')
  const here = Math.min(Math.max(currentM, 0), totalM)
  const hereE = points[nearest(points, here)]?.e ?? minE
  return (
    `<svg class="ws-profile" viewBox="0 0 ${PROFILE_W} ${PROFILE_H}" role="img" ` +
    `aria-label="Elevation along the route, from ${Math.round(minE)} to ${Math.round(maxE)} metres, ${stopD.length} stops">` +
    `<path d="${area}" class="ws-pf-area"/><path d="${line}" class="ws-pf-line"/>${stops}` +
    `<circle cx="${x(here).toFixed(1)}" cy="${y(hereE).toFixed(1)}" r="7" class="ws-pf-here"/></svg>`
  )
}

/** A round map of the route with a compass, like the one on a real wrist display. */
export function minimapSvg(m: Minimap): string {
  const k = 84 / Math.max(m.size, 1) // fit the route inside the dial
  const xy = ([px, py]: [number, number]): [string, string] => [
    (50 + (px - m.size / 2) * k).toFixed(1),
    (50 + (py - m.size / 2) * k).toFixed(1),
  ]
  const here = xy(m.you)
  const next = m.next ? xy(m.next) : null
  return (
    `<svg class="ws-minimap" viewBox="0 0 100 100" role="img" aria-label="Map of the route, north up, with your position">` +
    `<circle cx="50" cy="50" r="47" class="ws-mm-dial"/><circle cx="50" cy="50" r="31" class="ws-mm-ring"/>` +
    `<polyline points="${m.path.map((p) => xy(p).join(',')).join(' ')}" class="ws-mm-path"/>` +
    (next
      ? `<line x1="${here[0]}" y1="${here[1]}" x2="${next[0]}" y2="${next[1]}" class="ws-mm-next"/>`
      : '') +
    m.stops
      .map((s) => `<circle cx="${xy(s)[0]}" cy="${xy(s)[1]}" r="2.2" class="ws-mm-stop"/>`)
      .join('') +
    `<circle cx="${here[0]}" cy="${here[1]}" r="3.4" class="ws-mm-you"/>` +
    `<text x="50" y="11" class="ws-mm-n">N</text><text x="50" y="94" class="ws-mm-s">S</text>` +
    `<text x="8" y="52" class="ws-mm-s">W</text><text x="92" y="52" class="ws-mm-s">E</text></svg>`
  )
}

const list = (items: string[]) => items.map((i) => `<li>${esc(i)}</li>`).join('')

function pages(v: DashView): Record<TabId, string> {
  const stops = v.stops
    .map(
      (s, i) =>
        `<li class="${s.current ? 'is-current' : ''}${s.done ? ' is-done' : ''}">` +
        `<button type="button" data-act="goto" data-i="${i}"${s.current ? ' aria-current="step"' : ''}>` +
        `<span class="ws-stop-name">${esc(s.name)}</span><span class="ws-stop-detail">${esc(s.detail)}</span>` +
        (s.near ? `<span class="ws-stop-near">${esc(s.near)}</span>` : '') +
        `</button></li>`,
    )
    .join('')
  const nearby = v.nearby.length
    ? v.nearby
        .map(
          (n) =>
            `<li><span class="ws-near-name">${esc(n.name)}</span><span class="ws-near-where">${esc(n.kind)} · ${esc(n.where)}</span>` +
            (n.note ? `<span class="ws-near-note">${esc(n.note)}</span>` : '') +
            `</li>`,
        )
        .join('')
    : '<li class="ws-empty">No named place within 8 km of here.</li>'
  const profile = v.profile
    ? profileSvg(
        v.profile.data,
        v.profile.currentM,
        v.stops.map((s) => s.name),
      )
    : '<p class="ws-empty">The elevation profile appears once the route is planned.</p>'
  return {
    now: `<div class="ws-now">
        <div class="ws-col"><h3>${esc(v.position.title)}</h3><dl class="ws-rows">${v.position.tiles.map(tile).join('')}</dl></div>
        <div class="ws-dial">${v.minimap ? minimapSvg(v.minimap) : ''}</div>
        <div class="ws-next">
          <h3>${esc(v.next.label)}</h3>
          <p class="ws-big">${esc(v.next.value)}</p>
          <p class="ws-sub">${esc(v.next.sub)}</p>
          <div class="ws-bar" role="progressbar" aria-label="EVA time used" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(v.progress.fraction * 100)}"><i style="width:${(v.progress.fraction * 100).toFixed(1)}%"></i></div>
          <p class="ws-sub">${esc(v.progress.text)}</p>
        </div>
      </div>`,
    route: `<div class="ws-route">
        <dl class="ws-numbers">${v.numbers.map(tile).join('')}</dl>
        <ol class="ws-stops">${stops}</ol>
      </div>`,
    nearby: `<ul class="ws-nearby">${nearby}</ul>`,
    profile: `<div class="ws-prof">${profile}<p class="ws-sub">${esc(v.summaryLine)}</p></div>`,
    know: `<div class="ws-know">
        <ul>${list(v.know)}</ul>
        <h3>The route in words</h3><p>${esc(v.words)}</p>
        <h3>How this is checked</h3><ul>${list(v.checks)}</ul>
      </div>`,
    tools: `<div class="ws-tools">
        <button type="button" data-act="sv">Street View</button>
        <button type="button" data-act="rc" title="Tilt the map toward where the walk goes next, at your current zoom">⊙ Recenter</button>
        <button type="button" data-act="zi" aria-label="Zoom in">Zoom in +</button>
        <button type="button" data-act="zo" aria-label="Zoom out">Zoom out −</button>
        <button type="button" data-act="hand" aria-pressed="${v.handheld}"${v.reducedMotion ? ' disabled title="Your system asks for reduced motion"' : ' title="The arm sways gently, like a hand holding it up"'}>Hand sway</button>
      </div>`,
  }
}

const tabIcon = (icon: string) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icon}</svg>`

/** The big display: a status line, the page you chose, and the tab bar. */
export function mainScreenHtml(v: DashView, tab: TabId): string {
  const p = pages(v)
  const nav = v.navigation
  return `
    <header class="ws-top">
      <div class="wp-nav">
        <button type="button" data-act="prev"${nav.canPrev ? '' : ' disabled'} aria-label="Previous stop">‹</button>
        <span class="wp-pos">${esc(nav.name)} <span class="wp-of">of ${nav.count}</span></span>
        <button type="button" data-act="next"${nav.canNext ? '' : ' disabled'} aria-label="Next stop">›</button>
      </div>
      <div class="ws-verdict wp-verdict ${v.verdict === 'GO' ? 'wp-go' : 'wp-nogo'}" title="EVA verdict"><b>${esc(v.verdict)}</b><span>${esc(v.verdictLine)}</span></div>
      <p class="ws-clock">${v.clock.map((c) => `<span>${esc(c)}</span>`).join('')}</p>
      <button type="button" data-act="close" class="wp-close">End walk</button>
    </header>
    <div class="ws-pages">${TABS.map((t) => `<section data-page="${t.id}" aria-label="${t.label}"${t.id === tab ? '' : ' hidden'}>${p[t.id]}</section>`).join('')}</div>
    <nav class="ws-tabs" role="tablist" aria-label="Wrist console">${TABS.map(
      (t) =>
        `<button type="button" role="tab" data-act="tab" data-tab="${t.id}" aria-selected="${t.id === tab}">${tabIcon(t.icon)}<span>${t.label}</span></button>`,
    ).join('')}</nav>`
}

/** The small side display: conditions where you are. */
export function sideScreenHtml(v: DashView): string {
  return `<h3>Conditions here</h3><dl class="ws-rows">${v.conditions.tiles.map(tile).join('')}</dl><p class="ws-note">${esc(v.conditions.note)}</p>`
}

// --- Mounting the arm --------------------------------------------------------------------------------

export type Wrist = {
  root: HTMLElement
  main: HTMLElement
  side: HTMLElement
  /** Move the whole arm a little: x, y in px and a twist in degrees, the way a held hand drifts. */
  sway(x: number, y: number, deg: number): void
  /** Lower the arm out of view, then remove it. */
  dismiss(done: () => void): void
  destroy(): void
}

const ARM_SRC = 'assets/wrist-console.webp'
const MAX_WIDTH_FRAC = 0.98
const MAX_HEIGHT_FRAC = 0.62 // the arm may fill at most this much of the window's height
const DISMISS_FALLBACK_MS = 700

export function mountWrist(parent: HTMLElement = document.body): Wrist {
  const root = document.createElement('div')
  root.className = 'eva-wrist'
  root.setAttribute('role', 'complementary')
  root.setAttribute('aria-label', 'EVA walk dashboard on the wrist console')
  const arm = document.createElement('div')
  arm.className = 'eva-arm'
  const img = document.createElement('img')
  img.src = ARM_SRC
  img.alt = ''
  img.width = ARM_W
  img.height = ARM_H
  img.draggable = false
  const glass = (cls: string, size: { w: number; h: number }, quad: Quad) => {
    const el = document.createElement('div')
    el.className = `eva-glass ${cls}`
    el.style.width = `${size.w}px`
    el.style.height = `${size.h}px`
    el.style.transform = cssMatrix3d(homography(size.w, size.h, quad))
    return el
  }
  const main = glass('eva-glass-main', MAIN_SIZE, MAIN_GLASS)
  const side = glass('eva-glass-side', SIDE_SIZE, SIDE_GLASS)
  arm.append(img, main, side)
  // An exit that is always in plain sight, outside the arm: it never depends on reading the screen.
  const exit = document.createElement('button')
  exit.type = 'button'
  exit.className = 'eva-exit'
  exit.dataset.act = 'close'
  exit.textContent = '✕ Exit walk (Esc)'
  root.append(arm, exit)
  parent.append(root)

  let sx = 0
  let sy = 0
  let sdeg = 0
  const place = () => {
    const k = Math.min(
      (window.innerWidth * MAX_WIDTH_FRAC) / ARM_W,
      (window.innerHeight * MAX_HEIGHT_FRAC) / ARM_H,
    )
    arm.style.transform = `translate(-50%, 0) translate(${sx.toFixed(2)}px, ${sy.toFixed(2)}px) rotate(${sdeg.toFixed(3)}deg) scale(${k.toFixed(4)})`
  }
  place()
  window.addEventListener('resize', place)
  requestAnimationFrame(() => root.classList.add('is-up')) // the arm rises from the bottom edge

  return {
    root,
    main,
    side,
    sway(x, y, deg) {
      sx = x
      sy = y
      sdeg = deg
      place()
    },
    dismiss(done) {
      root.classList.remove('is-up')
      let finished = false
      const end = () => {
        if (finished) return
        finished = true
        root.removeEventListener('transitionend', end)
        done()
      }
      root.addEventListener('transitionend', end)
      setTimeout(end, DISMISS_FALLBACK_MS) // a hidden tab or reduced motion may never fire it
    },
    destroy() {
      window.removeEventListener('resize', place)
      root.remove()
    },
  }
}
