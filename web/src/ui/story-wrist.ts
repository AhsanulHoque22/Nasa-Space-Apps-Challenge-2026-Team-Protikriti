/**
 * Mission 1.5's wrist console for the two crew on the walk. On the same arm and glass as the Map
 * mode walk, sorted for use on the move: the critical numbers always on top, then the most serious
 * warning, then the to-do list, the route and a small map. The side screen carries what the base
 * crew sends. Built once; each frame only the changing text is updated.
 */
import type { Cell } from '../core/grid'
import type { WalkAlert } from '../core/walk-alerts'
import { el } from './dom'
import { type Minimap, type Tile, minimapSvg, mountWrist } from './eva-dashboard'
import { type Task, taskList } from './missions/walk-briefing'

export type WristFeed = {
  phase: string
  clock: string
  /** The six numbers that matter most, in a fixed order. */
  critical: Tile[]
  alerts: WalkAlert[]
  stops: { name: string; status: string; current: boolean }[]
  minimap: Minimap | null
  /** Conditions and messages from the base crew. */
  conditions: Tile[]
  messages: string[]
  /** True while the crew are working at a stop: a longer stay is possible. */
  atStop: boolean
}

export type WristControls = {
  onPause: (paused: boolean) => void
  onPace: (pace: number) => void
  onStayLonger: () => void
  onTurnBack: () => void
  onExit: () => void
}

export const PACES: readonly [number, string][] = [
  [0.75, 'Slower (75%)'],
  [1, 'As planned'],
  [1.25, 'Faster (125%)'],
]
export const EXTRA_STAY_MIN = 15

type Tab = 'todo' | 'route' | 'map'
const TAB_LABEL: Record<Tab, string> = { todo: 'To do', route: 'Route', map: 'Map' }

/** The route small and north-up in grid cells, the crew and the next stop marked. */
export function routeMinimap(path: readonly Cell[], you: Cell, next: Cell | null): Minimap | null {
  if (path.length < 2) return null
  const cols = path.map((c) => c.col)
  const rows = path.map((c) => c.row)
  const size = Math.max(
    Math.max(...cols) - Math.min(...cols),
    Math.max(...rows) - Math.min(...rows),
    1,
  )
  const cx = (Math.max(...cols) + Math.min(...cols)) / 2
  const cy = (Math.max(...rows) + Math.min(...rows)) / 2
  const at = (c: Cell): [number, number] => [c.col - cx + size / 2, c.row - cy + size / 2]
  return { path: path.map(at), stops: [], you: at(you), next: next ? at(next) : null, size }
}

export function openStoryWrist(
  tasks: Task[],
  controls: WristControls,
): { update: (f: WristFeed) => void; close: () => void } {
  // Centred on the map, beside the base crew's panel.
  const wrist = mountWrist(document.body, () => {
    const map = document.getElementById('globe')?.getBoundingClientRect()
    return map ? { left: map.left, width: map.width } : { left: 0, width: window.innerWidth }
  })
  wrist.main.classList.add('sw-main')
  wrist.side.classList.add('sw-side')

  // Header: what the crew are doing, the clock, and the controls.
  const phase = el('p', { className: 'sw-phase' })
  const clock = el('p', { className: 'sw-clock' })
  const pause = el('button', { type: 'button', textContent: 'Pause' })
  let paused = false
  pause.addEventListener('click', () => {
    paused = !paused
    pause.textContent = paused ? 'Resume' : 'Pause'
    pause.setAttribute('aria-pressed', String(paused))
    controls.onPause(paused)
  })
  const pace = el('select', { ariaLabel: 'Walking pace' })
  for (const [value, label] of PACES)
    pace.append(el('option', { value: String(value), textContent: label, selected: value === 1 }))
  pace.addEventListener('change', () => controls.onPace(Number(pace.value)))
  const stay = el('button', {
    type: 'button',
    textContent: `Stay +${EXTRA_STAY_MIN} min`,
    title: 'Work longer at this stop than planned',
  })
  stay.addEventListener('click', () => controls.onStayLonger())
  const back = el('button', {
    type: 'button',
    className: 'sw-turn',
    textContent: 'Turn back',
    title: 'Abandon the rest of the walk and take the quickest safe way home',
  })
  back.addEventListener('click', () => {
    back.disabled = true
    back.textContent = 'Heading home'
    controls.onTurnBack()
  })
  const top = el(
    'header',
    { className: 'sw-top' },
    el('div', { className: 'sw-now' }, phase, clock),
    pause,
    pace,
    stay,
    back,
  )

  // The critical band and the warning strip.
  const critical = el('dl', { className: 'sw-critical' })
  const alert = el('p', { className: 'sw-alert', role: 'alert' })

  // Pages.
  const todo = el(
    'section',
    {},
    taskList(tasks, () => undefined, 'task-list sw-tasks'),
  )
  const route = el('section', { hidden: true })
  const map = el('section', { hidden: true, className: 'sw-map' })
  const pages: Record<Tab, HTMLElement> = { todo, route, map }
  const tabs = el('nav', { className: 'sw-tabs', role: 'tablist', ariaLabel: 'Wrist console' })
  for (const t of Object.keys(pages) as Tab[]) {
    const b = el('button', { type: 'button', role: 'tab', textContent: TAB_LABEL[t] })
    b.setAttribute('aria-selected', String(t === 'todo'))
    b.addEventListener('click', () => {
      for (const [k, page] of Object.entries(pages)) page.hidden = k !== t
      for (const o of tabs.children) o.setAttribute('aria-selected', String(o === b))
    })
    tabs.append(b)
  }
  wrist.main.replaceChildren(
    top,
    critical,
    alert,
    el('div', { className: 'sw-pages' }, todo, route, map),
    tabs,
  )

  // Side screen: the base crew.
  const conditions = el('dl', { className: 'ws-rows' })
  const messages = el('ul', { className: 'sw-messages', ariaLive: 'polite' })
  wrist.side.replaceChildren(
    el('h3', { textContent: 'Base crew' }),
    conditions,
    el('h3', { textContent: 'Messages' }),
    messages,
  )

  const exit = wrist.root.querySelector('.eva-exit')
  exit?.addEventListener('click', () => controls.onExit())

  const tiles = (into: HTMLElement, list: Tile[]) =>
    into.replaceChildren(
      ...list.map((t) => {
        const box = el(
          'div',
          { className: 'ws-tile' },
          el('dt', { textContent: t.label }),
          el('dd', { textContent: t.value }),
        )
        if (t.tone) box.dataset.tone = t.tone
        if (t.hint) box.title = t.hint
        return box
      }),
    )
  let lastMessages = ''
  let lastStops = ''

  return {
    update: (f) => {
      phase.textContent = f.phase
      clock.textContent = f.clock
      stay.disabled = !f.atStop
      tiles(critical, f.critical)
      const worst = f.alerts[0]
      alert.dataset.level = worst?.level ?? 'ok'
      alert.textContent = worst
        ? f.alerts.length > 1
          ? `${worst.text} (+${f.alerts.length - 1} more)`
          : worst.text
        : 'All within the plan.'
      tiles(conditions, f.conditions)
      const stopsKey = JSON.stringify(f.stops)
      if (stopsKey !== lastStops) {
        lastStops = stopsKey
        route.replaceChildren(
          el(
            'ol',
            { className: 'sw-stops' },
            ...f.stops.map((s) =>
              el(
                'li',
                { className: s.current ? 'current' : '' },
                el('strong', { textContent: s.name }),
                el('span', { textContent: s.status }),
              ),
            ),
          ),
          ...f.alerts
            .slice(1)
            .map((a) => el('p', { className: `sw-more ${a.level}`, textContent: a.text })),
        )
      }
      if (!map.hidden) map.innerHTML = f.minimap ? minimapSvg(f.minimap) : ''
      const messagesKey = f.messages.join('|')
      if (messagesKey !== lastMessages) {
        lastMessages = messagesKey
        messages.replaceChildren(...f.messages.map((m) => el('li', { textContent: m })))
      }
    },
    close: () => wrist.dismiss(() => wrist.destroy()),
  }
}
