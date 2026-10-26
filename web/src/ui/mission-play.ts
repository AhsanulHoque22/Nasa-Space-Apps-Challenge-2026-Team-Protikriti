/**
 * Plays a mission over the live map: hides the map's own controls, points the camera at the
 * mission's site, runs the dock, saves the result and hands back to the mission list.
 */
import { loadJourneys } from './journey-client'
import type { CargoPlan } from '../core/cargo'
import {
  type Progress,
  recordBase,
  recordCargo,
  recordLanding,
  recordGreenhouse,
  recordStorm,
  recordMarswalk,
  recordSite,
  retryFrom,
  saveProgress,
} from '../core/mission-progress'
import { CLEAR_TAU } from '../core/mission-constants'
import { MISSIONS } from '../core/missions'
import { darkestSolStartUtc, daylightSun } from '../core/surface-solar'
import type { KeyValueStore } from '../core/streetview'
import { openDock } from './mission-dock'
import { cargoSteps, massGauge } from './missions/cargo-steps'
import type { JourneyChoice } from './missions/journey-step'
import { baseSteps } from './missions/base-steps'
import { landingSteps } from './missions/landing-steps'
import { siteSteps } from './missions/site-steps'
import { marswalkSteps } from './missions/marswalk-steps'
import { greenhouseSteps } from './missions/greenhouse-steps'
import { stormSteps } from './missions/storm-steps'
import { SITE_BRIEFS } from '../core/site-features'
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
  else if (id === '1.3') playLanding(title, ctx)
  else if (id === '1.4') playBase(title, ctx)
  else if (id === '1.5') playMarswalk(title, ctx)
  else if (id === '1.6') playGreenhouse(title, ctx)
  else if (id === '1.7') playStorm(title, ctx)
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

function playLanding(title: string, ctx: PlayContext): void {
  const site = ctx.progress.site
  if (!site) throw new Error('Mission 1.3 needs the landing site chosen in mission 1.2')
  ctx.services.loadZones().then(
    (zones) => {
      document.body.dataset.story = 'mission'
      const end = (progress: Progress, note: string | null) => {
        dock.remove()
        delete document.body.dataset.story
        ctx.onDone(progress, note)
      }
      const steps = landingSteps(zones, site, ctx.progress.crewRouteDays, ctx.services, () => {
        const next = recordLanding(MISSIONS, ctx.progress)
        end(next, saved(ctx, next, `The crew has landed at ${site.zone}. Mission 1.3 is done.`))
      })
      const dock = openDock({
        missionTitle: title,
        steps,
        onFinish: () => undefined, // the last step's own button lands the crew
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

function playBase(title: string, ctx: PlayContext): void {
  const { site, cargo } = ctx.progress
  if (!site || !cargo)
    throw new Error('Mission 1.4 needs the cargo (1.1) and the landing site (1.2)')
  ctx.services.siteGrid(site.siteId).then((grid) => {
    if (!grid) {
      ctx.onDone(ctx.progress, 'The site’s terrain could not be loaded. Start the mission again.')
      return
    }
    // The arrays' shadow check uses the darkest sol of the year at the mapped terrain.
    const lat = (grid.north + grid.south) / 2
    const lon = (grid.west + grid.east) / 2
    const sun = daylightSun(lat, lon, darkestSolStartUtc(lat, lon, CLEAR_TAU), CLEAR_TAU)
    ctx.services.declutter(true)
    document.body.dataset.story = 'mission'
    const end = (progress: Progress, note: string | null) => {
      dock.remove()
      ctx.services.base.clear()
      ctx.services.declutter(false)
      delete document.body.dataset.story
      ctx.onDone(progress, note)
    }
    const days = ctx.progress.crewRouteDays
    const sol1Utc = loadJourneys().then((j) => {
      const route = j.routes.find((r) => r.days === days) ?? j.routes[0]
      if (!route) throw new Error('no crew route')
      return route.arriveMs
    })
    const steps = baseSteps(
      grid,
      sun,
      site,
      cargo,
      ctx.progress.base,
      ctx.services,
      sol1Utc,
      (layout) => {
        const next = recordBase(MISSIONS, ctx.progress, layout)
        end(
          next,
          saved(ctx, next, 'The base is set and the clock has started. Mission 1.4 is done.'),
        )
      },
    )
    const dock = openDock({
      missionTitle: title,
      steps,
      onFinish: () => undefined, // the last step's own button finishes the mission
      onLeave: () => end(ctx.progress, null),
    })
  })
}

function playMarswalk(title: string, ctx: PlayContext): void {
  const { site, base } = ctx.progress
  if (!site || !base?.habitat)
    throw new Error('Mission 1.5 needs the landing site (1.2) and the base (1.4)')
  const home = base.habitat
  const features = SITE_BRIEFS.find((b) => b.siteId === site.siteId)?.features ?? []
  ctx.services.siteGrid(site.siteId).then((grid) => {
    if (!grid) {
      ctx.onDone(ctx.progress, 'The site’s terrain could not be loaded. Start the mission again.')
      return
    }
    ctx.services.declutter(true)
    document.body.dataset.story = 'mission'
    const end = (progress: Progress, note: string | null) => {
      dock.remove()
      ctx.services.walk.clear()
      ctx.services.pins.show([], () => undefined)
      ctx.services.base.pick(null)
      ctx.services.declutter(false)
      delete document.body.dataset.story
      ctx.onDone(progress, note)
    }
    const days = ctx.progress.crewRouteDays
    const sol1Utc = loadJourneys().then((j) => {
      const route = j.routes.find((r) => r.days === days) ?? j.routes[0]
      if (!route) throw new Error('no crew route')
      return route.arriveMs
    })
    const steps = marswalkSteps(
      site.siteId,
      grid,
      home,
      features,
      ctx.services,
      sol1Utc,
      (walk) => {
        const next = recordMarswalk(MISSIONS, ctx.progress, walk)
        end(next, saved(ctx, next, 'The crew is back inside. Mission 1.5 is done.'))
      },
    )
    const dock = openDock({
      missionTitle: title,
      steps,
      onFinish: () => undefined, // the last step's own button finishes the mission
      onLeave: () => end(ctx.progress, null),
    })
  })
}

function playGreenhouse(title: string, ctx: PlayContext): void {
  const { site, base } = ctx.progress
  if (!site || !base?.habitat)
    throw new Error('Mission 1.6 needs the landing site (1.2) and the base (1.4)')
  ctx.services.siteGrid(site.siteId).then((grid) => {
    if (!grid) {
      ctx.onDone(ctx.progress, 'The site’s terrain could not be loaded. Start the mission again.')
      return
    }
    ctx.services.declutter(true)
    document.body.dataset.story = 'mission'
    const end = (progress: Progress, note: string | null) => {
      dock.remove()
      ctx.services.base.pick(null)
      ctx.services.pins.show([], () => undefined)
      ctx.services.showBase(progress) // drop a preview that was not kept
      ctx.services.declutter(false)
      delete document.body.dataset.story
      ctx.onDone(progress, note)
    }
    const steps = greenhouseSteps(grid, ctx.progress, ctx.services, (greenhouse) => {
      const next = recordGreenhouse(MISSIONS, ctx.progress, greenhouse)
      end(next, saved(ctx, next, 'The greenhouse trial is planted. Mission 1.6 is done.'))
    })
    const dock = openDock({
      missionTitle: title,
      steps,
      onFinish: () => undefined, // the last step's own button finishes the mission
      onLeave: () => end(ctx.progress, null),
    })
  })
}

function playStorm(title: string, ctx: PlayContext): void {
  if (!ctx.progress.cargo || !ctx.progress.base)
    throw new Error('Mission 1.7 needs the cargo (1.1) and the base (1.4)')
  const days = ctx.progress.crewRouteDays
  const sol1Utc = loadJourneys().then((j) => {
    const route = j.routes.find((r) => r.days === days) ?? j.routes[0]
    if (!route) throw new Error('no crew route')
    return route.arriveMs
  })
  ctx.services.declutter(true)
  document.body.dataset.story = 'mission'
  const end = (progress: Progress, note: string | null) => {
    dock.remove()
    ctx.services.pins.show([], () => undefined)
    ctx.services.declutter(false)
    delete document.body.dataset.story
    ctx.onDone(progress, note)
  }
  const steps = stormSteps(ctx.progress, sol1Utc, ctx.services, (storm) => {
    const next = recordStorm(MISSIONS, ctx.progress, storm)
    end(next, saved(ctx, next, 'The base came through the dust storm. Mission 1.7 is done.'))
  })
  const dock = openDock({
    missionTitle: title,
    steps,
    onFinish: () => undefined, // the last step's own button finishes the mission
    onLeave: () => end(ctx.progress, null),
  })
}
