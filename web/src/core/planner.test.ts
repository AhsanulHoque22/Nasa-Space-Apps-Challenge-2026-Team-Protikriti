import { describe, expect, it } from 'vitest'
import { EMPTY_PLAN, pick } from './planner'

const a = { row: 1, col: 1 }
const b = { row: 2, col: 2 }
const c = { row: 3, col: 3 }

describe('planner pick', () => {
  it('first valid pick sets the start', () => {
    expect(pick(EMPTY_PLAN, a)).toEqual({ plan: { start: a }, event: 'start-set' })
  })

  it('second valid pick sets the goal and asks for a route', () => {
    expect(pick({ start: a }, b)).toEqual({ plan: { start: a, goal: b }, event: 'goal-set' })
  })

  it('a pick after a complete plan starts a new one', () => {
    expect(pick({ start: a, goal: b }, c)).toEqual({ plan: { start: c }, event: 'start-set' })
  })

  it('a pick outside the grid leaves the plan unchanged', () => {
    const plan = { start: a }
    expect(pick(plan, null)).toEqual({ plan, event: 'outside' })
  })
})
