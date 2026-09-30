import { describe, expect, it } from 'vitest'
import { nearestWithin } from './hit'

const dots = [
  { id: 'stop:m20:1', x: 100, y: 100 },
  { id: 'stop:m20:2', x: 112, y: 100 },
  { id: 'activity:0', x: 300, y: 300 },
]

describe('nearestWithin', () => {
  it('returns the closest point to the click', () => {
    expect(nearestWithin(dots, 109, 101, 20)).toBe('stop:m20:2')
  })

  it('ignores points farther than the radius', () => {
    expect(nearestWithin(dots, 200, 200, 20)).toBeUndefined()
  })

  it('counts a point exactly on the radius', () => {
    expect(nearestWithin(dots, 300, 320, 20)).toBe('activity:0')
  })

  it('returns undefined when there is nothing to hit', () => {
    expect(nearestWithin([], 0, 0, 20)).toBeUndefined()
  })
})
