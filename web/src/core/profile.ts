/**
 * The local crew profile: a name for the mission log, kept in the browser. No password and no
 * server, so the demo runs offline. Stored data is untrusted: it is re-checked on every load.
 */
import { readStored, writeStored } from './local-store'
import type { KeyValueStore } from './streetview'

export const PROFILE_KEY = 'atlas.profile'
const NAME_MAX_CHARS = 40

export type Profile = { version: 1; name: string; createdAt: string }

export type NameCheck = { ok: true; name: string } | { ok: false; reason: string }

export type LoadedProfile = { profile: Profile | null; note: string | null }

const NO_STORAGE_NOTE = 'This browser is not saving data, so progress lasts for this visit only.'
const DAMAGED_NOTE = 'Your saved profile could not be read, so a new one is needed.'

export function checkName(raw: string): NameCheck {
  const name = raw.trim()
  if (name === '') return { ok: false, reason: 'Enter a name for the crew log.' }
  if (name.length > NAME_MAX_CHARS) {
    return { ok: false, reason: `Keep the name to ${NAME_MAX_CHARS} characters or fewer.` }
  }
  return { ok: true, name }
}

function isProfile(v: unknown): v is Profile {
  const p = v as Partial<Profile> | null
  return (
    !!p &&
    p.version === 1 &&
    typeof p.name === 'string' &&
    checkName(p.name).ok &&
    typeof p.createdAt === 'string'
  )
}

export function loadProfile(store: KeyValueStore | undefined): LoadedProfile {
  const read = readStored(store, PROFILE_KEY, isProfile)
  const note =
    read.status === 'unavailable'
      ? NO_STORAGE_NOTE
      : read.status === 'damaged'
        ? DAMAGED_NOTE
        : null
  return { profile: read.value, note }
}

/** False when the browser will not keep it (blocked or full storage): progress is session-only. */
export function saveProfile(store: KeyValueStore | undefined, profile: Profile): boolean {
  return writeStored(store, PROFILE_KEY, profile)
}
