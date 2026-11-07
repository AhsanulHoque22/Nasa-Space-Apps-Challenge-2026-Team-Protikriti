/** Workbench: a fixed trigger bar (always visible) + a floating panel card (opens on click). */
import { heroKPIs, onHeroChange } from './hero-state'

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

// First match wins. Panels that match nothing stay visible on every tab.
const GROUPS: [Tab, string[]][] = [
  ['plan', ['quest', 'route', 'sync', 'link']],
  ['explore', ['wx-panel', 'zones', 'delta', 'colony-panel', 'colony-summary']],
  ['science', ['geology', 'compare', 'scenario', 'dust', 'dose', 'benchmark']],
]

function groupOf(el: Element): Tab | null {
  for (const [tab, classes] of GROUPS) if (classes.some((c) => el.classList.contains(c))) return tab
  return null
}

export function renderDock(side: HTMLElement): void {
  // ── Trigger bar — always visible at top-right ─────────────────────────
  const trigger = document.createElement('div')
  trigger.className = 'dock-trigger'
  trigger.innerHTML = `<div class="dock-tabs" role="tablist" aria-label="Workbench">${TABS.map(
    (t) =>
      `<button type="button" role="tab" data-tab="${t.id}" aria-selected="false" tabindex="-1" title="${t.hint}">
        <svg viewBox="0 0 24 24" aria-hidden="true">${t.icon}</svg><span>${t.label}</span>
      </button>`,
  ).join('')}</div>`
  document.body.append(trigger)
  const tabButtons = [...trigger.querySelectorAll<HTMLButtonElement>('[role="tab"]')]

  // ── Card header — sits at the top of the floating side panel ─────────
  const cardHead = document.createElement('div')
  cardHead.className = 'dock-card-head'
  cardHead.innerHTML = `
    <span class="dock-card-title"></span>
    <button type="button" class="dock-close" aria-label="Close panel">
      <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16" fill="none"
           stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <path d="M18 6 6 18M6 6l12 12"/>
      </svg>
    </button>`
  const heroCard = document.createElement('div')
  heroCard.className = 'hero-card'
  heroCard.setAttribute('aria-hidden', 'true')
  const hint = document.createElement('p')
  hint.className = 'dock-hint'
  hint.id = 'dock-panel'
  side.prepend(hint, heroCard, cardHead)

  cardHead.querySelector<HTMLButtonElement>('.dock-close')?.addEventListener('click', close)

  // ── Panel group visibility ────────────────────────────────────────────
  let active: Tab = 'plan'

  const tag = (el: Element) => {
    if (el === cardHead || el === heroCard || el === hint || el.hasAttribute('data-group')) return
    const g = groupOf(el)
    if (g) el.setAttribute('data-group', g)
    else el.setAttribute('data-group', 'any')
    el.classList.toggle('dock-hidden', g !== null && g !== active)
  }

  const apply = () => {
    const open = !!document.body.dataset.panelOpen
    for (const el of side.children) {
      const g = el.getAttribute('data-group')
      el.classList.toggle('dock-hidden', g !== null && g !== 'any' && g !== active)
    }
    for (const b of tabButtons) {
      const on = b.dataset.tab === active && open
      b.setAttribute('aria-selected', String(on))
      b.tabIndex = b.dataset.tab === active ? 0 : -1
    }
    hint.textContent = TABS.find((t) => t.id === active)?.hint ?? ''
    const titleEl = cardHead.querySelector<HTMLElement>('.dock-card-title')
    if (titleEl) titleEl.textContent = TABS.find((t) => t.id === active)?.label ?? ''
  }

  // ── Hero KPIs ─────────────────────────────────────────────────────────
  type StatConfig = { val: () => string; label: string; tip: string }
  const HERO: Record<Tab, StatConfig[]> = {
    plan: [
      {
        val: () => heroKPIs().plan.verdict,
        label: 'Verdict',
        tip: 'GO if the planned walk stays inside the suit and slope limits.',
      },
      {
        val: () => heroKPIs().plan.dur,
        label: 'EVA time',
        tip: 'Time outside, from Tobler walking pace on Mars slopes.',
      },
      {
        val: () => heroKPIs().plan.dist,
        label: 'Distance',
        tip: 'Length of the planned Marswalk along the ground.',
      },
      {
        val: () => heroKPIs().plan.climb,
        label: 'Climb',
        tip: 'Total uphill height gained on the route.',
      },
    ],
    explore: [
      {
        val: () => heroKPIs().explore.temp,
        label: 'Air temp',
        tip: 'Air temperature now at the view centre, from the nearer rover station (MEDA or REMS) climatology.',
      },
      {
        val: () => heroKPIs().explore.pressure,
        label: 'Pressure',
        tip: 'Estimated air pressure from elevation: 636 Pa at the datum, scale height 11.1 km (NASA Mars Fact Sheet). Earth is about 101,000 Pa.',
      },
      {
        val: () => heroKPIs().explore.sky,
        label: 'Sky',
        tip: 'Dust opacity τ for the season: about 0.4 is clear, above 1.5 is a dusty sky (Lemmon et al.).',
      },
      {
        val: () => heroKPIs().explore.sol,
        label: 'Local time',
        tip: 'Local mean solar time at the view centre (Mars24).',
      },
    ],
    science: [
      {
        val: () => heroKPIs().science.unit,
        label: 'Dust',
        tip: 'Column dust opacity τ: how much sunlight the dust blocks. Solar power drops as it rises.',
      },
      {
        val: () => heroKPIs().science.radiation,
        label: 'Radiation',
        tip: 'Surface dose per sol measured by Curiosity RAD (Hassler et al. 2014).',
      },
      {
        val: () => heroKPIs().science.ice,
        label: 'Ice',
        tip: 'Shallow water ice within 1 m, from the SWIM 2.0 map.',
      },
      {
        val: () => heroKPIs().science.firmness,
        label: 'Firmness',
        tip: 'Ground firmness from THEMIS thermal inertia, ranked within this site.',
      },
    ],
  }
  const renderHero = (tab: Tab) => {
    heroCard.innerHTML = ''
    for (const cfg of HERO[tab]) {
      const stat = document.createElement('div')
      stat.className = 'hero-stat'
      stat.title = cfg.tip
      const val = document.createElement('span')
      val.className = 'hero-val'
      val.textContent = cfg.val()
      const label = document.createElement('span')
      label.className = 'hero-label'
      label.textContent = cfg.label
      stat.append(val, label)
      heroCard.append(stat)
    }
  }

  // ── Open / close ──────────────────────────────────────────────────────
  function close() {
    delete document.body.dataset.panelOpen
    apply()
  }

  const select = (tab: Tab, focus = false) => {
    const alreadyOpen = document.body.dataset.panelOpen && active === tab
    if (alreadyOpen) {
      close()
      return
    }
    active = tab
    document.body.dataset.mode = tab
    document.body.dataset.panelOpen = 'yes'
    apply()
    renderHero(tab)
    if (focus) tabButtons.find((b) => b.dataset.tab === tab)?.focus()
  }

  for (const b of tabButtons) {
    b.addEventListener('click', () => select(b.dataset.tab as Tab))
    b.addEventListener('keydown', (e) => {
      const i = tabButtons.indexOf(b)
      const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
      if (!step) return
      e.preventDefault()
      const next = tabButtons[(i + step + tabButtons.length) % tabButtons.length]
      if (next) select(next.dataset.tab as Tab, true)
    })
  }

  new MutationObserver((records) => {
    for (const r of records) for (const n of r.addedNodes) if (n instanceof HTMLElement) tag(n)
  }).observe(side, { childList: true })
  for (const el of side.children) tag(el)
  onHeroChange(() => renderHero(active))
  apply()
}
