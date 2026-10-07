/**
 * Offline-first hazard markers: edits made while the link is down wait in a queue (kept in browser
 * storage), then merge into the copy Ground shares, with a log of what each edit did.
 */
import type { Cell } from './grid'

export type HazardOp =
  | { op: 'add'; site: string; cell: Cell; atMs: number }
  | { op: 'clear'; site: string; atMs: number }

/** Hazards per site, as Ground has them. */
export type Shared = Readonly<Record<string, readonly Cell[]>>

export type LogEntry = {
  atMs: number
  text: string
  outcome: 'applied' | 'already there' | 'nothing to clear'
}

export const QUEUE_KEY = 'martian-map:hazard-queue'

const same = (a: Cell, b: Cell) => a.row === b.row && a.col === b.col

/** Apply queued edits in the order they were made. Pure: returns new values. */
export function mergeQueue(
  shared: Shared,
  queue: readonly HazardOp[],
): { shared: Shared; log: LogEntry[] } {
  const next: Record<string, Cell[]> = Object.fromEntries(
    Object.entries(shared).map(([site, cells]) => [site, [...cells]]),
  )
  const log: LogEntry[] = []
  for (const op of [...queue].sort((a, b) => a.atMs - b.atMs)) {
    const cells = (next[op.site] ??= [])
    if (op.op === 'add') {
      const text = `Hazard at ${op.site}, cell ${op.cell.row},${op.cell.col}`
      if (cells.some((c) => same(c, op.cell))) {
        log.push({ atMs: op.atMs, text, outcome: 'already there' })
      } else {
        cells.push(op.cell)
        log.push({ atMs: op.atMs, text, outcome: 'applied' })
      }
    } else {
      const text = `Clear ${cells.length} hazard${cells.length === 1 ? '' : 's'} at ${op.site}`
      log.push({ atMs: op.atMs, text, outcome: cells.length ? 'applied' : 'nothing to clear' })
      next[op.site] = []
    }
  }
  return { shared: next, log }
}

const isCell = (c: unknown): c is Cell =>
  typeof c === 'object' &&
  c !== null &&
  Number.isInteger((c as Cell).row) &&
  Number.isInteger((c as Cell).col)

const isOp = (o: unknown): o is HazardOp => {
  const op = o as Partial<HazardOp> & { cell?: unknown }
  return (
    typeof op === 'object' &&
    op !== null &&
    typeof op.site === 'string' &&
    typeof op.atMs === 'number' &&
    (op.op === 'clear' || (op.op === 'add' && isCell(op.cell)))
  )
}

/** The queue from browser storage; empty if storage is unavailable or holds anything unexpected. */
export function loadQueue(storage: Storage | undefined): HazardOp[] {
  try {
    const raw = storage?.getItem(QUEUE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.every(isOp) ? parsed : []
  } catch {
    return [] // private window or blocked storage: the queue just lives in memory
  }
}

/** Save the queue; false if storage refused (the caller says so instead of losing edits silently). */
export function saveQueue(storage: Storage | undefined, queue: readonly HazardOp[]): boolean {
  try {
    if (!storage) return false
    if (queue.length) storage.setItem(QUEUE_KEY, JSON.stringify(queue))
    else storage.removeItem(QUEUE_KEY)
    return true
  } catch {
    return false
  }
}
