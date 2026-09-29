import { describe, expect, it } from 'vitest'
import m20 from './fixtures/m20-images.json'
import msl from './fixtures/msl-images.json'
import { normalizeM20, normalizeMsl } from './raw-images'

describe('normalizeM20 (Perseverance Navcam)', () => {
  const frames = normalizeM20(m20)
  it('maps mast pointing, site/drive, subframe and the Navcam sensor', () => {
    const f = frames[0]
    expect(f?.site).toBe(91)
    expect(f?.drive).toBe(970)
    expect(f?.sol).toBe(1993)
    expect(f?.azDeg).toBeCloseTo(Number(m20.images[0]?.extended.mastAz))
    expect(f?.sensor).toEqual([5120, 3840])
    expect(f?.fovDeg).toEqual([96, 73])
    expect(f?.subframe).toHaveLength(4)
    expect(f?.url).toMatch(/_800\.jpg$/) // medium: sharp enough, light enough
    expect(f?.sequence).toMatch(/^NCAM\d{5}$/)
    expect(f?.link).toMatch(/^https:\/\/mars\.nasa\.gov\//)
  })
})

describe('normalizeMsl (Curiosity Navcam)', () => {
  const frames = normalizeMsl(msl)
  it('skips thumbnails and reads pointing from the extended block', () => {
    expect(frames).toHaveLength(2)
    expect(frames[0]).toMatchObject({ site: 124, drive: 1978, sol: 5000, sensor: [1024, 1024] })
    expect(frames[0]?.azDeg).toBeCloseTo(6.98717)
    expect(frames[0]?.elDeg).toBeCloseTo(-52.7251)
    expect(frames[0]?.subframe).toEqual([1, 1, 1024, 1024])
  })
})

describe('bad records are dropped, not guessed', () => {
  it('drops frames with no mast pointing', () => {
    const broken = {
      images: [{ ...m20.images[0], extended: { ...m20.images[0]?.extended, mastAz: 'UNK' } }],
    }
    expect(normalizeM20(broken)).toEqual([])
  })
})
