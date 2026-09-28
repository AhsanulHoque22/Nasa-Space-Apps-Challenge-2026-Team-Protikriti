import type { Grid } from './grid'

/** Test-only: build a Grid from rows of elevations (20 m pixels, 15° limit). */
export function makeGrid(rows: number[][], pixelSizeM = 20): Grid {
  const height = rows.length
  const width = rows[0]?.length ?? 0
  return {
    width,
    height,
    pixelSizeM,
    west: 0,
    north: 1,
    east: 1,
    south: 0,
    maxSafeSlopeDeg: 15,
    elevationM: Float32Array.from(rows.flat()),
  }
}

export const WALL = 100 // metres: far steeper than 15° over a 20 m step
