/** Makes the map canvas a focusable control: arrows pan, plus and minus zoom, Enter places a point. */
import type { Viewer } from 'cesium'
import { keyAction, panView, zoomAltitude } from '../core/keyboard'
import { applyView, currentView } from './viewer'
import { isExploring } from './picking'

export function installKeyboardCamera(viewer: Viewer, onActivate: () => void): void {
  const canvas = viewer.scene.canvas
  canvas.tabIndex = 0
  canvas.setAttribute('role', 'application')
  canvas.setAttribute(
    'aria-label',
    'Mars map. Arrow keys pan, plus and minus zoom, Enter adds a point at the centre of the view.',
  )
  canvas.addEventListener('keydown', (e) => {
    if (isExploring() || e.altKey || e.ctrlKey || e.metaKey) return // explore mode owns the keys
    if (e.key === 'Enter') {
      e.preventDefault()
      onActivate()
      return
    }
    const action = keyAction(e.key)
    if (!action) return
    e.preventDefault()
    const view = currentView(viewer)
    applyView(
      viewer,
      action === 'in' || action === 'out'
        ? { ...view, altM: zoomAltitude(view.altM, action) }
        : { ...view, ...panView(view, action) },
    )
    viewer.scene.requestRender()
  })
}
