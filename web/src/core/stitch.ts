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

import { type Camera, RAD, type Source, camera, luma, project, sample } from './pinhole'
import {
  type Coarse,
  GRID_H,
  GRID_W,
  MIN_COVER,
  chooseLabels,
  colourField,
  colourise,
  isGreyscale,
  photoPenalties,
  readGrid,
  sampleCoarse,
  ownTone,
  toneBands,
} from './seams'

export type { Source } from './pinhole'

/* eslint-disable @typescript-eslint/no-non-null-assertion --
   typed-array hot loops: every index is bounds-checked by the loop, and `?? 0` per sample would
   hide real bugs as black pixels */

export type Panorama = { pixels: Uint8ClampedArray; width: number; height: number }

/** Cached result of the expensive preprocessing so preview and full render share it. */
export type StitchPrep = {
  cams: Camera[]
  coarse: Coarse[]
  gain: number[]
  offset: number[]
  greyscale: boolean[]
  colour: Float32Array
  labels: Int32Array
  own: Map<number, Float32Array>
  target: Float32Array
  fallback: number[][]
  penalty: number[]
}

const SIGMA_N = 10 // grey-level noise in overlap means (Brown & Lowe)
const SIGMA_O = 50 // prior spread of the offsets around 0, in grey levels (NASA stretches shift tens)
const SIGMA_G = 0.3 // prior spread of the gains around 1 (Navcam auto-exposure varies a lot)
// Overlap samples whose brightness ratio differs from the pair's median by more than this
// (log units, ~±40%) show a change in the scene, not in exposure, and are left out of the fit.
const OUTLIER_LOG_RATIO = 0.35
const PAIR_PHOTOS_PER_CELL = 8
const JOIN_SHARPNESS = 4 // bilinear label weights to this power: joins blend over ~0.3 of a cell
// Blend weight at which a pixel counts as fully imaged; below it, imagery fades into the fill.
const FULL_WEIGHT = 0.02

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
  coarse: readonly Coarse[],
): { gain: number[]; offset: number[] } {
  const n = sources.length
  const st: PairStats = {
    n: new Float64Array(n * n),
    a: new Float64Array(n * n),
    b: new Float64Array(n * n),
    aa: new Float64Array(n * n),
    ab: new Float64Array(n * n),
  }
  const pairSamples = new Map<number, number[]>() // i < j: [luma i, luma j, ...]
  // Overlaps come from the coarse grid every photo is sampled on anyway (~1.4° cells).
  const cells = GRID_W * GRID_H
  const hits: Array<[number, number]> = []
  for (let cell = 0; cell < cells; cell++) {
    hits.length = 0
    for (let i = 0; i < n; i++) {
      if (coarse[i]!.cover[cell]! < MIN_COVER) continue
      const rgb = coarse[i]!.rgb
      hits.push([i, (rgb[cell * 3]! + rgb[cell * 3 + 1]! + rgb[cell * 3 + 2]!) / 3])
    }
    if (hits.length < 2) continue
    // Pair only the photos seeing this cell best: plenty of samples per pair, far fewer pairs.
    if (hits.length > PAIR_PHOTOS_PER_CELL)
      hits
        .sort((a, b) => coarse[b[0]]!.cover[cell]! - coarse[a[0]]!.cover[cell]!)
        .splice(PAIR_PHOTOS_PER_CELL)
    {
      for (const [i, li] of hits)
        for (const [j, lj] of hits) {
          if (i >= j) continue
          const key = i * n + j
          const list = pairSamples.get(key) ?? []
          list.push(li, lj)
          pairSamples.set(key, list)
        }
    }
  }
  // Robust: drop samples where the pair disagrees far more than its typical brightness ratio,
  // i.e. something moved or a shadow changed between the shots, not the exposure.
  for (const [key, list] of pairSamples) {
    const [i, j] = [Math.floor(key / n), key % n]
    const ratios: number[] = []
    for (let k = 0; k < list.length; k += 2)
      ratios.push(Math.log((list[k]! + 1) / (list[k + 1]! + 1)))
    const typical = [...ratios].sort((x, y) => x - y)[ratios.length >> 1]!
    for (let k = 0; k < list.length; k += 2) {
      if (Math.abs(ratios[k / 2]! - typical) > OUTLIER_LOG_RATIO) continue
      addSample(st, n, i, j, list[k]!, list[k + 1]!, 1)
      addSample(st, n, j, i, list[k + 1]!, list[k]!, 1)
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

/** Run the expensive preprocessing once; share the result between preview and full render. */
export function prepare(sources: readonly Source[]): StitchPrep {
  const cams = sources.map(camera)
  // Sample every photo once on the coarse grid, match exposures there, then apply them.
  const coarse = sources.map((s, i) => sampleCoarse(s, cams[i]!))
  const { gain, offset } = exposures(sources, cams, coarse)
  coarse.forEach(({ rgb }, i) => {
    for (let k = 0; k < rgb.length; k++) rgb[k] = rgb[k]! * gain[i]! + offset[i]!
  })
  // Greyscale photos borrow colour from the colour photos around them.
  const greyscale = sources.map(isGreyscale)
  const colour = colourField(coarse, greyscale)
  coarse.forEach((c, i) => greyscale[i] && colourise(c, colour))
  // One photo per part of the sphere (seam selection), then its detail on cross-faded tone.
  const penalty = photoPenalties(sources, coarse, greyscale)
  const labels = chooseLabels(coarse, penalty)
  const { own, target } = toneBands(coarse, labels)
  // Fallback photos per cell, best first: for pixels the labelled photos just miss.
  // A photo is a candidate in its cells and their neighbours: its real edge runs through cells
  // whose centres it misses, and the per-pixel projection decides coverage exactly.
  const fallback: number[][] = Array.from({ length: GRID_W * GRID_H }, () => [])
  coarse.forEach(({ cover }, i) => {
    const near = new Set<number>()
    for (let c = 0; c < cover.length; c++) {
      if (cover[c]! < MIN_COVER) continue
      const cx = c % GRID_W
      const cy = (c - cx) / GRID_W
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const yy = cy + dy
          if (yy >= 0 && yy < GRID_H) near.add(yy * GRID_W + ((cx + dx + GRID_W) % GRID_W))
        }
    }
    for (const c of near) fallback[c]!.push(i)
  })
  for (const list of fallback) list.sort((a, b) => penalty[a]! - penalty[b]!)
  return { cams, coarse, gain, offset, greyscale, colour, labels, own, target, fallback, penalty }
}

/** Render a panorama at the given width using already-computed preprocessing. */
export function renderPrep(
  prep: StitchPrep,
  sources: readonly Source[],
  outWidth: number,
): Panorama {
  const { cams, coarse, gain, offset, greyscale, colour, labels, own, target, fallback } = prep
  const width = outWidth
  const height = outWidth / 2
  // Fallback photos need their own tone too, or their raw exposure shows as a bright patch.
  const toneOf = (i: number) => {
    let t = own.get(i)
    if (!t) own.set(i, (t = ownTone(coarse[i]!)))
    return t
  }
  const acc = new Float32Array(width * height * 4) // r, g, b, 1 once painted
  const seen = new Float32Array(width * height) // lens weight of the photo used, for the gap fill
  const v = new Float32Array(3)
  const p = new Float64Array(4)
  const tone = new Float32Array(3)
  const ratio = new Float32Array(3)
  const sinAz = new Float64Array(width)
  const cosAz = new Float64Array(width)
  for (let x = 0; x < width; x++) {
    const az = ((x + 0.5) / width) * 2 * Math.PI
    sinAz[x] = Math.sin(az)
    cosAz[x] = Math.cos(az)
  }
  /** Photo i's exposure-matched (and, if greyscale, coloured) value at this pixel into `v`. */
  const valueAt = (i: number, x: number, sinEl: number, cosEl: number, u: number, w01: number) => {
    if (!project(cams[i]!, sinAz[x]!, cosAz[x]!, sinEl, cosEl, p)) return false
    sample(sources[i]!, p[0]!, p[1]!, p[3]!, v)
    for (let k = 0; k < 3; k++) v[k] = v[k]! * gain[i]! + offset[i]! // exposure, then colour
    if (greyscale[i] && readGrid(colour, u, w01, ratio))
      for (let k = 0; k < 3; k++) v[k] = (v[k]! + 1) * ratio[k]! - 1
    return true
  }
  const ids = [0, 0, 0, 0]
  const weights = [0, 0, 0, 0]
  const sum = [0, 0, 0]
  for (let y = 0; y < height; y++) {
    const w01 = (y + 0.5) / height
    const el = (90 - w01 * 180) * RAD
    const [sinEl, cosEl] = [Math.sin(el), Math.cos(el)]
    const fy = Math.min(GRID_H - 1.001, Math.max(0, w01 * GRID_H - 0.5))
    const y0 = Math.floor(fy)
    const ty = fy - y0
    for (let x = 0; x < width; x++) {
      const u = (x + 0.5) / width
      const fx = u * GRID_W - 0.5
      const x0 = Math.floor(fx)
      const tx = fx - x0
      const xa = (x0 + GRID_W) % GRID_W
      const xb = (xa + 1) % GRID_W
      // Smooth joins: each nearby cell's photo counts by bilinear weight, sharpened so the
      // hand-over is a narrow blend along a curve instead of a staircase of cell edges.
      let n = 0
      const corners: Array<[number, number]> = [
        [y0 * GRID_W + xa, (1 - tx) * (1 - ty)],
        [y0 * GRID_W + xb, tx * (1 - ty)],
        [(y0 + 1) * GRID_W + xa, (1 - tx) * ty],
        [(y0 + 1) * GRID_W + xb, tx * ty],
      ]
      for (const [cell, w] of corners) {
        const id = labels[cell]!
        if (id < 0 || w <= 0) continue
        const k = ids.indexOf(id)
        if (k >= 0 && k < n) weights[k] = weights[k]! + w
        else [ids[n], weights[n++]] = [id, w]
      }
      const o = (y * width + x) * 4
      let total = 0
      let cover = 0
      sum.fill(0)
      for (let k = 0; k < n; k++) {
        const i = ids[k]!
        const w = weights[k]! ** JOIN_SHARPNESS
        if (w < 1e-4 || !valueAt(i, x, sinEl, cosEl, u, w01)) continue
        // Detail: the photo minus its own tone; the cross-faded tone is added below.
        // (Where its own tone can't be read, subtract the target tone: the two cancel below.)
        const has = readGrid(own.get(i) ?? target, u, w01, tone) || readGrid(target, u, w01, tone)
        for (let c = 0; c < 3; c++) sum[c] = sum[c]! + (v[c]! - (has ? tone[c]! : 0)) * w
        total += w
        cover += (p[2]! / (1 + p[3]!)) * w
      }
      if (total === 0) {
        // Cell edges the labelled photos just miss: the best-ranked photo that sees the pixel.
        // Candidates from all four surrounding cells: the pixel may sit in any of them.
        const tried = new Set<number>()
        search: for (const [cell] of corners)
          for (const i of fallback[cell] ?? []) {
            if (tried.has(i)) continue
            tried.add(i)
            if (!valueAt(i, x, sinEl, cosEl, u, w01)) continue
            const has = readGrid(toneOf(i), u, w01, tone) || readGrid(target, u, w01, tone)
            for (let c = 0; c < 3; c++) sum[c] = v[c]! - (has ? tone[c]! : 0)
            total = 1
            cover = p[2]! / (1 + p[3]!)
            break search
          }
      }
      if (total === 0) continue
      const hasTarget = readGrid(target, u, w01, tone)
      for (let c = 0; c < 3; c++) acc[o + c] = sum[c]! / total + (hasTarget ? tone[c]! : 0)
      acc[o + 3] = 1
      seen[o / 4] = cover / total
    }
  }
  return fillGaps(acc, seen, width, height)
}

export function stitch(sources: readonly Source[], outWidth: number): Panorama {
  return renderPrep(prepare(sources), sources, outWidth)
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
