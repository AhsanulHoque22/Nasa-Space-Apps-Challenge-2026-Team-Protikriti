import { describe, expect, it } from 'vitest'
import { MARS_YEAR_SOLS, bandPath, linePath, linearScale, lastMarsYear } from './chart'

describe('linearScale', () => {
  it('maps a domain onto a range', () => {
    const s = linearScale([0, 10], [100, 200])
    expect(s(0)).toBe(100)
    expect(s(5)).toBe(150)
    expect(s(10)).toBe(200)
  })
  it('handles a flat domain without dividing by zero', () => {
    expect(linearScale([3, 3], [0, 10])(3)).toBe(5)
  })
})

describe('lastMarsYear', () => {
  it('keeps sols within one Mars year of the latest', () => {
    const sols = [{ sol: 1 }, { sol: 1000 }, { sol: 1000 + MARS_YEAR_SOLS }]
    expect(lastMarsYear(sols).map((s) => s.sol)).toEqual([1000, 1000 + MARS_YEAR_SOLS])
  })
})

describe('paths break at missing readings instead of bridging them', () => {
  const x = (i: number) => i * 10
  const y = (v: number) => v
  it('linePath starts a new segment after a null', () => {
    expect(linePath([1, 2, null, 4, 5], x, y)).toBe('M0,1L10,2M30,4L40,5')
  })
  it('bandPath closes one polygon per unbroken run', () => {
    const lows = [0, 1, null, 3]
    const highs = [10, 11, null, 13]
    expect(bandPath(lows, highs, x, y)).toBe('M0,10L10,11L10,1L0,0ZM30,13L30,3Z')
  })
})
