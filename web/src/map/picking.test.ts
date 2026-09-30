import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Cartesian2, Cartesian3, Viewer } from 'cesium'
import { addClickables, isInteractiveClick, pickedId } from './picking'

const R = 3_396_190
// Planet-centred positions; the fake projection puts each on screen at (y, z) / 100 m.
const onSurface = (y: number, z: number) => ({ x: Math.sqrt(R * R - y * y - z * z), y, z })
const click = (x: number, y: number) => ({ x, y }) as Cartesian2

const camera = { x: R + 5_000, y: 0, z: 0 } // above the dots
const viewer = {
  camera: { positionWC: camera },
  scene: {
    cartesianToCanvasCoordinates: (p: Cartesian3) => ({ x: p.y / 100, y: p.z / 100 }),
  },
} as unknown as Viewer

let stopsShown = true
const coarsePointer = (on: boolean) =>
  Object.assign(globalThis, { matchMedia: () => ({ matches: on }) })

describe('pickedId', () => {
  beforeAll(() => {
    addClickables([
      {
        id: 'stop:m20:1',
        position: onSurface(10_000, 10_000) as Cartesian3,
        shown: () => stopsShown,
      },
      {
        id: 'stop:m20:2',
        position: onSurface(12_000, 10_000) as Cartesian3,
        shown: () => stopsShown,
      },
      // Far side of Mars: projects on screen, but the planet is in the way.
      {
        id: 'stop:m20:3',
        position: { x: -R, y: 30_000, z: 30_000 } as Cartesian3,
        shown: () => true,
      },
    ])
  })
  beforeEach(() => {
    stopsShown = true
    coarsePointer(false)
    Object.assign(globalThis, { document: { body: { classList: { contains: () => false } } } })
  })

  it('finds the dot nearest the click', () => {
    expect(pickedId(viewer, click(116, 101))).toBe('stop:m20:2')
  })

  it('misses a mouse click 20 px away, but a finger tap there still hits', () => {
    expect(pickedId(viewer, click(100, 120))).toBeUndefined()
    coarsePointer(true)
    expect(pickedId(viewer, click(100, 120))).toBe('stop:m20:1')
  })

  it('ignores dots whose layer is hidden', () => {
    stopsShown = false
    expect(isInteractiveClick(viewer, click(100, 100))).toBe(false)
  })

  it('ignores points on the far side of the planet', () => {
    expect(pickedId(viewer, click(300, 300))).toBeUndefined()
  })

  it('treats a click on bare ground as not interactive', () => {
    expect(isInteractiveClick(viewer, click(500, 500))).toBe(false)
  })
})
