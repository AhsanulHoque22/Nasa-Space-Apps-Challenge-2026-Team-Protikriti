import { describe, expect, it } from 'vitest'
import { PROFILE_KEY, checkName, loadProfile, saveProfile } from './profile'

/** A Map-backed store; `broken` makes every call throw, like a blocked private window. */
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

const ada = { version: 1 as const, name: 'Ada', createdAt: '2026-10-25T08:00:00.000Z' }

describe('checkName', () => {
  it('trims and accepts a normal name', () => {
    expect(checkName('  Ada  ')).toEqual({ ok: true, name: 'Ada' })
  })

  it('rejects an empty name', () => {
    expect(checkName('   ')).toEqual({ ok: false, reason: 'Enter a name for the crew log.' })
  })

  it('rejects a name longer than 40 characters', () => {
    expect(checkName('x'.repeat(41))).toEqual({
      ok: false,
      reason: 'Keep the name to 40 characters or fewer.',
    })
  })
})

describe('profile storage', () => {
  it('starts with no profile and no note on a first visit', () => {
    expect(loadProfile(store())).toEqual({ profile: null, note: null })
  })

  it('saves and loads the same profile', () => {
    const s = store()
    expect(saveProfile(s, ada)).toBe(true)
    expect(loadProfile(s)).toEqual({ profile: ada, note: null })
  })

  it('says so when a saved profile is damaged, instead of dropping it silently', () => {
    const s = store({ [PROFILE_KEY]: '{not json' })
    expect(loadProfile(s)).toEqual({
      profile: null,
      note: 'Your saved profile could not be read, so a new one is needed.',
    })
  })

  it('rejects a stored profile with a missing name', () => {
    const s = store({ [PROFILE_KEY]: JSON.stringify({ version: 1, createdAt: ada.createdAt }) })
    expect(loadProfile(s).profile).toBeNull()
  })

  it('works without storage and says progress lasts for this visit only', () => {
    const note = 'This browser is not saving data, so progress lasts for this visit only.'
    expect(loadProfile(undefined)).toEqual({ profile: null, note })
    expect(loadProfile(store({}, true))).toEqual({ profile: null, note })
    expect(saveProfile(store({}, true), ada)).toBe(false)
    expect(saveProfile(undefined, ada)).toBe(false)
  })
})
