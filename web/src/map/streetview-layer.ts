/** Street View stops: every localized rover position, clickable when zoomed in. */
import {
  BillboardCollection,
  Cartesian3,
  DistanceDisplayCondition,
  HeightReference,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  type Viewer,
} from 'cesium'
import type { Stop } from '../core/streetview'
import { LAYER_STYLE } from './layers'
import { MARS_SPHERE } from './mars'
import { pickedId } from './picking'
import type { Rover } from './raw-images'

const VISIBLE_BELOW_M = 150_000 // like Street View's "pegman" level: only when zoomed in
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

export async function addStreetViewStops(
  viewer: Viewer,
  onOpen: (rover: Rover, index: number) => void,
): Promise<{ stops: StopsByRover; setVisible: (v: boolean) => void }> {
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
      billboards.add({
        id: `stop:${rover}:${i}`,
        position: Cartesian3.fromDegrees(s.lon, s.lat, 0, MARS_SPHERE),
        image: images[rover],
        heightReference: HeightReference.CLAMP_TO_GROUND,
        distanceDisplayCondition: new DistanceDisplayCondition(0, VISIBLE_BELOW_M),
        disableDepthTestDistance: 20_000,
      })
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
  return {
    stops,
    setVisible: (v) => {
      billboards.show = v
      viewer.scene.requestRender()
    },
  }
}
