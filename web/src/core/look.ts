/** Street View zoom: field-of-view changes that feel continuous on wheels, trackpads and touch. */

export const FOV_RANGE = { min: 25, max: 100 } as const
// Wheel pixels per e-fold of field of view: 100 px of scroll changes the view by about 14%.
const WHEEL_PX_PER_EFOLD = 700

const clamp = (fov: number) => Math.min(FOV_RANGE.max, Math.max(FOV_RANGE.min, fov))

/** Two-finger pinch: the view scales with the distance between the fingers. */
export function pinchFov(fov: number, previousDistPx: number, distPx: number): number {
  return clamp((fov * previousDistPx) / Math.max(1, distPx))
}

/** Wheel or trackpad scroll (deltaY in pixels; positive zooms out). */
export function wheelFov(fov: number, deltaYPx: number): number {
  return clamp(fov * Math.exp(deltaYPx / WHEEL_PX_PER_EFOLD))
}

// Map wheel zoom: 100 px of scroll (one mouse notch) moves ~20% of the way to the point under
// the pointer, at any range. Cesium's own wheel zoom measured range as height above the datum,
// which is negative in Jezero and Gale (km below it), so it crawled to a stop near the ground.
const MAP_WHEEL_PX_PER_EFOLD = 450
const MIN_TARGET_DISTANCE_M = 5

/** New distance to the zoom target after a wheel scroll (deltaY in pixels; positive zooms out). */
export function wheelZoomDistanceM(distanceM: number, deltaYPx: number): number {
  return Math.max(MIN_TARGET_DISTANCE_M, distanceM * Math.exp(deltaYPx / MAP_WHEEL_PX_PER_EFOLD))
}
