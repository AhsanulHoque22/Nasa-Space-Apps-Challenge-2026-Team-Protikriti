import { describe, expect, it } from 'vitest'
import meda from './fixtures/meda.json'
import rems from './fixtures/rems.json'
import { parseMeda, parseRems } from './weather'

describe('parseRems (Curiosity, Gale crater)', () => {
  const sols = parseRems(rems)
  it('parses numbers, sorts by sol ascending', () => {
    expect(sols.map((s) => s.sol)).toEqual([2935, 4993, 4994, 4995])
    expect(sols.at(-1)).toMatchObject({
      sol: 4995,
      earthDate: '2026-08-25',
      minC: -71,
      maxC: -5,
      pressurePa: 777,
      groundMinC: -84,
      groundMaxC: 4,
      uv: 'Moderate',
      opacity: 'Sunny',
      sunrise: '06:46',
      sunset: '18:51',
    })
    expect(sols.at(-1)?.ls).toBe(341)
  })
  it('turns "--" placeholders into null, never 0', () => {
    expect(sols[0]?.minC).toBeNull()
  })
  it('rejects a payload without soles', () => {
    expect(() => parseRems({})).toThrow(/soles/)
  })
})

describe('parseMeda (Perseverance, Jezero crater)', () => {
  const sols = parseMeda(meda)
  it('keeps numeric values and nulls placeholders', () => {
    expect(sols.at(-1)).toMatchObject({ sol: 1133, minC: -79.3, maxC: -24.7, pressurePa: 778.9 })
    expect(sols[0]?.minC).toBeNull()
  })
  it('drops duplicate sols', () => {
    const dup = { sols: [...meda.sols, meda.sols.at(-1)] }
    expect(parseMeda(dup)).toHaveLength(meda.sols.length)
  })
  it('rejects a payload without sols', () => {
    expect(() => parseMeda({ nope: 1 })).toThrow(/sols/)
  })
})
