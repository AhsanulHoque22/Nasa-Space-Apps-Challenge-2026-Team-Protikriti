/** Right-hand workbench: one tab per purpose, so the column shows a few panels, not fourteen. */

type Tab = 'plan' | 'explore' | 'science'

const TABS: { id: Tab; label: string; hint: string; icon: string }[] = [
  {
    id: 'plan',
    label: 'Plan',
    hint: 'Draw a Marswalk route and check that it is safe.',
    icon: '<circle cx="5" cy="18" r="2"/><circle cx="19" cy="6" r="2"/><path d="M7 18h6a4 4 0 0 0 0-8h-2a4 4 0 0 1 0-8"/>',
  },
  {
    id: 'explore',
    label: 'Explore',
    hint: 'Look around a site: weather, walking on foot, best landing zones.',
    icon: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  },
  {
    id: 'science',
    label: 'Science',
    hint: 'Geology, dust, radiation and how the route was checked.',
    icon: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/>',
  },
]

// First match wins. Panels that match nothing (weather result, site report, cards) stay on every tab.
const GROUPS: [Tab, string[]][] = [
  ['plan', ['quest', 'route', 'sync', 'link']],
  ['explore', ['wx-launch', 'zones', 'delta']],
  ['science', ['geology', 'compare', 'scenario', 'dust', 'dose', 'benchmark']],
]

function groupOf(el: Element): Tab | null {
  for (const [tab, classes] of GROUPS) if (classes.some((c) => el.classList.contains(c))) return tab
  return null
}

export function renderDock(side: HTMLElement): void {
  const dock = document.createElement('div')
  dock.className = 'panel dock'
  dock.innerHTML = `<div class="dock-tabs" role="tablist" aria-label="Workbench">${TABS.map(
    (t) =>
      `<button type="button" role="tab" id="dock-tab-${t.id}" data-tab="${t.id}" aria-controls="dock-hint">
        <svg viewBox="0 0 24 24" aria-hidden="true">${t.icon}</svg><span>${t.label}</span></button>`,
  ).join('')}</div><p class="dock-hint" id="dock-hint" role="tabpanel"></p>`
  const buttons = [...dock.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
  const hint = dock.querySelector('.dock-hint') as HTMLElement
  let active: Tab = 'plan'

  const tag = (el: Element) => {
    if (el === dock || el.hasAttribute('data-group')) return
    const g = groupOf(el)
    if (g) el.setAttribute('data-group', g)
    else el.setAttribute('data-group', 'any')
    el.classList.toggle('dock-hidden', g !== null && g !== active)
  }
  const apply = () => {
    for (const el of side.children) {
      const g = el.getAttribute('data-group')
      el.classList.toggle('dock-hidden', g !== null && g !== 'any' && g !== active)
    }
    for (const b of buttons) {
      const on = b.dataset.tab === active
      b.setAttribute('aria-selected', String(on))
      b.tabIndex = on ? 0 : -1
    }
    hint.textContent = TABS.find((t) => t.id === active)?.hint ?? ''
    hint.setAttribute('aria-labelledby', `dock-tab-${active}`)
  }
  const select = (tab: Tab, focus = false) => {
    active = tab
    apply()
    if (focus) buttons.find((b) => b.dataset.tab === tab)?.focus()
  }

  for (const b of buttons) {
    b.addEventListener('click', () => select(b.dataset.tab as Tab))
    b.addEventListener('keydown', (e) => {
      const i = buttons.indexOf(b)
      const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
      if (!step) return
      e.preventDefault()
      const next = buttons[(i + step + buttons.length) % buttons.length]
      if (next) select(next.dataset.tab as Tab, true)
    })
  }

  // Panels arrive late (benchmark, zones) or on demand (weather, site report): sort each as it lands.
  new MutationObserver((records) => {
    for (const r of records) for (const n of r.addedNodes) if (n instanceof HTMLElement) tag(n)
  }).observe(side, { childList: true })
  for (const el of side.children) tag(el)
  side.prepend(dock)
  select(active)
}
