/**
 * The entry point stays tiny so the home screen, already in index.html, can answer a tap before Cesium
 * (about 4.8 MB) has loaded. A tap made too early is remembered, and the app acts on it.
 */
import { playIntro } from './ui/intro'

playIntro()

const home = document.querySelector<HTMLElement>('#first-screen')
home?.addEventListener('click', (event) => {
  const button = (event.target as Element).closest<HTMLElement>('[data-mode]')
  if (!button || home.dataset.ready || !button.dataset.mode) return
  home.dataset.wanted = button.dataset.mode
  button.querySelector('span')?.replaceChildren('Loading Mars…')
})
void import('./app')
