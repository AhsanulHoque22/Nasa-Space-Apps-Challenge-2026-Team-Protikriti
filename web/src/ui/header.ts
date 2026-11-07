/** Title, location jump, Explore on foot (site views only) and the Story call to action. */
export type ViewId = string // 'mars' or a site id

export type HeaderOptions = {
  onView: (view: ViewId) => void
  /** Opens Story mode's mission list. */
  onStory: () => void
  /** Walks the chosen site on foot; the button shows only while a site is selected. */
  onExploreOnFoot: (siteId: string, button: HTMLButtonElement) => void
  /** The location selected on first paint; the first site when omitted. */
  initialView?: ViewId
}

const PIN =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>'
const BOOT =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="13" cy="4" r="2"/><path d="m9 20 3-6 3 3v4M6 12l3-4 4 1 3 4M12 14l-2-5"/></svg>'
const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>'

export function renderHeader(
  parent: HTMLElement,
  sites: ReadonlyArray<{ id: string; name: string }>,
  { onView, onStory, onExploreOnFoot, initialView = sites[0]?.id }: HeaderOptions,
): void {
  const header = document.createElement('header')
  header.className = 'panel masthead'
  header.innerHTML = `
    <div class="brand-row">
      <h1 class="brand-heading">
        <img class="brand-mark" src="assets/atlas-mark.webp" alt="" width="40" height="40" />
        <span class="brand-name">ATLAS</span>
      </h1>
    </div>
    <button type="button" class="story-link">${PLAY}<span>Play the story</span></button>
    <div class="go-row">
      <label class="view-select">
        <span class="view-label">${PIN}Jump to a place</span>
        <select>
          <option value="mars">Whole planet</option>
          ${sites.map((s) => `<option value="${s.id}">${s.name}</option>`).join('')}
        </select>
      </label>
      <button type="button" class="foot-link" hidden>${BOOT}<span>Explore on foot</span></button>
    </div>`
  header.querySelector('.story-link')?.addEventListener('click', onStory)
  const select = header.querySelector('select') as HTMLSelectElement
  const foot = header.querySelector('.foot-link') as HTMLButtonElement
  const syncFoot = () => {
    const site = sites.find((s) => s.id === select.value)
    foot.hidden = !site // the whole planet has no ground to walk
    foot.setAttribute('aria-label', site ? `Explore ${site.name} on foot` : 'Explore on foot')
  }
  select.value = initialView ?? 'mars'
  syncFoot()
  select.addEventListener('change', () => {
    syncFoot()
    onView(select.value as ViewId)
  })
  foot.addEventListener('click', () => onExploreOnFoot(select.value, foot))
  parent.append(header)
}
