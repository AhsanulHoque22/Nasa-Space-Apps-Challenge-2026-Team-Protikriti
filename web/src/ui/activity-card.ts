/** A rover sample's NASA record, for its window, with a jump into the 360 panorama at that moment. */
import { DELTA_FACTS } from '../core/delta-facts'
import type { Activity } from '../map/activities-layer'
import { sampleTitle } from './delta-card'
import { seeMore, stats } from './insight'

/** Figures about the sample worked out from the app's own data, and its neighbours. */
export type SampleContext = {
  /** Its place in NASA's list (1-based) and how many samples the list holds. */
  index: number
  total: number
  /** Ground elevation at the sample, metres, and the dataset it was read from. */
  elevation: { m: number; source: string } | null
  /** Straight-line distance from the landing site, km. */
  fromLandingKm: number | null
  /** Other samples within the nearby radius, nearest first, with their distance in metres. */
  nearby: Array<{ sample: Activity; m: number }>
  openSample: (a: Activity) => void
  sourceUrl: string
}

/** Two samples logged at the same rover waypoint share a position: call that the same spot. */
const SAME_SPOT_M = 5
const NASA_SOURCE = 'NASA Science, Mars Rock Samples (Perseverance)'

/** The sample's key figures, for the top of its window. */
export function sampleStats(c: SampleContext): HTMLElement {
  return stats([
    { value: `${c.index} of ${c.total}`, label: 'sample in the list' },
    c.elevation
      ? {
          value: `${Math.round(c.elevation.m).toLocaleString('en-US').replace('-', '−')} m`,
          label: 'ground elevation',
          title: `Elevation: ${c.elevation.source}`,
        }
      : { value: '—', label: 'ground elevation' },
    {
      value: c.fromLandingKm === null ? '—' : `${c.fromLandingKm.toFixed(1)} km`,
      label: 'from the landing site',
      title: 'Straight line from Octavia E. Butler Landing (rover stop, sol 13)',
    },
  ])
}

/** What the delta findings say about it, its neighbours and the record's source. */
export function sampleExtra(a: Activity, c: SampleContext): HTMLElement {
  const out: HTMLElement[] = []
  const facts = DELTA_FACTS.filter((f) => f.samples.includes(a.number))
  for (const f of facts) {
    const p = document.createElement('p')
    p.className = 'sample-fact'
    const b = document.createElement('b')
    b.textContent = `${f.title}. `
    p.append(b, f.text)
    out.push(p)
  }
  const extra = document.createElement('div')
  extra.className = 'sample-extra'
  if (out.length) {
    const lead = document.createElement('p')
    lead.className = 'sample-fact'
    lead.textContent = `Part of: ${facts.map((f) => f.title).join(' · ')}`
    extra.append(lead, seeMore(...out))
  }
  if (c.nearby.length) {
    const h = document.createElement('h3')
    h.className = 'sync-heading'
    h.textContent = 'Samples nearby'
    const list = document.createElement('div')
    list.className = 'delta-samples'
    for (const n of c.nearby) {
      const b = document.createElement('button')
      b.type = 'button'
      b.textContent = `${n.sample.number}. ${sampleTitle(n.sample)} · ${
        n.m < SAME_SPOT_M ? 'same spot' : `${Math.round(n.m)} m`
      }`
      b.addEventListener('click', () => c.openSample(n.sample))
      list.append(b)
    }
    extra.append(h, list)
  }
  const link = document.createElement('a')
  link.className = 'delta-source'
  link.href = c.sourceUrl
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  link.textContent = `Record: ${NASA_SOURCE}`
  extra.append(link)
  return extra
}

export function activityDetails(a: Activity, onPanorama?: () => void): HTMLElement {
  const card = document.createElement('section')
  card.className = 'activity'
  const rows: Array<[string, string | undefined]> = [
    [
      'Sealed',
      a.sol === null
        ? 'Sol not yet published'
        : `Sol ${a.sol}${a.dateSealed ? ` · ${a.dateSealed}` : ''}`,
    ],
    ['Type', a.sampleType],
    ['Rock', a.rockType],
    ['Feature', a.feature],
    ['Core length', a.height],
    ['Where now', a.location],
    ['Position', a.positionBasis],
  ]
  card.innerHTML = `
    <figure class="activity-figure" hidden><img alt="" loading="lazy" referrerpolicy="no-referrer"/><figcaption>NASA/JPL-Caltech</figcaption></figure>
    <dl class="wx-tiles activity-rows"></dl>
    <div class="route-actions"><button type="button" data-act="sv">Open the 360 panorama here</button></div>`
  const dl = card.querySelector('.activity-rows') as HTMLElement
  for (const [label, value] of rows) {
    if (!value) continue
    const div = document.createElement('div')
    const dt = document.createElement('dt')
    const dd = document.createElement('dd')
    dt.textContent = label
    dd.textContent = value
    div.append(dt, dd)
    dl.append(div)
  }
  if (a.image) {
    const figure = card.querySelector('.activity-figure') as HTMLElement
    const img = figure.querySelector('img') as HTMLImageElement
    img.src = a.image
    img.alt = `NASA image for sample ${a.number}, ${a.name}`
    figure.hidden = false
  }
  const sv = card.querySelector('[data-act="sv"]') as HTMLButtonElement
  if (onPanorama && a.sol !== null) sv.addEventListener('click', onPanorama)
  else sv.parentElement?.remove()
  return card
}
