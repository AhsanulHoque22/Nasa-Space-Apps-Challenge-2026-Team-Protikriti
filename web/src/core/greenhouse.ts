/**
 * Mission 1.6's greenhouse: crops grown without soil under LED light. What each square metre of a
 * crop costs in light and gives in food, water and oxygen, and whether the lights fit the power
 * the reactors have left. Numbers are NASA's best ground-chamber results, not Mars results:
 * - Edible yield, light per day, photoperiod, days to harvest, height: NASA BVAD Rev2 (2022),
 *   Tables 4-89 and 4-90 (from Kennedy's Biomass Production Chamber and related work).
 * - Water uptake and oxygen made: BVAD Rev2 Table 4-91.
 * - LED: 1.66 µmol of light per joule (Nelson & Bugbee 2014, in BVAD Rev2 §4) and 0.8 of the light
 *   reaching the plants (BVAD Rev2 Table 4-86, light delivery efficiency).
 * - Calories: USDA FoodData Central (SR Legacy), per 100 g as harvested.
 * - Crew food need: 12.707 MJ per crew member per day (BVAD Rev2).
 */
import { BASE_SLOPE_LIMIT_DEG, REACTOR_STANDOFF_M } from './base-layout'
import { slopeDegAt } from './eva-telemetry'
import { type Grid, lonLatToCell } from './grid'
import { distanceKm } from './site-report'
import {
  CREW_SIZE,
  DAYS_PER_SOL,
  HABITAT_EXTERNAL_KWE,
  KILOPOWER_DELIVERED_KWE,
  MAV_CONDITIONING_KW,
} from './mission-constants'

export type CropId = 'lettuce' | 'potato' | 'wheat' | 'soybean' | 'tomato'

export type Crop = {
  id: CropId
  name: string
  /** Edible yield over the whole growing cycle, grams as harvested per m² per day. */
  edibleFreshGm2d: number
  /** Light the crop needs, mol of photons per m² per day. */
  lightMolM2d: number
  /** Hours of light a day. */
  photoperiodH: number
  /** Days from planting to harvest. */
  growthDays: number
  matureHeightM: number
  /** Water taken up (and transpired), kg per m² per day. */
  waterKgM2d: number
  /** Oxygen made, grams per m² per day. */
  oxygenGm2d: number
  kcalPer100g: number
  /** USDA FoodData Central food the calories are from. */
  fdc: { id: number; name: string }
}

export const CROPS: readonly Crop[] = [
  {
    id: 'lettuce',
    name: 'Lettuce',
    edibleFreshGm2d: 131.35,
    lightMolM2d: 17,
    photoperiodH: 16,
    growthDays: 28,
    matureHeightM: 0.25,
    waterKgM2d: 2.1,
    oxygenGm2d: 7.78,
    kcalPer100g: 15,
    fdc: { id: 169249, name: 'Lettuce, green leaf, raw' },
  },
  {
    id: 'potato',
    name: 'White potato',
    edibleFreshGm2d: 105.3,
    lightMolM2d: 28,
    photoperiodH: 12,
    growthDays: 132,
    matureHeightM: 0.65,
    waterKgM2d: 4.0,
    oxygenGm2d: 32.23,
    kcalPer100g: 77,
    fdc: { id: 170026, name: 'Potatoes, flesh and skin, raw' },
  },
  {
    id: 'wheat',
    name: 'Wheat',
    edibleFreshGm2d: 22.73,
    lightMolM2d: 115,
    photoperiodH: 20, // BVAD gives 20-24 h; the low end
    growthDays: 75, // BVAD gives 75-90 days; the low end
    matureHeightM: 0.5,
    waterKgM2d: 11.79,
    oxygenGm2d: 56.0,
    kcalPer100g: 329,
    fdc: { id: 168889, name: 'Wheat, hard red spring' },
  },
  {
    id: 'soybean',
    name: 'Soybean',
    edibleFreshGm2d: 5.04,
    lightMolM2d: 28,
    photoperiodH: 12,
    growthDays: 97,
    matureHeightM: 0.55,
    waterKgM2d: 4.7,
    oxygenGm2d: 13.91,
    kcalPer100g: 446,
    fdc: { id: 174270, name: 'Soybeans, mature seeds, raw' },
  },
  {
    id: 'tomato',
    name: 'Tomato',
    edibleFreshGm2d: 173.76,
    lightMolM2d: 27,
    photoperiodH: 12,
    growthDays: 85,
    matureHeightM: 0.4,
    waterKgM2d: 2.77,
    oxygenGm2d: 26.36,
    kcalPer100g: 18,
    fdc: { id: 170457, name: 'Tomatoes, red, ripe, raw, year round average' },
  },
]

export const LED_UMOL_PER_J = 1.66
export const LIGHT_DELIVERY = 0.8
const CREW_MJ_PER_DAY = 12.707
const KJ_PER_KCAL = 4.184
/** Oxygen a crew member breathes, kg a day (BVAD Rev2 Table 3-31). */
const CREW_O2_KG_PER_DAY = 0.895

export const cropById = (id: CropId): Crop => {
  const c = CROPS.find((x) => x.id === id)
  if (!c) throw new Error(`No crop "${id}"`)
  return c
}

/** LED power while the lights are on, W per m² of the crop. */
export function lightWm2(c: Crop): number {
  const ppf = (c.lightMolM2d * 1e6) / (c.photoperiodH * 3600) // µmol/m²/s
  return ppf / (LED_UMOL_PER_J * LIGHT_DELIVERY)
}

export const kcalPerM2Day = (c: Crop) => c.edibleFreshGm2d * (c.kcalPer100g / 100)

export const crewKcalPerDay = () => (CREW_SIZE * CREW_MJ_PER_DAY * 1000) / KJ_PER_KCAL

/** Steady reactor power left once the habitat and the ascent vehicle's cooling are fed, kW. */
export function spareReactorKw(kilopowerUnits: number): number {
  return kilopowerUnits * KILOPOWER_DELIVERED_KWE - HABITAT_EXTERNAL_KWE - MAV_CONDITIONING_KW
}

const MAX_KILOPOWER_UNITS = 5 // CARGO_ITEMS kilopower max (4 + 1 spare, Rucker 2016 Table 5)

export type Areas = Partial<Record<CropId, number>>

export type GreenhouseBudget = {
  areaM2: number
  kcalPerDay: number
  /** Share of the crew's food need. */
  foodShare: number
  /** All the lights on at once, kW. */
  peakKw: number
  /** Light energy over a day, kWh. */
  dailyKwh: number
  spareKw: number
  waterKgPerDay: number
  oxygenKgPerDay: number
  oxygenShare: number
  /** Days to the first harvest of any crop planted; null with nothing planted. */
  firstHarvestDay: number | null
  /** Something is planted and the lights fit the spare power. */
  fits: boolean
}

export function greenhouseBudget(areas: Areas, kilopowerUnits: number): GreenhouseBudget {
  const beds = CROPS.map((c) => ({ c, m2: Math.max(0, areas[c.id] ?? 0) })).filter((b) => b.m2 > 0)
  const sum = (f: (c: Crop) => number) => beds.reduce((s, b) => s + b.m2 * f(b.c), 0)
  const kcalPerDay = sum(kcalPerM2Day)
  const peakKw = sum(lightWm2) / 1000
  const oxygenKgPerDay = sum((c) => c.oxygenGm2d) / 1000
  const spareKw = spareReactorKw(kilopowerUnits)
  return {
    areaM2: beds.reduce((s, b) => s + b.m2, 0),
    kcalPerDay,
    foodShare: kcalPerDay / crewKcalPerDay(),
    peakKw,
    dailyKwh: sum((c) => (lightWm2(c) * c.photoperiodH) / 1000),
    spareKw,
    waterKgPerDay: sum((c) => c.waterKgM2d),
    oxygenKgPerDay,
    oxygenShare: oxygenKgPerDay / (CREW_SIZE * CREW_O2_KG_PER_DAY),
    firstHarvestDay: beds.length ? Math.min(...beds.map((b) => b.c.growthDays)) : null,
    fits: beds.length > 0 && peakKw <= spareKw,
  }
}

export type GreenhouseOption = { text: string; areas: Areas }

/** Flight Director: small changes that make the lights fit, each checked by the same budget. */
export function greenhouseOptions(areas: Areas, kilopowerUnits: number): GreenhouseOption[] {
  if (greenhouseBudget(areas, kilopowerUnits).fits) return []
  const spare = spareReactorKw(kilopowerUnits)
  const out: GreenhouseOption[] = []
  for (const c of CROPS) {
    const m2 = areas[c.id] ?? 0
    if (m2 <= 0) continue
    // The most of this crop that fits beside everything else, in whole square metres.
    const othersKw = greenhouseBudget({ ...areas, [c.id]: 0 }, kilopowerUnits).peakKw
    const most = Math.floor(((spare - othersKw) * 1000) / lightWm2(c))
    const trial = { ...areas, [c.id]: Math.max(0, Math.min(m2 - 1, most)) }
    if (greenhouseBudget(trial, kilopowerUnits).fits)
      out.push({
        text:
          trial[c.id] === 0
            ? `Leave out the ${c.name.toLowerCase()} (${m2} m²).`
            : `Grow ${trial[c.id]} m² of ${c.name.toLowerCase()} instead of ${m2} m².`,
        areas: trial,
      })
  }
  return out
}

/**
 * Mission 1.1's preview of what `m2` of greenhouse grows: all potatoes, the crop with the most
 * calories per m² here, planted on `plantSol`, harvested from the first harvest to `untilSol`.
 */
export function growEstimate(m2: number, plantSol: number, untilSol: number) {
  const potato = cropById('potato')
  const b = greenhouseBudget({ potato: m2 }, MAX_KILOPOWER_UNITS)
  const firstHarvestSol = plantSol + Math.ceil(potato.growthDays / DAYS_PER_SOL)
  return {
    firstHarvestSol,
    /** Sols of the crew's food grown per sol. */
    solsPerSol: b.foodShare,
    solsEarned: Math.max(0, untilSol - firstHarvestSol + 1) * b.foodShare,
    peakKw: b.peakKw,
    /** Area that would feed the whole crew. */
    fullDietM2: crewKcalPerDay() / kcalPerM2Day(potato),
  }
}

/** The fewest reactors that power this greenhouse, or null past the cargo limit of 5 (mission 1.1). */
export function reactorsNeeded(areas: Areas): number | null {
  for (let n = 1; n <= MAX_KILOPOWER_UNITS; n++) if (greenhouseBudget(areas, n).fits) return n
  return null
}

/** Illustration only: the canopy rises evenly to its mature height by harvest day. */
export function canopyHeightM(c: Crop, day: number): number {
  return c.matureHeightM * Math.min(1, Math.max(0, day) / c.growthDays)
}

/**
 * Why the greenhouse cannot stand at `at`: the same rules as the base in mission 1.4. The crew
 * work inside it every day, so it keeps the reactors' distance like the habitat.
 */
export function greenhouseSiteProblems(
  grid: Grid,
  at: { lon: number; lat: number },
  reactor: { lon: number; lat: number } | null,
): string[] {
  const cell = lonLatToCell(grid, at.lon, at.lat)
  if (!cell) return ['Outside the mapped terrain.']
  const out: string[] = []
  const slope = slopeDegAt(grid, cell)
  if (slope !== null && slope > BASE_SLOPE_LIMIT_DEG)
    out.push(`Ground ${slope.toFixed(0)}° steep: the limit is ${BASE_SLOPE_LIMIT_DEG}°.`)
  if (reactor) {
    const m = distanceKm(at.lon, at.lat, reactor.lon, reactor.lat) * 1000
    if (m < REACTOR_STANDOFF_M)
      out.push(
        `${Math.round(m).toLocaleString('en-US')} m from the reactors: crew space must be ${REACTOR_STANDOFF_M.toLocaleString('en-US')} m away.`,
      )
  }
  return out
}

/** Team layout, not a NASA design: beds one arm-reach wide from each side, with walking room. */
export const BED_WIDTH_M = 1.2
export const AISLE_M = 0.8

/** One bed per crop planted, side by side along x from 0; each as long as its area needs. */
export function bedLayout(areas: Areas): { crop: Crop; m2: number; xM: number; lengthM: number }[] {
  let x = 0
  return CROPS.flatMap((crop) => {
    const m2 = areas[crop.id] ?? 0
    if (m2 <= 0) return []
    const bed = { crop, m2, xM: x, lengthM: m2 / BED_WIDTH_M }
    x += BED_WIDTH_M + AISLE_M
    return [bed]
  })
}
