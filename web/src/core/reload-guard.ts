/** May the app reload itself after losing its graphics context? Not twice in a minute: that's a loop. */
const LAST_RELOAD_KEY = 'atlas.lastGlReload'
const MIN_GAP_MS = 60_000

type ReloadStore = Pick<Storage, 'getItem' | 'setItem'>

export function mayReload(store: ReloadStore | undefined, nowMs: number): boolean {
  if (!store) return false
  const last = Number(store.getItem(LAST_RELOAD_KEY))
  if (Number.isFinite(last) && last > 0 && nowMs - last < MIN_GAP_MS) return false
  store.setItem(LAST_RELOAD_KEY, String(nowMs))
  return true
}
