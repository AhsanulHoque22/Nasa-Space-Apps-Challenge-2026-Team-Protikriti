/**
 * Site report: a dossier on one spot, opened over the map. A snapshot of the view, NASA photos of
 * the nearest mapped features, the colony scores as dials, a sol, a year of dust and of daylight
 * as charts, and every value with its dataset.
 */
import { formatMarsPosition } from '../core/coords'
import { type Site, elevationAt, siteAt } from '../core/elevation'
import type { Grid } from '../core/grid'
import { season, solarLongitudeDeg } from '../core/mars-time'
import type { Place } from '../core/search'
import { type ThermalGrid, firmerThanPct, thermalAt } from '../core/thermal'
import { DOSE_RATES, daysToLimit, surfaceMsvPerSol } from '../core/dose'
import type { ColonyScore } from '../core/colony-score'
import { SITE_BRIEFS, type SiteFeature } from '../core/site-features'
import {
  type SwimGrid,
  daylightHours,
  daylightYearSeries,
  distanceKm,
  dustYearSeries,
  iceAt,
  iceVerdict,
  nearest,
  solTemperatureSeries,
} from '../core/site-report'
import { dial } from './dial'
import { svg } from './sol-visuals'

export type ReportContext = {
  sites: readonly Site[]
  mola: Grid
  places: readonly Place[]
  swim: SwimGrid | null
  /** THEMIS thermal inertia for the mapped sites (empty if the pipeline did not write it). */
  thermal: readonly ThermalGrid[]
  /** Colony suitability at the spot, or null before the score grid loads. */
  score: ColonyScore | null
  /** A picture of the map view right now, or null if the canvas cannot be read. */
  snapshot: string | null
  /** The map clock (scene time). */
  utcMs: number
}

const SCORES: ReadonlyArray<{ key: keyof ColonyScore; label: string; tip: string }> = [
  { key: 'solar', label: 'Solar', tip: 'Sunlight for solar panels over a year' },
  { key: 'ice', label: 'Ice', tip: 'Water ice within reach for drinking water and fuel' },
  { key: 'minerals', label: 'Minerals', tip: 'Useful minerals mapped from orbit' },
  { key: 'shelter', label: 'Shelter', tip: 'Natural cover from radiation and wind' },
  { key: 'stability', label: 'Stability', tip: 'Firm, level ground to build on' },
  { key: 'wind', label: 'Calm', tip: 'Lower wind, less dust blown onto equipment' },
]

/** Thermal inertia and where it ranks within its site. */
function firmness(grids: readonly ThermalGrid[], lon: number, lat: number): string {
  for (const g of grids) {
    const v = thermalAt(g, lon, lat)
    if (v === null) continue
    const pct = Math.round(firmerThanPct(g, v))
    const reading =
      pct >= 67 ? 'firmer, rockier ground' : pct <= 33 ? 'looser, finer ground' : 'mid-range ground'
    return `${Math.round(v)} J m⁻² K⁻¹ s⁻½: ${reading}, firmer than ${pct}% of this site`
  }
  return 'Mapped only at the Jezero, Gale and InSight sites'
}

const hm = (hours: number) =>
  `${Math.floor(hours)} h ${String(Math.round((hours % 1) * 60)).padStart(2, '0')} min`
const km = (v: number) => (v < 10 ? v.toFixed(1) : Math.round(v).toLocaleString('en-US'))
const minus = (s: string) => s.replace('-', '−')

function h(tag: string, cls?: string, text?: string): HTMLElement {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text !== undefined) e.textContent = text
  return e
}

/** A labelled line chart with min/max on the y axis and an optional "now" marker. */
function chart(o: {
  title: string
  xs: number[]
  ys: number[]
  xLabel: string
  yUnit: string
  nowX?: number
  digits?: number
}): HTMLElement {
  const W = 320
  const H = 120
  const L = 40
  const B = 22
  const T = 8
  const yMin = Math.min(...o.ys)
  const yMax = Math.max(...o.ys)
  const ySpan = yMax - yMin || 1
  const xMin = Math.min(...o.xs)
  const xSpan = Math.max(...o.xs) - xMin || 1
  const x = (v: number) => L + ((v - xMin) / xSpan) * (W - L - 8)
  const y = (v: number) => T + (1 - (v - yMin) / ySpan) * (H - B - T)
  const d = o.xs.map((xv, i) => `${i ? 'L' : 'M'}${x(xv).toFixed(1)},${y(o.ys[i] ?? 0).toFixed(1)}`)
  const area = `${d.join('')}L${x(o.xs.at(-1) ?? 0)},${H - B}L${x(xMin)},${H - B}Z`
  const fmt = (v: number) => minus(v.toFixed(o.digits ?? 0))
  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'sd-chart', role: 'img' })
  root.setAttribute(
    'aria-label',
    `${o.title}: from ${fmt(yMin)} to ${fmt(yMax)} ${o.yUnit} across ${o.xLabel}`,
  )
  root.append(
    svg('line', { x1: L, y1: H - B, x2: W - 8, y2: H - B, class: 'sd-axis' }),
    svg('line', { x1: L, y1: T, x2: L, y2: H - B, class: 'sd-axis' }),
    svg('path', { d: area, class: 'sd-area' }),
    svg('path', { d: d.join(''), class: 'sd-line' }),
  )
  const label = (text: string, attrs: Record<string, string | number>) => {
    const t = svg('text', attrs)
    t.textContent = text
    root.append(t)
  }
  label(`${fmt(yMax)} ${o.yUnit}`, { x: L - 4, y: T + 8, class: 'sd-tick', 'text-anchor': 'end' })
  label(fmt(yMin), { x: L - 4, y: H - B, class: 'sd-tick', 'text-anchor': 'end' })
  label(String(xMin), { x: L, y: H - 6, class: 'sd-tick' })
  label(o.xLabel, { x: W - 8, y: H - 6, class: 'sd-tick', 'text-anchor': 'end' })
  if (o.nowX !== undefined) {
    const nx = x(o.nowX)
    root.append(svg('line', { x1: nx, y1: T, x2: nx, y2: H - B, class: 'sd-now' }))
    label('now', { x: nx + 3, y: T + 8, class: 'sd-tick sd-now-label' })
  }
  const fig = h('figure', 'sd-figure')
  fig.append(root, h('figcaption', '', o.title))
  return fig
}

/** Up to `n` NASA feature photos from the mapped site the spot is in, nearest first. */
function nearbyPhotos(siteId: string | undefined, lon: number, lat: number, n: number) {
  const brief = SITE_BRIEFS.find((b) => b.siteId === siteId)
  if (!brief) return []
  return [...brief.features]
    .map((f): [SiteFeature, number] => [f, distanceKm(lon, lat, f.lon, f.lat)])
    .sort((a, b) => a[1] - b[1])
    .slice(0, n)
}

function rowList(rows: Array<[string, string, string]>): HTMLElement {
  const dl = h('dl', 'sd-rows')
  for (const [label, value, source] of rows) {
    const div = h('div')
    const dd = h('dd', '', value)
    dd.append(h('span', 'sd-source', source))
    div.append(h('dt', '', label), dd)
    dl.append(div)
  }
  return dl
}

function section(title: string, ...children: HTMLElement[]): HTMLElement {
  const s = h('section', 'sd-section')
  s.append(h('h3', 'sd-h3', title), ...children)
  return s
}

export function renderSiteReport(lon: number, lat: number, ctx: ReportContext): HTMLDialogElement {
  document.querySelector('dialog.site-dossier')?.remove()
  const now = ctx.utcMs
  const pos = formatMarsPosition(lon, lat, undefined)
  const elev = elevationAt(ctx.sites, ctx.mola, lon, lat)
  const daylight = daylightHours(now, lon, lat)
  const ls = solarLongitudeDeg(now)
  const ice = ctx.swim ? iceAt(ctx.swim, lon, lat) : null
  const site = siteAt(ctx.sites, lon, lat)
  const station = site?.id === 'gale' ? 'gale' : 'jezero'
  const named = nearest(ctx.places, 'feature', lon, lat)
  const near = (kind: Place['kind']) => {
    const n = nearest(ctx.places, kind, lon, lat)
    return n ? `${n.place.name} · ${km(n.km)} km` : '—'
  }

  const dialog = document.createElement('dialog')
  dialog.className = 'site-dossier'
  dialog.setAttribute('aria-labelledby', 'sd-title')

  // Header
  const head = h('header', 'sd-head')
  const titles = h('div')
  titles.append(
    Object.assign(h('h2', 'sd-title', 'Site report'), { id: 'sd-title' }),
    h(
      'p',
      'sd-where',
      `${pos.lat}, ${pos.lon}${named ? ` · ${km(named.km)} km from ${named.place.name}` : ''}`,
    ),
  )
  const close = h('button', 'sd-close', 'Close') as HTMLButtonElement
  close.type = 'button'
  close.addEventListener('click', () => dialog.close())
  head.append(titles, close)

  // Pictures: the view right now, then the nearest NASA feature photos at a mapped site.
  const gallery = h('div', 'sd-gallery')
  if (ctx.snapshot) {
    const fig = h('figure', 'sd-photo sd-photo-main')
    const img = Object.assign(document.createElement('img'), {
      src: ctx.snapshot,
      alt: `The map view centred on ${pos.lat}, ${pos.lon}`,
    })
    fig.append(
      img,
      h('figcaption', '', 'This view now · orbital imagery and terrain as on the map'),
    )
    gallery.append(fig)
  }
  for (const [f, dist] of nearbyPhotos(site?.id, lon, lat, 2)) {
    const fig = h('figure', 'sd-photo')
    const img = Object.assign(document.createElement('img'), {
      src: f.photo.src,
      alt: f.photo.alt,
      loading: 'lazy',
    })
    const cap = h('figcaption', '', `${f.name} · ${km(dist)} km · `)
    const link = Object.assign(document.createElement('a'), {
      href: f.photo.page,
      target: '_blank',
      rel: 'noopener',
      textContent: f.photo.credit,
    })
    cap.append(link)
    fig.append(img, cap)
    gallery.append(fig)
  }

  // Colony scores as dials, with the strongest and weakest named.
  const dials = h('div', 'sd-dials')
  const scored: Array<[string, number]> = []
  for (const s of SCORES) {
    const v = ctx.score?.[s.key] ?? null
    const d = dial({ label: s.label, share: (v ?? 0) / 100, reading: v === null ? '—' : `${v}` })
    d.update((v ?? 0) / 100, v === null ? 'no data' : `${v}/100`)
    d.title = s.tip
    dials.append(d)
    if (v !== null) scored.push([s.label, v])
  }
  scored.sort((a, b) => b[1] - a[1])
  const best = scored[0]
  const worst = scored.at(-1)
  const verdict = h(
    'p',
    'sd-verdict',
    best && worst
      ? `Strongest: ${best[0]} ${best[1]}/100. Weakest: ${worst[0]} ${worst[1]}/100.`
      : 'Colony scores cover the mapped sites only.',
  )

  // Charts
  const temps = solTemperatureSeries(now, station)
  const dust = dustYearSeries()
  const light = daylightYearSeries(now, lon, lat)
  const charts = h('div', 'sd-charts')
  charts.append(
    chart({
      title: `Air through one sol (${station === 'gale' ? 'REMS, Gale' : 'MEDA, Jezero'} climatology)`,
      xs: temps.hours,
      ys: temps.tempC,
      xLabel: '24 h LMST',
      yUnit: '°C',
    }),
    chart({
      title: 'Dust opacity τ across a Mars year (Lemmon et al.)',
      xs: dust.ls,
      ys: dust.tau,
      xLabel: 'Ls 360°',
      yUnit: 'τ',
      nowX: ls,
      digits: 1,
    }),
    chart({
      title: 'Hours of daylight here, the next Mars year (Mars24)',
      xs: light.sol,
      ys: light.hours,
      xLabel: '669 sols',
      yUnit: 'h',
      nowX: 0,
      digits: 1,
    }),
  )

  const surfacePerDay = DOSE_RATES.find((r) => r.id === 'surface')?.msvPerDay ?? null
  const limitDays = daysToLimit(surfacePerDay)

  const body = h('div', 'sd-body')
  body.append(
    section(
      'Colony outlook',
      dials,
      verdict,
      h('p', 'sd-note', 'Scores 0–100 from the colony score grid; hover a dial for its meaning.'),
    ),
    section('Sky and climate', charts),
    section(
      'Ground',
      rowList([
        ['Elevation', `${minus(Math.round(elev.m).toLocaleString('en-US'))} m`, elev.source],
        [
          'Terrain detail',
          site ? `${site.name} · ${site.grid.pixelSizeM} m grid` : 'Orbital only (MOLA 15 km)',
          'Mapped site DEMs',
        ],
        [
          'Ground firmness',
          firmness(ctx.thermal, lon, lat),
          'THEMIS thermal inertia, 100 m (Fergason et al. 2006)',
        ],
        ['Nearest named feature', near('feature'), 'IAU gazetteer'],
        ['Nearest landing site', near('landing'), 'Landing sites'],
        ['Nearest exploration zone', near('zone'), 'NASA 2015 workshop'],
      ]),
    ),
    section(
      'Water, light and radiation',
      rowList([
        [
          'Shallow water ice',
          `${iceVerdict(ice)}${ice === null ? '' : ` (${ice >= 0 ? '+' : ''}${ice.toFixed(2)})`}`,
          'SWIM 2.0, 0–1 m depth',
        ],
        [
          'Daylight today',
          daylight >= 23.95
            ? 'Midnight sun (24 h)'
            : daylight <= 0.05
              ? 'Polar night (0 h)'
              : hm(daylight),
          'Mars24 sun model, Mars hours (1/24 sol)',
        ],
        ['Season', `${season(ls, lat)} · Ls ${ls.toFixed(0)}°`, 'Mars24'],
        [
          'Surface radiation',
          `≈ ${surfaceMsvPerSol().toFixed(2)} mSv per sol${limitDays ? ` · career limit in ${Math.round(limitDays).toLocaleString('en-US')} days unshielded` : ''}`,
          'MSL RAD (Hassler et al. 2014); varies with altitude and solar cycle',
        ],
      ]),
    ),
  )

  dialog.append(head, gallery, body)
  dialog.addEventListener('close', () => dialog.remove())
  // A click on the dimmed map outside the dossier closes it, as Esc does.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close()
  })
  document.body.append(dialog)
  dialog.showModal()
  close.focus()
  return dialog
}
