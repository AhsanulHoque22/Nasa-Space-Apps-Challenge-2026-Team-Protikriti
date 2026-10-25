/**
 * Mission 1.1: what goes on the cargo lander. Unit masses come from NASA's Jezero crewed-base
 * study (Rucker et al. 2016) and DRA 5.0; crew consumables from BVAD Rev2. Nothing here depends
 * on the landing site: solar output is judged in mission 1.2, once latitude is known.
 */
import {
  CARGO_LIMIT_KG,
  CREW_SIZE,
  DAYS_PER_SOL,
  FOOD_PACKED_KG_PER_CM_DAY,
  HABITAT_EXTERNAL_KWE,
  HABITAT_KG,
  SURFACE_STAY_SOLS,
} from './mission-constants'

const RUCKER = 'Rucker et al. 2016, Solar Versus Fission Surface Power for Mars (NASA)'
const RUCKER_URL = 'https://ntrs.nasa.gov/citations/20160010550'

/** Kilopower unit, kWe (Rucker et al. 2016). */
export const KILOPOWER_KWE = 10
/** Stirling AC cable 62.4 kg + controller 322.4 kg, once per fission farm (Rucker 2016, Table 5). */
const FISSION_CABLING_KG = 385

export type CargoPlan = {
  kilopower: number
  solar: number
  battery: number
  isru: number
  /** Food for the whole crew, in sols of supply. */
  foodSols: number
  /** Drinking-water reserve, kg. */
  waterKg: number
}

export type CargoItem = {
  id: keyof CargoPlan
  label: string
  detail: string
  /** kg per count; for food, kg per sol for the crew; for water, 1 (the count is kg). */
  unitKg: number
  max: number
  step: number
  unit: string
  source: string
  url: string
  confidence: 'high' | 'medium'
}

/** Packed food for the whole crew for `sols` sols, kg. */
export function foodKg(sols: number): number {
  return sols * DAYS_PER_SOL * CREW_SIZE * FOOD_PACKED_KG_PER_CM_DAY
}

export const CARGO_ITEMS: readonly CargoItem[] = [
  {
    id: 'kilopower',
    label: 'Kilopower reactor',
    detail: '10 kWe day and night, whatever the dust. Must sit at least 1 km from the crew.',
    unitKg: 1754, // 8,769 kg for 4 + 1 spare, incl. 15% growth (Table 5)
    max: 5,
    step: 1,
    unit: 'units',
    source: `${RUCKER}, Table 5. The first unit also brings 385 kg of cabling and controllers.`,
    url: RUCKER_URL,
    confidence: 'high',
  },
  {
    id: 'solar',
    label: 'Solar array set',
    detail: 'Four 12 m wings with gimbals and posts. Output depends on latitude, season and dust.',
    unitKg: 2034, // a lander's arrays, gimbals, regulators, structure, thermal (Table 6)
    max: 4,
    step: 1,
    unit: 'sets',
    source: `${RUCKER}, Table 6 (one lander’s solar power system without batteries).`,
    url: RUCKER_URL,
    confidence: 'high',
  },
  {
    id: 'battery',
    label: 'Battery bank',
    detail: 'Lithium-sulfur, about 658 kWh: power through the night for solar arrays.',
    unitKg: 3168, // 2,437 kg cells at 270 Wh/kg + 30% growth (Table 7)
    max: 2,
    step: 1,
    unit: 'banks',
    source: `${RUCKER}, Table 7 (2,437 kg at 270 Wh/kg, plus 30% growth).`,
    url: RUCKER_URL,
    confidence: 'high',
  },
  {
    id: 'isru',
    label: 'Oxygen plant',
    detail: 'Splits CO₂ from the air into oxygen, like MOXIE, at about 2.2 kg an hour.',
    unitKg: 1678, // the study adds "about 40%, or 671 kg" to the ISRU system: 671 / 0.4
    max: 2,
    step: 1,
    unit: 'plants',
    source: `${RUCKER}: 671 kg is stated as about 40% of the ISRU system, so about 1,678 kg (derived).`,
    url: RUCKER_URL,
    confidence: 'medium',
  },
  {
    id: 'foodSols',
    label: 'Food',
    detail: 'Packed meals for four, 2.39 kg per person per day including packaging.',
    unitKg: foodKg(1),
    max: 600,
    step: 25,
    unit: 'sols',
    source: 'NASA Life Support Baseline Values and Assumptions Document (BVAD) Rev2, 2022, §3.3.',
    url: 'https://ntrs.nasa.gov/citations/20210024855',
    confidence: 'high',
  },
  {
    id: 'waterKg',
    label: 'Water reserve',
    detail: 'Spare drinking water, used up only when recycling falls short.',
    unitKg: 1,
    max: 5000,
    step: 250,
    unit: 'kg',
    source: 'BVAD Rev2, 2022, Table 3-31: 3.217 kg of drinking water per person per day.',
    url: 'https://ntrs.nasa.gov/citations/20210024855',
    confidence: 'high',
  },
]

export function cargoMassKg(plan: CargoPlan): number {
  const items = CARGO_ITEMS.reduce((sum, item) => sum + item.unitKg * plan[item.id], 0)
  return HABITAT_KG + items + (plan.kilopower > 0 ? FISSION_CABLING_KG : 0)
}

const kg = (n: number) => `${Math.round(n).toLocaleString('en-US')} kg`

export function checkCargo(plan: CargoPlan): { blocking: string[]; warnings: string[] } {
  const blocking: string[] = []
  const warnings: string[] = []
  const over = cargoMassKg(plan) - CARGO_LIMIT_KG
  if (over > 0) blocking.push(`The lander is ${kg(over)} over its ${kg(CARGO_LIMIT_KG)} limit.`)
  if (plan.kilopower === 0 && plan.solar === 0) {
    blocking.push(
      `Pack a power source: the habitat needs ${HABITAT_EXTERNAL_KWE} kWe from outside.`,
    )
  }
  if (plan.isru === 0)
    blocking.push('Pack an oxygen plant: the return rocket’s oxygen is made on Mars.')

  if (
    plan.solar === 0 &&
    plan.kilopower * KILOPOWER_KWE > 0 &&
    plan.kilopower * KILOPOWER_KWE < HABITAT_EXTERNAL_KWE
  ) {
    warnings.push(
      `One ${KILOPOWER_KWE} kWe reactor is less than the habitat’s ${HABITAT_EXTERNAL_KWE} kWe.`,
    )
  }
  if (plan.solar > 0 && plan.battery === 0 && plan.kilopower === 0) {
    warnings.push('Solar arrays give no power at night, and there is no battery.')
  }
  if (plan.foodSols < SURFACE_STAY_SOLS) {
    warnings.push(`Packed food lasts ${plan.foodSols} of the ${SURFACE_STAY_SOLS} sols.`)
  }
  if (plan.isru === 1) warnings.push('NASA’s plan carries two oxygen plants so one can fail.')
  return { blocking, warnings }
}

/** Validate a saved plan at the storage boundary. */
export function isCargoPlan(v: unknown): v is CargoPlan {
  const p = v as Record<string, unknown> | null
  if (!p || typeof p !== 'object') return false
  return CARGO_ITEMS.every((item) => {
    const n = p[item.id]
    return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= item.max
  })
}
