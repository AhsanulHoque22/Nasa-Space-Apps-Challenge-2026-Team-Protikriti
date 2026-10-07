/** Marswalk planner: click a start, then science stops; see the safest timed EVA. */
import { Cartesian2, ScreenSpaceEventHandler, ScreenSpaceEventType, type Viewer } from 'cesium'
import { formatDistance, formatDuration } from '../core/format'
import type { Site } from '../core/elevation'
import { EVA_LIMITS, evaCard } from '../core/eva-card'
import { type Cell, type Grid, lonLatToCell } from '../core/grid'
import { DEFAULT_SUIT_FACTOR, MAX_SUIT_SPEED_KMH } from '../core/route'
import { EMPTY_PLAN, type Plan, pick } from '../core/planner'
import type { RouteReply } from '../core/route-service'
import { SCIENCE_STOP_MIN, evaDurationMin, summarizeRoute } from '../core/summary'
import { MARS_SPHERE } from '../map/mars'
import type { RouteClient } from '../map/route-client'
import type { RouteLayer } from '../map/route-layer'
import { isExploring, isInteractiveClick } from '../map/picking'

const MESSAGES = {
  start: 'Start set. Click to add science stops along your Marswalk.',
  routing: 'Finding the safest route…',
  otherSite: 'Routes stay within one site. Clear the route to plan in another site.',
  found: 'Click to add another stop, or Clear to start over.',
  samePoint: 'That stop is where you already are. Click somewhere else.',
} as const

const noRouteMessage = (leg: number) =>
  `No safe route to stop ${leg + 1}: every path crosses slopes steeper than 15°. ` +
  'That stop was not added — pick another spot.'

export function renderRoutePanel(
  parent: HTMLElement,
  viewer: Viewer,
  sites: readonly Site[],
  makeClient: (grid: Grid) => RouteClient,
  makeLayer: (grid: Grid) => RouteLayer,
): void {
  const names = sites.map((s) => s.name.split(' (')[0]).join(' or ')
  const idle = `Click the ${names} terrain to set a start point.`
  const outside = `That point is outside the mapped site terrain (${names}). Zoom to a site and pick a point there.`
  // One routing worker and route layer per site, created on first use.
  const perSite = new Map<string, { client: RouteClient; layer: RouteLayer }>()
  const tools = (site: Site) => {
    let t = perSite.get(site.id)
    if (!t) {
      t = { client: makeClient(site.grid), layer: makeLayer(site.grid) }
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
      </div>
      <dl class="route-summary">
        <div><dt>EVA time <span class="qualifier">incl. ${SCIENCE_STOP_MIN} min/stop</span></dt><dd data-k="eva"></dd></div>
        <div><dt>Distance</dt><dd data-k="distance"></dd></div>
        <div><dt>Climb / descent</dt><dd data-k="relief"></dd></div>
        <div><dt>Steepest step</dt><dd data-k="slope"></dd></div>
      </dl>
      <ol class="route-legs" aria-label="Legs"></ol>
      <p class="route-note">Pace: Tobler's hiking function x ${DEFAULT_SUIT_FACTOR} suit factor, capped at ${MAX_SUIT_SPEED_KMH} km/h (team assumptions). Mars gravity is not modelled.</p>
    </div>
    <div class="route-actions">
      <button type="button" data-act="add">Add point at view centre</button>
      <button type="button" data-act="undo" class="quiet">Undo stop</button>
      <button type="button" data-act="clear" class="quiet">Clear</button>
    </div>`
  parent.append(panel)
  const status = panel.querySelector('.route-status') as HTMLElement
  const result = panel.querySelector('.route-result') as HTMLElement
  const legsEl = panel.querySelector('.route-legs') as HTMLElement
  const evaEl = panel.querySelector('.eva-card') as HTMLElement
  const evaBadge = panel.querySelector('.eva-badge') as HTMLElement
  const evaLine = panel.querySelector('.eva-line') as HTMLElement
  const evaDetail = panel.querySelector('.eva-detail') as HTMLElement
  const field = (k: string) => panel.querySelector(`dd[data-k="${k}"]`) as HTMLElement

  let plan: Plan = EMPTY_PLAN // last plan with a computed route
  let requested: Plan = EMPTY_PLAN // what the user has asked for, possibly still routing
  let latest = 0

  const showCard = (reply: Extract<RouteReply, { type: 'route' }>, stops: Cell[]) => {
    if (!active || !reply.path) return
    const g = active.grid
    const card = evaCard(g, reply.path, stops)
    const failCell = card.failIndex === null ? null : (reply.path[card.failIndex] ?? null)
    tools(active).layer.setFail(failCell)
    const go = card.verdict === 'GO'
    evaEl.dataset.verdict = card.verdict
    evaBadge.textContent = card.verdict
    const margin = formatDuration(Math.abs(card.tightestMarginMin))
    if (go) {
      evaLine.textContent = `Back in time, with ${margin} to spare at the tightest point.`
    } else {
      const alongM = summarizeRoute(g, reply.path.slice(0, (card.failIndex ?? 0) + 1)).distanceM
      evaLine.textContent = `Cannot get home in time from ${formatDistance(alongM)} along the route (short by ${margin}).`
    }
    const { maxEvaMin, backupMin, walkbackPad } = EVA_LIMITS
    evaDetail.textContent =
      `Walk home from the last stop: ${formatDuration(card.walkbackMin)}. Assumes ` +
      `${formatDuration(maxEvaMin)} EVA, ${formatDuration(backupMin)} reserve, ` +
      `+${Math.round(walkbackPad * 100)}% on the walk home.`
  }

  const showResult = (reply: Extract<RouteReply, { type: 'route' }> | null, stops: Cell[] = []) => {
    const stopCount = stops.length
    const total = reply?.total
    result.hidden = !total || stopCount < 2
    if (!reply || !total) {
      if (active) tools(active).layer.setFail(null)
      return
    }
    showCard(reply, stops)
    field('eva').textContent = formatDuration(evaDurationMin(total.durationMin, stopCount))
    field('distance').textContent = formatDistance(total.distanceM)
    field('relief').textContent =
      `+${Math.round(total.ascentM)} m / −${Math.round(total.descentM)} m`
    field('slope').textContent = `${total.maxSlopeDeg.toFixed(1)}°`
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
    const reply = await client.route(next.stops)
    if (id !== latest) return // superseded by a newer request
    if (reply.type === 'error') {
      requested = plan
      status.textContent = reply.message
      return
    }
    if (reply.path === null) {
      // Keep the last good plan; the unreachable stop is not added.
      requested = plan
      status.textContent = noRouteMessage(reply.failedLeg ?? next.stops.length - 2)
      return
    }
    plan = next
    layer.setStops(plan.stops)
    layer.setPath(reply.path)
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
      showResult(null)
      status.textContent = MESSAGES.start
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
  }

  new ScreenSpaceEventHandler(viewer.scene.canvas).setInputAction(
    (click: ScreenSpaceEventHandler.PositionedEvent) => {
      if (isExploring() || isInteractiveClick(viewer, click.position)) return // explore owns input
      apply(cellAt(click.position))
    },
    ScreenSpaceEventType.LEFT_CLICK,
  )

  const clear = () => {
    latest++
    plan = EMPTY_PLAN
    requested = EMPTY_PLAN
    if (active) clearLayer(active)
    showResult(null)
    status.textContent = idle
  }
  panel.querySelector('[data-act="add"]')?.addEventListener('click', () => {
    const canvas = viewer.scene.canvas
    apply(cellAt(new Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2)))
  })
  panel.querySelector('[data-act="undo"]')?.addEventListener('click', () => {
    const stops = requested.stops.slice(0, -1)
    if (stops.length === 0) clear()
    else if (stops.length === 1 && active)
      apply({ site: active, cell: stops[0] as Cell }, EMPTY_PLAN) // back to just the start
    else void replan({ stops })
  })
  panel.querySelector('[data-act="clear"]')?.addEventListener('click', clear)
}
