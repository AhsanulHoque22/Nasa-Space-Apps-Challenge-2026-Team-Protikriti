import { describe, expect, it } from 'vitest'
import { EMPTY_PLAN, pick } from './planner'

const a = { row: 1, col: 1 }
const b = { row: 2, col: 2 }
const c = { row: 3, col: 3 }

describe('planner pick', () => {
  it('first valid pick sets the start', () => {
    expect(pick(EMPTY_PLAN, a)).toEqual({ plan: { stops: [a] }, event: 'start-set' })
  })

  it('each later pick appends a science stop', () => {
    const one = pick(EMPTY_PLAN, a).plan
    const two = pick(one, b)
    expect(two).toEqual({ plan: { stops: [a, b] }, event: 'stop-added' })
    expect(pick(two.plan, c).plan.stops).toEqual([a, b, c])
  })

  it('does not mutate the previous plan', () => {
    const one = pick(EMPTY_PLAN, a).plan
    pick(one, b)
    expect(one.stops).toEqual([a])
  })

  it('a pick outside the grid leaves the plan unchanged', () => {
    const plan = { stops: [a] }
    expect(pick(plan, null)).toEqual({ plan, event: 'outside' })
  })
})

describe('planner same-point pick', () => {
  it('re-picking the current last stop adds nothing', () => {
    const plan = { stops: [a, b] }
    expect(pick(plan, { row: 2, col: 2 })).toEqual({ plan, event: 'same-point' })
  })

  it('re-picking an earlier stop is allowed (walk back to base)', () => {
    expect(pick({ stops: [a, b] }, a).plan.stops).toEqual([a, b, a])
  })
})
