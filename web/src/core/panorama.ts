/** Street View's panorama at a stop: which frames to stitch and how much azimuth they cover. */
import { sunPosition } from './mars-time'
import { type Frame, frameGeometry } from './streetview'

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

/** Where the Sun stood when the frame was taken, or null without a usable time. */
export function sunAt(
  f: Frame,
  stop: StopPose,
): { elevationDeg: number; azimuthDeg: number } | null {
  if (!f.takenUtc) return null
  const utc = Date.parse(f.takenUtc.endsWith('Z') ? f.takenUtc : `${f.takenUtc}Z`)
  return Number.isNaN(utc) ? null : sunPosition(utc, stop.lon, stop.lat)
}

/**
 * Whether the frame was aimed at the Sun: Navcam's dust-opacity shots use exposures so short
 * that everything but the Sun is black, so they show nothing of the place.
 */
function showsSun(f: Frame, stop: StopPose): boolean {
  const sun = sunAt(f, stop)
  if (!sun || sun.elevationDeg < 0) return false
  const g = frameGeometry(f)
  const dAz =
    (((sun.azimuthDeg - (g.azDeg + (stop.yawDeg ?? 0)) + 540) % 360) - 180) *
    Math.cos((sun.elevationDeg * Math.PI) / 180)
  return Math.abs(dAz) < g.widthDeg / 2 && Math.abs(sun.elevationDeg - g.elDeg) < g.heightDeg / 2
}

// A borrowed frame must widen the view by at least this much to be worth downloading.
const MIN_GAIN_DEG = 1
const FULL_CIRCLE_DEG = 359.5

/** Frames taken at one stop, and which way the rover faced there (mast azimuths are rover-frame). */
export type PosedFrames = { frames: readonly Frame[]; yawDeg: number }

/**
 * Most stops have no full Navcam ring. Close the gaps with real frames from nearby stops (nearest
 * first), each turned into this stop's rover frame so the stitcher lines it up by compass
 * bearing: a neighbour's mast azimuth a is compass a + yaw_n, which is this stop's a + yaw_n - yaw.
 * Only frames that show azimuths not yet covered are added.
 */
export function fillGaps(
  here: PosedFrames,
  nearestFirst: readonly PosedFrames[],
): { frames: Frame[]; borrowedStops: number } {
  const frames = [...here.frames]
  let coverage = azimuthCoverageDeg(frames)
  let borrowedStops = 0
  for (const near of nearestFirst) {
    if (coverage >= FULL_CIRCLE_DEG) break
    let borrowed = false
    for (const f of near.frames) {
      const turned = { ...f, azDeg: f.azDeg + near.yawDeg - here.yawDeg }
      const widened = azimuthCoverageDeg([...frames, turned])
      if (widened < coverage + MIN_GAIN_DEG) continue
      frames.push(turned)
      coverage = widened
      borrowed = true
    }
    if (borrowed) borrowedStops++
  }
  return { frames, borrowedStops }
}

// Stitching cost scales with n²–n³; beyond this, duplicate directions add no quality.
const MAX_STITCH_FRAMES = 120

/**
 * Every frame NASA took at the stop, whatever sequence, sol or pointing: repeats and extra shots
 * still add detail, exposure information and sky. Only shots aimed at the Sun are left out.
 * When there are too many frames (e.g. Sol 886 with 290), deduplicate by 1° direction bins so
 * the stitcher doesn't spend minutes on redundant data.
 */
export function selectPanorama(
  frames: readonly Frame[],
  stop?: StopPose,
): { frames: Frame[]; coverageDeg: number } {
  let usable = stop ? frames.filter((f) => !showsSun(f, stop)) : [...frames]
  if (usable.length > MAX_STITCH_FRAMES) usable = deduplicateByDirection(usable)
  return { frames: usable, coverageDeg: azimuthCoverageDeg(usable) }
}

function deduplicateByDirection(frames: readonly Frame[]): Frame[] {
  const seen = new Set<string>()
  const out: Frame[] = []
  for (const f of frames) {
    const key = `${Math.round(f.azDeg)},${Math.round(f.elDeg)}`
    if (!seen.has(key)) { seen.add(key); out.push(f) }
  }
  return out
}
