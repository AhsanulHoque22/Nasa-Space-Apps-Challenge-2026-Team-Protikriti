/**
 * Mission over: a store ran out. Says what, on which sol, and why, lists the mission report's
 * lessons mission by mission, and starts Expedition 1 again from mission 1.1. Also opens an old
 * report to read, from the Story screen or a mission's lessons button.
 */
import type { MissionReport } from '../core/mission-reports'
import { MISSIONS } from '../core/missions'
import { el } from './dom'

const missionName = (id: string) => {
  const m = MISSIONS.find((x) => x.id === id)
  return m ? `${m.id} ${m.title}` : id
}

/** The report's lessons grouped by mission, in mission order. */
export function reportBody(r: MissionReport): HTMLElement {
  const ids = [...new Set(r.lessons.map((l) => l.missionId))].sort((a, b) =>
    a.localeCompare(b, 'en', { numeric: true }),
  )
  const sum = r.summary
  const t = (kg: number) => `${(kg / 1000).toFixed(1)} t`
  return el(
    'div',
    { className: 'report-body' },
    sum
      ? el('p', {
          className: 'item-meta',
          textContent: `Lander A ${t(sum.landerAKg)} · Lander B ${t(sum.landerBKg)} · ${sum.solsEarned.toFixed(1)} sols of food grown before the end`,
        })
      : '',
    ...ids.map((id) =>
      el(
        'section',
        { className: 'report-mission' },
        el('h3', { className: 'feature-heading', textContent: missionName(id) }),
        el(
          'ul',
          { className: 'report-lessons' },
          ...r.lessons
            .filter((l) => l.missionId === id)
            .map((l) =>
              el(
                'li',
                { className: l.fatal ? 'report-lesson ended' : 'report-lesson' },
                l.fatal
                  ? el('strong', { className: 'report-tag', textContent: 'Ended the run' })
                  : '',
                el('p', { textContent: `Mistake: ${l.mistake}` }),
                el('p', { textContent: `Next time: ${l.measure}` }),
                l.numbers ? el('p', { className: 'item-meta', textContent: l.numbers }) : '',
              ),
            ),
        ),
      ),
    ),
    r.lessons.length
      ? ''
      : el('p', {
          textContent: 'No single choice explains this run. Read the stores bar early next time.',
        }),
  )
}

function overlay(title: string, ...children: (Node | string)[]): HTMLElement {
  const box = el(
    'div',
    { className: 'mission-over', role: 'dialog', ariaModal: 'true', ariaLabel: title },
    el('div', { className: 'mission-over-panel' }, ...children),
  )
  document.body.append(box)
  box.querySelector<HTMLElement>('h2')?.focus()
  return box
}

export function showMissionOver(r: MissionReport, onRestart: () => void): void {
  const restart = el('button', {
    type: 'button',
    className: 'gate-primary',
    textContent: 'Start Expedition 1 again',
  })
  const box = overlay(
    'Mission over',
    el('p', { className: 'dock-mission', textContent: `Mission report v${r.version}` }),
    el('h2', { className: 'gate-heading', textContent: 'Mission over', tabIndex: -1 }),
    el('p', {
      className: 'mission-over-cause',
      textContent: `${r.cause} (mission ${missionName(r.missionId)}, sol ${r.endedSol})`,
    }),
    el('p', {
      textContent:
        'The crew cannot wait for the next ship. Expedition 1 starts again from mission 1.1. This report stays with your crew: each mission shows its lessons, and warns you if you make the same choice again.',
    }),
    reportBody(r),
    el('div', { className: 'gate-actions' }, restart),
  )
  restart.addEventListener('click', () => {
    box.remove()
    onRestart()
  })
}

/** An old report to read; closes back to where it was opened. */
export function showReport(r: MissionReport): void {
  const close = el('button', { type: 'button', className: 'gate-primary', textContent: 'Close' })
  const box = overlay(
    `Mission report v${r.version}`,
    el('h2', {
      className: 'gate-heading',
      textContent: `Mission report v${r.version}`,
      tabIndex: -1,
    }),
    el('p', {
      className: 'mission-over-cause',
      textContent: `${r.cause} (mission ${missionName(r.missionId)}, sol ${r.endedSol})`,
    }),
    reportBody(r),
    el('div', { className: 'gate-actions' }, close),
  )
  const shut = () => {
    box.remove()
    document.removeEventListener('keydown', onKey)
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') shut()
  }
  close.addEventListener('click', shut)
  document.addEventListener('keydown', onKey)
}
