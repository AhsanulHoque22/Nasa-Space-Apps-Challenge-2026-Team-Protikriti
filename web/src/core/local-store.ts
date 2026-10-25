/**
 * Browser storage that never throws and never loses data. Storage can be blocked (private
 * windows), full, or hold a value an older or newer version wrote. A value that fails its check
 * is copied to `<key>.damaged` before anything new can overwrite it.
 */
import type { KeyValueStore } from './streetview'

export type StoredRead<T> = {
  value: T | null
  status: 'ok' | 'empty' | 'damaged' | 'unavailable'
}

export function readStored<T>(
  store: KeyValueStore | undefined,
  key: string,
  isValid: (v: unknown) => v is T,
): StoredRead<T> {
  let text: string | null
  try {
    if (!store) return { value: null, status: 'unavailable' }
    text = store.getItem(key)
  } catch {
    return { value: null, status: 'unavailable' }
  }
  if (text === null) return { value: null, status: 'empty' }
  try {
    const parsed: unknown = JSON.parse(text)
    if (isValid(parsed)) return { value: parsed, status: 'ok' }
  } catch {
    // not JSON: kept below like any other damaged value
  }
  try {
    store.setItem(`${key}.damaged`, text)
  } catch {
    // storage refused the backup; the caller still reports the damage
  }
  return { value: null, status: 'damaged' }
}

/** False when the browser will not keep it (blocked or full storage). */
export function writeStored(
  store: KeyValueStore | undefined,
  key: string,
  value: unknown,
): boolean {
  if (!store) return false
  try {
    store.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}
