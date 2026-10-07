import { describe, expect, it } from 'vitest'
import { niceScale } from './scale-bar'

describe('niceScale', () => {
  it('picks the longest round length (1, 2 or 5 x 10^n m) that fits the space', () => {
    expect(niceScale(10, 120)).toEqual({ meters: 1000, px: 100, label: '1 km' }) // 1200 m fits: 1 km
    expect(niceScale(1, 120)).toEqual({ meters: 100, px: 100, label: '100 m' })
    expect(niceScale(3, 120)).toEqual({ meters: 200, px: 200 / 3, label: '200 m' })
    expect(niceScale(40, 120)).toEqual({ meters: 2000, px: 50, label: '2 km' })
  })

  it('uses kilometres from 1000 m up, and keeps fractions honest', () => {
    expect(niceScale(0.05, 120)?.label).toBe('5 m')
    expect(niceScale(400, 120)?.label).toBe('20 km')
  })

  it('has no answer without a usable ground distance', () => {
    expect(niceScale(0, 120)).toBeNull()
    expect(niceScale(NaN, 120)).toBeNull()
    expect(niceScale(Infinity, 120)).toBeNull()
  })
})
