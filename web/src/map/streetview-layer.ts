/** Street View stops: every localized rover position, clickable when zoomed in. */
import {
  BillboardCollection,
  Cartesian3,
  DistanceDisplayCondition,
  NearFarScalar,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  type Viewer,
} from 'cesium'
import type { Stop } from '../core/streetview'
import { LAYER_STYLE } from './layers'
import { MARS_SPHERE } from './mars'
import { addClickables, pickedId } from './picking'
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
    setVisible: (v) => {
      billboards.show = v
      viewer.scene.requestRender()
    },
    hideForExplore: (on) => {
      if (on) wasShowing = billboards.show
      billboards.show = on ? false : wasShowing
    },
  }
}
