/** "Sunlight" planning tool: a sol of clear-sky sunlight on the terrain, as a map overlay. */
import type { Site } from '../core/elevation'
import { solarLongitudeDeg } from '../core/mars-time'
import { ORANGE_RAMP, rampRaster } from '../core/ramp'
import type { RangeLayer } from '../map/range-layer'
import type { RouteClient } from '../map/route-client'

const OVERLAY_ALPHA = 170
const STRETCH = [0.02, 0.98] // colour the middle 96% of values, so a few outliers do not wash it out

export type SunToolDeps = {
  /** The site to compute for: the one being planned, else the one in view; null if neither. */
  siteNow: () => Site | null
  client: (site: Site) => RouteClient
  overlay: (site: Site) => RangeLayer
  /** The app clock, ms UTC. */
  nowMs: () => number
}

function percentiles(values: Float32Array, ps: readonly number[]): number[] {
  const finite = Array.from(values)
    .filter(Number.isFinite)
    .sort((a, b) => a - b)
  return ps.map((p) => finite[Math.min(finite.length - 1, Math.floor(p * finite.length))] ?? NaN)
}

export function mountSunTool(actions: HTMLElement, notes: HTMLElement, deps: SunToolDeps) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'quiet'
  button.setAttribute('aria-pressed', 'false')
  button.textContent = 'Sunlight'
  actions.append(button)
  const note = document.createElement('div')
  note.className = 'route-note sun-note'
  note.setAttribute('role', 'status')
  note.hidden = true
  notes.append(note)

  let on = false
  let request = 0
  let shownOn: Site | null = null

  const refresh = async () => {
    const id = ++request
    if (shownOn) void deps.overlay(shownOn).setRaster(null)
    shownOn = null
    note.hidden = !on
    if (!on) return
    const site = deps.siteNow()
    if (!site) {
      note.textContent = 'Zoom to Jezero or Gale to see sunlight on the terrain.'
      return
    }
    note.textContent = 'Working out a sol of sunlight…'
    const utcMs = deps.nowMs()
    const reply = await deps.client(site).solar(utcMs)
    if (id !== request) return
    if (reply.type === 'error') {
      note.textContent = reply.message
      return
    }
    const [lo, hi] = percentiles(reply.kwh, STRETCH) as [number, number]
    await deps.overlay(site).setRaster(rampRaster(reply.kwh, lo, hi, ORANGE_RAMP, OVERLAY_ALPHA))
    if (id !== request) return
    shownOn = site
    const date = new Date(utcMs).toISOString().slice(0, 10)
    const ls = Math.round(solarLongitudeDeg(utcMs))
    note.replaceChildren()
    const legend = document.createElement('div')
    legend.className = 'ramp-legend'
    const low = document.createElement('span')
    low.textContent = `${lo.toFixed(1)}`
    const bar = document.createElement('i')
    bar.setAttribute('aria-hidden', 'true')
    bar.style.background = `linear-gradient(to right, ${ORANGE_RAMP.join(', ')})`
    const high = document.createElement('span')
    high.textContent = `${hi.toFixed(1)} kWh/m² per sol`
    legend.append(low, bar, high)
    const text = document.createElement('p')
    text.textContent =
      `Sunlight reaching each patch of ground over the sol from ${date} (Ls ${ls}°), brighter is more. ` +
      'It counts slope, which way the ground faces and shadows cast by the terrain, at the top of ' +
      'the atmosphere: dust and air are ignored, so a real solar panel gets less. Set the clock to ' +
      'another sol and press Sunlight twice to compare.'
    note.append(legend, text)
  }

  button.addEventListener('click', () => {
    on = !on
    button.setAttribute('aria-pressed', String(on))
    void refresh()
  })
  return { refresh: () => void refresh() }
}
