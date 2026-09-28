/** The planned route and numbered stop markers, clamped to terrain. */
import {
  Cartesian2,
  Cartesian3,
  Color,
  CustomDataSource,
  HeightReference,
  LabelStyle,
  VerticalOrigin,
  type Viewer,
} from 'cesium'
import { type Cell, type Grid, cellToLonLat } from '../core/grid'
import { LAYER_STYLE } from './layers'
import { MARS_SPHERE } from './mars'

export type RouteLayer = {
  setStops(stops: Cell[]): void
  setPath(path: Cell[] | null): void
}

export function createRouteLayer(viewer: Viewer, grid: Grid): RouteLayer {
  const source = new CustomDataSource('route')
  void viewer.dataSources.add(source)
  const red = Color.fromCssColorString(LAYER_STYLE.hazard)
  const blue = Color.fromCssColorString('#0B3D91')
  const toCartesian = (c: Cell) => {
    const [lon, lat] = cellToLonLat(grid, c)
    return Cartesian3.fromDegrees(lon, lat, 0, MARS_SPHERE)
  }
  let path: Cell[] | null = null
  let stops: Cell[] = []
  const redraw = () => {
    source.entities.removeAll()
    if (path && path.length > 1) {
      source.entities.add({
        name: 'Planned Marswalk',
        polyline: {
          positions: path.map(toCartesian),
          width: 4,
          material: red,
          clampToGround: true,
        },
      })
    }
    stops.forEach((stop, i) => {
      const isStart = i === 0
      source.entities.add({
        name: isStart ? 'Start' : `Science stop ${i}`,
        position: toCartesian(stop),
        point: {
          pixelSize: 12,
          color: isStart ? blue : red,
          outlineColor: Color.WHITE,
          outlineWidth: 2,
          heightReference: HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: isStart ? 'Start' : `Stop ${i}`,
          font: '700 13px system-ui, sans-serif',
          fillColor: Color.WHITE,
          outlineColor: Color.fromCssColorString('#05070C'),
          outlineWidth: 3,
          style: LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: VerticalOrigin.BOTTOM,
          pixelOffset: new Cartesian2(0, -12),
          heightReference: HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      })
    })
    viewer.scene.requestRender()
  }
  return {
    setStops(next) {
      stops = next
      redraw()
    },
    setPath(next) {
      path = next
      redraw()
    },
  }
}
