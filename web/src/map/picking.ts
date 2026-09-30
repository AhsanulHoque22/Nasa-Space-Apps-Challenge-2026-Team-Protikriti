/** What (if anything) of ours is under the pointer. Map objects use "kind:..." string ids. */
import type { Cartesian2, Viewer } from 'cesium'

export const INTERACTIVE_PREFIXES = ['station:', 'stop:', 'activity:'] as const

// Objects to look through under the cursor: stop dots share their pixels with the draped
// traverse line and replay trail, which sit on top and would otherwise swallow the click.
const PICK_DEPTH = 8
// Pick area (px square). Cesium's default 3 px misses a 6-14 px stop dot under a ~40 px
// fingertip, so a tap on a dot on a phone landed on the ground and added a Marswalk point.
const TOUCH_PICK_PX = 28
const MOUSE_PICK_PX = 8

function pickSizePx(): number {
  return globalThis.matchMedia?.('(pointer: coarse)').matches ? TOUCH_PICK_PX : MOUSE_PICK_PX
}

function idOf(picked: { id?: unknown }): string | undefined {
  const id = picked.id
  if (typeof id === 'string') return id // primitives (PointPrimitive.id)
  const entityId = (id as { id?: unknown } | undefined)?.id
  return typeof entityId === 'string' ? entityId : undefined // entities
}

/** Id of the clickable map object under the pointer, else of the topmost object, if any. */
export function pickedId(viewer: Viewer, position: Cartesian2): string | undefined {
  if (isExploring()) return undefined // explore mode owns the canvas
  const size = pickSizePx()
  const picked = viewer.scene.drillPick(position, PICK_DEPTH, size, size) as { id?: unknown }[]
  const ids = picked.map(idOf)
  return ids.find((id) => id && INTERACTIVE_PREFIXES.some((p) => id.startsWith(p))) ?? ids[0]
}

/** True when the click hit a clickable map object (so terrain clicks should be ignored). */
export function isInteractiveClick(viewer: Viewer, position: Cartesian2): boolean {
  const id = pickedId(viewer, position)
  return id !== undefined && INTERACTIVE_PREFIXES.some((p) => id.startsWith(p))
}

/** Explore mode owns input: map click tools must ignore the canvas while it runs. */
export function isExploring(): boolean {
  return document.body.classList.contains('exploring')
}
