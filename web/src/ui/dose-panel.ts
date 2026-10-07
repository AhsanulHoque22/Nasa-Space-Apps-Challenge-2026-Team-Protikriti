/** "Radiation, compared": published dose rates side by side, and days to NASA's career limit. */
import { CAREER_LIMIT_MSV, DOSE_RATES, daysToLimit } from '../core/dose'

const rate = (msv: number | null, pm: number | null) =>
  msv === null
    ? 'Unknown'
    : msv < 0.1
      ? `${(msv * 365.25).toFixed(1)} mSv a year`
      : `${msv.toFixed(2)}${pm ? ` ± ${pm.toFixed(2)}` : ''} mSv a day`

export function renderDosePanel(parent: HTMLElement): void {
  const panel = document.createElement('details')
  panel.className = 'panel dose'
  const summary = document.createElement('summary')
  summary.textContent = 'Radiation, compared'
  const table = document.createElement('table')
  table.className = 'zone-table'
  const caption = document.createElement('caption')
  caption.textContent = `Effective dose, and days to reach NASA's ${CAREER_LIMIT_MSV} mSv career limit`
  table.append(caption)
  const head = table.createTHead().insertRow()
  for (const text of ['Where', 'Dose', `Days to ${CAREER_LIMIT_MSV} mSv`]) {
    const th = document.createElement('th')
    th.scope = 'col'
    th.textContent = text
    head.append(th)
  }
  const body = table.createTBody()
  for (const r of DOSE_RATES) {
    const row = body.insertRow()
    const where = document.createElement('th')
    where.scope = 'row'
    where.textContent = r.where
    const small = document.createElement('small')
    small.className = 'dose-source'
    small.textContent = r.source
    where.append(small)
    row.append(where)
    row.insertCell().textContent = rate(r.msvPerDay, r.plusMinus)
    const days = daysToLimit(r.msvPerDay)
    row.insertCell().textContent =
      days === null
        ? '—'
        : days > 36_500
          ? 'over a century'
          : Math.round(days).toLocaleString('en-US')
  }
  const note = document.createElement('p')
  note.className = 'zone-note'
  note.textContent =
    `NASA's limit is ${CAREER_LIMIT_MSV} mSv over a whole career (NASA-STD-3001, 2022). A crew on the ` +
    'surface would reach it in about two and a half years; the trip itself uses it up three times as fast. ' +
    'Rates vary with the solar cycle and altitude. No cave dose is given because none has been measured.'
  const scroll = document.createElement('div')
  scroll.className = 'zone-scroll'
  scroll.append(table)
  panel.append(summary, scroll, note)
  parent.append(panel)
}
