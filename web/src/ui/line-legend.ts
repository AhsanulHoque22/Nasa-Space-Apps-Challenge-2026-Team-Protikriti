/** A small key for the route lines, listing only the lines that are on the screen right now. */
import type { Cartesian3, Viewer } from 'cesium'

export type LegendLine = { label: string; colour: string; dashed?: boolean }

export type LineLegend = {
  /** Show (or update) a line in the key; it appears while any of its points is on screen. */
  set(key: string, line: LegendLine, points: readonly Cartesian3[]): void
  /** The line is gone from the map. */
  remove(key: string): void
}

const SAMPLES = 24 // points tested per line: enough to tell "on screen" without a per-frame cost
const ORDER = ['route', 'stops', 'baseline', 'haul']

export function createLineLegend(viewer: Viewer): LineLegend {
  const root = document.createElement('aside')
  root.className = 'panel line-legend'
  root.setAttribute('aria-label', 'Map lines')
  root.hidden = true
  const list = document.createElement('ul')
  root.append(list)
  document.body.append(root)
  const lines = new Map<string, { line: LegendLine; points: Cartesian3[] }>()

  const onScreen = (points: readonly Cartesian3[]): boolean => {
    const { clientWidth: w, clientHeight: h } = viewer.canvas
    const step = Math.max(1, Math.floor(points.length / SAMPLES))
    for (let i = 0; i < points.length; i += step) {
      const p = points[i]
      const xy = p && viewer.scene.cartesianToCanvasCoordinates(p)
      if (xy && xy.x >= 0 && xy.x <= w && xy.y >= 0 && xy.y <= h) return true
    }
    return false
  }

  const refresh = () => {
    const shown = [...lines.entries()]
      .filter(([, v]) => onScreen(v.points))
      .sort((a, b) => ORDER.indexOf(a[0]) - ORDER.indexOf(b[0]))
    list.replaceChildren(
      ...shown.map(([, { line }]) => {
        const item = document.createElement('li')
        const swatch = document.createElement('i')
        swatch.setAttribute('aria-hidden', 'true')
        swatch.className = line.dashed ? 'dashed' : ''
        swatch.style.setProperty('--line', line.colour)
        item.append(swatch, line.label)
        return item
      }),
    )
    root.hidden = shown.length === 0
  }

  let queued = false
  const soon = () => {
    if (queued) return
    queued = true
    requestAnimationFrame(() => {
      queued = false
      refresh()
    })
  }
  viewer.camera.percentageChanged = 0.02
  viewer.camera.changed.addEventListener(soon)
  viewer.camera.moveEnd.addEventListener(soon)

  return {
    set(key, line, points) {
      lines.set(key, { line, points: [...points] })
      soon()
    },
    remove(key) {
      lines.delete(key)
      soon()
    },
  }
}
