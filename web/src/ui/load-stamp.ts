/** The ceremony when the lander is loaded: a stamp lands, then the mission moves on. */
import { el } from './dom'

const STAMP_MS = 900

export function loadStamp(done: () => void): void {
  const stamp = el('div', { className: 'load-stamp', role: 'status', textContent: 'Loaded' })
  document.body.append(stamp)
  window.setTimeout(() => {
    stamp.remove()
    done()
  }, STAMP_MS)
}
