/** A small line chart for mission steps: one series, an optional dashed level, axis ends labelled. */
import { el } from './dom'
import { svg } from './sol-visuals'

const n0 = (x: number) => Math.round(x).toLocaleString('en-US')

export type LineChart = HTMLElement & {
  /** Move the marker to this index, or hide it with null. */
  setCursor: (index: number | null) => void
}

/** A small line chart: `ys` against `xs`, with an optional dashed level and axis titles. */
export function lineChart(
  xs: number[],
  ys: number[],
  opts: {
    title: string
    xLabel: string
    yLabel: string
    level?: number
    levelLabel?: string
    /** A second, dashed series on the same axes, such as the same run with nothing failed. */
    compare?: number[]
    compareLabel?: string
  },
): LineChart {
  const W = 640
  const H = 180
  const L = 48
  const B = 28
  const xMax = Math.max(...xs, 1e-9)
  const yMin = Math.min(...ys, ...(opts.compare ?? []), opts.level ?? Number.POSITIVE_INFINITY)
  const yMax = Math.max(...ys, ...(opts.compare ?? []), opts.level ?? Number.NEGATIVE_INFINITY)
  const span = yMax - yMin || 1
  const xMin = Math.min(...xs, xMax)
  const xSpan = xMax - xMin || 1
  const x = (v: number) => L + ((v - xMin) / xSpan) * (W - L - 12)
  const y = (v: number) => 10 + (1 - (v - yMin) / span) * (H - B - 10)
  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart-svg', role: 'img' })
  root.setAttribute('aria-label', opts.title)
  root.append(
    svg('polyline', {
      points: xs.map((v, i) => `${x(v)},${y(ys[i] ?? 0)}`).join(' '),
      fill: 'none',
      stroke: 'var(--accent)',
      'stroke-width': 2,
    }),
    svg('text', { x: L, y: H - 6, class: 'chart-axis' }, `${opts.xLabel} ${n0(xMin)}`),
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
        stroke: 'var(--hazard)',
        'stroke-dasharray': '6 4',
      }),
      svg(
        'text',
        { x: W - 12, y: y(opts.level) - 4, class: 'chart-axis', 'text-anchor': 'end' },
        opts.levelLabel ?? '',
      ),
    )
  if (opts.compare)
    root.append(
      svg('polyline', {
        points: xs.map((v, i) => `${x(v)},${y(opts.compare?.[i] ?? 0)}`).join(' '),
        fill: 'none',
        stroke: 'var(--text-muted)',
        'stroke-width': 2,
        'stroke-dasharray': '6 5',
      }),
    )
  const line = svg('line', { y1: 10, y2: H - B, stroke: 'var(--text)', 'stroke-width': 1 })
  const dot = svg('circle', { r: 6, fill: 'var(--accent)', stroke: 'var(--text)' })
  const cursor = svg('g', { visibility: 'hidden' })
  cursor.append(line, dot)
  root.append(cursor)
  const chart = el(
    'figure',
    { className: 'chart' },
    el('p', {
      className: 'chart-title',
      textContent: `${opts.title} (${opts.yLabel})${opts.compareLabel ? `, dashed: ${opts.compareLabel}` : ''}`,
    }),
    root,
  ) as unknown as LineChart
  chart.setCursor = (index) => {
    const px = index === null ? undefined : xs[index]
    if (index === null || px === undefined) {
      cursor.setAttribute('visibility', 'hidden')
      return
    }
    cursor.setAttribute('visibility', 'visible')
    line.setAttribute('x1', String(x(px)))
    line.setAttribute('x2', String(x(px)))
    dot.setAttribute('cx', String(x(px)))
    dot.setAttribute('cy', String(y(ys[index] ?? 0)))
  }
  return chart
}
