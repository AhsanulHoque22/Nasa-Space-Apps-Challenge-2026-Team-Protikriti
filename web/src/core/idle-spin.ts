/** The slow turn of Mars shown when the site opens, before anyone touches the map. */

/** Camera height above the Mars sphere: low enough to see terrain, high enough to show the limb. */
export const IDLE_SPIN_ALTITUDE_M = 500_000

/** One full turn takes this long. Mars's real 24.6 h day would look frozen, so this is sped up
 * (~21 km/s of ground passing under the camera at the equator). */
export const IDLE_SPIN_PERIOD_S = 1000

/** A longer pause between frames (a hidden tab) is treated as this long, so the view never jumps. */
export const IDLE_SPIN_MAX_STEP_S = 0.1

/** Angle (radians, always >= 0) to turn the planet for a frame that took `dtS` seconds. */
export function idleSpinStepRad(dtS: number): number {
  if (!Number.isFinite(dtS) || dtS <= 0) return 0
  return (2 * Math.PI * Math.min(dtS, IDLE_SPIN_MAX_STEP_S)) / IDLE_SPIN_PERIOD_S
}
