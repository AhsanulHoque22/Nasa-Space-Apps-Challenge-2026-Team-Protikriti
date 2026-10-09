/** The EVA walk dashboard: one screen with everything to know about the walk and where you are on it. */
import type { Profile } from '../core/eva-telemetry'

export type Tone = 'ok' | 'warn' | 'bad'
export type Tile = { label: string; value: string; tone?: Tone; hint?: string }

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
  conditions: { tiles: Tile[]; note: string }
  nearby: { name: string; kind: string; where: string; note: string | null }[]
  know: string[]
  profile: { data: Profile; currentM: number } | null
  navigation: { name: string; count: number; canPrev: boolean; canNext: boolean }
  handheld: boolean
  reducedMotion: boolean
}

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}
export const esc = (text: string): string => text.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c)

const tile = (t: Tile) =>
  `<div class="eva-tile"${t.tone ? ` data-tone="${t.tone}"` : ''}${t.hint ? ` title="${esc(t.hint)}"` : ''}>` +
  `<dt>${esc(t.label)}</dt><dd>${esc(t.value)}</dd></div>`

const PROFILE_W = 1000
const PROFILE_H = 84
const PAD = { l: 6, r: 6, t: 8, b: 6 }

/** Elevation along the route as a small chart: the stops, and a marker where you are. */
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
        `<line x1="${x(d).toFixed(1)}" x2="${x(d).toFixed(1)}" y1="${PAD.t}" y2="${PROFILE_H - PAD.b}" class="eva-pf-stop"/>` +
        `<circle cx="${x(d).toFixed(1)}" cy="${y(points[nearest(points, d)]?.e ?? minE).toFixed(1)}" r="3" class="eva-pf-dot"><title>${esc(stopNames[i] ?? '')}</title></circle>`,
    )
    .join('')
  const here = Math.min(Math.max(currentM, 0), totalM)
  const hereE = points[nearest(points, here)]?.e ?? minE
  return (
    `<svg class="eva-profile" viewBox="0 0 ${PROFILE_W} ${PROFILE_H}" role="img" ` +
    `aria-label="Elevation along the route, from ${Math.round(minE)} to ${Math.round(maxE)} metres, ${esc(String(stopD.length))} stops">` +
    `<path d="${area}" class="eva-pf-area"/><path d="${line}" class="eva-pf-line"/>${stops}` +
    `<circle cx="${x(here).toFixed(1)}" cy="${y(hereE).toFixed(1)}" r="6" class="eva-pf-here"/></svg>`
  )
}

function nearest(points: Profile['points'], d: number): number {
  let best = 0
  points.forEach((p, i) => {
    if (Math.abs(p.d - d) < Math.abs((points[best]?.d ?? 0) - d)) best = i
  })
  return best
}

export function dashboardHtml(v: DashView): string {
  const stops = v.stops
    .map(
      (s, i) =>
        `<li class="${s.current ? 'is-current' : ''}${s.done ? ' is-done' : ''}">` +
        `<button type="button" data-act="goto" data-i="${i}"${s.current ? ' aria-current="step"' : ''}>` +
        `<span class="eva-stop-name">${esc(s.name)}</span>` +
        `<span class="eva-stop-detail">${esc(s.detail)}</span>` +
        (s.near ? `<span class="eva-stop-near">${esc(s.near)}</span>` : '') +
        `</button></li>`,
    )
    .join('')
  const nearby = v.nearby.length
    ? v.nearby
        .map(
          (n) =>
            `<li><span class="eva-near-name">${esc(n.name)}</span>` +
            `<span class="eva-near-where">${esc(n.kind)} · ${esc(n.where)}</span>` +
            (n.note ? `<span class="eva-near-note">${esc(n.note)}</span>` : '') +
            `</li>`,
        )
        .join('')
    : '<li class="eva-empty">No named place within 8 km of here.</li>'
  const profile = v.profile
    ? profileSvg(
        v.profile.data,
        v.profile.currentM,
        v.stops.map((s) => s.name),
      )
    : ''
  const { navigation: nav } = v
  return `
    <header class="eva-top panel">
      <div class="eva-id"><h2>EVA walk · ${esc(v.siteName)}</h2><p>${esc(v.summaryLine)}</p></div>
      <div class="eva-verdict wp-verdict ${v.verdict === 'GO' ? 'wp-go' : 'wp-nogo'}" title="EVA verdict">
        <b>${esc(v.verdict)}</b><span>${esc(v.verdictLine)}</span>
      </div>
      <div class="eva-progress">
        <div class="eva-bar" role="progressbar" aria-label="EVA time used" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(v.progress.fraction * 100)}"><i style="width:${(v.progress.fraction * 100).toFixed(1)}%"></i></div>
        <p>${esc(v.progress.text)}</p>
      </div>
      <p class="eva-clock">${v.clock.map((c) => `<span>${esc(c)}</span>`).join('')}</p>
      <button type="button" data-act="close" class="quiet wp-close">End walk</button>
    </header>

    <div class="eva-sheet">
    <section class="eva-left panel" aria-label="Route">
      <h3>Route</h3>
      <dl class="eva-numbers">${v.numbers.map(tile).join('')}</dl>
      <h3>Stops</h3>
      <ol class="eva-stops">${stops}</ol>
      <h3>Near you</h3>
      <ul class="eva-nearby">${nearby}</ul>
      <details><summary>Route in words</summary><p>${esc(v.words)}</p></details>
      <details><summary>How this is checked</summary><ul>${v.checks.map((c) => `<li>${esc(c)}</li>`).join('')}</ul></details>
    </section>

    <aside class="eva-right" aria-label="Where you are">
      <section class="panel" aria-live="polite">
        <h3>${esc(v.position.title)}</h3>
        <dl class="eva-tiles">${v.position.tiles.map(tile).join('')}</dl>
      </section>
      <section class="panel">
        <h3>Conditions here</h3>
        <dl class="eva-tiles">${v.conditions.tiles.map(tile).join('')}</dl>
        <p class="eva-note">${esc(v.conditions.note)}</p>
      </section>
      <section class="panel">
        <h3>Know before you go</h3>
        <ul class="eva-know">${v.know.map((k) => `<li>${esc(k)}</li>`).join('')}</ul>
      </section>
    </aside>
    </div>

    <footer class="eva-bottom panel">
      ${profile}
      <div class="eva-controls">
        <div class="wp-nav">
          <button type="button" data-act="prev"${nav.canPrev ? '' : ' disabled'} aria-label="Previous stop">‹ Prev</button>
          <span class="wp-pos">${esc(nav.name)} <span class="wp-of">of ${nav.count}</span></span>
          <button type="button" data-act="next"${nav.canNext ? '' : ' disabled'} aria-label="Next stop">Next ›</button>
        </div>
        <div class="wp-actions">
          <button type="button" data-act="sv">Street View</button>
          <button type="button" data-act="rc" title="Tilt the map toward where the walk goes next, at your current zoom">⊙ Recenter</button>
          <button type="button" data-act="zi" aria-label="Zoom in">+</button>
          <button type="button" data-act="zo" aria-label="Zoom out">−</button>
          <button type="button" data-act="hand" aria-pressed="${v.handheld}"${v.reducedMotion ? ' disabled title="Your system asks for reduced motion"' : ' title="A gentle hand-held camera sway"'}>Handheld view</button>
        </div>
      </div>
    </footer>`
}
