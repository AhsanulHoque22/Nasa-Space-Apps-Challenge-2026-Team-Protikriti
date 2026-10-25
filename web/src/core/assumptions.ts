/**
 * Planning assumptions (greenhouse rates, crop yields, ...) with their sources. The rule this
 * module enforces: no number reaches the screen without a source. A sourced value is checked
 * where it enters; a value nobody has sourced yet stays null and reads as "pending", never 0.
 */

export type Confidence = 'high' | 'medium' | 'low'

export type Assumption = {
  id: string
  label: string
  value: number | null
  range: [number, number] | null
  unit: string
  source: string | null
  confidence: Confidence
}

export type Assumptions = ReadonlyMap<string, Assumption>

export type AssumptionResult = { ok: true; value: number } | { ok: false; reason: string }

const CONFIDENCES: readonly string[] = ['high', 'medium', 'low']

function checkEntry(raw: unknown): Assumption {
  const e = raw as Partial<Assumption> | null
  if (!e || typeof e !== 'object' || typeof e.id !== 'string') {
    throw new Error('assumptions.json: every entry needs a string id')
  }
  const where = `assumptions.json: ${e.id}`
  if (typeof e.label !== 'string' || typeof e.unit !== 'string') {
    throw new Error(`${where} needs a label and a unit`)
  }
  if (!CONFIDENCES.includes(e.confidence as string)) {
    throw new Error(`${where}: confidence must be high, medium or low`)
  }
  const { value, range, source } = e
  if (range != null) {
    if (!Array.isArray(range) || range.length !== 2 || !(range[0] <= range[1])) {
      throw new Error(`${where}: range must be [low, high]`)
    }
  }
  if (value != null) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`${where}: value must be a finite number or null`)
    }
    if (typeof source !== 'string' || source.trim() === '') {
      throw new Error(`${where}: a value needs a source (leave value null until one is found)`)
    }
    if (range && (value < range[0] || value > range[1])) {
      throw new Error(`${where}: value ${value} is outside its range [${range[0]}, ${range[1]}]`)
    }
  }
  return e as Assumption
}

/** Validate assumptions.json at the trust boundary. */
export function parseAssumptions(raw: unknown): Assumptions {
  if (!Array.isArray(raw)) throw new Error('assumptions.json: expected a list of entries')
  const byId = new Map<string, Assumption>()
  for (const entry of raw.map(checkEntry)) {
    if (byId.has(entry.id)) throw new Error(`assumptions.json: duplicate id ${entry.id}`)
    byId.set(entry.id, entry)
  }
  return byId
}

/** The value to compute with, or the reason a feature must wait for one. */
export function assumptionValue(all: Assumptions, id: string): AssumptionResult {
  const a = all.get(id)
  if (!a) throw new Error(`No assumption with id "${id}"`)
  if (a.value === null) {
    return { ok: false, reason: `Assumption pending: ${a.label} has no sourced value yet` }
  }
  return { ok: true, value: a.value }
}
