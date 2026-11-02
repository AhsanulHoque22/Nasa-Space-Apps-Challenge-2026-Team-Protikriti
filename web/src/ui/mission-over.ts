/**
 * Mission over: a store ran out. Says what, on which sol, and why, lists the mission report's
 * lessons mission by mission, and starts Expedition 1 again from mission 1.1. Also opens an old
 * report to read, from the Story screen or a mission's lessons button.
 */
import { type Areas, reactorsNeeded } from '../core/greenhouse'
import { EPITAPH_MAX_CHARS, type MissionReport, saveEpitaph } from '../core/mission-reports'
import { consequenceHeadline } from '../core/power-window'
import type { KeyValueStore } from '../core/streetview'
import { openPowerTool } from './power-tool'
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

export type ConsequenceContext = {
  /** The run's greenhouse and reactors, when the failure can be reopened in the power window. */
  live?: { areas: Areas; kilopower: number } | undefined
  siteName?: string | undefined
  store?: KeyValueStore | undefined
  owner?: string
  restartLabel?: string
}

/** The consequence moment: what failed, by how much, which choice caused it, and the real tool. */
export function showMissionOver(
  r: MissionReport,
  c: ConsequenceContext,
  onRestart: () => void,
): void {
  const restart = el('button', {
    type: 'button',
    className: 'gate-primary',
    textContent: c.restartLabel ?? 'Start again from packing the lander',
  })
  const need = c.live && reactorsNeeded(c.live.areas)
  const chain = c.live
    ? el(
        'div',
        { className: 'cons-chain' },
        el(
          'p',
          {},
          el('span', { textContent: 'You packed' }),
          el('b', { textContent: `${c.live.kilopower} reactors` }),
        ),
        el(
          'p',
          {},
          el('span', { textContent: 'This planting needed' }),
          el('b', {
            textContent:
              need === null || need === undefined ? 'more than can fit' : `${need} reactors`,
          }),
        ),
      )
    : ''
  const epitaph = el('input', {
    id: 'cons-epitaph',
    type: 'text',
    maxLength: EPITAPH_MAX_CHARS,
    placeholder: 'Write something for the crew',
  })
  epitaph.addEventListener('change', () => {
    if (c.store && c.owner) saveEpitaph(c.store, c.owner, r.version, epitaph.value)
  })
  const heading = el('h2', {
    className: 'cons-title',
    textContent: consequenceHeadline(r.missionId),
    tabIndex: -1,
  })
  const tool = c.live
    ? el('button', { type: 'button', className: 'cons-tool', textContent: 'Open the real tool' })
    : ''
  const box = el(
    'section',
    {
      className: 'consequence episodes',
      role: 'dialog',
      ariaModal: 'true',
      ariaLabel: 'Mission over',
    },
    heading,
    el('p', { className: 'cons-cause', textContent: `${r.cause}.` }),
    chain,
    tool,
    el(
      'div',
      { className: 'tomb' },
      el('p', {
        className: 'tomb-where',
        textContent: `${c.siteName ?? 'Mars'}, sol ${r.endedSol}`,
      }),
      el('label', { htmlFor: 'cons-epitaph', textContent: 'On the marker' }),
      epitaph,
    ),
    el(
      'details',
      { className: 'step-more' },
      el('summary', { textContent: 'What to do next time' }),
      reportBody(r),
    ),
    el('div', { className: 'gate-actions' }, restart),
  )
  document.body.append(box)
  heading.focus()
  if (tool && c.live) {
    const { areas, kilopower } = c.live
    tool.addEventListener('click', () => openPowerTool(areas, kilopower, () => tool.focus()))
  }
  restart.addEventListener('click', () => {
    if (c.store && c.owner) saveEpitaph(c.store, c.owner, r.version, epitaph.value)
    box.remove()
    onRestart()
  })
}

/** An old report to read; closes back to where it was opened. */
export function showReport(r: MissionReport, onTryAgain?: () => void): void {
  const close = el('button', { type: 'button', className: 'gate-primary', textContent: 'Close' })
  const again = onTryAgain
    ? el('button', {
        type: 'button',
        className: 'gate-link',
        textContent: 'Try a different approach',
      })
    : ''
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
    r.decisions?.length
      ? el(
          'dl',
          { className: 'report-decisions' },
          ...r.decisions.map((d) =>
            el('div', {}, el('dt', { textContent: d.label }), el('dd', { textContent: d.value })),
          ),
        )
      : '',
    reportBody(r),
    el('div', { className: 'gate-actions' }, again, close),
  )
  const shut = () => {
    box.remove()
    document.removeEventListener('keydown', onKey)
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') shut()
  }
  close.addEventListener('click', shut)
  if (again && onTryAgain)
    again.addEventListener('click', () => {
      shut()
      onTryAgain()
    })
  document.addEventListener('keydown', onKey)
}
