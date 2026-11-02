import { describe, expect, it } from 'vitest'
import { mayReload } from './reload-guard'

const memory = () => {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  }
}

describe('mayReload', () => {
  it('allows the first reload', () => {
    expect(mayReload(memory(), 1000)).toBe(true)
  })

  it('refuses a second reload inside a minute, which would be a crash loop', () => {
    const store = memory()
    mayReload(store, 1000)
    expect(mayReload(store, 31_000)).toBe(false)
  })

  it('allows another reload once a minute has passed', () => {
    const store = memory()
    mayReload(store, 1000)
    expect(mayReload(store, 61_001)).toBe(true)
  })

  it('refuses when storage is blocked, since it could not stop a loop', () => {
    expect(mayReload(undefined, 1000)).toBe(false)
  })

  it('treats a damaged stored time as no earlier reload', () => {
    const store = memory()
    store.setItem('atlas.lastGlReload', 'not a number')
    expect(mayReload(store, 1000)).toBe(true)
  })
})
