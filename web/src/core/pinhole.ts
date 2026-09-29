/**
 * The Navcam camera model shared by registration and stitching: a pinhole camera pointed at
 * (azimuth, elevation), images as windows of its sensor, lens vignetting and image circle.
 */

/* eslint-disable @typescript-eslint/no-non-null-assertion --
   typed-array hot loops: every index is bounds-checked by the loop, and `?? 0` per sample would
   hide real bugs as black pixels */

export const RAD = Math.PI / 180
const CIRCLE_FADE_TAN2 = 0.1 // weight fades to zero over this last band inside the image circle
// Navcam brightness falls off as cos^n of the angle off the sensor axis: M20 browse frames drop to
// about half at the 48° sensor edge, so n ≈ ln 0.5 / ln cos 48° ≈ 1.7.
// ponytail: one fitted exponent, not the per-camera flat field; tune if seams show steps.
const VIGNETTE_EXP = 1.7

export type Source = {
  pixels: Uint8ClampedArray // RGBA
  width: number
  height: number
  azDeg: number // compass azimuth of the camera's optical axis
  elDeg: number
  widthDeg: number // full-sensor field of view
  heightDeg: number
  /**
   * The window of the sensor this image covers, in tangent units from the optical axis:
   * [centreX, centreY, halfWidth, halfHeight]; defaults to the full sensor. Rover frames are often
   * sensor tiles: an off-axis window of one pinhole camera, not a camera of their own.
   */
  sensorTan?: [number, number, number, number]
  /** Tiles of one camera shot share this id; their shared pixel strips are matched exactly. */
  exposure?: string
  /** tan² of the lens's image-circle radius: pixels farther off-axis are black, not data. */
  imageCircleTan2?: number
  /**
   * Blend priority (default 1). A tiny weight makes a frame fill only where no full-weight frame
   * sees, e.g. the right Navcam, whose 42 cm offset would ghost nearby objects over the left's.
   */
  weight?: number
  /** Photos taken together (one sequence on one sol) share this: same light and shadows. */
  session?: string
  /** Where the Sun stood when the photo was taken (degrees), to keep dusk out of daylight. */
  sunElDeg?: number
  sunAzDeg?: number
}

export type Camera = {
  f: [number, number, number]
  r: [number, number, number]
  u: [number, number, number]
  window: [number, number, number, number]
  imageCircleTan2: number
  // Bounding cone of the image on the sphere: centre direction and angular radius.
  centreAzDeg: number
  centreElDeg: number
  radiusDeg: number
}

export function camera(s: Source): Camera {
  const az = s.azDeg * RAD
  const el = s.elDeg * RAD
  const window = s.sensorTan ?? [
    0,
    0,
    Math.tan((s.widthDeg * RAD) / 2),
    Math.tan((s.heightDeg * RAD) / 2),
  ]
  const [cx, cy, hw, hh] = window
  const f: Camera['f'] = [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)]
  const r: Camera['r'] = [Math.cos(az), 0, -Math.sin(az)]
  const u: Camera['u'] = [-Math.sin(el) * Math.sin(az), Math.cos(el), -Math.sin(el) * Math.cos(az)]
  const direction = (tx: number, ty: number) => {
    const d = [0, 1, 2].map((k) => f[k]! + r[k]! * tx + u[k]! * ty)
    const n = Math.hypot(d[0]!, d[1]!, d[2]!)
    return d.map((v) => v / n)
  }
  const centre = direction(cx, cy)
  const corners = [-1, 1].flatMap((sx) =>
    [-1, 1].map((sy) => direction(cx + sx * hw, cy + sy * hh)),
  )
  const radius = Math.max(
    ...corners.map((d) =>
      Math.acos(Math.min(1, d[0]! * centre[0]! + d[1]! * centre[1]! + d[2]! * centre[2]!)),
    ),
  )
  return {
    f,
    r,
    u,
    window,
    imageCircleTan2: s.imageCircleTan2 ?? Infinity,
    centreAzDeg: Math.atan2(centre[0]!, centre[2]!) / RAD,
    centreElDeg: Math.asin(centre[1]!) / RAD,
    radiusDeg: radius / RAD + 0.5, // half a degree of slack for the pixel grid
  }
}

/**
 * Where the direction with the given azimuth/elevation sines and cosines lands in the image.
 * Writes [x, y] in -1..1, the edge-feather weight and tan² off the optical axis into `out`;
 * returns false outside the image. Allocation-free: it runs for every output pixel.
 */
export function project(
  c: Camera,
  sinAz: number,
  cosAz: number,
  sinEl: number,
  cosEl: number,
  out: Float64Array,
): boolean {
  const d0 = cosEl * sinAz
  const d2 = cosEl * cosAz
  const z = d0 * c.f[0] + sinEl * c.f[1] + d2 * c.f[2]
  if (z <= 0) return false
  const tx = (d0 * c.r[0] + d2 * c.r[2]) / z
  const ty = (d0 * c.u[0] + sinEl * c.u[1] + d2 * c.u[2]) / z
  const [cx, cy, hw, hh] = c.window
  const x = (tx - cx) / hw
  const y = (ty - cy) / hh
  if (x <= -1 || x >= 1 || y <= -1 || y >= 1) return false
  const t2 = tx * tx + ty * ty
  if (t2 >= c.imageCircleTan2) return false
  out[0] = x
  out[1] = y
  // Feathered at the tile edges and faded out towards the edge of the lens's image circle.
  out[2] =
    (1 - Math.abs(x)) * (1 - Math.abs(y)) * Math.min(1, (c.imageCircleTan2 - t2) / CIRCLE_FADE_TAN2)
  out[3] = t2
  return true
}

/** Bilinear sample at image position (x, y), corrected for vignetting at tan² off-axis `t2`. */
export function sample(s: Source, x: number, y: number, t2: number, out: Float32Array): void {
  const px = Math.min(s.width - 1.001, Math.max(0, ((x + 1) / 2) * s.width - 0.5))
  const py = Math.min(s.height - 1.001, Math.max(0, ((1 - y) / 2) * s.height - 0.5))
  const x0 = Math.floor(px)
  const y0 = Math.floor(py)
  const fx = px - x0
  const fy = py - y0
  const i00 = (y0 * s.width + x0) * 4
  const i01 = i00 + 4
  const i10 = i00 + s.width * 4
  const i11 = i10 + 4
  const p = s.pixels
  const devignette = (1 + t2) ** (VIGNETTE_EXP / 2)
  for (let k = 0; k < 3; k++) {
    const top = (p[i00 + k] ?? 0) * (1 - fx) + (p[i01 + k] ?? 0) * fx
    const bottom = (p[i10 + k] ?? 0) * (1 - fx) + (p[i11 + k] ?? 0) * fx
    out[k] = (top * (1 - fy) + bottom * fy) * devignette
  }
}

export const luma = (v: Float32Array) => (v[0]! + v[1]! + v[2]!) / 3
