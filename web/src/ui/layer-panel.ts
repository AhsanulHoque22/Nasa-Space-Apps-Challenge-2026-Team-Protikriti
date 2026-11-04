/** Layer panel: native checkboxes in a disclosure, keyboard operable by default. */
import type { LayerId, LayerToggles } from '../map/layers'
import { SWATCHES } from './legend'
import { PROVENANCE, type Provenance } from './provenance'

export type LayerItem = {
  id: LayerId
  group: string
  label: string
  detail: string
  /** What the layer does, in plain words. Figures stay in `detail`, so they live in one place. */
  what: string
  visible: boolean
}

export const LAYER_ITEMS: LayerItem[] = [
  {
    id: 'imagery',
    group: 'Surface',
    label: 'HiRISE imagery',
    detail: 'MRO · every released strip · 17 site mosaics',
    what: 'Lays real orbital photographs over the ground, sharp enough to pick out boulders wherever HiRISE has imaged.',
    visible: true,
  },
  {
    id: 'molaShade',
    group: 'Surface',
    label: 'Elevation (colour)',
    detail: 'MGS MOLA · 463 m/px · global',
    what: 'Colours the planet by height, so basins, volcanoes and high ground stand out at a glance.',
    visible: false,
  },
  {
    id: 'slopeHazard',
    group: 'Surface',
    label: 'Slope hazard',
    detail: 'Steeper than 15° · CTX DEM',
    what: 'Marks ground too steep to cross safely on foot or by rover.',
    visible: true,
  },
  {
    id: 'thermal',
    group: 'Surface',
    label: 'Ground firmness',
    detail: 'THEMIS thermal inertia · 100 m · sites',
    what: 'Shows how well the ground holds heat, which hints at firmness: loose dust scores low, firm or rocky ground scores high.',
    visible: false,
  },
  {
    id: 'crism',
    group: 'Surface',
    label: 'Chemical hazard',
    detail: 'CRISM mineralogy · Salvatore et al. 2021 · Jezero',
    what: 'Colours the minerals around Jezero by how hazardous their chemistry is, from safe basalt to chloride and sulfate salts.',
    visible: false,
  },
  {
    id: 'roughness',
    group: 'Surface',
    label: 'Surface roughness',
    detail: 'MGS MOLA · global',
    what: 'Shows how bumpy the terrain is over long distances. Rougher ground is harder to land on and to cross.',
    visible: false,
  },
  {
    id: 'tesDust',
    group: 'Composition',
    label: 'Dust cover',
    detail: 'MGS TES dust index · global',
    what: 'Shows where fine dust blankets the surface and where it is thinner, leaving more rock exposed.',
    visible: false,
  },
  {
    id: 'traverses',
    group: 'Missions',
    label: 'Rover traverses',
    detail: 'Perseverance · Curiosity',
    what: 'Draws the routes that Perseverance and Curiosity actually drove.',
    visible: true,
  },
  {
    id: 'landingSites',
    group: 'Missions',
    label: 'Landing sites',
    detail: '16 landers, 1971–2021',
    what: 'Marks where landers and rovers have touched down on Mars.',
    visible: true,
  },
  {
    id: 'caves',
    group: 'Human exploration',
    label: 'Cave candidates',
    detail: 'USGS catalogue · 1,062 · interiors unknown',
    what: 'Marks pits that may open into caves, which could shelter a crew from radiation. No one has seen inside them.',
    visible: false,
  },
  {
    id: 'zones',
    group: 'Human exploration',
    label: 'Exploration zones',
    detail: 'NASA 2015 workshop · 30',
    what: "Marks the areas proposed at NASA's workshop as places for the first human crews to land and explore.",
    visible: true,
  },
  {
    id: 'names',
    group: 'Reference',
    label: 'Named features',
    detail: 'IAU gazetteer · 2,052',
    what: 'Labels craters, mountains and valleys with their official names.',
    visible: true,
  },
  {
    id: 'graticule',
    group: 'Reference',
    label: 'Lat / lon grid',
    detail: '10° planetocentric',
    what: 'Draws a latitude and longitude grid, so you can read positions off the map.',
    visible: false,
  },
]

const INFO_ICON =
  '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10 9v5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="10" cy="6" r="1.2" fill="currentColor"/></svg>'

/** The "where does this come from" disclosure for one layer row. */
function provenanceDrawer(id: string, what: string, p: Provenance): HTMLElement {
  const dl = document.createElement('dl')
  dl.className = 'provenance'
  dl.id = `provenance-${id}`
  dl.hidden = true
  const rows: Array<[string, string]> = [
    ['What it does', what],
    ['Mission / instrument', p.mission],
    ['Product', p.product],
    ['Coordinates', p.crs],
    ['Vertical datum', p.datum],
  ]
  for (const [label, value] of rows) {
    const row = document.createElement('div')
    const dt = document.createElement('dt')
    const dd = document.createElement('dd')
    dt.textContent = label
    dd.textContent = value
    row.append(dt, dd)
    dl.append(row)
  }
  // The checkbox is described by these words, and touch screens read them here: they have no hover.
  const whatText = dl.querySelector('dd')
  if (whatText) whatText.id = `layer-what-${id}`
  const link = document.createElement('a')
  link.href = p.url
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  link.textContent = 'Source page'
  const hint = document.createElement('span')
  hint.className = 'visually-hidden'
  hint.textContent = ' (opens in a new tab)'
  link.append(hint)
  const last = document.createElement('div')
  last.append(link)
  dl.append(last)
  return dl
}

const TIP_GAP_PX = 12 // room for the box's pointer
const TIP_MARGIN_PX = 8
const TIP_CLOSE_DELAY_MS = 120 // long enough to cross the gap between a row and its box

/**
 * The box that says what a layer does. It lives on the body because the panel clips its own
 * scrolling content. WCAG 1.4.13: the pointer can move onto it, and Escape dismisses it.
 */
function createLayerTip(panel: HTMLElement): {
  show: (row: HTMLElement, item: LayerItem) => void
  hide: () => void
  hideSoon: () => void
} {
  const tip = document.createElement('div')
  tip.className = 'layer-tip'
  tip.setAttribute('role', 'tooltip')
  tip.hidden = true
  const name = document.createElement('strong')
  const text = document.createElement('span')
  tip.append(name, text)
  document.body.append(tip)
  let closing = 0
  const hide = () => {
    clearTimeout(closing)
    tip.hidden = true
  }
  const hideSoon = () => {
    clearTimeout(closing)
    closing = window.setTimeout(hide, TIP_CLOSE_DELAY_MS)
  }
  tip.addEventListener('pointerenter', () => clearTimeout(closing))
  tip.addEventListener('pointerleave', hideSoon)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hide()
  })
  return {
    show: (row, item) => {
      clearTimeout(closing)
      name.textContent = item.label
      text.textContent = item.what
      tip.hidden = false
      const lowest = window.innerHeight - tip.offsetHeight - TIP_MARGIN_PX
      const top = Math.max(TIP_MARGIN_PX, Math.min(row.getBoundingClientRect().top, lowest))
      tip.style.left = `${panel.getBoundingClientRect().right + TIP_GAP_PX}px`
      tip.style.top = `${top}px`
    },
    hide,
    hideSoon,
  }
}

/** Builds the panel; `initial` overrides a layer's default visibility. Returns a way to switch a layer on or off later. */
export function renderLayerPanel(
  parent: HTMLElement,
  toggles: LayerToggles,
  initial: Partial<Record<LayerId, boolean>> = {},
): (id: LayerId, visible: boolean) => void {
  const boxes = new Map<LayerId, HTMLInputElement>()
  const panel = document.createElement('details')
  panel.className = 'panel layers'
  panel.open = window.matchMedia('(min-width: 720px)').matches
  panel.innerHTML = `<summary><span>Layers</span></summary>`
  const MODE_GROUPS: Record<string, string> = {
    Surface: 'plan science',
    Composition: 'explore science',
    Missions: 'explore',
    'Human exploration': 'science explore',
    Reference: 'any',
  }

  const tip = createLayerTip(panel)
  const list = document.createElement('ul')
  list.className = 'layer-list'
  let group = ''
  for (const item of LAYER_ITEMS) {
    if (item.group !== group) {
      group = item.group
      const heading = document.createElement('li')
      heading.className = 'layer-group'
      heading.setAttribute('role', 'presentation')
      heading.setAttribute('data-mode-group', MODE_GROUPS[group] ?? 'any')
      heading.textContent = group
      list.append(heading)
    }
    const visible = initial[item.id] ?? item.visible
    const li = document.createElement('li')
    li.setAttribute('data-mode-group', MODE_GROUPS[item.group] ?? 'any')
    li.innerHTML = `
      <label class="layer">
        <input type="checkbox" ${visible ? 'checked' : ''} />
        ${SWATCHES[item.id]}
        <span class="layer-text"><span class="layer-name">${item.label}</span>
        <span class="layer-detail">${item.detail}</span></span>
      </label>`
    const drawer = provenanceDrawer(item.id, item.what, PROVENANCE[item.id])
    const info = document.createElement('button')
    info.type = 'button'
    info.className = 'layer-info'
    info.setAttribute('aria-label', `Data source for ${item.label}`)
    info.setAttribute('aria-expanded', 'false')
    info.setAttribute('aria-controls', drawer.id)
    info.innerHTML = INFO_ICON
    info.addEventListener('click', () => {
      drawer.hidden = !drawer.hidden
      info.setAttribute('aria-expanded', String(!drawer.hidden))
    })
    li.append(info, drawer)
    li.addEventListener('pointerenter', () => tip.show(li, item))
    li.addEventListener('pointerleave', tip.hideSoon)
    li.addEventListener('focusin', () => tip.show(li, item))
    li.addEventListener('focusout', tip.hide)
    const input = li.querySelector('input')
    input?.setAttribute('aria-describedby', `layer-what-${item.id}`)
    input?.addEventListener('change', () => toggles[item.id](input.checked))
    if (input) boxes.set(item.id, input)
    toggles[item.id](visible)
    list.append(li)
  }
  panel.append(list)
  parent.append(panel)
  return (id, visible) => {
    const box = boxes.get(id)
    if (box) box.checked = visible
    toggles[id](visible)
  }
}
