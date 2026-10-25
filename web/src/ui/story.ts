/** Story mode inside the start screen: the mission list, opening a mission, saving the result. */
import { type Progress, loadProgress } from '../core/mission-progress'
import { EXPEDITIONS, MISSIONS } from '../core/missions'
import type { Profile } from '../core/profile'
import type { KeyValueStore } from '../core/streetview'
import type { ZoneRow } from '../core/zone-rank'
import type { FeaturePins } from '../map/feature-pins'
import { el } from './dom'
import { loadJourneys } from './journey-client'
import { renderMissionList } from './mission-list'

/** What Story mode needs from the map app, which may still be loading. */
export type StoryServices = {
  loadZones: () => Promise<ZoneRow[]>
  /** Point the camera at an ATLAS terrain site. */
  showSite: (siteId: string) => void
  /** Back to the whole planet, turning slowly (before the crew has landed anywhere). */
  showGlobe: () => void
  /** Mission 1.2's numbered pins on the terrain. */
  pins: FeaturePins
}

export type StoryContext = {
  services: StoryServices
  store: KeyValueStore | undefined
  profile: Profile
  /** The start screen's content area; Story mode owns it while open. */
  body: HTMLElement
  onBack: () => void
  onMap: () => void
  /** Play a mission over the map (the start screen closes meanwhile). */
  onPlay: (id: string, progress: Progress) => void
  /** Progress and note handed back by a mission that just ended. */
  resume?: { progress: Progress; note: string | null }
}

export function showStory(ctx: StoryContext): void {
  const loaded =
    ctx.resume ??
    loadProgress(
      ctx.store,
      ctx.profile.createdAt,
      MISSIONS.map((m) => m.id),
    )
  const progress = loaded.progress
  const note = loaded.note

  function showMission(id: string) {
    const mission = MISSIONS.find((m) => m.id === id)
    if (!mission) throw new Error(`No mission with id "${id}"`)
    if (id === '1.1' || id === '1.2') {
      ctx.onPlay(id, progress)
      return
    }
    throw new Error(`Mission ${id} has no screen yet`)
  }

  function showList() {
    // Start the Earth–Mars transfer search now, so mission 1.1's routes are ready when it opens.
    void loadJourneys().catch(() => undefined)
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
