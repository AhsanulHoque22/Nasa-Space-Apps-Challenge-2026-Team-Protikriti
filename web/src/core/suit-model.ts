/**
 * How a suit's oxygen and battery run down on a walk, as shares of a full suit. A model built from
 * two sources, not a measured suit:
 * - A full suit lasts 8 hours (NASA EVA-EXP-0075, 2020) at Apollo's 1200 BTU/hr design metabolic
 *   rate (Carson, "Apollo Portable Life Support System Performance Report", NASA MSC 1972).
 * - Oxygen is used in step with the metabolic rate: walking 1200 BTU/hr, working at a science
 *   stop 1050 BTU/hr (Bellcomm B70-10028, Benjamin 1970).
 * - The battery current held steady through Apollo EVAs (Carson 1972), so power drains evenly.
 * Apollo crews averaged 750–1118 BTU/hr (Carson 1972, Table 4.1): real suits mostly did better.
 */
import { EVA_LIMITS } from './eva-card'

export const DESIGN_BTU_HR = 1200
export const WALK_BTU_HR = 1200
export const WORK_BTU_HR = 1050

const fullSuitBtu = () => DESIGN_BTU_HR * (EVA_LIMITS.maxEvaMin / 60)
const clampShare = (x: number) => Math.min(1, Math.max(0, x))

/** Share of the suit's oxygen left after `walkMin` walking and `workMin` working. */
export function oxygenLeftShare(walkMin: number, workMin: number): number {
  const used = (walkMin / 60) * WALK_BTU_HR + (workMin / 60) * WORK_BTU_HR
  return clampShare(1 - used / fullSuitBtu())
}

/** Share of the suit's battery left after `minutes` outside. */
export function powerLeftShare(minutes: number): number {
  return clampShare(1 - minutes / EVA_LIMITS.maxEvaMin)
}
