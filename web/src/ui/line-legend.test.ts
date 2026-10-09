// @vitest-environment happy-dom
import { Cartesian3, type Viewer } from 'cesium'
import { afterEach, describe, expect, it } from 'vitest'
import { createLineLegend } from './line-legend'

function fakeViewer(onScreen: (p: Cartesian3) => boolean) {
  const listeners: Array<() => void> = []
  return {
    viewer: {
      canvas: { clientWidth: 1000, clientHeight: 600 },
      scene: {
        cartesianToCanvasCoordinates: (p: Cartesian3) =>
          onScreen(p) ? { x: 500, y: 300 } : { x: -50, y: 300 },
      },
      camera: {
        percentageChanged: 0.5,
        changed: { addEventListener: (f: () => void) => listeners.push(f) },
        moveEnd: { addEventListener: (f: () => void) => listeners.push(f) },
      },
    } as unknown as Viewer,
    moved: () => listeners.forEach((f) => f()),
  }
}

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
const legend = () => document.querySelector<HTMLElement>('.line-legend')
const labels = () => [...document.querySelectorAll('.line-legend li')].map((li) => li.textContent)

afterEach(() => {
  document.body.innerHTML = ''
})

describe('line legend', () => {
  const points = [new Cartesian3(1, 0, 0), new Cartesian3(2, 0, 0)]

  it('stays hidden until a line is on the map', () => {
    createLineLegend(fakeViewer(() => true).viewer)
    expect(legend()?.hidden).toBe(true)
  })

  it('lists a line only while some of it is on screen', async () => {
    let visible = true
    const { viewer, moved } = fakeViewer(() => visible)
    const key = createLineLegend(viewer)
    key.set('route', { label: 'Planned route', colour: '#FC3D21' }, points)
    key.set('stops', { label: 'Link between stops', colour: '#5b8def' }, points)
    await frame()
    expect(legend()?.hidden).toBe(false)
    expect(labels()).toEqual(['Planned route', 'Link between stops'])
    visible = false
    moved() // the user panned the lines off the screen
    await frame()
    expect(legend()?.hidden).toBe(true)
  })

  it('drops a line once it is removed, keeping the others', async () => {
    const key = createLineLegend(fakeViewer(() => true).viewer)
    key.set('route', { label: 'Planned route', colour: '#FC3D21' }, points)
    key.set('stops', { label: 'Link between stops', colour: '#5b8def' }, points)
    key.remove('route')
    await frame()
    expect(labels()).toEqual(['Link between stops'])
  })
})
