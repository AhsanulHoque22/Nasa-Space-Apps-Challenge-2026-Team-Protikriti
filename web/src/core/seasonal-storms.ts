/**
 * Dust storms that come with the season, for dates this app has no rover sky record for. Pure and
 * deterministic: each Mars year's storms come from a seeded draw, so a clock moved forward always
 * meets the same storms. They are statistics, never a forecast, and every name says "simulated".
 *
 * Sources:
 * - Kass et al. 2016, GRL 43, 6111: three large regional storms recur in fixed seasonal windows
 *   nearly every Mars year: "A" near Ls 210-240, "B" over the south pole near Ls 250-270 (it barely
 *   reaches the tropics, so it is left out here), "C" near Ls 305-330.
 * - Zurek & Martin 1993, JGR 98, 3247: planet-encircling storms in about one Mars year in three.
 *   Recent ones began at Ls 185 (2001), 262 (2007) and 186 (2018).
 * - Peak opacity: 8.5 at Gale in 2018 (Guzewich et al. 2019); ~5.5 at Opportunity in 2007
 *   (Lemmon et al. 2015, Icarus 251); ~2 at Jezero in the January 2022 regional storm.
 */
import { tauOnDay, BEFORE_STORM_TAU, STORM_PEAK_TAU } from './dust-storm'
import { marsSolDate, solarLongitudeDeg } from './mars-time'

/**
 * The first date simulated: the start of Mars Year 38 (12 Nov 2024). Earlier dates use only the
 * documented events in surface-conditions.ts, so the app never paints a storm onto history.
 */
export const SIMULATED_FROM_UTC = Date.parse('2024-11-12T00:00:00Z')

/** Mars Year 34 began at Ls 0 on 5 May 2017 (Piqueux et al. 2015, Icarus 251, calendar). */
const MY34_START_MSD = marsSolDate(Date.parse('2017-05-05T12:00:00Z'))
const SOLS_PER_MARS_YEAR = 668.5921
/**
 * Ls advances about 0.6 deg per sol through the dusty season (0.66 at perihelion, Ls 251).
 * ponytail: one rate for converting storm rise/decay sols to Ls; exact per-sol Ls if it matters.
 */
const LS_PER_SOL_DUSTY = 0.6

export type StormKind = 'regional-A' | 'regional-C' | 'global'
export type SimStorm = {
  kind: StormKind
  name: string
  startLs: number
  /** Opacity added on top of the seasonal mean at the peak. */
  peakExtraTau: number
}

/** Mars Year (Clancy et al. 2000 numbering) at a moment. */
export function marsYear(utcMs: number): number {
  const sinceMy34 = (marsSolDate(utcMs) - MY34_START_MSD) / SOLS_PER_MARS_YEAR
  let my = 34 + Math.floor(sinceMy34)
  // Near the boundary the sol count and Ls can disagree by a sol: trust Ls.
  const ls = solarLongitudeDeg(utcMs)
  const frac = sinceMy34 - Math.floor(sinceMy34)
  if (frac > 0.9 && ls < 30) my += 1
  else if (frac < 0.1 && ls > 330) my -= 1
  return my
}

/** Small seeded generator (mulberry32): the same year always draws the same storms. */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Peak extra opacity at the rover sites for the regional storms. Team assumption bracketed by the
// Jezero January 2022 storm (~2 total over a ~0.6 background) and smaller C-season events.
const A_EXTRA: readonly [number, number] = [0.8, 1.6]
const C_EXTRA: readonly [number, number] = [0.5, 1.2]
const GLOBAL_CHANCE = 1 / 3
const GLOBAL_PEAK_TAU: readonly [number, number] = [5.5, STORM_PEAK_TAU]

export function stormsOfYear(my: number): SimStorm[] {
  const r = rng(my * 7919 + 17)
  const between = ([lo, hi]: readonly [number, number]) => lo + (hi - lo) * r()
  const global = r() < GLOBAL_CHANCE
  const storms: SimStorm[] = []
  if (global) {
    storms.push({
      kind: 'global',
      name: 'Simulated global dust storm',
      startLs: between([185, 265]),
      peakExtraTau: between(GLOBAL_PEAK_TAU) - BEFORE_STORM_TAU,
    })
  } else {
    storms.push({
      kind: 'regional-A',
      name: 'Simulated regional dust storm (A season)',
      startLs: between([210, 230]),
      peakExtraTau: between(A_EXTRA),
    })
  }
  storms.push({
    kind: 'regional-C',
    name: 'Simulated regional dust storm (C season)',
    startLs: between([305, 320]),
    peakExtraTau: between(C_EXTRA),
  })
  return storms
}

// Regional storms: up in ~3 sols, e-folding decay of ~12 sols (team assumption: they last a few
// weeks, Kass et al. 2016). Global storms follow Curiosity's 2018 curve (dust-storm.ts).
const REGIONAL_RISE_SOLS = 3
const REGIONAL_DECAY_SOLS = 12
const FADED = 0.05

function extraOnSol(s: SimStorm, sol: number): number {
  if (sol < 0) return 0
  if (s.kind === 'global') {
    const shape = (tauOnDay(sol) - BEFORE_STORM_TAU) / (STORM_PEAK_TAU - BEFORE_STORM_TAU)
    return s.peakExtraTau * shape
  }
  return sol < REGIONAL_RISE_SOLS
    ? (s.peakExtraTau * sol) / REGIONAL_RISE_SOLS
    : s.peakExtraTau * Math.exp(-(sol - REGIONAL_RISE_SOLS) / REGIONAL_DECAY_SOLS)
}

/** The simulated storm at a moment, if one is under way, and the opacity it adds. */
export function simulatedStorm(
  utcMs: number,
): { name: string; kind: StormKind; extraTau: number; sol: number } | null {
  if (utcMs < SIMULATED_FROM_UTC) return null
  const ls = solarLongitudeDeg(utcMs)
  let best: { name: string; kind: StormKind; extraTau: number; sol: number } | null = null
  for (const s of stormsOfYear(marsYear(utcMs))) {
    const sol = (ls - s.startLs) / LS_PER_SOL_DUSTY
    const extraTau = extraOnSol(s, sol)
    if (extraTau > FADED && (!best || extraTau > best.extraTau))
      best = { name: s.name, kind: s.kind, extraTau, sol }
  }
  return best
}

/** The next simulated storm to start within `horizonSols`, for the tablet's warning. */
export function stormAhead(
  utcMs: number,
  horizonSols: number,
): { name: string; inSols: number } | null {
  if (utcMs < SIMULATED_FROM_UTC) return null
  const ls = solarLongitudeDeg(utcMs)
  for (const s of stormsOfYear(marsYear(utcMs))) {
    const inSols = (s.startLs - ls) / LS_PER_SOL_DUSTY
    if (inSols > 0 && inSols <= horizonSols) return { name: s.name, inSols }
  }
  return null
}
