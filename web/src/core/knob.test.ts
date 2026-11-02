import { describe, expect, it } from 'vitest'
import { knobAngleDeg, knobIndexFromPointer, stepIndex } from './knob'

describe('knobAngleDeg', () => {
  it('sweeps from -135 to +135 across its detents', () => {
    expect(knobAngleDeg(0, 5)).toBe(-135)
    expect(knobAngleDeg(2, 5)).toBe(0)
    expect(knobAngleDeg(4, 5)).toBe(135)
  })

  it('points to the middle when it has one detent', () => {
    expect(knobAngleDeg(0, 1)).toBe(0)
  })
})

describe('knobIndexFromPointer', () => {
  const centre = { x: 100, y: 100 }
  it('snaps to the nearest detent', () => {
    expect(knobIndexFromPointer(centre, { x: 100, y: 50 }, 5)).toBe(2) // straight up
    expect(knobIndexFromPointer(centre, { x: 150, y: 150 }, 5)).toBe(4) // lower right
    expect(knobIndexFromPointer(centre, { x: 50, y: 150 }, 5)).toBe(0) // lower left
  })

  it('stays at the nearer stop in the dead zone at the bottom', () => {
    expect(knobIndexFromPointer(centre, { x: 101, y: 150 }, 5)).toBe(4)
    expect(knobIndexFromPointer(centre, { x: 99, y: 150 }, 5)).toBe(0)
  })
})

describe('stepIndex', () => {
  it('moves one detent and holds at the ends', () => {
    expect(stepIndex(2, 1, 5)).toBe(3)
    expect(stepIndex(4, 1, 5)).toBe(4)
    expect(stepIndex(0, -1, 5)).toBe(0)
  })
})
