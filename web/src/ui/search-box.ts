/** Place search: an ARIA combobox over IAU names, landing sites and exploration zones. */
import { type Place, type SearchIndex, buildIndex, search } from '../core/search'

type Collection = {
  features: Array<{ geometry: { coordinates: number[] }; properties: Record<string, unknown> }>
}

const KIND_LABEL: Record<Place['kind'], string> = {
  feature: 'Named feature',
  landing: 'Landing site',
  zone: 'Exploration zone',
  sample: 'Rock sample',
  stop: 'Rover stop',
}

async function loadCollection(url: string): Promise<Collection> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
  return (await response.json()) as Collection
}

/** Places from the layer files the map already ships (served from the HTTP cache). */
export async function loadPlaces(): Promise<Place[]> {
  const [names, landing, zones] = await Promise.all(
    ['names', 'landing_sites', 'exploration_zones'].map((n) =>
      loadCollection(`data/layers/${n}.geojson`),
    ),
  )
  const point = (f: Collection['features'][number]) => {
    const [lon = 0, lat = 0] = f.geometry.coordinates
    return { lon, lat }
  }
  return [
    ...names.features.map((f): Place => ({
      ...point(f),
      name: String(f.properties.name),
      kind: 'feature',
      detail: `${String(f.properties.type)}${f.properties.diameter_km ? ` · ${Math.round(Number(f.properties.diameter_km))} km` : ''}`,
      sizeKm: Number(f.properties.diameter_km) || 0,
    })),
    ...landing.features.map((f): Place => ({
      ...point(f),
      name: String(f.properties.mission),
      kind: 'landing',
      detail: `${String(f.properties.agency)} · ${String(f.properties.year)}${f.properties.status === 'crashed' ? ' · crash site' : ''}`,
      sizeKm: 20,
    })),
    ...zones.features.map((f): Place => ({
      ...point(f),
      name: String(f.properties.name),
      kind: 'zone',
      detail: 'Candidate human exploration zone (NASA 2015)',
      sizeKm: 200,
    })),
  ]
}

export function renderSearchBox(
  parent: HTMLElement,
  places: Place[],
  onPick: (p: Place) => void,
): void {
  const index: SearchIndex = buildIndex(places)
  const box = document.createElement('div')
  box.className = 'panel search'
  box.innerHTML = `
    <label class="visually-hidden" for="search-input">Search Mars</label>
    <svg class="search-icon" viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M13 13l4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
    <input id="search-input" type="search" role="combobox" autocomplete="off" spellcheck="false"
      placeholder="Search craters, landing sites, zones…" aria-expanded="false"
      aria-controls="search-results" aria-autocomplete="list" />
    <ul id="search-results" class="search-results" role="listbox" aria-label="Places" hidden></ul>`
  parent.append(box)
  const input = box.querySelector('input') as HTMLInputElement
  const list = box.querySelector('ul') as HTMLUListElement
  let results: Place[] = []
  let active = -1

  const render = () => {
    list.hidden = results.length === 0
    input.setAttribute('aria-expanded', String(!list.hidden))
    list.replaceChildren(
      ...results.map((p, i) => {
        const li = document.createElement('li')
        li.id = `search-option-${i}`
        li.setAttribute('role', 'option')
        li.setAttribute('aria-selected', String(i === active))
        const name = document.createElement('span')
        name.className = 'result-name'
        name.textContent = p.name // textContent: names come from data files
        const detail = document.createElement('span')
        detail.className = 'result-detail'
        detail.textContent = `${KIND_LABEL[p.kind]} · ${p.detail}`
        li.append(name, detail)
        li.addEventListener('mousedown', (e) => {
          e.preventDefault() // keep focus in the input
          choose(i)
        })
        return li
      }),
    )
    if (active >= 0) input.setAttribute('aria-activedescendant', `search-option-${active}`)
    else input.removeAttribute('aria-activedescendant')
  }

  const choose = (i: number) => {
    const place = results[i]
    if (!place) return
    input.value = place.name
    results = []
    active = -1
    render()
    onPick(place)
  }

  input.addEventListener('input', () => {
    results = search(index, input.value)
    active = results.length ? 0 : -1
    render()
  })
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!results.length) return
      e.preventDefault()
      const delta = e.key === 'ArrowDown' ? 1 : -1
      active = (active + delta + results.length) % results.length
      render()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(Math.max(active, 0))
    } else if (e.key === 'Escape') {
      input.value = ''
      results = []
      active = -1
      render()
    }
  })
  input.addEventListener('blur', () => {
    results = []
    render()
  })
}
