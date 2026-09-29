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

/**
 * Every frame NASA took at the stop, whatever sequence, sol or pointing: repeats and extra shots
 * still add detail, exposure information and sky. Only shots aimed at the Sun are left out.
 */
export function selectPanorama(
  frames: readonly Frame[],
  stop?: StopPose,
): { frames: Frame[]; coverageDeg: number } {
  const usable = stop ? frames.filter((f) => !showsSun(f, stop)) : [...frames]
  return { frames: usable, coverageDeg: azimuthCoverageDeg(usable) }
}
