/**
 * The mission archive: every report this crew has filed, over the sky-crane art, in the Story
 * mode's look. Filter by mission, outcome and date; open any report in full.
 */
import { type MissionReport, type ReportFilter, filterReports } from '../core/mission-reports'
import type { Mission } from '../core/missions'
import { el } from './dom'

const ARCHIVE_ART = 'assets/mission-archive.webp'

const when = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Date not recorded'

function stat(value: string, label: string, tone?: string): HTMLElement {
  const div = el('div', { className: 'ma-stat' })
  if (tone) div.dataset.tone = tone
  div.append(el('b', { textContent: value }), el('span', { textContent: label }))
  return div
}

function card(r: MissionReport, title: string, open: () => void): HTMLElement {
  const outcome = r.outcome ?? 'failed'
  const b = el('button', { type: 'button', className: 'ma-card' })
  b.dataset.outcome = outcome
  b.setAttribute(
    'aria-label',
    `Report ${r.version}: mission ${r.missionId}, ${title}, ${outcome}. Open it`,
  )
  b.append(
    el('span', { className: 'ma-num', textContent: r.missionId }),
    el('span', {
      className: 'ma-stamp',
      textContent: outcome === 'completed' ? 'Completed' : 'Failed',
    }),
    el('span', { className: 'ma-title', textContent: title }),
    el('span', { className: 'ma-cause', textContent: r.cause }),
    el('span', {
      className: 'ma-meta',
      textContent: `Report ${r.version} · sol ${r.endedSol} · ${when(r.endedAt)}`,
    }),
  )
  b.addEventListener('click', open)
  return b
}

export function openMissionArchive(
  reports: readonly MissionReport[],
  missions: readonly Mission[],
  onOpen: (r: MissionReport) => void,
): void {
  const titleOf = (id: string) => missions.find((m) => m.id === id)?.title ?? `Mission ${id}`
  const dialog = el('dialog', { className: 'mission-archive' }) as HTMLDialogElement
  dialog.setAttribute('aria-labelledby', 'ma-title')
  dialog.style.setProperty('--archive-art', `url("${new URL(ARCHIVE_ART, document.baseURI).href}")`)
  const close = el('button', { type: 'button', className: 'ma-close', textContent: 'Close' })
  close.addEventListener('click', () => dialog.close())

  // Highlights: the whole archive, before any filter.
  const done = reports.filter((r) => r.outcome === 'completed')
  const cleared = new Set(done.map((r) => r.missionId))
  const furthest = [...cleared].sort((a, b) => a.localeCompare(b, 'en', { numeric: true })).at(-1)
  const highlights = el(
    'div',
    { className: 'ma-stats' },
    stat(String(reports.length), 'reports filed'),
    stat(String(done.length), 'runs completed', 'good'),
    stat(String(reports.length - done.length), 'runs failed', 'bad'),
    stat(
      furthest ? `${furthest}` : '—',
      furthest ? `furthest: ${titleOf(furthest)}` : 'no mission cleared',
    ),
  )

  // Filters: mission, outcome, date range.
  const filter: ReportFilter = {}
  const missionSelect = el('select', { className: 'ma-select' }) as HTMLSelectElement
  missionSelect.setAttribute('aria-label', 'Mission')
  missionSelect.append(el('option', { value: '', textContent: 'Every mission' }))
  const ids = [...new Set(reports.map((r) => r.missionId))].sort((a, b) =>
    a.localeCompare(b, 'en', { numeric: true }),
  )
  for (const id of ids)
    missionSelect.append(el('option', { value: id, textContent: `${id} · ${titleOf(id)}` }))
  const outcomes = el('div', { className: 'ma-chips', role: 'radiogroup', ariaLabel: 'Outcome' })
  for (const [value, label] of [
    ['', 'All'],
    ['completed', 'Completed'],
    ['failed', 'Failed'],
  ] as const) {
    const b = el('button', { type: 'button', role: 'radio', textContent: label })
    b.setAttribute('aria-checked', String(value === ''))
    b.addEventListener('click', () => {
      filter.outcome = value || undefined
      for (const o of outcomes.children) o.setAttribute('aria-checked', String(o === b))
      draw()
    })
    outcomes.append(b)
  }
  const dateInput = (label: string, key: 'fromDate' | 'toDate') => {
    const input = el('input', { type: 'date', className: 'ma-date' }) as HTMLInputElement
    input.addEventListener('change', () => {
      filter[key] = input.value || undefined
      draw()
    })
    return {
      input,
      label: el('label', { className: 'ma-field' }, el('span', { textContent: label }), input),
    }
  }
  const from = dateInput('From', 'fromDate')
  const to = dateInput('To', 'toDate')
  const reset = el('button', {
    type: 'button',
    className: 'ma-reset',
    textContent: 'Clear filters',
  })
  reset.addEventListener('click', () => {
    Object.assign(filter, {
      missionId: undefined,
      outcome: undefined,
      fromDate: undefined,
      toDate: undefined,
    })
    missionSelect.value = ''
    from.input.value = ''
    to.input.value = ''
    for (const o of outcomes.children)
      o.setAttribute('aria-checked', String(o === outcomes.firstElementChild))
    draw()
  })
  missionSelect.addEventListener('change', () => {
    filter.missionId = missionSelect.value || undefined
    draw()
  })
  const filters = el(
    'div',
    { className: 'ma-filters' },
    el('label', { className: 'ma-field' }, el('span', { textContent: 'Mission' }), missionSelect),
    from.label,
    to.label,
    outcomes,
    reset,
  )

  const count = el('p', { className: 'ma-count', role: 'status' })
  const grid = el('div', { className: 'ma-grid' })
  const draw = () => {
    const shown = filterReports(reports, filter)
    count.textContent = reports.length
      ? `${shown.length} of ${reports.length} reports`
      : 'No reports yet. Play a mission and its report is filed here.'
    grid.replaceChildren(
      ...shown.map((r) =>
        card(r, titleOf(r.missionId), () => {
          dialog.close()
          onOpen(r)
        }),
      ),
    )
  }

  dialog.append(
    el(
      'div',
      { className: 'ma-inner' },
      el(
        'header',
        { className: 'ma-head' },
        el(
          'div',
          {},
          el('p', { className: 'ma-kicker', textContent: 'ATLAS · crew records' }),
          el('h2', { id: 'ma-title', className: 'ma-heading', textContent: 'Mission archive' }),
        ),
        close,
      ),
      highlights,
      filters,
      count,
      grid,
      el('p', {
        className: 'ma-credit',
        textContent: 'Art: Perseverance sky-crane landing, illustration, NASA/JPL-Caltech',
      }),
    ),
  )
  draw()
  dialog.addEventListener('close', () => dialog.remove())
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close()
  })
  document.body.append(dialog)
  dialog.showModal()
  close.focus()
}
