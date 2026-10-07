/** Layer panel: native checkboxes in a disclosure, keyboard operable by default. */
import type { LayerId, LayerToggles } from '../map/layers'
import { SWATCHES } from './legend'
import { PROVENANCE, type Provenance } from './provenance'

export type LayerItem = {
  id: LayerId
  group: string
  label: string
  detail: string
  visible: boolean
}

export const LAYER_ITEMS: LayerItem[] = [
  {
    id: 'imagery',
    group: 'Surface',
    label: 'HiRISE imagery',
    detail: 'MRO · every released strip · 17 site mosaics',
    visible: true,
  },
  {
    id: 'molaShade',
    group: 'Surface',
    label: 'Elevation (colour)',
    detail: 'MGS MOLA · 463 m/px · global',
    visible: false,
  },
  {
    id: 'slopeHazard',
    group: 'Surface',
    label: 'Slope hazard',
    detail: 'Steeper than 15° · CTX DEM',
    visible: true,
  },
  {
    id: 'thermal',
    group: 'Surface',
    label: 'Ground firmness',
    detail: 'THEMIS thermal inertia · 100 m · sites',
    visible: false,
  },
  {
    id: 'roughness',
    group: 'Surface',
    label: 'Surface roughness',
    detail: 'MGS MOLA · global',
    visible: false,
  },
  {
    id: 'tesDust',
    group: 'Composition',
    label: 'Dust cover',
    detail: 'MGS TES dust index · global',
    visible: false,
  },
  {
    id: 'traverses',
    group: 'Missions',
    label: 'Rover traverses',
    detail: 'Perseverance · Curiosity',
    visible: true,
  },
  {
    id: 'landingSites',
    group: 'Missions',
    label: 'Landing sites',
    detail: '16 landers, 1971–2021',
    visible: true,
  },
  {
    id: 'zones',
    group: 'Human exploration',
    label: 'Exploration zones',
    detail: 'NASA 2015 workshop · 30',
    visible: true,
  },
  {
    id: 'names',
    group: 'Reference',
    label: 'Named features',
    detail: 'IAU gazetteer · 2,052',
    visible: true,
  },
  {
    id: 'graticule',
    group: 'Reference',
    label: 'Lat / lon grid',
    detail: '10° planetocentric',
    visible: false,
  },
]

const INFO_ICON =
  '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10 9v5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="10" cy="6" r="1.2" fill="currentColor"/></svg>'

/** The "where does this come from" disclosure for one layer row. */
function provenanceDrawer(id: string, p: Provenance): HTMLElement {
  const dl = document.createElement('dl')
  dl.className = 'provenance'
  dl.id = `provenance-${id}`
  dl.hidden = true
  const rows: Array<[string, string]> = [
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

export function renderLayerPanel(parent: HTMLElement, toggles: LayerToggles): void {
  const panel = document.createElement('details')
  panel.className = 'panel layers'
  panel.open = window.matchMedia('(min-width: 720px)').matches
  panel.innerHTML = `<summary><span>Layers</span></summary>`
  const list = document.createElement('ul')
  list.className = 'layer-list'
  let group = ''
  for (const item of LAYER_ITEMS) {
    if (item.group !== group) {
      group = item.group
      const heading = document.createElement('li')
      heading.className = 'layer-group'
      heading.setAttribute('role', 'presentation')
      heading.textContent = group
      list.append(heading)
    }
    const li = document.createElement('li')
    li.innerHTML = `
      <label class="layer">
        <input type="checkbox" ${item.visible ? 'checked' : ''} />
        ${SWATCHES[item.id]}
        <span class="layer-text"><span class="layer-name">${item.label}</span>
        <span class="layer-detail">${item.detail}</span></span>
      </label>`
    const drawer = provenanceDrawer(item.id, PROVENANCE[item.id])
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
    const input = li.querySelector('input')
    input?.addEventListener('change', () => toggles[item.id](input.checked))
    toggles[item.id](item.visible)
    list.append(li)
  }
  panel.append(list)
  parent.append(panel)
}
