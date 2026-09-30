/** Rover science activities (official Perseverance samples) as clickable diamond markers. */
import {
  Cartesian2,
  Cartesian3,
  Color,
  CustomDataSource,
  DistanceDisplayCondition,
  LabelStyle,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  VerticalOrigin,
  type Viewer,
} from 'cesium'
import { LAYER_STYLE } from './layers'
import { MARS_SPHERE } from './mars'
import { addClickables, pickedId } from './picking'

export type Activity = {
  kind: 'sample'
  rover: 'm20'
  number: number
  name: string
  sol: number | null
  feature?: string
  sampleType?: string
  rockType?: string
  dateSealed?: string
  height?: string
  location?: string
  image?: string
  lon?: number
  lat?: number
  positionBasis: string
}

const LABEL_MAX_M = 60_000
const DIAMOND_PX = 16

function diamond(): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = c.height = DIAMOND_PX
  const g = c.getContext('2d')
  if (!g) return c
  const h = DIAMOND_PX / 2
  g.beginPath()
  g.moveTo(h, 1.5)
  g.lineTo(DIAMOND_PX - 1.5, h)
  g.lineTo(h, DIAMOND_PX - 1.5)
  g.lineTo(1.5, h)
  g.closePath()
  g.fillStyle = LAYER_STYLE.sample
  g.fill()
  g.lineWidth = 1.5
  g.strokeStyle = '#05070C'
  g.stroke()
  return c
}

/** `surfaceM`: rendered ground height, as for the stop dots (streetview-layer.ts). */
export async function addActivities(
  viewer: Viewer,
  surfaceM: (lon: number, lat: number) => number,
  onOpen: (a: Activity) => void,
): Promise<{ activities: Activity[]; setVisible: (v: boolean) => void }> {
  const response = await fetch('data/activities.json')
  if (!response.ok) throw new Error(`activities.json: HTTP ${response.status}`)
  const { activities } = (await response.json()) as { activities: Activity[] }
  const source = new CustomDataSource('activities')
  const image = diamond()
  activities.forEach((a, i) => {
    if (a.lon === undefined || a.lat === undefined) return // never place what has no position
    const position = Cartesian3.fromDegrees(a.lon, a.lat, surfaceM(a.lon, a.lat), MARS_SPHERE)
    addClickables([{ id: `activity:${i}`, position, shown: () => source.show }])
    source.entities.add({
      id: `activity:${i}`,
      position,
      billboard: {
        image,
        disableDepthTestDistance: 20_000,
      },
      label: {
        text: `Sample ${a.number} · ${a.name}`,
        font: '600 12px system-ui, sans-serif',
        fillColor: Color.fromCssColorString(LAYER_STYLE.sample),
        outlineColor: Color.fromCssColorString('#05070C'),
        outlineWidth: 3,
        style: LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: VerticalOrigin.BOTTOM,
        pixelOffset: new Cartesian2(0, -12),
        distanceDisplayCondition: new DistanceDisplayCondition(0, LABEL_MAX_M),
        disableDepthTestDistance: 20_000,
      },
    })
  })
  await viewer.dataSources.add(source)
  new ScreenSpaceEventHandler(viewer.scene.canvas).setInputAction(
    (click: ScreenSpaceEventHandler.PositionedEvent) => {
      const match = /^activity:(\d+)$/.exec(pickedId(viewer, click.position) ?? '')
      const activity = match ? activities[Number(match[1])] : undefined
      if (activity) onOpen(activity)
    },
    ScreenSpaceEventType.LEFT_CLICK,
  )
  return {
    activities,
    setVisible: (v) => {
      source.show = v
      viewer.scene.requestRender()
    },
  }
}
