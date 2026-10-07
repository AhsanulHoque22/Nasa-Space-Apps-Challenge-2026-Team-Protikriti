import { describe, expect, it } from 'vitest'
import { solarLongitudeDeg, sunPosition } from './mars-time'
import {
  SOLAR_CONSTANT_W_M2,
  SOL_SECONDS,
  heliocentricDistanceAu,
  solarEnergyKwh,
  sunlitMask,
} from './solar'
import { makeGrid } from './test-grids'

const DAY = 86_400_000

/** A UTC time when Mars is near the given solar longitude (within a degree or so). */
function whenLs(target: number): number {
  const start = Date.UTC(2024, 0, 1)
  let best = start
  for (let t = start; t < start + 700 * DAY; t += DAY / 4) {
    const d = Math.abs(((solarLongitudeDeg(t) - target + 540) % 360) - 180)
    if (d < Math.abs(((solarLongitudeDeg(best) - target + 540) % 360) - 180)) best = t
  }
  return best
}

describe('heliocentricDistanceAu', () => {
  it('stays between perihelion (1.381 AU) and aphelion (1.666 AU) over a Mars year', () => {
    const r = Array.from({ length: 700 }, (_, d) =>
      heliocentricDistanceAu(Date.UTC(2024, 0, 1) + d * DAY),
    )
    expect(Math.min(...r)).toBeCloseTo(1.381, 2)
    expect(Math.max(...r)).toBeCloseTo(1.666, 2)
  })

  it('is closest near Ls 250 (perihelion) and farthest near Ls 70 (aphelion)', () => {
    expect(heliocentricDistanceAu(whenLs(251))).toBeLessThan(1.39)
    expect(heliocentricDistanceAu(whenLs(71))).toBeGreaterThan(1.66)
  })
})

describe('sunlitMask', () => {
  it('lights all of a flat grid when the sun is up', () => {
    const g = makeGrid(Array.from({ length: 5 }, () => [0, 0, 0, 0, 0]))
    expect(Array.from(sunlitMask(g, 120, 30)).every((v) => v === 1)).toBe(true)
  })

  it('casts a wall shadow on the side away from the sun, as long as the geometry says', () => {
    // a 30 m wall at column 5; sun due east (azimuth 90) at 45°: the shadow reaches 30 m, one cell
    const row = [0, 0, 0, 0, 0, 30, 0, 0, 0, 0]
    const g = makeGrid([row, row, row])
    const lit = sunlitMask(g, 90, 45)
    const at = (c: number) => lit[1 * 10 + c]
    expect(at(5)).toBe(1) // the wall top
    expect(at(4)).toBe(0) // right behind it (west), in shadow
    expect(at(2)).toBe(1) // beyond the shadow length
    expect(at(7)).toBe(1) // the sunny side
  })

  it('makes a longer shadow when the sun is lower', () => {
    const row = [0, 0, 0, 0, 0, 0, 20, 0]
    const g = makeGrid([row, row, row])
    const high = sunlitMask(g, 90, 45)
    const low = sunlitMask(g, 90, 10) // 20 m / tan 10° = 113 m: about 5 cells
    const shadowed = (m: Uint8Array) => [0, 1, 2, 3, 4, 5].filter((c) => !m[8 + c]).length
    expect(shadowed(low)).toBeGreaterThan(shadowed(high))
  })

  it('also works for a sun from the north-west (the row-dominant and negative directions)', () => {
    const g = makeGrid([
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 30, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ])
    const lit = sunlitMask(g, 315, 40) // sun to the north-west: shadow falls south-east
    expect(lit[3 * 5 + 3]).toBe(0)
    expect(lit[1 * 5 + 1]).toBe(1)
  })
})

describe('solarEnergyKwh', () => {
  const lat = 18.4
  const lon = 77.5

  it('on flat ground equals the sum of flux x sin(elevation) over the sol', () => {
    const g = makeGrid(Array.from({ length: 3 }, () => [0, 0, 0]))
    const t0 = Date.UTC(2025, 5, 1)
    const samples = 48
    const flux = SOLAR_CONSTANT_W_M2 / heliocentricDistanceAu(t0) ** 2
    let expected = 0
    for (let i = 0; i < samples; i++) {
      const sun = sunPosition(t0 + ((i + 0.5) * SOL_SECONDS * 1000) / samples, lon, lat)
      if (sun.elevationDeg > 0)
        expected +=
          (flux * Math.sin((sun.elevationDeg * Math.PI) / 180) * SOL_SECONDS) / samples / 3.6e6
    }
    const e = solarEnergyKwh(g, t0, lon, lat, samples)
    expect(e[4]).toBeCloseTo(expected, 3)
    expect(expected).toBeGreaterThan(1) // a few kWh per square metre per sol at the top of the air
  })

  it('gives a slope facing the sun more energy than one facing away (southern summer, sun to the south)', () => {
    const t0 = whenLs(270)
    // Row 0 is the north edge: height falling with the row number means the ground faces south.
    const facingSouth = makeGrid(Array.from({ length: 5 }, (_, r) => Array(5).fill(-r * 3)))
    const facingNorth = makeGrid(Array.from({ length: 5 }, (_, r) => Array(5).fill(r * 3)))
    const s = solarEnergyKwh(facingSouth, t0, lon, lat, 48)[12] as number
    const n = solarEnergyKwh(facingNorth, t0, lon, lat, 48)[12] as number
    expect(s).toBeGreaterThan(n)
  })

  it('leaves cells without elevation data as NaN, never 0', () => {
    const g = makeGrid([
      [0, 0, 0],
      [0, NaN, 0],
      [0, 0, 0],
    ])
    expect(Number.isNaN(solarEnergyKwh(g, Date.UTC(2025, 5, 1), lon, lat, 24)[4])).toBe(true)
  })
})
