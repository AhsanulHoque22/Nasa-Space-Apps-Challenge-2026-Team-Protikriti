/** Story mode's mission list: expeditions, their missions, status and readable briefings. */
import { type MissionStatus, missionStatus } from '../core/mission-progress'
import type { Expedition, Mission } from '../core/missions'

function statusText(s: MissionStatus): string {
  switch (s.kind) {
    case 'done':
      return 'Done'
    case 'open':
      return 'Open'
    case 'locked':
      return `After ${s.after}`
    case 'soon':
      return 'Coming soon'
  }
}

function missionRow(
  m: Mission,
  status: MissionStatus,
  onStart: (id: string) => void,
): HTMLLIElement {
  const li = document.createElement('li')
  li.className = 'mission'
  li.dataset.status = status.kind
  const details = document.createElement('details')
  const summary = document.createElement('summary')
  const id = Object.assign(document.createElement('span'), {
    className: 'mission-id',
    textContent: m.id,
  })
  const title = Object.assign(document.createElement('span'), {
    className: 'mission-title',
    textContent: m.title,
  })
  const state = Object.assign(document.createElement('span'), {
    className: 'mission-status',
    textContent: statusText(status),
  })
  summary.append(id, title, state)
  const briefing = Object.assign(document.createElement('p'), {
    className: 'mission-briefing',
    textContent: m.briefing,
  })
  const hats = Object.assign(document.createElement('p'), {
    className: 'mission-hats',
    textContent: `Decisions: ${m.hats.join(', ')}`,
  })
  details.append(summary, briefing, hats)
  if (status.kind === 'open') {
    details.open = true // the next mission to play is shown with its start button
    const start = Object.assign(document.createElement('button'), {
      type: 'button',
      className: 'gate-primary mission-start',
      textContent: 'Start mission',
    })
    start.addEventListener('click', () => onStart(m.id))
    details.append(start)
  }
  li.append(details)
  return li
}

export function renderMissionList(
  expeditions: readonly Expedition[],
  missions: readonly Mission[],
  completed: readonly string[],
  onStart: (id: string) => void,
): HTMLElement {
  const root = document.createElement('div')
  root.className = 'missions'
  if (!missions.some((m) => m.built)) {
    root.append(
      Object.assign(document.createElement('p'), {
        className: 'gate-text',
        textContent:
          'The first missions are being built. Read the briefings now; each mission opens here when it is ready.',
      }),
    )
  }
  for (const e of expeditions) {
    const section = document.createElement('details')
    section.className = 'expedition'
    section.open = e.n === 1
    const heading = Object.assign(document.createElement('summary'), {
      className: 'expedition-title',
    })
    heading.append(
      Object.assign(document.createElement('h3'), {
        textContent: `Expedition ${e.n}: ${e.title}`,
      }),
    )
    const summary = Object.assign(document.createElement('p'), {
      className: 'expedition-summary',
      textContent: e.summary,
    })
    const list = document.createElement('ol')
    list.className = 'mission-list'
    for (const m of missions.filter((x) => x.expedition === e.n)) {
      list.append(missionRow(m, missionStatus(missions, completed, m.id), onStart))
    }
    section.append(heading, summary, list)
    root.append(section)
  }
  return root
}
