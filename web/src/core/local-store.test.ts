import { describe, expect, it } from 'vitest'
import { readStored, writeStored } from './local-store'

function store(initial: Record<string, string> = {}, broken = false) {
  const m = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => {
      if (broken) throw new Error('blocked')
      return m.get(k) ?? null
    },
    setItem: (k: string, v: string) => {
      if (broken) throw new Error('blocked')
      m.set(k, v)
    },
    raw: m,
  }
}

const isCount = (v: unknown): v is { n: number } =>
  typeof v === 'object' && v !== null && typeof (v as { n: unknown }).n === 'number'

describe('readStored', () => {
  it('is empty when nothing was saved', () => {
    expect(readStored(store(), 'k', isCount)).toEqual({ value: null, status: 'empty' })
  })

  it('returns a valid saved value', () => {
    const s = store({ k: '{"n":3}' })
    expect(readStored(s, 'k', isCount)).toEqual({ value: { n: 3 }, status: 'ok' })
  })

  it('backs up a damaged value instead of losing it', () => {
    const s = store({ k: '{"n":"three"}' })
    expect(readStored(s, 'k', isCount)).toEqual({ value: null, status: 'damaged' })
    expect(s.raw.get('k.damaged')).toBe('{"n":"three"}')
  })

  it('backs up text that is not JSON', () => {
    const s = store({ k: '{oops' })
    expect(readStored(s, 'k', isCount).status).toBe('damaged')
    expect(s.raw.get('k.damaged')).toBe('{oops')
  })

  it('reports unavailable storage', () => {
    expect(readStored(undefined, 'k', isCount)).toEqual({ value: null, status: 'unavailable' })
    expect(readStored(store({}, true), 'k', isCount)).toEqual({
      value: null,
      status: 'unavailable',
    })
  })
})

describe('writeStored', () => {
  it('saves JSON and reports success', () => {
    const s = store()
    expect(writeStored(s, 'k', { n: 1 })).toBe(true)
    expect(s.raw.get('k')).toBe('{"n":1}')
  })

  it('reports failure instead of throwing when storage refuses', () => {
    expect(writeStored(store({}, true), 'k', { n: 1 })).toBe(false)
    expect(writeStored(undefined, 'k', { n: 1 })).toBe(false)
  })
})
