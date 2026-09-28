/** Marswalk planner: pick start and goal on the terrain, see the safest timed route. */
import { Cartesian2, ScreenSpaceEventHandler, ScreenSpaceEventType, type Viewer } from 'cesium'
import { formatDistance, formatDuration } from '../core/format'
import { type Cell, type Grid, lonLatToCell } from '../core/grid'
import { EMPTY_PLAN, type Plan, pick } from '../core/planner'
import type { RouteSummary } from '../core/summary'
import { MARS_SPHERE } from '../map/mars'
import type { RouteClient } from '../map/route-client'
import type { RouteLayer } from '../map/route-layer'

const MESSAGES = {
  idle: 'Click the terrain inside the Jezero map to set a start point.',
  start: 'Start set. Click where you want to walk to.',
  routing: 'Finding the safest route…',
  outside: 'That point is outside the mapped Jezero terrain. Pick a point on the HiRISE area.',
  noRoute: 'No safe route: every path crosses slopes steeper than 15°. Try a different goal.',
  samePoint: 'Start and goal are the same spot. Click somewhere else for the goal.',
  found: 'Route found. Click the terrain to plan a new one.',
} as const

export function renderRoutePanel(
  parent: HTMLElement,
  viewer: Viewer,
  grid: Grid,
  client: RouteClient,
  layer: RouteLayer,
): void {
  const panel = document.createElement('section')
  panel.className = 'panel route'
  panel.setAttribute('aria-labelledby', 'route-title')
  panel.innerHTML = `
    <h2 id="route-title">Marswalk route</h2>
    <p class="route-status" role="status" aria-live="polite">${MESSAGES.idle}</p>
    <dl class="route-summary" hidden>
      <div><dt>Distance</dt><dd data-k="distance"></dd></div>
      <div><dt>Walking time <span class="qualifier">Earth pace</span></dt><dd data-k="duration"></dd></div>
      <div><dt>Climb / descent</dt><dd data-k="relief"></dd></div>
      <div><dt>Steepest step</dt><dd data-k="slope"></dd></div>
    </dl>
    <div class="route-actions">
      <button type="button" data-act="start">Start at view centre</button>
      <button type="button" data-act="goal">Goal at view centre</button>
      <button type="button" data-act="clear" class="quiet">Clear</button>
    </div>`
  parent.append(panel)
  const status = panel.querySelector('.route-status') as HTMLElement
  const summaryEl = panel.querySelector('.route-summary') as HTMLElement
  const field = (k: string) => panel.querySelector(`dd[data-k="${k}"]`) as HTMLElement

  let plan: Plan = EMPTY_PLAN
  let latest = 0

  const showSummary = (s: RouteSummary | null) => {
    summaryEl.hidden = s === null
    if (!s) return
    field('distance').textContent = formatDistance(s.distanceM)
    field('duration').textContent = formatDuration(s.durationMin)
    field('relief').textContent = `+${Math.round(s.ascentM)} m / −${Math.round(s.descentM)} m`
    field('slope').textContent = `${s.maxSlopeDeg.toFixed(1)}°`
  }

  const apply = async (cell: Cell | null) => {
    const result = pick(plan, cell)
    if (result.event === 'outside') {
      status.textContent = MESSAGES.outside
      return
    }
    plan = result.plan
    layer.setEnds(plan.start, plan.goal)
    if (result.event === 'start-set') {
      layer.setPath(null)
      showSummary(null)
      status.textContent = MESSAGES.start
      return
    }
    if (!plan.start || !plan.goal) return
    const id = ++latest
    status.textContent = MESSAGES.routing
    const reply = await client.route(plan.start, plan.goal)
    if (id !== latest) return // a newer request superseded this one
    if (reply.type === 'error') {
      status.textContent = reply.message
      return
    }
    layer.setPath(reply.path)
    showSummary(reply.summary)
    if (!reply.path) status.textContent = MESSAGES.noRoute
    else status.textContent = reply.path.length === 1 ? MESSAGES.samePoint : MESSAGES.found
  }

  const cellAt = (screen: Cartesian2): Cell | null => {
    const ray = viewer.camera.getPickRay(screen)
    const hit = ray && viewer.scene.globe.pick(ray, viewer.scene)
    if (!hit) return null
    const c = MARS_SPHERE.cartesianToCartographic(hit)
    return lonLatToCell(grid, (c.longitude * 180) / Math.PI, (c.latitude * 180) / Math.PI)
  }
  const viewCentre = () => {
    const canvas = viewer.scene.canvas
    return cellAt(new Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2))
  }

  new ScreenSpaceEventHandler(viewer.scene.canvas).setInputAction(
    (click: ScreenSpaceEventHandler.PositionedEvent) => void apply(cellAt(click.position)),
    ScreenSpaceEventType.LEFT_CLICK,
  )

  panel.querySelector('[data-act="start"]')?.addEventListener('click', () => {
    plan = EMPTY_PLAN
    void apply(viewCentre())
  })
  panel.querySelector('[data-act="goal"]')?.addEventListener('click', () => {
    if (!plan.start) {
      status.textContent = MESSAGES.idle
      return
    }
    plan = { start: plan.start }
    void apply(viewCentre())
  })
  panel.querySelector('[data-act="clear"]')?.addEventListener('click', () => {
    plan = EMPTY_PLAN
    latest++
    layer.setEnds()
    layer.setPath(null)
    showSummary(null)
    status.textContent = MESSAGES.idle
  })
}
