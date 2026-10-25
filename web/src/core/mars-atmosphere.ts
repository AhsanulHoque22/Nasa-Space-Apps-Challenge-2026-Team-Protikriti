/**
 * Air pressure on Mars by height, from NASA Glenn Research Center's Mars atmosphere model
 * (https://www.grc.nasa.gov/www/k-12/airplane/atmosmrm.html): p = 0.699 e^(-0.00009 h) kPa, with h
 * in metres. The same pressure law holds above and below 7 km in that model; only temperature
 * changes. Used for "why landing elevation matters" (mission 1.3).
 */

/** Pressure at the model's reference level, kPa. */
export const MARS_REFERENCE_PRESSURE_KPA = 0.699
/** Exponential decay of pressure with height, per metre. */
export const MARS_PRESSURE_DECAY_PER_M = 0.00009

export function marsPressureKpa(heightM: number): number {
  return MARS_REFERENCE_PRESSURE_KPA * Math.exp(-MARS_PRESSURE_DECAY_PER_M * heightM)
}

/** Share of the air above `referenceM` that is missing at `heightM` (negative if there is more). */
export function lessAirThan(heightM: number, referenceM: number): number {
  return 1 - marsPressureKpa(heightM) / marsPressureKpa(referenceM)
}
