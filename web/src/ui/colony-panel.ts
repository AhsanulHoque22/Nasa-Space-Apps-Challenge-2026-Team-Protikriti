/** Colony suitability score panel — SVG radar chart with 6 dimensions. */
import type { ColonyScore } from '../core/colony-score'

const CHANNELS = ['solar', 'ice', 'minerals', 'shelter', 'stability', 'wind'] as const
const ICONS = ['☀', '💧', '⬡', '🕳', '🏗', '💨']
const LABELS = ['Solar', 'Ice', 'Minerals', 'Shelter', 'Stability', 'Wind']
const SVG_NS = 'http://www.w3.org/2000/svg'
const CX = 100
const CY = 100
const R = 70  // radius at score=100
const LABEL_R = 84  // radius for labels

function axisPoint(i: number, score: number): [number, number] {
  const angle = (i * Math.PI * 2) / 6 - Math.PI / 2
  const r = (score / 100) * R
  return [CX + r * Math.cos(angle), CY + r * Math.sin(angle)]
}

function labelPoint(i: number): [number, number] {
  const angle = (i * Math.PI * 2) / 6 - Math.PI / 2
  return [CX + LABEL_R * Math.cos(angle), CY + LABEL_R * Math.sin(angle)]
}

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string> = {}) {
  const e = document.createElementNS(SVG_NS, tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v)
  return e
}

type ColonyPanel = {
  update(score: ColonyScore | null): void
}

export function renderColonyPanel(parent: HTMLElement): ColonyPanel {
  const aside = document.createElement('aside')
  aside.className = 'panel colony-panel'
  aside.setAttribute('aria-label', 'Colony suitability score')

  const title = document.createElement('h3')
  title.textContent = 'Colony Suitability'
  aside.append(title)

  const svg = el('svg', {
    viewBox: '0 0 200 200',
    width: '180',
    height: '180',
    role: 'img',
    'aria-label': 'Radar chart of colony suitability dimensions',
  })

  // Background rings at 25, 50, 75, 100
  for (const pct of [0.25, 0.5, 0.75, 1.0]) {
    const pts = CHANNELS.map((_, i) => axisPoint(i, pct * 100).join(',')).join(' ')
    svg.append(el('polygon', { points: pts, fill: 'none', stroke: 'var(--border)', 'stroke-width': '0.5', opacity: '0.4' }))
  }

  // Axis lines
  for (let i = 0; i < 6; i++) {
    const [x, y] = axisPoint(i, 100)
    svg.append(el('line', { x1: String(CX), y1: String(CY), x2: String(x), y2: String(y), stroke: 'var(--border)', 'stroke-width': '0.5', opacity: '0.4' }))
  }

  // Score polygon (updated on each call)
  const poly = el('polygon', {
    points: '',
    fill: 'rgba(255,180,40,0.25)',
    stroke: 'rgba(255,180,40,0.9)',
    'stroke-width': '1.5',
  })
  svg.append(poly)

  // Labels
  for (let i = 0; i < 6; i++) {
    const [lx, ly] = labelPoint(i)
    const t = el('text', {
      x: String(lx),
      y: String(ly),
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      'font-size': '8',
      fill: 'var(--fg)',
    })
    t.textContent = `${ICONS[i]}`
    svg.append(t)
  }

  aside.append(svg)

  // Score dl
  const dl = document.createElement('dl')
  dl.className = 'colony-score-dl'
  const valueEls: HTMLElement[] = []
  for (let i = 0; i < 6; i++) {
    const dt = document.createElement('dt')
    dt.textContent = `${ICONS[i]} ${LABELS[i]}`
    const dd = document.createElement('dd')
    dd.textContent = '—'
    valueEls.push(dd)
    dl.append(dt, dd)
  }
  aside.append(dl)

  const placeholder = document.createElement('p')
  placeholder.className = 'colony-placeholder'
  placeholder.textContent = 'Hover the globe to read suitability'
  aside.append(placeholder)

  parent.append(aside)

  function update(score: ColonyScore | null) {
    if (!score) {
      poly.setAttribute('points', '')
      for (const dd of valueEls) dd.textContent = '—'
      placeholder.style.display = ''
      return
    }
    placeholder.style.display = 'none'
    const scores = CHANNELS.map((ch) => score[ch] ?? 0)
    const pts = scores.map((s, i) => axisPoint(i, s).join(',')).join(' ')
    poly.setAttribute('points', pts)
    for (let i = 0; i < 6; i++) {
      const v = score[CHANNELS[i]]
      valueEls[i].textContent = v === null ? 'n/a' : String(v)
    }
  }

  return { update }
}
