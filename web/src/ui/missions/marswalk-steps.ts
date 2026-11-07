/**
 * Mission 1.5 as guided steps: learn the Marswalk rules, choose science stops near the base (known
 * places or any points on the map), read the GO / NO-GO card, then watch the crew walk it.
 */
import { raiseAlarm } from '../no-go'
import { CAREER_LIMIT_MSV } from '../../core/dose'
import { EVA_LIMITS, type EvaCard, evaCard } from '../../core/eva-card'
import { formatDistance, formatDuration } from '../../core/format'
import { type Cell, type Grid, cellToLonLat, lonLatToCell } from '../../core/grid'
import type { LonLat } from '../../core/base-layout'
import type { Marswalk } from '../../core/mission-progress'
import { nearbyStops, walkClock, walkDoseMsv } from '../../core/marswalk'
import { MAX_SUIT_SPEED_KMH } from '../../core/route'
import type { SiteFeature } from '../../core/site-features'
import { summarizeRoute } from '../../core/summary'
import type { BasePlacer } from '../../map/base-placer'
import type { FeaturePins } from '../../map/feature-pins'
import type { WalkMap } from '../../map/marswalk-map'
import { el } from '../dom'
import type { MissionReport } from '../../core/mission-reports'
import { warningsFor } from '../lessons'
import type { DockStep } from '../mission-dock'
import { type Stop, scienceCards } from './science-cards'
import { type WalkTasks, briefing, makeTasks } from './walk-briefing'
import { startLiveWalk } from './walk-live'

export type MarswalkMap = { pins: FeaturePins; base: BasePlacer; walk: WalkMap }

const SUGGESTED = 6
const STAY_CHOICES_MIN = [30, 60, 90, 120]
const DEFAULT_STAY_MIN = 60

type Planned = {
  stops: Stop[]
  path: Cell[]
  /** Path index of each stop, in walking order. */
  stopIndices: number[]
  card: EvaCard
  /** Seconds of the fastest walk home from each point of the walk out. */
  homeS: number[]
  /** The same for every point of the whole path, home included. */
  pathHomeS: number[]
  /** Walking there, the stay and walking home, unpadded. */
  totalMin: number
  distanceM: number
}

const hm = (min: number) => formatDuration(Math.max(0, min))

/** The 8 hours outside as one bar: walk out, stay, walk home, its 20% pad, spare, reserve. */
function evaBar(parts: Array<{ label: string; min: number; kind: string }>): HTMLElement {
  const total = EVA_LIMITS.maxEvaMin
  return el(
    'div',
    {
      className: 'eva-bar',
      role: 'img',
      ariaLabel: parts.map((p) => `${p.label} ${hm(p.min)}`).join(', '),
    },
    ...parts
      .filter((p) => p.min > 0)
      .map((p) => {
        const seg = el(
          'span',
          { className: `eva-seg ${p.kind}` },
          el('span', { className: 'eva-seg-label', textContent: `${p.label} · ${hm(p.min)}` }),
        )
        seg.style.flexGrow = String(p.min / total)
        return seg
      }),
  )
}

export function marswalkSteps(
  siteId: string,
  grid: Grid,
  home: LonLat,
  features: readonly SiteFeature[],
  map: MarswalkMap,
  /** When sol 1 starts: the crew's arrival on the route chosen in mission 1.1 (UTC ms). */
  sol1Utc: Promise<number>,
  onDone: (walk: Marswalk) => void,
  /** A suit ran out on the walk, this far from the airlock, on a walk planned this long (m). */
  onSuitOut: (distanceM: number, plannedM: number) => void,
  reports: readonly MissionReport[],
): DockStep[] {
  const homeCell = lonLatToCell(grid, home.lon, home.lat)
  if (!homeCell) throw new Error('The habitat is outside the mapped terrain')
  const suggested: Stop[] = nearbyStops(features, home, grid, SUGGESTED).map((f) => ({
    name: f.name,
    lon: f.lon,
    lat: f.lat,
    feature: f,
  }))
  let stayMin = DEFAULT_STAY_MIN
  let chosen: Stop[] = []
  let own: Stop[] = []
  let planned: Planned | null = null
  let tasks: WalkTasks = makeTasks([])
  let tasksFor = ''
  let planning = 0
  const status = el('p', { className: 'dock-note', ariaLive: 'polite' })

  /** Route out through every stop in order and back home, and judge it with the EVA card. */
  const plan = async (stops: readonly Stop[]): Promise<Planned | string> => {
    const cells: Cell[] = []
    for (const stop of stops) {
      const cell = lonLatToCell(grid, stop.lon, stop.lat)
      if (!cell) return `${stop.name} is outside the mapped terrain.`
      cells.push(cell)
    }
    const reply = await map.walk.client(grid).route([homeCell, ...cells, homeCell])
    if (reply.type === 'error') return reply.message
    if (!reply.path || !reply.homeS) {
      const leg = reply.failedLeg ?? 0
      const where = leg < stops.length ? (stops[leg]?.name ?? 'a stop') : 'home'
      return `No safe walking route reaches ${where}: every way crosses ground steeper than ${grid.maxSafeSlopeDeg}°.`
    }
    const path = reply.path
    let from = 1
    const stopIndices = cells.map((cell) => {
      const k = path.findIndex((c, n) => n >= from && c.row === cell.row && c.col === cell.col)
      from = k + 1
      return k
    })
    const last = stopIndices.at(-1) ?? 0
    const homeS = reply.homeS.slice(0, last + 1)
    const card = evaCard(grid, path.slice(0, last + 1), [homeCell, ...cells], {
      homeS,
      stopMin: stayMin,
    })
    return {
      stops: [...stops],
      path,
      stopIndices,
      card,
      homeS,
      pathHomeS: reply.homeS,
      totalMin: card.evaMin + card.walkbackMin,
      distanceM: summarizeRoute(grid, path).distanceM,
    }
  }

  /** Plan the chosen stops again and draw the result; a newer change wins over an older one. */
  const replan = async (refresh: () => void) => {
    planned = null
    const id = ++planning
    const layer = map.walk.layer(grid)
    refresh()
    if (!chosen.length) {
      status.textContent = 'Add one or more stops to plan the walk.'
      layer.setPath(null)
      layer.setStops([])
      layer.setFail(null)
      return
    }
    status.textContent = `Finding the safest walk through ${chosen.length} stop${chosen.length > 1 ? 's' : ''}…`
    const result = await plan(chosen)
    if (id !== planning) return
    if (typeof result === 'string') {
      status.textContent = result
      layer.setPath(null)
      return
    }
    planned = result
    const key = result.stops.map((x) => x.name).join('|')
    if (key !== tasksFor) [tasks, tasksFor] = [makeTasks(result.stops), key] // new stops, new lists
    layer.setStops([homeCell, ...result.stopIndices.map((k) => result.path[k] as Cell)])
    layer.setPath(result.path)
    map.walk.view(result.path.map((c) => cellToLonLat(grid, c)))
    layer.setFail(
      result.card.failIndex === null ? null : (result.path[result.card.failIndex] ?? null),
    )
    status.textContent = `${chosen.length} stop${chosen.length > 1 ? 's' : ''}: ${formatDistance(result.distanceM)} out and back, ${hm(result.totalMin)} outside.`
    refresh()
  }

  const rules: DockStep = {
    title: 'The rules of a Marswalk',
    why: 'A walk is GO only if, from every point on the way, the crew can still get home before their suits run out.',
    layout: 'map',
    render: () => {
      const rule = (term: string, value: string, source: string) =>
        el(
          'div',
          {},
          el('dt', { textContent: term }),
          el('dd', { textContent: value }),
          el('p', { className: 'rule-source', textContent: source }),
        )
      return el(
        'div',
        { className: 'site-step' },
        el(
          'dl',
          { className: 'zone-facts' },
          rule(
            'Time outside',
            `Up to ${EVA_LIMITS.maxEvaMin / 60} hours`,
            'NASA EVA-EXP-0075 (2020), the Artemis suit',
          ),
          rule('Kept in hand', `${EVA_LIMITS.backupMin / 60} hour`, 'Team assumption'),
          rule(
            'Walk home',
            `Counted ${EVA_LIMITS.walkbackPad * 100}% slower`,
            'Apollo’s walkback pad (Bellcomm, 1970)',
          ),
          rule(
            'Walking pace',
            `Up to ${MAX_SUIT_SPEED_KMH} km/h, slower on slopes`,
            'Apollo planning speed (Bellcomm, 1970); Tobler’s hiking function',
          ),
          rule(
            'Steepest ground',
            `${grid.maxSafeSlopeDeg}°`,
            'Team limit, stricter than the 20° NASA’s lunar suit is built for',
          ),
          rule(
            'Radiation',
            '0.64 mSv a day outside',
            'Curiosity RAD at Gale (Hassler et al. 2014)',
          ),
        ),
        el('h3', {
          className: 'chart-title',
          textContent: 'The 8 hours, as the card will judge them',
        }),
        evaBar([
          { label: 'Walk out', min: 120, kind: 'out' },
          { label: 'Science stop', min: 60, kind: 'stay' },
          { label: 'Walk home', min: 120, kind: 'back' },
          { label: '+20%', min: 24, kind: 'pad' },
          { label: 'Spare', min: 96, kind: 'spare' },
          { label: 'Reserve', min: EVA_LIMITS.backupMin, kind: 'reserve' },
        ]),
        el('p', {
          className: 'dock-note',
          textContent: 'Example only. Your own walk fills this bar on the GO / NO-GO step.',
        }),
      )
    },
    onShow: () => {
      map.walk.clear()
      map.pins.show([], () => undefined)
      map.base.view(home)
    },
  }

  let refreshPick: () => void = () => undefined
  const toggle = (stop: Stop) => {
    chosen = chosen.includes(stop) ? chosen.filter((x) => x !== stop) : [...chosen, stop]
    void replan(refreshPick)
  }

  const pickStop: DockStep = {
    title: 'Choose science stops',
    why: 'Add the places the crew should study, in the order to visit them. More stops and steeper ground mean less time to spare.',
    layout: 'map',
    nextLabel: 'Check GO / NO-GO',
    render: () => {
      const root = el('div', { className: 'site-step' })
      const body = () => {
        const free = el('button', {
          type: 'button',
          className: 'gate-secondary',
          textContent: 'Add a point from the map',
        })
        free.addEventListener('click', () => {
          status.textContent = 'Click the ground where the crew should go.'
          map.base.pick((p) => {
            const point: Stop = { name: `Your point ${own.length + 1}`, ...p }
            own = [...own, point]
            toggle(point)
          })
        })
        const select = el('select', { id: 'walk-stay' })
        for (const m of STAY_CHOICES_MIN)
          select.append(
            el('option', { value: String(m), textContent: hm(m), selected: m === stayMin }),
          )
        select.addEventListener('change', () => {
          stayMin = Number(select.value)
          void replan(refreshPick)
        })
        return [
          el(
            'div',
            { className: 'walk-plan-bar' },
            el(
              'p',
              { className: 'walk-stay' },
              el('label', { htmlFor: 'walk-stay', textContent: 'Time at each stop: ' }),
              select,
            ),
            free,
          ),
          status,
          scienceCards({
            siteId,
            home,
            places: suggested,
            own,
            chosen,
            toggle,
            removeOwn: (s) => {
              own = own.filter((x) => x !== s)
              chosen = chosen.filter((x) => x !== s)
              void replan(refreshPick)
            },
          }),
        ]
      }
      refreshPick = () => root.replaceChildren(...body())
      refreshPick()
      return root
    },
    onShow: () => {
      map.pins.show(
        suggested.flatMap((s) => (s.feature ? [s.feature] : [])),
        (i) => {
          const s = suggested[i]
          if (s) toggle(s)
        },
      )
    },
    onHide: () => map.base.pick(null),
    onNext: () => {
      if (planned) return true
      raiseAlarm(
        'Not yet',
        chosen.length
          ? 'Wait for the route, or change the stops so a route exists.'
          : 'Add a stop first.',
        { level: 'wait', near: status },
      )
      return false
    },
  }

  const gate = el('p', { className: 'walk-gate', role: 'alert' })
  const verdict: DockStep = {
    title: 'Walk briefing: GO / NO-GO',
    why: 'The card checks every point of the walk out: could the crew turn round there and still be home in time? Then prepare the walk.',
    layout: 'map',
    nextLabel: 'Start the walk',
    render: () => {
      if (!planned) return el('p', { textContent: 'Choose a stop first.' })
      const p = planned
      const c = p.card
      const go = c.verdict === 'GO'
      const pad = c.walkbackMin * EVA_LIMITS.walkbackPad
      const spare = Math.max(0, c.budgetMin - c.evaMin - c.walkbackMin - pad)
      const dose = walkDoseMsv(p.totalMin)
      const failAt =
        c.failIndex === null ? 0 : summarizeRoute(grid, p.path.slice(0, c.failIndex + 1)).distanceM
      const help = el('div')
      if (!go) {
        const ask = el('button', {
          type: 'button',
          className: 'fd-ask',
          textContent: 'Stuck? Ask the Flight Director',
        })
        ask.addEventListener('click', () => void advise(p, help))
        help.append(ask)
      }
      return el(
        'div',
        { className: 'site-step' },
        el('p', {
          className: `walk-verdict ${go ? 'go' : 'nogo'}`,
          textContent: go ? 'GO' : 'NO-GO',
        }),
        warningsFor(reports, '1.5', { 'walk.distanceM': p.distanceM }),
        el('p', {
          textContent: go
            ? `Home with ${hm(c.tightestMarginMin)} to spare at the tightest point.`
            : `After ${formatDistance(failAt)} on the way out, the crew could no longer get home in time: ${hm(-c.tightestMarginMin)} short.`,
        }),
        evaBar([
          { label: 'Walk out', min: c.evaMin - stayMin * p.stops.length, kind: 'out' },
          {
            label: p.stops.length > 1 ? 'Science stops' : 'Science stop',
            min: stayMin * p.stops.length,
            kind: 'stay',
          },
          { label: 'Walk home', min: c.walkbackMin, kind: 'back' },
          { label: '+20%', min: pad, kind: 'pad' },
          { label: 'Spare', min: spare, kind: 'spare' },
          { label: 'Reserve', min: EVA_LIMITS.backupMin, kind: 'reserve' },
        ]),
        el(
          'dl',
          { className: 'zone-facts' },
          ...[
            [p.stops.length > 1 ? 'Stops' : 'Stop', p.stops.map((x) => x.name).join(' → ')],
            ['Out and back', formatDistance(p.distanceM)],
            ['Time outside', hm(p.totalMin)],
            [
              'Radiation',
              `${dose.toFixed(2)} mSv (${((dose / CAREER_LIMIT_MSV) * 100).toFixed(3)}% of NASA’s 600 mSv career limit)`,
            ],
          ].map(([t, v]) =>
            el('div', {}, el('dt', { textContent: t }), el('dd', { textContent: v })),
          ),
        ),
        help,
        ...(go
          ? [
              briefing(p.stops, tasks, () => {
                gate.textContent = ''
              }),
              gate,
            ]
          : []),
      )
    },
    onShow: () => {
      if (planned) map.walk.view(planned.path.map((c) => cellToLonLat(grid, c)))
    },
    onNext: () => {
      if (planned?.card.verdict !== 'GO') {
        raiseAlarm(
          'No-go',
          planned
            ? 'The route card says NO-GO. Change the stops until it reads GO.'
            : 'Plan a route first.',
          { near: gate },
        )
        return false
      }
      const open = tasks.before.filter((t) => !t.done).length
      gate.textContent = open
        ? `Tick the ${open} remaining item${open > 1 ? 's' : ''} under “Before the airlock opens” first.`
        : ''
      return open === 0
    },
  }

  /** Flight Director: only options that the same card passes, never a plan. */
  const advise = async (p: Planned, into: HTMLElement) => {
    into.replaceChildren(el('p', { className: 'fd-note', textContent: 'Checking options…' }))
    const options: string[] = []
    const last = p.stopIndices.at(-1) ?? 0
    const cells = p.stopIndices.map((k) => p.path[k] as Cell)
    for (const m of STAY_CHOICES_MIN.filter((m) => m < stayMin)) {
      const c = evaCard(grid, p.path.slice(0, last + 1), [homeCell, ...cells], {
        homeS: p.homeS,
        stopMin: m,
      })
      if (c.verdict === 'GO') options.push(`Stay ${hm(m)} at each stop instead of ${hm(stayMin)}.`)
    }
    // Dropping one stop: each shorter walk is planned and checked the same way.
    if (p.stops.length > 1)
      for (const drop of p.stops) {
        const r = await plan(p.stops.filter((x) => x !== drop))
        if (typeof r !== 'string' && r.card.verdict === 'GO')
          options.push(`Leave out ${drop.name} (${formatDistance(r.distanceM)} out and back).`)
      }
    for (const s of suggested.filter((s) => !p.stops.includes(s))) {
      const r = await plan([s])
      if (typeof r !== 'string' && r.card.verdict === 'GO')
        options.push(`Walk to ${s.name} alone (${formatDistance(r.distanceM)} out and back).`)
    }
    into.replaceChildren(
      el(
        'div',
        { className: 'fd-panel' },
        el('p', { className: 'fd-title', textContent: 'Flight Director' }),
        options.length
          ? el(
              'ul',
              { className: 'fd-options' },
              ...options.map((o) => el('li', { textContent: o })),
            )
          : el('p', {
              textContent:
                'No shorter stay, fewer stops or nearby stop passes. Try a closer point on the map.',
            }),
        el('p', {
          className: 'fd-note',
          textContent:
            'Each option passes the same card. The choice is yours: go back and change the walk.',
        }),
      ),
    )
  }

  let live: ReturnType<typeof startLiveWalk> | null = null
  const walk: DockStep = {
    title: 'The walk',
    why: 'Two crew walk with the wrist console; you are the two in the habitat. Watch their suits and the weather, and warn them if something changes.',
    layout: 'map',
    nextLabel: 'Finish: back in the airlock',
    render: () => {
      if (!planned) return el('p', { textContent: 'Choose a stop first.' })
      const p = planned
      live?.stop()
      live = startLiveWalk(
        {
          siteId,
          grid,
          home,
          homeCell,
          path: p.path,
          stopIndices: p.stopIndices,
          stops: p.stops,
          stayMin,
          homeS: p.pathHomeS,
          plannedMin: walkClock(grid, p.path, p.stopIndices, stayMin),
          tasks: tasks.onWalk,
          sol1Utc,
        },
        map,
        (done) => (finishNote.textContent = done ? '' : finishNote.textContent),
        (distanceM) => {
          live?.stop()
          live = null
          delete document.body.dataset.storyWalk
          map.walk.clear()
          onSuitOut(distanceM, p.distanceM)
        },
      )
      return el('div', {}, live.panel, finishNote)
    },
    onShow: () => {
      document.body.dataset.storyWalk = 'on' // narrow dock: the map and the wrist get the room
    },
    onHide: () => {
      live?.stop()
      live = null
      delete document.body.dataset.storyWalk
    },
    onNext: () => {
      const p = planned
      if (!p || !live) return false
      if (!live.done()) {
        raiseAlarm(
          'Not yet',
          'The crew are still outside. Finish when they are back in the airlock.',
          {
            level: 'wait',
            near: finishNote,
          },
        )
        return false
      }
      live.stop()
      live = null
      delete document.body.dataset.storyWalk
      map.walk.clear()
      onDone({
        stop: p.stops.map((x) => x.name).join(' → '),
        distanceM: Math.round(p.distanceM),
        evaMin: Math.round(p.totalMin),
        doseMsv: walkDoseMsv(p.totalMin),
      })
      return false
    },
  }
  const finishNote = el('p', { className: 'walk-gate', role: 'status' })

  return [rules, pickStop, verdict, walk]
}
