/**
 * Mission 1.4: where the base's parts may stand on the real terrain. Three rules, each with its
 * source or labelled as a team assumption:
 * - ground no steeper than BASE_SLOPE_LIMIT_DEG under any part (team assumption, see below);
 * - Kilopower reactors at least 1 km from the habitat (Rucker et al. 2016);
 * - solar arrays losing no more than ARRAY_SHADE_LIMIT of the darkest sol's sunlight to terrain
 *   shadow (team assumption).
 */
import { compassOf, slopeDegAt } from './eva-telemetry'
import { type Cell, type Grid, cellToLonLat, lonLatToCell } from './grid'
import { distanceKm } from './site-report'
import { bearingRad } from './terrain-line'

/**
 * Team assumption: the app's 15° walk and rover hazard limit. No sourced figure for a crewed
 * lander or habitat has been found yet (docs/story-mode-guide.md, open items).
 */
export const BASE_SLOPE_LIMIT_DEG = 15
/** "Kilopower units must be at least 1 km from continuously occupied crew assets, such as the habitat" (Rucker et al. 2016). */
export const REACTOR_STANDOFF_M = 1000
/** Team assumption: arrays may lose up to 10% of the darkest sol's sunlight to terrain shadow. */
export const ARRAY_SHADE_LIMIT = 0.1

export type BasePart = 'habitat' | 'reactor' | 'arrays' | 'oxygen'
export const PART_ORDER: readonly BasePart[] = ['habitat', 'reactor', 'arrays', 'oxygen']
export const PART_NAME: Record<BasePart, string> = {
  habitat: 'Habitat',
  reactor: 'Kilopower reactors',
  arrays: 'Solar arrays',
  oxygen: 'Oxygen plant and return rocket',
}

export type LonLat = { lon: number; lat: number }
export type Layout = Partial<Record<BasePart, LonLat>>
/** Which optional parts were packed in mission 1.1. */
export type Needs = { reactor: boolean; arrays: boolean }
/** A daylight sun position over the sol, weighted by the sunlight it brings (e.g. W/m²). */
export type SunSample = { azimuthDeg: number; elevationDeg: number; weight: number }

export type PartResult = { part: BasePart; problems: string[] }
export type LayoutResult = { parts: PartResult[]; go: boolean }
export type LayoutHint = { part: BasePart; distanceM: number; text: string }

const DEG = Math.PI / 180

/** True when nothing in the terrain rises above the line from the cell's centre toward the sun. */
export function cellSeesSun(
  g: Grid,
  cell: Cell,
  azimuthDeg: number,
  elevationDeg: number,
): boolean {
  if (elevationDeg <= 0) return false
  const z0 = g.elevationM[cell.row * g.width + cell.col] as number
  const dCol = Math.sin(azimuthDeg * DEG) // +col is east
  const dRow = -Math.cos(azimuthDeg * DEG) // +row is south
  const rise = Math.tan(elevationDeg * DEG) * g.pixelSizeM // per cell of travel
  for (let step = 1; ; step++) {
    const row = Math.round(cell.row + dRow * step)
    const col = Math.round(cell.col + dCol * step)
    if (row < 0 || col < 0 || row >= g.height || col >= g.width) return true
    const z = g.elevationM[row * g.width + col] as number
    if (Number.isFinite(z) && z > z0 + rise * step) return false
  }
}

/** Share of the sol's sunlight (by sample weight) that terrain shadow takes from a cell. */
export function shadeLoss(g: Grid, cell: Cell, sun: readonly SunSample[]): number {
  const total = sun.reduce((s, x) => s + x.weight, 0)
  if (total <= 0) return 0
  const blocked = sun.reduce(
    (s, x) => s + (cellSeesSun(g, cell, x.azimuthDeg, x.elevationDeg) ? 0 : x.weight),
    0,
  )
  return blocked / total
}

const metres = (km: number) => Math.round(km * 1000)

/** What is wrong with one part at `p`, given the other parts already placed. */
function problemsAt(
  g: Grid,
  part: BasePart,
  p: LonLat,
  layout: Layout,
  sun: readonly SunSample[],
): string[] {
  const cell = lonLatToCell(g, p.lon, p.lat)
  if (!cell) return ['It is outside the mapped terrain: place it on the detailed ground.']
  const out: string[] = []
  const slope = slopeDegAt(g, cell)
  if (slope !== null && slope > BASE_SLOPE_LIMIT_DEG) {
    out.push(
      `The ground here slopes ${Math.round(slope)}°; the limit is ${BASE_SLOPE_LIMIT_DEG}° (team assumption).`,
    )
  }
  const habitat = layout.habitat
  if (part === 'reactor' && habitat) {
    const d = metres(distanceKm(p.lon, p.lat, habitat.lon, habitat.lat))
    if (d < REACTOR_STANDOFF_M) {
      out.push(
        `It is ${d.toLocaleString('en-US')} m from the habitat; it must be at least 1 km away for the crew’s safety (Rucker et al. 2016).`,
      )
    }
  }
  if (part === 'arrays') {
    const loss = shadeLoss(g, cell, sun)
    if (loss > ARRAY_SHADE_LIMIT) {
      out.push(
        `Terrain shadow takes ${Math.round(loss * 100)}% of the sunlight on the darkest sol; the limit is ${ARRAY_SHADE_LIMIT * 100}% (team assumption).`,
      )
    }
  }
  return out
}

const wanted = (needs: Needs) =>
  PART_ORDER.filter((p) => (p === 'reactor' ? needs.reactor : p === 'arrays' ? needs.arrays : true))

export function checkLayout(
  g: Grid,
  layout: Layout,
  needs: Needs,
  sun: readonly SunSample[],
): LayoutResult {
  const parts = wanted(needs).map((part) => {
    const p = layout[part]
    return { part, problems: p ? problemsAt(g, part, p, layout, sun) : ['Not placed yet.'] }
  })
  return { parts, go: parts.every((x) => x.problems.length === 0) }
}

const DIRECTION: Record<string, string> = {
  N: 'north',
  NE: 'north-east',
  E: 'east',
  SE: 'south-east',
  S: 'south',
  SW: 'south-west',
  W: 'west',
  NW: 'north-west',
}
/** Cells to try: at most about this many, spread evenly over the grid. */
const HINT_SAMPLES = 40_000

/**
 * For each placed part that fails, the nearest ground where it would pass, as a direction and a
 * distance. Options for the user, never a placement: the user moves the part.
 */
export function layoutHints(
  g: Grid,
  layout: Layout,
  needs: Needs,
  sun: readonly SunSample[],
): LayoutHint[] {
  const stride = Math.max(1, Math.ceil(Math.sqrt((g.width * g.height) / HINT_SAMPLES)))
  const hints: LayoutHint[] = []
  for (const part of wanted(needs)) {
    const p = layout[part]
    if (!p || problemsAt(g, part, p, layout, sun).length === 0) continue
    // Nearest candidates first: the first one that passes is the answer, so the costly shadow
    // test runs only as far out as needed.
    const candidates: Array<{ km: number; at: LonLat }> = []
    for (let row = 0; row < g.height; row += stride) {
      for (let col = 0; col < g.width; col += stride) {
        const [lon, lat] = cellToLonLat(g, { row, col })
        candidates.push({ km: distanceKm(p.lon, p.lat, lon, lat), at: { lon, lat } })
      }
    }
    candidates.sort((a, b) => a.km - b.km)
    const best = candidates.find((c) => problemsAt(g, part, c.at, layout, sun).length === 0)
    if (!best) continue
    const direction =
      DIRECTION[compassOf(bearingRad([p.lon, p.lat], [best.at.lon, best.at.lat]) / DEG)] ?? ''
    const distanceM = metres(best.km)
    hints.push({
      part,
      distanceM,
      text: `Ground that passes every rule starts about ${distanceM.toLocaleString('en-US')} m to the ${direction}.`,
    })
  }
  return hints
}
