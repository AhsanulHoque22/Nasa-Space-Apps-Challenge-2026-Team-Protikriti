/**
 * How long the crew stays, and when the next ship lands. Launch windows from Earth to Mars come
 * once per synodic period, 779.94 days (NASA Mars Fact Sheet). The crew's first return date is
 * 539 days after landing (DRA 5.0, Drake 2009); later ones follow a synodic period apart, our
 * derivation from those two facts. The shortest stay offered lasts until the next ship lands.
 */
import { DAYS_PER_SOL } from './mission-constants'

/** Stays the crew can choose, Earth days: 539 + 780 and 539 + 2 × 780, rounded. */
export const STAY_DAYS = [1319, 2099] as const

const SOL_MS = DAYS_PER_SOL * 86_400_000

export const staySols = (days: number): number => Math.ceil(days / DAYS_PER_SOL)

/** The sol (counted from the crew's landing, sol 1 = landing day) the next ship lands. */
export const nextShipSol = (crewArriveMs: number, shipArriveMs: number): number =>
  Math.ceil((shipArriveMs - crewArriveMs) / SOL_MS)

/** The stay chosen in mission 1.1, and the next ship's route and landing sol. */
export type Stay = { days: number; sols: number; nextShipSol: number; nextShipRouteDays: number }

export const isStay = (v: unknown): v is Stay => {
  const s = v as Partial<Stay> | null
  return (
    !!s &&
    STAY_DAYS.includes(s.days as (typeof STAY_DAYS)[number]) &&
    s.sols === staySols(s.days as number) &&
    Number.isInteger(s.nextShipSol) &&
    (s.nextShipSol as number) > 0 &&
    (s.nextShipSol as number) < (s.sols as number) &&
    Number.isInteger(s.nextShipRouteDays)
  )
}
