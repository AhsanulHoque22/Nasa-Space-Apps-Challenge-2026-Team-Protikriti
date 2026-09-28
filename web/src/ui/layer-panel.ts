/** Layer panel: native checkboxes in a disclosure, keyboard operable by default. */
import type { LayerId, LayerToggles } from '../map/layers'
import { SWATCHES } from './legend'

export type LayerItem = { id: LayerId; label: string; detail: string; visible: boolean }

export const LAYER_ITEMS: LayerItem[] = [
  { id: 'imagery', label: 'HiRISE imagery', detail: 'MRO · 25 cm/px · Jezero', visible: true },
  { id: 'slopeHazard', label: 'Slope hazard', detail: 'Steeper than 15° · CTX DEM', visible: true },
  { id: 'traverses', label: 'Rover traverses', detail: 'Perseverance · Curiosity', visible: true },
  { id: 'landingSites', label: 'Landing sites', detail: '16 landers, 1971–2021', visible: true },
  { id: 'zones', label: 'Human exploration zones', detail: 'NASA 2015 workshop', visible: true },
  { id: 'names', label: 'Named features', detail: 'IAU gazetteer · 2,052', visible: true },
  { id: 'graticule', label: 'Lat / lon grid', detail: '10° planetocentric', visible: false },
]

export function renderLayerPanel(parent: HTMLElement, toggles: LayerToggles): void {
  const panel = document.createElement('details')
  panel.className = 'panel layers'
  panel.open = window.matchMedia('(min-width: 720px)').matches
  panel.innerHTML = `<summary><span>Layers</span></summary>`
  const list = document.createElement('ul')
  list.className = 'layer-list'
  for (const item of LAYER_ITEMS) {
    const li = document.createElement('li')
    li.innerHTML = `
      <label class="layer">
        <input type="checkbox" ${item.visible ? 'checked' : ''} />
        ${SWATCHES[item.id]}
        <span class="layer-text"><span class="layer-name">${item.label}</span>
        <span class="layer-detail">${item.detail}</span></span>
      </label>`
    const input = li.querySelector('input')
    input?.addEventListener('change', () => toggles[item.id](input.checked))
    toggles[item.id](item.visible)
    list.append(li)
  }
  panel.append(list)
  parent.append(panel)
}
