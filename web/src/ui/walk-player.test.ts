// @vitest-environment happy-dom
import { Cartesian3, Math as CesiumMath, type Viewer } from 'cesium'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EvaCard } from '../core/eva-card'
import type { Cell, Grid } from '../core/grid'
import type { RouteSummary } from '../core/summary'
import { bearingRad } from '../core/terrain-line'
import type { LineLegend } from './line-legend'
import { type WalkParams, openWalkPlayer, updateWalkPlayer } from './walk-player'

const grid: Grid = {
  width: 100,
  height: 100,
  pixelSizeM: 20,
  west: 77,
  east: 78,
  south: 18,
  north: 19,
  maxSafeSlopeDeg: 15,
  elevationM: new Float32Array(100 * 100),
}
const cell = (row: number, col: number): Cell => ({ row, col })
const leg = { distanceM: 400, durationMin: 10 } as RouteSummary
const card = { verdict: 'GO', tightestMarginMin: 30 } as EvaCard
const plan = (stops: Cell[]): WalkParams => ({
  stops,
  grid,
  legs: stops.slice(1).map(() => leg),
  card,
  stopMin: 20,
})

function fakeViewer(heightM = 3500) {
  const entities: unknown[] = []
  const flyToBoundingSphere = vi.fn()
  const viewer = {
    entities: {
      add: (o: object) => {
        const e = { ...o }
        entities.push(e)
        return e
      },
      remove: (e: unknown) => entities.splice(entities.indexOf(e), 1),
    },
    camera: {
      positionCartographic: { height: heightM },
      heading: 0,
      pitch: CesiumMath.toRadians(-90),
      positionWC: new Cartesian3(3_396_190 + heightM, 0, 0),
      directionWC: new Cartesian3(-1, 0, 0),
      flyToBoundingSphere,
      flyTo: vi.fn(),
    },
  } as unknown as Viewer
  return { viewer, entities, flyToBoundingSphere }
}

const footers = () => document.querySelectorAll('.walk-player').length
const text = () => document.querySelector('.wp-pos')?.textContent?.replace(/\s+/g, ' ').trim()

afterEach(() => {
  updateWalkPlayer(null)
  document.body.innerHTML = ''
})

describe('walk player', () => {
  it('shows one footer even when the walk is started again', () => {
    const { viewer, entities } = fakeViewer()
    openWalkPlayer(viewer, plan([cell(10, 10), cell(20, 20)]), () => undefined)
    openWalkPlayer(viewer, plan([cell(10, 10), cell(20, 20), cell(30, 30)]), () => undefined)
    expect(footers()).toBe(1)
    expect(entities).toHaveLength(2) // one blue link, one avatar: never doubled
    expect(text()).toContain('of 2')
  })

  it('follows a changed plan in place and keeps your position in it', () => {
    const { viewer } = fakeViewer()
    openWalkPlayer(viewer, plan([cell(10, 10), cell(20, 20)]), () => undefined)
    document.querySelector<HTMLButtonElement>('[data-act="next"]')?.click()
    expect(text()).toContain('Stop 1')
    updateWalkPlayer(plan([cell(10, 10), cell(20, 20), cell(30, 30), cell(40, 40)]))
    expect(footers()).toBe(1)
    expect(text()).toContain('Stop 1')
    expect(text()).toContain('of 3')
    expect(document.querySelector('[data-act="next"]')?.hasAttribute('disabled')).toBe(false)
  })

  it('clamps your position when the plan gets shorter', () => {
    const { viewer } = fakeViewer()
    openWalkPlayer(viewer, plan([cell(10, 10), cell(20, 20), cell(30, 30)]), () => undefined)
    document.querySelector<HTMLButtonElement>('[data-act="next"]')?.click()
    document.querySelector<HTMLButtonElement>('[data-act="next"]')?.click()
    updateWalkPlayer(plan([cell(10, 10), cell(20, 20)]))
    expect(text()).toContain('Stop 1')
    expect(text()).toContain('of 1')
  })

  it('closes when the route goes away, leaving nothing behind', () => {
    const { viewer, entities } = fakeViewer()
    const legend: LineLegend = { set: vi.fn(), remove: vi.fn() }
    openWalkPlayer(viewer, plan([cell(10, 10), cell(20, 20)]), () => undefined, { legend })
    expect(legend.set).toHaveBeenCalledWith('stops', expect.anything(), expect.any(Array))
    updateWalkPlayer(null)
    expect(footers()).toBe(0)
    expect(entities).toHaveLength(0)
    expect(legend.remove).toHaveBeenCalledWith('stops')
  })

  it('recentres tilted toward the next stop at the zoom you are at', () => {
    const { viewer, flyToBoundingSphere } = fakeViewer(3500)
    const stops = [cell(10, 10), cell(10, 60)] // the next stop is due east
    openWalkPlayer(viewer, plan(stops), () => undefined, { surfaceM: () => 500 })
    flyToBoundingSphere.mockClear()
    document.querySelector<HTMLButtonElement>('[data-act="rc"]')?.click()
    const [, options] = flyToBoundingSphere.mock.calls[0] as [
      unknown,
      { offset: { heading: number; pitch: number; range: number } },
    ]
    const { heading, pitch, range } = options.offset
    expect(pitch).toBeCloseTo(CesiumMath.toRadians(-32), 6) // tilted, not straight down
    expect(heading).toBeCloseTo(bearingRad([77.105, 18.895], [77.605, 18.895]), 3)
    expect(range * Math.sin(-pitch)).toBeCloseTo(3500 - 500, 3) // same height above the ground
  })

  it('opens from a very high view at a walkable height, but never changes a close one', () => {
    const far = fakeViewer(120_000)
    openWalkPlayer(far.viewer, plan([cell(10, 10), cell(20, 20)]), () => undefined)
    const [, farOptions] = far.flyToBoundingSphere.mock.calls[0] as [
      unknown,
      { offset: { range: number; pitch: number } },
    ]
    expect(farOptions.offset.range * Math.sin(-farOptions.offset.pitch)).toBeCloseTo(3000, 3)
    updateWalkPlayer(null)
    const near = fakeViewer(800)
    openWalkPlayer(near.viewer, plan([cell(10, 10), cell(20, 20)]), () => undefined)
    const [, nearOptions] = near.flyToBoundingSphere.mock.calls[0] as [
      unknown,
      { offset: { range: number; pitch: number } },
    ]
    expect(nearOptions.offset.range * Math.sin(-nearOptions.offset.pitch)).toBeCloseTo(800, 3)
  })
})
