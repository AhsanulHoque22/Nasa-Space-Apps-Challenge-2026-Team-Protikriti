/**
 * Full-screen, interactive view of an analog habitat (The Mars Society's MDRS HAB), opened by
 * clicking the habitat in the cargo bay. Sketchfab serves the viewer, so it needs internet; the
 * dialog says so rather than leaving a blank frame unexplained.
 */
import { el } from './dom'

const EMBED_URL = 'https://sketchfab.com/models/5c1f4c9726754652946098616b7614a1/embed?autostart=1'
const MODEL_PAGE =
  'https://sketchfab.com/3d-models/hab-mars-desert-research-station-5c1f4c9726754652946098616b7614a1'

export function openHabitatViewer(): void {
  const close = el('button', { type: 'button', className: 'gate-link', textContent: 'Close' })
  const frame = el('iframe', {
    title: 'HAB, Mars Desert Research Station: interactive 3D model',
    src: EMBED_URL,
    allow: 'autoplay; fullscreen; xr-spatial-tracking',
    allowFullscreen: true,
  })
  const credit = el(
    'p',
    { className: 'habitat-viewer-credit' },
    el('a', {
      href: MODEL_PAGE,
      target: '_blank',
      rel: 'noopener',
      textContent: 'HAB, Mars Desert Research Station',
    }),
    ' by The Mars Society on Sketchfab (CC BY 4.0). An analog habitat crews train in on Earth. Needs internet.',
  )
  const dialog = el(
    'dialog',
    { className: 'habitat-viewer' },
    el(
      'div',
      { className: 'habitat-viewer-bar' },
      el('h2', { textContent: 'Inside a Mars habitat analog' }),
      close,
    ),
    frame,
    credit,
  )
  dialog.setAttribute('aria-label', 'Habitat in 3D')
  close.addEventListener('click', () => dialog.close())
  dialog.addEventListener('close', () => dialog.remove()) // Esc closes it natively
  document.body.append(dialog)
  dialog.showModal()
}
