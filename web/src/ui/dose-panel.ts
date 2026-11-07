/** "Radiation, compared": published dose rates side by side, and days to NASA's career limit. */
import { CAREER_LIMIT_MSV, DOSE_RATES, daysToLimit } from '../core/dose'
import { bars, headline, seeMore, stats } from './insight'

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
  const known = DOSE_RATES.filter((r) => r.msvPerDay !== null)
  const top = Math.max(...known.map((r) => r.msvPerDay ?? 0))
  const surface = DOSE_RATES.find((r) => r.where.startsWith('Mars surface'))
  const transit = DOSE_RATES.find((r) => r.where.startsWith('In transit'))
  const surfaceDays = daysToLimit(surface?.msvPerDay ?? null)
  const transitDays = daysToLimit(transit?.msvPerDay ?? null)
  const view = document.createElement('div')
  view.className = 'insight'
  view.append(
    headline(
      surfaceDays
        ? `On the surface, a crew uses up a whole career's radiation in about ${(surfaceDays / 365.25).toFixed(1)} years.`
        : 'Radiation on Mars, against a whole career limit.',
    ),
    stats([
      {
        value: surfaceDays ? Math.round(surfaceDays).toLocaleString('en-US') : '—',
        label: 'days on the surface',
        tone: 'warn',
      },
      {
        value: transitDays ? Math.round(transitDays).toLocaleString('en-US') : '—',
        label: 'days in transit',
        tone: 'bad',
      },
      { value: `${CAREER_LIMIT_MSV} mSv`, label: 'NASA career limit' },
    ]),
    bars(
      DOSE_RATES.map((r) => ({
        label: r.where.split(',')[0] ?? r.where,
        detail: r.where.split(',').slice(1).join(',').trim() || undefined,
        share: r.msvPerDay === null ? 0 : r.msvPerDay / top,
        text:
          r.msvPerDay === null
            ? 'not measured'
            : `${r.msvPerDay < 0.1 ? r.msvPerDay.toFixed(3) : r.msvPerDay.toFixed(2)} mSv/day`,
        tone:
          r.msvPerDay === null
            ? undefined
            : r.msvPerDay / top > 0.5
              ? 'bad'
              : r.msvPerDay / top > 0.1
                ? 'warn'
                : 'good',
      })),
      'Dose per day, by place',
    ),
    seeMore(scroll, note),
  )
  panel.append(summary, view)
  parent.append(panel)
}
