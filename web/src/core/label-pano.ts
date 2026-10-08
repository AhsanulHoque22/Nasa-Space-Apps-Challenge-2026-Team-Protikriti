/**
 * AI4Mars labels on the Street View sphere: each labelled frame's class raster projected with the
 * same Navcam camera model the photos are stitched with, so labels sit on what they describe.
 */
import { CLASS_COLOURS, NONE } from './ai4mars'
import { RAD, type Source, camera, project } from './pinhole'

export type LabelSource = Omit<Source, 'pixels'> & { cls: Uint8Array }

const CLASS_RGB = CLASS_COLOURS.map((hex) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)),
)

/** Equirectangular class grid (outWidth x outWidth/2), NONE where no frame has a label. */
export function projectLabels(
  sources: readonly LabelSource[],
  outWidth: number,
): { cls: Uint8Array; width: number; height: number } {
  const width = outWidth
  const height = Math.round(outWidth / 2)
  const cls = new Uint8Array(width * height).fill(NONE)
  const cams = sources.map((s) => camera({ ...s, pixels: new Uint8ClampedArray(0) }))
  const p = new Float64Array(4)
  const sinAz = new Float64Array(width)
  const cosAz = new Float64Array(width)
  for (let x = 0; x < width; x++) {
    const az = ((x + 0.5) / width) * 2 * Math.PI
    sinAz[x] = Math.sin(az)
    cosAz[x] = Math.cos(az)
  }
  for (let y = 0; y < height; y++) {
    const elDeg = 90 - ((y + 0.5) / height) * 180
    const sinEl = Math.sin(elDeg * RAD)
    const cosEl = Math.cos(elDeg * RAD)
    // Only frames whose bounding cone spans this elevation can see the row (most cannot).
    const seen = cams.flatMap((c, i) => (Math.abs(elDeg - c.centreElDeg) <= c.radiusDeg ? [i] : []))
    if (seen.length === 0) continue
    for (let x = 0; x < width; x++) {
      let best: number = NONE
      let bestT2 = Infinity
      for (const i of seen) {
        const c = cams[i] as (typeof cams)[number]
        const s = sources[i] as LabelSource
        if (!project(c, sinAz[x] as number, cosAz[x] as number, sinEl, cosEl, p)) continue
        const t2 = p[3] as number
        if (t2 >= bestT2) continue
        const col = Math.min(s.width - 1, Math.floor((((p[0] as number) + 1) / 2) * s.width))
        const row = Math.min(s.height - 1, Math.floor(((1 - (p[1] as number)) / 2) * s.height))
        const v = s.cls[row * s.width + col] as number
        if (v === NONE) continue
        best = v
        bestT2 = t2
      }
      cls[y * width + x] = best
    }
  }
  return { cls, width, height }
}

type ClassGrid = { cls: Uint8Array; width: number; height: number }

/** RGBA for the renderer: each class in its colour, unlabelled pixels transparent. */
export function overlayPixels(grid: ClassGrid): Uint8ClampedArray {
  const out = new Uint8ClampedArray(grid.cls.length * 4)
  grid.cls.forEach((v, i) => {
    const rgb = CLASS_RGB[v]
    if (!rgb) return
    out.set([...rgb, 255], i * 4)
  })
  return out
}

/** The class in a viewing direction (compass azimuth, elevation), NONE if unlabelled. */
export function classAt(grid: ClassGrid, azDeg: number, elDeg: number): number {
  const az = ((azDeg % 360) + 360) % 360
  const x = Math.min(grid.width - 1, Math.floor((az / 360) * grid.width))
  const y = Math.min(grid.height - 1, Math.max(0, Math.floor(((90 - elDeg) / 180) * grid.height)))
  return grid.cls[y * grid.width + x] ?? NONE
}
