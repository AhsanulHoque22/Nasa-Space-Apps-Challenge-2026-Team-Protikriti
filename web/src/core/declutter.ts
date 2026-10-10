/** Choosing which map labels to show so none overlap and only those in view are drawn. */

export type LabelCandidate = {
  id: number
  /** Where the label is centred on the screen, in pixels. */
  x: number
  y: number
  width: number
  height: number
  /** Bigger wins a clash: the more important label stays, the other is dropped. */
  priority: number
}

export type Viewport = { width: number; height: number }

const GAP_PX = 4 // breathing room kept between two labels

const overlap = (a: LabelCandidate, b: LabelCandidate): boolean =>
  Math.abs(a.x - b.x) * 2 < a.width + b.width + GAP_PX &&
  Math.abs(a.y - b.y) * 2 < a.height + b.height + GAP_PX

/** Ids to show: inside the viewport, most important first, skipping any that would overlap. */
export function declutter(candidates: readonly LabelCandidate[], view: Viewport): Set<number> {
  const inView = candidates.filter(
    (c) => c.x >= 0 && c.x <= view.width && c.y >= 0 && c.y <= view.height,
  )
  // Ties broken by id so the same labels win on every frame (no flicker while the map is still).
  inView.sort((a, b) => b.priority - a.priority || a.id - b.id)
  const kept: LabelCandidate[] = []
  for (const c of inView) if (!kept.some((k) => overlap(k, c))) kept.push(c)
  return new Set(kept.map((k) => k.id))
}
