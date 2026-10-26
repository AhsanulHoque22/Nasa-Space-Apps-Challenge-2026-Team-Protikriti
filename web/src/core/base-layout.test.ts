import { describe, expect, it } from 'vitest'
import {
  BASE_SLOPE_LIMIT_DEG,
  REACTOR_STANDOFF_M,
  type SunSample,
  cellSeesSun,
  checkLayout,
  layoutHints,
  shadeLoss,
} from './base-layout'
import { type Grid, cellToLonLat } from './grid'

const PX = 20 // metres per cell
const DEG_PER_M = 180 / (Math.PI * 3_396_190)

/** A grid with true geographic bounds (20 m cells near the equator), from rows of heights. */
function grid(rows: number[][]): Grid {
  const height = rows.length
  const width = rows[0]?.length ?? 0
  return {
    width,
    height,
    pixelSizeM: PX,
    west: 0,
    east: width * PX * DEG_PER_M,
    north: height * PX * DEG_PER_M,
    south: 0,
    maxSafeSlopeDeg: 15,
    elevationM: Float32Array.from(rows.flat()),
  }
}

const flat = (w: number, h: number) => Array.from({ length: h }, () => Array(w).fill(0))
const at = (g: Grid, row: number, col: number) => {
  const [lon, lat] = cellToLonLat(g, { row, col })
  return { lon, lat }
}
/** Sun due east at 30° and due west at 30°, equal weight. */
const SUN: SunSample[] = [
  { azimuthDeg: 90, elevationDeg: 30, weight: 1 },
  { azimuthDeg: 270, elevationDeg: 30, weight: 1 },
]

describe('cellSeesSun', () => {
  it('sees the sun over flat ground', () => {
    const g = grid(flat(20, 5))
    expect(cellSeesSun(g, { row: 2, col: 5 }, 90, 10)).toBe(true)
  })

  it('is shadowed by a wall between it and the sun', () => {
    const rows = flat(20, 5)
    for (const r of rows) r[10] = 200 // 200 m wall 5 cells (100 m) east of col 5
    const g = grid(rows)
    expect(cellSeesSun(g, { row: 2, col: 5 }, 90, 30)).toBe(false) // tan 30° × 100 m = 58 m < 200 m
    expect(cellSeesSun(g, { row: 2, col: 5 }, 270, 30)).toBe(true) // the sun is behind the wall
  })
})

describe('shadeLoss', () => {
  it('is the weighted share of daylight the terrain blocks', () => {
    const rows = flat(20, 5)
    for (const r of rows) r[10] = 200
    const g = grid(rows)
    expect(shadeLoss(g, { row: 2, col: 5 }, SUN)).toBeCloseTo(0.5, 9)
    expect(shadeLoss(g, { row: 2, col: 15 }, SUN)).toBeCloseTo(0.5, 9) // west sun blocked here
    expect(shadeLoss(grid(flat(20, 5)), { row: 2, col: 5 }, SUN)).toBe(0)
  })
})

describe('checkLayout', () => {
  const wide = grid(flat(80, 10)) // 1.6 km east to west
  const need = { reactor: true, arrays: true }

  it('passes flat, sunny ground with the reactor more than 1 km from the habitat', () => {
    const r = checkLayout(
      wide,
      {
        habitat: at(wide, 5, 5),
        reactor: at(wide, 5, 5 + Math.ceil(REACTOR_STANDOFF_M / PX) + 1),
        arrays: at(wide, 2, 8),
        oxygen: at(wide, 8, 8),
      },
      need,
      SUN,
    )
    expect(r.go).toBe(true)
    expect(r.parts.every((p) => p.problems.length === 0)).toBe(true)
  })

  it('names a reactor that is too close, and by how much', () => {
    const r = checkLayout(
      wide,
      {
        habitat: at(wide, 5, 5),
        reactor: at(wide, 5, 35),
        arrays: at(wide, 2, 8),
        oxygen: at(wide, 8, 8),
      },
      need,
      SUN,
    )
    const reactor = r.parts.find((p) => p.part === 'reactor')
    expect(r.go).toBe(false)
    expect(reactor?.problems[0]).toMatch(/600 m from the habitat/)
    expect(reactor?.problems[0]).toMatch(/1 km/)
  })

  it('names a part on ground steeper than the limit, with its slope', () => {
    const rows = flat(80, 10).map((row) => row.map((_, c) => (c < 20 ? c * PX * 0.5 : 0))) // 26.6° ramp
    const g = grid(rows)
    const r = checkLayout(
      g,
      { habitat: at(g, 5, 10), reactor: at(g, 5, 75), arrays: at(g, 2, 30), oxygen: at(g, 8, 30) },
      need,
      SUN,
    )
    const habitat = r.parts.find((p) => p.part === 'habitat')
    expect(habitat?.problems[0]).toMatch(/27°/)
    expect(habitat?.problems[0]).toMatch(new RegExp(`${BASE_SLOPE_LIMIT_DEG}°`))
  })

  it('flags arrays that lose too much sunlight to terrain shadow', () => {
    const rows = flat(80, 10)
    for (const r of rows) r[12] = 400
    const g = grid(rows)
    const r = checkLayout(
      g,
      { habitat: at(g, 5, 30), reactor: at(g, 5, 79), arrays: at(g, 5, 10), oxygen: at(g, 8, 40) },
      need,
      SUN,
    )
    expect(r.parts.find((p) => p.part === 'arrays')?.problems[0]).toMatch(/50% of the sunlight/)
  })

  it('reports parts not yet placed, and parts off the mapped terrain', () => {
    const r = checkLayout(wide, { habitat: { lon: 5, lat: 5 } }, need, SUN)
    expect(r.go).toBe(false)
    expect(r.parts.find((p) => p.part === 'habitat')?.problems[0]).toMatch(/outside the mapped/)
    expect(r.parts.find((p) => p.part === 'oxygen')?.problems[0]).toMatch(/Not placed/)
  })

  it('does not ask for parts that were not packed', () => {
    const r = checkLayout(
      wide,
      { habitat: at(wide, 5, 5), oxygen: at(wide, 8, 8) },
      { reactor: false, arrays: false },
      SUN,
    )
    expect(r.parts.map((p) => p.part)).toEqual(['habitat', 'oxygen'])
    expect(r.go).toBe(true)
  })
})

describe('layoutHints', () => {
  it('points a too-close reactor to the nearest passing ground, by direction and distance', () => {
    const wide = grid(flat(80, 10))
    const hints = layoutHints(
      wide,
      {
        habitat: at(wide, 5, 5),
        reactor: at(wide, 5, 35),
        arrays: at(wide, 2, 8),
        oxygen: at(wide, 8, 8),
      },
      { reactor: true, arrays: true },
      SUN,
    )
    const h = hints.find((x) => x.part === 'reactor')
    expect(h?.text).toMatch(/east/)
    expect(h?.distanceM).toBeGreaterThan(350)
    expect(h?.distanceM).toBeLessThan(500)
  })

  it('gives no hint for parts that already pass', () => {
    const wide = grid(flat(80, 10))
    const hints = layoutHints(
      wide,
      {
        habitat: at(wide, 5, 5),
        reactor: at(wide, 5, 70),
        arrays: at(wide, 2, 8),
        oxygen: at(wide, 8, 8),
      },
      { reactor: true, arrays: true },
      SUN,
    )
    expect(hints).toEqual([])
  })
})
