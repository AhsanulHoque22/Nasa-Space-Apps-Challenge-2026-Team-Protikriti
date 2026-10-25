/**
 * Plays a mission over the live map: hides the map's own controls, points the camera at the
 * mission's site, runs the dock, saves the result and hands back to the mission list.
 */
import type { CargoPlan } from '../core/cargo'
import { type Progress, recordCargo, saveProgress } from '../core/mission-progress'
import { MISSIONS } from '../core/missions'
import type { KeyValueStore } from '../core/streetview'
import { openDock } from './mission-dock'
import { cargoSteps, massGauge } from './missions/cargo-steps'

/** Jezero: the site NASA's power study used, shown until mission 1.2 picks the real one. */
export const PREVIEW_SITE_ID = 'jezero'

const EMPTY: CargoPlan = { kilopower: 0, solar: 0, battery: 0, isru: 0, foodSols: 0, waterKg: 0 }

export type PlayContext = {
  store: KeyValueStore | undefined
  progress: Progress
  showSite: (siteId: string) => void
  /** Back to the mission list with the progress in memory and a line saying what happened. */
  onDone: (progress: Progress, note: string | null) => void
}

export function playMission(id: string, ctx: PlayContext): void {
  const mission = MISSIONS.find((m) => m.id === id)
  if (!mission || id !== '1.1') throw new Error(`Mission ${id} cannot play on the map yet`)
  document.body.dataset.story = 'mission'
  ctx.showSite(PREVIEW_SITE_ID)

  const end = (progress: Progress, note: string | null) => {
    dock.remove()
    delete document.body.dataset.story
    ctx.onDone(progress, note)
  }
  const plan: CargoPlan = { ...(ctx.progress.cargo ?? EMPTY) }
  const steps = cargoSteps(
    plan,
    () => dock.refresh(),
    (step) => dock.goTo(step),
    () => {
      const next = recordCargo(MISSIONS, ctx.progress, { ...plan })
      const saved = saveProgress(ctx.store, next)
      end(
        next,
        saved
          ? 'Cargo loaded. Mission 1.1 is done.'
          : 'Cargo loaded. This browser did not save it, so it lasts until you close the page.',
      )
    },
  )
  const dock = openDock({
    missionTitle: `${mission.id} ${mission.title}`,
    steps,
    status: () => massGauge(plan),
    onFinish: () => undefined, // the last step's own button loads the lander
    onLeave: () => end(ctx.progress, null),
  })
}
