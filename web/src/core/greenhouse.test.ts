import { describe, expect, it } from 'vitest'
import {
  CROPS,
  canopyHeightM,
  crewKcalPerDay,
  cropById,
  greenhouseBudget,
  greenhouseOptions,
  lightWm2,
  spareReactorKw,
  greenhouseSiteProblems,
  bedLayout,
  BED_WIDTH_M,
  AISLE_M,
} from './greenhouse'
import { makeGrid } from './test-grids'

describe('lightWm2', () => {
  it('turns a daily light need into LED power: lettuce 17 mol/m²/d over 16 h ≈ 222 W/m²', () => {
    expect(lightWm2(cropById('lettuce'))).toBeCloseTo(17e6 / (16 * 3600) / (1.66 * 0.8), 6)
    expect(lightWm2(cropById('lettuce'))).toBeCloseTo(222, 0)
  })

  it('makes wheat the hungriest crop for light', () => {
    const w = lightWm2(cropById('wheat'))
    for (const c of CROPS) if (c.id !== 'wheat') expect(lightWm2(c)).toBeLessThan(w)
  })
})

describe('crewKcalPerDay', () => {
  it('is four crew at 12.707 MJ a day, in kcal', () => {
    expect(crewKcalPerDay()).toBeCloseTo((4 * 12.707e3) / 4.184, 6)
  })
})

describe('greenhouseBudget', () => {
  it('adds nothing for an empty greenhouse', () => {
    const b = greenhouseBudget({}, 4)
    expect(b.kcalPerDay).toBe(0)
    expect(b.peakKw).toBe(0)
    expect(b.fits).toBe(false) // nothing planted is not a trial
  })

  it('sums food, light, water and oxygen over the beds', () => {
    const b = greenhouseBudget({ potato: 10, lettuce: 5 }, 4)
    const potato = cropById('potato')
    const lettuce = cropById('lettuce')
    expect(b.kcalPerDay).toBeCloseTo(
      10 * potato.edibleFreshGm2d * (potato.kcalPer100g / 100) +
        5 * lettuce.edibleFreshGm2d * (lettuce.kcalPer100g / 100),
      6,
    )
    expect(b.peakKw).toBeCloseTo((10 * lightWm2(potato) + 5 * lightWm2(lettuce)) / 1000, 6)
    expect(b.waterKgPerDay).toBeCloseTo(10 * potato.waterKgM2d + 5 * lettuce.waterKgM2d, 6)
    expect(b.firstHarvestDay).toBe(lettuce.growthDays)
    expect(b.fits).toBe(true)
  })

  it('does not fit when the lights need more than the reactors have spare', () => {
    expect(greenhouseBudget({ wheat: 30 }, 4).fits).toBe(false)
  })
})

describe('spareReactorKw', () => {
  it('is the reactors minus the habitat and the ascent vehicle cooling', () => {
    expect(spareReactorKw(4)).toBeCloseTo(35 - 12.1 - 6.655, 6)
    expect(spareReactorKw(0)).toBeLessThan(0)
  })
})

describe('greenhouseOptions', () => {
  it('offers only changes that fit, each checked by the same budget', () => {
    const options = greenhouseOptions({ wheat: 30, lettuce: 10 }, 4)
    expect(options.length).toBeGreaterThan(0)
    for (const o of options) expect(greenhouseBudget(o.areas, 4).fits).toBe(true)
  })

  it('offers nothing when the plan already fits', () => {
    expect(greenhouseOptions({ lettuce: 10 }, 4)).toEqual([])
  })
})

describe('canopyHeightM', () => {
  it('grows to the mature height by harvest and stays there', () => {
    const lettuce = cropById('lettuce')
    expect(canopyHeightM(lettuce, 0)).toBe(0)
    expect(canopyHeightM(lettuce, lettuce.growthDays)).toBeCloseTo(lettuce.matureHeightM, 9)
    expect(canopyHeightM(lettuce, 999)).toBeCloseTo(lettuce.matureHeightM, 9)
  })
})

describe('greenhouseSiteProblems', () => {
  const flat = makeGrid(Array.from({ length: 10 }, () => Array(10).fill(0)))
  const at = (row: number, col: number) => ({
    lon: flat.west + ((col + 0.5) / flat.width) * (flat.east - flat.west),
    lat: flat.north - ((row + 0.5) / flat.height) * (flat.north - flat.south),
  })

  it('passes flat ground far from the reactors', () => {
    expect(greenhouseSiteProblems(flat, at(5, 5), at(0, 0))).toEqual([])
  })

  it('flags a spot too close to the reactors (crew work there)', () => {
    const near = { lon: at(5, 5).lon + 0.005, lat: at(5, 5).lat } // about 300 m away
    const p = greenhouseSiteProblems(flat, at(5, 5), near)
    expect(p.join(' ')).toMatch(/reactor/)
  })

  it('flags steep ground', () => {
    const steep = makeGrid(Array.from({ length: 10 }, (_, r) => Array(10).fill(r * 40)))
    expect(greenhouseSiteProblems(steep, at(5, 5), null).join(' ')).toMatch(/steep/)
  })

  it('flags a spot off the mapped terrain', () => {
    expect(greenhouseSiteProblems(flat, { lon: 50, lat: 50 }, null)).toEqual([
      'Outside the mapped terrain.',
    ])
  })
})

describe('bedLayout', () => {
  it('lays one bed per crop side by side, each as long as its area needs', () => {
    const beds = bedLayout({ lettuce: 6, potato: 12 })
    expect(beds.map((b) => b.crop.id)).toEqual(['lettuce', 'potato'])
    expect(beds[0]?.lengthM).toBeCloseTo(6 / BED_WIDTH_M, 9)
    expect(beds[1]?.xM).toBeCloseTo(BED_WIDTH_M + AISLE_M, 9)
  })
})
