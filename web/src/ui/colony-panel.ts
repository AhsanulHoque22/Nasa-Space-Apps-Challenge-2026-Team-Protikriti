/** Colony suitability: a radar and a scored list for the place under the pointer or view centre. */
import type { ColonyScore } from '../core/colony-score'

const CHANNELS = [
  {
    id: 'solar',
    label: 'Solar',
    icon: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
  },
  {
    id: 'ice',
    label: 'Ice',
    icon: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  },
  {
    id: 'minerals',
    label: 'Minerals',
    icon: '<path d="m12 3 7 4v10l-7 4-7-4V7zM5 7l7 4 7-4M12 11v10"/>',
  },
  {
    id: 'shelter',
    label: 'Shelter',
    icon: '<path d="M3 20c0-9 4-15 9-15s9 6 9 15M8 20c0-5 2-8 4-8s4 3 4 8M2 20h20"/>',
  },
  {
    id: 'stability',
    label: 'Stability',
    icon: '<path d="m3 19 6-10 4 6 3-4 5 8zM2 22h20"/>',
  },
  {
    id: 'wind',
    label: 'Wind',
    icon: '<path d="M3 9h11a3 3 0 1 0-3-3M3 14h15a3 3 0 1 1-3 3M3 19h6"/>',
  },
] as const

const SVG_NS = 'http://www.w3.org/2000/svg'
const CX = 100
const CY = 100
const R = 70 // radius at score=100
const ICON_R = 86 // radius of the icons around the radar
const ICON_SIZE = 16

function axisPoint(i: number, score: number, radius = R): [number, number] {
  const angle = (i * Math.PI * 2) / CHANNELS.length - Math.PI / 2
  const r = (score / 100) * radius
  return [CX + r * Math.cos(angle), CY + r * Math.sin(angle)]
}

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string> = {}) {
  const e = document.createElementNS(SVG_NS, tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v)
  return e
}

function radar(): { svg: SVGSVGElement; shape: SVGPolygonElement } {
  const svg = svgEl('svg', {
    viewBox: '0 0 200 200',
    role: 'img',
    'aria-label': 'Radar chart of the six scores listed below',
  })
  for (const pct of [25, 50, 75, 100]) {
    const points = CHANNELS.map((_, i) => axisPoint(i, pct).join(',')).join(' ')
    svg.append(svgEl('polygon', { points, class: 'colony-ring' }))
  }
  CHANNELS.forEach((channel, i) => {
    const [x, y] = axisPoint(i, 100)
    svg.append(
      svgEl('line', {
        x1: String(CX),
        y1: String(CY),
        x2: String(x),
        y2: String(y),
        class: 'colony-ring',
      }),
    )
    const [ix, iy] = axisPoint(i, 100, ICON_R)
    const icon = svgEl('svg', {
      x: String(ix - ICON_SIZE / 2),
      y: String(iy - ICON_SIZE / 2),
      width: String(ICON_SIZE),
      height: String(ICON_SIZE),
      viewBox: '0 0 24 24',
      class: 'colony-icon',
    })
    icon.innerHTML = channel.icon
    svg.append(icon)
  })
  const shape = svgEl('polygon', { points: '', class: 'colony-shape' })
  svg.append(shape)
  return { svg, shape }
}

export type ColonyPanel = {
  /** `where` names the place being read: 'Pointer' or 'View centre'. */
  update(score: ColonyScore, where: string): void
  showSources(sources: readonly string[], caveat: string): void
  fail(): void
}

export function renderColonyPanel(parent: HTMLElement): ColonyPanel {
  const aside = document.createElement('aside')
  aside.className = 'panel colony-panel'
  aside.setAttribute('aria-label', 'Colony suitability score')

  const title = document.createElement('h2')
  title.textContent = 'Colony suitability'
  const where = document.createElement('p')
  where.className = 'colony-where'
  where.textContent = 'Hover the globe to read a place.'
  const { svg, shape } = radar()

  const list = document.createElement('dl')
  list.className = 'colony-score-dl'
  const rows = CHANNELS.map((channel) => {
    const row = document.createElement('div')
    row.className = 'colony-row'
    row.innerHTML = `
      <dt><svg viewBox="0 0 24 24" class="colony-icon" aria-hidden="true">${channel.icon}</svg>${channel.label}</dt>
      <dd><span class="colony-meter" aria-hidden="true"><i></i></span><b>—</b></dd>`
    list.append(row)
    return {
      id: channel.id,
      bar: row.querySelector('i') as HTMLElement,
      value: row.querySelector('b') as HTMLElement,
    }
  })

  const scale = document.createElement('p')
  scale.className = 'colony-scale'
  scale.textContent = 'Each score is out of 100. Higher is better.'
  const sourcesBox = document.createElement('details')
  sourcesBox.className = 'colony-sources'
  sourcesBox.hidden = true
  aside.append(title, where, svg, list, scale, sourcesBox)
  parent.append(aside)

  return {
    update(score, label) {
      where.textContent = label
      const values = rows.map(({ id }) => score[id])
      shape.setAttribute('points', values.map((v, i) => axisPoint(i, v ?? 0).join(',')).join(' '))
      rows.forEach(({ bar, value }, i) => {
        const v = values[i] ?? null
        bar.style.width = `${v ?? 0}%`
        value.textContent = v === null ? 'n/a' : String(v)
      })
    },
    showSources(sources, caveat) {
      const summary = document.createElement('summary')
      summary.textContent = 'Where these scores come from'
      const items = document.createElement('ul')
      CHANNELS.forEach((channel, i) => {
        const item = document.createElement('li')
        const name = document.createElement('strong')
        name.textContent = `${channel.label}: `
        item.append(name, sources[i] ?? '')
        items.append(item)
      })
      const note = document.createElement('p')
      note.textContent = caveat
      sourcesBox.replaceChildren(summary, items, note)
      sourcesBox.hidden = false
    },
    fail() {
      where.textContent = 'The scores could not load. Check your connection and reload.'
    },
  }
}
