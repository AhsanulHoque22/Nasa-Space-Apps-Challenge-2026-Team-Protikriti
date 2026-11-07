/** Rank the candidate Exploration Zones with weights the user sets. */
import { ZONE_PURPOSES, type ZonePurpose, applyPurpose } from '../core/objective'
import { headline, seeMore } from './insight'
import {
  LATITUDE_LIMIT_DEG,
  type Ranked,
  type Weights,
  type ZoneRow,
  iceVersusLatitude,
} from '../core/zone-rank'

const CRITERIA: Array<{ key: keyof Weights; label: string; hue: string }> = [
  { key: 'ice', label: 'Shallow ice', hue: '#3f7fd0' },
  { key: 'lowElevation', label: 'Low elevation', hue: '#c96a2b' },
  { key: 'nearEquator', label: 'Near the equator', hue: '#2e8f63' },
]
/** Zones shown before "Show all": the leaders are the finding, the tail is reference. */
const TOP_N = 8
const SVG_NS = 'http://www.w3.org/2000/svg'

const fmtLat = (lat: number) => `${Math.abs(lat).toFixed(1)}°${lat < 0 ? 'S' : 'N'}`
const fmtIce = (v: number | null) => (v === null ? '—' : v.toFixed(2))
const fmtElev = (v: number | null) =>
  v === null ? '—' : `${Math.round(v).toLocaleString('en-US')} m`.replace('-', '−')

/** Longitude to the map's x (0..360, 180°W at the left), whether the source is ±180 or 0..360. */
const mapX = (lon: number) => (((lon + 180) % 360) + 360) % 360

/** Where the zones are on Mars: the latitude limit shaded, the ranked zones sized by score. */
function zoneMap(
  ranked: Ranked[],
  excluded: ZoneRow[],
  onPick: (z: ZoneRow) => void,
): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', '-8 20 376 140') // ±70°: every zone sits well inside it
  svg.setAttribute('class', 'zone-map')
  svg.setAttribute('role', 'img')
  svg.setAttribute(
    'aria-label',
    `Map of Mars with ${ranked.length} ranked zones; the top zone is ${ranked[0]?.name ?? 'none'}. Shaded bands are beyond ±${LATITUDE_LIMIT_DEG}° latitude.`,
  )
  const band = 90 - LATITUDE_LIMIT_DEG
  svg.innerHTML =
    `<rect x="-8" width="376" height="180" class="zm-sea"/>` +
    `<rect x="-8" width="376" height="${band}" class="zm-out"/><rect x="-8" y="${180 - band}" width="376" height="${band}" class="zm-out"/>` +
    `<line x1="-8" x2="368" y1="90" y2="90" class="zm-eq"/>` +
    `<text x="4" y="${band - 3}" class="zm-tick">${LATITUDE_LIMIT_DEG}°N</text>` +
    `<text x="4" y="${180 - band + 10}" class="zm-tick">${LATITUDE_LIMIT_DEG}°S</text>` +
    `<text x="4" y="87" class="zm-tick">equator</text>`
  for (const z of excluded) {
    const c = document.createElementNS(SVG_NS, 'circle')
    c.setAttribute('cx', mapX(z.lon).toFixed(1))
    c.setAttribute('cy', (90 - z.lat).toFixed(1))
    c.setAttribute('r', '2.5')
    c.setAttribute('class', 'zm-excluded')
    svg.append(c)
  }
  // Draw the leaders last so they sit on top.
  ;[...ranked].reverse().forEach((z) => {
    const rank = ranked.indexOf(z) + 1
    const g = document.createElementNS(SVG_NS, 'g')
    g.setAttribute('class', rank <= 3 ? 'zm-zone zm-top' : 'zm-zone')
    g.setAttribute('tabindex', '0')
    g.setAttribute('role', 'button')
    g.setAttribute(
      'aria-label',
      `${rank}. ${z.name}, score ${Math.round(z.score * 100)}: show on the map`,
    )
    const x = mapX(z.lon)
    const y = 90 - z.lat
    g.innerHTML =
      `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(2.5 + z.score * 5).toFixed(1)}"/>` +
      (rank <= 3
        ? `<text x="${x.toFixed(1)}" y="${(y + 2.6).toFixed(1)}" class="zm-rank">${rank}</text>`
        : '')
    const title = document.createElementNS(SVG_NS, 'title')
    title.textContent = `${rank}. ${z.name} · ${Math.round(z.score * 100)}`
    g.append(title)
    g.addEventListener('click', () => onPick(z))
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onPick(z)
      }
    })
    svg.append(g)
  })
  return svg
}

/** One ranked zone: its place, name, and a bar split by what each criterion gave it. */
function rankRow(z: Ranked, rank: number, onPick: (z: ZoneRow) => void): HTMLLIElement {
  const li = document.createElement('li')
  li.className = rank === 1 ? 'zr-row is-first' : 'zr-row'
  const num = document.createElement('span')
  num.className = 'zr-rank'
  num.textContent = String(rank)
  const name = document.createElement('button')
  name.type = 'button'
  name.className = 'zone-name'
  name.textContent = z.name
  name.title = `Fly to ${z.name}`
  name.addEventListener('click', () => onPick(z))
  const track = document.createElement('span')
  track.className = 'zr-track'
  track.setAttribute('aria-hidden', 'true')
  for (const c of CRITERIA) {
    const part = document.createElement('i')
    part.style.width = `${(z.parts[c.key] * 100).toFixed(1)}%`
    part.style.background = c.hue
    part.title = `${c.label}: +${Math.round(z.parts[c.key] * 100)}`
    track.append(part)
  }
  const score = document.createElement('b')
  score.className = 'zr-score'
  score.textContent = String(Math.round(z.score * 100))
  score.setAttribute('aria-label', `score ${Math.round(z.score * 100)} of 100`)
  li.append(num, name, track, score)
  if (z.beyondLatitudeLimit || z.missing.length) {
    const flag = document.createElement('small')
    flag.className = 'zr-flag'
    flag.textContent = [
      z.beyondLatitudeLimit ? `beyond ±${LATITUDE_LIMIT_DEG}°` : '',
      z.missing.length ? `no ${z.missing.join(' or ')} data` : '',
    ]
      .filter(Boolean)
      .join(' · ')
    li.append(flag)
  }
  return li
}

export function renderZonePanel(
  parent: HTMLElement,
  loadRows: () => Promise<ZoneRow[]>,
  onPick: (zone: ZoneRow) => void,
): void {
  const panel = document.createElement('details')
  panel.className = 'panel zones'
  const summary = document.createElement('summary')
  summary.textContent = 'Rank the Exploration Zones'
  panel.append(summary)
  const body = document.createElement('div')
  body.className = 'insight'
  panel.append(body)
  parent.append(panel)

  let purpose: ZonePurpose = 'explore'
  const weights: Weights = { ...ZONE_PURPOSES.explore.weights }
  let rows: ZoneRow[] | null = null
  let showAll = false
  const lead = headline('Reading the zone data…')
  const purposeNote = document.createElement('p')
  purposeNote.className = 'zone-note'
  const figure = document.createElement('div')
  figure.className = 'zone-figure'
  const legend = document.createElement('p')
  legend.className = 'zr-legend'
  legend.innerHTML = CRITERIA.map(
    (c) => `<span><i style="background:${c.hue}"></i>${c.label}</span>`,
  ).join('')
  const list = document.createElement('ol')
  list.className = 'zr-list'
  list.setAttribute('aria-label', 'Zones, best first')
  const more = document.createElement('button')
  more.type = 'button'
  more.className = 'quiet zr-more'
  more.addEventListener('click', () => {
    showAll = !showAll
    draw()
  })
  const excludedNote = document.createElement('p')
  excludedNote.className = 'zone-note'
  const table = document.createElement('table')
  table.className = 'zone-table'
  const note = document.createElement('p')
  note.className = 'zone-note'

  const draw = () => {
    if (!rows) return
    const { ranked, excluded } = applyPurpose(rows, purpose, weights)
    const first = ranked[0]
    lead.textContent = first
      ? `Best for ${ZONE_PURPOSES[purpose].label}: ${first.name}, ${Math.round(first.score * 100)} of 100.`
      : 'Every zone is ruled out for this purpose.'
    purposeNote.textContent = ZONE_PURPOSES[purpose].why
    figure.replaceChildren(
      zoneMap(
        ranked,
        excluded.map((e) => e.zone),
        onPick,
      ),
    )
    list.replaceChildren(
      ...(showAll ? ranked : ranked.slice(0, TOP_N)).map((z, i) => rankRow(z, i + 1, onPick)),
    )
    more.hidden = ranked.length <= TOP_N
    more.textContent = showAll ? 'Show the top ' + TOP_N : `Show all ${ranked.length} zones`
    excludedNote.textContent = excluded.length
      ? `Ruled out (${excluded.length}): ` +
        excluded.map((e) => `${e.zone.name} (${e.reason})`).join('; ') +
        '.'
      : ''
    table.innerHTML =
      '<thead><tr><th scope="col">Zone</th><th scope="col">Score</th><th scope="col">Lat</th><th scope="col">Ice</th><th scope="col">Elev</th></tr></thead>'
    const tbody = document.createElement('tbody')
    for (const z of ranked) {
      const tr = document.createElement('tr')
      for (const text of [
        z.name,
        `${Math.round(z.score * 100)}`,
        fmtLat(z.lat) + (z.beyondLatitudeLimit ? ` (beyond ±${LATITUDE_LIMIT_DEG}°)` : ''),
        fmtIce(z.ice),
        fmtElev(z.elevationM),
      ]) {
        const td = document.createElement('td')
        td.textContent = text
        tr.append(td)
      }
      tbody.append(tr)
    }
    table.append(tbody)
    const conflict = iceVersusLatitude(rows)
    const ice = conflict
      ? `The most ice-consistent zone, ${conflict.zone}, is at ${fmtLat(conflict.lat)}${
          conflict.beyondLimit
            ? `, beyond the ±${LATITUDE_LIMIT_DEG}° latitude limit: ice and the latitude rule pull in different directions.`
            : `, within the ±${LATITUDE_LIMIT_DEG}° latitude limit.`
        } `
      : ''
    note.textContent =
      ice +
      'Values are read at each zone centre. Ice: SWIM 2.0 consistency (about 15 km resolution, ' +
      'against zones about 200 km across). Elevation: MGS MOLA. The latitude limit is summarised ' +
      'from the 2015 workshop criteria and still to be checked against LPI Contribution 1879. ' +
      'A zone with no data for a measure scores 0 on it. Each bar is split by what each measure ' +
      'added: a measure scores its weight times how close the zone is to the best zone on it.'
  }

  const purposes = document.createElement('div')
  purposes.className = 'dust-sites'
  purposes.setAttribute('role', 'radiogroup')
  purposes.setAttribute('aria-label', 'Mission purpose')
  const controls = document.createElement('div')
  controls.className = 'zone-weights'
  const sliders: Array<{ key: keyof Weights; input: HTMLInputElement; out: HTMLOutputElement }> = []
  for (const [id, spec] of Object.entries(ZONE_PURPOSES) as Array<
    [ZonePurpose, (typeof ZONE_PURPOSES)[ZonePurpose]]
  >) {
    const b = document.createElement('button')
    b.type = 'button'
    b.setAttribute('role', 'radio')
    b.setAttribute('aria-checked', String(id === purpose))
    b.textContent = spec.label
    b.addEventListener('click', () => {
      purpose = id
      Object.assign(weights, spec.weights)
      for (const s of sliders) {
        s.input.value = String(weights[s.key])
        s.out.textContent = s.input.value
      }
      for (const other of purposes.children) other.setAttribute('aria-checked', String(other === b))
      draw()
    })
    purposes.append(b)
  }
  for (const { key, label, hue } of CRITERIA) {
    const wrap = document.createElement('label')
    const text = document.createElement('span')
    const out = document.createElement('output')
    const input = document.createElement('input')
    input.type = 'range'
    input.min = '0'
    input.max = '5'
    input.step = '1'
    input.value = String(weights[key])
    input.style.accentColor = hue
    text.textContent = label
    out.textContent = input.value
    input.addEventListener('input', () => {
      weights[key] = Number(input.value)
      out.textContent = input.value
      draw()
    })
    wrap.append(text, input, out)
    controls.append(wrap)
    sliders.push({ key, input, out })
  }
  const tune = document.createElement('details')
  tune.className = 'see-more zone-tune'
  const tuneHead = document.createElement('summary')
  tuneHead.textContent = 'Tune the weights'
  tune.append(tuneHead, purposeNote, controls)
  const scroller = document.createElement('div')
  scroller.className = 'zone-scroll'
  scroller.append(table)
  body.append(
    purposes,
    lead,
    figure,
    legend,
    list,
    more,
    tune,
    seeMore(excludedNote, scroller, note),
  )

  panel.addEventListener('toggle', () => {
    if (!panel.open || rows) return
    loadRows()
      .then((loaded) => {
        rows = loaded
        draw()
      })
      .catch((error: unknown) => {
        lead.textContent = `Could not rank the zones: ${String(error)}`
      })
  })
}
