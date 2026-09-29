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
