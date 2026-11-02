// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { dial, needleAngleDeg } from './dial'

describe('needleAngleDeg', () => {
  it('sweeps 270 degrees from empty to full', () => {
    expect(needleAngleDeg(0)).toBe(135)
    expect(needleAngleDeg(1)).toBe(405)
    expect(needleAngleDeg(0.5)).toBe(270)
  })

  it('holds at its stops when a value runs out of range', () => {
    expect(needleAngleDeg(-1)).toBe(135)
    expect(needleAngleDeg(2)).toBe(405)
  })

  it('reads empty for a value that is not a number', () => {
    expect(needleAngleDeg(Number.NaN)).toBe(135)
  })
})

describe('dial', () => {
  it('states its reading in words, since a needle alone reaches no screen reader', () => {
    const d = dial({ label: 'Oxygen', share: 0.62, reading: '62%' })
    expect(d.getAttribute('role')).toBe('img')
    expect(d.getAttribute('aria-label')).toBe('Oxygen: 62%')
    expect(d.textContent).toContain('62%')
  })

  it('moves the needle when updated', () => {
    const d = dial({ label: 'Power', share: 0, reading: '0%' })
    d.update(1, '100%')
    expect(d.querySelector('.dial-needle')?.getAttribute('transform')).toContain('405')
    expect(d.getAttribute('aria-label')).toBe('Power: 100%')
  })
})
