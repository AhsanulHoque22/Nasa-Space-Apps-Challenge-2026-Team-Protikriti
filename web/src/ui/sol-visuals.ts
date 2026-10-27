/**
 * Seeing sols: what a sol is (mission 1.1), and on the survival clock (mission 1.4) one sol's
 * daylight at the base and the whole stay as a timeline of seasons, dust season and supplies.
 * Plain SVG with text labels, so nothing is told by colour alone.
 */
import { DAYS_PER_SOL, SURFACE_STAY_SOLS } from '../core/mission-constants'
import { type SolRun, solsInEarthDays } from '../core/sol-time'
import { el } from './dom'

const SVG = 'http://www.w3.org/2000/svg'
const DAY = '#c27c22' // the solar colour of the mission 1.1 charts
const SUPPLY = '#5b8def'

export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
  text?: string,
) {
  const node = document.createElementNS(SVG, tag)
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v))
  if (text) node.textContent = text
  return node
}

const SOL_SECONDS = DAYS_PER_SOL * 86_400
const solLength = () => {
  const h = Math.floor(SOL_SECONDS / 3600)
  const m = Math.floor((SOL_SECONDS % 3600) / 60)
  const s = Math.round(SOL_SECONDS % 60)
  return { h, m, s }
}
const hhmm = (hours: number) =>
  `${String(Math.floor(hours)).padStart(2, '0')}:${String(Math.floor((hours % 1) * 60)).padStart(2, '0')}`

/** "What is a sol?": an Earth day and a sol side by side, and the stay in Earth days. */
export function solExplainer(): HTMLElement {
  const { h, m, s } = solLength()
  const extraShare = (SOL_SECONDS - 86_400) / SOL_SECONDS
  const part = (className: string, share: number) => {
    const span = el('span', { className })
    span.style.width = `${share * 100}%`
    return span
  }
  const bar = (label: string, value: string, extra: boolean) =>
    el(
      'div',
      { className: 'sol-bar' },
      el('span', { className: 'sol-bar-label', textContent: label }),
      el(
        'span',
        { className: 'sol-bar-track' },
        part('sol-bar-base', 1 - extraShare),
        ...(extra ? [part('sol-bar-extra', extraShare)] : []),
      ),
      el('span', { className: 'sol-bar-value', textContent: value }),
    )
  return el(
    'section',
    { className: 'sol-explainer', ariaLabel: 'What is a sol?' },
    el('h3', { className: 'chart-title', textContent: 'What is a sol?' }),
    el('p', {
      textContent: `A sol is one day on Mars: sunrise to sunrise takes ${h} h ${m} min ${s} s. Missions on Mars count sols, not Earth days.`,
    }),
    bar('Earth day', '24 h', false),
    bar('Sol', `${h} h ${m} min (+${m} min)`, true),
    el('p', {
      className: 'dock-note',
      textContent: `The crew's ${SURFACE_STAY_SOLS} sols = ${Math.round(solsInEarthDays(SURFACE_STAY_SOLS))} Earth days. A Mars year is about 669 sols (687 Earth days). Sol length: Allison & McEwen 2000 (NASA Mars24).`,
    }),
  )
}

/** One sol at the base as a 24-hour dial: daylight arc, night, and the clock hand. */
export function solDial(day: { riseH: number; setH: number } | null, nowH: number): HTMLElement {
  const R = 80
  const C = 110
  const at = (hour: number, r: number) => {
    const a = (hour / 24) * 2 * Math.PI + Math.PI / 2 // noon at the top, where the Sun is high
    return [C + r * Math.cos(a), C + r * Math.sin(a)] as const
  }
  const root = svg('svg', { viewBox: '0 0 220 220', class: 'sol-dial', role: 'img' })
  root.append(svg('circle', { cx: C, cy: C, r: R, class: 'sol-dial-night' }))
  if (day) {
    const [x1, y1] = at(day.riseH, R)
    const [x2, y2] = at(day.setH, R)
    const large = day.setH - day.riseH > 12 ? 1 : 0
    root.append(
      svg('path', {
        d: `M ${C} ${C} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`,
        fill: DAY,
        'fill-opacity': 0.85,
      }),
    )
  }
  for (const [hour, label] of [
    [0, 'midnight'],
    [6, '06:00'],
    [12, 'noon'],
    [18, '18:00'],
  ] as const) {
    const [x, y] = at(hour, R + 16)
    root.append(svg('text', { x, y: y + 4, class: 'chart-tick', 'text-anchor': 'middle' }, label))
  }
  const [hx, hy] = at(nowH, R - 6)
  root.append(svg('line', { x1: C, y1: C, x2: hx, y2: hy, class: 'sol-dial-hand' }))
  root.append(svg('circle', { cx: C, cy: C, r: 4, class: 'sol-dial-pin' }))
  const caption = day
    ? `Sunrise ${hhmm(day.riseH)}, sunset ${hhmm(day.setH)} local Mars time. The arrays make power only in the light; the reactors carry the night. Now: ${hhmm(nowH)}.`
    : `The Sun does not rise and set today at this latitude. Now: ${hhmm(nowH)}.`
  root.setAttribute('aria-label', `One sol at the base. ${caption}`)
  return el(
    'figure',
    { className: 'chart sol-dial-figure' },
    el('h3', { className: 'chart-title', textContent: 'One sol at your base' }),
    root,
    el('figcaption', { className: 'dock-note', textContent: caption }),
  )
}

export type Supply = { label: string; lastSol: number }

export type TimelineInput = {
  sols: number
  todaySol: number
  seasons: Array<SolRun & { label: string }>
  dust: SolRun[]
  supplies: Supply[]
}

/** The whole stay: seasons, dust storm season, and when each packed supply runs out. */
export function solTimeline(t: TimelineInput): HTMLElement {
  const W = 640
  const PAD = { left: 96, right: 12 }
  const ROW = 26
  const rows = 2 + t.supplies.length
  const H = 30 + rows * ROW + 22
  const x = (sol: number) => PAD.left + ((sol - 1) / t.sols) * (W - PAD.left - PAD.right)
  const width = (r: SolRun) => x(r.toSol + 1) - x(r.fromSol)
  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart-svg', role: 'img' })
  const rowY = (i: number) => 24 + i * ROW
  const rowLabel = (i: number, text: string) =>
    root.append(svg('text', { x: 0, y: rowY(i) + 15, class: 'chart-axis' }, text))

  rowLabel(0, t.seasons[0]?.label.startsWith('Southern') ? 'Season (south)' : 'Season (north)')
  t.seasons.forEach((s, i) => {
    root.append(
      svg('rect', {
        x: x(s.fromSol),
        y: rowY(0),
        width: width(s) - 2,
        height: 20,
        rx: 3,
        class: i % 2 ? 'sol-season alt' : 'sol-season',
      }),
    )
    if (width(s) > 90)
      root.append(
        svg(
          'text',
          { x: x(s.fromSol) + 6, y: rowY(0) + 14, class: 'sol-band-text' },
          s.label.replace(/^(Northern|Southern) /, ''),
        ),
      )
  })

  rowLabel(1, 'Dust season')
  for (const d of t.dust)
    root.append(
      svg('rect', {
        x: x(d.fromSol),
        y: rowY(1),
        width: width(d),
        height: 20,
        rx: 3,
        class: 'sol-dust',
      }),
    )

  t.supplies.forEach((s, i) => {
    const y = rowY(2 + i)
    const last = Math.min(s.lastSol, t.sols)
    rowLabel(2 + i, s.label)
    if (last >= 1)
      root.append(
        svg('rect', { x: x(1), y, width: x(last + 1) - x(1), height: 20, rx: 3, fill: SUPPLY }),
      )
    if (last < t.sols) {
      root.append(
        svg('rect', {
          x: x(last + 1),
          y,
          width: x(t.sols + 1) - x(last + 1),
          height: 20,
          rx: 3,
          class: 'sol-short',
        }),
      )
      const narrow = x(t.sols + 1) - x(last + 1) < 220
      root.append(
        svg(
          'text',
          narrow
            ? { x: x(last + 1) - 6, y: y + 14, class: 'sol-band-text', 'text-anchor': 'end' }
            : { x: x(last + 1) + 6, y: y + 14, class: 'sol-band-text' },
          `runs out after sol ${last}: ${t.sols - last} sols short`,
        ),
      )
    }
  })

  // "You are here" and the return window.
  const top = 16
  const bottom = rowY(rows) + 2
  root.append(
    svg('line', {
      x1: x(t.todaySol),
      x2: x(t.todaySol),
      y1: top,
      y2: bottom,
      class: 'sol-today',
    }),
  )
  root.append(
    svg(
      'text',
      { x: x(t.todaySol), y: 12, class: 'chart-label' },
      `You are here: sol ${t.todaySol}`,
    ),
  )
  root.append(
    svg(
      'text',
      { x: W - PAD.right, y: 12, class: 'chart-label', 'text-anchor': 'end' },
      `Return window: sol ${t.sols}`,
    ),
  )
  for (const sol of [1, 100, 200, 300, 400, 500].filter((s) => s <= t.sols))
    root.append(
      svg(
        'text',
        { x: x(sol), y: bottom + 16, class: 'chart-tick', 'text-anchor': 'middle' },
        String(sol),
      ),
    )

  const shortfalls = t.supplies
    .filter((s) => s.lastSol < t.sols)
    .map((s) => `${s.label} runs out after sol ${s.lastSol}`)
  const summary = `Sol ${t.todaySol} of ${t.sols}. ${shortfalls.length ? shortfalls.join('; ') + '.' : 'Every packed supply lasts the stay.'} Dust season: ${t.dust.map((d) => `sols ${d.fromSol}–${d.toSol}`).join(', ') || 'not during this stay'}.`
  root.setAttribute('aria-label', summary)
  return el(
    'figure',
    { className: 'chart' },
    el('h3', { className: 'chart-title', textContent: `${t.sols} sols on Mars` }),
    el(
      'ul',
      { className: 'chart-legend' },
      el('li', {}, el('span', { className: 'legend-key sol-key-supply' }), 'Packed supply lasts'),
      el('li', {}, el('span', { className: 'legend-key short' }), 'Runs short'),
      el('li', {}, el('span', { className: 'legend-key sol-key-dust' }), 'Dust storm season'),
    ),
    root,
    el('figcaption', { className: 'dock-note', textContent: summary }),
  )
}
