/** A rotary knob with detents: 270 degrees of travel, a dead zone at the bottom. */
const HALF_SWEEP_DEG = 135

export function knobAngleDeg(index: number, count: number): number {
  if (count <= 1) return 0
  return -HALF_SWEEP_DEG + (index / (count - 1)) * 2 * HALF_SWEEP_DEG
}

export function knobIndexFromPointer(
  centre: { x: number; y: number },
  pointer: { x: number; y: number },
  count: number,
): number {
  const fromUp = (Math.atan2(pointer.x - centre.x, centre.y - pointer.y) * 180) / Math.PI
  const clamped = Math.min(HALF_SWEEP_DEG, Math.max(-HALF_SWEEP_DEG, fromUp))
  return Math.round(((clamped + HALF_SWEEP_DEG) / (2 * HALF_SWEEP_DEG)) * (count - 1))
}

export const stepIndex = (index: number, by: number, count: number): number =>
  Math.min(count - 1, Math.max(0, index + by))
