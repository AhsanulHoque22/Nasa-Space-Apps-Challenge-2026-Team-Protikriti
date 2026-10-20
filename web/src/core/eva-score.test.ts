import { evaScore } from './eva-score'
import { describe, it, expect } from 'vitest'

const flatGrid = {
  width: 3,
  height: 3,
  pixelSizeM: 25,
  maxSafeSlopeDeg: 20,
  west: 0,
  south: 0,
  east: 0.001,
  north: 0.001,
  elevationM: new Float32Array(9).fill(0),
}

describe('evaScore', () => {
  it('returns 0-100 for flat terrain with no chemical or firmness hazard', () => {
    const score = evaScore({ grid: flatGrid, thermal: null, crism: null }, 1, 1)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })

  it('returns null on a NaN elevation cell', () => {
    const g = { ...flatGrid, elevationM: new Float32Array(9).fill(NaN) }
    expect(evaScore({ grid: g, thermal: null, crism: null }, 1, 1)).toBeNull()
  })

  it('returns null when crism is provided with NaN for that cell', () => {
    const crismGrid = {
      width: 3,
      height: 3,
      west: 0,
      south: 0,
      east: 0.001,
      north: 0.001,
      p02: 0,
      p98: 1,
      values: (() => {
        const a = new Float32Array(9)
        a.fill(NaN)
        return a
      })(),
    }
    expect(evaScore({ grid: flatGrid, thermal: null, crism: crismGrid }, 1, 1)).toBeNull()
  })

  it('returns a higher score for steep terrain than flat terrain', () => {
    const steep = new Float32Array(9)
    for (let i = 0; i < 9; i++) steep[i] = Math.floor(i / 3) * 100
    const g = { ...flatGrid, elevationM: steep }
    const flat = evaScore({ grid: flatGrid, thermal: null, crism: null }, 1, 1) ?? 0
    const s = evaScore({ grid: g, thermal: null, crism: null }, 1, 1) ?? 0
    expect(s).toBeGreaterThan(flat)
  })
})
