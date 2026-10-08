import { describe, expect, it } from 'vitest'
import {
  NONE,
  classShares,
  decodeRle,
  groupOf,
  groupsFor,
  imageIdOf,
  labelKey,
  matchLabels,
} from './ai4mars'

// Same cases as pipeline/tests/test_ai4mars.py: both sides must agree on keys and groups.
describe('labelKey and groupOf', () => {
  it('Curiosity: the product id without its version (labels are on M1, the API serves M_)', () => {
    expect(labelKey('msl', 'NLA_409036068EDR_F0051606NCAM00348M1')).toBe(
      'NLA_409036068EDR_F0051606NCAM00348M',
    )
    expect(labelKey('msl', 'NLA_409036068EDR_F0051606NCAM00348M_')).toBe(
      'NLA_409036068EDR_F0051606NCAM00348M',
    )
    expect(groupOf('msl', 'NLA_409036068EDR_F0051606NCAM00348M1')).toBe('4090')
  })

  it('Perseverance: eye and exposure clock, shared by a full-frame label and its API tiles', () => {
    const tile = 'NLF_0009_0667755959_167EBY_N0030000NCAM05000_08_0LLJ'
    expect(labelKey('m20', tile)).toBe('NL_0667755959_167')
    expect(groupOf('m20', tile)).toBe('9')
  })

  it('anything else has no key', () => {
    expect(labelKey('m20', 'VgncRawLeft_0709292134-43706-1')).toBeNull()
    expect(groupOf('msl', 'README')).toBeNull()
  })
})

describe('imageIdOf', () => {
  it('reads the product id from a raw-image URL', () => {
    expect(
      imageIdOf(
        'https://mars.nasa.gov/msl-raw-images/proj/msl/redops/ods/surface/sol/00480/opgs/edr/ncam/NLB_440315000EDR_F0050000NCAM00500M_.JPG',
      ),
    ).toBe('NLB_440315000EDR_F0050000NCAM00500M_')
  })
})

describe('decodeRle', () => {
  it('expands (value, run) pairs', () => {
    const b64 = btoa(String.fromCharCode(0, 3, 4, 2))
    expect(Array.from(decodeRle(b64, 5))).toEqual([0, 0, 0, NONE, NONE])
  })

  it('refuses data that does not fill the frame', () => {
    expect(() => decodeRle(btoa(String.fromCharCode(0, 3)), 5)).toThrow(/5/)
  })
})

describe('classShares', () => {
  it('gives each class its share of the labelled pixels only', () => {
    const shares = classShares(Uint8Array.from([0, 0, 1, 3, NONE, NONE]))
    expect(shares).toEqual([0.5, 0.25, 0, 0.25])
  })

  it('is all zero when nothing is labelled', () => {
    expect(classShares(Uint8Array.from([NONE]))).toEqual([0, 0, 0, 0])
  })
})

describe('matchLabels', () => {
  const frame = (url: string, azDeg: number, subframe: [number, number, number, number]) => ({
    url,
    azDeg,
    elDeg: -10,
    subframe,
    sensor: [1024, 1024] as [number, number],
    fovDeg: [45, 45] as [number, number],
  })
  const rle = btoa(String.fromCharCode(1, 4)) // 2 x 2, all bedrock

  it('pairs Curiosity frames with their labels, posed like the stitched photos', () => {
    const f = frame('https://x/NLB_440315000EDR_F0050000NCAM00500M_.JPG', 30, [1, 513, 1024, 512])
    const docs = { '4403': { NLB_440315000EDR_F0050000NCAM00500M: { w: 2, h: 2, rle } } }
    const [s] = matchLabels('msl', [f], 100, docs)
    expect(s?.azDeg).toBe(130) // mast azimuth plus the stop's yaw
    expect(s?.elDeg).toBe(-10)
    expect(s?.sensorTan?.[1]).toBeLessThan(0) // the lower half of the sensor
    expect(Array.from(s?.cls ?? [])).toEqual([1, 1, 1, 1])
  })

  it('uses one label per Perseverance exposure, over the full sensor', () => {
    const tile = (n: string) =>
      frame(
        `https://x/NLF_0009_0667755959_167EBY_N0030000NCAM05000_${n}_0LLJ03_800.jpg`,
        0,
        [1, 1, 1280, 960],
      )
    const docs = { '9': { NL_0667755959_167: { w: 2, h: 2, rle } } }
    const found = matchLabels('m20', [tile('08'), tile('17')], 0, docs)
    expect(found).toHaveLength(1)
    expect(found[0]?.sensorTan).toBeUndefined()
  })

  it('names the group files a stop needs', () => {
    const f = frame('https://x/NLB_440315000EDR_F0050000NCAM00500M1.JPG', 0, [1, 1, 1024, 1024])
    expect([...groupsFor('msl', [f, f])]).toEqual(['4403'])
  })
})
