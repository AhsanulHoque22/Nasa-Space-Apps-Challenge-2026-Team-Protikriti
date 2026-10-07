/** What (if anything) of ours is under the pointer. Map objects use "kind:..." string ids. */
import type { Cartesian2, Cartesian3, Viewer } from 'cesium'
import { nearestWithin, type ScreenPoint } from '../core/hit'
import { isOnNearSide } from '../core/horizon'
import { MARS_SPHERE } from './mars'

export const INTERACTIVE_PREFIXES = ['station:', 'stop:', 'activity:', 'cave:'] as const

// Hit radius around the pointer. A fingertip covers ~40 px and a stop dot is 6-14 px, so taps
// need a generous radius; a mouse is precise.
const TOUCH_HIT_PX = 24
const MOUSE_HIT_PX = 10
// Same margin as the far-side label culling (layers.ts): below the deepest exaggerated ground.
const HORIZON_MARGIN_M = 20_000

/** A clickable map point: where it is drawn, and whether it is showing right now. */
export type Clickable = { id: string; position: Cartesian3; shown: () => boolean }

// Hit-tested on the CPU, not with scene.pick/drillPick: GPU picking returned the draped traverse
// line on top of the dots, and drillPick hides what it finds until the next frame, so the
// second click handler in the same click saw nothing (the dot "blinked" and the click was lost).
const clickables: Clickable[] = []

export function addClickables(items: Clickable[]): void {
  clickables.push(...items)
}

function hitRadiusPx(): number {
  return globalThis.matchMedia?.('(pointer: coarse)').matches ? TOUCH_HIT_PX : MOUSE_HIT_PX
}

/** Id of the clickable map point under the pointer, if any. */
export function pickedId(viewer: Viewer, position: Cartesian2): string | undefined {
  if (isExploring()) return undefined // explore mode owns the canvas
  const camera = viewer.camera.positionWC
  const onScreen: ScreenPoint[] = []
  for (const c of clickables) {
    if (
      !c.shown() ||
      !isOnNearSide(camera, c.position, MARS_SPHERE.maximumRadius, HORIZON_MARGIN_M)
    )
      continue
    const xy = viewer.scene.cartesianToCanvasCoordinates(c.position)
    if (xy) onScreen.push({ id: c.id, x: xy.x, y: xy.y })
  }
  return nearestWithin(onScreen, position.x, position.y, hitRadiusPx())
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
