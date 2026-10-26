/**
 * Mission 1.5 as guided steps: learn the Marswalk rules, choose a science stop near the base (a
 * known place or any point on the map), read the GO / NO-GO card, then watch the crew walk it.
 */
import { CAREER_LIMIT_MSV } from '../../core/dose'
import { EVA_LIMITS, type EvaCard, evaCard } from '../../core/eva-card'
import { formatDistance, formatDuration } from '../../core/format'
import { type Cell, type Grid, cellToLonLat, lonLatToCell } from '../../core/grid'
import type { LonLat } from '../../core/base-layout'
import type { Marswalk } from '../../core/mission-progress'
import { nearbyStops, walkClock, walkDoseMsv } from '../../core/marswalk'
import { MAX_SUIT_SPEED_KMH } from '../../core/route'
import type { SiteFeature } from '../../core/site-features'
import { distanceKm } from '../../core/site-report'
import { summarizeRoute } from '../../core/summary'
import type { BasePlacer } from '../../map/base-placer'
import type { FeaturePins } from '../../map/feature-pins'
import type { WalkMap } from '../../map/marswalk-map'
import { el } from '../dom'
import type { DockStep } from '../mission-dock'

export type MarswalkMap = { pins: FeaturePins; base: BasePlacer; walk: WalkMap }

const SUGGESTED = 3
const STAY_CHOICES_MIN = [30, 60, 90, 120]
const DEFAULT_STAY_MIN = 60

type Stop = { name: string; lon: number; lat: number; feature?: SiteFeature }
type Planned = {
  stop: Stop
  path: Cell[]
  stopIndex: number
  card: EvaCard
  /** Seconds of the fastest walk home from each point of the walk out. */
  homeS: number[]
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
  grid: Grid,
  home: LonLat,
  features: readonly SiteFeature[],
  map: MarswalkMap,
  onDone: (walk: Marswalk) => void,
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
  let chosen: Stop | null = null
  let planned: Planned | null = null
  let planning = 0
  const status = el('p', { className: 'dock-note', ariaLive: 'polite' })

  /** Route there and back, and judge it with the EVA card. */
  const plan = async (stop: Stop): Promise<Planned | string> => {
    const cell = lonLatToCell(grid, stop.lon, stop.lat)
    if (!cell) return 'That point is outside the mapped terrain.'
    const reply = await map.walk.client(grid).route([homeCell, cell, homeCell])
    if (reply.type === 'error') return reply.message
    if (!reply.path || !reply.homeS)
      return 'No safe walking route reaches that point: every way there crosses ground steeper than 15°.'
    const stopIndex = reply.path.findIndex(
      (c, i) => i > 0 && c.row === cell.row && c.col === cell.col,
    )
    const out = reply.path.slice(0, stopIndex + 1)
    const homeS = reply.homeS.slice(0, stopIndex + 1)
    const card = evaCard(grid, out, [homeCell, cell], { homeS, stopMin: stayMin })
    return {
      stop,
      path: reply.path,
      stopIndex,
      card,
      homeS,
      totalMin: card.evaMin + card.walkbackMin,
      distanceM: summarizeRoute(grid, reply.path).distanceM,
    }
  }

  const choose = async (stop: Stop, refresh: () => void) => {
    chosen = stop
    planned = null
    const id = ++planning
    status.textContent = `Finding the safest walk to ${stop.name}…`
    const result = await plan(stop)
    if (id !== planning) return // a newer choice replaced this one
    const layer = map.walk.layer(grid)
    if (typeof result === 'string') {
      status.textContent = result
      layer.setPath(null)
      return
    }
    planned = result
    layer.setStops([homeCell, result.path[result.stopIndex] as Cell])
    layer.setPath(result.path)
    map.walk.view(result.path.map((c) => cellToLonLat(grid, c)))
    layer.setFail(
      result.card.failIndex === null ? null : (result.path[result.card.failIndex] ?? null),
    )
    status.textContent = `${stop.name}: ${formatDistance(result.distanceM)} there and back, ${hm(result.totalMin)} outside.`
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

  const pickStop: DockStep = {
    title: 'Choose a science stop',
    why: 'Pick a place a rover found something, or any point on the map. Farther and steeper means less time to spare.',
    layout: 'map',
    nextLabel: 'Check GO / NO-GO',
    render: () => {
      const root = el('div', { className: 'site-step' })
      const refresh = () => root.replaceChildren(...body())
      const body = () => [
        el('h3', { className: 'feature-heading', textContent: 'Places near your base' }),
        el(
          'ul',
          { className: 'walk-stops' },
          ...suggested.map((s) => {
            const km = distanceKm(home.lon, home.lat, s.lon, s.lat)
            const pick = el('button', {
              type: 'button',
              className: 'gate-secondary',
              textContent: chosen === s ? 'Chosen' : 'Walk here',
            })
            pick.setAttribute('aria-pressed', String(chosen === s))
            pick.addEventListener('click', () => void choose(s, refresh))
            return el(
              'li',
              { className: chosen === s ? 'walk-stop chosen' : 'walk-stop' },
              ...(s.feature
                ? [
                    el('img', {
                      src: s.feature.photo.src,
                      alt: s.feature.photo.alt,
                      loading: 'lazy',
                    }),
                  ]
                : []),
              el(
                'div',
                {},
                el('strong', { textContent: s.name }),
                el('p', {
                  textContent: `${formatDistance(km * 1000)} from the habitat in a straight line`,
                }),
              ),
              pick,
            )
          }),
        ),
        (() => {
          const free = el('button', {
            type: 'button',
            className: 'gate-link',
            textContent: 'Or click any point on the map',
          })
          free.addEventListener('click', () => {
            status.textContent = 'Click the ground where the crew should go.'
            map.base.pick((p) => void choose({ name: 'Your chosen point', ...p }, refresh))
          })
          return free
        })(),
        (() => {
          const select = el('select', { id: 'walk-stay' })
          for (const m of STAY_CHOICES_MIN)
            select.append(
              el('option', { value: String(m), textContent: hm(m), selected: m === stayMin }),
            )
          select.addEventListener('change', () => {
            stayMin = Number(select.value)
            if (chosen) void choose(chosen, refresh)
          })
          return el(
            'p',
            { className: 'walk-stay' },
            el('label', { htmlFor: 'walk-stay', textContent: 'Time at the stop: ' }),
            select,
          )
        })(),
        status,
      ]
      refresh()
      return root
    },
    onShow: () => {
      map.pins.show(
        suggested.flatMap((s) => (s.feature ? [s.feature] : [])),
        (i) => {
          const s = suggested[i]
          if (s) void choose(s, () => undefined)
        },
      )
    },
    onHide: () => map.base.pick(null),
    onNext: () => {
      if (planned) return true
      status.textContent = chosen
        ? 'Wait for the route, or choose a stop it can reach.'
        : 'Choose a stop first.'
      return false
    },
  }

  const verdict: DockStep = {
    title: 'GO / NO-GO',
    why: 'The card checks every point of the walk out: could the crew turn round there and still be home in time?',
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
        el('p', {
          textContent: go
            ? `Home with ${hm(c.tightestMarginMin)} to spare at the tightest point.`
            : `After ${formatDistance(failAt)} on the way out, the crew could no longer get home in time: ${hm(-c.tightestMarginMin)} short.`,
        }),
        evaBar([
          { label: 'Walk out', min: c.evaMin - stayMin, kind: 'out' },
          { label: 'Science stop', min: stayMin, kind: 'stay' },
          { label: 'Walk home', min: c.walkbackMin, kind: 'back' },
          { label: '+20%', min: pad, kind: 'pad' },
          { label: 'Spare', min: spare, kind: 'spare' },
          { label: 'Reserve', min: EVA_LIMITS.backupMin, kind: 'reserve' },
        ]),
        el(
          'dl',
          { className: 'zone-facts' },
          ...[
            ['Stop', p.stop.name],
            ['There and back', formatDistance(p.distanceM)],
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
      )
    },
    onShow: () => {
      if (planned) map.walk.view(planned.path.map((c) => cellToLonLat(grid, c)))
    },
    onNext: () => planned?.card.verdict === 'GO',
  }

  /** Flight Director: only options that the same card passes, never a plan. */
  const advise = async (p: Planned, into: HTMLElement) => {
    into.replaceChildren(el('p', { className: 'fd-note', textContent: 'Checking options…' }))
    const options: string[] = []
    for (const m of STAY_CHOICES_MIN.filter((m) => m < stayMin)) {
      const out = p.path.slice(0, p.stopIndex + 1)
      const c = evaCard(grid, out, [homeCell, out.at(-1) as Cell], { homeS: p.homeS, stopMin: m })
      if (c.verdict === 'GO')
        options.push(`Stay ${hm(m)} at ${p.stop.name} instead of ${hm(stayMin)}.`)
    }
    for (const s of suggested.filter((s) => s !== p.stop)) {
      const r = await plan(s)
      if (typeof r !== 'string' && r.card.verdict === 'GO')
        options.push(`Walk to ${s.name} (${formatDistance(r.distanceM)} there and back).`)
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
              textContent: 'No shorter stay or nearby stop passes. Try a closer point on the map.',
            }),
        el('p', {
          className: 'fd-note',
          textContent:
            'Each option passes the same card. The choice is yours: go back and change the walk.',
        }),
      ),
    )
  }

  let stopWalk: (() => void) | null = null
  const walk: DockStep = {
    title: 'The walk',
    why: 'Two crew walk out, work at the stop and walk home. The clock runs fast: the whole walk plays in half a minute.',
    layout: 'map',
    nextLabel: 'Finish: back in the airlock',
    render: () => {
      if (!planned) return el('p', { textContent: 'Choose a stop first.' })
      const p = planned
      const clock = el('p', { className: 'walk-clock', ariaLive: 'off' })
      const phase = el('p', { className: 'dock-note' })
      const minutes = walkClock(grid, p.path, p.stopIndex, stayMin)
      const arrive = minutes[p.stopIndex] ?? 0
      const leave = arrive + stayMin
      stopWalk?.()
      stopWalk = map.walk.play(
        p.path.map((c) => cellToLonLat(grid, c)),
        minutes,
        (m, done) => {
          clock.textContent = `${hm(m)} outside`
          phase.textContent = done
            ? `Back in the airlock after ${hm(m)}.`
            : m < arrive
              ? `Walking out to ${p.stop.name}`
              : m < leave
                ? `Working at ${p.stop.name}`
                : 'Walking home'
        },
      )
      return el('div', { className: 'site-step' }, clock, phase)
    },
    onHide: () => stopWalk?.(),
    onNext: () => {
      const p = planned
      if (!p) return false
      map.walk.clear()
      onDone({
        stop: p.stop.name,
        distanceM: Math.round(p.distanceM),
        evaMin: Math.round(p.totalMin),
        doseMsv: walkDoseMsv(p.totalMin),
      })
      return false
    },
  }

  return [rules, pickStop, verdict, walk]
}
