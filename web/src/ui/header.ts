/** Title and view switch (whole planet vs. the Jezero Marswalk site). */
export type ViewId = 'mars' | 'jezero'

export function renderHeader(parent: HTMLElement, onView: (view: ViewId) => void): void {
  const header = document.createElement('header')
  header.className = 'panel masthead'
  header.innerHTML = `
    <div class="brand">
      <svg class="brand-mark" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#0B3D91"/><path d="M4 15c5-4 11-6 17-6" stroke="#FC3D21" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="16" cy="8" r="1.4" fill="#fff"/></svg>
      <div><h1>Martian Map</h1><p>Marswalk planner</p></div>
    </div>
    <div class="view-switch" role="group" aria-label="Camera view">
      <button type="button" data-view="mars" aria-pressed="false">Mars</button>
      <button type="button" data-view="jezero" aria-pressed="true">Jezero</button>
    </div>`
  const buttons = header.querySelectorAll<HTMLButtonElement>('button[data-view]')
  for (const button of buttons) {
    button.addEventListener('click', () => {
      for (const b of buttons) b.setAttribute('aria-pressed', String(b === button))
      onView(button.dataset.view as ViewId)
    })
  }
  parent.append(header)
}
