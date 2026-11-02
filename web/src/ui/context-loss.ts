/**
 * Cesium has no answer to a lost graphics context, and the map just goes blank. Saved progress lives in
 * browser storage, so reload to it, once a minute at most, and say what happened.
 */
import { mayReload } from '../core/reload-guard'
import { el } from './dom'

const RELOAD_DELAY_MS = 2000

const sessionStore = (): Storage | undefined => {
  try {
    return window.sessionStorage
  } catch {
    return undefined // blocked storage: no guard, so no automatic reload
  }
}

export function watchContextLoss(canvas: HTMLCanvasElement): void {
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault()
    const reload = mayReload(sessionStore(), Date.now())
    const notice = el('p', {
      className: 'gl-lost',
      role: 'alert',
      textContent: reload
        ? 'This device dropped the 3D map. Reloading now. Finished missions are saved.'
        : 'This device keeps dropping the 3D map. Finished missions are saved. Close other tabs, then reload.',
    })
    document.body.append(notice)
    if (reload) window.setTimeout(() => window.location.reload(), RELOAD_DELAY_MS)
  })
}
