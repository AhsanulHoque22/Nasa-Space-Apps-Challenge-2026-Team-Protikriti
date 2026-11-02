/**
 * Mission 2.1: Packing the second lander (Expedition 2).
 *
 * Grounded in NASA Evolvable Mars Campaign (EMC) logistics (Rucker et al. 2016)
 * and DRA 5.0 §6.3.1 (resupply and infrastructure enhancement for subsequent crews).
 * The second lander lands at an already-established base site, carrying replacement
 * components for worn hardware, large-scale upgrades for farming & ice mining, and crew supplies.
 */
import {
  CREW_SIZE,
  DAYS_PER_SOL,
  FOOD_PACKED_KG_PER_CM_DAY,
  LANDER_A_LIMIT_KG,
} from './mission-constants'

export const EXPEDITION_2_LANDER_LIMIT_KG = LANDER_A_LIMIT_KG // 18,430 kg (~18.4 t)

export type Cargo2Plan = {
  stirlingSpare: number
  eclssRefurb: number
  roverTreads: number
  greenhouseExtM2: number
  rassorMiner: number
  deepDrillKit: number
  foodBufferSols: number
  freshFoodPack: number
}

export type Cargo2ItemId = keyof Cargo2Plan

export type Cargo2Item = {
  id: Cargo2ItemId
  label: string
  category: 'spares' | 'upgrades' | 'supplies'
  detail: string
  unitKg: number
  max: number
  step: number
  unit: string
  source: string
  url: string
}

export const CARGO_2_ITEMS: readonly Cargo2Item[] = [
  {
    id: 'stirlingSpare',
    label: 'Stirling Engine Spare',
    category: 'spares',
    detail: 'Modular power conversion replacement unit for the Kilopower fission farm.',
    unitKg: 450,
    max: 2,
    step: 1,
    unit: 'units',
    source: 'Rucker et al. 2016 (Stirling converter mass without shielding)',
    url: 'https://ntrs.nasa.gov/citations/20160010550',
  },
  {
    id: 'eclssRefurb',
    label: 'ECLSS Filter & Membrane Kit',
    category: 'spares',
    detail:
      'Full replacement sorbent beds and catalytic oxidation filters for closed-loop air and water recovery.',
    unitKg: 620,
    max: 2,
    step: 1,
    unit: 'kits',
    source: 'NASA BVAD Rev2 (2022) & ISS ECLSS filter replenishment manifests',
    url: 'https://ntrs.nasa.gov/citations/20210024855',
  },
  {
    id: 'roverTreads',
    label: 'High-Durability Rover Wheel Set',
    category: 'spares',
    detail:
      'Reinforced nickel-titanium shape memory alloy wheels to replace punctured aluminum treads.',
    unitKg: 380,
    max: 2,
    step: 1,
    unit: 'sets',
    source: 'NASA Glenn Research Center Shape Memory Alloy (SMA) tire project',
    url: 'https://www.nasa.gov/centers-and-facilities/glenn/superelastic-tires-a-materials-revolution-for-the-future/',
  },
  {
    id: 'greenhouseExtM2',
    label: 'Greenhouse Expansion Hardware',
    category: 'upgrades',
    detail:
      'Lightweight truss, LED arrays, root growth chambers, and nutrient distribution to scale up to 50 m².',
    unitKg: 81.5,
    max: 40,
    step: 5,
    unit: 'm²',
    source: 'Wheeler et al. (NASA KSC) 2022, Bioregenerative Life Support',
    url: 'https://ntrs.nasa.gov/citations/20220006578',
  },
  {
    id: 'rassorMiner',
    label: 'RASSOR Automated Ice Excavator',
    category: 'upgrades',
    detail:
      'Regolith Advanced Surface Systems Operations Robot for shallow ground excavation and ice mining.',
    unitKg: 1150,
    max: 1,
    step: 1,
    unit: 'units',
    source: 'Mueller et al. (NASA KSC) RASSOR 2.0 technical prototype',
    url: 'https://technology.nasa.gov/patent/KSC-TOPS-7',
  },
  {
    id: 'deepDrillKit',
    label: 'Deep Regolith Drill Core Assembly',
    category: 'upgrades',
    detail: '10-meter rotary percussive drill assembly for sub-surface geological strata sampling.',
    unitKg: 480,
    max: 1,
    step: 1,
    unit: 'units',
    source: 'NASA Honeybee Robotics planetary drill architecture',
    url: 'https://www.honeybeerobotics.com/',
  },
  {
    id: 'foodBufferSols',
    label: 'Shelf-Stable Food Reserve',
    category: 'supplies',
    detail: 'Nutritionally complete shelf-stable meals packed for four crew members.',
    unitKg: DAYS_PER_SOL * CREW_SIZE * FOOD_PACKED_KG_PER_CM_DAY, // ~9.82 kg/sol for 4 crew
    max: 600,
    step: 50,
    unit: 'sols',
    source: 'NASA BVAD Rev2 (2022) §3.3: 2.39 kg/person-day with packaging',
    url: 'https://ntrs.nasa.gov/citations/20210024855',
  },
  {
    id: 'freshFoodPack',
    label: 'Fresh Produce & Seed Supply',
    category: 'supplies',
    detail:
      'Vacuum-sealed fresh Earth food items, specialty seed banks, and culinary spices to sustain crew morale.',
    unitKg: 180,
    max: 3,
    step: 1,
    unit: 'packs',
    source: 'NASA Space Food Systems Laboratory psychological nutrition guidelines',
    url: 'https://www.nasa.gov/stem-content/food-for-spaceflight/',
  },
]

export const DEFAULT_CARGO_2_PLAN: Cargo2Plan = {
  stirlingSpare: 1,
  eclssRefurb: 1,
  roverTreads: 1,
  greenhouseExtM2: 40,
  rassorMiner: 1,
  deepDrillKit: 1,
  foodBufferSols: 350,
  freshFoodPack: 1,
}

/** Compute total mass of the Expedition 2 cargo lander in kg. */
export function cargo2MassKg(plan: Cargo2Plan): number {
  let total = 0
  for (const item of CARGO_2_ITEMS) {
    const qty = plan[item.id]
    total += qty * item.unitKg
  }
  return total
}

export type Cargo2CheckVerdict = {
  ok: boolean
  totalKg: number
  limitKg: number
  reasons: string[]
}

/** Check if a plan is flight-ready and satisfies minimum survival constraints. */
export function checkCargo2(plan: Cargo2Plan): Cargo2CheckVerdict {
  const totalKg = cargo2MassKg(plan)
  const reasons: string[] = []

  if (totalKg > EXPEDITION_2_LANDER_LIMIT_KG) {
    reasons.push('overmass')
  }
  if (plan.eclssRefurb < 1) {
    reasons.push('missing-eclss')
  }
  if (plan.stirlingSpare < 1) {
    reasons.push('missing-stirling')
  }
  if (plan.foodBufferSols < 200) {
    reasons.push('insufficient-food')
  }

  return {
    ok: reasons.length === 0,
    totalKg,
    limitKg: EXPEDITION_2_LANDER_LIMIT_KG,
    reasons,
  }
}

export type MilestoneReadiness = {
  ready: boolean
  title: string
  note: string
}

export type Expedition2Readiness = {
  wakeBase: MilestoneReadiness
  greenhouseScale: MilestoneReadiness
  iceMining: MilestoneReadiness
  sampleCampaign: MilestoneReadiness
}

/** Evaluate which upcoming Expedition 2 missions have their requirements satisfied. */
export function readinessChecks2(plan: Cargo2Plan): Expedition2Readiness {
  return {
    wakeBase: {
      ready: plan.eclssRefurb >= 1 && plan.stirlingSpare >= 1,
      title: '2.2 Wake the base',
      note:
        plan.eclssRefurb >= 1 && plan.stirlingSpare >= 1
          ? 'Critical ECLSS filters and Stirling spares packed to revive dormant systems.'
          : 'Missing ECLSS overhaul kit or Stirling engine spare.',
    },
    greenhouseScale: {
      ready: plan.greenhouseExtM2 >= 30,
      title: '2.3 Greenhouse scale-up',
      note:
        plan.greenhouseExtM2 >= 30
          ? `${plan.greenhouseExtM2} m² of expansion truss packed for 50 m² crop area.`
          : 'Insufficient greenhouse hardware (needs ≥ 30 m²).',
    },
    iceMining: {
      ready: plan.rassorMiner >= 1,
      title: '2.4 Ice mining at scale',
      note:
        plan.rassorMiner >= 1
          ? 'RASSOR robotic excavator packed to automate shallow ice mining.'
          : 'RASSOR excavator not packed.',
    },
    sampleCampaign: {
      ready: plan.deepDrillKit >= 1,
      title: '2.6 Sample campaign',
      note:
        plan.deepDrillKit >= 1
          ? '10 m deep drill kit packed for bedrock core extraction.'
          : 'Deep drill kit missing.',
    },
  }
}

/** Type guard for validating restored state or external JSON. */
export function isCargo2Plan(val: unknown): val is Cargo2Plan {
  if (!val || typeof val !== 'object') return false
  const p = val as Record<string, unknown>
  for (const item of CARGO_2_ITEMS) {
    if (typeof p[item.id] !== 'number') return false
  }
  return true
}
