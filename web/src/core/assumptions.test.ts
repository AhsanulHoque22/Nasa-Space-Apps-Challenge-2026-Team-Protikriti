import { describe, expect, it } from 'vitest'
import { assumptionValue, parseAssumptions } from './assumptions'

const sourced = {
  id: 'lighting_W_per_m2',
  label: 'Grow-light power per square metre',
  value: 300,
  range: [200, 400],
  unit: 'W/m²',
  source: 'Test source, p. 1',
  confidence: 'medium',
}
const pending = {
  ...sourced,
  id: 'crop_water',
  label: 'Crop water use per square metre',
  value: null,
  source: null,
  range: null,
}

describe('parseAssumptions', () => {
  it('reads sourced and pending entries by id', () => {
    const a = parseAssumptions([sourced, pending])
    expect(a.get('lighting_W_per_m2')?.value).toBe(300)
    expect(a.get('crop_water')?.value).toBeNull()
  })

  it('rejects a number without a source', () => {
    expect(() => parseAssumptions([{ ...sourced, source: null }])).toThrow(
      /lighting_W_per_m2.*source/,
    )
  })

  it('rejects a value outside its stated range', () => {
    expect(() => parseAssumptions([{ ...sourced, value: 500 }])).toThrow(/outside its range/)
  })

  it('rejects a reversed range', () => {
    expect(() => parseAssumptions([{ ...sourced, range: [400, 200] }])).toThrow(/range/)
  })

  it('rejects a non-finite value', () => {
    expect(() => parseAssumptions([{ ...sourced, value: Number.NaN }])).toThrow(/finite/)
  })

  it('rejects an unknown confidence', () => {
    expect(() => parseAssumptions([{ ...sourced, confidence: 'sure' }])).toThrow(/confidence/)
  })

  it('rejects duplicate ids', () => {
    expect(() => parseAssumptions([sourced, sourced])).toThrow(/duplicate/)
  })

  it('rejects input that is not a list', () => {
    expect(() => parseAssumptions({ sourced })).toThrow(/list/)
  })
})

describe('assumptionValue', () => {
  const a = parseAssumptions([sourced, pending])

  it('returns a sourced value', () => {
    expect(assumptionValue(a, 'lighting_W_per_m2')).toEqual({ ok: true, value: 300 })
  })

  it('reports a null value as pending, never as zero', () => {
    expect(assumptionValue(a, 'crop_water')).toEqual({
      ok: false,
      reason: 'Assumption pending: Crop water use per square metre has no sourced value yet',
    })
  })

  it('throws on an id that does not exist (a coding error, not missing data)', () => {
    expect(() => assumptionValue(a, 'nope')).toThrow(/nope/)
  })
})
