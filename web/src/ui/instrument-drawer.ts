/**
 * On a phone the map's panels would bury the map, so they live in one drawer, closed by default.
 * Above the phone breakpoint the button is hidden and the panels sit where they always did.
 */
import { el } from './dom'

export function renderInstrumentDrawer(): void {
  const button = el('button', {
    type: 'button',
    className: 'drawer-toggle',
    textContent: 'Instruments',
  })
  button.setAttribute('aria-expanded', 'false')
  button.addEventListener('click', () => {
    const open = document.body.dataset.instruments !== 'open'
    if (open) document.body.dataset.instruments = 'open'
    else delete document.body.dataset.instruments
    button.setAttribute('aria-expanded', String(open))
    button.textContent = open ? 'Close instruments' : 'Instruments'
  })
  document.body.append(button)
}
