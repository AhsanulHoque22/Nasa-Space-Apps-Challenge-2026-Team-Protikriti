/**
 * The part of the screen a 3D stage may use beside or above the mission dock: right of the dock
 * when it sits on the left, left of it when it sits on the right, above it when stacked (phones).
 */
export type Region = { left: number; right: number; bottom: number }

export function freeRegion(dock: HTMLElement | null): Region {
  const box = dock?.getBoundingClientRect()
  const w = window.innerWidth
  if (!box) return { left: 0, right: 0, bottom: 0 }
  if (box.left > w * 0.3) return { left: 0, right: w - box.left, bottom: 0 } // dock on the right
  if (box.right < w * 0.7) return { left: box.right, right: 0, bottom: 0 } // dock on the left
  return { left: 0, right: 0, bottom: Math.max(0, window.innerHeight - box.top) } // stacked
}

export function applyRegion(el: HTMLElement, r: Region): void {
  el.style.left = `${r.left}px`
  el.style.right = `${r.right}px`
  el.style.bottom = `${r.bottom}px`
}
