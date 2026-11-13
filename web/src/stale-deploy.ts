/**
 * A page loaded before a deploy (an open tab, or the offline cache's copy on a slow network)
 * runs old code against new data files, e.g. a float32 reader meeting an int16 grid.bin. When a
 * load fails, ask the server for the current page: if it names a different app script, reload
 * once to get the new code instead of showing the error.
 */
const RELOADED_KEY = 'atlas-reloaded-for-deploy'

/** True when a reload was started (the caller should then show nothing). */
export async function reloadIfNewDeploy(): Promise<boolean> {
  const src = document.querySelector('script[type="module"][src]')?.getAttribute('src')
  if (!src) return false
  try {
    if (sessionStorage.getItem(RELOADED_KEY) === src) return false // already tried: a real error
    const page = await fetch(location.pathname, { cache: 'no-store' })
    if (!page.ok || (await page.text()).includes(src)) return false
    sessionStorage.setItem(RELOADED_KEY, src)
  } catch {
    return false // offline or storage blocked: show the original error
  }
  location.reload()
  return true
}
