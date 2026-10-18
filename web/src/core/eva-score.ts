/** EVA Safety Score: composite 0 (safe) – 100 (hazardous) from slope, firmness, and chemistry. */
import type { Grid } from './grid'
import { cellToLonLat } from './grid'
import { cellGrade } from './route'
import type { ThermalGrid } from './thermal'
import { thermalAt } from './thermal'
import type { CrismGrid } from './crism'
import { crismAt } from './crism'

export type EssWeights = { slope: number; firmness: number; chemical: number }

export const DEFAULT_ESS_WEIGHTS: EssWeights = { slope: 0.5, firmness: 0.25, chemical: 0.25 }

export type EssInputs = {
  grid: Grid
  thermal: ThermalGrid | null
  crism: CrismGrid | null
  weights?: EssWeights
}

/**
 * EVA Safety Score for the cell at (row, col).
 * Returns null when elevation is NaN (no terrain data) or when crism is provided
 * and the cell falls inside the CRISM grid but the pixel is NaN.
 */
export function evaScore(inputs: EssInputs, row: number, col: number): number | null {
  const { grid, thermal, crism, weights = DEFAULT_ESS_WEIGHTS } = inputs
  const { width, height, pixelSizeM, maxSafeSlopeDeg } = grid

  // Slope component
  const at = (r: number, c: number) => grid.elevationM[r * width + c] as number
  const grade = cellGrade(at, width, height, pixelSizeM, row, col)
  if (Number.isNaN(grade)) return null
  const slopeLimit = Math.tan((maxSafeSlopeDeg * Math.PI) / 180)
  const slopeNorm = Math.min(1, slopeLimit > 0 ? grade / slopeLimit : 0)

  const [lon, lat] = cellToLonLat(grid, { row, col })

  // Firmness component (low thermal inertia = loose = higher risk)
  let firmnessRisk = 0.5 // neutral when no data
  if (thermal !== null) {
    const tv = thermalAt(thermal, lon, lat)
    if (tv !== null) {
      const span = thermal.p98 - thermal.p02
      firmnessRisk = span > 0 ? 1 - (tv - thermal.p02) / span : 0.5
      firmnessRisk = Math.max(0, Math.min(1, firmnessRisk))
    }
  }

  // Chemical component
  let chemRisk = 0.5 // neutral when no layer provided
  if (crism !== null) {
    const cv = crismAt(crism, lon, lat)
    // Cell is inside the CRISM grid but pixel is NaN → unknown hazard → propagate null
    const insideCrism =
      lon >= crism.west && lon <= crism.east && lat >= crism.south && lat <= crism.north
    if (insideCrism && cv === null) return null
    if (cv !== null) chemRisk = cv
  }

  const raw =
    weights.slope * slopeNorm + weights.firmness * firmnessRisk + weights.chemical * chemRisk
  return Math.max(0, Math.min(1, raw)) * 100
}
