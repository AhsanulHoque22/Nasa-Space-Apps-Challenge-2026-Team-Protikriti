/**
 * The trail: acts in story order, one obvious next mission. Finished missions stay playable; locked ones
 * show what is coming. Expedition 3 is not built, so it is not shown.
 */
import { type Mission } from '../core/missions'
import { type MissionStatus, missionStatus } from '../core/mission-progress'
import { ACTS, episodeField } from '../core/story-acts'
import { el } from './dom'

function trailStop(m: Mission, status: MissionStatus, onStart: (id: string) => void): HTMLElement {
  const li = el('li', { className: `trail-stop is-${status.kind}` })
  li.dataset.field = episodeField(m.id)
  const head = el(
    'div',
    { className: 'trail-head' },
    el('span', { className: 'trail-ep', textContent: m.id }),
    el('h4', { className: 'trail-title', textContent: m.title }),
  )
  li.append(head)
  if (status.kind === 'open') {
    li.append(el('p', { className: 'trail-briefing', textContent: m.briefing }))
    const start = el('button', {
      type: 'button',
      className: 'gate-primary mission-start',
      textContent: 'Play this episode',
    })
    start.addEventListener('click', () => onStart(m.id))
    li.append(start)
  } else if (status.kind === 'done') {
    head.append(el('span', { className: 'trail-state', textContent: 'Done' }))
    const again = el('button', {
      type: 'button',
      className: 'gate-link mission-start',
      textContent: 'Play again',
    })
    again.addEventListener('click', () => onStart(m.id))
    li.append(
      again,
      el('p', {
        className: 'trail-warn',
        textContent: 'Finishing it again reopens the episodes after it.',
      }),
    )
  } else {
    head.append(el('span', { className: 'trail-state', textContent: 'Locked' }))
  }
  return li
}

export function renderMissionList(
  missions: readonly Mission[],
  completed: readonly string[],
  onStart: (id: string) => void,
): HTMLElement {
  const root = el('div', { className: 'trail' })
  for (const act of ACTS) {
    const list = el('ol', { className: 'trail-list' })
    for (const id of act.missions) {
      const m = missions.find((x) => x.id === id)
      if (m) list.append(trailStop(m, missionStatus(missions, completed, m.id), onStart))
    }
    root.append(
      el(
        'section',
        { className: 'trail-act' },
        el('h3', { className: 'trail-act-title', textContent: act.title }),
        el('p', { className: 'trail-act-line', textContent: act.line }),
        list,
      ),
    )
  }
  return root
}
