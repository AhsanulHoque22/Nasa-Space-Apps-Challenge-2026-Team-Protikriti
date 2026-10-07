/** "Storm warning" planning tool: time to cover (habitat or nearest cave) against the warning. */
import { loadCaves } from '../core/caves'
import { formatDistance, formatDuration } from '../core/format'
import { MAX_SUIT_SPEED_KMH } from '../core/route'
import { shelterOptions } from '../core/shelter'

const DEFAULT_WARNING_MIN = 60

/** Where the crew is worst placed: the point on the route farthest (in time) from home. */
export type CrewPoint = { lon: number; lat: number; homeMin: number; where: string }

export function mountStormTool(
  actions: HTMLElement,
  notes: HTMLElement,
  crewPoint: () => CrewPoint | null,
): { refresh: () => void } {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'quiet'
  button.setAttribute('aria-pressed', 'false')
  button.textContent = 'Storm warning'
  actions.append(button)
  const box = document.createElement('div')
  box.className = 'route-note storm-note'
  box.hidden = true
  const label = document.createElement('label')
  label.className = 'storm-warning'
  const text = document.createElement('span')
  text.textContent = 'Minutes of warning (your scenario)'
  const input = document.createElement('input')
  input.type = 'number'
  input.min = '1'
  input.max = '1440'
  input.step = '5'
  input.value = String(DEFAULT_WARNING_MIN)
  label.append(text, input)
  const out = document.createElement('p')
  out.setAttribute('role', 'status')
  box.append(label, out)
  notes.append(box)

  let on = false
  let request = 0

  const refresh = async () => {
    const id = ++request
    box.hidden = !on
    if (!on) return
    const warningMin = Number(input.value)
    if (!(warningMin > 0)) {
      out.textContent = 'Enter how many minutes of warning the crew has.'
      return
    }
    const crew = crewPoint()
    if (!crew) {
      out.textContent = 'Set a start point (the habitat) to check the way to cover.'
      return
    }
    out.textContent = 'Checking the way to cover…'
    let caves: Awaited<ReturnType<typeof loadCaves>>['caves'] = []
    let cavesNote = ''
    try {
      caves = (await loadCaves()).caves
    } catch (error) {
      cavesNote = ` Cave candidates could not be loaded: ${String(error)}.`
    }
    if (id !== request) return
    const s = shelterOptions(crew, caves, { homeMin: crew.homeMin, warningMin })
    const home = s.habitat.inTime
      ? `Back to the habitat from ${crew.where}: ${formatDuration(s.habitat.walkMin)}, inside the warning with ${formatDuration(s.habitat.spareMin)} to spare.`
      : `Back to the habitat from ${crew.where}: ${formatDuration(s.habitat.walkMin)}, ${formatDuration(-s.habitat.spareMin)} longer than the warning. Plan a shorter walk.`
    const cave = s.cave
      ? ` Nearest cave candidate: ${s.cave.cave.id}, ${formatDistance(s.cave.distanceKm * 1000)} away, at least ` +
        `${formatDuration(s.cave.walkMinAtLeast)} on foot (straight line at the ${MAX_SUIT_SPEED_KMH} km/h top pace)` +
        (s.cave.inTime
          ? '. It is reachable inside the warning, but how well it would shield anyone is unknown.'
          : ': no cave is near enough to reach in time, so the habitat is the only cover.')
      : ''
    out.textContent = home + cave + cavesNote
  }

  button.addEventListener('click', () => {
    on = !on
    button.setAttribute('aria-pressed', String(on))
    void refresh()
  })
  input.addEventListener('input', () => void refresh())
  return { refresh: () => void refresh() }
}
