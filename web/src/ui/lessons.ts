/**
 * The last mission reports inside a mission: a closed button with this mission's lessons, and an
 * amber warning beside a control when the choice repeats a reported mistake. Warnings never block.
 */
import { type MissionReport, activeWarnings } from '../core/mission-reports'
import type { GuardValues } from '../core/run-report'
import { el } from './dom'

/** "Lessons from Mission report v2 (3)", closed; null when no report has lessons for this mission. */
export function lessonsButton(
  reports: readonly MissionReport[],
  missionId: string,
): HTMLElement | null {
  const r = [...reports].reverse().find((x) => x.lessons.some((l) => l.missionId === missionId))
  if (!r) return null
  const mine = r.lessons.filter((l) => l.missionId === missionId)
  return el(
    'details',
    { className: 'lessons' },
    el('summary', { textContent: `Lessons from Mission report v${r.version} (${mine.length})` }),
    el(
      'ul',
      {},
      ...mine.map((l) =>
        el(
          'li',
          {},
          el('p', { textContent: l.mistake }),
          el('p', { textContent: `Next time: ${l.measure}` }),
        ),
      ),
    ),
  )
}

/** Amber notes for every choice on screen that repeats a reported mistake. */
export function warningsFor(
  reports: readonly MissionReport[],
  missionId: string,
  values: GuardValues,
): HTMLElement {
  const hits = activeWarnings(reports, missionId, values)
  return el(
    'div',
    { className: 'report-warnings', role: 'status' },
    ...hits.map(({ version, lesson }) =>
      el(
        'p',
        { className: 'report-warning' },
        el('strong', { textContent: `Mission report v${version}: ` }),
        `last time, ${lesson.mistake.charAt(0).toLowerCase()}${lesson.mistake.slice(1)} ${lesson.measure}`,
      ),
    ),
  )
}
