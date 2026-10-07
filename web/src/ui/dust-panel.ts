/** Dust season: typical column dust by season at each site, and the year-by-year record. */
import { type DustDoc, dustNow, dustiestYear, parseDust } from '../core/dust'
import { ORANGE_RAMP, rampColor } from '../core/ramp'

/** Colour scale top: most seasons sit below it; storm values beyond it show at full colour. */
const SCALE_MAX = 0.6

type SiteChoice = { id: string; name: string }

const LEVEL_TEXT = {
  low: 'low for this site',
  moderate: 'middling for this site',
  high: 'high for this site',
} as const

export function renderDustPanel(
  parent: HTMLElement,
  sites: readonly SiteChoice[],
  lsNow: () => number,
): void {
  const panel = document.createElement('details')
  panel.className = 'panel dust'
  const summary = document.createElement('summary')
  summary.textContent = 'Dust season (13 Mars years)'
  const body = document.createElement('div')
  panel.append(summary, body)
  parent.append(panel)

  let doc: DustDoc | null = null
  let siteId = sites[0]?.id ?? ''

  const draw = () => {
    if (!doc) return
    const site = doc.sites[siteId]
    body.replaceChildren()
    const picker = document.createElement('div')
    picker.className = 'dust-sites'
    picker.setAttribute('role', 'radiogroup')
    picker.setAttribute('aria-label', 'Site')
    for (const s of sites.filter((x) => doc?.sites[x.id])) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'quiet'
      b.setAttribute('role', 'radio')
      b.setAttribute('aria-checked', String(s.id === siteId))
      b.textContent = s.name.split(' ')[0] ?? s.name
      b.addEventListener('click', () => {
        siteId = s.id
        draw()
      })
      picker.append(b)
    }
    body.append(picker)
    if (!site) return

    const ls = lsNow()
    const now = dustNow(site, ls, doc.binDeg)
    const nowText = document.createElement('p')
    nowText.className = 'dust-now'
    nowText.textContent =
      `Now (Ls ${Math.round(ls)}°): typical dust ${now.median.toFixed(2)} ` +
      `(about ${(now.median * doc.visibleFactor).toFixed(1)} in visible light), ${LEVEL_TEXT[now.level]}. ` +
      `The dustiest of ${now.years} years reached ${now.max.toFixed(2)} at this season.`
    body.append(nowText)

    const table = document.createElement('table')
    table.className = 'dust-calendar'
    const caption = document.createElement('caption')
    caption.textContent =
      'Column dust by Mars year (rows) and season (Ls, columns); darker is clearer air'
    table.append(caption)
    const binDeg = doc.binDeg
    const bins = 360 / binDeg
    const head = table.createTHead().insertRow()
    head.append(document.createElement('th'))
    for (const q of [0, 90, 180, 270]) {
      const th = document.createElement('th')
      th.scope = 'colgroup'
      th.colSpan = bins / 4
      th.textContent = `Ls ${q}°`
      head.append(th)
    }
    const nowBin = Math.min(bins - 1, Math.floor((((ls % 360) + 360) % 360) / doc.binDeg))
    const tbody = table.createTBody()
    for (const [year, values] of Object.entries(site.years).sort(
      (a, b) => Number(a[0]) - Number(b[0]),
    )) {
      const row = tbody.insertRow()
      const th = document.createElement('th')
      th.scope = 'row'
      th.textContent = `MY ${year}`
      row.append(th)
      values.forEach((v, b) => {
        const td = row.insertCell()
        const label = `Mars year ${year}, Ls ${b * binDeg}–${(b + 1) * binDeg}°: ${
          v === null ? 'no data' : v.toFixed(2)
        }`
        td.title = label
        td.setAttribute('aria-label', label)
        if (v !== null)
          td.style.background = `rgb(${rampColor(v / SCALE_MAX, ORANGE_RAMP).join(' ')})`
        if (b === nowBin) td.classList.add('now')
      })
    }
    const scroller = document.createElement('div')
    scroller.className = 'dust-scroll'
    scroller.append(table)
    body.append(scroller)

    const legend = document.createElement('div')
    legend.className = 'ramp-legend'
    const lo = document.createElement('span')
    lo.textContent = '0'
    const bar = document.createElement('i')
    bar.setAttribute('aria-hidden', 'true')
    bar.style.background = `linear-gradient(to right, ${ORANGE_RAMP.join(', ')})`
    const hi = document.createElement('span')
    hi.textContent = `${SCALE_MAX}+ dust optical depth`
    legend.append(lo, bar, hi)
    body.append(legend)

    const peak = dustiestYear(site, doc.binDeg)
    const notes = document.createElement('p')
    notes.className = 'dust-note'
    notes.textContent =
      `Highest in the record here: Mars year ${peak.year}, Ls ${peak.lsStart}–${peak.lsStart + doc.binDeg}°, ` +
      `at ${peak.value.toFixed(2)}${
        peak.year === 34
          ? ': the planet-encircling dust storm of mid-2018 that ended the Opportunity mission.'
          : '.'
      } The column marked "now" is this season. This is climatology from orbital data: it says what is ` +
      'typical, and cannot forecast any day or storm. Dust devils, wind and temperature are not included; ' +
      'the app has no hourly or wind record for these sites.'
    const source = document.createElement('p')
    source.className = 'dust-note'
    source.textContent = `${doc.quantity}, for the 3° cell around the site. Data: ${doc.source}. Licence: ${doc.license}.`
    body.append(notes, source)
  }

  panel.addEventListener('toggle', () => {
    if (!panel.open || doc) return
    body.textContent = 'Loading the dust record…'
    fetch('data/dust.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status} (run make data)`)
        return r.json()
      })
      .then((raw: unknown) => {
        doc = parseDust(raw)
        draw()
      })
      .catch((error: unknown) => {
        body.textContent = `Dust record not available: ${String(error)}`
      })
  })
}
