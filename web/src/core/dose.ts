/** Radiation dose rates people would face, each from a published measurement or standard. */

/** NASA-STD-3001 Vol. 1 (2022 update): career effective dose limit for every astronaut. */
export const CAREER_LIMIT_MSV = 600

export type DoseRate = {
  id: 'earth' | 'surface' | 'cruise' | 'cave'
  where: string
  /** Effective dose per Earth day, mSv; null where nothing has been measured. */
  msvPerDay: number | null
  plusMinus: number | null
  source: string
}

export const DOSE_RATES: readonly DoseRate[] = [
  {
    id: 'earth',
    where: 'Earth, natural background (world average)',
    msvPerDay: 2.4 / 365.25,
    plusMinus: null,
    source: 'UNSCEAR 2000: 2.4 mSv a year',
  },
  {
    id: 'surface',
    where: 'Mars surface, Gale crater',
    msvPerDay: 0.64,
    plusMinus: 0.12,
    source: 'Curiosity RAD, Hassler et al. 2014, Science 343',
  },
  {
    id: 'cruise',
    where: 'In transit to Mars, inside the spacecraft',
    msvPerDay: 1.84,
    plusMinus: 0.3,
    source: 'Curiosity RAD in cruise, Zeitlin et al. 2013, Science 340',
  },
  {
    id: 'cave',
    where: 'Inside a Martian cave, pit or lava tube',
    msvPerDay: null,
    plusMinus: null,
    source: 'No measurement exists: overhead rock should cut the dose, but by how much is unknown',
  },
]

/** Days at this dose rate to reach the career limit; null without a measured, positive rate. */
export function daysToLimit(msvPerDay: number | null): number | null {
  return msvPerDay && msvPerDay > 0 ? CAREER_LIMIT_MSV / msvPerDay : null
}

const SOL_DAYS = 88_775.244 / 86_400

/** The Gale surface rate per Mars sol (a sol is 1.0275 Earth days). */
export function surfaceMsvPerSol(): number {
  const surface = DOSE_RATES.find((r) => r.id === 'surface')?.msvPerDay as number
  return surface * SOL_DAYS
}
