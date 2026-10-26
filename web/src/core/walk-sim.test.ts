import { describe, expect, it } from 'vitest'
import { type SimPlan, advance, extendStay, startSim, turnBack } from './walk-sim'

// Three walking steps of 10 min each; the stop is at path index 1, with a 20 min stay.
const plan: SimPlan = { stepMin: [10, 10, 10], stopIndices: [1], stayMin: 20 }

describe('advance', () => {
  it('walks, stays at the stop, walks on, and ends at the last point', () => {
    let s = startSim()
    s = advance(s, 10, plan, 1) // reach the stop
    expect(s.index).toBe(1)
    expect(s.stayLeftMin).toBe(20)
    s = advance(s, 20, plan, 1) // the whole stay
    expect(s.stayLeftMin).toBe(0)
    expect(s.workMin).toBe(20)
    s = advance(s, 25, plan, 1)
    expect(s.done).toBe(true)
    expect(s.index).toBe(3)
    expect(s.walkMin).toBeCloseTo(30, 9)
    expect(s.elapsedMin).toBeCloseTo(50, 9) // stops at the end, never past it
  })

  it('walks slower at a lower pace', () => {
    const s = advance(startSim(), 10, plan, 0.5)
    expect(s.index).toBe(0)
    expect(s.fraction).toBeCloseTo(0.5, 9)
  })

  it('a longer stay adds working time and keeps the crew at the stop', () => {
    let s = advance(startSim(), 10, plan, 1)
    s = extendStay(s, 15)
    s = advance(s, 30, plan, 1)
    expect(s.index).toBe(1)
    expect(s.stayLeftMin).toBeCloseTo(5, 9)
  })

  it('cannot extend a stay while walking', () => {
    const s = extendStay(advance(startSim(), 5, plan, 1), 15)
    expect(s.stayLeftMin).toBe(0)
  })
})

describe('turnBack', () => {
  it('ends the stay and drops the stops not reached yet', () => {
    const plan2: SimPlan = { stepMin: [10, 10, 10, 10], stopIndices: [1, 3], stayMin: 20 }
    const at = advance(startSim(), 15, plan2, 1) // working at stop 1
    const t = turnBack(at, plan2.stopIndices)
    expect(t.state.stayLeftMin).toBe(0)
    expect(t.state.fraction).toBe(0)
    expect(t.state.index).toBe(1)
    expect(t.stopIndices).toEqual([1])
  })
})
