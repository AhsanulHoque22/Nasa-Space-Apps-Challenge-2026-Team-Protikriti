/**
 * Seam selection for photos taken at different times (Agarwala et al., Interactive Digital
 * Photomontage, 2004; Eden, Uyttendaele & Szeliski, CVPR 2006). Averaging overlapping photos from
 * different sols or times of day ghosts anything that moved (the rover's arm, shadows) and mixes
 * dusk light into daylight. Instead every part of the panorama is labelled with ONE photo:
 * a data cost prefers a reference session (the daylight session seeing the most), similar Sun
 * position, and lens centres; a seam cost puts the joins where neighbouring photos agree.
 * Labels are found on a coarse grid by iterated conditional modes. The blend then takes detail
 * from the labelled photo only and cross-fades tone across the joins (two-band blending,
 * Burt & Adelson 1983), so joins leave neither ghosts nor steps.
 */

/* eslint-disable @typescript-eslint/no-non-null-assertion --
   typed-array hot loops over bounds-checked indices */

import { type Camera, RAD, type Source, project, sample } from './pinhole'

export const GRID_W = 256 // label grid: ~1.4° cells
export const GRID_H = GRID_W / 2
const CELLS = GRID_W * GRID_H

export const MIN_COVER = 0.02 // a photo "sees" a cell when its centre-weight there is at least this
const DAYLIGHT_SUN_EL_DEG = 10 // below this the light is dusk or night: long shadows, dim
const SESSION_COST = 0.3 // not the reference session
const SUN_EL_COST_PER_10_DEG = 0.3
const SUN_AZ_COST_PER_60_DEG = 0.3
const DUSK_COST = 2
const LOW_PRIORITY_COST = 1 // e.g. the right Navcam (weight < 1): its offset ghosts near objects
const GREYSCALE_COST = 0.5 // prefer real colour; greyscale photos are coloured from neighbours
const COLOUR_BLUR_DEG = 6 // colour borrowed by greyscale photos is smoothed over about this
const CENTRE_COST = 0.5 // prefer the sharp, bright middle of the lens over its rim
const SEAM_COST = 1 // per unit (0..1) of disagreement between the two photos across a join
const NO_DATA_SEAM = 10 // a join where one photo can't see
const ICM_SWEEPS = 6
const TONE_BLUR_DEG = 4 // tone differences fade across joins over about this
// A photo's own tone (removed from its detail) is smoothed less: near a photo's edge a wide blur
// sees only one side, and that bias would show as a step along the join.
const OWN_TONE_BLUR_DEG = 2

/** A photo sampled once per grid cell: colour after exposure matching, and its lens weight. */
export type Coarse = { rgb: Float32Array; cover: Float32Array }

export function sampleCoarse(s: Source, c: Camera): Coarse {
  const rgb = new Float32Array(CELLS * 3)
  const cover = new Float32Array(CELLS)
  const p = new Float64Array(4)
  const v = new Float32Array(3)
  const elLo = Math.max(-90, c.centreElDeg - c.radiusDeg)
  const elHi = Math.min(90, c.centreElDeg + c.radiusDeg)
  const yLo = Math.max(0, Math.floor(((90 - elHi) / 180) * GRID_H))
  const yHi = Math.min(GRID_H - 1, Math.ceil(((90 - elLo) / 180) * GRID_H))
  for (let y = yLo; y <= yHi; y++) {
    const el = (90 - ((y + 0.5) / GRID_H) * 180) * RAD
    const [se, ce] = [Math.sin(el), Math.cos(el)]
    for (let x = 0; x < GRID_W; x++) {
      const az = ((x + 0.5) / GRID_W) * 2 * Math.PI
      if (!project(c, Math.sin(az), Math.cos(az), se, ce, p)) continue
      sample(s, p[0]!, p[1]!, p[3]!, v)
      const cell = y * GRID_W + x
      for (let k = 0; k < 3; k++) rgb[cell * 3 + k] = v[k]!
      cover[cell] = p[2]! / (1 + p[3]!)
    }
  }
  return { rgb, cover }
}

const angleDiff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180)

/**
 * Per-photo data penalty. The reference is the daylight session whose photos see the most;
 * photos from other sessions, with a different Sun, at dusk, or of low priority cost more.
 */
export function photoPenalties(
  sources: readonly Source[],
  coarse: readonly Coarse[],
  greyscale: readonly boolean[],
): number[] {
  const daylight = (s: Source) => (s.sunElDeg ?? 90) >= DAYLIGHT_SUN_EL_DEG
  const seeing = new Map<string, number>()
  sources.forEach((s, i) => {
    if (!daylight(s) || (s.weight ?? 1) < 1) return
    const key = s.session ?? ''
    seeing.set(key, (seeing.get(key) ?? 0) + coarse[i]!.cover.reduce((a, b) => a + b, 0))
  })
  const reference = [...seeing.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  const refPhotos = sources.filter(
    (s) => (s.session ?? '') === reference && s.sunElDeg !== undefined,
  )
  const refSun = refPhotos[Math.floor(refPhotos.length / 2)]
  return sources.map((s, i) => {
    let cost = (s.session ?? '') === reference ? 0 : SESSION_COST
    if (greyscale[i]) cost += GREYSCALE_COST
    if (!daylight(s)) cost += DUSK_COST
    if ((s.weight ?? 1) < 1) cost += LOW_PRIORITY_COST
    if (refSun && s.sunElDeg !== undefined && s.sunAzDeg !== undefined) {
      cost += (SUN_EL_COST_PER_10_DEG * Math.abs(s.sunElDeg - (refSun.sunElDeg ?? 0))) / 10
      cost += (SUN_AZ_COST_PER_60_DEG * angleDiff(s.sunAzDeg, refSun.sunAzDeg ?? 0)) / 60
    }
    return cost
  })
}

/** One photo per grid cell (-1 where none sees), minimising data + seam costs by ICM. */
export function chooseLabels(coarse: readonly Coarse[], penalty: readonly number[]): Int32Array {
  const n = coarse.length
  const candidates: number[][] = Array.from({ length: CELLS }, () => [])
  const maxCover = new Float32Array(CELLS)
  for (let i = 0; i < n; i++)
    for (let c = 0; c < CELLS; c++) {
      const w = coarse[i]!.cover[c]!
      if (w < MIN_COVER) continue
      candidates[c]!.push(i)
      if (w > maxCover[c]!) maxCover[c] = w
    }
  const data = (i: number, c: number) =>
    penalty[i]! + CENTRE_COST * (1 - coarse[i]!.cover[c]! / maxCover[c]!)
  const disagree = (a: number, b: number, c: number) => {
    if (coarse[a]!.cover[c]! < MIN_COVER || coarse[b]!.cover[c]! < MIN_COVER) return NO_DATA_SEAM
    const ra = coarse[a]!.rgb
    const rb = coarse[b]!.rgb
    let d = 0
    for (let k = 0; k < 3; k++) d += Math.abs(ra[c * 3 + k]! - rb[c * 3 + k]!)
    return d / (3 * 255)
  }
  const seam = (a: number, ca: number, b: number, cb: number) =>
    a === b || a < 0 || b < 0 ? 0 : SEAM_COST * (disagree(a, b, ca) + disagree(a, b, cb))
  const labels = new Int32Array(CELLS).fill(-1)
  for (let c = 0; c < CELLS; c++) {
    let best = Infinity
    for (const i of candidates[c]!) {
      const d = data(i, c)
      if (d < best) [best, labels[c]] = [d, i]
    }
  }
  const neighbours = (c: number) => {
    const x = c % GRID_W
    const y = (c - x) / GRID_W
    const out = [y * GRID_W + ((x + 1) % GRID_W), y * GRID_W + ((x + GRID_W - 1) % GRID_W)]
    if (y > 0) out.push(c - GRID_W)
    if (y < GRID_H - 1) out.push(c + GRID_W)
    return out
  }
  for (let sweep = 0; sweep < ICM_SWEEPS; sweep++) {
    let changed = false
    for (let c = 0; c < CELLS; c++) {
      const options = candidates[c]!
      if (options.length < 2) continue
      const around = neighbours(c)
      let best = Infinity
      let pick = labels[c]!
      for (const i of options) {
        let e = data(i, c)
        for (const d of around) e += seam(i, c, labels[d]!, d)
        if (e < best) [best, pick] = [e, i]
      }
      if (pick !== labels[c]) {
        labels[c] = pick
        changed = true
      }
    }
    if (!changed) break
  }
  return labels
}

/**
 * Box-blur a 4-channel grid (values pre-multiplied by channel 3), wrapping in azimuth. Only rows
 * yLo..yHi are computed (the rest stay empty): a photo covers a band of the sphere, not all of it.
 */
function blurGrid(src: Float32Array, radius: number, yLo = 0, yHi = GRID_H - 1): Float32Array {
  let cur = src
  const lo = Math.max(0, yLo - 3 * radius)
  const hi = Math.min(GRID_H - 1, yHi + 3 * radius)
  for (let pass = 0; pass < 3; pass++) {
    const horiz = new Float32Array(cur.length)
    for (let y = lo; y <= hi; y++)
      for (let x = 0; x < GRID_W; x++) {
        const o = (y * GRID_W + x) * 4
        for (let d = -radius; d <= radius; d++) {
          const j = (y * GRID_W + ((((x + d) % GRID_W) + GRID_W) % GRID_W)) * 4
          for (let k = 0; k < 4; k++) horiz[o + k] = horiz[o + k]! + cur[j + k]!
        }
      }
    const vert = new Float32Array(cur.length)
    for (let y = lo; y <= hi; y++)
      for (let d = -radius; d <= radius; d++) {
        const yy = Math.min(GRID_H - 1, Math.max(0, y + d))
        for (let x = 0; x < GRID_W; x++) {
          const o = (y * GRID_W + x) * 4
          const j = (yy * GRID_W + x) * 4
          for (let k = 0; k < 4; k++) vert[o + k] = vert[o + k]! + horiz[j + k]!
        }
      }
    cur = vert
  }
  return cur
}

/** Bilinear read of a pre-multiplied grid at (u, v) in 0..1; false where it has no data. */
export function readGrid(grid: Float32Array, u: number, v: number, out: Float32Array): boolean {
  const fx = u * GRID_W - 0.5
  const fy = Math.min(GRID_H - 1.001, Math.max(0, v * GRID_H - 0.5))
  const x0 = Math.floor(fx)
  const y0 = Math.floor(fy)
  const tx = fx - x0
  const ty = fy - y0
  const xa = ((x0 % GRID_W) + GRID_W) % GRID_W
  const xb = (xa + 1) % GRID_W
  const a = (y0 * GRID_W + xa) * 4
  const b = (y0 * GRID_W + xb) * 4
  const c = ((y0 + 1) * GRID_W + xa) * 4
  const d = ((y0 + 1) * GRID_W + xb) * 4
  const fa = (1 - tx) * (1 - ty)
  const fb = tx * (1 - ty)
  const fc = (1 - tx) * ty
  const fd = tx * ty
  const w = grid[a + 3]! * fa + grid[b + 3]! * fb + grid[c + 3]! * fc + grid[d + 3]! * fd
  if (w <= 1e-9) return false
  for (let k = 0; k < 3; k++)
    out[k] = (grid[a + k]! * fa + grid[b + k]! * fb + grid[c + k]! * fc + grid[d + k]! * fd) / w
  return true
}

/** A photo's own low-frequency tone (blurred 2°) over the cells it covers. */
export function ownTone({ rgb, cover }: Coarse): Float32Array {
  const grid = new Float32Array(CELLS * 4)
  let yLo = GRID_H
  let yHi = -1
  for (let c = 0; c < CELLS; c++) {
    const w = cover[c]!
    if (w < MIN_COVER) continue
    for (let k = 0; k < 3; k++) grid[c * 4 + k] = rgb[c * 3 + k]! * w
    grid[c * 4 + 3] = w
    const y = Math.floor(c / GRID_W)
    yLo = Math.min(yLo, y)
    yHi = Math.max(yHi, y)
  }
  const radius = Math.max(1, Math.round((OWN_TONE_BLUR_DEG / 360) * GRID_W))
  return blurGrid(grid, radius, yLo, yHi)
}

/**
 * The tone band: each labelled photo's own smoothed tone (`own`, for removing it from its detail)
 * and the target tone: in every cell the labelled photo's own tone, blurred across the joins.
 */
export function toneBands(
  coarse: readonly Coarse[],
  labels: Int32Array,
): { own: Map<number, Float32Array>; target: Float32Array } {
  const radius = Math.max(1, Math.round((TONE_BLUR_DEG / 360) * GRID_W))
  const used = [...new Set(labels)].filter((i) => i >= 0)
  const own = new Map(used.map((i) => [i, ownTone(coarse[i]!)]))
  const winners = new Float32Array(CELLS * 4)
  for (let c = 0; c < CELLS; c++) {
    const tone = labels[c]! >= 0 ? own.get(labels[c]!) : undefined
    const w = tone?.[c * 4 + 3] ?? 0
    if (!tone || w <= 1e-9) continue
    for (let k = 0; k < 3; k++) winners[c * 4 + k] = tone[c * 4 + k]! / w
    winners[c * 4 + 3] = 1
  }
  return { own, target: blurGrid(winners, radius) }
}

/** Whether a photo is greyscale (R = G = B): half of Perseverance's Navcam products are. */
export function isGreyscale(s: Source): boolean {
  const step = Math.max(1, Math.floor((s.width * s.height) / 2000)) * 4
  for (let o = 0; o < s.pixels.length; o += step) {
    const [r, g, b] = [s.pixels[o]!, s.pixels[o + 1]!, s.pixels[o + 2]!]
    if (Math.max(r, g, b) - Math.min(r, g, b) > 2) return false
  }
  return true
}

/**
 * The scene's colour, as each channel's ratio to brightness, from the colour photos: smoothed
 * around the sphere, then per elevation band and overall where no colour photo is near. Greyscale
 * photos take their brightness and detail from themselves and their colour from this.
 */
export function colourField(
  coarse: readonly Coarse[],
  greyscale: readonly boolean[],
): Float32Array {
  const grid = new Float32Array(CELLS * 4)
  coarse.forEach(({ rgb, cover }, i) => {
    if (greyscale[i]) return
    for (let c = 0; c < CELLS; c++) {
      const w = cover[c]!
      if (w < MIN_COVER) continue
      const l = (rgb[c * 3]! + rgb[c * 3 + 1]! + rgb[c * 3 + 2]!) / 3 + 1
      for (let k = 0; k < 3; k++)
        grid[c * 4 + k] = grid[c * 4 + k]! + ((rgb[c * 3 + k]! + 1) / l) * w
      grid[c * 4 + 3] = grid[c * 4 + 3]! + w
    }
  })
  const field = blurGrid(grid, Math.max(1, Math.round((COLOUR_BLUR_DEG / 360) * GRID_W)))
  // Cells no colour photo is near: the average colour of their elevation band, else overall.
  const all = [0, 0, 0, 0]
  const rows = Array.from({ length: GRID_H }, () => [0, 0, 0, 0])
  for (let c = 0; c < CELLS; c++)
    for (let k = 0; k < 4; k++) {
      rows[Math.floor(c / GRID_W)]![k]! += field[c * 4 + k]!
      all[k]! += field[c * 4 + k]!
    }
  for (let c = 0; c < CELLS; c++) {
    if (field[c * 4 + 3]! > 1e-9) continue
    const row = rows[Math.floor(c / GRID_W)]!
    const from = row[3]! > 1e-9 ? row : all
    const w = from[3]! > 1e-9 ? from[3]! : 1
    for (let k = 0; k < 3; k++) field[c * 4 + k] = from[3]! > 1e-9 ? from[k]! / w : 1
    field[c * 4 + 3] = 1
  }
  return field
}

/** Colour a greyscale photo's coarse samples in place from the scene's colour field. */
export function colourise({ rgb, cover }: Coarse, field: Float32Array): void {
  for (let c = 0; c < CELLS; c++) {
    if (cover[c]! < MIN_COVER) continue
    const w = field[c * 4 + 3]!
    for (let k = 0; k < 3; k++) rgb[c * 3 + k] = (rgb[c * 3 + k]! + 1) * (field[c * 4 + k]! / w) - 1
  }
}
