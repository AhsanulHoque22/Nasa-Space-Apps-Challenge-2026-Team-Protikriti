/** Geology lens (Jezero map units, as a geologist reads them) and why Mars gravity changes slopes. */
import { MARS_G } from '../core/explore'
import { GEOLOGY_UNITS, SIM_3464 } from '../core/geology-units'
import { EARTH_G, factorOfSafety } from '../core/gravity'

// Illustrative soil for the worked example (team choice, not a measurement of any Mars site).
const EXAMPLE = { cohesionPa: 500, frictionDeg: 30, densityKgM3: 1500, depthM: 1 }

export function renderGeologyPanel(
  parent: HTMLElement,
  showOnMap: (lon: number, lat: number) => void,
): void {
  const panel = document.createElement('details')
  panel.className = 'panel dust geology'
  const summary = document.createElement('summary')
  summary.textContent = 'Geology lens and Mars gravity'
  panel.append(summary)
  parent.append(panel)

  const lensTitle = document.createElement('h3')
  lensTitle.className = 'sync-heading'
  lensTitle.textContent = 'Jezero rock units, read like a geologist'
  const list = document.createElement('ul')
  list.className = 'geology-units'
  for (const u of GEOLOGY_UNITS) {
    const li = document.createElement('li')
    const head = document.createElement('p')
    head.className = 'dust-now'
    const code = document.createElement('strong')
    code.textContent = u.code
    head.append(code, ` · ${u.name}`)
    const map = document.createElement('p')
    map.className = 'dust-note'
    map.textContent = `USGS map: ${u.mapText}`
    const reading = document.createElement('p')
    reading.className = 'dust-note'
    reading.textContent = `Reading: ${u.reading}`
    const go = document.createElement('button')
    go.type = 'button'
    go.className = 'quiet'
    go.textContent = `Show ${u.code} on the map`
    go.addEventListener('click', () => showOnMap(u.lon, u.lat))
    li.append(head, map, reading, go)
    list.append(li)
  }
  const cite = document.createElement('p')
  cite.className = 'dust-note'
  const link = document.createElement('a')
  link.href = SIM_3464.url
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  link.textContent = `doi:${SIM_3464.doi}`
  cite.append(`Unit text condensed from ${SIM_3464.citation}, `, link, '. Public domain.')

  const gTitle = document.createElement('h3')
  gTitle.className = 'sync-heading'
  gTitle.textContent = 'Mars gravity and slope stability'
  const formula = document.createElement('p')
  formula.className = 'dust-note gravity-formula'
  formula.textContent =
    'Factor of safety, infinite slope, dry ground: FS = c / (ρ g z sin β cos β) + tan φ / tan β'
  const control = document.createElement('label')
  control.className = 'zone-weights geology-slope'
  const label = document.createElement('span')
  label.textContent = 'Slope β'
  const input = document.createElement('input')
  input.type = 'range'
  input.min = '5'
  input.max = '45'
  input.step = '1'
  input.value = '35'
  const out = document.createElement('output')
  control.append(label, input, out)
  const table = document.createElement('table')
  table.className = 'zone-table'
  const explain = document.createElement('p')
  explain.className = 'dust-note'
  explain.textContent =
    `Gravity only divides the cohesion term. Friction alone holds the same slope on Mars as on Earth, ` +
    `but the same cohesion holds ${(EARTH_G / MARS_G).toFixed(2)} times more on Mars, so slightly sticky ` +
    `soil can stand steeper there. Example soil (illustrative, team choice): c = ${EXAMPLE.cohesionPa} Pa, ` +
    `φ = ${EXAMPLE.frictionDeg}°, ρ = ${EXAMPLE.densityKgM3} kg/m³, z = ${EXAMPLE.depthM} m. ` +
    `g: Mars ${MARS_G} m/s² (IAU/JPL GM and radius), Earth ${EARTH_G} m/s² (standard gravity). ` +
    "The route planner's 15° limit is about people walking in suits, not about slopes failing."

  const draw = () => {
    const slopeDeg = Number(input.value)
    out.textContent = `${slopeDeg}°`
    input.setAttribute('aria-valuetext', `${slopeDeg} degrees`)
    table.replaceChildren()
    const head = table.createTHead().insertRow()
    for (const t of ['', 'Cohesion part', 'Friction part', 'FS', 'Holds?']) {
      const th = document.createElement('th')
      th.scope = 'col'
      th.textContent = t
      head.append(th)
    }
    const body = table.createTBody()
    for (const [name, g] of [
      ['Mars', MARS_G],
      ['Earth', EARTH_G],
    ] as const) {
      const fs = factorOfSafety({ ...EXAMPLE, slopeDeg, g })
      const row = body.insertRow()
      const th = document.createElement('th')
      th.scope = 'row'
      th.textContent = name
      row.append(th)
      for (const text of [
        fs.cohesion.toFixed(2),
        fs.friction.toFixed(2),
        fs.total.toFixed(2),
        fs.total >= 1 ? 'Holds (FS ≥ 1)' : 'Slides (FS < 1)',
      ])
        row.insertCell().textContent = text
    }
  }
  input.addEventListener('input', draw)
  draw()
  panel.append(lensTitle, list, cite, gTitle, formula, control, table, explain)
}
