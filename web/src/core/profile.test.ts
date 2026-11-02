import { describe, expect, it } from 'vitest'
import {
  PROFILE_KEY,
  checkName,
  loadProfile,
  needsSignature,
  saveProfile,
  signProfile,
  unsignedProfile,
} from './profile'

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

describe('the unsigned crew log', () => {
  it('starts a player with no name, so the name form never comes first', () => {
    const p = unsignedProfile('2026-11-02T00:00:00.000Z')
    expect(p.signed).toBe(false)
    expect(needsSignature(p, [])).toBe(false)
  })

  it('asks for the name after the first mission is done', () => {
    expect(needsSignature(unsignedProfile('t'), ['1.1'])).toBe(true)
  })

  it('never asks a player who already has a name, including older saves', () => {
    expect(needsSignature({ version: 1, name: 'Mina', createdAt: 't' }, ['1.1'])).toBe(false)
  })

  it('keeps createdAt when signing, because progress is stored under it', () => {
    const signed = signProfile(unsignedProfile('t'), 'Mina')
    expect(signed).toEqual({ version: 1, name: 'Mina', createdAt: 't', signed: true })
    expect(needsSignature(signed, ['1.1'])).toBe(false)
  })
})
