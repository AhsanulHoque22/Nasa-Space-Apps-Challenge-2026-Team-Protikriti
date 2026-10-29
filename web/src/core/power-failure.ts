/**
 * Mission 1.10: one reactor fails and stays down until a replacement comes on the next ship. The
 * crew choose what runs meanwhile: the habitat in use or in keep-alive (14.9 / 8.0 kW, Rucker et
 * al. 2016, Table 3), the greenhouse lights, and the water plant. The return rocket's propellant
 * cooling is never cut: without it the crew cannot leave. Every option is checked by the ledger.
 */
import { type StoresInput, runStores } from './base-stores'
import { HABITAT_KEEP_ALIVE_KW } from './dust-storm'
import type { OutageRecord } from './mission-progress'

/** The ledger input with the crew's outage loads on every sol a reactor is down. */
export function withOutage(st: StoresInput, o: OutageRecord): StoresInput {
  const down = (sol: number) => (st.reactorsDown?.(sol) ?? 0) > 0
  return {
    ...st,
    habitatKw: (sol) => (down(sol) ? o.habitatKw : st.habitatKw?.(sol)),
    lightsKw: (sol) => (down(sol) ? o.greenhouseKw : st.lightsKw?.(sol)),
    plantOn: (sol) => !down(sol) || o.waterOn,
  }
}

export type OutageOption = { text: string; outage: OutageRecord }

/** Flight Director: cuts that get the base through, smallest first, each run through the ledger. */
export function outageOptions(st: StoresInput, current: OutageRecord): OutageOption[] {
  const tries: OutageOption[] = []
  const keepAlive = current.habitatKw > HABITAT_KEEP_ALIVE_KW
  if (current.waterOn)
    tries.push({
      text: 'Stop the water plant until the replacement runs.',
      outage: { ...current, waterOn: false },
    })
  if (current.greenhouseKw > 0)
    tries.push({
      text: 'Switch the greenhouse lights off.',
      outage: { ...current, greenhouseKw: 0 },
    })
  if (keepAlive)
    tries.push({
      text: `Put the habitat in keep-alive mode (${HABITAT_KEEP_ALIVE_KW} kW).`,
      outage: { ...current, habitatKw: HABITAT_KEEP_ALIVE_KW },
    })
  if (keepAlive && current.greenhouseKw > 0)
    tries.push({
      text: 'Keep-alive mode and the greenhouse lights off.',
      outage: { ...current, habitatKw: HABITAT_KEEP_ALIVE_KW, greenhouseKw: 0 },
    })
  tries.push({
    text: 'Everything that can go: keep-alive mode, lights off, water plant stopped.',
    outage: {
      habitatKw: Math.min(current.habitatKw, HABITAT_KEEP_ALIVE_KW),
      greenhouseKw: 0,
      waterOn: false,
    },
  })
  const seen = new Set<string>()
  return tries.filter((o) => {
    const key = JSON.stringify(o.outage)
    if (seen.has(key) || key === JSON.stringify(current)) return false
    seen.add(key)
    return runStores(withOutage(st, o.outage)).failure?.store !== 'power'
  })
}
