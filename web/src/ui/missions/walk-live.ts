/**
 * Mission 1.5's walk as it happens. Two crew walk the planned route with the wrist console; two
 * stay in the habitat as the base crew, whose panel (the dock) has the map tools of Plan mode,
 * the weather, and two ways to reach the walkers: a storm warning and a marked hazard.
 */
import type { Site } from '../../core/elevation'
import { EVA_LIMITS } from '../../core/eva-card'
import { slopeDegAt } from '../../core/eva-telemetry'
import { formatDistance, formatDuration } from '../../core/format'
import { type Cell, type Grid, cellToLonLat, lonLatToCell } from '../../core/grid'
import { HAZARD_RADIUS_M } from '../../core/hazards'
import { localMeanSolarTimeHours, nextLocalHourMs, solarLongitudeDeg } from '../../core/mars-time'
import { walkDoseMsv } from '../../core/marswalk'
import { rangeRaster, walkRange } from '../../core/range'
import { DEFAULT_SUIT_FACTOR, stepTimeS } from '../../core/route'
import { distanceKm } from '../../core/site-report'
import { type SiteId, surfaceConditions } from '../../core/surface-conditions'
import { oxygenLeftShare, powerLeftShare } from '../../core/suit-model'
import { sightRaster } from '../../core/viewshed'
import { type WalkReadings, walkAlerts } from '../../core/walk-alerts'
import { type SimPlan, advance, extendStay, startSim, turnBack } from '../../core/walk-sim'
import { bearingRad } from '../../core/terrain-line'
import type { BasePlacer } from '../../map/base-placer'
import type { WalkMap } from '../../map/marswalk-map'
import { el } from '../dom'
import type { Tile } from '../eva-dashboard'
import { mountHaulTool } from '../haul-tool'
import { mountStormTool } from '../storm-tool'
import { EXTRA_STAY_MIN, openStoryWrist, routeMinimap } from '../story-wrist'
import { mountSunTool } from '../sun-tool'
import type { Stop } from './science-cards'
import type { Task } from './walk-briefing'

export type LiveWalk = {
  siteId: string
  grid: Grid
  home: { lon: number; lat: number }
  homeCell: Cell
  path: Cell[]
  stopIndices: number[]
  stops: Stop[]
  stayMin: number
  /** Seconds of the fastest walk home from every point of the path. */
  homeS: number[]
  /** The planned clock (minutes) at every point of the path. */
  plannedMin: number[]
  tasks: Task[]
  /** When sol 1 starts (UTC ms); the walk begins at 09:00 local time after it. */
  sol1Utc: Promise<number>
}

export type LiveMap = { walk: WalkMap; base: BasePlacer }

const WALK_PLAYS_S = 45 // the whole planned walk plays in about this many seconds
const WALK_START_LOCAL_H = 9 // team choice: the first walk starts at 09:00 local time
const DEFAULT_WARNING_MIN = 60
const CONDITION_SITES: readonly SiteId[] = ['gale', 'jezero']

const hm = (min: number) => formatDuration(Math.max(0, min))
const pct = (share: number) => `${Math.round(share * 100)}%`
const toneOf = (share: number) => (share < 0.25 ? 'bad' : share < 0.4 ? 'warn' : 'ok')

export function startLiveWalk(
  w: LiveWalk,
  map: LiveMap,
  onDoneChange: (done: boolean) => void,
): { panel: HTMLElement; stop: () => void; done: () => boolean } {
  const { grid } = w
  const lonLat = (c: Cell) => cellToLonLat(grid, c)
  const stepLength = (a: Cell, b: Cell) =>
    grid.pixelSizeM * (a.row !== b.row && a.col !== b.col ? Math.SQRT2 : 1)
  // The route being walked. Turning back replaces it from the crew's position onwards.
  let path = w.path
  let homeS = w.homeS
  let simPlan: SimPlan = { stepMin: [], stopIndices: w.stopIndices, stayMin: w.stayMin }
  let along: number[] = [] // distance along the path at every point, for "hazard ahead"
  const setRoute = (next: Cell[], nextHomeS: number[], stopIndices: number[]) => {
    path = next
    homeS = nextHomeS
    simPlan = {
      stepMin: next
        .slice(1)
        .map((c, i) => stepTimeS(grid, next[i] as Cell, c, DEFAULT_SUIT_FACTOR) / 60),
      stopIndices,
      stayMin: w.stayMin,
    }
    along = [0]
    for (let i = 1; i < next.length; i++)
      along.push((along[i - 1] ?? 0) + stepLength(next[i - 1] as Cell, next[i] as Cell))
  }
  setRoute(w.path, w.homeS, w.stopIndices)
  let turnedBack = false
  const totalMin = w.plannedMin.at(-1) ?? 1
  const simMinPerS = Math.max(totalMin / WALK_PLAYS_S, 0.5)

  let sim = startSim()
  let pace = 1
  let paused = false
  let follow = true
  let storm: { warningMin: number; issuedAtMin: number } | null = null
  const hazards: Cell[] = []
  const messages: string[] = [
    'Base crew: radio check good. We are watching your suits and the weather.',
  ]
  let walkStartUtc: number | null = null
  void w.sol1Utc.then((t) => (walkStartUtc = nextLocalHourMs(t, w.home.lon, WALK_START_LOCAL_H)))
  const say = (m: string) => {
    messages.unshift(`Base crew: ${m}`)
    messages.length = Math.min(messages.length, 4)
  }

  const wrist = openStoryWrist(w.tasks, {
    onPause: (p) => (paused = p),
    onPace: (p) => (pace = p),
    onStayLonger: () => {
      sim = extendStay(sim, EXTRA_STAY_MIN)
      say(`copy, you are staying ${EXTRA_STAY_MIN} min longer. Watch your spare time.`)
    },
    onTurnBack: () => {
      if (turnedBack || sim.done) return
      turnedBack = true
      const from = path[sim.index] as Cell
      say('copy, you are turning back. Taking the quickest safe way home.')
      void map.walk
        .client(grid)
        .route([from, w.homeCell])
        .then((reply) => {
          if (reply.type !== 'route' || !reply.path) {
            say('no safe way home found from there: retrace your steps.')
            return
          }
          const leg = reply.path
          // Walking time home from each point of the way back, summed from the end.
          const legHomeS = leg.map(() => 0)
          for (let k = leg.length - 2; k >= 0; k--)
            legHomeS[k] =
              (legHomeS[k + 1] ?? 0) +
              stepTimeS(grid, leg[k] as Cell, leg[k + 1] as Cell, DEFAULT_SUIT_FACTOR)
          const t = turnBack(sim, simPlan.stopIndices)
          sim = t.state
          setRoute(
            [...path.slice(0, sim.index), ...leg],
            [...homeS.slice(0, sim.index), ...legHomeS],
            t.stopIndices,
          )
          map.walk.layer(grid).setPath(path)
        })
    },
    onExit: () => {
      paused = true
    },
  })

  // --- Base crew panel (the dock) --------------------------------------------------------------
  const suits = el('dl', { className: 'zone-facts base-suits' })
  const weather = el('dl', { className: 'zone-facts' })
  const weatherNote = el('p', { className: 'rule-source' })
  const actions = el('div', { className: 'route-actions base-tools' })
  const notes = el('div', { className: 'base-notes' })
  const button = (label: string, run: (b: HTMLButtonElement) => void) => {
    const b = el('button', { type: 'button', className: 'quiet', textContent: label })
    b.setAttribute('aria-pressed', 'false')
    b.addEventListener('click', () => run(b))
    actions.append(b)
    return b
  }
  const toggleOverlay =
    (kind: 'range' | 'sight', make: () => Promise<Uint8ClampedArray | null>) =>
    (b: HTMLButtonElement) => {
      const on = b.getAttribute('aria-pressed') !== 'true'
      b.setAttribute('aria-pressed', String(on))
      const layer = map.walk.overlay(grid, kind)
      void (on ? make().then((px) => layer.setRaster(px)) : layer.setRaster(null))
    }
  button(
    'Walking range',
    toggleOverlay('range', async () => {
      const r = await map.walk.client(grid).range(w.homeCell)
      return r.type === 'range'
        ? rangeRaster(grid.width, grid.height, walkRange(r.outS, r.backS))
        : null
    }),
  )
  button(
    'Line of sight',
    toggleOverlay('sight', async () => {
      const r = await map.walk.client(grid).sight(w.homeCell)
      return r.type === 'sight' ? sightRaster(grid.width, grid.height, r.visible) : null
    }),
  )
  const site: Site = { id: w.siteId, name: w.siteId, rover: '', source: '', grid }
  mountSunTool(actions, notes, {
    siteNow: () => site,
    client: () => map.walk.client(grid),
    overlay: () => map.walk.overlay(grid, 'sun'),
    nowMs: () => (walkStartUtc ?? Date.now()) + sim.elapsedMin * 60_000,
  })
  const storms = mountStormTool(actions, notes, () => {
    const [lon, lat] = lonLat(path[sim.index] as Cell)
    return { lon, lat, homeMin: (homeS[sim.index] ?? 0) / 60, where: 'where the crew are now' }
  })
  button('Mark hazard', (b) => {
    b.setAttribute('aria-pressed', 'true')
    say('click the map where the hazard is.')
    map.base.pick((p) => {
      b.setAttribute('aria-pressed', 'false')
      const cell = lonLatToCell(grid, p.lon, p.lat)
      if (!cell) return
      hazards.push(cell)
      map.walk.layer(grid).setHazards(hazards)
      say(
        `hazard marked at ${p.lat.toFixed(4)}°, ${p.lon.toFixed(4)}°. Keep ${HAZARD_RADIUS_M} m clear.`,
      )
    })
  })
  mountHaulTool(actions, notes, {
    ends: () => ({
      from: w.homeCell,
      to: path[w.stopIndices.at(-1) ?? 0] as Cell,
      hazards,
      client: map.walk.client(grid),
      layer: map.walk.layer(grid),
    }),
  })
  const warnMin = el('input', {
    type: 'number',
    min: '5',
    max: '600',
    step: '5',
    value: String(DEFAULT_WARNING_MIN),
    id: 'drill-min',
  })
  const send = el('button', {
    type: 'button',
    className: 'gate-secondary',
    textContent: 'Send storm warning to the walkers',
  })
  send.addEventListener('click', () => {
    storm = {
      warningMin: Number(warnMin.value) || DEFAULT_WARNING_MIN,
      issuedAtMin: sim.elapsedMin,
    }
    say(`DRILL: dust storm warning, about ${hm(storm.warningMin)} out. Head home now.`)
  })
  const followBox = el('input', { type: 'checkbox', checked: true, id: 'walk-follow' })
  followBox.addEventListener('change', () => {
    follow = followBox.checked
    if (!follow) map.walk.release()
  })
  const panel = el(
    'div',
    { className: 'site-step base-crew' },
    el('p', {
      className: 'dock-note',
      textContent:
        'You are the base crew: two people in the habitat. The walkers see their own console at the bottom of the screen.',
    }),
    el('h3', { className: 'feature-heading', textContent: 'Walkers’ suits' }),
    suits,
    el('h3', { className: 'feature-heading', textContent: 'Weather at the base' }),
    weather,
    weatherNote,
    el('h3', { className: 'feature-heading', textContent: 'Map tools' }),
    actions,
    notes,
    el('h3', { className: 'feature-heading', textContent: 'Storm drill' }),
    el(
      'p',
      { className: 'walk-stay' },
      el('label', { htmlFor: 'drill-min', textContent: 'Minutes of warning (your scenario): ' }),
      warnMin,
    ),
    send,
    el(
      'p',
      { className: 'walk-stay' },
      followBox,
      el('label', { htmlFor: 'walk-follow', textContent: ' Camera follows the walkers' }),
    ),
  )

  // --- The loop ----------------------------------------------------------------------------------
  const tiles = (into: HTMLElement, list: Tile[]) =>
    into.replaceChildren(
      ...list.map((t) => {
        const box = el(
          'div',
          {},
          el('dt', { textContent: t.label }),
          el('dd', { textContent: t.value }),
        )
        if (t.tone) box.dataset.tone = t.tone
        return box
      }),
    )
  let last = performance.now()
  let frame = 0
  let wasDone = false
  const tick = (now: number) => {
    const dt = Math.min((now - last) / 1000, 1) // a background tab must not jump the walk
    last = now
    if (!paused && !sim.done) sim = advance(sim, dt * simMinPerS, simPlan, pace)
    const i = Math.min(sim.index, path.length - 1)
    const a = path[i] as Cell
    const b = path[Math.min(i + 1, path.length - 1)] as Cell
    const [lon0, lat0] = lonLat(a)
    const [lon1, lat1] = lonLat(b)
    const lon = lon0 + (lon1 - lon0) * sim.fraction
    const lat = lat0 + (lat1 - lat0) * sim.fraction
    const heading = (bearingRad([lon0, lat0], [lon1, lat1]) * 180) / Math.PI
    map.walk.crew(lon, lat, heading, follow)

    const homeMin = (homeS[i] ?? 0) / 60
    const budget = EVA_LIMITS.maxEvaMin - EVA_LIMITS.backupMin
    const spareMin = budget - sim.elapsedMin - homeMin * (1 + EVA_LIMITS.walkbackPad)
    const planned =
      (w.plannedMin[i] ?? 0) +
      ((w.plannedMin[i + 1] ?? w.plannedMin[i] ?? 0) - (w.plannedMin[i] ?? 0)) * sim.fraction
    const o2 = oxygenLeftShare(sim.walkMin, sim.workMin)
    const power = powerLeftShare(sim.elapsedMin)
    const slope = slopeDegAt(grid, a)
    const hazardAhead = hazards
      .map((h) => {
        const k = path.findIndex(
          (c, n) =>
            n >= i && Math.hypot(c.row - h.row, c.col - h.col) * grid.pixelSizeM <= HAZARD_RADIUS_M,
        )
        return k < 0 ? null : (along[k] ?? 0) - (along[i] ?? 0)
      })
      .filter((d): d is number => d !== null)
    const readings: WalkReadings = {
      spareMin,
      o2Share: o2,
      powerShare: power,
      slopeDeg: slope,
      limitDeg: grid.maxSafeSlopeDeg,
      behindPlanMin: turnedBack ? 0 : sim.elapsedMin - planned,
      storm: storm
        ? {
            minutesLeft: storm.warningMin - (sim.elapsedMin - storm.issuedAtMin),
            homeMin: homeMin * (1 + EVA_LIMITS.walkbackPad),
          }
        : null,
      hazardAheadM: hazardAhead.length ? Math.min(...hazardAhead) : null,
    }
    const alerts = sim.done ? [] : walkAlerts(readings)

    const stepKmh =
      sim.stayLeftMin > 0 || sim.done
        ? 0
        : (grid.pixelSizeM * (a.row !== b.row && a.col !== b.col ? Math.SQRT2 : 1)) /
          1000 /
          ((simPlan.stepMin[i] ?? 1) / pace / 60)
    const homeKm = distanceKm(lon, lat, w.home.lon, w.home.lat)
    const current = w.stopIndices.findIndex(
      (k) => simPlan.stopIndices.includes(k) && k >= i && (k > i || sim.stayLeftMin > 0),
    )
    const working = sim.stayLeftMin > 0 ? w.stops[w.stopIndices.indexOf(i)] : undefined
    const nextStop = current >= 0 ? w.stops[current] : undefined
    const phase = sim.done
      ? 'Back in the airlock'
      : working
        ? `Working at ${working.name}: ${hm(sim.stayLeftMin)} left`
        : nextStop
          ? `Walking to ${nextStop.name}`
          : 'Walking home'
    const critical: Tile[] = [
      {
        label: 'Spare time',
        value: spareMin < 0 ? `−${hm(-spareMin)}` : hm(spareMin),
        tone: spareMin < 0 ? 'bad' : spareMin < 30 ? 'warn' : 'ok',
      },
      {
        label: 'Oxygen',
        value: pct(o2),
        tone: toneOf(o2),
        hint: 'Model: Apollo metabolic rates and an 8 h suit',
      },
      {
        label: 'Battery',
        value: pct(power),
        tone: toneOf(power),
        hint: 'Model: steady drain over the 8 h suit rating',
      },
      { label: 'Home', value: `${hm(homeMin)} · ${formatDistance(homeKm * 1000)}` },
      {
        label: 'Slope',
        value: slope === null ? '—' : `${slope.toFixed(0)}°`,
        tone:
          slope !== null && slope > grid.maxSafeSlopeDeg
            ? 'bad'
            : slope !== null && slope > grid.maxSafeSlopeDeg - 3
              ? 'warn'
              : 'ok',
      },
      { label: 'Pace', value: `${stepKmh.toFixed(1)} km/h` },
    ]

    // Weather at the base, for the walk's time: seasonal climatology (no station reads 2033).
    let conditions: Tile[] = [{ label: 'Weather', value: 'Loading…' }]
    if (walkStartUtc !== null && CONDITION_SITES.includes(w.siteId as SiteId)) {
      const utc = walkStartUtc + sim.elapsedMin * 60_000
      const c = surfaceConditions({
        utcMs: utc,
        ls: solarLongitudeDeg(utc),
        lmstHours: localMeanSolarTimeHours(utc, w.home.lon),
        site: w.siteId as SiteId,
        sols: [],
      })
      conditions = [
        { label: 'Sky', value: c.sky },
        { label: 'Wind', value: `${c.windMs.toFixed(0)} m/s` },
        { label: 'Air', value: `${c.airTempC.toFixed(0)} °C` },
        { label: 'Visibility', value: `${c.visibilityKm.toFixed(0)} km` },
      ]
      weatherNote.textContent = `Source: ${c.source}. The walk starts at 09:00 local time (team choice).`
    } else if (walkStartUtc !== null) {
      conditions = [{ label: 'Weather', value: 'No climate record for this site' }]
    }

    const clock = `${hm(sim.elapsedMin)} outside · plan ${hm(totalMin)} · ${walkDoseMsv(sim.elapsedMin).toFixed(2)} mSv`
    wrist.update({
      phase,
      clock,
      critical,
      alerts,
      stops: w.stops.map((s, k) => {
        const at = w.stopIndices[k] ?? 0
        const done = sim.stayed.includes(at) && !(at === i && sim.stayLeftMin > 0)
        return {
          name: s.name,
          current: k === current,
          status: !simPlan.stopIndices.includes(at)
            ? 'skipped: the crew turned back'
            : done
              ? 'done'
              : at === i && sim.stayLeftMin > 0
                ? `working, ${hm(sim.stayLeftMin)} left`
                : `planned arrival ${hm(w.plannedMin[at] ?? 0)}`,
        }
      }),
      minimap: routeMinimap(
        path,
        a,
        w.stopIndices[current] !== undefined
          ? (path[w.stopIndices[current] as number] as Cell)
          : w.homeCell,
      ),
      conditions,
      messages,
      atStop: sim.stayLeftMin > 0,
    })
    tiles(suits, [...critical.slice(0, 4), { label: 'Doing', value: phase }])
    tiles(weather, conditions)
    if (sim.done !== wasDone) {
      wasDone = sim.done
      if (sim.done) say('welcome back. Walk logged.')
      onDoneChange(sim.done)
    }
    frame = requestAnimationFrame(tick)
  }
  frame = requestAnimationFrame(tick)
  void storms // the cover check refreshes itself when the base crew open it

  return {
    panel,
    stop: () => {
      cancelAnimationFrame(frame)
      map.base.pick(null)
      map.walk.release()
      wrist.close()
    },
    done: () => sim.done,
  }
}
