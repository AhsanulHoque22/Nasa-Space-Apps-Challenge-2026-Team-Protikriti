/** Rank the candidate Exploration Zones with weights the user sets. */
import { ZONE_PURPOSES, type ZonePurpose, applyPurpose } from '../core/objective'
import {
  LATITUDE_LIMIT_DEG,
  type Weights,
  type ZoneRow,
  iceVersusLatitude,
} from '../core/zone-rank'

const CRITERIA: Array<{ key: keyof Weights; label: string }> = [
  { key: 'ice', label: 'Shallow ice' },
  { key: 'lowElevation', label: 'Low elevation' },
  { key: 'nearEquator', label: 'Near the equator' },
]

const fmtLat = (lat: number) => `${Math.abs(lat).toFixed(1)}°${lat < 0 ? 'S' : 'N'}`
const fmtIce = (v: number | null) => (v === null ? '—' : v.toFixed(2))
const fmtElev = (v: number | null) =>
  v === null ? '—' : `${Math.round(v).toLocaleString('en-US')} m`.replace('-', '−')

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
  panel.append(body)
  parent.append(panel)

  let purpose: ZonePurpose = 'explore'
  const weights: Weights = { ...ZONE_PURPOSES.explore.weights }
  let rows: ZoneRow[] | null = null
  const purposeNote = document.createElement('p')
  purposeNote.className = 'zone-note'
  const excludedNote = document.createElement('p')
  excludedNote.className = 'zone-note'
  const table = document.createElement('table')
  table.className = 'zone-table'
  const note = document.createElement('p')
  note.className = 'zone-note'

  const draw = () => {
    if (!rows) return
    const { ranked, excluded } = applyPurpose(rows, purpose, weights)
    purposeNote.textContent = `${ZONE_PURPOSES[purpose].label}: ${ZONE_PURPOSES[purpose].why}`
    excludedNote.textContent = excluded.length
      ? `Ruled out (${excluded.length}): ` +
        excluded.map((e) => `${e.zone.name} (${e.reason})`).join('; ') +
        '.'
      : ''
    const head =
      '<thead><tr><th scope="col">Zone</th><th scope="col">Score</th><th scope="col">Lat</th><th scope="col">Ice</th><th scope="col">Elev</th></tr></thead>'
    table.innerHTML = head
    const tbody = document.createElement('tbody')
    for (const z of ranked) {
      const tr = document.createElement('tr')
      const name = document.createElement('th')
      name.scope = 'row'
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'zone-name'
      button.textContent = z.name
      button.addEventListener('click', () => onPick(z))
      name.append(button)
      const cells = [
        `${Math.round(z.score * 100)}`,
        fmtLat(z.lat) + (z.beyondLatitudeLimit ? ` (beyond ±${LATITUDE_LIMIT_DEG}°)` : ''),
        fmtIce(z.ice),
        fmtElev(z.elevationM),
      ]
      tr.append(name)
      for (const text of cells) {
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
      'A zone with no data for a measure scores 0 on it.'
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
  for (const { key, label } of CRITERIA) {
    const wrap = document.createElement('label')
    const text = document.createElement('span')
    const out = document.createElement('output')
    const input = document.createElement('input')
    input.type = 'range'
    input.min = '0'
    input.max = '5'
    input.step = '1'
    input.value = String(weights[key])
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
  const scroller = document.createElement('div')
  scroller.className = 'zone-scroll'
  scroller.append(table)
  body.append(purposes, purposeNote, controls, scroller, excludedNote, note)

  panel.addEventListener('toggle', () => {
    if (!panel.open || rows) return
    note.textContent = 'Reading the zone data…'
    loadRows()
      .then((loaded) => {
        rows = loaded
        draw()
      })
      .catch((error: unknown) => {
        note.textContent = `Could not rank the zones: ${String(error)}`
      })
  })
}
