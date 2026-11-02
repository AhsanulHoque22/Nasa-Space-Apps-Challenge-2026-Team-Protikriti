import { describe, expect, it } from 'vitest'
import { type Areas, greenhouseBudget, spareReactorKw } from './greenhouse'
import {
  SAVED_FAILED_RUN,
  consequenceHeadline,
  engineerLine,
  powerWindow,
  scaleAreas,
} from './power-window'

const areas: Areas = { potato: 20 }

describe('powerWindow', () => {
  it('runs the same calculation the mission judged the greenhouse with', () => {
    const w = powerWindow(areas, 3)
    const b = greenhouseBudget(areas, 3)
    expect(w.neededKw).toBe(b.peakKw)
    expect(w.availableKw).toBe(Math.max(0, b.spareKw))
    expect(w.ok).toBe(b.fits)
  })

  it('reports the exact shortfall', () => {
    const w = powerWindow(areas, 3)
    expect(w.shortKw).toBeCloseTo(w.neededKw - w.availableKw, 6)
    expect(w.shortKw).toBeGreaterThan(0)
  })

  it('reaches zero shortfall with one more reactor', () => {
    expect(powerWindow(areas, 3).ok).toBe(false)
    const w = powerWindow(areas, 4)
    expect(w.shortKw).toBe(0)
    expect(w.ok).toBe(true)
  })

  it('also reaches zero with a smaller greenhouse, the other honest fix', () => {
    expect(powerWindow(scaleAreas(areas, 0.5), 3).ok).toBe(true)
  })

  it('treats nothing planted as not a passing greenhouse, like the mission does', () => {
    expect(powerWindow({}, 4).ok).toBe(false)
    expect(powerWindow({}, 4).shortKw).toBe(0)
  })

  it('shows no spare power when reactors cannot even carry the base', () => {
    expect(powerWindow(areas, 2).availableKw).toBe(0)
    expect(spareReactorKw(2)).toBeLessThan(0)
  })
})

describe('the saved failed run', () => {
  it('really fails, from both causes: too few reactors and too big a greenhouse', () => {
    const { areas: a, kilopower } = SAVED_FAILED_RUN
    expect(powerWindow(a, kilopower).ok).toBe(false)
    expect(powerWindow(a, kilopower + 1).ok).toBe(true)
    expect(powerWindow(scaleAreas(a, 0.5), kilopower).ok).toBe(true)
  })
})

describe('engineerLine', () => {
  it('warns from the real figures when reactors cannot carry the base', () => {
    const line = engineerLine(2)
    expect(line).toContain('17.5 kW')
    expect(line).toContain((2 * 8.75 - spareReactorKw(2)).toFixed(2))
    expect(line).toMatch(/can’t carry/)
  })

  it('states the spare power when they can', () => {
    expect(engineerLine(4)).toContain(`${spareReactorKw(4).toFixed(2)} kW`)
  })
})

describe('consequenceHeadline', () => {
  it('says plainly what failed', () => {
    expect(consequenceHeadline('1.6')).toBe('The lights failed')
    expect(consequenceHeadline('1.5')).toBe('A suit ran out')
    expect(consequenceHeadline('9.9')).toBe('The crew ran out of time')
  })
})
