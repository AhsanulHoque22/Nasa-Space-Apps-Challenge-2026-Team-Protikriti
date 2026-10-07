/** Hazard markers dropped by the crew: ground to keep clear of, whatever the slope map says. */
import type { Cell, Grid } from './grid'

/** Keep-out radius around a marker. A planning assumption, not a measured safety distance. */
export const HAZARD_RADIUS_M = 60

/** 1 on every cell within `radiusM` of a hazard (grid edges clip), 0 elsewhere. */
export function hazardMask(g: Grid, hazards: Cell[], radiusM = HAZARD_RADIUS_M): Uint8Array {
  const mask = new Uint8Array(g.width * g.height)
  const reach = Math.ceil(radiusM / g.pixelSizeM)
  for (const h of hazards) {
    for (let dr = -reach; dr <= reach; dr++) {
      for (let dc = -reach; dc <= reach; dc++) {
        const row = h.row + dr
        const col = h.col + dc
        if (row < 0 || row >= g.height || col < 0 || col >= g.width) continue
        if (Math.hypot(dr, dc) * g.pixelSizeM <= radiusM) mask[row * g.width + col] = 1
      }
    }
  }
  return mask
}

export function touchesHazard(path: Cell[], width: number, mask: Uint8Array): boolean {
  return path.some((c) => mask[c.row * width + c.col] === 1)
}
