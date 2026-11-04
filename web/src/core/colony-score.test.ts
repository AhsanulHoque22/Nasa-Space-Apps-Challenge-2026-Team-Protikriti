import { describe, it, expect } from 'vitest'
import shipped from '../../public/data/colony_score.json'
import { colonyScoreAt, parseColonyScore } from './colony-score'

// The file the pipeline really writes, so a change to its fields fails here.
const meta = shipped as Record<string, unknown>

describe('parseColonyScore', () => {
  it('reads the metadata the pipeline writes, sources and caveat included', () => {
    const grid = parseColonyScore(meta, new ArrayBuffer(360 * 180 * 6))
    expect(grid.width).toBe(360)
    expect(grid.height).toBe(180)
    expect(grid.channels).toEqual(['solar', 'ice', 'minerals', 'shelter', 'stability', 'wind'])
    expect(grid.sources).toHaveLength(6)
    expect(grid.sources[0]).toContain('Appelbaum')
    expect(grid.caveat).toContain('planning aid')
  })

  it('refuses a data file of the wrong size', () => {
    expect(() => parseColonyScore(meta, new ArrayBuffer(10))).toThrow(/colony_score\.bin/)
  })
})

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
