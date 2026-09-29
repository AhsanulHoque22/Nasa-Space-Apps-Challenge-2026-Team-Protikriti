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
  /**
   * Blend priority (default 1). A tiny weight makes a frame fill only where no full-weight frame
   * sees, e.g. the right Navcam, whose 42 cm offset would ghost nearby objects over the left's.
   */
  weight?: number
}

export type Panorama = { pixels: Uint8ClampedArray; width: number; height: number }

const RAD = Math.PI / 180
const SIGMA_N = 10 // grey-level noise in overlap means (Brown & Lowe)
const SIGMA_O = 50 // prior spread of the offsets around 0, in grey levels (NASA stretches shift tens)
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
 * Overlap statistics per ordered pair (i, j): sums over samples seen by both images, where a is
 * image i's luma and b image j's. Enough to fit a brightness-and-contrast match by least squares.
 */
type PairStats = {
  n: Float64Array
  a: Float64Array
  b: Float64Array
  aa: Float64Array
  ab: Float64Array
}

function addSample(
  st: PairStats,
  n: number,
  i: number,
  j: number,
  a: number,
  b: number,
  w: number,
) {
  const k = i * n + j
  st.n[k] = st.n[k]! + w
  st.a[k] = st.a[k]! + w * a
  st.b[k] = st.b[k]! + w * b
  st.aa[k] = st.aa[k]! + w * a * a
  st.ab[k] = st.ab[k]! + w * a * b
}

/**
 * Exposure matching after Brown & Lowe (IJCV 2007, §6), extended from one gain to a gain and an
 * offset per image: NASA stretches each browse tile's contrast separately, and a gain alone can
 * match the ground or the sky but not both. Overlaps are sampled on a sphere grid, plus the shared
 * pixel strip of tiles cut from one shot (too thin, ~0.6°, for the grid). Low-priority images
 * (the right Navcam) adapt to the others, never the reverse.
 */
function exposures(
  sources: readonly Source[],
  cams: readonly Camera[],
): { gain: number[]; offset: number[] } {
  const n = sources.length
  const st: PairStats = {
    n: new Float64Array(n * n),
    a: new Float64Array(n * n),
    b: new Float64Array(n * n),
    aa: new Float64Array(n * n),
    ab: new Float64Array(n * n),
  }
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
        for (const [j, lj] of hits) if (i !== j) addSample(st, n, i, j, li, lj, 1)
    }
  }
  addTileStrips(sources, cams, st)
  // Normal equations for unknowns [g0..gn-1, o0..on-1], residual g_i a + o_i - g_j b - o_j.
  const m = 2 * n
  const rows = Array.from({ length: m }, () => new Float64Array(m + 1))
  const priority = sources.map((src) => src.weight ?? 1)
  const s2 = SIGMA_N ** 2
  for (let i = 0; i < n; i++) {
    let overlap = 0
    const [gi, oi] = [rows[i]!, rows[n + i]!]
    for (let j = 0; j < n; j++) {
      const k = i * n + j
      const N = st.n[k]!
      if (!N || priority[j]! < priority[i]!) continue
      overlap += N
      const [A, B, AA, AB] = [st.a[k]!, st.b[k]!, st.aa[k]!, st.ab[k]!]
      gi[i] = gi[i]! + AA / s2
      gi[n + i] = gi[n + i]! + A / s2
      gi[j] = gi[j]! - AB / s2
      gi[n + j] = gi[n + j]! - A / s2
      oi[i] = oi[i]! + A / s2
      oi[n + i] = oi[n + i]! + N / s2
      oi[j] = oi[j]! - B / s2
      oi[n + j] = oi[n + j]! - N / s2
    }
    const weight = Math.max(1, overlap)
    gi[i] = gi[i]! + weight / SIGMA_G ** 2
    gi[m] = gi[m]! + weight / SIGMA_G ** 2 // gains prefer 1
    oi[n + i] = oi[n + i]! + weight / SIGMA_O ** 2 // offsets prefer 0
  }
  for (let col = 0; col < m; col++) {
    let pivot = col
    for (let r = col + 1; r < m; r++)
      if (Math.abs(rows[r]![col]!) > Math.abs(rows[pivot]![col]!)) pivot = r
    ;[rows[col], rows[pivot]] = [rows[pivot]!, rows[col]!]
    const row = rows[col]!
    for (let r = 0; r < m; r++) {
      if (r === col) continue
      const f = rows[r]![col]! / row[col]!
      for (let c = col; c <= m; c++) rows[r]![c]! -= f * row[c]!
    }
  }
  const solved = rows.map((row, i) => row[m]! / row[i]!)
  return { gain: solved.slice(0, n), offset: solved.slice(n) }
}

const STRIP_SAMPLES = 64 // along the strip; 4 across it
// A shared strip is the same pixels seen twice, so it outweighs any sphere-grid overlap.
const STRIP_WEIGHT = 10

/** Add the shared sensor strip of every pair of tiles from one shot to the overlap statistics. */
function addTileStrips(sources: readonly Source[], cams: readonly Camera[], st: PairStats): void {
  const n = sources.length
  const heaviest = Math.max(1, ...st.n)
  const vi = new Float32Array(3)
  const vj = new Float32Array(3)
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
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
          addSample(st, n, i, j, luma(vi), luma(vj), w)
          addSample(st, n, j, i, luma(vj), luma(vi), w)
        }
    }
}

export function stitch(sources: readonly Source[], outWidth: number): Panorama {
  const width = outWidth
  const height = outWidth / 2
  const cams = sources.map(camera)
  const { gain, offset } = exposures(sources, cams)
  const acc = new Float32Array(width * height * 4) // r, g, b, blend weight
  const seen = new Float32Array(width * height) // how well photos cover a pixel, ignoring priority
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
    const off = offset[i]!
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
        const cover = p[2]! / (1 + p[3]!)
        const w = cover * (s.weight ?? 1)
        acc[o] = acc[o]! + (v[0]! * g + off) * w
        acc[o + 1] = acc[o + 1]! + (v[1]! * g + off) * w
        acc[o + 2] = acc[o + 2]! + (v[2]! * g + off) * w
        acc[o + 3] = acc[o + 3]! + w
        seen[o / 4] = seen[o / 4]! + cover
      }
    }
  })
  return fillGaps(acc, seen, width, height)
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

const SKY_EDGE_DEG = 0.5 // the imaged sky colour is read from this band at the photos' top edge
const SKY_LOCAL_DEG = 8 // just above the photos, their edge colour blurred this much in azimuth
const SKY_RING_DEG = 30 // a few degrees up, the sky colour blurred this much in azimuth
const SKY_RING_RISE_DEG = 6 // climb over which the local edge colour gives way to the ring
const SKY_ZENITH_EL_DEG = 75 // elevation by which the sky is one even tone
// The notch where two shots' cut-off corners meet is bridged: the sky starts from the highest
// photo top within this many degrees, and notch columns don't lend it their darker colours.
const SKY_NOTCH_DEG = 4

/**
 * Paint the sky above the photos as a smooth dome: the photos' own sky colour at their top edge,
 * blurred more and more in azimuth as it rises, reaching one zenith tone by 75°. Extrapolating
 * pixels instead turns every dim corner or hazy patch at the edge into a cloud rising up the sky.
 * Returns false (leaving the sky to push-pull) when no photo reaches the horizon.
 */
function skyDome(l: Level, zenith: readonly number[]): boolean {
  const { width, height } = l
  const rowOf = (el: number) => Math.round(((90 - el) / 180) * height)
  const elOf = (y: number) => 90 - ((y + 0.5) / height) * 180
  const horizon = rowOf(0)
  const top = new Int32Array(width).fill(-1)
  for (let x = 0; x < width; x++) {
    let y = 0
    while (y < height && l.a[y * width + x]! < 0.5) y++
    if (y < height && y <= horizon) top[x] = y // else this column's photos never reach the sky
  }
  // Highest photo top nearby (smallest row), so notches between shots don't dip the sky.
  const reach = Math.max(1, Math.round((SKY_NOTCH_DEG / 360) * width))
  const skyRow = new Int32Array(width).fill(-1)
  for (let x = 0; x < width; x++)
    for (let d = -reach; d <= reach; d++) {
      const t = top[(((x + d) % width) + width) % width]!
      if (t >= 0 && (skyRow[x]! < 0 || t < skyRow[x]!)) skyRow[x] = t
    }
  const edge = new Float32Array(width * 4) // r, g, b, weight
  const band = Math.max(1, Math.round((SKY_EDGE_DEG / 180) * height))
  const notchRows = Math.max(1, Math.round((1 / 180) * height)) // more than 1° below: a notch
  for (let x = 0; x < width; x++) {
    const y = top[x]!
    if (y < 0 || y - skyRow[x]! > notchRows) continue
    for (let r = y; r < Math.min(height, y + band); r++) {
      const i = r * width + x
      for (let k = 0; k < 3; k++) edge[x * 4 + k]! += l.rgb[i * 3 + k]!
      edge[x * 4 + 3]! += 1
    }
  }
  if (!edge.some((v, i) => i % 4 === 3 && v > 0)) return false // no sky seen: leave it to push-pull
  const blur = (deg: number) => {
    let cur = edge
    const radius = Math.max(1, Math.round((deg / 360) * width))
    for (let pass = 0; pass < 3; pass++) {
      const next = new Float32Array(width * 4)
      for (let x = 0; x < width; x++)
        for (let d = -radius; d <= radius; d++) {
          const j = (((x + d) % width) + width) % width
          for (let k = 0; k < 4; k++) next[x * 4 + k]! += cur[j * 4 + k]!
        }
      cur = next
    }
    return (x: number, k: number) => cur[x * 4 + k]! / Math.max(1e-6, cur[x * 4 + 3]!)
  }
  const local = blur(SKY_LOCAL_DEG)
  const ring = blur(SKY_RING_DEG)
  const smooth = (t: number) => {
    const c = Math.min(1, Math.max(0, t))
    return c * c * (3 - 2 * c)
  }
  for (let x = 0; x < width; x++) {
    // Paint down to this column's own photo top (into a notch), but grade from the bridged top.
    const start = top[x]! >= 0 ? top[x]! : skyRow[x]! >= 0 ? skyRow[x]! : horizon
    const elStart = elOf(skyRow[x]! >= 0 ? skyRow[x]! : horizon)
    for (let y = 0; y < start; y++) {
      const i = y * width + x
      const a = l.a[i]!
      const el = elOf(y)
      const toRing = skyRow[x]! >= 0 ? smooth((el - elStart) / SKY_RING_RISE_DEG) : 1
      const toZenith = smooth((el - elStart) / Math.max(1, SKY_ZENITH_EL_DEG - elStart))
      for (let k = 0; k < 3; k++) {
        const near = local(x, k) + (ring(x, k) - local(x, k)) * toRing
        const sky = near + (zenith[k]! - near) * toZenith
        l.rgb[i * 3 + k] = l.rgb[i * 3 + k]! * a + sky * (1 - a)
      }
      l.a[i] = 1
    }
  }
  return true
}

/** Normalise the blend and fill everything no frame saw with push-pull interpolation. */
function fillGaps(acc: Float32Array, seen: Float32Array, width: number, height: number): Panorama {
  const base: Level = {
    rgb: new Float32Array(width * height * 3),
    a: new Float32Array(width * height),
    width,
    height,
  }
  for (let i = 0; i < width * height; i++) {
    const w = acc[i * 4 + 3]!
    if (w <= 0) continue
    base.a[i] = Math.min(1, seen[i]! / FULL_WEIGHT) // soft edge where the imagery runs out
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
  const zenith = tone(true, 0.9)
  const dome = skyDome(base, zenith)
  const poles: Array<[number, number[]]> = [
    ...(dome ? [] : [[0, zenith] as [number, number[]]]),
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
