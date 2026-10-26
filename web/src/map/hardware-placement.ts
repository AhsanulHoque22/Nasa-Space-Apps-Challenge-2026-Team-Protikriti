/**
 * What stands on the map: rovers and landers where they are (or last were), and the Story mode
 * base where the user placed it. Every model is drawn at its real size (core/hardware.ts).
 */
import {
  HARDWARE,
  KILOPOWER_SPACING_M,
  ULTRAFLEX_WING_DIAMETER_M,
  WINGS_PER_SET,
  fitScale,
  latestStop,
  liftToGround,
  offsetM,
} from '../core/hardware'
import type { Progress } from '../core/mission-progress'
import { SITE_BRIEFS } from '../core/site-features'
import type { HardwareLayer } from './hardware-layer'
import { greenhouseShape, kilopowerShape, powerBoxShape, wingShape } from './hardware-shapes'

type StopLike = { sol: number; lon: number; lat: number; yawDeg: number | null }

const put = (
  layer: HardwareLayer,
  key: string,
  id: string,
  p: { lon: number; lat: number; headingDeg?: number },
  label: string,
) => {
  const h = HARDWARE.find((x) => x.id === id)
  if (!h) throw new Error(`No hardware "${id}"`)
  layer.model(key, h.url, {
    lon: p.lon,
    lat: p.lat,
    headingDeg: p.headingDeg,
    scale: fitScale(h.extent, h.real),
    liftM: liftToGround(h),
    label,
  })
}

/** Spirit's resting place at Troy: the last record of its PDS corrected traverse (sols 2169-2209). */
const SPIRIT_FINAL = { lon: 175.525377, lat: -14.600366 }
/** Viking 2 lander: 47.64°N 225.71°W (Wikipedia: Viking 2), i.e. 134.29°E. */
const VIKING_2 = { lon: 360 - 225.71, lat: 47.64 }

export function placeRovers(
  layer: HardwareLayer,
  stops: { m20: readonly StopLike[]; msl: readonly StopLike[] },
): void {
  const m20 = latestStop(stops.m20)
  if (m20)
    put(
      layer,
      'rover:perseverance',
      'perseverance',
      { ...m20, headingDeg: m20.yawDeg ?? 0 },
      `Perseverance · sol ${m20.sol}`,
    )
  const msl = latestStop(stops.msl)
  if (msl)
    put(
      layer,
      'rover:curiosity',
      'curiosity',
      { ...msl, headingDeg: msl.yawDeg ?? 0 },
      `Curiosity · sol ${msl.sol}`,
    )
  put(layer, 'rover:spirit', 'spirit', SPIRIT_FINAL, 'Spirit · at rest since 2010')
  put(layer, 'rover:viking2', 'viking2', VIKING_2, 'Viking 2 lander · 1976')
}

/** The Story mode base, from saved progress: the crew lander and the parts placed in mission 1.4. */
export function placeBase(layer: HardwareLayer, progress: Progress | null): void {
  layer.removeAll('base:')
  if (!progress?.site) return
  const done = new Set(progress.completed)
  const touchdown = SITE_BRIEFS.find((b) => b.siteId === progress.site?.siteId)?.touchdown
  if (done.has('1.3') && touchdown)
    put(layer, 'base:pod', 'lander-pod', touchdown, 'Crew lander (stand-in)')
  const base = done.has('1.4') ? progress.base : undefined
  if (!base) return
  if (base.habitat) put(layer, 'base:habitat', 'habitat', base.habitat, 'Habitat')
  if (base.oxygen) put(layer, 'base:oxygen', 'oxygen-plant', base.oxygen, 'Oxygen plant (stand-in)')
  const units = progress.cargo?.kilopower ?? 0
  if (base.reactor && units > 0) {
    // As in NASA's Kilopower concept art: units in a row, each cabled to a power box, which is
    // cabled on to the habitat.
    const hub = offsetM(base.reactor, 0, -20)
    layer.shape('base:power-box', powerBoxShape('base:power-box#shape'), {
      ...hub,
      scale: 1,
      label: 'Power box',
    })
    for (let i = 0; i < units; i++) {
      const p = offsetM(base.reactor, (i - (units - 1) / 2) * KILOPOWER_SPACING_M, 0)
      const key = `base:kilopower-${i}`
      layer.shape(key, kilopowerShape(`${key}#shape`), {
        ...p,
        scale: 1,
        label: i === 0 ? 'Kilopower reactors · click to learn more' : '',
      })
      layer.cable(`base:cable-kilopower-${i}`, [p, hub])
    }
    if (base.habitat) layer.cable('base:cable-habitat', [hub, base.habitat])
  }
  const gh = done.has('1.6') ? progress.greenhouse : undefined
  if (gh) {
    const m2 = Object.values(gh.areas).reduce((a, b) => a + b, 0)
    layer.shape('base:greenhouse', greenhouseShape('base:greenhouse#shape', gh.areas), {
      ...gh.at,
      scale: 1,
      label: `Greenhouse · ${m2} m² of beds`,
    })
    if (base.habitat) layer.cable('base:cable-greenhouse', [base.habitat, gh.at])
  }
  const sets = progress.cargo?.solar ?? 0
  if (base.arrays && sets > 0) {
    const wings = sets * WINGS_PER_SET
    const perRow = Math.ceil(Math.sqrt(wings))
    const gap = ULTRAFLEX_WING_DIAMETER_M + 4
    for (let i = 0; i < wings; i++) {
      const p = offsetM(
        base.arrays,
        ((i % perRow) - (perRow - 1) / 2) * gap,
        (Math.floor(i / perRow) - (Math.ceil(wings / perRow) - 1) / 2) * gap,
      )
      layer.shape(`base:wing-${i}`, wingShape(`base:wing-${i}#shape`, base.arrays.lat < 0), {
        ...p,
        scale: 1,
        label: i === 0 ? `Solar arrays · ${sets} set${sets > 1 ? 's' : ''} of 4 wings` : '',
      })
    }
    if (base.habitat) layer.cable('base:cable-arrays', [base.arrays, base.habitat])
  }
}
