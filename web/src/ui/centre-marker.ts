/** A small crosshair on the view centre (what the site report describes), with an on/off key. */
import type { Viewer } from 'cesium'

const STORE_KEY = 'atlas.centreMarker'

function remembered(): boolean {
  try {
    return localStorage.getItem(STORE_KEY) !== 'off'
  } catch {
    return true // storage blocked: shown by default
  }
}

export function installCentreMarker(globe: HTMLElement, toggle: HTMLButtonElement | null): void {
  const mark = document.createElement('div')
  mark.className = 'centre-marker'
  mark.setAttribute('aria-hidden', 'true')
  globe.append(mark)
  const set = (on: boolean) => {
    mark.hidden = !on
    toggle?.setAttribute('aria-pressed', String(on))
    try {
      localStorage.setItem(STORE_KEY, on ? 'on' : 'off')
    } catch {
      // storage blocked: the choice lasts this visit only
    }
  }
  set(remembered())
  toggle?.addEventListener('click', () => set(Boolean(mark.hidden)))
}

const SNAPSHOT_QUALITY = 0.85

/** The map view as a JPEG data URL, drawn fresh so the WebGL buffer is not already cleared. */
export function viewSnapshot(viewer: Viewer): string | null {
  try {
    viewer.render()
    return viewer.scene.canvas.toDataURL('image/jpeg', SNAPSHOT_QUALITY)
  } catch {
    return null // a tainted or lost canvas: the report shows without the picture
  }
}

const SETTLE_TIMEOUT_MS = 6000 // a slow tile server must not leave the window waiting forever

/**
 * A square picture of the map once the camera has stopped and the ground tiles are in: the map
 * view of one place, for a window that covers the map.
 */
export function settledSnapshot(viewer: Viewer): Promise<string | null> {
  return new Promise((resolve) => {
    let started = 0
    let watching = false
    const tick = () => {
      started ||= performance.now()
      if (performance.now() - started < SETTLE_TIMEOUT_MS && !viewer.scene.globe.tilesLoaded) {
        requestAnimationFrame(tick)
        return
      }
      const full = viewSnapshot(viewer)
      if (!full) return resolve(null)
      const img = new Image()
      img.onload = () => {
        const side = Math.min(img.width, img.height)
        const c = document.createElement('canvas')
        c.width = c.height = side
        c.getContext('2d')?.drawImage(
          img,
          (img.width - side) / 2,
          (img.height - side) / 2,
          side,
          side,
          0,
          0,
          side,
          side,
        )
        resolve(c.toDataURL('image/jpeg', SNAPSHOT_QUALITY))
      }
      img.onerror = () => resolve(full)
      img.src = full
    }
    // flyTo starts on the next frame: wait for the move to end before watching the tiles.
    const watch = () => {
      if (watching) return
      watching = true
      off()
      requestAnimationFrame(tick)
    }
    const off = viewer.camera.moveEnd.addEventListener(watch)
    window.setTimeout(watch, SETTLE_TIMEOUT_MS)
  })
}
