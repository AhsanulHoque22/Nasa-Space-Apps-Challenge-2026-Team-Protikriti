import { describe, expect, it } from 'vitest'
import { EVA_LIMITS, evaCard } from './eva-card'
import { toblerSpeedMs } from './route'
import { SCIENCE_STOP_MIN } from './summary'
import { makeGrid } from './test-grids'

const row = (cols: number[]) => cols.map((col) => ({ row: 0, col }))
const FLAT_CELL_MIN = 20 / toblerSpeedMs(0) / 60 // one 20 m step on flat ground

describe('evaCard', () => {
  it('a short flat walk is GO with the whole budget minus the walkback as margin', () => {
    const g = makeGrid([[0, 0, 0, 0, 0]])
    const path = row([0, 1, 2, 3, 4])
    const card = evaCard(g, path, [path[0], path[4]])
    const walking = 4 * FLAT_CELL_MIN
    expect(card.verdict).toBe('GO')
    expect(card.failIndex).toBeNull()
    expect(card.budgetMin).toBe(EVA_LIMITS.maxEvaMin - EVA_LIMITS.backupMin)
    expect(card.walkbackMin).toBeCloseTo(walking)
    const need = walking + SCIENCE_STOP_MIN + walking * (1 + EVA_LIMITS.walkbackPad)
    expect(card.tightestMarginMin).toBeCloseTo(card.budgetMin - need)
  })

  it('names the first path point from which the crew can no longer get home', () => {
    const g = makeGrid([Array(11).fill(0)])
    const path = row([...Array(11).keys()])
    const limits = { ...EVA_LIMITS, maxEvaMin: 4, backupMin: 1 } // 3 min of usable time
    const card = evaCard(g, path, [path[0]], limits)
    // at point i: out i*t + back 1.2*i*t = 2.2*i*t; 5 steps need 2.62 min, 6 need 3.14
    expect(card.verdict).toBe('NO-GO')
    expect(card.failIndex).toBe(6)
    expect(card.tightestMarginMin).toBeLessThan(0)
  })

  it('counts science-stop time as time away from home', () => {
    const g = makeGrid([[0, 0, 0]])
    const path = row([0, 1, 2])
    const limits = { ...EVA_LIMITS, maxEvaMin: 22, backupMin: 1 } // 21 min usable
    expect(evaCard(g, path, [path[0]], limits).verdict).toBe('GO')
    const withStop = evaCard(g, path, [path[0], path[2]], limits)
    expect(withStop.verdict).toBe('NO-GO')
    expect(withStop.failIndex).toBe(2)
  })

  it('times the walk home uphill when the way out was downhill', () => {
    const g = makeGrid([[0, -2, -4, -6, -8]])
    const path = row([0, 1, 2, 3, 4])
    const out = evaCard(g, path, [path[0]])
    const flat = evaCard(makeGrid([[0, 0, 0, 0, 0]]), path, [path[0]])
    expect(out.walkbackMin).toBeGreaterThan(flat.walkbackMin)
  })

  it('a start with no route has the full budget and nothing to walk back', () => {
    const g = makeGrid([[0]])
    const card = evaCard(g, row([0]), [{ row: 0, col: 0 }])
    expect(card).toMatchObject({ verdict: 'GO', walkbackMin: 0, failIndex: null })
    expect(card.tightestMarginMin).toBe(card.budgetMin)
  })

  it('rejects a stop that is not on the path instead of guessing', () => {
    const g = makeGrid([[0, 0, 0]])
    expect(() =>
      evaCard(g, row([0, 1]), [
        { row: 0, col: 0 },
        { row: 0, col: 2 },
      ]),
    ).toThrow(/not on the path/)
  })
})
