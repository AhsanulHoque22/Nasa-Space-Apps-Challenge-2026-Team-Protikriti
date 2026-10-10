import { describe, expect, it } from 'vitest'
import {
  IDLE_SPIN_ALTITUDE_M,
  IDLE_SPIN_MAX_STEP_S,
  IDLE_SPIN_PERIOD_S,
  idleSpinStepRad,
} from './idle-spin'

describe('idle spin', () => {
  it('opens at a 500 km camera height', () => {
    expect(IDLE_SPIN_ALTITUDE_M).toBe(500_000)
  })

  it('turns one full revolution in the spin period', () => {
    // Many small frames of 1/60 s add up to the same angle as one long span.
    let total = 0
    const frame = 1 / 60
    for (let t = 0; t < IDLE_SPIN_PERIOD_S; t += frame) total += idleSpinStepRad(frame)
    expect(total).toBeCloseTo(2 * Math.PI, 1)
  })

  it('does not jump after a stalled frame (a hidden tab)', () => {
    expect(idleSpinStepRad(30)).toBe(idleSpinStepRad(IDLE_SPIN_MAX_STEP_S))
  })

  it('ignores zero, negative and non-finite time steps', () => {
    expect(idleSpinStepRad(0)).toBe(0)
    expect(idleSpinStepRad(-1)).toBe(0)
    expect(idleSpinStepRad(Number.NaN)).toBe(0)
  })
})
