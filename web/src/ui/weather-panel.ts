/** Mars weather station panel: latest sol, a Mars year of temperature and pressure. */
import { bandPath, lastMarsYear, linePath, linearScale } from '../core/chart'
import type { SolWeather } from '../core/weather'
import type { WeatherResult, WeatherStation } from '../map/weather-client'

/** Validated with the dataviz palette script against the dark panel surface. */
const TEMP_HUE = '#E8654A'
const PRESSURE_HUE = '#5B8DEF'
const W = 280
const H = 96
const PAD = { left: 34, right: 6, top: 6, bottom: 18 }

export const STATIONS: Record<WeatherStation, { title: string; instrument: string }> = {
  rems: { title: 'Gale crater', instrument: 'Curiosity · REMS' },
  meda: { title: 'Jezero crater', instrument: 'Perseverance · MEDA' },
}

const fmt = (v: number | null | undefined, unit: string) =>
  v == null ? '—' : `${Math.round(v).toLocaleString('en-US').replace('-', '−')}${unit}`

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  if (text !== undefined) node.textContent = text
  return node
}

type Series = { label: string; values: (s: SolWeather) => Array<number | null> }

/** One chart, one measure, one axis. Band if two values per sol, line if one. */
function chart(sols: SolWeather[], series: Series, hue: string, unit: string): HTMLElement {
  const figure = el('figure', 'wx-chart')
  const caption = el('figcaption', undefined, series.label)
  const values = sols.map(series.values)
  const flat = values.flat().filter((v): v is number => v != null)
  const lo = Math.min(...flat)
  const hi = Math.max(...flat)
  const x = linearScale([0, Math.max(1, sols.length - 1)], [PAD.left, W - PAD.right])
  const y = linearScale([lo, hi], [H - PAD.bottom, PAD.top])
  const isBand = values.some((v) => v.length === 2)
  const path = isBand
    ? bandPath(
        values.map((v) => v[0] ?? null),
        values.map((v) => v[1] ?? null),
        x,
        y,
      )
    : linePath(
        values.map((v) => v[0] ?? null),
        x,
        y,
      )
  const first = sols[0]
  const last = sols.at(-1)
  const svgNS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(svgNS, 'svg')
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
  svg.setAttribute('role', 'img')
  svg.setAttribute(
    'aria-label',
    `${series.label}, sols ${first?.sol} to ${last?.sol}: from ${fmt(lo, unit)} to ${fmt(hi, unit)}. Use arrow keys to read values.`,
  )
  svg.setAttribute('tabindex', '0')
  svg.innerHTML = `
    <line x1="${PAD.left}" x2="${W - PAD.right}" y1="${y(hi)}" y2="${y(hi)}" class="wx-grid"/>
    <line x1="${PAD.left}" x2="${W - PAD.right}" y1="${y(lo)}" y2="${y(lo)}" class="wx-grid"/>
    <text x="${PAD.left - 4}" y="${y(hi) + 4}" class="wx-tick" text-anchor="end">${fmt(hi, '')}</text>
    <text x="${PAD.left - 4}" y="${y(lo) + 4}" class="wx-tick" text-anchor="end">${fmt(lo, '')}</text>
    <text x="${PAD.left}" y="${H - 4}" class="wx-tick">Sol ${first?.sol}</text>
    <text x="${W - PAD.right}" y="${H - 4}" class="wx-tick" text-anchor="end">Sol ${last?.sol}</text>
    <path d="${path}" fill="${isBand ? hue : 'none'}" fill-opacity="${isBand ? 0.55 : 0}"
      stroke="${hue}" stroke-width="${isBand ? 1 : 2}" stroke-linejoin="round"/>
    <line class="wx-cursor" y1="${PAD.top}" y2="${H - PAD.bottom}" visibility="hidden"/>`
  const cursor = svg.querySelector('.wx-cursor') as SVGLineElement
  const tip = el('p', 'wx-tip')
  tip.setAttribute('aria-live', 'polite')
  let index = sols.length - 1

  const show = (i: number) => {
    index = Math.max(0, Math.min(sols.length - 1, i))
    const s = sols[index]
    if (!s) return
    const v = values[index] ?? []
    cursor.setAttribute('x1', String(x(index)))
    cursor.setAttribute('x2', String(x(index)))
    cursor.setAttribute('visibility', 'visible')
    const reading = isBand ? `${fmt(v[0], unit)} to ${fmt(v[1], unit)}` : fmt(v[0], unit)
    tip.textContent = `Sol ${s.sol} (${s.earthDate}): ${reading}`
  }
  const hide = () => {
    cursor.setAttribute('visibility', 'hidden')
    tip.textContent = ''
  }
  svg.addEventListener('pointermove', (e) => {
    const box = svg.getBoundingClientRect()
    const px = ((e.clientX - box.left) / box.width) * W
    show(Math.round(((px - PAD.left) / (W - PAD.left - PAD.right)) * (sols.length - 1)))
  })
  svg.addEventListener('pointerleave', hide)
  svg.addEventListener('blur', hide)
  svg.addEventListener('focus', () => show(index))
  svg.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 30 : 1
    if (e.key === 'ArrowLeft') show(index - step)
    else if (e.key === 'ArrowRight') show(index + step)
    else return
    e.preventDefault()
  })
  figure.append(caption, svg, tip)
  return figure
}

function tiles(latest: SolWeather): HTMLElement {
  const dl = el('dl', 'wx-tiles')
  const add = (label: string, value: string) => {
    const div = el('div')
    div.append(el('dt', undefined, label), el('dd', undefined, value))
    dl.append(div)
  }
  add('Air', `${fmt(latest.minC, '°')} / ${fmt(latest.maxC, '°C')}`)
  if (latest.groundMinC !== undefined)
    add('Ground', `${fmt(latest.groundMinC, '°')} / ${fmt(latest.groundMaxC, '°C')}`)
  add('Pressure', fmt(latest.pressurePa, ' Pa'))
  if (latest.opacity !== undefined) add('Sky', latest.opacity ?? '—')
  if (latest.uv !== undefined) add('UV', latest.uv ?? '—')
  add('Sun', `${latest.sunrise ?? '—'} – ${latest.sunset ?? '—'}`)
  return dl
}

function table(sols: SolWeather[]): HTMLElement {
  const details = el('details', 'wx-table')
  details.append(el('summary', undefined, 'Data table (last 10 sols)'))
  const t = el('table')
  t.innerHTML =
    '<thead><tr><th scope="col">Sol</th><th scope="col">Earth date</th><th scope="col">Min °C</th><th scope="col">Max °C</th><th scope="col">Pa</th></tr></thead>'
  const body = el('tbody')
  for (const s of sols.slice(-10).reverse()) {
    const tr = el('tr')
    for (const cell of [
      String(s.sol),
      s.earthDate,
      fmt(s.minC, ''),
      fmt(s.maxC, ''),
      fmt(s.pressurePa, ''),
    ])
      tr.append(el('td', undefined, cell))
    body.append(tr)
  }
  t.append(body)
  details.append(t)
  return details
}

export function renderWeatherPanel(
  parent: HTMLElement,
  station: WeatherStation,
  result: WeatherResult,
  onClose: () => void,
): HTMLElement {
  const info = STATIONS[station]
  const panel = el('section', 'panel weather')
  panel.setAttribute('aria-labelledby', 'wx-title')
  const header = el('div', 'wx-header')
  const title = el('h2', undefined, `Weather · ${info.title}`)
  title.id = 'wx-title'
  const close = el('button', 'wx-close', 'Close')
  close.type = 'button'
  close.addEventListener('click', onClose)
  header.append(title, close)
  const latest = [...result.sols].reverse().find((s) => s.minC != null || s.pressurePa != null)
  const asOf = result.asOf.slice(0, 10)
  const source = el(
    'p',
    'wx-source',
    `${info.instrument} · ${result.source === 'live' ? `live NASA feed, fetched ${asOf}` : `snapshot from ${asOf} (live feed unreachable)`}`,
  )
  panel.append(header, source)
  if (!latest) {
    panel.append(el('p', 'wx-empty', 'No readings in this feed right now.'))
  } else {
    panel.append(el('p', 'wx-sol', `Sol ${latest.sol} · ${latest.earthDate}`), tiles(latest))
    const year = lastMarsYear(result.sols)
    if (year.length > 20) {
      panel.append(
        chart(
          year,
          { label: 'Air temperature range (°C), last Mars year', values: (s) => [s.minC, s.maxC] },
          TEMP_HUE,
          '°C',
        ),
        chart(
          year,
          { label: 'Surface pressure (Pa), last Mars year', values: (s) => [s.pressurePa] },
          PRESSURE_HUE,
          ' Pa',
        ),
      )
    }
    panel.append(table(result.sols))
    const ageDays = (Date.now() - Date.parse(`${latest.earthDate}T00:00:00Z`)) / 86_400_000
    if (ageDays > 60)
      panel.append(
        el(
          'p',
          'wx-note',
          `This station last reported on ${latest.earthDate}; values are historical.`,
        ),
      )
  }
  parent.append(panel)
  return panel
}
