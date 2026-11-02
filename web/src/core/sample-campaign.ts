/**
 * Scientific model and calculations for Mission 2.6: "Sample campaign".
 *
 * Implements Mars Sample Return (MSR) payload curation:
 * - Strict 15.0 kg return payload mass limit for Mars Ascent Vehicle (MAV).
 * - Multi-disciplinary coverage: Astrobiology, Geochronology, Hydrology, Hydrothermal.
 * - Planetary Protection Category V (Restricted Earth Return) hermetic sealing.
 */
import type { Cargo2Plan } from './cargo-2'

export type SpecimenId =
  | 'delta-mudstone'
  | 'deep-basalt-core'
  | 'glacial-basal-ice'
  | 'hydrothermal-silica'
  | 'mantle-breccia'
  | 'dune-regolith'
  | 'evaporite-gypsum'
  | 'carbonate-concretion'

export type SpecimenDiscipline =
  'Astrobiology' | 'Geochronology' | 'Hydrology' | 'Hydrothermal' | 'Volcanology'

export type Specimen = {
  id: SpecimenId
  name: string
  discipline: SpecimenDiscipline
  massKg: number
  scienceScore: number
  originNote: string
  preservationDetail: string
}

export const CANDIDATE_SPECIMENS: readonly Specimen[] = [
  {
    id: 'delta-mudstone',
    name: 'Ancient Lacustrine Delta Mudstone',
    discipline: 'Astrobiology',
    massKg: 2.5,
    scienceScore: 95,
    originNote: 'Fine-grained smectite clay from ancient crater lake bed.',
    preservationDetail:
      'Exceptional preservation potential for organic biosignatures and microfossils.',
  },
  {
    id: 'deep-basalt-core',
    name: '2-Metre Unweathered Basalt Core',
    discipline: 'Geochronology',
    massKg: 3.2,
    scienceScore: 92,
    originNote: 'Drilled down 2 m into lava tube bedrock using Mission 2.1 Deep Drill Kit.',
    preservationDetail:
      'Pristine igneous crystal lattice for radiometric Ar-Ar dating of magnetic dynamo collapse.',
  },
  {
    id: 'glacial-basal-ice',
    name: 'Glacial Basal Ice & Cryo-Salts',
    discipline: 'Hydrology',
    massKg: 1.8,
    scienceScore: 88,
    originNote: 'Extracted from the deep basal boundary of the Mission 2.4 ice sheet.',
    preservationDetail:
      'Traps ancient atmospheric gas bubbles and isotopic D/H ratio of Mars’s wet epoch.',
  },
  {
    id: 'hydrothermal-silica',
    name: 'Hydrothermal Opaline Silica Vein',
    discipline: 'Hydrothermal',
    massKg: 2.2,
    scienceScore: 90,
    originNote: 'Precipitated along volcanic fractures where magma heated groundwater.',
    preservationDetail: 'Earth’s premier analog for the prebiotic chemical origins of life.',
  },
  {
    id: 'mantle-breccia',
    name: 'Impact Shocked Mantle Breccia',
    discipline: 'Volcanology',
    massKg: 2.8,
    scienceScore: 75,
    originNote: 'Deep crustal xenolith excavated by ancient basin-forming impact.',
    preservationDetail:
      'Reveals early planetary mantle differentiation and high-pressure impact shock physics.',
  },
  {
    id: 'dune-regolith',
    name: 'Active Eolian Dune Sand Lag',
    discipline: 'Volcanology',
    massKg: 1.5,
    scienceScore: 55,
    originNote: 'Wind-sorted basaltic sand and magnetite from modern active dune field.',
    preservationDetail: 'Calibrates modern atmospheric oxidation and space weathering rates.',
  },
  {
    id: 'evaporite-gypsum',
    name: 'Evaporite Sulfate & Gypsum Crust',
    discipline: 'Hydrology',
    massKg: 2.0,
    scienceScore: 82,
    originNote: 'Crystalline sulfate deposits formed during regional lake desiccation.',
    preservationDetail:
      'Records the transition from habitable neutral water to hyper-acidic arid Mars.',
  },
  {
    id: 'carbonate-concretion',
    name: 'Authigenic Siderite Carbonate Concretions',
    discipline: 'Astrobiology',
    massKg: 2.4,
    scienceScore: 85,
    originNote: 'Carbonate nodules precipitated within ancient sub-surface pore fluids.',
    preservationDetail:
      'Direct constraint on atmospheric CO2 partial pressure in Mars’s early climate.',
  },
]

export type SampleCampaignSelection = Record<SpecimenId, boolean>

export const DEFAULT_SAMPLE_SELECTION: SampleCampaignSelection = {
  'delta-mudstone': true,
  'deep-basalt-core': true,
  'glacial-basal-ice': true,
  'hydrothermal-silica': true,
  'mantle-breccia': false,
  'dune-regolith': false,
  'evaporite-gypsum': true,
  'carbonate-concretion': false,
}

export type SampleCampaignYield = {
  totalMassKg: number
  totalScienceScore: number
  selectedCount: number
  disciplinesCovered: SpecimenDiscipline[]
  isWithinMassLimit: boolean
  isBalancedPortfolio: boolean
  readyToSeal: boolean
  reasons: string[]
}

export const TARGET_SAMPLE = {
  maxReturnMassKg: 15.0,
  minScienceScore: 350,
  minDisciplinesCount: 3,
}

export function computeSampleCampaignYield(
  selection: SampleCampaignSelection,
  cargo2?: Cargo2Plan,
): SampleCampaignYield {
  let totalMassKg = 0
  let totalScienceScore = 0
  let selectedCount = 0
  const disciplineSet = new Set<SpecimenDiscipline>()

  // Check if player packed the deep drill kit in Mission 2.1
  const hasDeepDrillKit = (cargo2?.deepDrillKit ?? 1) >= 1

  for (const specimen of CANDIDATE_SPECIMENS) {
    if (selection[specimen.id]) {
      selectedCount++
      totalMassKg += specimen.massKg

      // Score bonus / penalty based on Mission 2.1 drill kit
      let score = specimen.scienceScore
      if (specimen.id === 'deep-basalt-core' && !hasDeepDrillKit) {
        score = 40 // degraded shallow chip rather than pristine 2m core
      }

      totalScienceScore += score
      disciplineSet.add(specimen.discipline)
    }
  }

  const disciplinesCovered = Array.from(disciplineSet)
  const isWithinMassLimit = totalMassKg <= TARGET_SAMPLE.maxReturnMassKg
  const isBalancedPortfolio = disciplinesCovered.length >= TARGET_SAMPLE.minDisciplinesCount

  const reasons: string[] = []

  if (totalMassKg > TARGET_SAMPLE.maxReturnMassKg) {
    reasons.push(
      `Total sample mass (${totalMassKg.toFixed(1)} kg) exceeds the MAV return envelope (${TARGET_SAMPLE.maxReturnMassKg.toFixed(1)} kg). Deselect lower-priority specimens.`,
    )
  }

  if (selectedCount === 0) {
    reasons.push('No specimens selected for Earth return.')
  }

  if (totalScienceScore < TARGET_SAMPLE.minScienceScore) {
    reasons.push(
      `Science value (${totalScienceScore}, a team rating) below the minimum (${TARGET_SAMPLE.minScienceScore}). Select higher-value targets.`,
    )
  }

  if (!isBalancedPortfolio) {
    reasons.push(
      `Selected portfolio covers only ${disciplinesCovered.length} disciplines (minimum ${TARGET_SAMPLE.minDisciplinesCount} required: Astrobiology, Geochronology, Hydrology, Hydrothermal).`,
    )
  }

  if (selection['deep-basalt-core'] && !hasDeepDrillKit) {
    reasons.push(
      'Deep basalt core lacks pristine unweathered depth: Mission 2.1 did not pack the Deep Drill Kit.',
    )
  }

  const readyToSeal = reasons.length === 0

  return {
    totalMassKg,
    totalScienceScore,
    selectedCount,
    disciplinesCovered,
    isWithinMassLimit,
    isBalancedPortfolio,
    readyToSeal,
    reasons,
  }
}

/** The end of 2.6. Expedition 2 still has its return mission, and a team rating is not a score to win. */
export function sampleFinishNote(y: SampleCampaignYield): string {
  return `Samples packed: ${y.totalMassKg.toFixed(1)} kg across ${y.disciplinesCovered.length} fields, stowed for the flight home. Mission 2.6 is done.`
}
