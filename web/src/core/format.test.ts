import { describe, expect, it } from 'vitest'
import { formatDistance, formatDuration } from './format'

describe('formatDistance', () => {
  it('metres below 1 km, kilometres with 2 decimals above', () => {
    expect(formatDistance(0)).toBe('0 m')
    expect(formatDistance(849.6)).toBe('850 m')
    expect(formatDistance(3421)).toBe('3.42 km')
  })
})

describe('formatDuration', () => {
  it('minutes under an hour, hours and zero-padded minutes above', () => {
    expect(formatDuration(0)).toBe('0 min')
    expect(formatDuration(42.4)).toBe('42 min')
    expect(formatDuration(65)).toBe('1 h 05 min')
    expect(formatDuration(119.6)).toBe('2 h 00 min')
  })
})
