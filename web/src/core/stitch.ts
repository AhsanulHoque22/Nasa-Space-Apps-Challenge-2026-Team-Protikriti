/**
 * Stitch Navcam frames into one equirectangular 360° panorama.
 *
 * Each frame is a pinhole camera pointed at (azimuth, elevation). Every output direction inside a
 * frame's footprint samples it bilinearly; overlapping frames are exposure-matched with
 * Brown & Lowe gain compensation (IJCV 2007, §6) and blended with weights that fall to zero at the
 * frame edges, so no seams show. Directions no frame saw are filled by push-pull pyramid
 * interpolation (Gortler et al., The Lumigraph, 1996), anchored to the scene's own sky tone at the
 * zenith and ground tone at the nadir, so the sphere is continuous with no holes or streaks.
 */

/* eslint-disable @typescript-eslint/no-non-null-assertion --
   typed-array hot loops: every index is bounds-checked by the loop, and `?? 0` per sample would
   hide real bugs as black pixels */

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
}

export type Panorama = { pixels: Uint8ClampedArray; width: number; height: number }

const RAD = Math.PI / 180
const SIGMA_N = 10 // grey-level noise in overlap means (Brown & Lowe)
const SIGMA_G = 0.3 // prior spread of the gains around 1 (Navcam auto-exposure varies a lot)
const CIRCLE_FADE_TAN2 = 0.1 // weight fades to zero over this last band inside the image circle
const GAIN_GRID_DEG = 1 // overlap statistics are sampled on this grid
// Blend weight at which a pixel counts as fully imaged; below it, imagery fades into the fill.
const FULL_WEIGHT = 0.02
// Navcam brightness falls off as cos^n of the angle off the sensor axis: M20 browse frames drop to
// about half at the 48° sensor edge, so n ≈ ln 0.5 / ln cos 48° ≈ 1.7.
// ponytail: one fitted exponent, not the per-camera flat field; tune if seams show steps.
const VIGNETTE_EXP = 1.7

type Camera = {
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

function camera(s: Source): Camera {
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
function project(
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
function sample(s: Source, x: number, y: number, t2: number, out: Float32Array): void {
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

const luma = (v: Float32Array) => (v[0]! + v[1]! + v[2]!) / 3

/**
 * Brown & Lowe gain compensation: one gain per image, minimising overlap brightness differences.
 * Overlaps are sampled on a sphere grid, plus the shared pixel strip of tiles cut from one shot:
 * NASA brightens each tile separately, and their overlap (~0.6°) is too thin for the grid.
 */
function gains(sources: readonly Source[], cams: readonly Camera[]): number[] {
  const n = sources.length
  const count = Array.from({ length: n }, () => new Float64Array(n))
  const sum = Array.from({ length: n }, () => new Float64Array(n)) // sum[i][j]: luma of i where j overlaps
  const v = new Float32Array(3)
  const p = new Float64Array(4)
  for (let el = -90 + GAIN_GRID_DEG / 2; el < 90; el += GAIN_GRID_DEG) {
    for (let az = 0; az < 360; az += GAIN_GRID_DEG / Math.max(0.05, Math.cos(el * RAD))) {
      const hits: Array<[number, number]> = []
      const [sa, ca, se, ce] = [
        Math.sin(az * RAD),
        Math.cos(az * RAD),
        Math.sin(el * RAD),
        Math.cos(el * RAD),
      ]
      cams.forEach((c, i) => {
        if (!project(c, sa, ca, se, ce, p)) return
        sample(sources[i]!, p[0]!, p[1]!, p[3]!, v)
        hits.push([i, luma(v)])
      })
      for (const [i, li] of hits)
        for (const [j] of hits) {
          if (i === j) continue
          count[i]![j]! += 1
          sum[i]![j]! += li
        }
    }
  }
  addTileStrips(sources, cams, count, sum)
  // Normal equations of the quadratic error, solved by Gaussian elimination (n is small).
  const a = Array.from({ length: n }, () => new Float64Array(n + 1))
  for (let i = 0; i < n; i++) {
    let overlap = 0
    for (let j = 0; j < n; j++) {
      const nij = count[i]![j]!
      if (!nij) continue
      overlap += nij
      const iij = sum[i]![j]! / nij
      const iji = sum[j]![i]! / nij
      a[i]![i]! += (nij * iij * iij) / SIGMA_N ** 2
      a[i]![j]! -= (nij * iij * iji) / SIGMA_N ** 2
    }
    const prior = Math.max(1, overlap) / SIGMA_G ** 2
    a[i]![i]! += prior
    a[i]![n]! += prior
  }
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let r = col + 1; r < n; r++)
      if (Math.abs(a[r]![col]!) > Math.abs(a[pivot]![col]!)) pivot = r
    ;[a[col], a[pivot]] = [a[pivot]!, a[col]!]
    const row = a[col]!
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const k = a[r]![col]! / row[col]!
      for (let c = col; c <= n; c++) a[r]![c]! -= k * row[c]!
    }
  }
  return a.map((row, i) => row[n]! / row[i]!)
}

const STRIP_SAMPLES = 64 // along the strip; 4 across it
// A shared strip is the same pixels seen twice, so it outweighs any sphere-grid overlap.
const STRIP_WEIGHT = 10

/** Add the shared sensor strip of every pair of tiles from one shot to the overlap statistics. */
function addTileStrips(
  sources: readonly Source[],
  cams: readonly Camera[],
  count: Float64Array[],
  sum: Float64Array[],
): void {
  const heaviest = Math.max(1, ...count.map((row) => Math.max(...row)))
  const vi = new Float32Array(3)
  const vj = new Float32Array(3)
  for (let i = 0; i < sources.length; i++)
    for (let j = i + 1; j < sources.length; j++) {
      if (!sources[i]!.exposure || sources[i]!.exposure !== sources[j]!.exposure) continue
      const [ax, ay, aw, ah] = cams[i]!.window
      const [bx, by, bw, bh] = cams[j]!.window
      const x0 = Math.max(ax - aw, bx - bw)
      const x1 = Math.min(ax + aw, bx + bw)
      const y0 = Math.max(ay - ah, by - bh)
      const y1 = Math.min(ay + ah, by + bh)
      if (x1 <= x0 || y1 <= y0) continue
      const tall = y1 - y0 > x1 - x0
      const [nx, ny] = tall ? [4, STRIP_SAMPLES] : [STRIP_SAMPLES, 4]
      const w = (STRIP_WEIGHT * heaviest) / (nx * ny)
      for (let u = 0; u < nx; u++)
        for (let k = 0; k < ny; k++) {
          const tx = x0 + ((u + 0.5) / nx) * (x1 - x0)
          const ty = y0 + ((k + 0.5) / ny) * (y1 - y0)
          const t2 = tx * tx + ty * ty
          if (t2 >= Math.min(cams[i]!.imageCircleTan2, cams[j]!.imageCircleTan2)) continue
          sample(sources[i]!, (tx - ax) / aw, (ty - ay) / ah, t2, vi)
          sample(sources[j]!, (tx - bx) / bw, (ty - by) / bh, t2, vj)
          count[i]![j]! += w
          count[j]![i]! += w
          sum[i]![j]! += w * luma(vi)
          sum[j]![i]! += w * luma(vj)
        }
    }
}

export function stitch(sources: readonly Source[], outWidth: number): Panorama {
  const width = outWidth
  const height = outWidth / 2
  const cams = sources.map(camera)
  const gain = gains(sources, cams)
  const acc = new Float32Array(width * height * 4) // r, g, b, weight
  const v = new Float32Array(3)
  const p = new Float64Array(4)
  const sinAz = new Float64Array(width)
  const cosAz = new Float64Array(width)
  for (let x = 0; x < width; x++) {
    const az = ((x + 0.5) / width) * 2 * Math.PI
    sinAz[x] = Math.sin(az)
    cosAz[x] = Math.cos(az)
  }
  cams.forEach((c, i) => {
    const s = sources[i]!
    const g = gain[i]!
    const elLo = Math.max(-90, c.centreElDeg - c.radiusDeg)
    const elHi = Math.min(90, c.centreElDeg + c.radiusDeg)
    const yLo = Math.max(0, Math.floor(((90 - elHi) / 180) * height))
    const yHi = Math.min(height - 1, Math.ceil(((90 - elLo) / 180) * height))
    for (let y = yLo; y <= yHi; y++) {
      const el = 90 - ((y + 0.5) / height) * 180
      const sinEl = Math.sin(el * RAD)
      const cosEl = Math.cos(el * RAD)
      // Azimuths within the frame's cone (angular radius R around the axis) on this row:
      // cos dAz >= (cos R - sin el sin el0) / (cos el cos el0).
      const el0 = c.centreElDeg * RAD
      const bound =
        (Math.cos(c.radiusDeg * RAD) - sinEl * Math.sin(el0)) /
        Math.max(1e-9, cosEl * Math.cos(el0))
      if (bound > 1) continue
      const spread = bound <= -1 ? 180 : Math.acos(bound) / RAD
      const xs = Math.floor(((c.centreAzDeg - spread) / 360) * width)
      const xe = Math.ceil(((c.centreAzDeg + spread) / 360) * width)
      for (let xx = xs; xx <= Math.min(xe, xs + width - 1); xx++) {
        const x = ((xx % width) + width) % width
        if (!project(c, sinAz[x]!, cosAz[x]!, sinEl, cosEl, p)) continue
        sample(s, p[0]!, p[1]!, p[3]!, v)
        const o = (y * width + x) * 4
        // Feathered at the tile edges and favouring the sharp, bright sensor centre.
        const w = p[2]! / (1 + p[3]!)
        acc[o] = acc[o]! + v[0]! * g * w
        acc[o + 1] = acc[o + 1]! + v[1]! * g * w
        acc[o + 2] = acc[o + 2]! + v[2]! * g * w
        acc[o + 3] = acc[o + 3]! + w
      }
    }
  })
  return fillGaps(acc, width, height)
}

type Level = { rgb: Float32Array; a: Float32Array; width: number; height: number }

/** Halve a level: weighted 2x2 means, wrapping in azimuth; confidence saturates at 1. */
function pull(l: Level): Level {
  const width = Math.max(1, l.width >> 1)
  const height = Math.max(1, l.height >> 1)
  const rgb = new Float32Array(width * height * 3)
  const a = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    const r0 = Math.min(l.height - 1, 2 * y) * l.width
    const r1 = Math.min(l.height - 1, 2 * y + 1) * l.width
    for (let x = 0; x < width; x++) {
      const c0 = (2 * x) % l.width
      const c1 = (2 * x + 1) % l.width
      const i = y * width + x
      let sum = 0
      let r = 0
      let g = 0
      let b = 0
      for (let q = 0; q < 4; q++) {
        const j = (q < 2 ? r0 : r1) + (q % 2 ? c1 : c0)
        const w = l.a[j]!
        if (w <= 0) continue
        sum += w
        r += l.rgb[j * 3]! * w
        g += l.rgb[j * 3 + 1]! * w
        b += l.rgb[j * 3 + 2]! * w
      }
      if (sum <= 0) continue
      a[i] = Math.min(1, sum)
      rgb[i * 3] = r / sum
      rgb[i * 3 + 1] = g / sum
      rgb[i * 3 + 2] = b / sum
    }
  }
  return { rgb, a, width, height }
}

/** Fill each pixel's missing confidence from the coarser level, bilinearly upsampled. */
function push(fine: Level, coarse: Level): void {
  const cw = coarse.width
  for (let y = 0; y < fine.height; y++) {
    const cy = Math.min(coarse.height - 1, Math.max(0, (y + 0.5) / 2 - 0.5))
    const y0 = Math.floor(cy)
    const fy = cy - y0
    const ra = y0 * cw
    const rb = Math.min(coarse.height - 1, y0 + 1) * cw
    for (let x = 0; x < fine.width; x++) {
      const i = y * fine.width + x
      const a = fine.a[i]!
      if (a >= 1) continue
      const cx = (x + 0.5) / 2 - 0.5
      const x0 = Math.floor(cx)
      const fx = cx - x0
      const xa = (x0 + cw) % cw
      const xb = (x0 + 1) % cw
      const w00 = (1 - fx) * (1 - fy)
      const w01 = fx * (1 - fy)
      const w10 = (1 - fx) * fy
      const w11 = fx * fy
      for (let k = 0; k < 3; k++) {
        const up =
          coarse.rgb[(ra + xa) * 3 + k]! * w00 +
          coarse.rgb[(ra + xb) * 3 + k]! * w01 +
          coarse.rgb[(rb + xa) * 3 + k]! * w10 +
          coarse.rgb[(rb + xb) * 3 + k]! * w11
        fine.rgb[i * 3 + k] = fine.rgb[i * 3 + k]! * a + up * (1 - a)
      }
      fine.a[i] = 1
    }
  }
}

/** Normalise the blend and fill everything no frame saw with push-pull interpolation. */
function fillGaps(acc: Float32Array, width: number, height: number): Panorama {
  const base: Level = {
    rgb: new Float32Array(width * height * 3),
    a: new Float32Array(width * height),
    width,
    height,
  }
  for (let i = 0; i < width * height; i++) {
    const w = acc[i * 4 + 3]!
    if (w <= 0) continue
    base.a[i] = Math.min(1, w / FULL_WEIGHT) // soft edge where the imagery runs out
    for (let k = 0; k < 3; k++) base.rgb[i * 3 + k] = acc[i * 4 + k]! / w
  }
  // Anchor the poles: the sky tone above, the ground tone below (column means of the imagery's
  // topmost and bottommost pixels, darkened slightly so the fill never outshines the photos).
  const tone = (fromTop: boolean, shade: number) => {
    const sum = [0, 0, 0, 0]
    for (let x = 0; x < width; x++)
      for (let n = 0; n < height; n++) {
        const i = (fromTop ? n : height - 1 - n) * width + x
        if (base.a[i]! <= 0) continue
        for (let k = 0; k < 3; k++) sum[k]! += base.rgb[i * 3 + k]!
        sum[3]! += 1
        break
      }
    return [0, 1, 2].map((k) => (sum[3] ? sum[k]! / sum[3] : 100) * shade)
  }
  const poles: Array<[number, number[]]> = [
    [0, tone(true, 0.9)],
    [height - 1, tone(false, 0.75)],
  ]
  for (const [y, rgb] of poles)
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      if (base.a[i]! > 0) continue
      base.a[i] = 1
      for (let k = 0; k < 3; k++) base.rgb[i * 3 + k] = rgb[k]!
    }
  const levels = [base]
  while (levels.at(-1)!.height > 1) levels.push(pull(levels.at(-1)!))
  for (let l = levels.length - 2; l >= 0; l--) push(levels[l]!, levels[l + 1]!)
  const pixels = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    pixels[i * 4] = base.rgb[i * 3]!
    pixels[i * 4 + 1] = base.rgb[i * 3 + 1]!
    pixels[i * 4 + 2] = base.rgb[i * 3 + 2]!
    pixels[i * 4 + 3] = 255
  }
  return { pixels, width, height }
}
