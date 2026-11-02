import { describe, expect, it } from 'vitest'
import { historyAdd, sparkPoints, timeLeftShare, toneOfShare } from './wrist-gauges'

describe('timeLeftShare', () => {
  it('is the unused share of the EVA budget', () => {
    expect(timeLeftShare(0, 420)).toBe(1)
    expect(timeLeftShare(210, 420)).toBe(0.5)
    expect(timeLeftShare(500, 420)).toBe(0)
  })

  it('reads empty with no budget', () => {
    expect(timeLeftShare(0, 0)).toBe(0)
  })
})

describe('toneOfShare', () => {
  it('names the state in words as well as colour', () => {
    expect(toneOfShare(0.6)).toBe('ok')
    expect(toneOfShare(0.15)).toBe('warn')
    expect(toneOfShare(0.05)).toBe('bad')
  })
})

describe('historyAdd', () => {
  it('keeps a bounded history, thinning old points evenly', () => {
    let h: number[] = []
    for (let i = 0; i < 1000; i++) h = historyAdd(h, i, 100)
    expect(h.length).toBeLessThanOrEqual(100)
    expect(h.at(-1)).toBe(999)
    expect(h[0]).toBe(0)
  })
})

describe('sparkPoints', () => {
  it('maps values to the box with full at the top', () => {
    expect(sparkPoints([1, 0], 100, 50)).toBe('0,0 100,50')
  })

  it('draws nothing for no data and a level line for one point', () => {
    expect(sparkPoints([], 100, 50)).toBe('')
    expect(sparkPoints([0.5], 100, 50)).toBe('0,25 100,25')
  })

  it('treats NaN as empty, not as a broken line', () => {
    expect(sparkPoints([Number.NaN, 1], 100, 50)).toBe('0,50 100,0')
  })
})
