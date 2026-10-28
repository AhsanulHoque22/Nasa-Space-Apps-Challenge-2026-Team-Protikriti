/**
 * Mission 1.1: what goes on the cargo lander. Unit masses come from NASA's Jezero crewed-base
 * study (Rucker et al. 2016) and DRA 5.0; crew consumables from BVAD Rev2. Nothing here depends
 * on the landing site: solar output is judged in mission 1.2, once latitude is known.
 */
import { lightWm2, cropById, spareReactorKw } from './greenhouse'
import {
  CREW_SIZE,
  DAYS_PER_SOL,
  FOOD_PACKED_KG_PER_CM_DAY,
  HABITAT_EXTERNAL_KWE,
  HABITAT_KG,
  ISRU_FULL_POWER_KW,
  KILOPOWER_DELIVERED_KWE,
  LANDER_A_LIMIT_KG,
  LANDER_B_LIMIT_KG,
  MAV_CONDITIONING_KW,
} from './mission-constants'

const RUCKER = 'Rucker et al. 2016, Solar Versus Fission Surface Power for Mars (NASA)'
const RUCKER_URL = 'https://ntrs.nasa.gov/citations/20160010550'

/** Kilopower unit's nameplate rating, kWe (Rucker et al. 2016); it delivers 8.75 kWe to the base. */
export const KILOPOWER_KWE = 10
/** Stirling AC cable 62.4 kg + controller 322.4 kg, once per fission farm (Rucker 2016, Table 5). */
export const FISSION_CABLING_KG = 385

export type CargoPlan = {
  kilopower: number
  solar: number
  battery: number
  isru: number
  /** Food for the whole crew, in sols of supply. */
  foodSols: number
  /** Drinking-water reserve, kg. */
  waterKg: number
  /** Water recyclers (ISS-type water recovery systems). */
  recycler: number
  /** Greenhouse hardware, m² of growing area. */
  greenhouseM2: number
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
  /** high: stated by NASA; medium: derived from NASA values; assumption: the team's choice. */
  confidence: 'high' | 'medium' | 'assumption'
}

/** Packed food for the whole crew for `sols` sols, kg. */
export function foodKg(sols: number): number {
  return sols * DAYS_PER_SOL * CREW_SIZE * FOOD_PACKED_KG_PER_CM_DAY
}

export const CARGO_ITEMS: readonly CargoItem[] = [
  {
    id: 'kilopower',
    label: 'Kilopower reactor',
    detail:
      '8.75 kWe delivered (10 kWe nameplate), day and night, whatever the dust. Sits at least 1 km from the crew.',
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
    max: 1000,
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
  {
    id: 'recycler',
    label: 'Water recycler',
    detail:
      'Cleans used water and urine back to drinking water, about 98% of it, like the Space Station’s.',
    unitKg: 1400, // team assumption: two ISS-size racks; no NASA mass found
    max: 2,
    step: 1,
    unit: 'units',
    source:
      'Recovery 98%: NASA, ISS ECLSS, June 2023. Power 743 W while running: Carter 2009 (NASA). Mass 1,400 kg is a team assumption (two ISS racks).',
    url: 'https://ntrs.nasa.gov/citations/20090033097',
    confidence: 'assumption',
  },
  {
    id: 'greenhouseM2',
    label: 'Greenhouse hardware',
    detail: 'Growth beds, lights, water and nutrient lines, fans and frame, per m² of crops.',
    unitKg: 81.5, // Table 4-88 total 101.5 kg/m² less the 20 kg/m² of crops grown on Mars
    max: 60,
    step: 5,
    unit: 'm²',
    source:
      'BVAD Rev2, 2022, Table 4-88 (Drysdale 1999b): 101.5 kg/m², less 20 kg/m² of crops grown on site.',
    url: 'https://ntrs.nasa.gov/citations/20210024855',
    confidence: 'medium',
  },
]

export type Lander = 'A' | 'B'

/**
 * Which lander carries each item, as DRA 5.0 splits them (Drake 2009, Table 5-1): the reactors and
 * oxygen plants land first so the return rocket's oxygen is made before the crew launch.
 */
export const LANDER_OF: Record<Exclude<keyof CargoPlan, 'foodSols'>, Lander> = {
  kilopower: 'A',
  isru: 'A',
  solar: 'A',
  battery: 'B',
  waterKg: 'B',
  recycler: 'B',
  greenhouseM2: 'B',
}
/** Share of the stored food on lander A; the rest comes with the crew (DRA 5.0 Table 5-1). */
export const FOOD_SHARE_A = 0.75
export const LANDER_LIMIT_KG: Record<Lander, number> = {
  A: LANDER_A_LIMIT_KG,
  B: LANDER_B_LIMIT_KG,
}

export function landerMassKg(plan: CargoPlan, lander: Lander): number {
  const items = CARGO_ITEMS.reduce((sum, item) => {
    const m = item.unitKg * plan[item.id]
    if (item.id === 'foodSols') return sum + m * (lander === 'A' ? FOOD_SHARE_A : 1 - FOOD_SHARE_A)
    return LANDER_OF[item.id] === lander ? sum + m : sum
  }, 0)
  if (lander === 'B') return items + HABITAT_KG
  return items + (plan.kilopower > 0 ? FISSION_CABLING_KG : 0)
}

export const cargoMassKg = (plan: CargoPlan): number =>
  landerMassKg(plan, 'A') + landerMassKg(plan, 'B')

/** Stored food must reach the next ship even if every crop fails, plus DRA 5.0's 10% margin. */
export const foodNeededSols = (targetSol: number): number => Math.ceil((targetSol * 11) / 10)

/** Before the crew come: the oxygen plants and the return rocket's cooling (Rucker 2016, Table 3). */
export const CARGO_PHASE_KW = ISRU_FULL_POWER_KW + MAV_CONDITIONING_KW
/** With the crew: the habitat and the return rocket's cooling. */
const CREW_PHASE_KW = HABITAT_EXTERNAL_KWE + MAV_CONDITIONING_KW

const kg = (n: number) => `${Math.round(n).toLocaleString('en-US')} kg`
const kw = (n: number) => `${n.toFixed(2)} kW`
const reactorKw = (plan: CargoPlan) => plan.kilopower * KILOPOWER_DELIVERED_KWE

/** `targetSol`: the sol the next ship lands, which the packed supplies must reach. */
export function checkCargo(
  plan: CargoPlan,
  targetSol: number,
): { blocking: string[]; warnings: string[] } {
  const blocking: string[] = []
  const warnings: string[] = []
  for (const l of ['A', 'B'] as const) {
    const over = landerMassKg(plan, l) - LANDER_LIMIT_KG[l]
    if (over > 0)
      blocking.push(`Lander ${l} is ${kg(over)} over its ${kg(LANDER_LIMIT_KG[l])} limit.`)
  }
  if (plan.kilopower === 0 && plan.solar === 0) {
    blocking.push(
      `Pack a power source: the habitat needs ${HABITAT_EXTERNAL_KWE} kWe from outside.`,
    )
  }
  if (plan.isru === 0)
    blocking.push('Pack an oxygen plant: the return rocket’s oxygen is made on Mars.')
  const short = CARGO_PHASE_KW - reactorKw(plan)
  if (plan.isru > 0 && plan.kilopower > 0 && short > 0) {
    const text = `Before the crew come, the oxygen plants and the return rocket need ${kw(CARGO_PHASE_KW)}; ${plan.kilopower} reactors give ${kw(reactorKw(plan))}, ${kw(short)} short.`
    if (plan.solar === 0) blocking.push(`${text} Pack 4 reactors, or add solar.`)
    else
      warnings.push(`${text} The solar arrays must make it up; mission 1.2 checks the site’s sun.`)
  }
  const needed = foodNeededSols(targetSol)
  if (plan.foodSols < needed) {
    blocking.push(
      `Stored food must last to the next ship on sol ${targetSol}, plus 10%: ${needed} sols. Crops can fail, so the greenhouse doesn’t count.`,
    )
  }
  if (plan.solar > 0 && plan.battery === 0 && plan.kilopower === 0) {
    warnings.push('Solar arrays give no power at night, and there is no battery.')
  }
  if (plan.recycler === 0) warnings.push('Without a water recycler, every litre is used once.')
  if (plan.greenhouseM2 === 0) warnings.push('No greenhouse hardware: no food can be grown.')
  if (plan.isru === 1) warnings.push('NASA’s plan carries two oxygen plants so one can fail.')
  return { blocking, warnings }
}

export type LaterNeed = { mission: string; need: string; ok: boolean }

/** What later missions need from this packing, each judged by the same models those missions use. */
export function laterNeeds(plan: CargoPlan): LaterNeed[] {
  const spare = spareReactorKw(plan.kilopower)
  const lettuceKw = (plan.greenhouseM2 * lightWm2(cropById('lettuce'))) / 1000
  return [
    {
      mission: '1.5 Marswalk',
      need: 'A battery to recharge the suits.',
      ok: plan.battery > 0,
    },
    {
      mission: '1.6 Greenhouse',
      need:
        plan.greenhouseM2 > 0
          ? `Spare reactor power for the lights: ${kw(Math.max(0, spare))} spare; ${plan.greenhouseM2} m² of lettuce, the dimmest crop, needs ${kw(lettuceKw)}.`
          : `Greenhouse hardware, and spare reactor power for its lights (${kw(Math.max(0, spare))} spare now).`,
      ok: plan.greenhouseM2 > 0 && spare >= lettuceKw,
    },
    {
      mission: '1.7 Dust storm',
      need: `Reactors that carry the base with no sun: ${kw(CREW_PHASE_KW)}.`,
      ok: reactorKw(plan) >= CREW_PHASE_KW,
    },
    {
      mission: '1.11 Power failure',
      need: `One reactor can fail and the rest still carry the base (${kw(CREW_PHASE_KW)}).`,
      ok: (plan.kilopower - 1) * KILOPOWER_DELIVERED_KWE >= CREW_PHASE_KW,
    },
  ]
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
