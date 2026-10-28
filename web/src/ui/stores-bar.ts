/**
 * The base's stores in the mission header: the sol reached, food, water, battery and air, how far
 * the supplies reach against the next ship, and the sols of food the greenhouse will have grown. Each reading says OK, Low or Out in words.
 */
import type { StoresRun } from '../core/base-stores'
import type { Progress } from '../core/mission-progress'
import { solReached } from '../core/run-ledger'
import { el } from './dom'
import { storesTo } from './run-check'

/** Under this many sols of a store left counts as low. Team choice. */
const LOW_SOLS = 60

type Level = 'ok' | 'low' | 'out'
const word: Record<Level, string> = { ok: 'OK', low: 'Low', out: 'Out' }

function reading(label: string, value: string, level: Level): HTMLElement {
  const item = el(
    'span',
    { className: 'stores-item' },
    el('span', { className: 'stores-label', textContent: label }),
    el('strong', { textContent: value }),
    el('span', { className: 'stores-level', textContent: word[level] }),
  )
  item.dataset.level = level
  return item
}

export function storesBar(p: Progress): HTMLElement {
  const bar = el('div', { className: 'stores-bar', role: 'status', ariaLabel: 'Base stores' })
  const target = p.stay?.nextShipSol
  const cargo = p.cargo
  if (!cargo || !target) return bar
  const now = Math.max(1, solReached(p))
  bar.append(el('span', { className: 'stores-label', textContent: `Sol ${now}` }))
  void Promise.all([storesTo(p, now), storesTo(p, target)]).then(([run, ahead]) => {
    if (!run || !ahead) return
    bar.replaceChildren(
      el(
        'span',
        { className: 'stores-item' },
        el('span', { className: 'stores-label', textContent: 'Sol' }),
        el('strong', { textContent: String(now) }),
      ),
      ...readings(run, ahead, target),
      // Air is made by the oxygen plants; it fails only when the power does (DRA 5.0).
      reading(
        'Air',
        cargo.isru > 0 ? 'oxygen plants' : 'none',
        cargo.isru > 0 && !run.failure ? 'ok' : 'out',
      ),
      reading('Grown', `+${ahead.solsEarned.toFixed(0)} sols by sol ${target}`, 'ok'),
    )
  })
  return bar
}

function readings(run: StoresRun, ahead: StoresRun, target: number): HTMLElement[] {
  const day = run.days.at(-1)
  const lasts = ahead.failure ? ahead.failure.sol - 1 : target
  const perSol = (a: number, b: number) => Math.max(0, a - b)
  const first = run.days[0]
  const waterUse =
    first && day ? perSol(first.waterKg, day.waterKg) / Math.max(1, run.days.length - 1) : 0
  const lv = (left: number, use: number): Level =>
    left <= 0 ? 'out' : use > 0 && left / use < LOW_SOLS ? 'low' : 'ok'
  return [
    reading(
      'Food',
      `${Math.max(0, day?.foodSols ?? 0).toFixed(0)} sols`,
      lv(day?.foodSols ?? 0, 1),
    ),
    reading(
      'Water',
      `${Math.round(Math.max(0, day?.waterKg ?? 0)).toLocaleString('en-US')} kg`,
      lv(day?.waterKg ?? 0, waterUse),
    ),
    reading(
      'Battery',
      `${Math.round(Math.max(0, day?.batteryKwh ?? 0))} kWh`,
      (day?.batteryKwh ?? 0) <= 0 && run.failure ? 'out' : 'ok',
    ),
    reading(
      'Supplies last',
      lasts >= target ? `past the next ship (sol ${target})` : `to sol ${lasts} of ${target}`,
      lasts >= target ? 'ok' : 'low',
    ),
  ]
}
