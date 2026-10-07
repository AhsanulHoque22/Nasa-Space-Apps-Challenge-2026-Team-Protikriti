import { describe, expect, it } from 'vitest'
import { SIGHT_HEIGHT_M, outOfSightFraction, sightRaster, viewshed } from './viewshed'
import type { Grid } from './grid'
import { makeGrid } from './test-grids'

const obs = { row: 0, col: 0 }
const idx = (g: { width: number }, row: number, col: number) => row * g.width + col

describe('viewshed', () => {
  it('sees nearby flat ground and its own cell', () => {
    const g = makeGrid([Array(20).fill(0)])
    const v = viewshed(g, obs)
    expect(v[0]).toBe(1)
    expect(v[10]).toBe(1)
  })

  it('loses flat ground beyond the Mars horizon: curvature hides distant cells', () => {
    const g = makeGrid([Array(400).fill(0)]) // 20 m cells: 8 km
    const v = viewshed(g, obs)
    expect(v[100]).toBe(1) // 2 km
    expect(v[390]).toBe(0) // 7.8 km: the ground curves away by more than eye + target height
  })

  it('hides ground behind a ridge but not the ridge itself', () => {
    const g = makeGrid([[0, 0, 0, 12, 0, 0, 0]])
    const v = viewshed(g, obs)
    expect(v[2]).toBe(1)
    expect(v[3]).toBe(1) // the ridge top is in view
    expect(v[4]).toBe(0)
    expect(v[6]).toBe(0)
  })

  it('does not hide ground behind a mound lower than the observer eye line', () => {
    const g = makeGrid([[0, 0, 0.5, 0, 0, 0]])
    expect(viewshed(g, obs)[5]).toBe(1)
  })

  it('treats missing terrain data as blocking, and never sees a cell with no data', () => {
    const g = makeGrid([[0, 0, NaN, 0, 0]])
    const v = viewshed(g, obs)
    expect(v[2]).toBe(0)
    expect(v[3]).toBe(0)
    expect(v[4]).toBe(0)
  })

  it('works in two dimensions', () => {
    const g = makeGrid([
      [0, 0, 0],
      [0, 20, 0],
      [0, 0, 0],
    ])
    const v = viewshed(g, obs)
    expect(v[idx(g, 2, 2)]).toBe(0) // behind the mound on the diagonal
    expect(v[idx(g, 0, 2)]).toBe(1) // along the open edge
  })
})

describe('outOfSightFraction', () => {
  const g = makeGrid([Array(6).fill(0)])
  const path = [0, 1, 2, 3, 4, 5].map((col) => ({ row: 0, col }))

  it('is the share of the route length that cannot see the start', () => {
    const visible = Uint8Array.from([1, 1, 1, 0, 0, 0])
    // steps arrive at cells 1..5: cells 3, 4, 5 are hidden, so 3 of 5 steps
    expect(outOfSightFraction(g, path, visible)).toBeCloseTo(3 / 5)
  })

  it('is 0 when everything is in view and for a route of one point', () => {
    expect(outOfSightFraction(g, path, new Uint8Array(6).fill(1))).toBe(0)
    expect(
      outOfSightFraction(g, [path[0] as { row: number; col: number }], new Uint8Array(6)),
    ).toBe(0)
  })
})

describe('sightRaster', () => {
  it('leaves seen ground clear and shades hidden ground with a hatch, not a flat tint', () => {
    const width = 12
    const visible = new Uint8Array(width * 2)
    visible.fill(1, 0, width) // top row seen, bottom row hidden
    const px = sightRaster(width, 2, visible)
    const alpha = (row: number, col: number) => px[(row * width + col) * 4 + 3] as number
    expect(alpha(0, 3)).toBe(0)
    const hidden = Array.from({ length: width }, (_, c) => alpha(1, c))
    expect(hidden.every((a) => a > 0)).toBe(true)
    expect(new Set(hidden).size).toBeGreaterThan(1) // the hatch varies along the row
  })

  it('rejects a mask of the wrong size', () => {
    expect(() => sightRaster(4, 4, new Uint8Array(3))).toThrow(/size/)
  })
})

/** Brute-force reference: one full ray per cell. Slow, simple, and the thing viewshed must match. */
function viewshedByRays(g: Grid, observer: { row: number; col: number }): Uint8Array {
  const curve = 1 / (2 * 3_396_190)
  const eyeZ = (g.elevationM[observer.row * g.width + observer.col] as number) + SIGHT_HEIGHT_M
  const out = new Uint8Array(g.width * g.height)
  for (let row = 0; row < g.height; row++) {
    for (let col = 0; col < g.width; col++) {
      const dr = row - observer.row
      const dc = col - observer.col
      const steps = Math.max(Math.abs(dr), Math.abs(dc))
      const target = g.elevationM[row * g.width + col] as number
      if (steps === 0) {
        out[row * g.width + col] = 1
        continue
      }
      let maxAngle = -Infinity
      for (let i = 1; i < steps; i++) {
        const r = observer.row + Math.round((dr * i) / steps)
        const c = observer.col + Math.round((dc * i) / steps)
        const d = Math.hypot((dr * i) / steps, (dc * i) / steps) * g.pixelSizeM
        maxAngle = Math.max(
          maxAngle,
          ((g.elevationM[r * g.width + c] as number) - eyeZ - d * d * curve) / d,
        )
      }
      const d = Math.hypot(dr, dc) * g.pixelSizeM
      if ((target + SIGHT_HEIGHT_M - eyeZ - d * d * curve) / d >= maxAngle) {
        out[row * g.width + col] = 1
      }
    }
  }
  return out
}

describe('viewshed against the brute-force reference', () => {
  /** Smooth random terrain: bilinear blend of a coarse random lattice, like a real DEM. */
  function smoothTerrain(size: number, spacing: number, amplitudeM: number): Grid {
    let state = 99
    const rnd = () => (state = (state * 16807) % 2147483647) / 2147483647
    const L = Math.ceil(size / spacing) + 2
    const lattice = Array.from({ length: L * L }, () => (rnd() - 0.5) * 2 * amplitudeM)
    const at = (a: number, b: number) => lattice[a * L + b] as number
    return makeGrid(
      Array.from({ length: size }, (_, r) =>
        Array.from({ length: size }, (_, c) => {
          const i = Math.floor(r / spacing)
          const j = Math.floor(c / spacing)
          const tr = r / spacing - i
          const tc = c / spacing - j
          return (
            at(i, j) * (1 - tr) * (1 - tc) +
            at(i, j + 1) * (1 - tr) * tc +
            at(i + 1, j) * tr * (1 - tc) +
            at(i + 1, j + 1) * tr * tc +
            (rnd() - 0.5) * 0.3
          )
        }),
      ),
    )
  }

  it('agrees on smooth random terrain, within the few percent a sweep approximation allows', () => {
    const g = smoothTerrain(91, 10, 20)
    const obsCell = { row: 45, col: 40 }
    const fast = viewshed(g, obsCell)
    const slow = viewshedByRays(g, obsCell)
    let different = 0
    for (let i = 0; i < fast.length; i++) if (fast[i] !== slow[i]) different++
    const hidden = slow.reduce((n, v) => n + (v ? 0 : 1), 0)
    expect(hidden).toBeGreaterThan(1000) // the terrain really does hide things
    expect(different / fast.length).toBeLessThan(0.05)
  })

  it('agrees exactly along the axes, where no interpolation is involved', () => {
    const g = makeGrid(
      Array.from({ length: 21 }, (_, r) =>
        Array.from({ length: 21 }, (_, c) => (c % 5 === 3 ? 4 : 0) + (r % 7 === 2 ? 3 : 0)),
      ),
    )
    const obsCell = { row: 10, col: 10 }
    const fast = viewshed(g, obsCell)
    const slow = viewshedByRays(g, obsCell)
    for (let c = 0; c < 21; c++) expect(fast[10 * 21 + c], `col ${c}`).toBe(slow[10 * 21 + c])
    for (let r = 0; r < 21; r++) expect(fast[r * 21 + 10], `row ${r}`).toBe(slow[r * 21 + 10])
  })
})
