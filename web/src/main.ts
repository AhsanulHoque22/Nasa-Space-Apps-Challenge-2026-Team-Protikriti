/**
 * The entry point stays tiny so the first screen, already in index.html, can answer a tap before
 * Cesium (about 4.8 MB) has loaded. A tap made too early is remembered, and the app acts on it.
 */
const start = document.querySelector<HTMLButtonElement>('#first-screen .card-go')
start?.addEventListener(
  'click',
  () => {
    if (start.dataset.ready) return
    start.dataset.wanted = 'true'
    start.textContent = 'Loading Mars…'
  },
  { once: true },
)
void import('./app')
