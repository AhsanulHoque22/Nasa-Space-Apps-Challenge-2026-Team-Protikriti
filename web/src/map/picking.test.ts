import { beforeEach, describe, expect, it } from 'vitest'
import type { Cartesian2, Viewer } from 'cesium'
import { pickedId } from './picking'

const AT = { x: 10, y: 10 } as Cartesian2

/** A viewer whose drillPick returns these objects, topmost first. */
function viewerPicking(...picked: { id?: unknown }[]): Viewer {
  return { scene: { drillPick: () => picked } } as unknown as Viewer
}

describe('pickedId', () => {
  beforeEach(() => {
    const notExploring = { contains: () => false }
    Object.assign(globalThis, { document: { body: { classList: notExploring } } })
  })

  it('finds a stop dot under the draped traverse line that is drawn on top of it', () => {
    const traverse = { id: { id: 'a1b2c3-entity-guid' } } // GeoJSON entity, not clickable
    expect(pickedId(viewerPicking(traverse, { id: 'stop:m20:126' }), AT)).toBe('stop:m20:126')
  })

  it('returns the topmost id when nothing clickable is there', () => {
    expect(pickedId(viewerPicking({ id: { id: 'guid-1' } }, { id: 'guid-2' }), AT)).toBe('guid-1')
  })

  it('searches a finger-sized area on touch screens, a small one for a mouse', () => {
    const sizes: number[] = []
    const viewer = {
      scene: {
        drillPick: (_at: unknown, _limit: number, width: number) => (sizes.push(width), []),
      },
    } as unknown as Viewer
    for (const coarse of [true, false]) {
      Object.assign(globalThis, { matchMedia: () => ({ matches: coarse }) })
      pickedId(viewer, AT)
    }
    expect(sizes[0]).toBeGreaterThanOrEqual(24)
    expect(sizes[1]).toBeLessThan(sizes[0] ?? 0)
  })

  it('returns undefined over bare terrain', () => {
    expect(pickedId(viewerPicking(), AT)).toBeUndefined()
  })
})
