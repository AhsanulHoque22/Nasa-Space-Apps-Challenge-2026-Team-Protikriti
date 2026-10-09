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
  const preRender = { addEventListener: vi.fn(), removeEventListener: vi.fn() }
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
      lookRight: vi.fn(),
      lookUp: vi.fn(),
      twistRight: vi.fn(),
    },
    scene: { preRender },
  } as unknown as Viewer
  return { viewer, entities, flyToBoundingSphere, preRender }
}

const footers = () => document.querySelectorAll('.eva-wrist').length
const text = () => document.querySelector('.wp-pos')?.textContent?.replace(/\s+/g, ' ').trim()

afterEach(() => {
  updateWalkPlayer(null)
  vi.useRealTimers()
  document.body.innerHTML = ''
  document.body.className = ''
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
    vi.useFakeTimers()
    updateWalkPlayer(null)
    vi.advanceTimersByTime(1000) // the arm lowers, then is removed
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

import type { Place } from '../core/search'
import { routeProfile } from '../core/eva-telemetry'

const places: Place[] = [
  { name: 'Ridge A', kind: 'feature', lon: 77.2, lat: 18.8, detail: 'a ridge' },
  { name: 'Far Hills', kind: 'feature', lon: 79, lat: 18.8, detail: '' },
  { name: 'Sample 4', kind: 'sample', lon: 77.21, lat: 18.81, detail: 'core sample' },
]
const richPlan = (stops: Cell[]): WalkParams => ({
  ...plan(stops),
  path: [...Array(15).keys()].map((i) => cell(10 + i, 10 + i)),
  total: {
    distanceM: 3000,
    ascentM: 40,
    descentM: 55,
    maxSlopeDeg: 9.4,
    durationMin: 80,
  } as RouteSummary,
  limitDeg: 15,
  hazards: 2,
  reliability: 0.93,
  words: 'Walk north-east for three kilometres.',
  siteId: 'jezero',
})
const text2 = () => document.querySelector('.eva-wrist')?.textContent?.replace(/\s+/g, ' ') ?? ''

describe('EVA dashboard', () => {
  it('takes over the screen while the walk runs, and gives it back when it ends', () => {
    const { viewer } = fakeViewer()
    openWalkPlayer(viewer, richPlan([cell(10, 10), cell(20, 20)]), () => undefined)
    expect(document.body.classList.contains('eva-mode')).toBe(true)
    vi.useFakeTimers()
    document.querySelector<HTMLButtonElement>('[data-act="close"]')?.click()
    expect(document.body.classList.contains('eva-mode')).toBe(false)
    vi.advanceTimersByTime(1000)
    expect(footers()).toBe(0)
  })

  it('shows the verdict, route numbers, every stop and where you are', () => {
    const { viewer } = fakeViewer()
    openWalkPlayer(viewer, richPlan([cell(10, 10), cell(20, 20), cell(24, 24)]), () => undefined, {
      siteName: 'Jezero crater',
      nowMs: () => Date.UTC(2026, 9, 10, 10, 0, 0),
    })
    const t = text2()
    expect(t).toContain('GO')
    expect(t).toContain('+30 min') // the card's tightest margin
    expect(t).toContain('9.4° of 15°') // steepest step against the limit
    expect(t).toContain('93%') // reliability from the planner
    expect(t).toContain('Walk north-east for three kilometres.')
    expect(document.querySelectorAll('.ws-stops li')).toHaveLength(3)
    expect(document.querySelector('.ws-stops .is-current')?.textContent).toContain('Start')
    expect(t).toContain('LMST')
    expect(document.querySelector('svg.ws-profile')).not.toBeNull()
  })

  it('shows live telemetry that moves with the stop you are at', () => {
    const { viewer } = fakeViewer()
    openWalkPlayer(viewer, richPlan([cell(10, 10), cell(20, 20), cell(24, 24)]), () => undefined)
    const at = () => document.querySelector('.ws-now .ws-col')?.textContent ?? ''
    expect(at()).toContain('At the start')
    document.querySelector<HTMLButtonElement>('[data-act="next"]')?.click()
    expect(at()).toContain('At stop 1')
    expect(at()).toContain('Next stop')
    document.querySelector<HTMLButtonElement>('[data-act="goto"][data-i="2"]')?.click()
    expect(at()).toContain('At stop 2')
    expect(at()).toContain('Walk home') // the last stop looks homeward instead
  })

  it('lists named features and samples near you, nearest first, and leaves far ones out', () => {
    const { viewer } = fakeViewer()
    openWalkPlayer(viewer, richPlan([cell(10, 10), cell(20, 20)]), () => undefined, {
      places: () => places,
    })
    const names = [...document.querySelectorAll('.ws-near-name')].map((n) => n.textContent)
    expect(names).toContain('Ridge A')
    expect(names).toContain('Sample 4')
    expect(names).not.toContain('Far Hills')
  })

  it('escapes text from place names, so a name can never inject markup', () => {
    const { viewer } = fakeViewer()
    const hostile: Place[] = [
      { name: '<img src=x onerror=alert(1)>', kind: 'feature', lon: 77.2, lat: 18.8, detail: '' },
    ]
    openWalkPlayer(viewer, richPlan([cell(10, 10), cell(20, 20)]), () => undefined, {
      places: () => hostile,
    })
    expect(document.querySelector('.ws-nearby img')).toBeNull()
    expect(document.querySelector('.ws-near-name')?.textContent).toContain('<img')
  })

  it('says plainly when the site has no weather record of its own', () => {
    const { viewer } = fakeViewer()
    openWalkPlayer(
      viewer,
      { ...richPlan([cell(10, 10), cell(20, 20)]), siteId: 'insight' },
      () => undefined,
      { siteName: 'InSight landing site' },
    )
    expect(text2()).toContain('not measured')
  })

  it('shows the dashboard on the wrist console: two screens on the arm, tabs switch pages', () => {
    const { viewer } = fakeViewer()
    openWalkPlayer(viewer, richPlan([cell(10, 10), cell(20, 20)]), () => undefined)
    expect(document.querySelectorAll('.eva-arm .eva-glass')).toHaveLength(2)
    expect(document.querySelector('.eva-glass-side')?.textContent).toContain('Conditions here')
    const page = (id: string) => document.querySelector<HTMLElement>(`[data-page="${id}"]`)
    expect(page('now')?.hidden).toBe(false)
    expect(page('route')?.hidden).toBe(true)
    document.querySelector<HTMLButtonElement>('[data-act="tab"][data-tab="route"]')?.click()
    expect(page('now')?.hidden).toBe(true)
    expect(page('route')?.hidden).toBe(false)
  })

  it('sways the arm like a hand; the switch turns it off, and ending the walk stops it', () => {
    const cancel = vi.spyOn(window, 'cancelAnimationFrame')
    const { viewer } = fakeViewer()
    openWalkPlayer(viewer, richPlan([cell(10, 10), cell(20, 20)]), () => undefined)
    const toggle = () => document.querySelector<HTMLButtonElement>('[data-act="hand"]')
    toggle()?.click() // it is on to start with
    expect(cancel).toHaveBeenCalled()
    document.querySelector<HTMLButtonElement>('[data-act="tab"][data-tab="tools"]')?.click()
    expect(document.querySelector('[data-act="hand"]')?.getAttribute('aria-pressed')).toBe('false')
    cancel.mockClear()
    document.querySelector<HTMLButtonElement>('[data-act="close"]')?.click()
    expect(cancel).toHaveBeenCalled()
  })

  it('can be left from a button outside the arm and with Escape', () => {
    const { viewer } = fakeViewer()
    openWalkPlayer(viewer, richPlan([cell(10, 10), cell(20, 20)]), () => undefined)
    expect(document.querySelector('.eva-exit[data-act="close"]')).not.toBeNull()
    vi.useFakeTimers()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(document.body.classList.contains('eva-mode')).toBe(false)
    vi.advanceTimersByTime(1000)
    expect(footers()).toBe(0)
  })

  it('profile helper marks the stops along the path', () => {
    const path = [...Array(15).keys()].map((i) => cell(10 + i, 10 + i))
    const p = routeProfile(grid, path, [cell(10, 10), cell(24, 24)])
    expect(p.stopD[0]).toBe(0)
    expect(p.stopD[1]).toBeCloseTo(p.totalM, 6)
  })
})
