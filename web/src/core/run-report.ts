/**
 * What went wrong in a failed run, mission by mission, and what to do next time. Every suggested
 * fix is checked with the same model the mission used before it is offered: a fix that would not
 * have saved the run is never shown. Each lesson also carries a guard, the choice that caused it,
 * so a later run can warn the moment that choice is made again.
 */
import { type StoreName, type StoresInput, runStores } from './base-stores'
import { type StormBase, type StormLoads, stormOptions, stormRun } from './dust-storm'
import { type Areas, greenhouseBudget, greenhouseOptions, reactorsNeeded } from './greenhouse'
import { CREW_SIZE, DAYS_PER_SOL, POTABLE_WATER_KG_PER_CM_DAY } from './mission-constants'
import type { Progress } from './mission-progress'

export type GuardField =
  | 'cargo.kilopower'
  | 'cargo.solar'
  | 'cargo.battery'
  | 'cargo.recycler'
  | 'cargo.foodSols'
  | 'cargo.waterKg'
  | 'greenhouse.peakKw'
  | 'storm.habitatKw'
  | 'storm.greenhouseKw'
  | 'walk.distanceM'

export type Guard = { kind: 'min' | 'max' | 'equals'; field: GuardField; value: number }
export type GuardValues = Partial<Record<GuardField, number>>

export type Lesson = {
  missionId: string
  mistake: string
  measure: string
  numbers: string
  guard: Guard
  /** This mistake is what ended the run. */
  fatal: boolean
}

export type RunFailure = { store: StoreName | 'suit'; sol: number; missionId: string; why: string }

export type ReportContext = {
  progress: Progress
  failure: RunFailure
  /** The ledger as it ran, to check food, water and power fixes against. */
  stores: StoresInput | null
  /** The storm as the crew set it up, when the storm ended the run. */
  storm?: StormBase & { loads: StormLoads }
  /** How far out the walkers were when a suit ran out, m. */
  walkDistanceM?: number
}

const MAX_REACTORS = 5 // mission 1.1's limit
const MAX_SOLAR_SETS = 4
const MAX_BATTERIES = 2

export function guardHit(g: Guard, values: GuardValues): boolean {
  const v = values[g.field]
  if (v === undefined) return false
  if (g.kind === 'min') return v < g.value
  if (g.kind === 'max') return v > g.value
  return v === g.value
}

const holds = (s: StoresInput, store: StoreName) => runStores(s).failure?.store !== store
const n = (x: number) => x.toLocaleString('en-US', { maximumFractionDigits: 1 })

export function runReport(c: ReportContext): Lesson[] {
  const cargo = c.progress.cargo
  if (!cargo) return []
  const { failure } = c
  const lessons: Lesson[] = []
  const add = (l: Omit<Lesson, 'fatal'>, fatal = true) => lessons.push({ ...l, fatal })

  if (failure.store === 'suit') {
    const d = Math.round(c.walkDistanceM ?? 0)
    add({
      missionId: '1.5',
      mistake: `A suit ran out ${n(d)} m from the airlock on sol ${failure.sol}.`,
      measure: `Choose a stop nearer than ${n(d)} m, walk at the planned pace, and press Turn back when oxygen or battery reaches 40%.`,
      numbers: 'A full suit lasts 8 hours (NASA EVA-EXP-0075).',
      guard: { kind: 'max', field: 'walk.distanceM', value: d },
    })
  }

  if (failure.store === 'power' && failure.missionId === '1.6' && c.progress.greenhouse) {
    const areas = c.progress.greenhouse.areas as Areas
    const b = greenhouseBudget(areas, cargo.kilopower)
    const options = greenhouseOptions(areas, cargo.kilopower)
    if (options[0])
      add(
        {
          missionId: '1.6',
          mistake: `The lights needed ${n(b.peakKw)} kW with ${n(Math.max(0, b.spareKw))} kW spare.`,
          measure: options[0].text,
          numbers: `Spare reactor power: ${n(b.spareKw)} kW.`,
          guard: { kind: 'max', field: 'greenhouse.peakKw', value: Math.max(0, b.spareKw) },
        },
        false,
      )
    const need = reactorsNeeded(areas)
    if (need !== null && need > cargo.kilopower)
      add({
        missionId: '1.1',
        mistake: `${cargo.kilopower} reactors left nothing for the greenhouse lights: the habitat and the return rocket use 18.8 kW.`,
        measure: `Pack at least ${need} reactors.`,
        numbers: `${cargo.kilopower} × 8.75 kW = ${n(cargo.kilopower * 8.75)} kW.`,
        guard: { kind: 'min', field: 'cargo.kilopower', value: need },
      })
  }

  if (failure.store === 'power' && failure.missionId === '1.7' && c.storm) {
    const option = stormOptions(c.storm, c.storm.loads)[0]
    if (option) {
      const habitat = option.loads.habitatKw !== c.storm.loads.habitatKw
      add({
        missionId: '1.7',
        mistake: `The base ran short of power on storm sol ${stormRun(c.storm).firstShortSol ?? 0}.`,
        measure: option.text,
        numbers: `Habitat ${n(c.storm.loads.habitatKw)} kW, greenhouse lights ${n(c.storm.loads.greenhouseKw)} kW.`,
        guard: habitat
          ? { kind: 'equals', field: 'storm.habitatKw', value: c.storm.loads.habitatKw }
          : { kind: 'equals', field: 'storm.greenhouseKw', value: c.storm.loads.greenhouseKw },
      })
    }
    for (let banks = cargo.battery + 1; banks <= MAX_BATTERIES; banks++) {
      const base = {
        ...c.storm,
        batteryKwh: (c.storm.batteryKwh / Math.max(1, cargo.battery)) * banks,
      }
      if (cargo.battery > 0 && stormRun(base).shortKwh === 0) {
        add(
          {
            missionId: '1.1',
            mistake: `${cargo.battery} battery bank could not carry the base through the storm.`,
            measure: `Pack ${banks} battery banks.`,
            numbers: `Lowest battery in the storm: ${n(stormRun(c.storm).lowestBattery)} kWh.`,
            guard: { kind: 'min', field: 'cargo.battery', value: banks },
          },
          !option,
        )
        break
      }
    }
  }

  const s = c.stores
  if (
    s &&
    failure.store === 'power' &&
    failure.missionId !== '1.6' &&
    failure.missionId !== '1.7'
  ) {
    for (let k = cargo.kilopower + 1; k <= MAX_REACTORS; k++) {
      if (holds({ ...s, cargo: { ...s.cargo, kilopower: k } }, 'power')) {
        add({
          missionId: '1.1',
          mistake: `On sol ${failure.sol} the base needed more power than ${cargo.kilopower} reactors, the arrays and the battery could give.`,
          measure: `Pack at least ${k} reactors.`,
          numbers: `Each reactor gives 8.75 kW day and night (Rucker et al. 2016).`,
          guard: { kind: 'min', field: 'cargo.kilopower', value: k },
        })
        break
      }
    }
    if (cargo.solar > 0)
      for (let sets = cargo.solar + 1; sets <= MAX_SOLAR_SETS; sets++) {
        const scaled = (sol: number) => (s.solarKwhPerSol(sol) * sets) / cargo.solar
        if (holds({ ...s, cargo: { ...s.cargo, solar: sets }, solarKwhPerSol: scaled }, 'power')) {
          add(
            {
              missionId: '1.1',
              mistake: `${cargo.solar} solar set could not make up the shortfall.`,
              measure: `Or pack ${sets} solar array sets.`,
              numbers: `Solar on sol ${failure.sol}: ${n(s.solarKwhPerSol(failure.sol))} kWh.`,
              guard: { kind: 'min', field: 'cargo.solar', value: sets },
            },
            false,
          )
          break
        }
      }
  }

  const target = c.progress.stay?.nextShipSol
  if (s && failure.store === 'food' && target) {
    if (holds({ ...s, cargo: { ...s.cargo, foodSols: target } }, 'food'))
      add({
        missionId: '1.1',
        mistake: `${cargo.foodSols} sols of food ran out on sol ${failure.sol}, before the next ship on sol ${target}.`,
        measure: `Pack food for ${target} sols, or pack greenhouse hardware and plant enough in mission 1.6 to cover the gap.`,
        numbers: `Each sol the crew of ${CREW_SIZE} eats one sol of food.`,
        guard: { kind: 'min', field: 'cargo.foodSols', value: target },
      })
  }

  if (s && failure.store === 'water') {
    if (cargo.recycler === 0 && holds({ ...s, cargo: { ...s.cargo, recycler: 1 } }, 'water')) {
      add({
        missionId: '1.1',
        mistake: `With no recycler, ${n(cargo.waterKg)} kg of water lasted ${failure.sol - 1} sols.`,
        measure: 'Pack a water recycler: it returns 98% of the water.',
        numbers: `The crew drink and wash with ${n(CREW_SIZE * POTABLE_WATER_KG_PER_CM_DAY * DAYS_PER_SOL)} kg a sol.`,
        guard: { kind: 'min', field: 'cargo.recycler', value: 1 },
      })
    } else {
      const kg = Math.ceil((cargo.waterKg * s.untilSol) / Math.max(1, failure.sol - 1) / 250) * 250
      if (holds({ ...s, cargo: { ...s.cargo, waterKg: kg } }, 'water'))
        add({
          missionId: '1.1',
          mistake: `${n(cargo.waterKg)} kg of water ran out on sol ${failure.sol}.`,
          measure: `Pack ${n(kg)} kg of water.`,
          numbers: 'The recycler gets back 98%; the rest is lost.',
          guard: { kind: 'min', field: 'cargo.waterKg', value: kg },
        })
    }
  }
  return lessons
}
