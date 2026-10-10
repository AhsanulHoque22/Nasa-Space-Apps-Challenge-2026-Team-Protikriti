/** Street View stops: every localized rover position, clickable when zoomed in. */
import {
  type Billboard,
  BillboardCollection,
  Cartesian2,
  Cartesian3,
  Color,
  DistanceDisplayCondition,
  type Label,
  LabelCollection,
  LabelStyle,
  NearFarScalar,
  VerticalOrigin,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  type Viewer,
} from 'cesium'
import { type Stop, recallVisit } from '../core/streetview'
import { LAYER_STYLE } from './layers'
import { MARS_SPHERE } from './mars'
import { type Clickable, addClickables, pickedId } from './picking'
import type { Rover } from './raw-images'

// Visible from a whole-crater view; shrunk with distance so the path still reads as a line.
const VISIBLE_BELOW_M = 1_500_000
const SCALE_BY_DISTANCE = new NearFarScalar(20_000, 1, 1_500_000, 0.45)
const DOT_PX = 14

function dot(fill: string): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = c.height = DOT_PX
  const g = c.getContext('2d')
  if (!g) return c
  g.beginPath()
  g.arc(DOT_PX / 2, DOT_PX / 2, DOT_PX / 2 - 1.5, 0, Math.PI * 2)
  g.fillStyle = fill
  g.fill()
  g.lineWidth = 1.5
  g.strokeStyle = '#05070C'
  g.stroke()
  return c
}

const POINTER_W = 34
const POINTER_H = 46
const POINTER_VISIBLE_M = 30_000_000 // from the whole planet down to the ground
const POINTER_LABEL_M = 1_500_000

/** A map pin, drawn once: a filled teardrop with a white ring, in the rover's colour. */
function pin(fill: string): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = POINTER_W
  c.height = POINTER_H
  const g = c.getContext('2d')
  if (!g) return c
  const r = POINTER_W / 2 - 3
  const cx = POINTER_W / 2
  const cy = r + 3
  g.beginPath()
  g.moveTo(cx, POINTER_H - 2)
  g.bezierCurveTo(cx - r * 1.6, cy + r * 0.9, cx - r, cy - r * 0.2, cx - r, cy)
  g.arc(cx, cy, r, Math.PI, 0)
  g.bezierCurveTo(cx + r, cy - r * 0.2, cx + r * 1.6, cy + r * 0.9, cx, POINTER_H - 2)
  g.closePath()
  g.fillStyle = fill
  g.fill()
  g.lineWidth = 2.5
  g.strokeStyle = '#FFFFFF'
  g.stroke()
  g.beginPath()
  g.arc(cx, cy, r * 0.38, 0, Math.PI * 2)
  g.fillStyle = '#05070C'
  g.fill()
  return c
}

export type StopsByRover = Record<Rover, Stop[]>

/**
 * `surfaceM` is the rendered ground height (terrain height x vertical exaggeration). Stops are
 * placed on it directly: CLAMP_TO_GROUND left most of the ~2,000 billboards at the datum, km
 * above the terrain, so they drifted off the draped traverse line in oblique views.
 */
export async function addStreetViewStops(
  viewer: Viewer,
  surfaceM: (lon: number, lat: number) => number,
  onOpen: (rover: Rover, index: number) => void,
): Promise<{
  stops: StopsByRover
  setVisible: (v: boolean) => void
  /** Move a rover's last-visited pointer to this stop. */
  markVisited: (rover: Rover, index: number) => void
  hideForExplore: (on: boolean) => void
}> {
  const load = async (rover: Rover): Promise<Stop[]> => {
    const response = await fetch(`data/stops/${rover}.json`)
    if (!response.ok) throw new Error(`stops/${rover}.json: HTTP ${response.status}`)
    return (await response.json()) as Stop[]
  }
  const stops: StopsByRover = { m20: await load('m20'), msl: await load('msl') }
  const billboards = new BillboardCollection({ scene: viewer.scene })
  const images = { m20: dot(LAYER_STYLE.perseverance), msl: dot(LAYER_STYLE.curiosity) }
  for (const rover of ['m20', 'msl'] as const) {
    stops[rover].forEach((s, i) => {
      const position = Cartesian3.fromDegrees(s.lon, s.lat, surfaceM(s.lon, s.lat), MARS_SPHERE)
      billboards.add({
        id: `stop:${rover}:${i}`,
        position,
        image: images[rover],
        scaleByDistance: SCALE_BY_DISTANCE,
        distanceDisplayCondition: new DistanceDisplayCondition(0, VISIBLE_BELOW_M),
        // Coarse far tiles can sit above the true ground; don't let them bury the dots.
        disableDepthTestDistance: VISIBLE_BELOW_M,
      })
      addClickables([
        {
          id: `stop:${rover}:${i}`,
          position,
          shown: () =>
            billboards.show &&
            Cartesian3.distance(viewer.camera.positionWC, position) < VISIBLE_BELOW_M,
        },
      ])
    })
  }
  viewer.scene.primitives.add(billboards)

  // A pointer at the stop each rover's Street View was last at, kept across reloads. It shows once
  // there is a visit to remember, and clicking it reopens that stop.
  const pointers = new BillboardCollection({ scene: viewer.scene })
  const pointerLabels = new LabelCollection({ scene: viewer.scene })
  const pins = { m20: pin(LAYER_STYLE.perseverance), msl: pin(LAYER_STYLE.curiosity) }
  const marks = {} as Record<
    Rover,
    { billboard: Billboard; label: Label; click: Clickable } | undefined
  >
  const markVisited = (rover: Rover, index: number) => {
    const stop = stops[rover][index]
    if (!stop) return
    const position = Cartesian3.fromDegrees(
      stop.lon,
      stop.lat,
      surfaceM(stop.lon, stop.lat),
      MARS_SPHERE,
    )
    const id = `stop:${rover}:${index}` // clicking opens that stop in Street View
    const text = `${rover === 'm20' ? 'Perseverance' : 'Curiosity'} · last visited, Sol ${stop.sol}`
    const mark = marks[rover]
    if (mark) {
      mark.billboard.position = position
      mark.billboard.id = id
      mark.label.position = position
      mark.label.text = text
      mark.click.id = id
      mark.click.position = position
    } else {
      const billboard = pointers.add({
        id,
        position,
        image: pins[rover],
        verticalOrigin: VerticalOrigin.BOTTOM,
        scaleByDistance: new NearFarScalar(20_000, 1, 8_000_000, 0.7),
        distanceDisplayCondition: new DistanceDisplayCondition(0, POINTER_VISIBLE_M),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      })
      const label = pointerLabels.add({
        position,
        text,
        font: '700 13px system-ui, sans-serif',
        fillColor: Color.WHITE,
        outlineColor: Color.fromCssColorString('#05070C'),
        outlineWidth: 3,
        style: LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: VerticalOrigin.BOTTOM,
        pixelOffset: new Cartesian2(0, -POINTER_H - 4),
        distanceDisplayCondition: new DistanceDisplayCondition(0, POINTER_LABEL_M),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      })
      const click: Clickable = {
        id,
        position,
        shown: () =>
          pointers.show &&
          Cartesian3.distance(viewer.camera.positionWC, click.position) < POINTER_VISIBLE_M,
      }
      addClickables([click])
      marks[rover] = { billboard, label, click }
    }
    viewer.scene.requestRender()
  }
  for (const rover of ['m20', 'msl'] as const) {
    try {
      const index = recallVisit(localStorage, rover, stops[rover])
      if (index >= 0) markVisited(rover, index)
    } catch {
      // storage blocked: nothing to bring back
    }
  }
  viewer.scene.primitives.add(pointers)
  viewer.scene.primitives.add(pointerLabels)
  new ScreenSpaceEventHandler(viewer.scene.canvas).setInputAction(
    (click: ScreenSpaceEventHandler.PositionedEvent) => {
      const match = /^stop:(m20|msl):(\d+)$/.exec(pickedId(viewer, click.position) ?? '')
      if (match) onOpen(match[1] as Rover, Number(match[2]))
    },
    ScreenSpaceEventType.LEFT_CLICK,
  )
  let wasShowing = true
  return {
    stops,
    markVisited,
    setVisible: (v) => {
      billboards.show = v
      viewer.scene.requestRender()
    },
    hideForExplore: (on) => {
      if (on) wasShowing = billboards.show
      billboards.show = on ? false : wasShowing
      pointers.show = !on // the pointers stay on the map in every view but the on-foot one
      pointerLabels.show = !on
    },
  }
}
