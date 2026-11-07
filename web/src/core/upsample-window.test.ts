import { describe, expect, it } from 'vitest'
import { upsampleWindow } from './upsample-window'

describe('upsampleWindow', () => {
  it('puts the first child of a source tile at the centre tile’s top-left corner', () => {
    expect(upsampleWindow(187470 * 8, 52105 * 8, 20, 17, 256)).toEqual({
      parentX: 187470,
      parentY: 52105,
      parentLevel: 17,
      sx: 256,
      sy: 256,
      size: 32,
    })
  })

  it('steps one child window per child index, inside the centre tile', () => {
    const w = upsampleWindow(187470 * 8 + 7, 52105 * 8 + 3, 20, 17, 256)
    expect([w.sx, w.sy, w.size]).toEqual([256 + 7 * 32, 256 + 3 * 32, 32])
    expect(w.sx + w.size).toBe(512) // the last child ends on the centre tile's right edge
  })

  it('makes the two children either side of a source seam meet edge to edge in the block', () => {
    const left = upsampleWindow(187469 * 2 + 1, 52105 * 2, 18, 17, 256) // east half of 187469
    const right = upsampleWindow(187470 * 2, 52105 * 2, 18, 17, 256) // west half of 187470
    expect(left.parentX + 1).toBe(right.parentX)
    // In world terms the left window ends where the right one starts: 512 px in 469's block is
    // 256 px in 470's block (the blocks are one tile apart).
    expect(left.sx + left.size - 256).toBe(right.sx)
  })
})
