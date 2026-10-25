/**
 * The two live charts in mission 1.1, as plain SVG: "One sol of power" and "Oxygen tank over
 * 420 days". One y-axis each, a legend, a hover crosshair with a readout, and a text summary for
 * screen readers. Colours validated with the dataviz palette checker on the dock surface.
 */
import type { PowerProfile } from '../core/power-profile'
import { el } from './dom'

const SVG = 'http://www.w3.org/2000/svg'
const W = 640
const H = 220
const PAD = { left: 44, right: 16, top: 12, bottom: 30 }
const ZONE_H = 290 // taller than the time charts: 30 zones cluster within a few km
const COLOUR = { reactor: '#5b8def', solar: '#c27c22' } // validated pair (dark surface #121a2c)

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
) {
  const node = document.createElementNS(SVG, tag)
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v))
  return node
}

const niceMax = (v: number) => {
  const step = 10 ** Math.floor(Math.log10(Math.max(1, v)))
  return Math.ceil((v * 1.1) / step) * step
}

type Axes = { x: (v: number) => number; y: (v: number) => number; root: SVGSVGElement }

function frame(
  xMax: number,
  yMax: number,
  xTicks: number[],
  xLabel: string,
  yUnit: string,
  title: string,
): Axes {
  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart-svg', role: 'img' })
  root.setAttribute('aria-label', title)
  const x = (v: number) => PAD.left + (v / xMax) * (W - PAD.left - PAD.right)
  const y = (v: number) => H - PAD.bottom - (v / yMax) * (H - PAD.top - PAD.bottom)
  for (let i = 0; i <= 4; i++) {
    const v = (yMax / 4) * i
    root.append(
      svg('line', { x1: PAD.left, x2: W - PAD.right, y1: y(v), y2: y(v), class: 'chart-grid' }),
    )
    const t = svg('text', {
      x: PAD.left - 6,
      y: y(v) + 4,
      class: 'chart-tick',
      'text-anchor': 'end',
    })
    t.textContent = `${Math.round(v).toLocaleString('en-US')}`
    root.append(t)
  }
  for (const v of xTicks) {
    const t = svg('text', {
      x: x(v),
      y: H - PAD.bottom + 16,
      class: 'chart-tick',
      'text-anchor': 'middle',
    })
    t.textContent = String(v)
    root.append(t)
  }
  const xl = svg('text', { x: W - PAD.right, y: H - 2, class: 'chart-axis', 'text-anchor': 'end' })
  xl.textContent = xLabel
  const yl = svg('text', { x: 4, y: PAD.top + 2, class: 'chart-axis' })
  yl.textContent = yUnit
  root.append(xl, yl)
  return { x, y, root }
}

/** Crosshair + readout: `read(fraction)` returns the readout text for a horizontal position. */
function hover(
  axes: Axes,
  wrap: HTMLElement,
  read: (fraction: number) => { x: number; text: string },
) {
  const line = svg('line', {
    y1: PAD.top,
    y2: H - PAD.bottom,
    class: 'chart-crosshair',
    visibility: 'hidden',
  })
  const hit = svg('rect', {
    x: PAD.left,
    y: 0,
    width: W - PAD.left - PAD.right,
    height: H,
    fill: 'transparent',
  })
  const tip = el('div', { className: 'chart-tip', hidden: true })
  axes.root.append(line, hit)
  wrap.append(tip)
  hit.addEventListener('pointermove', (e) => {
    const box = axes.root.getBoundingClientRect()
    const vx = ((e.clientX - box.left) / box.width) * W
    const f = Math.min(1, Math.max(0, (vx - PAD.left) / (W - PAD.left - PAD.right)))
    const r = read(f)
    line.setAttribute('x1', String(r.x))
    line.setAttribute('x2', String(r.x))
    line.setAttribute('visibility', 'visible')
    tip.hidden = false
    tip.textContent = r.text
    tip.style.left = `${(r.x / W) * 100}%`
  })
  hit.addEventListener('pointerleave', () => {
    line.setAttribute('visibility', 'hidden')
    tip.hidden = true
  })
}

const clock = (h: number) =>
  `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`

const legendItem = (label: string, kind: string) =>
  el('li', {}, el('span', { className: `legend-key ${kind}` }), label)

/** Stacked reactor + solar supply against demand through one sol, with the shortfall hatched. */
export function powerChart(p: PowerProfile, title: string): HTMLElement {
  // The profile starts at local midnight; show it in local solar time (24 Mars hours a sol).
  const solHours = p.points.length * p.stepHours
  const pts = p.points.map((q) => ({ ...q, hour: (q.hour / solHours) * 24 }))
  const xMax = 24
  const supply = (q: (typeof pts)[number]) => q.reactorKw + q.solarKw
  const yMax = niceMax(Math.max(...pts.map((q) => Math.max(supply(q), q.demandKw))))
  const axes = frame(xMax, yMax, [0, 6, 12, 18, 24], 'local solar time', 'kW', title)
  const { x, y, root } = axes
  const path = (vals: number[], base?: number[]) => {
    const top = pts.map((q, i) => `${i ? 'L' : 'M'}${x(q.hour)},${y(vals[i] as number)}`).join('')
    if (!base) return top
    const bottom = [...pts]
      .reverse()
      .map((q, i) => `L${x(q.hour)},${y(base[pts.length - 1 - i] as number)}`)
      .join('')
    return `${top}${bottom}Z`
  }
  const reactor = pts.map((q) => q.reactorKw)
  const total = pts.map(supply)
  const zero = pts.map(() => 0)
  const defs = svg('defs')
  const hatch = svg('pattern', {
    id: 'short-hatch',
    width: 6,
    height: 6,
    patternUnits: 'userSpaceOnUse',
    patternTransform: 'rotate(45)',
  })
  hatch.append(svg('line', { x1: 0, y1: 0, x2: 0, y2: 6, class: 'chart-hatch' }))
  defs.append(hatch)
  root.append(defs)
  // Shortfall: between supply and demand wherever supply is lower.
  const short = pts.map((q) => Math.max(supply(q), q.demandKw))
  root.append(
    svg('path', { d: path(short, total), fill: 'url(#short-hatch)', class: 'chart-short' }),
  )
  if (reactor.some((v) => v > 0)) {
    root.append(svg('path', { d: path(reactor, zero), fill: COLOUR.reactor, 'fill-opacity': 0.35 }))
    root.append(
      svg('path', { d: path(reactor), stroke: COLOUR.reactor, 'stroke-width': 2, fill: 'none' }),
    )
  }
  if (pts.some((q) => q.solarKw > 0)) {
    root.append(svg('path', { d: path(total, reactor), fill: COLOUR.solar, 'fill-opacity': 0.35 }))
    root.append(
      svg('path', { d: path(total), stroke: COLOUR.solar, 'stroke-width': 2, fill: 'none' }),
    )
  }
  root.append(svg('path', { d: path(pts.map((q) => q.demandKw)), class: 'chart-demand' }))

  const wrap = el(
    'figure',
    { className: 'chart' },
    el('figcaption', { className: 'chart-title', textContent: title }),
    el(
      'ul',
      { className: 'chart-legend' },
      legendItem('Reactors', 'reactor'),
      legendItem('Solar', 'solar'),
      legendItem('Demand', 'demand'),
      legendItem('Short of demand', 'short'),
    ),
    root,
  )
  hover(axes, wrap, (f) => {
    const q = pts[
      Math.min(pts.length - 1, Math.round(f * (pts.length - 1)))
    ] as (typeof pts)[number]
    return {
      x: x(q.hour),
      text: `${clock(q.hour)} local time: solar ${q.solarKw.toFixed(1)} kW · reactors ${q.reactorKw.toFixed(1)} kW · demand ${q.demandKw.toFixed(1)} kW`,
    }
  })
  return wrap
}

/** Oxygen made over the worst 420 days, sol by sol, against the target. */
export function oxygenChart(
  kgPerSol: readonly number[],
  targetKg: number,
  title: string,
): HTMLElement {
  const cumulative: number[] = []
  kgPerSol.reduce((sum, v) => (cumulative.push(sum + v), sum + v), 0)
  const n = cumulative.length
  const yMax = niceMax(Math.max(targetKg, cumulative[n - 1] ?? 0))
  const axes = frame(
    n,
    yMax,
    [0, 100, 200, 300, 400],
    'sols of the cargo phase',
    'kg of oxygen',
    title,
  )
  const { x, y, root } = axes
  root.append(
    svg('line', { x1: x(0), x2: x(n), y1: y(targetKg), y2: y(targetKg), class: 'chart-target' }),
  )
  const tl = svg('text', {
    x: x(n) - 4,
    y: y(targetKg) - 6,
    class: 'chart-label',
    'text-anchor': 'end',
  })
  tl.textContent = `Needed: ${targetKg.toLocaleString('en-US')} kg`
  root.append(tl)
  if (n) {
    const d = cumulative.map((v, i) => `${i ? 'L' : 'M'}${x(i + 1)},${y(v)}`).join('')
    root.append(
      svg('path', {
        d: `${d}L${x(n)},${y(0)}L${x(1)},${y(0)}Z`,
        fill: COLOUR.reactor,
        'fill-opacity': 0.25,
      }),
    )
    root.append(svg('path', { d, stroke: COLOUR.reactor, 'stroke-width': 2, fill: 'none' }))
  }
  const wrap = el(
    'figure',
    { className: 'chart' },
    el('figcaption', { className: 'chart-title', textContent: title }),
    el(
      'ul',
      { className: 'chart-legend' },
      legendItem('Oxygen in the tanks', 'reactor'),
      legendItem('Needed', 'demand'),
    ),
    root,
  )
  if (n) {
    hover(axes, wrap, (f) => {
      const i = Math.min(n - 1, Math.round(f * (n - 1)))
      return {
        x: x(i + 1),
        text: `Sol ${i + 1}: ${Math.round(cumulative[i] as number).toLocaleString('en-US')} kg`,
      }
    })
  }
  return wrap
}

export type ZonePoint = {
  name: string
  latDeg: number
  elevationM: number
  kind: 'visit' | 'no-terrain' | 'out'
}

const ZONE_KIND_TEXT: Record<ZonePoint['kind'], string> = {
  visit: 'detailed terrain: you visit it',
  'no-terrain': 'inside the limits, no detailed terrain',
  out: 'ruled out',
}

/**
 * Every proposed zone by latitude and elevation, with the human-landing limits drawn: the shaded
 * box is where a crew may land. Kinds differ by shape as well as colour.
 */
export function zoneChart(
  points: readonly ZonePoint[],
  latLimitDeg: number,
  elevLimitM: number,
  title: string,
): HTMLElement {
  const lats = points.map((p) => p.latDeg)
  const elevs = points.map((p) => p.elevationM)
  const xMin = Math.min(-latLimitDeg - 10, ...lats.map((l) => l - 5))
  const xMax = Math.max(latLimitDeg + 10, ...lats.map((l) => l + 5))
  const yMin = Math.floor((Math.min(...elevs) - 500) / 1000) * 1000
  const yMax = Math.ceil((Math.max(elevLimitM, ...elevs) + 1000) / 1000) * 1000
  const root = svg('svg', { viewBox: `0 0 ${W} ${ZONE_H}`, class: 'chart-svg', role: 'img' })
  root.setAttribute('aria-label', title)
  const x = (v: number) => PAD.left + ((v - xMin) / (xMax - xMin)) * (W - PAD.left - PAD.right)
  const y = (v: number) =>
    ZONE_H - PAD.bottom - ((v - yMin) / (yMax - yMin)) * (ZONE_H - PAD.top - PAD.bottom)

  for (let v = yMin; v <= yMax; v += 2000) {
    root.append(
      svg('line', { x1: PAD.left, x2: W - PAD.right, y1: y(v), y2: y(v), class: 'chart-grid' }),
    )
    const t = svg('text', {
      x: PAD.left - 6,
      y: y(v) + 4,
      class: 'chart-tick',
      'text-anchor': 'end',
    })
    t.textContent = `${v / 1000}`
    root.append(t)
  }
  for (const v of [-60, -30, 0, 30, 60].filter((t) => t >= xMin && t <= xMax)) {
    const t = svg('text', {
      x: x(v),
      y: ZONE_H - PAD.bottom + 16,
      class: 'chart-tick',
      'text-anchor': 'middle',
    })
    t.textContent = `${Math.abs(v)}°${v < 0 ? 'S' : v > 0 ? 'N' : ''}`
    root.append(t)
  }
  const xl = svg('text', {
    x: W - PAD.right,
    y: ZONE_H - 2,
    class: 'chart-axis',
    'text-anchor': 'end',
  })
  xl.textContent = 'latitude'
  const yl = svg('text', { x: 4, y: PAD.top + 2, class: 'chart-axis' })
  yl.textContent = 'km'
  root.append(xl, yl)

  // Where a crew may land: inside both latitude limits and below the elevation limit.
  root.append(
    svg('rect', {
      x: x(-latLimitDeg),
      y: y(elevLimitM),
      width: x(latLimitDeg) - x(-latLimitDeg),
      height: y(yMin) - y(elevLimitM),
      class: 'zone-allowed',
    }),
  )
  for (const lat of [-latLimitDeg, latLimitDeg]) {
    root.append(
      svg('line', { x1: x(lat), x2: x(lat), y1: PAD.top, y2: y(yMin), class: 'chart-target' }),
    )
  }
  root.append(
    svg('line', {
      x1: PAD.left,
      x2: W - PAD.right,
      y1: y(elevLimitM),
      y2: y(elevLimitM),
      class: 'chart-target',
    }),
  )
  const limitText = svg('text', {
    x: x(latLimitDeg) - 6,
    y: y(elevLimitM) - 6,
    class: 'chart-label',
    'text-anchor': 'end',
  })
  limitText.textContent = `+${elevLimitM / 1000} km and ±${latLimitDeg}°`
  root.append(limitText)

  const wrap = el(
    'figure',
    { className: 'chart' },
    el('figcaption', { className: 'chart-title', textContent: title }),
    el(
      'ul',
      { className: 'chart-legend' },
      legendItem('Visited next (detailed terrain)', 'zone-visit'),
      legendItem('Inside the limits, no detailed terrain', 'zone-plain'),
      legendItem('Ruled out', 'zone-out'),
      legendItem('Limits', 'demand'),
    ),
    root,
  )
  const tip = el('div', { className: 'chart-tip', hidden: true })
  wrap.append(tip)

  const labels: SVGTextElement[] = []
  const placed: Array<{ x: number; y: number; left: boolean }> = []
  // Draw the plain zones first so the labelled ones sit on top.
  const order = { 'no-terrain': 0, out: 1, visit: 2 } as const
  for (const p of [...points].sort((a, b) => order[a.kind] - order[b.kind])) {
    const cx = x(p.latDeg)
    const cy = y(p.elevationM)
    const g = svg('g', { class: `zone-mark ${p.kind}` })
    if (p.kind === 'out') {
      g.append(
        svg('path', {
          d: `M${cx - 5},${cy - 5}L${cx + 5},${cy + 5}M${cx + 5},${cy - 5}L${cx - 5},${cy + 5}`,
        }),
      )
    } else {
      g.append(svg('circle', { cx, cy, r: p.kind === 'visit' ? 6 : 4.5 }))
    }
    g.append(svg('circle', { cx, cy, r: 11, fill: 'transparent' })) // a target bigger than the mark
    g.addEventListener('pointerenter', () => {
      tip.hidden = false
      tip.textContent = `${p.name}: ${Math.abs(p.latDeg).toFixed(1)}°${p.latDeg < 0 ? 'S' : 'N'}, ${(p.elevationM / 1000).toFixed(1)} km, ${ZONE_KIND_TEXT[p.kind]}`
      tip.style.left = `${(cx / W) * 100}%`
    })
    g.addEventListener('pointerleave', () => (tip.hidden = true))
    root.append(g)
    if (p.kind !== 'no-terrain') {
      // Direct labels for the few zones that matter: southern ones to the left of their mark,
      // northern ones to the right, nudged down past a label already on that side.
      const left = p.latDeg < -2
      let ly = cy + 4
      while (
        placed.some((q) => q.left === left && Math.abs(q.x - cx) < 130 && Math.abs(q.y - ly) < 15)
      )
        ly += 15
      placed.push({ x: cx, y: ly, left })
      const label = svg('text', {
        x: left ? cx - 10 : cx + 10,
        y: ly,
        class: 'chart-label zone-chart-label',
        'text-anchor': left ? 'end' : 'start',
      })
      label.textContent = p.name
      labels.push(label)
    }
  }
  root.append(...labels) // labels last, over every mark
  return wrap
}
