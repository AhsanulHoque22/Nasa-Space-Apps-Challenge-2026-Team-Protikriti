/** Marswalk planner: click a start, then science stops; see the safest timed EVA. */
import { Cartesian2, ScreenSpaceEventHandler, ScreenSpaceEventType, type Viewer } from 'cesium'
import { formatDistance, formatDuration } from '../core/format'
import type { Site } from '../core/elevation'
import { EVA_LIMITS, evaCard } from '../core/eva-card'
import { describeNoRoute, describeRoute } from '../core/describe'
import { HAZARD_RADIUS_M } from '../core/hazards'
import {
  DEM_SIGMA_M,
  ERROR_CORRELATION_CELLS,
  RELIABILITY_TRIALS,
  routeReliability,
} from '../core/reliability'
import { RANGE_RINGS_MIN, homeLimitInMap, rangeRaster, walkRange } from '../core/range'
import { type Cell, type Grid, lonLatToCell } from '../core/grid'
import { DEFAULT_SUIT_FACTOR, MAX_SUIT_SPEED_KMH } from '../core/route'
import { EMPTY_PLAN, type Plan, pick } from '../core/planner'
import type { RouteReply } from '../core/route-service'
import { SCIENCE_STOP_MIN, evaDurationMin, summarizeRoute } from '../core/summary'
import { SIGHT_HEIGHT_M, outOfSightFraction, sightRaster } from '../core/viewshed'
import { MARS_SPHERE } from '../map/mars'
import type { RouteClient } from '../map/route-client'
import type { RangeLayer } from '../map/range-layer'
import type { RouteLayer } from '../map/route-layer'
import { isExploring, isInteractiveClick } from '../map/picking'

const MESSAGES = {
  start: 'Start set. Click to add science stops along your Marswalk.',
  routing: 'Finding the safest route…',
  otherSite: 'Routes stay within one site. Clear the route to plan in another site.',
  found: 'Click to add another stop, or Clear to start over.',
  samePoint: 'That stop is where you already are. Click somewhere else.',
} as const

const noRouteMessage = (leg: number, needsDeg: number | null | undefined, limitDeg: number) =>
  `${describeNoRoute(leg, needsDeg, limitDeg)} That stop was not added: pick another spot.`

export function renderRoutePanel(
  parent: HTMLElement,
  viewer: Viewer,
  sites: readonly Site[],
  makeClient: (grid: Grid) => RouteClient,
  makeLayer: (grid: Grid) => RouteLayer,
  makeRange: (grid: Grid) => RangeLayer,
): void {
  const names = sites.map((s) => s.name.split(' (')[0]).join(' or ')
  const idle = `Click the ${names} terrain to set a start point.`
  const outside = `That point is outside the mapped site terrain (${names}). Zoom to a site and pick a point there.`
  // One routing worker and route layer per site, created on first use.
  const perSite = new Map<
    string,
    { client: RouteClient; layer: RouteLayer; range: RangeLayer; sight: RangeLayer }
  >()
  const tools = (site: Site) => {
    let t = perSite.get(site.id)
    if (!t) {
      t = {
        client: makeClient(site.grid),
        layer: makeLayer(site.grid),
        range: makeRange(site.grid),
        sight: makeRange(site.grid),
      }
      perSite.set(site.id, t)
    }
    return t
  }
  let active: Site | undefined
  const panel = document.createElement('section')
  panel.className = 'panel route'
  panel.setAttribute('aria-labelledby', 'route-title')
  panel.innerHTML = `
    <h2 id="route-title">Marswalk route</h2>
    <p class="route-status" role="status" aria-live="polite">${idle}</p>
    <div class="route-result" hidden>
      <div class="eva-card" role="status">
        <p class="eva-verdict"><span class="eva-badge"></span><span class="eva-line"></span></p>
        <p class="eva-detail"></p>
        <p class="eva-detail eva-reliability"></p>
      </div>
      <dl class="route-summary">
        <div><dt>EVA time <span class="qualifier">incl. ${SCIENCE_STOP_MIN} min/stop</span></dt><dd data-k="eva"></dd></div>
        <div><dt>Distance</dt><dd data-k="distance"></dd></div>
        <div><dt>Climb / descent</dt><dd data-k="relief"></dd></div>
        <div><dt>Steepest step</dt><dd data-k="slope"></dd></div>
      </dl>
      <ol class="route-legs" aria-label="Legs"></ol>
      <details class="route-words"><summary>Route in words</summary><p></p></details>
      <p class="route-note">Pace: Tobler's hiking function x ${DEFAULT_SUIT_FACTOR} suit factor, capped at ${MAX_SUIT_SPEED_KMH} km/h (team assumptions). Mars gravity is not modelled.</p>
    </div>
    <div class="route-actions">
      <button type="button" data-act="add">Add point at view centre</button>
      <button type="button" data-act="undo" class="quiet">Undo stop</button>
      <button type="button" data-act="clear" class="quiet">Clear</button>
      <button type="button" data-act="range" class="quiet" aria-pressed="false">Walking range</button>
      <button type="button" data-act="sight" class="quiet" aria-pressed="false">Line of sight</button>
      <button type="button" data-act="hazard" class="quiet" aria-pressed="false">Mark hazard</button>
      <button type="button" data-act="clear-hazards" class="quiet" hidden>Clear hazards</button>
    </div>
    <p class="route-note hazard-note" role="status" hidden></p>
    <p class="route-note range-note" role="status" hidden></p>
    <p class="route-note sight-note" role="status" hidden></p>`
  parent.append(panel)
  const status = panel.querySelector('.route-status') as HTMLElement
  const result = panel.querySelector('.route-result') as HTMLElement
  const legsEl = panel.querySelector('.route-legs') as HTMLElement
  const evaEl = panel.querySelector('.eva-card') as HTMLElement
  const evaBadge = panel.querySelector('.eva-badge') as HTMLElement
  const evaLine = panel.querySelector('.eva-line') as HTMLElement
  const evaDetail = panel.querySelector('.eva-detail') as HTMLElement
  const evaReliability = panel.querySelector('.eva-reliability') as HTMLElement
  const wordsEl = panel.querySelector('.route-words p') as HTMLElement
  const field = (k: string) => panel.querySelector(`dd[data-k="${k}"]`) as HTMLElement

  const hazardButton = panel.querySelector('[data-act="hazard"]') as HTMLButtonElement
  const clearHazardsButton = panel.querySelector('[data-act="clear-hazards"]') as HTMLButtonElement
  const hazardNote = panel.querySelector('.hazard-note') as HTMLElement
  const hazardsBySite = new Map<string, Cell[]>()
  let hazardMode = false
  let detour = '' // what the last route said about the hazards
  const hazardsOf = (site: Site) => hazardsBySite.get(site.id) ?? []
  const hazardCount = () => [...hazardsBySite.values()].reduce((n, h) => n + h.length, 0)
  const updateHazardNote = () => {
    const n = hazardCount()
    hazardNote.hidden = !hazardMode && n === 0
    clearHazardsButton.hidden = n === 0
    hazardNote.textContent =
      (hazardMode
        ? `Hazard mode: click the map to mark ground to avoid (${HAZARD_RADIUS_M} m keep-out). `
        : '') +
      (n ? `${n} hazard${n === 1 ? '' : 's'} marked. ` : '') +
      detour
  }

  const sightButton = panel.querySelector('[data-act="sight"]') as HTMLButtonElement
  const sightNote = panel.querySelector('.sight-note') as HTMLElement
  let sightOn = false
  let sightRequest = 0
  let sightMask: Uint8Array | null = null // what the start can see, for the active site
  let lastPath: Cell[] | null = null // the route on show, to say how much of it is out of sight

  const updateSightNote = () => {
    sightNote.hidden = !sightOn
    if (!sightOn) return
    if (!sightMask || !active) {
      sightNote.textContent = 'Set a start point to see what it can see.'
      return
    }
    const hidden = lastPath ? outOfSightFraction(active.grid, lastPath, sightMask) : null
    sightNote.textContent =
      `Shaded: ground where the start is out of sight of a standing person (${SIGHT_HEIGHT_M} m eye height; ` +
      'terrain and the curve of Mars hide it). Approximate, and geometric line of sight only, not radio coverage.' +
      (hidden === null
        ? ''
        : ` ${Math.round(hidden * 100)}% of this route is out of sight of the start.`)
  }

  /** What can be seen from the start; the start stands in for the lander. */
  const refreshSight = async () => {
    const id = ++sightRequest
    const start = requested.stops[0]
    sightMask = null
    if (active) void tools(active).sight.setRaster(null)
    if (!sightOn || !active || !start) {
      updateSightNote()
      return
    }
    const site = active
    sightNote.hidden = false
    sightNote.textContent = 'Working out what can be seen…'
    const reply = await tools(site).client.sight(start)
    if (id !== sightRequest) return // the start moved or the view was switched off
    if (reply.type === 'error') {
      sightNote.textContent = reply.message
      return
    }
    sightMask = reply.visible
    await tools(site).sight.setRaster(sightRaster(site.grid.width, site.grid.height, reply.visible))
    updateSightNote()
  }

  const rangeButton = panel.querySelector('[data-act="range"]') as HTMLButtonElement
  const rangeNote = panel.querySelector('.range-note') as HTMLElement
  let rangeOn = false
  let rangeRequest = 0

  /** Rings and the can-still-get-home limit around the start, over the real terrain. */
  const refreshRange = async () => {
    const id = ++rangeRequest
    rangeNote.hidden = !rangeOn
    const start = requested.stops[0]
    if (!rangeOn || !active || !start) {
      if (active) void tools(active).range.setRaster(null)
      rangeNote.textContent = 'Set a start point to see how far you can walk from it.'
      return
    }
    const site = active
    rangeNote.textContent = 'Working out how far you can walk…'
    const reply = await tools(site).client.range(start)
    if (id !== rangeRequest) return // the start moved or the range was switched off
    if (reply.type === 'error') {
      rangeNote.textContent = reply.message
      return
    }
    const range = walkRange(reply.outS, reply.backS)
    await tools(site).range.setRaster(rangeRaster(site.grid.width, site.grid.height, range))
    const rings = RANGE_RINGS_MIN.map(formatDuration).join(', ')
    rangeNote.textContent =
      `Blue rings: ${rings} of walking from the start. ` +
      (homeLimitInMap(range, reply.outS)
        ? 'Dashed white line: the farthest you can go and still be home in time, with the EVA limits above.'
        : 'Everything you can reach on this map is close enough to get home in time, so there is no dashed limit line.')
  }

  let plan: Plan = EMPTY_PLAN // last plan with a computed route
  let requested: Plan = EMPTY_PLAN // what the user has asked for, possibly still routing
  let latest = 0

  const showCard = (reply: Extract<RouteReply, { type: 'route' }>, stops: Cell[]) => {
    if (!active || !reply.path) return null
    const g = active.grid
    const card = evaCard(g, reply.path, stops)
    const failCell = card.failIndex === null ? null : (reply.path[card.failIndex] ?? null)
    tools(active).layer.setFail(failCell)
    const go = card.verdict === 'GO'
    evaEl.dataset.verdict = card.verdict
    evaBadge.textContent = card.verdict
    const margin = formatDuration(Math.abs(card.tightestMarginMin))
    let failAlongM: number | undefined
    if (go) {
      evaLine.textContent = `Back in time, with ${margin} to spare at the tightest point.`
    } else {
      failAlongM = summarizeRoute(g, reply.path.slice(0, (card.failIndex ?? 0) + 1)).distanceM
      evaLine.textContent = `Cannot get home in time from ${formatDistance(failAlongM)} along the route (short by ${margin}).`
    }
    const { maxEvaMin, backupMin, walkbackPad } = EVA_LIMITS
    evaDetail.textContent =
      `Walk home from the last stop: ${formatDuration(card.walkbackMin)}. Assumes ` +
      `${formatDuration(maxEvaMin)} EVA, ${formatDuration(backupMin)} reserve, ` +
      `+${Math.round(walkbackPad * 100)}% on the walk home.`
    const held = routeReliability(g, reply.path)
    evaReliability.textContent =
      `Terrain check: the route stays within ${g.maxSafeSlopeDeg}° in ${Math.round(held * 100)}% of ` +
      `${RELIABILITY_TRIALS} simulated terrain errors (±${DEM_SIGMA_M} m, smooth over ` +
      `${ERROR_CORRELATION_CELLS * g.pixelSizeM} m: a team assumption, not a measured error).`
    return { card, failAlongM, limitDeg: g.maxSafeSlopeDeg }
  }

  const showResult = (reply: Extract<RouteReply, { type: 'route' }> | null, stops: Cell[] = []) => {
    const stopCount = stops.length
    const total = reply?.total
    result.hidden = !total || stopCount < 2
    if (!reply || !total) {
      if (active) tools(active).layer.setFail(null)
      return
    }
    const shown = showCard(reply, stops)
    field('eva').textContent = formatDuration(evaDurationMin(total.durationMin, stopCount))
    field('distance').textContent = formatDistance(total.distanceM)
    field('relief').textContent =
      `+${Math.round(total.ascentM)} m / −${Math.round(total.descentM)} m`
    field('slope').textContent = `${total.maxSlopeDeg.toFixed(1)}°`
    if (shown) {
      wordsEl.textContent = describeRoute({
        total,
        legs: reply.legs,
        stopCount,
        evaMin: evaDurationMin(total.durationMin, stopCount),
        limitDeg: shown.limitDeg,
        card: shown.card,
        failAlongM: shown.failAlongM,
      })
    }
    legsEl.innerHTML = reply.legs
      .map(
        (leg, i) =>
          `<li><span>${i === 0 ? 'Start' : `Stop ${i}`} → Stop ${i + 1}</span>` +
          `<span>${formatDistance(leg.distanceM)} · ${formatDuration(leg.durationMin)}</span></li>`,
      )
      .join('')
  }

  const replan = async (next: Plan) => {
    requested = next // later clicks build on this, even while it is still routing
    const id = ++latest
    status.textContent = MESSAGES.routing
    if (!active) return
    const { client, layer } = tools(active)
    const reply = await client.route(next.stops, hazardsOf(active))
    if (id !== latest) return // superseded by a newer request
    if (reply.type === 'error') {
      requested = plan
      status.textContent = reply.message
      return
    }
    if (reply.path === null && reply.baseline) {
      // Fine without the hazards: they are what blocks it. Never leave the old route on show.
      layer.setPath(null)
      layer.setBaseline(null)
      lastPath = null
      updateSightNote()
      showResult(null)
      detour = 'No safe route: the hazards block the way. Clear them to continue. '
      updateHazardNote()
      status.textContent = 'A hazard blocks the way to your last stop.'
      return
    }
    if (reply.path === null) {
      // Keep the last good plan; the unreachable stop is not added.
      requested = plan
      status.textContent = noRouteMessage(
        reply.failedLeg ?? next.stops.length - 2,
        reply.needsDeg,
        active.grid.maxSafeSlopeDeg,
      )
      return
    }
    plan = next
    layer.setStops(plan.stops)
    layer.setPath(reply.path)
    layer.setBaseline(reply.baseline?.hitsHazard ? reply.baseline.path : null)
    lastPath = reply.path
    updateSightNote()
    const extraM = (reply.total?.distanceM ?? 0) - (reply.baseline?.total.distanceM ?? 0)
    const extraMin = (reply.total?.durationMin ?? 0) - (reply.baseline?.total.durationMin ?? 0)
    detour = !reply.baseline
      ? ''
      : !reply.baseline.hitsHazard
        ? 'The route already keeps clear of them. '
        : Math.round(extraM) === 0 && Math.round(extraMin) === 0
          ? 'A small sidestep keeps you clear, with no measurable extra distance or time (dashed: direct route). '
          : `Detour: +${formatDistance(extraM)}, +${formatDuration(extraMin)} versus the direct route (dashed). `
    updateHazardNote()
    showResult(reply, plan.stops)
    status.textContent = MESSAGES.found
  }

  const apply = (hit: { site: Site; cell: Cell } | null, from: Plan = requested) => {
    if (hit && from.stops.length > 0 && active && hit.site.id !== active.id) {
      status.textContent = MESSAGES.otherSite
      return
    }
    const { plan: next, event } = pick(from, hit?.cell ?? null)
    if (event === 'outside' || event === 'same-point') {
      status.textContent = event === 'outside' ? outside : MESSAGES.samePoint
      return
    }
    if (event === 'start-set' && hit) {
      latest++
      if (active && active.id !== hit.site.id) clearLayer(active)
      active = hit.site
      plan = next
      requested = next
      const { layer } = tools(active)
      layer.setStops(plan.stops)
      layer.setPath(null)
      layer.setBaseline(null)
      detour = ''
      lastPath = null
      updateHazardNote()
      showResult(null)
      status.textContent = MESSAGES.start
      void refreshRange()
      void refreshSight()
      return
    }
    void replan(next)
  }

  const cellAt = (screen: Cartesian2): { site: Site; cell: Cell } | null => {
    const ray = viewer.camera.getPickRay(screen)
    const hit = ray && viewer.scene.globe.pick(ray, viewer.scene)
    if (!hit) return null
    const c = MARS_SPHERE.cartesianToCartographic(hit)
    const lon = (c.longitude * 180) / Math.PI
    const lat = (c.latitude * 180) / Math.PI
    for (const site of sites) {
      const cell = lonLatToCell(site.grid, lon, lat)
      if (cell) return { site, cell }
    }
    return null
  }
  const clearLayer = (site: Site) => {
    const t = perSite.get(site.id)
    t?.layer.setStops([])
    t?.layer.setPath(null)
    t?.layer.setBaseline(null)
    void t?.range.setRaster(null)
    void t?.sight.setRaster(null)
  }

  new ScreenSpaceEventHandler(viewer.scene.canvas).setInputAction(
    (click: ScreenSpaceEventHandler.PositionedEvent) => {
      if (isExploring() || isInteractiveClick(viewer, click.position)) return // explore owns input
      place(cellAt(click.position))
    },
    ScreenSpaceEventType.LEFT_CLICK,
  )

  const placeHazard = (hit: { site: Site; cell: Cell } | null) => {
    if (!hit) {
      status.textContent = outside
      return
    }
    hazardsBySite.set(hit.site.id, [...hazardsOf(hit.site), hit.cell])
    tools(hit.site).layer.setHazards(hazardsOf(hit.site))
    detour = ''
    updateHazardNote()
    if (active && hit.site.id === active.id && requested.stops.length >= 2) void replan(requested)
  }
  const place = (hit: { site: Site; cell: Cell } | null) =>
    hazardMode ? placeHazard(hit) : apply(hit)

  const clear = () => {
    latest++
    detour = ''
    updateHazardNote()
    plan = EMPTY_PLAN
    requested = EMPTY_PLAN
    if (active) clearLayer(active)
    lastPath = null
    showResult(null)
    status.textContent = idle
    void refreshRange()
    void refreshSight()
  }
  panel.querySelector('[data-act="add"]')?.addEventListener('click', () => {
    const canvas = viewer.scene.canvas
    place(cellAt(new Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2)))
  })
  panel.querySelector('[data-act="undo"]')?.addEventListener('click', () => {
    const stops = requested.stops.slice(0, -1)
    if (stops.length === 0) clear()
    else if (stops.length === 1 && active)
      apply({ site: active, cell: stops[0] as Cell }, EMPTY_PLAN) // back to just the start
    else void replan({ stops })
  })
  panel.querySelector('[data-act="clear"]')?.addEventListener('click', clear)
  hazardButton.addEventListener('click', () => {
    hazardMode = !hazardMode
    hazardButton.setAttribute('aria-pressed', String(hazardMode))
    updateHazardNote()
  })
  clearHazardsButton.addEventListener('click', () => {
    for (const [id, cells] of hazardsBySite) {
      if (cells.length) perSite.get(id)?.layer.setHazards([])
    }
    hazardsBySite.clear()
    detour = ''
    updateHazardNote()
    if (active && requested.stops.length >= 2) void replan(requested)
  })
  sightButton.addEventListener('click', () => {
    sightOn = !sightOn
    sightButton.setAttribute('aria-pressed', String(sightOn))
    void refreshSight()
  })
  rangeButton.addEventListener('click', () => {
    rangeOn = !rangeOn
    rangeButton.setAttribute('aria-pressed', String(rangeOn))
    void refreshRange()
  })
}
