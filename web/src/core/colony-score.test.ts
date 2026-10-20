import { describe, it, expect } from 'vitest'
import { colonyScoreAt, parseColonyScore } from './colony-score'

const meta = {
  width: 360,
  height: 180,
  west: -180,
  east: 180,
  north: 90,
  south: -90,
  channels: ['solar', 'ice', 'minerals', 'shelter', 'stability', 'wind'],
  nodata: 255,
  sources: {},
}

describe('colonyScoreAt', () => {
  it('returns correct scores for a 360x180 grid at equator/prime meridian', () => {
    const data = new Uint8Array(360 * 180 * 6).fill(50)
    const grid = parseColonyScore(meta, data.buffer)
    const score = colonyScoreAt(grid, 0, 0)
    expect(score.solar).toBe(50)
    expect(score.ice).toBe(50)
  })

  it('returns null for nodata channels', () => {
    const data = new Uint8Array(360 * 180 * 6).fill(255)
    const grid = parseColonyScore(meta, data.buffer)
    const score = colonyScoreAt(grid, 0, 0)
    expect(score.solar).toBeNull()
    expect(score.ice).toBeNull()
  })

  it('wraps longitude at 180/-180 boundary', () => {
    const data = new Uint8Array(360 * 180 * 6).fill(0)
    const row = 90
    const col = 359
    data[(row * 360 + col) * 6] = 42
    const grid = parseColonyScore(meta, data.buffer)
    expect(colonyScoreAt(grid, 179.9, 0).solar).toBe(42)
  })

  it('clamps to grid boundary at north pole', () => {
    const data = new Uint8Array(360 * 180 * 6).fill(77)
    const grid = parseColonyScore(meta, data.buffer)
    expect(() => colonyScoreAt(grid, 0, 89.9)).not.toThrow()
  })
})
