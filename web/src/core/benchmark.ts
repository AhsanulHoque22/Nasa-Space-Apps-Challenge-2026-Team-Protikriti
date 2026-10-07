/** Replay benchmark: how the planner's terrain rule compares with what Perseverance really did. */

export interface Benchmark {
  limitDeg: number
  legsTotal: number
  legsAllowed: number
  legsBlocked: number
  steepWaypoints: number
  steepMissed: number
  falsePassRatePct: number | null
  correlation: number | null
}

const count = (r: Record<string, unknown>, key: string): number => {
  const v = r[key]
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error(`benchmark.json: "${key}" must be a finite number, got ${JSON.stringify(v)}`)
  }
  return v
}

const optional = (r: Record<string, unknown>, key: string): number | null =>
  r[key] === null ? null : count(r, key)

/** Validate the pipeline's benchmark.json at the trust boundary. */
export function parseBenchmark(doc: unknown): Benchmark {
  const result = (doc as { result?: unknown } | null)?.result
  if (typeof result !== 'object' || result === null) {
    throw new Error('benchmark.json: expected an object with a "result"')
  }
  const r = result as Record<string, unknown>
  return {
    limitDeg: count(r, 'limit_deg'),
    legsTotal: count(r, 'legs_total'),
    legsAllowed: count(r, 'legs_allowed'),
    legsBlocked: count(r, 'legs_blocked'),
    steepWaypoints: count(r, 'steep_waypoints'),
    steepMissed: count(r, 'steep_missed'),
    falsePassRatePct: optional(r, 'false_pass_rate_pct'),
    correlation: optional(r, 'correlation'),
  }
}

/** Plain-language findings; every number comes from the benchmark, none is written here. */
export function benchmarkLines(b: Benchmark): string[] {
  const judged = b.legsAllowed + b.legsBlocked
  const lines = [
    `Perseverance drove ${b.legsTotal} legs; ${judged} lie inside this map. ` +
      `The planner allows ${b.legsAllowed} and blocks ${b.legsBlocked} (slope limit ${b.limitDeg}°).`,
  ]
  if (b.steepWaypoints === 0) {
    lines.push('No mapped waypoint tilted past the limit.')
  } else {
    const rate =
      b.falsePassRatePct === null ? '' : ` (${Math.round(b.falsePassRatePct)}% false pass)`
    lines.push(
      `The rover's own tilt sensor read above ${b.limitDeg}° at ${b.steepWaypoints} mapped ` +
        `waypoints; the map showed gentler ground at ${b.steepMissed} of them${rate}.`,
    )
  }
  if (b.correlation !== null) {
    lines.push(`Map slope and measured rover tilt correlate at r = ${b.correlation.toFixed(2)}.`)
  }
  if (b.steepMissed > 0) {
    lines.push(
      'The terrain map is too coarse to see rock-sized steepness, so treat the red hatching as a minimum, not a guarantee.',
    )
  }
  return lines
}
