/** The slow turn of Mars shown when the site opens, before anyone touches the map. */

/** Camera height above the Mars sphere: low enough to see terrain, high enough to show the limb. */
export const IDLE_SPIN_ALTITUDE_M = 500_000

/** One full turn takes this long. Mars's real 24.6 h day would look frozen, so this is sped up
 * (~140 km/s of ground passing under the camera at the equator: a clear, calm drift at 500 km). */
export const IDLE_SPIN_PERIOD_S = 150

/** A longer pause between frames (a hidden tab) is treated as this long, so the view never jumps.
 * It is generous enough that a slow machine (4 fps) still turns at the intended speed. */
export const IDLE_SPIN_MAX_STEP_S = 0.25

/** Angle (radians, always >= 0) to turn the planet for a frame that took `dtS` seconds. */
export function idleSpinStepRad(dtS: number): number {
  if (!Number.isFinite(dtS) || dtS <= 0) return 0
  return (2 * Math.PI * Math.min(dtS, IDLE_SPIN_MAX_STEP_S)) / IDLE_SPIN_PERIOD_S
}
