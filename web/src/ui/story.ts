/** Story mode inside the start screen: the mission list, opening a mission, saving the result. */
import { type Progress, loadProgress, recordCargo, saveProgress } from '../core/mission-progress'
import { EXPEDITIONS, MISSIONS } from '../core/missions'
import type { Profile } from '../core/profile'
import type { KeyValueStore } from '../core/streetview'
import { el } from './dom'
import { renderMissionList } from './mission-list'
import { renderCargoScreen } from './missions/cargo-screen'

const NOT_SAVED_NOTE =
  'This browser did not save your progress, so it lasts until you close the page.'

export type StoryContext = {
  store: KeyValueStore | undefined
  profile: Profile
  /** The start screen's content area; Story mode owns it while open. */
  body: HTMLElement
  onBack: () => void
  onMap: () => void
}

export function showStory(ctx: StoryContext): void {
  const loaded = loadProgress(
    ctx.store,
    ctx.profile.createdAt,
    MISSIONS.map((m) => m.id),
  )
  let progress = loaded.progress
  let note = loaded.note

  const commit = (next: Progress, result: string) => {
    progress = next
    note = saveProgress(ctx.store, next) ? result : `${result} ${NOT_SAVED_NOTE}`
    showList()
  }

  function showMission(id: string) {
    const mission = MISSIONS.find((m) => m.id === id)
    if (!mission) throw new Error(`No mission with id "${id}"`)
    if (id === '1.1') {
      ctx.body.replaceChildren(
        renderCargoScreen(
          mission,
          progress.cargo,
          (plan) =>
            commit(recordCargo(MISSIONS, progress, plan), 'Cargo loaded. Mission 1.1 is done.'),
          showList,
        ),
      )
      ctx.body.querySelector<HTMLElement>('h2')?.focus()
      return
    }
    throw new Error(`Mission ${id} has no screen yet`)
  }

  function showList() {
    const back = el('button', { type: 'button', className: 'gate-link', textContent: 'Back' })
    back.addEventListener('click', ctx.onBack)
    const map = el('button', {
      type: 'button',
      className: 'gate-link',
      textContent: 'Open Martian Map instead',
    })
    map.addEventListener('click', ctx.onMap)
    ctx.body.replaceChildren(
      el('h2', { className: 'gate-heading', textContent: 'Story mode', tabIndex: -1 }),
      note ? el('p', { className: 'gate-note', textContent: note }) : '',
      renderMissionList(EXPEDITIONS, MISSIONS, progress.completed, showMission),
      el('div', { className: 'gate-actions' }, back, map),
    )
    ctx.body.querySelector<HTMLElement>('h2')?.focus()
  }

  showList()
}
