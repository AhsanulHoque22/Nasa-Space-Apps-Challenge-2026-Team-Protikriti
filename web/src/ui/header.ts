/** Title and view switch (whole planet vs. the Jezero Marswalk site). */
export type ViewId = string // 'mars' or a site id

export type HeaderOptions = {
  onView: (view: ViewId) => void
  /** Reopens the start screen (profile and mode choice). */
  onStart: () => void
  /** Opens Story mode's mission list. */
  onStory: () => void
  /** The tab shown as selected on first paint; the first site when omitted. */
  initialView?: ViewId
}

export function renderHeader(
  parent: HTMLElement,
  sites: ReadonlyArray<{ id: string; name: string }>,
  { onView, onStart, onStory, initialView = sites[0]?.id }: HeaderOptions,
): void {
  const header = document.createElement('header')
  header.className = 'panel masthead'
  header.innerHTML = `
    <h1 class="brand-heading"><button type="button" class="brand" aria-label="ATLAS: back to start">
      <svg class="brand-mark" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#0B3D91"/><path d="M4 15c5-4 11-6 17-6" stroke="#FC3D21" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="16" cy="8" r="1.4" fill="#fff"/></svg>
      <span><span class="brand-name">ATLAS</span><span class="brand-sub">Back to start</span></span>
    </button></h1>
    <div class="view-switch" role="group" aria-label="Camera view">
      <button type="button" data-view="mars" aria-pressed="${initialView === 'mars'}">Mars</button>
      ${sites.map((s) => `<button type="button" data-view="${s.id}" aria-pressed="${s.id === initialView}">${s.name.replace(/^Mars /, '').split(/[\s(]/)[0]}</button>`).join('')}
    </div>
    <button type="button" class="story-link">Story mode</button>`
  header.querySelector('.brand')?.addEventListener('click', onStart)
  header.querySelector('.story-link')?.addEventListener('click', onStory)
  const buttons = header.querySelectorAll<HTMLButtonElement>('button[data-view]')
  for (const button of buttons) {
    button.addEventListener('click', () => {
      for (const b of buttons) b.setAttribute('aria-pressed', String(b === button))
      onView(button.dataset.view as ViewId)
    })
  }
  parent.append(header)
}
