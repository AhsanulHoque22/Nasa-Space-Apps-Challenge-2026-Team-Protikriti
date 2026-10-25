import { describe, expect, it } from 'vitest'
import siteList from '../../public/data/sites.json'
import { CERTIFIED_ZONES } from './landing-sites'
import { SITE_BRIEFS } from './site-features'

const sites = siteList.sites

/** Pins may sit just outside a site's terrain tile (Cheyava Falls is 1.5 km west of Jezero's). */
const MARGIN_DEG = 0.05

describe('SITE_BRIEFS', () => {
  it('briefs every certified landing site', () => {
    expect(SITE_BRIEFS.map((b) => b.siteId).sort()).toEqual(
      Object.values(CERTIFIED_ZONES).slice().sort(),
    )
  })

  it.each(SITE_BRIEFS.map((b) => [b.siteId, b] as const))(
    '%s: every pin lies on or beside its terrain tile',
    (siteId, brief) => {
      const b = sites.find((s) => s.id === siteId)
      expect(b).toBeDefined()
      if (!b) return
      for (const f of brief.features) {
        expect(f.lon, f.name).toBeGreaterThan(b.west - MARGIN_DEG)
        expect(f.lon, f.name).toBeLessThan(b.east + MARGIN_DEG)
        expect(f.lat, f.name).toBeGreaterThan(b.south - MARGIN_DEG)
        expect(f.lat, f.name).toBeLessThan(b.north + MARGIN_DEG)
      }
    },
  )

  it('gives every pin a finding, a crew reason, how it was located and an https source', () => {
    for (const brief of SITE_BRIEFS) {
      expect(brief.features.length).toBeGreaterThanOrEqual(2)
      for (const f of brief.features) {
        expect(f.finding.length, f.name).toBeGreaterThan(40)
        expect(f.forCrew.length, f.name).toBeGreaterThan(20)
        expect(f.located.length, f.name).toBeGreaterThan(10)
        expect(f.source.url, f.name).toMatch(/^https:\/\//)
      }
    }
  })
})

const PHOTO_FILES = Object.keys(import.meta.glob('../../public/media/sites/*.webp')).map((p) =>
  p.replace('../../public/', ''),
)

describe('point-of-interest photos', () => {
  it('gives every pin a NASA photo that is on disk, with alt text, a caption and a credit', () => {
    for (const brief of SITE_BRIEFS) {
      for (const f of brief.features) {
        expect(f.photo.src, f.name).toMatch(/^media\/sites\/pia\d{5}\.webp$/)
        expect(PHOTO_FILES, f.name).toContain(f.photo.src)
        expect(f.photo.alt.length, f.name).toBeGreaterThan(15)
        expect(f.photo.caption.length, f.name).toBeGreaterThan(30)
        expect(f.photo.credit, f.name).toMatch(/^NASA\/JPL/)
        expect(f.photo.page, f.name).toMatch(
          /^https:\/\/photojournal\.jpl\.nasa\.gov\/catalog\/PIA\d{5}$/,
        )
      }
    }
  })
})
