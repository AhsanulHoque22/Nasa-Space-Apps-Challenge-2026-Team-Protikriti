/** Story card for a rover science activity, with a jump into Street View at that moment. */
import type { Activity } from '../map/activities-layer'

export function renderActivityCard(
  parent: HTMLElement,
  a: Activity,
  actions: { onStreetView?: () => void; onClose: () => void },
): HTMLElement {
  parent.querySelector('.activity')?.remove()
  const card = document.createElement('section')
  card.className = 'panel activity'
  card.setAttribute('aria-labelledby', 'activity-title')
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
    <div class="wx-header">
      <h2 id="activity-title"></h2>
      <button type="button" class="wx-close" data-act="close">Close</button>
    </div>
    <p class="wx-source">Perseverance rock sample · official NASA record</p>
    <figure class="activity-figure" hidden><img alt="" loading="lazy" referrerpolicy="no-referrer"/><figcaption>NASA/JPL-Caltech</figcaption></figure>
    <dl class="wx-tiles activity-rows"></dl>
    <div class="route-actions"><button type="button" data-act="sv">Open Street View here</button></div>`
  ;(card.querySelector('h2') as HTMLElement).textContent = `Sample ${a.number} · ${a.name}`
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
  if (actions.onStreetView && a.sol !== null) sv.addEventListener('click', actions.onStreetView)
  else sv.parentElement?.remove()
  card.querySelector('[data-act="close"]')?.addEventListener('click', actions.onClose)
  parent.prepend(card)
  return card
}
