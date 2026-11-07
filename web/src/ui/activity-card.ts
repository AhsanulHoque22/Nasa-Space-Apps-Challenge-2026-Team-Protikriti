/** A rover sample's NASA record, for its window, with a jump into the 360 panorama at that moment. */
import type { Activity } from '../map/activities-layer'

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
