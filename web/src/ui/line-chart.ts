/** A small line chart for mission steps: one series, an optional dashed level, axis ends labelled. */
import { el } from './dom'
import { svg } from './sol-visuals'

const n0 = (x: number) => Math.round(x).toLocaleString('en-US')

/** A small line chart: `ys` against `xs`, with an optional dashed level and axis titles. */
export function lineChart(
  xs: number[],
  ys: number[],
  opts: { title: string; xLabel: string; yLabel: string; level?: number; levelLabel?: string },
): HTMLElement {
  const W = 640
  const H = 180
  const L = 48
  const B = 28
  const xMax = Math.max(...xs, 1e-9)
  const yMin = Math.min(...ys, opts.level ?? Number.POSITIVE_INFINITY)
  const yMax = Math.max(...ys, opts.level ?? Number.NEGATIVE_INFINITY)
  const span = yMax - yMin || 1
  const x = (v: number) => L + (v / xMax) * (W - L - 12)
  const y = (v: number) => 10 + (1 - (v - yMin) / span) * (H - B - 10)
  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart-svg', role: 'img' })
  root.setAttribute('aria-label', opts.title)
  root.append(
    svg('polyline', {
      points: xs.map((v, i) => `${x(v)},${y(ys[i] ?? 0)}`).join(' '),
      fill: 'none',
      stroke: 'var(--nasa-blue-lift)',
      'stroke-width': 2,
    }),
    svg('text', { x: L, y: H - 6, class: 'chart-axis' }, opts.xLabel),
    svg('text', { x: 4, y: 14, class: 'chart-axis' }, `${n0(yMax)}`),
    svg('text', { x: 4, y: H - B, class: 'chart-axis' }, `${n0(yMin)}`),
    svg('text', { x: W - 12, y: H - 6, class: 'chart-axis', 'text-anchor': 'end' }, `${n0(xMax)}`),
  )
  if (opts.level !== undefined)
    root.append(
      svg('line', {
        x1: L,
        x2: W - 12,
        y1: y(opts.level),
        y2: y(opts.level),
        stroke: '#ff8a78',
        'stroke-dasharray': '6 4',
      }),
      svg(
        'text',
        { x: W - 12, y: y(opts.level) - 4, class: 'chart-axis', 'text-anchor': 'end' },
        opts.levelLabel ?? '',
      ),
    )
  return el(
    'figure',
    { className: 'chart' },
    el('p', { className: 'chart-title', textContent: `${opts.title} (${opts.yLabel})` }),
    root,
  )
}
