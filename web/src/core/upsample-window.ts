/**
 * Where a tile deeper than an imagery source's last level sits inside a 3x3 block of the source's
 * own tiles around its ancestor. Drawing that window from the block (one canvas, smoothed) lets
 * neighbouring deep tiles interpolate across the source tile edges instead of each clamping at its
 * own edge, which drew a hard step on every tile seam once a texel covered many screen pixels.
 */
export type UpsampleWindow = {
  /** The source tile at the centre of the 3x3 block. */
  parentX: number
  parentY: number
  parentLevel: number
  /** Source rectangle in block pixels (block is 3 x tileSize square, centre tile at 1,1). */
  sx: number
  sy: number
  size: number
}

export function upsampleWindow(
  x: number,
  y: number,
  level: number,
  sourceMaxLevel: number,
  tileSize: number,
): UpsampleWindow {
  const n = 2 ** (level - sourceMaxLevel)
  const parentX = Math.floor(x / n)
  const parentY = Math.floor(y / n)
  const size = tileSize / n
  return {
    parentX,
    parentY,
    parentLevel: sourceMaxLevel,
    sx: tileSize + (x - parentX * n) * size,
    sy: tileSize + (y - parentY * n) * size,
    size,
  }
}
