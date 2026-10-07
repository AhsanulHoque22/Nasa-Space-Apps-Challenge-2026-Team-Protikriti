import { describe, expect, it } from 'vitest'
import { DELTA_FACTS } from './delta-facts'

describe('Jezero delta facts', () => {
  it('cites a source page for every statement', () => {
    for (const f of DELTA_FACTS) {
      expect(f.source.url, f.title).toMatch(/^https:\/\//)
      expect(f.source.label.trim(), f.title).not.toBe('')
    }
  })

  it('points only at real sample numbers (1-30 in NASA records)', () => {
    for (const f of DELTA_FACTS)
      for (const n of f.samples) expect(n >= 1 && n <= 30, `${n}`).toBe(true)
  })

  it('never presents organic molecules as signs of life', () => {
    const organics = DELTA_FACTS.find((f) => /organic/i.test(f.text))
    expect(organics?.text).toMatch(/do not need life|without life/i)
    for (const f of DELTA_FACTS)
      expect(f.text).not.toMatch(/evidence of life was found|proves? life/i)
  })
})
