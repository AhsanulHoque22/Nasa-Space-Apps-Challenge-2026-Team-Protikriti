/** What (if anything) of ours is under the pointer. Map objects use "kind:..." string ids. */
import type { Cartesian2, Viewer } from 'cesium'

export const INTERACTIVE_PREFIXES = ['station:', 'stop:', 'activity:'] as const

/** String id of the picked entity or primitive, if any. */
export function pickedId(viewer: Viewer, position: Cartesian2): string | undefined {
  const picked = viewer.scene.pick(position) as { id?: unknown } | undefined
  const id = picked?.id
  if (typeof id === 'string') return id // primitives (PointPrimitive.id)
  const entityId = (id as { id?: unknown } | undefined)?.id
  return typeof entityId === 'string' ? entityId : undefined // entities
}

/** True when the click hit a clickable map object (so terrain clicks should be ignored). */
export function isInteractiveClick(viewer: Viewer, position: Cartesian2): boolean {
  const id = pickedId(viewer, position)
  return id !== undefined && INTERACTIVE_PREFIXES.some((p) => id.startsWith(p))
}
