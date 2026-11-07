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
