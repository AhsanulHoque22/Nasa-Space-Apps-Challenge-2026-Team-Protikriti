/**
 * Mission 1.5, the first Marswalk: which known places are near the base, the walk's clock along
 * its route, and the radiation dose of the time outside.
 */
import { DOSE_RATES } from './dose'
import { type Cell, type Grid, lonLatToCell } from './grid'
import { DEFAULT_SUIT_FACTOR, stepTimeS } from './route'
import { distanceKm } from './site-report'

type Place = { name: string; lon: number; lat: number }

/** Up to `n` places on the mapped terrain, nearest to `home` first, leaving out home's own cell. */
export function nearbyStops<T extends Place>(
  places: readonly T[],
  home: { lon: number; lat: number },
  grid: Grid,
  n: number,
): T[] {
  const homeCell = lonLatToCell(grid, home.lon, home.lat)
  return places
    .filter((p) => {
      const c = lonLatToCell(grid, p.lon, p.lat)
      return c !== null && !(homeCell && c.row === homeCell.row && c.col === homeCell.col)
    })
    .map((p) => ({ p, km: distanceKm(home.lon, home.lat, p.lon, p.lat) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, n)
    .map(({ p }) => p)
}

/**
 * Minutes into the walk at each point of `path`: suited walking time step by step, plus `stopMin`
 * spent at the science stop (path index `stopIndex`) before walking on.
 */
export function walkClock(
  g: Grid,
  path: readonly Cell[],
  stopIndex: number,
  stopMin: number,
  speedFactor = DEFAULT_SUIT_FACTOR,
): number[] {
  const out = [0]
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1] as Cell
    const b = path[i] as Cell
    const stay = i - 1 === stopIndex ? stopMin : 0
    out.push((out[i - 1] ?? 0) + stay + stepTimeS(g, a, b, speedFactor) / 60)
  }
  return out
}

/** Dose of `minutes` outside at the Gale surface rate (Curiosity RAD, Hassler et al. 2014), mSv. */
export function walkDoseMsv(minutes: number): number {
  const perDay = DOSE_RATES.find((r) => r.id === 'surface')?.msvPerDay ?? 0
  return (perDay * minutes) / (24 * 60)
}
