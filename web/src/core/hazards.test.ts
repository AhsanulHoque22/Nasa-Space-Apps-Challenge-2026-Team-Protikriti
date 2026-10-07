import { describe, expect, it } from 'vitest'
import { hazardMask, touchesHazard } from './hazards'
import { makeGrid } from './test-grids'

const g = makeGrid(Array.from({ length: 7 }, () => Array(7).fill(0))) // 20 m cells
const at = (m: Uint8Array, row: number, col: number) => m[row * 7 + col]

describe('hazardMask', () => {
  it('blocks the cells within the radius of a hazard, measured in metres', () => {
    const m = hazardMask(g, [{ row: 3, col: 3 }], 40)
    expect(at(m, 3, 3)).toBe(1)
    expect(at(m, 3, 5)).toBe(1) // 40 m east: on the edge, blocked
    expect(at(m, 4, 4)).toBe(1) // 28 m diagonal
    expect(at(m, 3, 6)).toBe(0) // 60 m
    expect(at(m, 5, 5)).toBe(0) // 56 m diagonal
  })

  it('clips at the grid edge instead of throwing', () => {
    const m = hazardMask(g, [{ row: 0, col: 0 }], 40)
    expect(at(m, 0, 0)).toBe(1)
    expect(at(m, 0, 2)).toBe(1)
    expect(m).toHaveLength(49)
  })

  it('blocks nothing without hazards', () => {
    expect(hazardMask(g, [], 40).every((v) => v === 0)).toBe(true)
  })
})

describe('touchesHazard', () => {
  it('is true when any path cell is blocked', () => {
    const m = hazardMask(g, [{ row: 3, col: 3 }], 20)
    expect(
      touchesHazard(
        [
          { row: 0, col: 0 },
          { row: 3, col: 4 },
        ],
        7,
        m,
      ),
    ).toBe(true)
    expect(
      touchesHazard(
        [
          { row: 0, col: 0 },
          { row: 0, col: 1 },
        ],
        7,
        m,
      ),
    ).toBe(false)
  })
})
