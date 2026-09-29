/**
 * Pick the real panorama at a stop. A stop's Navcam frames mix many imaging sequences, and
 * several stare at one spot (e.g. 21 atmospheric-monitoring frames at the same pointing).
 * Street View should show the one sequence that sweeps the widest arc, without repeats.
 */
import { type Frame, frameGeometry } from './streetview'

const mod = (x: number, m: number) => ((x % m) + m) % m
const SAME_POINTING_DEG = 1

/** Degrees of azimuth covered by the union of the frames' footprints (max 360). */
export function azimuthCoverageDeg(frames: readonly Frame[]): number {
  if (frames.length === 0) return 0
  const arcs = frames
    .map((f) => {
      const g = frameGeometry(f)
      if (g.widthDeg >= 360) return [0, 360] as [number, number]
      const start = mod(g.azDeg - g.widthDeg / 2, 360)
      return [start, start + g.widthDeg] as [number, number]
    })
    .flatMap(
      ([a, b]) =>
        (b > 360
          ? [
              [a, 360],
              [0, b - 360],
            ]
          : [[a, b]]) as Array<[number, number]>,
    )
    .sort((x, y) => x[0] - y[0])
  let covered = 0
  let [curStart, curEnd] = arcs[0] ?? [0, 0]
  for (const [a, b] of arcs.slice(1)) {
    if (a <= curEnd) curEnd = Math.max(curEnd, b)
    else {
      covered += curEnd - curStart
      ;[curStart, curEnd] = [a, b]
    }
  }
  return Math.min(360, covered + (curEnd - curStart))
}

function dedupePointings(frames: readonly Frame[]): Frame[] {
  const kept: Frame[] = []
  for (const f of frames) {
    const g = frameGeometry(f)
    const repeat = kept.some((k) => {
      const h = frameGeometry(k)
      const dAz = Math.abs(mod(g.azDeg - h.azDeg + 180, 360) - 180)
      return dAz < SAME_POINTING_DEG && Math.abs(g.elDeg - h.elDeg) < SAME_POINTING_DEG
    })
    if (!repeat) kept.push(f)
  }
  return kept
}

// Another sequence at the same stop joins the panorama only if it shows this much new azimuth.
const MIN_ADDED_COVERAGE_DEG = 15

/**
 * The widest sweep at the stop, plus any other sequences there that fill directions it missed
 * (e.g. a drive-direction pan and a look back). Repeated pointings are dropped.
 */
export function selectPanorama(frames: readonly Frame[]): { frames: Frame[]; coverageDeg: number } {
  const bySequence = new Map<string, Frame[]>()
  for (const f of frames) {
    const key = `${f.sol}:${f.sequence}`
    bySequence.set(key, [...(bySequence.get(key) ?? []), f])
  }
  const candidates = [...bySequence.values()].map(dedupePointings)
  let chosen: Frame[] = []
  let coverageDeg = 0
  for (;;) {
    let best: { frames: Frame[]; coverage: number; index: number } | undefined
    candidates.forEach((group, index) => {
      const merged = dedupePointings([...chosen, ...group])
      const coverage = azimuthCoverageDeg(merged)
      const better =
        !best ||
        coverage > best.coverage ||
        (coverage === best.coverage && merged.length > best.frames.length)
      if (better) best = { frames: merged, coverage, index }
    })
    const minGain = chosen.length ? MIN_ADDED_COVERAGE_DEG : Number.MIN_VALUE
    if (!best || best.coverage - coverageDeg < minGain) break
    chosen = best.frames
    coverageDeg = best.coverage
    candidates.splice(best.index, 1)
  }
  return { frames: chosen, coverageDeg }
}
