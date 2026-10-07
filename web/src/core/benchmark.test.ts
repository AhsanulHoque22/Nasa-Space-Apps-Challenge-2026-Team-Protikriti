import { describe, expect, it } from 'vitest'
import { benchmarkLines, parseBenchmark } from './benchmark'

const doc = {
  result: {
    limit_deg: 15,
    legs_total: 556,
    legs_outside_grid: 271,
    legs_allowed: 280,
    legs_blocked: 5,
    waypoints_in_grid: 362,
    steep_waypoints: 9,
    steep_missed: 9,
    false_pass_rate_pct: 100,
    correlation: 0.577,
  },
  source: { terrain: 'CTX DEM grid, 20 m pixels' },
}

describe('parseBenchmark', () => {
  it('reads the pipeline output', () => {
    expect(parseBenchmark(doc).legsAllowed).toBe(280)
    expect(parseBenchmark(doc).falsePassRatePct).toBe(100)
  })

  it('keeps an undefined rate and correlation as null, not 0', () => {
    const none = { ...doc, result: { ...doc.result, false_pass_rate_pct: null, correlation: null } }
    expect(parseBenchmark(none).falsePassRatePct).toBeNull()
    expect(parseBenchmark(none).correlation).toBeNull()
  })

  it('rejects a document with a missing or non-numeric field', () => {
    const rest: Record<string, unknown> = { ...doc.result }
    delete rest.legs_total
    expect(() => parseBenchmark({ ...doc, result: rest })).toThrow(/legs_total/)
    expect(() => parseBenchmark({ ...doc, result: { ...doc.result, legs_total: '556' } })).toThrow(
      /legs_total/,
    )
    expect(() => parseBenchmark(null)).toThrow(/benchmark/)
  })
})

describe('benchmarkLines', () => {
  const lines = benchmarkLines(parseBenchmark(doc))

  it('states what the planner would have done with the real drive legs', () => {
    expect(lines[0]).toBe(
      'Perseverance drove 556 legs; 285 lie inside this map. The planner allows 280 and blocks 5 (slope limit 15°).',
    )
  })

  it('reports the false-pass rate from the rover tilt sensor and how weak the map is', () => {
    expect(lines[1]).toContain('9 mapped waypoints')
    expect(lines[1]).toContain('gentler ground at 9 of them (100% false pass)')
    expect(lines.join(' ')).toContain('r = 0.58')
  })

  it('says so when no mapped waypoint tilted past the limit', () => {
    const calm = parseBenchmark({
      ...doc,
      result: { ...doc.result, steep_waypoints: 0, steep_missed: 0, false_pass_rate_pct: null },
    })
    expect(benchmarkLines(calm)[1]).toBe('No mapped waypoint tilted past the limit.')
  })
})
