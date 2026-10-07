/** "Haul road" planning tool: the gentlest vehicle route between the start and the last stop. */
import type { Cell } from '../core/grid'
import { formatDistance } from '../core/format'
import type { RouteClient } from '../map/route-client'
import type { RouteLayer } from '../map/route-layer'

/**
 * Sustained grade held on Earth's open-pit haul roads, commonly 8-10%: a team assumption for a
 * Mars cargo road, not a Mars rule. The user can change it.
 */
export const DEFAULT_HAUL_GRADE_PCT = 8

const toDeg = (pct: number) => (Math.atan(pct / 100) * 180) / Math.PI
const toPct = (deg: number) => Math.tan((deg * Math.PI) / 180) * 100

export type HaulDeps = {
  /** The planned route's ends, with the site's tools; null when there is no route on show. */
  ends: () => {
    from: Cell
    to: Cell
    hazards: Cell[]
    client: RouteClient
    layer: RouteLayer
  } | null
}

export function mountHaulTool(actions: HTMLElement, notes: HTMLElement, deps: HaulDeps) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'quiet'
  button.setAttribute('aria-pressed', 'false')
  button.textContent = 'Haul road'
  actions.append(button)
  const box = document.createElement('div')
  box.className = 'route-note storm-note'
  box.hidden = true
  const label = document.createElement('label')
  label.className = 'storm-warning'
  const text = document.createElement('span')
  text.textContent = 'Steepest grade for vehicles, %'
  const input = document.createElement('input')
  input.type = 'number'
  input.min = '1'
  input.max = '26' // 14.6°: never steeper than walkers are allowed (15°)
  input.step = '1'
  input.value = String(DEFAULT_HAUL_GRADE_PCT)
  label.append(text, input)
  const out = document.createElement('p')
  out.setAttribute('role', 'status')
  box.append(label, out)
  notes.append(box)

  let on = false
  let request = 0
  let drawnOn: RouteLayer | null = null

  const refresh = async () => {
    const id = ++request
    drawnOn?.setHaul(null)
    drawnOn = null
    box.hidden = !on
    if (!on) return
    const pct = Number(input.value)
    if (!(pct >= 1 && pct <= 26)) {
      out.textContent = 'Enter a grade between 1% and 26%.'
      return
    }
    const ends = deps.ends()
    if (!ends) {
      out.textContent = 'Plan a route first: the road runs from its start to its last stop.'
      return
    }
    out.textContent = 'Finding the gentlest road…'
    const limitDeg = toDeg(pct)
    const reply = await ends.client.route([ends.from, ends.to], ends.hazards, limitDeg)
    if (id !== request) return
    if (reply.type === 'error') {
      out.textContent = reply.message
      return
    }
    if (!reply.path || !reply.total) {
      out.textContent =
        reply.needsDeg == null
          ? `No road at ${pct}% or less: no-data ground or hazards cut it off.`
          : `No road at ${pct}% or less. The gentlest way needs about ${toPct(reply.needsDeg).toFixed(0)}% (${reply.needsDeg.toFixed(1)}°).`
      return
    }
    ends.layer.setHaul(reply.path)
    drawnOn = ends.layer
    out.textContent =
      `Yellow dashes: a road from the start to the last stop, never steeper than ${pct}% ` +
      `(${limitDeg.toFixed(1)}°): ${formatDistance(reply.total.distanceM)}, steepest step ` +
      `${toPct(reply.total.maxSlopeDeg).toFixed(0)}%, climb ${Math.round(reply.total.ascentM)} m. ` +
      `${DEFAULT_HAUL_GRADE_PCT}% is a common limit for Earth's mine haul roads (team assumption). ` +
      'From the 20-32 m terrain model: it cannot see boulders.'
  }

  button.addEventListener('click', () => {
    on = !on
    button.setAttribute('aria-pressed', String(on))
    void refresh()
  })
  input.addEventListener('change', () => void refresh())
  return { refresh: () => void refresh() }
}
