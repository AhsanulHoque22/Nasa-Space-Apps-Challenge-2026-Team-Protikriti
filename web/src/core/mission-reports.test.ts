import { describe, expect, it } from 'vitest'
import { REPORTS_KEY, activeWarnings, appendReport, loadReports } from './mission-reports'
import type { Lesson } from './run-report'
import type { KeyValueStore } from './streetview'

const store = (init: Record<string, string> = {}): KeyValueStore => {
  const m = new Map(Object.entries(init))
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) }
}
const lesson = (value: number): Lesson => ({
  missionId: '1.1',
  mistake: 'Too few reactors',
  measure: `Pack ${value}`,
  numbers: '',
  guard: { kind: 'min', field: 'cargo.kilopower', value },
  fatal: true,
})
const failure = { store: 'power' as const, sol: 9, missionId: '1.6', why: 'Brownout' }

describe('mission reports', () => {
  it('numbers each failed run and keeps the older reports', () => {
    const s = store()
    expect(appendReport(s, 'o', failure, [lesson(3)]).version).toBe(1)
    expect(appendReport(s, 'o', failure, [lesson(4)]).version).toBe(2)
    expect(loadReports(s, 'o').map((r) => r.version)).toEqual([1, 2])
  })

  it('keeps each lander’s mass and the sols the greenhouse earned', () => {
    const s = store()
    const summary = { landerAKg: 17_300, landerBKg: 29_800, solsEarned: 12.4 }
    appendReport(s, 'o', failure, [lesson(3)], summary)
    expect(loadReports(s, 'o')[0]?.summary).toEqual(summary)
  })

  it('ignores the reports of another crew', () => {
    const s = store()
    appendReport(s, 'other', failure, [lesson(3)])
    expect(loadReports(s, 'o')).toEqual([])
  })

  it('reads nothing when storage throws', () => {
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    expect(loadReports(broken, 'o')).toEqual([])
    expect(appendReport(broken, 'o', failure, [lesson(3)]).version).toBe(1)
  })

  it('warns from the newest report only, once per choice', () => {
    const s = store()
    appendReport(s, 'o', failure, [lesson(3)])
    appendReport(s, 'o', failure, [lesson(4)])
    const w = activeWarnings(loadReports(s, 'o'), '1.1', { 'cargo.kilopower': 2 })
    expect(w).toHaveLength(1)
    expect(w[0]?.version).toBe(2)
    expect(activeWarnings(loadReports(s, 'o'), '1.1', { 'cargo.kilopower': 4 })).toEqual([])
  })

  it('stores under its own key', () => {
    expect(REPORTS_KEY).toBe('atlas.reports')
  })
})
