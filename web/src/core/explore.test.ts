import { describe, expect, it } from 'vitest'
import { type Walker, step } from './explore'
import { toblerSpeedMs } from './route'
import { makeGrid } from './test-grids'

// makeGrid spans lon 0..1, lat 0..1 with 20 m "pixels" (geometry here uses real metres/degree)
const flat = makeGrid(Array.from({ length: 5 }, () => [0, 0, 0, 0, 0]))
const start: Walker = { lon: 0.5, lat: 0.5, headingDeg: 90, distanceM: 0, warning: null }
const M_PER_DEG = (3_396_190 * Math.PI) / 180

describe('explore step', () => {
  it('walks east at Tobler flat speed for the elapsed time', () => {
    const w = step(start, { forward: 1, strafe: 0, turnDeg: 0 }, 1, flat)
    const v = toblerSpeedMs(0)
    expect(w.distanceM).toBeCloseTo(v)
    expect((w.lon - 0.5) * M_PER_DEG * Math.cos((0.5 * Math.PI) / 180)).toBeCloseTo(v, 3)
    expect(w.lat).toBeCloseTo(0.5)
  })

  it('turning wraps heading into 0..360', () => {
    expect(step(start, { forward: 0, strafe: 0, turnDeg: 300 }, 0.1, flat).headingDeg).toBeCloseTo(
      30,
    )
    expect(step(start, { forward: 0, strafe: 0, turnDeg: -100 }, 0.1, flat).headingDeg).toBeCloseTo(
      350,
    )
  })

  it('stops at the edge of the mapped site instead of walking off it', () => {
    const edge: Walker = { ...start, lon: 0.9999999 }
    const w = step(edge, { forward: 1, strafe: 0, turnDeg: 0 }, 5, flat)
    expect(w.lon).toBe(edge.lon)
    expect(w.warning).toMatch(/edge/i)
  })

  it('stops before stepping onto missing data', () => {
    const holes = makeGrid(Array.from({ length: 5 }, () => [0, 0, 0, NaN, NaN]))
    // ~0.1° east (≈5.9 km at Tobler flat speed) lands in the NaN column, not past the edge
    const w = step({ ...start, lon: 0.55 }, { forward: 1, strafe: 0, turnDeg: 0 }, 4200, holes)
    expect(w.lon).toBe(0.55)
    expect(w.warning).toMatch(/no terrain data/i)
  })

  it('warns on ground steeper than the safe limit', () => {
    const ramp = makeGrid(Array.from({ length: 5 }, () => [0, 40, 80, 120, 160])) // 63°
    const w = step({ ...start, lon: 0.3 }, { forward: 1, strafe: 0, turnDeg: 0 }, 0.5, ramp)
    expect(w.warning).toMatch(/steep/i)
  })
})
