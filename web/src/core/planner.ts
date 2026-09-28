/** Click-to-plan state: the first pick is the start, every later pick appends a science stop. */
import type { Cell } from './grid'

export type Plan = { stops: Cell[] }
export type PickEvent = 'start-set' | 'stop-added' | 'outside'

export const EMPTY_PLAN: Plan = { stops: [] }

/** `cell` is null when the pick is outside the terrain grid or on nodata. */
export function pick(plan: Plan, cell: Cell | null): { plan: Plan; event: PickEvent } {
  if (!cell) return { plan, event: 'outside' }
  const stops = [...plan.stops, cell]
  return { plan: { stops }, event: stops.length === 1 ? 'start-set' : 'stop-added' }
}
