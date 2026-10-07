/** A small LIVE / OFFLINE chip, so nobody mistakes saved data for live data. */
import { connectionLabel } from '../core/connection'

export function renderConnectionBadge(parent: HTMLElement): void {
  const badge = document.createElement('p')
  badge.className = 'net-badge'
  badge.setAttribute('role', 'status')
  const draw = () => {
    const { text, detail } = connectionLabel(navigator.onLine)
    badge.textContent = text
    badge.title = detail
    badge.setAttribute('aria-label', detail)
    badge.dataset.online = String(navigator.onLine)
  }
  window.addEventListener('online', draw)
  window.addEventListener('offline', draw)
  draw()
  parent.append(badge)
}
