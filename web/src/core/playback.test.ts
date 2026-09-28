import { describe, expect, it } from 'vitest'
import { advancePlayhead } from './playback'

describe('advancePlayhead', () => {
  it('advances ~40 sols per second at 60 fps (fractional progress is kept)', () => {
    let head = 100
    for (let i = 0; i < 60; i++) head = advancePlayhead(head, 1000 / 60, 40, 5000)
    expect(head).toBeCloseTo(140, 5)
  })
  it('stops exactly at the end of the mission', () => {
    expect(advancePlayhead(4999.5, 1000, 40, 5000)).toBe(5000)
  })
})
