/**
 * Plays a mission over the live map: hides the map's own controls, points the camera at the
 * mission's site, runs the dock, saves the result and hands back to the mission list.
 */
import type { CargoPlan } from '../core/cargo'
import {
  type Progress,
  recordCargo,
  recordSite,
  retryFrom,
  saveProgress,
} from '../core/mission-progress'
import { MISSIONS } from '../core/missions'
import type { KeyValueStore } from '../core/streetview'
import { openDock } from './mission-dock'
import { cargoSteps, massGauge } from './missions/cargo-steps'
import type { JourneyChoice } from './missions/journey-step'
import { siteSteps } from './missions/site-steps'
import type { StoryServices } from './story'

const EMPTY: CargoPlan = { kilopower: 0, solar: 0, battery: 0, isru: 0, foodSols: 0, waterKg: 0 }

export type PlayContext = {
  store: KeyValueStore | undefined
  progress: Progress
  services: StoryServices
  /** Back to the mission list with the progress in memory and a line saying what happened. */
  onDone: (progress: Progress, note: string | null) => void
}

export function playMission(id: string, ctx: PlayContext): void {
  const mission = MISSIONS.find((m) => m.id === id)
  if (!mission) throw new Error(`No mission with id "${id}"`)
  const title = `${mission.id} ${mission.title}`
  if (id === '1.1') playCargo(title, ctx)
  else if (id === '1.2') playSite(title, ctx)
  else throw new Error(`Mission ${id} cannot play on the map yet`)
}

/** Saves the result and says so, or says it lasts only until the page closes. */
function saved(ctx: PlayContext, next: Progress, done: string): string {
  return saveProgress(ctx.store, next)
    ? done
    : `${done} This browser did not save it, so it lasts until you close the page.`
}

function playCargo(title: string, ctx: PlayContext): void {
  document.body.dataset.story = 'mission'
  ctx.services.showGlobe() // nothing has landed yet: Mars turns in the background

  const end = (progress: Progress, note: string | null) => {
    dock.remove()
    delete document.body.dataset.story
    ctx.onDone(progress, note)
  }
  const plan: CargoPlan = { ...(ctx.progress.cargo ?? EMPTY) }
  const journey: JourneyChoice = { routeIndex: 0, journeys: null }
  const steps = cargoSteps(
    plan,
    journey,
    () => dock.refresh(),
    (step) => dock.goTo(step),
    () => {
      const route = journey.journeys?.routes[journey.routeIndex]
      if (!route) return // the journey step has not finished loading; nothing to record yet
      const next = recordCargo(MISSIONS, ctx.progress, { ...plan }, route.days)
      end(next, saved(ctx, next, 'Cargo loaded. Mission 1.1 is done.'))
    },
  )
  const dock = openDock({
    missionTitle: title,
    steps,
    status: () => massGauge(plan),
    onFinish: () => undefined, // the last step's own button loads the lander
    onLeave: () => end(ctx.progress, null),
  })
}

function playSite(title: string, ctx: PlayContext): void {
  const cargo = ctx.progress.cargo
  if (!cargo) throw new Error('Mission 1.2 needs the cargo packed in mission 1.1')
  ctx.services.loadZones().then(
    (zones) => {
      document.body.dataset.story = 'mission'
      const end = (progress: Progress, note: string | null) => {
        dock.remove()
        delete document.body.dataset.story
        ctx.onDone(progress, note)
      }
      const steps = siteSteps(zones, cargo, ctx.services, {
        onLand: (site) => {
          const next = recordSite(MISSIONS, ctx.progress, site)
          end(next, saved(ctx, next, `Cargo landed at ${site.zone}. Mission 1.2 is done.`))
        },
        onRepack: () => {
          const next = retryFrom(MISSIONS, ctx.progress, '1.1')
          end(next, saved(ctx, next, 'Mission 1.1 is open again: repack the lander.'))
        },
      })
      const dock = openDock({
        missionTitle: title,
        steps,
        status: () => massGauge(cargo),
        onFinish: () => undefined, // the verdict's own button lands the cargo
        onLeave: () => end(ctx.progress, null),
      })
    },
    () =>
      ctx.onDone(
        ctx.progress,
        'The landing zones could not be loaded. Check the connection and start the mission again.',
      ),
  )
}
