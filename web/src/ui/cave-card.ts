/** Evidence card for one cave candidate: what the catalogue says, and what nobody knows yet. */
import { type Cave, type CaveDoc, PRIORITY_TEXT } from '../core/caves'
import { distanceKm } from '../core/site-report'

const UNKNOWN = 'Unknown: never measured'

export function renderCaveCard(
  parent: HTMLElement,
  cave: Cave,
  doc: CaveDoc,
  sites: ReadonlyArray<{ name: string; lon: number; lat: number }>,
): HTMLElement {
  parent.querySelector('.cave-card')?.remove()
  const card = document.createElement('section')
  card.className = 'panel activity cave-card'
  card.setAttribute('aria-labelledby', 'cave-title')
  card.innerHTML = `
    <div class="wx-header">
      <h2 id="cave-title"></h2>
      <button type="button" class="wx-close" data-act="close">Close</button>
    </div>
    <p class="wx-source">Cave entrance candidate · USGS catalogue</p>
    <dl class="wx-tiles activity-rows"></dl>
    <p class="wx-source cave-source"></p>`
  ;(card.querySelector('h2') as HTMLElement).textContent = `Candidate ${cave.id}`
  const fmt = (v: number, pos: string, neg: string) =>
    `${Math.abs(v).toFixed(3)}° ${v < 0 ? neg : pos}`
  const apc =
    cave.apcDiameterM || cave.apcDepthM
      ? `${cave.apcDiameterM ?? '?'} m across, ${cave.apcDepthM ?? '?'} m deep`
      : undefined
  const rows: Array<[string, string | undefined]> = [
    ['Type', `${doc.types[cave.type] ?? 'Unlisted type'} (${cave.type})`],
    ['Targeting', PRIORITY_TEXT[cave.priority]],
    ['Position', `${fmt(cave.lat, 'N', 'S')}, ${fmt(cave.lon, 'E', 'W')}`],
    ['Pit size', apc],
    ['Catalogue note', cave.comment || undefined],
    ...sites.map((s): [string, string] => [
      `From ${s.name}`,
      `${Math.round(distanceKm(s.lon, s.lat, cave.lon, cave.lat)).toLocaleString('en-US')} km`,
    ]),
    ['Interior size', UNKNOWN],
    ['Roof thickness', UNKNOWN],
    ['Radiation shielding', UNKNOWN],
  ]
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
  const source = card.querySelector('.cave-source') as HTMLElement
  const link = document.createElement('a')
  link.href = doc.url
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  link.textContent = 'Source'
  source.append(`${doc.source}. ${doc.license}. `, link)
  card.querySelector('[data-act="close"]')?.addEventListener('click', () => card.remove())
  parent.prepend(card)
  ;(card.querySelector('[data-act="close"]') as HTMLButtonElement).focus()
  return card
}
