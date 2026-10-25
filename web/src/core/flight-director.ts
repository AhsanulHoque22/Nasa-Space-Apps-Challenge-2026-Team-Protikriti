/**
 * The Flight Director: when a cargo plan fails to fill the return tanks, find the smallest
 * changes that would. It offers changes, never a finished plan, and the user makes them. Each
 * option is checked with the same cargo-phase model that gives the verdict.
 */
import { CARGO_ITEMS, type CargoPlan, cargoMassKg } from './cargo'
import { type SunSol, cargoPhase } from './cargo-phase'
import { CARGO_LIMIT_KG, LOX_TARGET_KG } from './mission-constants'

type PowerItem = 'kilopower' | 'solar' | 'battery' | 'isru'
const POWER_ITEMS: readonly PowerItem[] = ['isru', 'kilopower', 'solar', 'battery']
/** Changes of up to this many units are searched: enough to fix any plan within the limits. */
const MAX_ADDED_UNITS = 3
const MAX_OPTIONS = 3

export type PowerOption = {
  /** Units to add, by item. */
  add: Partial<Record<PowerItem, number>>
  label: string
  addedKg: number
  /** Mass that must come off elsewhere to stay under the lander limit, kg (0 if none). */
  freeKg: number
}

export type PowerAdvice = {
  verdict: 'go' | 'no-go'
  /** 'night': propellant cooling loses power after dark; 'energy': not enough over the season. */
  problem: 'none' | 'night' | 'energy'
  shortKg: number
  options: PowerOption[]
}

const item = (id: PowerItem) => CARGO_ITEMS.find((i) => i.id === id)

/** Every way to add 1..MAX_ADDED_UNITS units of power items without passing an item's maximum. */
function additions(plan: CargoPlan): Array<Partial<Record<PowerItem, number>>> {
  const out: Array<Partial<Record<PowerItem, number>>> = []
  const walk = (k: number, left: number, add: Partial<Record<PowerItem, number>>) => {
    if (k === POWER_ITEMS.length) {
      if (left < MAX_ADDED_UNITS) out.push(add)
      return
    }
    const id = POWER_ITEMS[k] as PowerItem
    const room = (item(id)?.max ?? 0) - plan[id]
    for (let n = 0; n <= Math.min(room, left); n++) {
      walk(k + 1, left - n, n ? { ...add, [id]: n } : add)
    }
  }
  walk(0, MAX_ADDED_UNITS, {})
  return out
}

const includes = (
  big: Partial<Record<PowerItem, number>>,
  small: Partial<Record<PowerItem, number>>,
) => POWER_ITEMS.every((id) => (big[id] ?? 0) >= (small[id] ?? 0))

function label(add: Partial<Record<PowerItem, number>>): string {
  return POWER_ITEMS.filter((id) => add[id])
    .map((id) => {
      const n = add[id] as number
      const name = item(id)?.label ?? id
      return `+${n} ${name}${n > 1 && !name.endsWith('s') ? 's' : ''}`
    })
    .join(', ')
}

export function powerOptions(plan: CargoPlan, year: readonly SunSol[]): PowerAdvice {
  const now = cargoPhase(plan, year)
  if (now.verdict === 'go') return { verdict: 'go', problem: 'none', shortKg: 0, options: [] }
  const baseKg = cargoMassKg(plan)
  const passing = additions(plan)
    .map((add) => {
      const after = { ...plan }
      for (const id of POWER_ITEMS) after[id] += add[id] ?? 0
      return { add, after }
    })
    .filter(({ after }) => cargoPhase(after, year).verdict === 'go')
  // Keep only the smallest fixes: drop any change that contains another passing change.
  const minimal = passing.filter(
    (p) => !passing.some((q) => q !== p && includes(p.add, q.add) && !includes(q.add, p.add)),
  )
  const options = minimal
    .map(({ add, after }) => {
      const addedKg = cargoMassKg(after) - baseKg
      return {
        add,
        label: label(add),
        addedKg,
        freeKg: Math.max(0, baseKg + addedKg - CARGO_LIMIT_KG),
      }
    })
    .sort((a, b) => a.addedKg - b.addedKg)
    .slice(0, MAX_OPTIONS)
  return {
    verdict: 'no-go',
    problem: now.reason === 'night' ? 'night' : 'energy',
    shortKg: LOX_TARGET_KG - now.loxKg,
    options,
  }
}
