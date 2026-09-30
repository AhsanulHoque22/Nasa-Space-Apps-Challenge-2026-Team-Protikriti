/** Screen-space hit testing: which clickable point is under the pointer? */

export type ScreenPoint = { id: string; x: number; y: number }

/** Id of the point closest to (x, y), if it is within `radiusPx`. */
export function nearestWithin(
  points: Iterable<ScreenPoint>,
  x: number,
  y: number,
  radiusPx: number,
): string | undefined {
  let best: string | undefined
  let bestDistance = radiusPx
  for (const p of points) {
    const distance = Math.hypot(p.x - x, p.y - y)
    if (distance <= bestDistance) {
      best = p.id
      bestDistance = distance
    }
  }
  return best
}
