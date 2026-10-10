import { describe, expect, it } from 'vitest'
import { type LabelCandidate, declutter } from './declutter'

const view = { width: 1000, height: 600 }
const label = (id: number, x: number, y: number, priority = 1): LabelCandidate => ({
  id,
  x,
  y,
  width: 100,
  height: 20,
  priority,
})

describe('declutter', () => {
  it('keeps the more important of two overlapping labels', () => {
    const shown = declutter([label(1, 500, 300, 5), label(2, 540, 305, 9)], view)
    expect([...shown]).toEqual([2])
  })
  it('keeps both when there is room, including side by side and stacked', () => {
    const shown = declutter([label(1, 200, 300), label(2, 320, 300), label(3, 200, 330)], view)
    expect(shown).toEqual(new Set([1, 2, 3]))
  })
  it('drops labels outside the viewport', () => {
    const shown = declutter([label(1, -30, 100), label(2, 500, 700), label(3, 500, 100)], view)
    expect([...shown]).toEqual([3])
  })
  it('lets a dropped label free the space for a lesser one that does not clash with the winner', () => {
    const shown = declutter(
      [label(1, 500, 300, 9), label(2, 580, 300, 5), label(3, 680, 300, 1)],
      view,
    )
    expect(shown).toEqual(new Set([1, 3])) // 2 clashes with 1; 3 clears 1
  })
  it('chooses the same winner every time on equal priority, and handles an empty list', () => {
    expect([...declutter([label(7, 500, 300), label(3, 505, 300)], view)]).toEqual([3])
    expect(declutter([], view).size).toBe(0)
  })
})
