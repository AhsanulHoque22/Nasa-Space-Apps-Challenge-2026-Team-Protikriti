/** Offline sync (simulated): hazard edits queue while offline, then merge into Ground's copy. */
import type { Cell } from '../core/grid'
import {
  type HazardOp,
  type LogEntry,
  type Shared,
  loadQueue,
  mergeQueue,
  saveQueue,
} from '../core/sync'

const time = (ms: number) => new Date(ms).toISOString().slice(11, 19) + ' UTC'

/** localStorage, or undefined where touching it throws (some private windows). */
function browserStorage(): Storage | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

export function renderSyncPanel(
  parent: HTMLElement,
  restore: (siteId: string, cells: Cell[]) => void,
): { record: (op: HazardOp) => void } {
  const storage = browserStorage()
  let queue = loadQueue(storage)
  let offline = queue.length > 0 // edits from an earlier visit are still waiting
  let shared: Shared = {}
  let log: LogEntry[] = []
  let stored = true

  const panel = document.createElement('details')
  panel.className = 'panel dust sync'
  const summary = document.createElement('summary')
  summary.textContent = 'Offline sync (simulated)'
  const intro = document.createElement('p')
  intro.className = 'dust-note'
  intro.textContent =
    'Mark hazards with the route planner. Online, each mark reaches the copy Ground shares at once. ' +
    'Offline, marks wait in this browser (they survive a reload) and merge when you reconnect.'
  const toggle = document.createElement('button')
  toggle.type = 'button'
  toggle.className = 'quiet'
  const status = document.createElement('p')
  status.className = 'dust-now'
  status.setAttribute('role', 'status')
  const groundCopy = document.createElement('p')
  groundCopy.className = 'dust-note'
  const logHeading = document.createElement('h3')
  logHeading.className = 'sync-heading'
  logHeading.textContent = 'Merge log'
  const logList = document.createElement('ol')
  logList.className = 'sync-log'
  const actions = document.createElement('div')
  actions.className = 'route-actions'
  actions.append(toggle)
  panel.append(summary, intro, actions, status, groundCopy, logHeading, logList)
  parent.append(panel)

  const draw = () => {
    toggle.textContent = offline ? 'Reconnect' : 'Go offline'
    toggle.setAttribute('aria-pressed', String(offline))
    const n = queue.length
    status.textContent = offline
      ? `Offline: ${n} edit${n === 1 ? '' : 's'} waiting to sync` +
        (stored
          ? ', kept in this browser.'
          : '. This browser will not store them: keep the tab open.')
      : 'Online: hazard marks reach Ground as you make them.'
    const counts = Object.entries(shared)
      .filter(([, cells]) => cells.length)
      .map(([site, cells]) => `${cells.length} at ${site}`)
    groundCopy.textContent = `Ground's copy: ${counts.length ? counts.join(', ') : 'no hazards'}.`
    logHeading.hidden = log.length === 0
    logList.replaceChildren(
      ...log.toReversed().map((e) => {
        const li = document.createElement('li')
        li.textContent = `${time(e.atMs)} · ${e.text} · ${e.outcome}`
        return li
      }),
    )
  }

  const persist = () => {
    stored = saveQueue(storage, queue)
  }

  toggle.addEventListener('click', () => {
    if (offline) {
      const merged = mergeQueue(shared, queue)
      shared = merged.shared
      log = [...log, ...merged.log]
      queue = []
      persist()
    }
    offline = !offline
    draw()
  })

  // Show what was marked offline before a reload, so the map matches the queue.
  if (queue.length) {
    const local = mergeQueue({}, queue).shared
    for (const [site, cells] of Object.entries(local)) restore(site, [...cells])
    panel.open = true
  }
  draw()

  return {
    record(op) {
      if (offline) {
        queue = [...queue, op]
        persist()
      } else {
        const merged = mergeQueue(shared, [op])
        shared = merged.shared
        log = [...log, ...merged.log]
      }
      draw()
    },
  }
}
