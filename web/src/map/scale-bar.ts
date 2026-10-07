/** A live scale bar, and an honest note that heights are drawn exaggerated. */
import { Cartesian2, Cartesian3, type Viewer } from 'cesium'
import { niceScale } from '../core/scale-bar'

const SAMPLE_PX = 100 // measure the ground between two points this far apart on screen
const MAX_BAR_PX = 120

export function installScaleBar(viewer: Viewer, parent: HTMLElement): void {
  const box = document.createElement('div')
  box.className = 'scale-bar'
  box.setAttribute('role', 'status')
  const bar = document.createElement('i')
  bar.setAttribute('aria-hidden', 'true')
  const label = document.createElement('span')
  const height = document.createElement('span')
  height.className = 'scale-height'
  box.append(bar, label, height)
  parent.append(box)

  const pick = (x: number, y: number) => {
    const ray = viewer.camera.getPickRay(new Cartesian2(x, y))
    return ray ? viewer.scene.globe.pick(ray, viewer.scene) : undefined
  }
  const update = () => {
    const canvas = viewer.scene.canvas
    const y = canvas.clientHeight * 0.75 // lower in the view, where the ground usually is
    const x = canvas.clientWidth / 2
    const a = pick(x - SAMPLE_PX / 2, y)
    const b = pick(x + SAMPLE_PX / 2, y)
    const scale = a && b ? niceScale(Cartesian3.distance(a, b) / SAMPLE_PX, MAX_BAR_PX) : null
    box.hidden = scale === null
    if (!scale) return
    bar.style.width = `${Math.round(scale.px)}px`
    label.textContent = scale.label
    const x2 = viewer.scene.verticalExaggeration
    height.textContent = x2 === 1 ? 'true scale' : `heights ×${x2}`
    box.title = `Scale measured across the lower middle of the view. ${
      x2 === 1 ? '' : `Heights are drawn ${x2} times taller than they are, so slopes look steeper.`
    }`
  }
  viewer.camera.percentageChanged = 0.05
  viewer.camera.changed.addEventListener(update)
  viewer.camera.moveEnd.addEventListener(update)
  update()
}
