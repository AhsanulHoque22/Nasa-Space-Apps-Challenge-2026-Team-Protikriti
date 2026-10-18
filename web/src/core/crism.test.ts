import { parseCrism, crismAt } from './crism'
import { describe, it, expect } from 'vitest'

describe('parseCrism', () => {
  it('throws if bin size does not match width*height*4', () => {
    const meta = { width: 2, height: 2, west: 0, south: 0, east: 1, north: 1, p02: 0, p98: 1 }
    const bin = new ArrayBuffer(8) // should be 16
    expect(() => parseCrism(meta, bin)).toThrow()
  })
  it('returns a CrismGrid with values Float32Array', () => {
    const meta = { width: 2, height: 1, west: 0, south: 0, east: 1, north: 1, p02: 0, p98: 1 }
    const bin = new Float32Array([0.1, 0.9]).buffer
    const g = parseCrism(meta, bin)
    expect(g.values[0]).toBeCloseTo(0.1)
    expect(g.values[1]).toBeCloseTo(0.9)
  })
})

describe('crismAt', () => {
  it('returns null outside the grid', () => {
    const meta = { width: 2, height: 2, west: 77, south: 18, east: 78, north: 19, p02: 0, p98: 1 }
    const bin = new Float32Array([0.2, 0.3, 0.4, 0.5]).buffer
    const g = parseCrism(meta, bin)
    expect(crismAt(g, 76, 18.5)).toBeNull()
    expect(crismAt(g, 77.5, 17)).toBeNull()
  })
  it('returns null for NaN cells', () => {
    const meta = { width: 1, height: 1, west: 0, south: 0, east: 1, north: 1, p02: 0, p98: 1 }
    const arr = new Float32Array(1)
    arr[0] = NaN
    const g = parseCrism(meta, arr.buffer)
    expect(crismAt(g, 0.5, 0.5)).toBeNull()
  })
})
