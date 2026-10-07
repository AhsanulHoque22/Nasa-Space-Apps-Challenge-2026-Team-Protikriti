/** Jezero's delta beside the Jamuna at the same scale: a swipe, and the Jamuna through the years. */
import { type CompareDoc, parseCompare } from '../core/compare'

const DATA = 'data/compare/'
const SCALE_KM = 5

export function renderComparePanel(parent: HTMLElement): void {
  const panel = document.createElement('details')
  panel.className = 'panel dust compare'
  const summary = document.createElement('summary')
  summary.textContent = 'Jezero and the Jamuna, same scale'
  const body = document.createElement('div')
  panel.append(summary, body)
  parent.append(panel)

  const draw = (doc: CompareDoc) => {
    body.replaceChildren()
    const caveat = document.createElement('p')
    caveat.className = 'compare-caveat'
    caveat.setAttribute('role', 'note')
    caveat.textContent = doc.caveat
    const stage = document.createElement('div')
    stage.className = 'compare-stage'
    const earth = document.createElement('img')
    const mars = document.createElement('img')
    mars.className = 'compare-top'
    mars.src = DATA + doc.jezero.file
    mars.alt = `Jezero crater's western delta on Mars, ${doc.boxKm} km across`
    for (const img of [earth, mars]) {
      img.width = doc.px
      img.height = doc.px
      img.decoding = 'async'
    }
    const divider = document.createElement('i')
    divider.className = 'compare-divider'
    divider.setAttribute('aria-hidden', 'true')
    const tagL = document.createElement('span')
    tagL.className = 'compare-tag left'
    tagL.textContent = 'Jezero, Mars'
    const tagR = document.createElement('span')
    tagR.className = 'compare-tag right'
    const scale = document.createElement('span')
    scale.className = 'compare-scale'
    scale.style.width = `${(SCALE_KM / doc.boxKm) * 100}%`
    scale.textContent = `${SCALE_KM} km`
    stage.append(earth, mars, divider, tagL, tagR, scale)

    const controls = document.createElement('div')
    controls.className = 'zone-weights'
    const swipeLabel = document.createElement('label')
    const swipeText = document.createElement('span')
    swipeText.textContent = 'Swipe'
    const swipe = document.createElement('input')
    swipe.type = 'range'
    swipe.min = '0'
    swipe.max = '100'
    swipe.value = '50'
    const swipeOut = document.createElement('output')
    swipeLabel.append(swipeText, swipe, swipeOut)
    const yearLabel = document.createElement('label')
    const yearText = document.createElement('span')
    yearText.textContent = 'Jamuna year'
    const year = document.createElement('input')
    year.type = 'range'
    year.min = '0'
    year.max = String(doc.jamuna.scenes.length - 1)
    year.step = '1'
    year.value = year.max
    const yearOut = document.createElement('output')
    yearLabel.append(yearText, year, yearOut)
    controls.append(swipeLabel, yearLabel)

    const source = document.createElement('p')
    source.className = 'dust-note'

    const setSwipe = (pct: number) => {
      const p = Math.max(0, Math.min(100, pct))
      swipe.value = String(Math.round(p))
      mars.style.clipPath = `inset(0 ${100 - p}% 0 0)`
      divider.style.left = `${p}%`
      swipeOut.textContent = `${Math.round(p)}%`
      swipe.setAttribute(
        'aria-valuetext',
        `${Math.round(p)}% Jezero, ${100 - Math.round(p)}% Jamuna`,
      )
    }
    const setYear = () => {
      const s = doc.jamuna.scenes[Number(year.value)]
      if (!s) return
      earth.src = DATA + s.file
      earth.alt = `The Jamuna (Brahmaputra) near Sirajganj, Bangladesh, ${s.year}, ${doc.boxKm} km across`
      tagR.textContent = `Jamuna, Earth, ${s.year}`
      yearOut.textContent = String(s.year)
      year.setAttribute('aria-valuetext', String(s.year))
      source.textContent =
        `Both images ${doc.boxKm} km across (north up). Mars: ${doc.jezero.source}. ` +
        `Earth: ${s.source}. Dry-season scenes chosen for clear skies. Channels shift every year ` +
        `here; Jezero's delta has been dry for billions of years.`
    }
    swipe.addEventListener('input', () => setSwipe(Number(swipe.value)))
    year.addEventListener('input', setYear)
    // Drag across the picture as well as the slider (mouse, pen or touch).
    let dragging = false
    const fromPointer = (e: PointerEvent) => {
      const r = stage.getBoundingClientRect()
      setSwipe(((e.clientX - r.left) / r.width) * 100)
    }
    stage.addEventListener('pointerdown', (e) => {
      dragging = true
      stage.setPointerCapture(e.pointerId)
      fromPointer(e)
    })
    stage.addEventListener('pointermove', (e) => {
      if (dragging) fromPointer(e)
    })
    stage.addEventListener('pointerup', () => (dragging = false))
    stage.addEventListener('pointercancel', () => (dragging = false))
    setSwipe(50)
    setYear()
    body.append(caveat, stage, controls, source)
  }

  let loaded = false
  panel.addEventListener('toggle', () => {
    if (!panel.open || loaded) return
    loaded = true
    body.textContent = 'Loading the images…'
    fetch(DATA + 'compare.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status} (run make data)`)
        return r.json()
      })
      .then((raw: unknown) => draw(parseCompare(raw)))
      .catch((error: unknown) => {
        loaded = false // let the next open try again
        body.textContent = `Comparison not available: ${String(error)}`
      })
  })
}
