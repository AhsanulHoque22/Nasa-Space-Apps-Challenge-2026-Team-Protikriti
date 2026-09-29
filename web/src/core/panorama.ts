/** Street View's panorama at a stop: which frames to stitch and how much azimuth they cover. */
import { sunPosition } from './mars-time'
import { type Frame, frameGeometry, isRightNavcam } from './streetview'

const mod = (x: number, m: number) => ((x % m) + m) % m

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

/** Where the stop is and which way the rover faced (mast azimuths are rover-relative). */
export type StopPose = { lon: number; lat: number; yawDeg: number | null }

/**
 * Whether the frame was aimed at the Sun: Navcam's dust-opacity shots use exposures so short
 * that everything but the Sun is black, so they show nothing of the place.
 */
function showsSun(f: Frame, stop: StopPose): boolean {
  if (!f.takenUtc) return false
  const utc = Date.parse(f.takenUtc.endsWith('Z') ? f.takenUtc : `${f.takenUtc}Z`)
  if (Number.isNaN(utc)) return false
  const sun = sunPosition(utc, stop.lon, stop.lat)
  if (sun.elevationDeg < 0) return false
  const g = frameGeometry(f)
  const dAz =
    (((sun.azimuthDeg - (g.azDeg + (stop.yawDeg ?? 0)) + 540) % 360) - 180) *
    Math.cos((sun.elevationDeg * Math.PI) / 180)
  return Math.abs(dAz) < g.widthDeg / 2 && Math.abs(sun.elevationDeg - g.elDeg) < g.heightDeg / 2
}

// Same eye, same sensor window and pointing within this: a re-shot of the same view.
const SAME_VIEW_DEG = 1
// A right-eye frame this close to a left-eye one is its stereo twin (42 cm apart, slight toe-in).
const TWIN_DEG = 2

const sameView = (a: Frame, b: Frame, withinDeg: number) =>
  a.subframe.join() === b.subframe.join() &&
  Math.abs(((a.azDeg - b.azDeg + 540) % 360) - 180) < withinDeg &&
  Math.abs(a.elDeg - b.elDeg) < withinDeg

/**
 * Every distinct view NASA took at the stop, across all sequences and sols. Repeats of one view
 * (monitoring shots, re-shoots) collapse to the latest, and a right-eye frame is dropped when its
 * left-eye twin is there: neither adds pixels, and busy stops have hundreds of them. Shots aimed
 * at the Sun are left out.
 */
export function selectPanorama(
  frames: readonly Frame[],
  stop?: StopPose,
): { frames: Frame[]; tiers: number[]; coverageDeg: number } {
  const usable = stop ? frames.filter((f) => !showsSun(f, stop)) : [...frames]
  // Left eye first, then newest first, so the kept copy of a view is the left eye's latest.
  const order = [...usable].sort(
    (a, b) =>
      Number(isRightNavcam(a.url)) - Number(isRightNavcam(b.url)) ||
      b.takenUtc.localeCompare(a.takenUtc),
  )
  const kept: Frame[] = []
  for (const f of order) {
    const right = isRightNavcam(f.url)
    const repeat = kept.some((k) => isRightNavcam(k.url) === right && sameView(k, f, SAME_VIEW_DEG))
    const twin = right && kept.some((k) => !isRightNavcam(k.url) && sameView(k, f, TWIN_DEG))
    if (!repeat && !twin) kept.push(f)
  }
  const chosen = usable.filter((f) => kept.includes(f))
  return { frames: chosen, tiers: sessionTiers(chosen), coverageDeg: azimuthCoverageDeg(chosen) }
}

/**
 * Rank photo sessions (one sequence on one sol shares light, shadows and pointing): the widest
 * sweep is tier 0, then each next session by the new azimuth it adds (ties: more frames). The
 * stitcher lets a lower tier show only where higher tiers don't see, instead of averaging
 * morning, noon and re-pointed shots of the same ground into ghosts and blotches.
 */
function sessionTiers(frames: readonly Frame[]): number[] {
  const sessions = new Map<string, Frame[]>()
  for (const f of frames) {
    const key = `${f.sol}:${f.sequence}`
    sessions.set(key, [...(sessions.get(key) ?? []), f])
  }
  const pending = [...sessions.entries()]
  const tierOf = new Map<string, number>()
  let covered: Frame[] = []
  while (pending.length) {
    const base = azimuthCoverageDeg(covered)
    const scored = pending.map(([key, group], index) => ({
      key,
      group,
      index,
      gain: azimuthCoverageDeg([...covered, ...group]) - base,
    }))
    const next = scored.reduce((a, b) =>
      b.gain > a.gain + 1e-9 ||
      (Math.abs(b.gain - a.gain) <= 1e-9 && b.group.length > a.group.length)
        ? b
        : a,
    )
    pending.splice(next.index, 1)
    tierOf.set(next.key, tierOf.size)
    covered = [...covered, ...next.group]
  }
  return frames.map((f) => tierOf.get(`${f.sol}:${f.sequence}`) ?? 0)
}
