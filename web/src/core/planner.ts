/** Click-to-plan state: start, then goal; a third pick starts over. */
import type { Cell } from './grid'

export type Plan = { start?: Cell; goal?: Cell }
export type PickEvent = 'start-set' | 'goal-set' | 'outside'

export const EMPTY_PLAN: Plan = {}

/** `cell` is null when the pick is outside the terrain grid or on nodata. */
export function pick(plan: Plan, cell: Cell | null): { plan: Plan; event: PickEvent } {
  if (!cell) return { plan, event: 'outside' }
  if (plan.start && !plan.goal)
    return { plan: { start: plan.start, goal: cell }, event: 'goal-set' }
  return { plan: { start: cell }, event: 'start-set' }
}
