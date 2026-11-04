/** Title and view switch (whole planet vs. the Jezero Marswalk site). */
export type ViewId = string // 'mars' or a site id

export type HeaderOptions = {
  onView: (view: ViewId) => void
  /** Reopens the start screen (profile and mode choice). */
  onStart: () => void
  /** Opens Story mode's mission list. */
  onStory: () => void
  /** The location selected on first paint; the first site when omitted. */
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
      <span><span class="brand-name">ATLAS</span><span class="brand-sub">Back to start</span></span>
    </button></h1>
    <label class="view-select"><span class="visually-hidden">Location</span>
      <select>
        <option value="mars">Mars</option>
        ${sites.map((s) => `<option value="${s.id}">${s.name}</option>`).join('')}
      </select>
    </label>
    <button type="button" class="story-link">The story</button>`
  header.querySelector('.brand')?.addEventListener('click', onStart)
  header.querySelector('.story-link')?.addEventListener('click', onStory)
  const select = header.querySelector('select') as HTMLSelectElement
  select.value = initialView ?? 'mars'
  select.addEventListener('change', () => onView(select.value as ViewId))
  parent.append(header)
}
