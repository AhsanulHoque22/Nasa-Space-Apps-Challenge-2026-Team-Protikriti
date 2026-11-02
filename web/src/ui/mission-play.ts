/**
 * Plays a mission over the live map: hides the map's own controls, points the camera at the
 * mission's site, runs the dock, saves the result and hands back to the mission list.
 */
import { loadJourneys } from './journey-client'
import { type CargoPlan, landerMassKg } from '../core/cargo'
import {
  type Progress,
  recordBase,
  recordCargo,
  recordLanding,
  recordGreenhouse,
  recordStorm,
  recordWater,
  recordTraverse,
  recordFailure,
  recordReturn,
  recordCargo2,
  recordWake2,
  recordGreenhouse2,
  recordWater2,
  recordCave2,
  recordSample2,
  recordReturn2,
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
import { el } from './dom'
import { cargoSteps, massGauge } from './missions/cargo-steps'
import { cargo2Steps } from './missions/cargo-2-steps'
import { massGauge2 } from './missions/cargo-2-views'
import { type Cargo2Plan, DEFAULT_CARGO_2_PLAN } from '../core/cargo-2'
import { wakeBaseSteps } from './missions/wake-base-steps'
import {
  computeWakeTelemetry,
  INITIAL_WAKE_BASE_STATE,
  type WakeBaseState,
} from '../core/wake-base'
import { greenhouse2Steps } from './missions/greenhouse-2-steps'
import {
  computeGreenhouse2Yield,
  DEFAULT_GREENHOUSE_2_CONFIG,
  type Greenhouse2Config,
} from '../core/greenhouse-2'
import { iceMiningSteps } from './missions/ice-mining-steps'
import {
  computeIceMiningYield,
  DEFAULT_ICE_MINING_CONFIG,
  type IceMiningConfig,
} from '../core/ice-mining'
import { caveScoutingSteps } from './missions/cave-scouting-steps'
import {
  computeCaveScoutYield,
  DEFAULT_CAVE_SCOUT_CONFIG,
  type CaveScoutConfig,
} from '../core/cave-scouting'
import { sampleCampaignSteps } from './missions/sample-campaign-steps'
import {
  computeSampleCampaignYield,
  DEFAULT_SAMPLE_SELECTION,
  type SampleCampaignSelection,
} from '../core/sample-campaign'
import { return2Steps } from './missions/return-2-steps'
import {
  computeReturn2Debrief,
  DEFAULT_HIBERNATION_CONFIG,
  DEFAULT_MAV_CHECKS,
  type BaseHibernationConfig,
  type MavPreflightChecks,
} from '../core/return-2'
import { chosenStay } from './missions/stay-step'
import { STAY_DAYS } from '../core/stay'
import type { JourneyChoice } from './missions/journey-step'
import { baseSteps } from './missions/base-steps'
import { landingSteps } from './missions/landing-steps'
import { siteSteps } from './missions/site-steps'
import { marswalkSteps } from './missions/marswalk-steps'
import { greenhouseSteps } from './missions/greenhouse-steps'
import { stormSteps } from './missions/storm-steps'
import { waterSteps } from './missions/water-steps'
import { traverseSteps } from './missions/traverse-steps'
import { failureSteps } from './missions/failure-steps'
import { returnSteps } from './missions/return-steps'
import { iceAt } from '../core/site-report'
import { SITE_BRIEFS } from '../core/site-features'
import type { StoryServices } from './story'
import { runStores } from '../core/base-stores'
import { STORM_SOLS, type StormBase, type StormLoads, stormRun } from '../core/dust-storm'
import { type Areas, greenhouseBudget } from '../core/greenhouse'
import { type MissionReport, appendReport, loadReports } from '../core/mission-reports'
import { MISSION_SOL, ledgerInput, solReached } from '../core/run-ledger'
import { type RunFailure, runReport } from '../core/run-report'
import { lessonsButton } from './lessons'
import { showMissionOver } from './mission-over'
import { sunFor } from './run-check'
import { storesBar } from './stores-bar'

/** Lander A starts as NASA packs it (DRA 5.0): 4 reactors and 2 oxygen plants. The player can change it. */
const START_PLAN: CargoPlan = {
  kilopower: 4,
  solar: 0,
  battery: 0,
  isru: 2,
  foodSols: 0,
  waterKg: 0,
  recycler: 0,
  greenhouseM2: 0,
}

export type PlayContext = {
  store: KeyValueStore | undefined
  progress: Progress
  services: StoryServices
  /** Back to the mission list with the progress in memory and a line saying what happened. */
  onDone: (progress: Progress, note: string | null) => void
}

/** A run that ends inside a mission, with what the report needs to explain it. */
type Direct = {
  failure: RunFailure
  storm?: StormBase & { loads: StormLoads }
  walkDistanceM?: number
  walkPlannedM?: number
}
/** What each mission gets: the context, the crew's mission reports, and a way to end the run. */
type Play = PlayContext & { reports: MissionReport[]; fail: (d: Direct) => void }

export function playMission(id: string, ctx: PlayContext): void {
  const mission = MISSIONS.find((m) => m.id === id)
  if (!mission) throw new Error(`No mission with id "${id}"`)
  const title = `${mission.id} ${mission.title}`
  let direct: Direct | null = null
  const play: Play = {
    ...ctx,
    reports: loadReports(ctx.store, ctx.progress.owner),
    fail: (d) => (direct = d),
    onDone: (progress, note) => {
      // Leaving a mission, or a mission before the crew lands, changes nothing on Mars.
      if (!direct && (progress === ctx.progress || !progress.completed.includes('1.3')))
        ctx.onDone(progress, note)
      else void afterMission(ctx, progress, note, id, direct)
    },
  }
  if (id === '1.1') playCargo(title, play)
  else if (id === '1.2') playSite(title, play)
  else if (id === '1.3') playLanding(title, play)
  else if (id === '1.4') playBase(title, play)
  else if (id === '1.5') playMarswalk(title, play)
  else if (id === '1.6') playGreenhouse(title, play)
  else if (id === '1.7') playStorm(title, play)
  else if (id === '1.8') playWater(title, play)
  else if (id === '1.9') playTraverse(title, play)
  else if (id === '1.10') playFailure(title, play)
  else if (id === '1.11') playReturn(title, play)
  else if (id === '2.1') playCargo2(title, play)
  else if (id === '2.2') playWakeBase(title, play)
  else if (id === '2.3') playGreenhouse2(title, play)
  else if (id === '2.4') playWater2(title, play)
  else if (id === '2.5') playCave2(title, play)
  else if (id === '2.6') playSample2(title, play)
  else if (id === '2.7') playReturn2(title, play)
  else throw new Error(`Mission ${id} cannot play on the map yet`)
}

/**
 * After a mission on Mars: run the stores to the sol reached. A store that ran out, or a failure
 * inside the mission, ends the run: a mission report is written and Expedition 1 starts again.
 */
async function afterMission(
  ctx: PlayContext,
  next: Progress,
  note: string | null,
  id: string,
  direct: Direct | null,
): Promise<void> {
  const sun = await sunFor(next).catch(() => null)
  const input = ledgerInput(next, sun ?? (() => 0), solReached(next))
  const run = input ? runStores(input) : null
  const ran = run?.failure ?? null
  const failure: RunFailure | null = direct?.failure ?? (ran ? { ...ran, missionId: id } : null)
  if (!failure) {
    ctx.onDone(next, note)
    return
  }
  const lessons = runReport({
    progress: next,
    failure,
    stores: input ? { ...input, untilSol: failure.sol } : null,
    ...(direct?.storm && { storm: direct.storm }),
    ...(direct?.walkDistanceM !== undefined && { walkDistanceM: direct.walkDistanceM }),
    ...(direct?.walkPlannedM !== undefined && { walkPlannedM: direct.walkPlannedM }),
  })
  const summary = next.cargo && {
    landerAKg: landerMassKg(next.cargo, 'A'),
    landerBKg: landerMassKg(next.cargo, 'B'),
    solsEarned: run?.solsEarned ?? 0,
  }
  const report = appendReport(ctx.store, next.owner, failure, lessons, summary || undefined)
  showMissionOver(report, () => {
    const fresh: Progress = { version: 1, owner: next.owner, completed: [] }
    ctx.onDone(
      fresh,
      saved(
        ctx,
        fresh,
        `Expedition 1 starts again. Mission report v${report.version} is waiting in each mission's lessons.`,
      ),
    )
  })
}

/** Saves the result and says so, or says it lasts only until the page closes. */
function saved(ctx: PlayContext, next: Progress, done: string): string {
  return saveProgress(ctx.store, next)
    ? done
    : `${done} This browser did not save it, so it lasts until you close the page.`
}

function playCargo(title: string, ctx: Play): void {
  document.body.dataset.story = 'mission'
  ctx.services.showGlobe() // nothing has landed yet: Mars turns in the background

  const end = (progress: Progress, note: string | null) => {
    dock.remove()
    delete document.body.dataset.story
    ctx.onDone(progress, note)
  }
  const plan: CargoPlan = { ...(ctx.progress.cargo ?? START_PLAN) }
  const journey: JourneyChoice = {
    routeIndex: 0,
    journeys: null,
    shipIndex: 0,
    stayDays: ctx.progress.stay?.days ?? STAY_DAYS[0],
  }
  const steps = cargoSteps(
    plan,
    journey,
    () => dock.refresh(),
    (step) => dock.goTo(step),
    () => {
      const route = journey.journeys?.routes[journey.routeIndex]
      const stay = chosenStay(journey)
      if (!route || !stay) return // the journey step has not finished loading; nothing to record yet
      const next = recordCargo(MISSIONS, ctx.progress, { ...plan }, route.days, stay)
      end(next, saved(ctx, next, 'Cargo loaded. Mission 1.1 is done.'))
    },
    ctx.reports,
  )
  const dock = openDock({
    missionTitle: title,
    lessons: lessonsButton(ctx.reports, '1.1'),
    steps,
    status: () => massGauge(plan),
    onFinish: () => undefined, // the last step's own button loads the lander
    onLeave: () => end(ctx.progress, null),
  })
}

function playSite(title: string, ctx: Play): void {
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
        lessons: lessonsButton(ctx.reports, '1.2'),
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

function playLanding(title: string, ctx: Play): void {
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
        lessons: lessonsButton(ctx.reports, '1.3'),
        status: () => storesBar(ctx.progress),
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

function playBase(title: string, ctx: Play): void {
  const { site, cargo, stay } = ctx.progress
  if (!site || !cargo || !stay)
    throw new Error('Mission 1.4 needs the cargo and stay (1.1) and the landing site (1.2)')
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
      ctx.services.showBase(progress) // drop a preview that was not kept
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
      stay,
      ctx.progress,
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
      lessons: lessonsButton(ctx.reports, '1.4'),
      status: () => storesBar(ctx.progress),
      steps,
      onFinish: () => undefined, // the last step's own button finishes the mission
      onLeave: () => end(ctx.progress, null),
    })
  })
}

function playMarswalk(title: string, ctx: Play): void {
  ctx.services.showImagery() // the crew are on the ground: show the real surface
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
      (distanceM, plannedM) => {
        const m = Math.round(distanceM).toLocaleString('en-US')
        ctx.fail({
          failure: {
            store: 'suit',
            sol: MISSION_SOL['1.5'] ?? 5,
            missionId: '1.5',
            why: `A suit ran out ${m} m from the airlock`,
          },
          walkDistanceM: distanceM,
          walkPlannedM: plannedM,
        })
        end(ctx.progress, null)
      },
      ctx.reports,
    )
    const dock = openDock({
      missionTitle: title,
      lessons: lessonsButton(ctx.reports, '1.5'),
      status: () => storesBar(ctx.progress),
      steps,
      onFinish: () => undefined, // the last step's own button finishes the mission
      onLeave: () => end(ctx.progress, null),
    })
  })
}

function playGreenhouse(title: string, ctx: Play): void {
  ctx.services.showImagery() // the crew are on the ground: show the real surface
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
    const steps = greenhouseSteps(grid, ctx.progress, ctx.reports, ctx.services, (greenhouse) => {
      const next = recordGreenhouse(MISSIONS, ctx.progress, greenhouse)
      const b = greenhouseBudget(greenhouse.areas as Areas, ctx.progress.cargo?.kilopower ?? 0)
      if (!b.fits)
        ctx.fail({
          failure: {
            store: 'power',
            sol: MISSION_SOL['1.6'] ?? 6,
            missionId: '1.6',
            why: `The greenhouse lights (${b.peakKw.toFixed(1)} kW) browned out the base: the reactors had ${Math.max(0, b.spareKw).toFixed(1)} kW spare`,
          },
        })
      end(next, saved(ctx, next, 'The greenhouse trial is planted. Mission 1.6 is done.'))
    })
    const dock = openDock({
      missionTitle: title,
      lessons: lessonsButton(ctx.reports, '1.6'),
      status: () => storesBar(ctx.progress),
      steps,
      onFinish: () => undefined, // the last step's own button finishes the mission
      onLeave: () => end(ctx.progress, null),
    })
  })
}

function playWater(title: string, ctx: Play): void {
  ctx.services.showImagery() // the crew are on the ground: show the real surface
  const { site, base } = ctx.progress
  if (!site || !base?.habitat)
    throw new Error('Mission 1.8 needs the landing site (1.2) and the base (1.4)')
  void Promise.all([ctx.services.siteGrid(site.siteId), ctx.services.swim()]).then(
    ([grid, swim]) => {
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
      const reading = swim ? iceAt(swim, site.lon, site.lat) : null
      const steps = waterSteps(grid, ctx.progress, reading, ctx.reports, ctx.services, (water) => {
        const next = recordWater(MISSIONS, ctx.progress, water)
        end(next, saved(ctx, next, 'The water plant is running. Mission 1.8 is done.'))
      })
      const dock = openDock({
        missionTitle: title,
        lessons: lessonsButton(ctx.reports, '1.8'),
        status: () => storesBar(ctx.progress),
        steps,
        onFinish: () => undefined, // the last step's own button finishes the mission
        onLeave: () => end(ctx.progress, null),
      })
    },
  )
}

function playTraverse(title: string, ctx: Play): void {
  ctx.services.showImagery() // the crew are on the ground: show the real surface
  if (!ctx.progress.base?.habitat) throw new Error('Mission 1.9 needs the base (1.4)')
  void Promise.all([ctx.services.places(), ctx.services.mola()]).then(([places, mola]) => {
    ctx.services.declutter(true)
    document.body.dataset.story = 'mission'
    const end = (progress: Progress, note: string | null) => {
      dock.remove()
      ctx.services.traverse.clear()
      ctx.services.declutter(false)
      delete document.body.dataset.story
      ctx.onDone(progress, note)
    }
    const steps = traverseSteps(
      ctx.progress,
      places,
      mola,
      ctx.reports,
      ctx.services.traverse,
      (traverse) => {
        const next = recordTraverse(MISSIONS, ctx.progress, traverse)
        end(
          next,
          saved(ctx, next, 'The crew are home from the long traverse. Mission 1.9 is done.'),
        )
      },
    )
    const dock = openDock({
      missionTitle: title,
      lessons: lessonsButton(ctx.reports, '1.9'),
      status: () => storesBar(ctx.progress),
      steps,
      onFinish: () => undefined, // the last step's own button finishes the mission
      onLeave: () => end(ctx.progress, null),
    })
  })
}

function playFailure(title: string, ctx: Play): void {
  ctx.services.showImagery() // the crew are on the ground: show the real surface
  if (!ctx.progress.cargo || !ctx.progress.base)
    throw new Error('Mission 1.10 needs the cargo (1.1) and the base (1.4)')
  void sunFor(ctx.progress)
    .catch(() => null)
    .then((sun) => {
      ctx.services.declutter(true)
      document.body.dataset.story = 'mission'
      const end = (progress: Progress, note: string | null) => {
        dock.remove()
        ctx.services.declutter(false)
        delete document.body.dataset.story
        ctx.onDone(progress, note)
      }
      const steps = failureSteps(ctx.progress, sun, ctx.reports, ctx.services, (outage) => {
        const next = recordFailure(MISSIONS, ctx.progress, outage)
        end(next, saved(ctx, next, 'The replacement reactor is running. Mission 1.10 is done.'))
      })
      const dock = openDock({
        missionTitle: title,
        lessons: lessonsButton(ctx.reports, '1.10'),
        status: () => storesBar(ctx.progress),
        steps,
        onFinish: () => undefined, // the last step's own button finishes the mission
        onLeave: () => end(ctx.progress, null),
      })
    })
}

function playReturn(title: string, ctx: Play): void {
  ctx.services.showImagery() // the crew are on the ground: show the real surface
  if (!ctx.progress.stay || !ctx.progress.crewRouteDays)
    throw new Error('Mission 1.11 needs the stay and crew route (1.1)')
  const days = ctx.progress.crewRouteDays
  void Promise.all([
    sunFor(ctx.progress).catch(() => null),
    loadJourneys().then((j) => j.routes.find((r) => r.days === days) ?? j.routes[0]),
  ]).then(([sun, crew]) => {
    if (!crew) {
      ctx.onDone(ctx.progress, 'The crew’s route could not be worked out. Start the mission again.')
      return
    }
    ctx.services.declutter(true)
    document.body.dataset.story = 'mission'
    const end = (progress: Progress, note: string | null) => {
      dock.remove()
      ctx.services.declutter(false)
      delete document.body.dataset.story
      ctx.onDone(progress, note)
    }
    const steps = returnSteps(ctx.progress, sun, crew, ctx.reports, (home) => {
      const next = recordReturn(MISSIONS, ctx.progress, home)
      end(next, saved(ctx, next, 'The crew are home. Expedition 1 is complete.'))
    })
    const dock = openDock({
      missionTitle: title,
      lessons: lessonsButton(ctx.reports, '1.11'),
      status: () => storesBar(ctx.progress),
      steps,
      onFinish: () => undefined, // the last step's own button finishes the mission
      onLeave: () => end(ctx.progress, null),
    })
  })
}

function playStorm(title: string, ctx: Play): void {
  ctx.services.showImagery() // the crew are on the ground: show the real surface
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
  const steps = stormSteps(ctx.progress, sol1Utc, ctx.reports, ctx.services, (storm, setUp) => {
    const next = recordStorm(MISSIONS, ctx.progress, storm)
    if (storm.shortKwh > 0) {
      const day = stormRun(setUp).firstShortSol ?? 0
      ctx.fail({
        failure: {
          store: 'power',
          sol: solReached(next) - (STORM_SOLS - 1) + day,
          missionId: '1.7',
          why: `On storm sol ${day} the base ran out of power: ${Math.round(storm.shortKwh).toLocaleString('en-US')} kWh short over the storm`,
        },
        storm: setUp,
      })
    }
    end(next, saved(ctx, next, 'The base came through the dust storm. Mission 1.7 is done.'))
  })
  const dock = openDock({
    missionTitle: title,
    lessons: lessonsButton(ctx.reports, '1.7'),
    status: () => storesBar(ctx.progress),
    steps,
    onFinish: () => undefined, // the last step's own button finishes the mission
    onLeave: () => end(ctx.progress, null),
  })
}

function playCargo2(title: string, ctx: Play): void {
  document.body.dataset.story = 'mission'
  ctx.services.showGlobe()

  const end = (progress: Progress, note: string | null) => {
    dock.remove()
    delete document.body.dataset.story
    ctx.onDone(progress, note)
  }

  const plan: Cargo2Plan = { ...(ctx.progress.cargo2 ?? DEFAULT_CARGO_2_PLAN) }
  const steps = cargo2Steps(
    plan,
    () => dock.refresh(),
    (step) => dock.goTo(step),
    () => {
      const next = recordCargo2(MISSIONS, ctx.progress, { ...plan })
      end(next, saved(ctx, next, 'Expedition 2 lander packed and certified. Mission 2.1 is done.'))
    },
  )

  const dock = openDock({
    missionTitle: title,
    steps,
    status: () => massGauge2(plan),
    onFinish: () => undefined,
    onLeave: () => end(ctx.progress, null),
  })
}

function playWakeBase(title: string, ctx: Play): void {
  document.body.dataset.story = 'mission'
  ctx.services.showGlobe()

  const end = (progress: Progress, note: string | null) => {
    dock.remove()
    delete document.body.dataset.story
    ctx.onDone(progress, note)
  }

  const state: WakeBaseState = {
    ...(ctx.progress.wake2?.state ?? INITIAL_WAKE_BASE_STATE),
  }

  const steps = wakeBaseSteps(
    state,
    () => dock.refresh(),
    () => {
      const next = recordWake2(MISSIONS, ctx.progress, {
        state: { ...state },
      })
      end(
        next,
        saved(
          ctx,
          next,
          'Base successfully revived from dormancy and certified nominal. Mission 2.2 is done.',
        ),
      )
    },
    ctx.progress.cargo2,
    ctx.progress.cargo?.kilopower,
  )

  const dock = openDock({
    missionTitle: title,
    steps,
    status: () => {
      const telem = computeWakeTelemetry(state, ctx.progress.cargo2, ctx.progress.cargo?.kilopower)
      return el(
        'div',
        { className: 'dock-wake-status' },
        el('span', {
          className: 'wake-pill',
          textContent: `${telem.fissionPowerKw.toFixed(1)} kW · ${telem.o2PartialPressureKpa.toFixed(1)} kPa · Hab ${telem.cabinTempC.toFixed(0)}°C`,
        }),
      )
    },
    onFinish: () => undefined,
    onLeave: () => end(ctx.progress, null),
  })
}

function playGreenhouse2(title: string, ctx: Play): void {
  document.body.dataset.story = 'mission'
  ctx.services.showGlobe()
  const firstBase = ctx.progress.cargo && {
    greenhouseM2: ctx.progress.cargo.greenhouseM2,
    kilopower: ctx.progress.cargo.kilopower,
  }

  const end = (progress: Progress, note: string | null) => {
    dock.remove()
    delete document.body.dataset.story
    ctx.onDone(progress, note)
  }

  const config: Greenhouse2Config = {
    areas: { ...(ctx.progress.greenhouse2?.config.areas ?? DEFAULT_GREENHOUSE_2_CONFIG.areas) },
    lightingMode:
      ctx.progress.greenhouse2?.config.lightingMode ?? DEFAULT_GREENHOUSE_2_CONFIG.lightingMode,
    chillerMode:
      ctx.progress.greenhouse2?.config.chillerMode ?? DEFAULT_GREENHOUSE_2_CONFIG.chillerMode,
  }

  const steps = greenhouse2Steps(
    config,
    () => dock.refresh(),
    () => {
      const y = computeGreenhouse2Yield(config, ctx.progress.cargo2, firstBase)
      const next = recordGreenhouse2(MISSIONS, ctx.progress, {
        config: { ...config, areas: { ...config.areas } },
        yield: { ...y },
      })
      end(
        next,
        saved(
          ctx,
          next,
          `50 m² Greenhouse expansion commissioned: ${y.kcalPerDay.toLocaleString()} kcal/day (${(y.foodShareCrew * 100).toFixed(0)}% caloric closure). Mission 2.3 is done.`,
        ),
      )
    },
    ctx.progress.cargo2,
    firstBase,
  )

  const dock = openDock({
    missionTitle: title,
    steps,
    status: () => {
      const y = computeGreenhouse2Yield(config, ctx.progress.cargo2, firstBase)
      return el(
        'div',
        { className: 'dock-wake-status' },
        el('span', {
          className: 'wake-pill',
          textContent: `${y.kcalPerDay.toLocaleString()} kcal/day · ${(y.foodShareCrew * 100).toFixed(0)}% cal · ${y.waterRecoveryPct.toFixed(0)}% H2O rec`,
        }),
      )
    },
    onFinish: () => undefined,
    onLeave: () => end(ctx.progress, null),
  })
}

function playWater2(title: string, ctx: Play): void {
  document.body.dataset.story = 'mission'
  ctx.services.showGlobe()

  const end = (progress: Progress, note: string | null) => {
    dock.remove()
    delete document.body.dataset.story
    ctx.onDone(progress, note)
  }

  const config: IceMiningConfig = {
    architecture:
      ctx.progress.water2?.config.architecture ?? DEFAULT_ICE_MINING_CONFIG.architecture,
    dailyDutyHours:
      ctx.progress.water2?.config.dailyDutyHours ?? DEFAULT_ICE_MINING_CONFIG.dailyDutyHours,
    purification: {
      ...(ctx.progress.water2?.config.purification ?? DEFAULT_ICE_MINING_CONFIG.purification),
    },
  }

  const steps = iceMiningSteps(
    config,
    () => dock.refresh(),
    () => {
      const y = computeIceMiningYield(config, ctx.progress.cargo2)
      const next = recordWater2(MISSIONS, ctx.progress, {
        config: { ...config, purification: { ...config.purification } },
        yield: { ...y },
      })
      end(
        next,
        saved(
          ctx,
          next,
          `Industrial ice mining commissioned: ${y.dailyPotableWaterKg.toFixed(0)} kg/sol, 5,000 kg buffer full at Sol ${y.daysToFill5tBuffer.toFixed(0)}. Mission 2.4 is done.`,
        ),
      )
    },
    ctx.progress.cargo2,
  )

  const dock = openDock({
    missionTitle: title,
    steps,
    status: () => {
      const y = computeIceMiningYield(config, ctx.progress.cargo2)
      return el(
        'div',
        { className: 'dock-wake-status' },
        el('span', {
          className: 'wake-pill',
          textContent: `${y.dailyPotableWaterKg.toFixed(0)} kg/sol · Sol ${y.daysToFill5tBuffer.toFixed(0)} buffer fill`,
        }),
      )
    },
    onFinish: () => undefined,
    onLeave: () => end(ctx.progress, null),
  })
}

function playCave2(title: string, ctx: Play): void {
  document.body.dataset.story = 'mission'
  ctx.services.showGlobe()

  const end = (progress: Progress, note: string | null) => {
    dock.remove()
    delete document.body.dataset.story
    ctx.onDone(progress, note)
  }

  const config: CaveScoutConfig = {
    entranceVector:
      ctx.progress.cave2?.config.entranceVector ?? DEFAULT_CAVE_SCOUT_CONFIG.entranceVector,
    droneDescentDepthM:
      ctx.progress.cave2?.config.droneDescentDepthM ?? DEFAULT_CAVE_SCOUT_CONFIG.droneDescentDepthM,
    radarFrequencyMhz:
      ctx.progress.cave2?.config.radarFrequencyMhz ?? DEFAULT_CAVE_SCOUT_CONFIG.radarFrequencyMhz,
  }

  const steps = caveScoutingSteps(
    config,
    () => dock.refresh(),
    () => {
      const y = computeCaveScoutYield(config, ctx.progress.cargo2)
      const next = recordCave2(MISSIONS, ctx.progress, {
        config: { ...config },
        yield: { ...y },
      })
      end(
        next,
        saved(
          ctx,
          next,
          'Subterranean lava tube certified as permanent sanctuary. 97% cosmic radiation reduction confirmed. Mission 2.5 is done.',
        ),
      )
    },
    ctx.progress.cargo2,
  )

  const dock = openDock({
    missionTitle: title,
    steps,
    status: () => {
      const y = computeCaveScoutYield(config, ctx.progress.cargo2)
      return el(
        'div',
        { className: 'dock-wake-status' },
        el('span', {
          className: 'wake-pill',
          textContent: `${y.tubeWidthM}m wide · ${y.roofThicknessM}m roof · ${y.radiationReductionPct.toFixed(0)}% shielded`,
        }),
      )
    },
    onFinish: () => undefined,
    onLeave: () => end(ctx.progress, null),
  })
}

function playSample2(title: string, ctx: Play): void {
  document.body.dataset.story = 'mission'
  ctx.services.showGlobe()

  const end = (progress: Progress, note: string | null) => {
    dock.remove()
    delete document.body.dataset.story
    ctx.onDone(progress, note)
  }

  const selection: SampleCampaignSelection = {
    ...(ctx.progress.sample2?.selection ?? DEFAULT_SAMPLE_SELECTION),
  }

  const steps = sampleCampaignSteps(
    selection,
    () => dock.refresh(),
    () => {
      const y = computeSampleCampaignYield(selection, ctx.progress.cargo2)
      const next = recordSample2(MISSIONS, ctx.progress, {
        selection: { ...selection },
        yield: { ...y },
      })
      end(
        next,
        saved(
          ctx,
          next,
          `Sample return campaign commissioned: ${y.totalMassKg.toFixed(1)} kg of pristine Martian specimens (${y.totalScienceScore} science points across ${y.disciplinesCovered.length} disciplines) stowed in MAV. Category V planetary protection secured. Expedition 2 is complete!`,
        ),
      )
    },
    ctx.progress.cargo2,
  )

  const dock = openDock({
    missionTitle: title,
    steps,
    status: () => {
      const y = computeSampleCampaignYield(selection, ctx.progress.cargo2)
      const statusPillClass = y.readyToSeal ? 'pass' : 'warning'
      return el(
        'div',
        { className: 'dock-wake-status' },
        el('span', {
          className: `wake-pill ${statusPillClass}`,
          textContent: `${y.totalMassKg.toFixed(1)}/15.0 kg · ${y.totalScienceScore} pts · ${y.disciplinesCovered.length} fields`,
        }),
      )
    },
    onFinish: () => undefined,
    onLeave: () => end(ctx.progress, null),
  })
}

function playReturn2(title: string, ctx: Play): void {
  document.body.dataset.story = 'mission'
  ctx.services.showGlobe()

  const end = (progress: Progress, note: string | null) => {
    dock.remove()
    delete document.body.dataset.story
    ctx.onDone(progress, note)
  }

  const config: BaseHibernationConfig = {
    powerGridMode:
      ctx.progress.return2?.config.powerGridMode ?? DEFAULT_HIBERNATION_CONFIG.powerGridMode,
    waterTankHeatersActive:
      ctx.progress.return2?.config.waterTankHeatersActive ??
      DEFAULT_HIBERNATION_CONFIG.waterTankHeatersActive,
    greenhousePreservation:
      ctx.progress.return2?.config.greenhousePreservation ??
      DEFAULT_HIBERNATION_CONFIG.greenhousePreservation,
    caveRelayBeaconActive:
      ctx.progress.return2?.config.caveRelayBeaconActive ??
      DEFAULT_HIBERNATION_CONFIG.caveRelayBeaconActive,
  }

  const mav: MavPreflightChecks = {
    sampleCanisterLocked:
      ctx.progress.return2?.mav.sampleCanisterLocked ?? DEFAULT_MAV_CHECKS.sampleCanisterLocked,
    isruPropellantPressurized:
      ctx.progress.return2?.mav.isruPropellantPressurized ??
      DEFAULT_MAV_CHECKS.isruPropellantPressurized,
    flightComputerAligned:
      ctx.progress.return2?.mav.flightComputerAligned ?? DEFAULT_MAV_CHECKS.flightComputerAligned,
  }

  const steps = return2Steps(
    config,
    mav,
    () => dock.refresh(),
    () => dock.refresh(),
    () => {
      const d = computeReturn2Debrief(config, mav, ctx.progress)
      const next = recordReturn2(MISSIONS, ctx.progress, {
        config: { ...config },
        mav: { ...mav },
        debrief: { ...d },
      })
      end(
        next,
        saved(
          ctx,
          next,
          `Expedition 2 is over. Outpost safely hibernating, 5,000 kg water secured, Arsia Mons lava tube certified, and 15 kg of Martian samples en route to Earth. Base handed over to Expedition 3: Toward Permanence!`,
        ),
      )
    },
    ctx.progress,
  )

  const dock = openDock({
    missionTitle: title,
    steps,
    status: () => {
      const d = computeReturn2Debrief(config, mav, ctx.progress)
      const statusPillClass = d.success ? 'pass' : 'warning'
      return el(
        'div',
        { className: 'dock-wake-status' },
        el('span', {
          className: `wake-pill ${statusPillClass}`,
          textContent: `${d.waterBufferSecuredKg} kg water · ${d.radiationTotalMsv} mSv · ${d.expedition2TotalScience} sci pts`,
        }),
      )
    },
    onFinish: () => undefined,
    onLeave: () => end(ctx.progress, null),
  })
}
