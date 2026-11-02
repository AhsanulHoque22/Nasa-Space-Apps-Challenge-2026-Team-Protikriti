/**
 * Mission 1.5's wrist console for the two crew on the walk. On the same arm and glass as the Map
 * mode walk, sorted for use on the move: the critical numbers always on top, then the most serious
 * warning, then the to-do list, the route and a small map. The side screen carries what the base
 * crew sends. Built once; each frame only the changing text is updated.
 */
import type { Cell } from '../core/grid'
import type { WalkAlert } from '../core/walk-alerts'
import { el } from './dom'
import { type Knob, knob } from './knob'
import { type ConsoleReading, type WristConsole, openWristConsole } from './wrist-console'
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
  /** The numbers behind the full-screen console's dials, bars and graph. */
  reading: Omit<ConsoleReading, 'phase' | 'clock' | 'alert' | 'alertLevel'>
}

export type WristControls = {
  onPause: (paused: boolean) => void
  onPace: (pace: number) => void
  onStayLonger: () => void
  onTurnBack: () => void
  onExit: () => void
  /** How fast the walk plays, as a knob position. */
  speedCount: number
  speedIndex: () => number
  speedLabel: (index: number) => string
  onSpeed: (index: number) => void
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

/** Sinks less than the Martian Map's arm (0.09), so the screens sit higher. Team choice. */
const STORY_SINK_FRAC = 0.01

export function openStoryWrist(
  tasks: Task[],
  controls: WristControls,
): { update: (f: WristFeed) => void; openFull: () => void; close: () => void } {
  // On the left of the map, beside the base crew's panel, and higher than in the Martian Map.
  const wrist = mountWrist(document.body, () => {
    const map = document.getElementById('globe')?.getBoundingClientRect()
    const area = map ? { left: map.left, width: map.width } : { left: 0, width: window.innerWidth }
    return { ...area, screensLeft: true, sinkFrac: STORY_SINK_FRAC }
  })
  // The walk narrows the dock after the arm opens, which moves the map's left edge.
  const globe = document.getElementById('globe')
  const resized = new ResizeObserver(() => wrist.relayout())
  if (globe) resized.observe(globe)
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
  // The full-screen console drives these same controls, so the two can never disagree.
  const proxy = (source: HTMLButtonElement, extra = '') => {
    const b = el('button', { type: 'button', className: `console-button ${extra}` })
    b.addEventListener('click', () => source.click())
    return {
      b,
      sync: () => {
        b.textContent = source.textContent
        b.disabled = source.disabled
      },
    }
  }
  let fullScreen: WristConsole | null = null
  let fullSync: (() => void)[] = []
  let speedKnob: Knob | null = null
  const openFull = () => {
    if (fullScreen) return
    const proxies = [proxy(pause), proxy(stay), proxy(back, 'console-button-turn')]
    fullSync = proxies.map((p) => p.sync)
    speedKnob = knob({
      label: 'Walk speed',
      count: controls.speedCount,
      index: controls.speedIndex(),
      format: controls.speedLabel,
      onChange: controls.onSpeed,
    })
    fullScreen = openWristConsole([speedKnob, ...proxies.map((p) => p.b)], () => {
      fullScreen = null
      speedKnob = null
      openButton.focus()
    })
  }
  const openButton = el('button', {
    type: 'button',
    className: 'sw-open-full',
    textContent: 'Full screen',
  })
  openButton.addEventListener('click', openFull)
  const top = el(
    'header',
    { className: 'sw-top' },
    el('div', { className: 'sw-now' }, phase, clock),
    openButton,
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
      if (fullScreen) {
        for (const sync of fullSync) sync()
        speedKnob?.set(controls.speedIndex())
        fullScreen.update({
          ...f.reading,
          phase: f.phase,
          clock: f.clock,
          alert: worst?.text ?? 'All within the plan.',
          alertLevel: worst?.level ?? 'ok',
        })
      }
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
    openFull,
    close: () => {
      fullScreen?.close()
      resized.disconnect()
      wrist.dismiss(() => wrist.destroy())
    },
  }
}
