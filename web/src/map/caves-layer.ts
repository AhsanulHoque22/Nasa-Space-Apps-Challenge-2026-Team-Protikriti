/** USGS cave candidates as clickable points; loaded the first time the layer is switched on. */
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
import { type Cave, type CaveDoc, loadCaves } from '../core/caves'
import { LAYER_STYLE, cullFarSide } from './layers'
import { MARS_SPHERE } from './mars'
import { addClickables, pickedId } from './picking'

const LABEL_MAX_M = 400_000
const SIZE_PX: Record<Cave['priority'], number> = { 1: 10, 2: 8, 3: 6, 0: 8 }

function point(c: Cave) {
  const dark = Color.fromCssColorString('#05070C')
  if (c.priority === 0) {
    // Already imaged by HiRISE: a hollow ring in the lightest violet.
    return {
      pixelSize: SIZE_PX[0],
      color: Color.TRANSPARENT,
      outlineColor: Color.fromCssColorString(LAYER_STYLE.cave[0]),
      outlineWidth: 2,
    }
  }
  return {
    pixelSize: SIZE_PX[c.priority],
    color: Color.fromCssColorString(LAYER_STYLE.cave[c.priority - 1] ?? LAYER_STYLE.cave[0]),
    outlineColor: dark,
    outlineWidth: 1.5,
  }
}

export function createCaveLayer(
  viewer: Viewer,
  onOpen: (cave: Cave, doc: CaveDoc) => void,
): { setVisible: (visible: boolean) => void; onError: (handler: (e: unknown) => void) => void } {
  const source = new CustomDataSource('caves')
  let built: Promise<void> | null = null
  let reportError: (e: unknown) => void = (e) => console.warn('Cave layer:', e)

  const build = async () => {
    const doc = await loadCaves()
    const targets = doc.caves.map((c, i) => {
      // Drawn on the datum sphere, through the terrain: the depth test would hide highland caves.
      const position = Cartesian3.fromDegrees(c.lon, c.lat, 0, MARS_SPHERE)
      const entity = source.entities.add({
        id: `cave:${i}`,
        position,
        point: { ...point(c), disableDepthTestDistance: Number.POSITIVE_INFINITY },
        label: {
          text: c.id,
          font: '600 12px system-ui, sans-serif',
          fillColor: Color.fromCssColorString(LAYER_STYLE.cave[0]),
          outlineColor: Color.fromCssColorString('#05070C'),
          outlineWidth: 3,
          style: LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: VerticalOrigin.BOTTOM,
          pixelOffset: new Cartesian2(0, -10),
          distanceDisplayCondition: new DistanceDisplayCondition(0, LABEL_MAX_M),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      })
      return { position, setShow: (show: boolean) => void (entity.show = show) }
    })
    addClickables(
      targets.map((t, i) => ({ id: `cave:${i}`, position: t.position, shown: () => source.show })),
    )
    cullFarSide(viewer, targets)
    await viewer.dataSources.add(source)
    new ScreenSpaceEventHandler(viewer.scene.canvas).setInputAction(
      (click: ScreenSpaceEventHandler.PositionedEvent) => {
        const match = /^cave:(\d+)$/.exec(pickedId(viewer, click.position) ?? '')
        const cave = match ? doc.caves[Number(match[1])] : undefined
        if (cave) onOpen(cave, doc)
      },
      ScreenSpaceEventType.LEFT_CLICK,
    )
  }

  return {
    setVisible(visible) {
      source.show = visible
      if (visible && !built) {
        built = build().catch((error: unknown) => {
          built = null // allow another try
          reportError(error)
        })
      }
      viewer.scene.requestRender()
    },
    onError(handler) {
      reportError = handler
    },
  }
}
