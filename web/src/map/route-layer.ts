/** The planned route and numbered stop markers, clamped to terrain. */
import {
  Cartesian2,
  Cartesian3,
  Color,
  CustomDataSource,
  HeightReference,
  LabelStyle,
  PolylineDashMaterialProperty,
  VerticalOrigin,
  type Viewer,
} from 'cesium'
import { type Cell, type Grid, cellToLonLat } from '../core/grid'
import { LAYER_STYLE } from './layers'
import { MARS_SPHERE } from './mars'

export type RouteLayer = {
  setStops(stops: Cell[]): void
  setPath(path: Cell[] | null): void
  /** Where the crew can no longer get home in time, or null when the route is safe. */
  setFail(cell: Cell | null): void
  setHazards(cells: Cell[]): void
  /** The route as it would be without the hazards, drawn dashed; null to hide it. */
  setBaseline(path: Cell[] | null): void
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
  let fail: Cell | null = null
  let hazards: Cell[] = []
  let baseline: Cell[] | null = null
  const redraw = () => {
    source.entities.removeAll()
    if (baseline && baseline.length > 1) {
      source.entities.add({
        name: 'Direct route (before hazards)',
        polyline: {
          positions: baseline.map(toCartesian),
          width: 3,
          material: new PolylineDashMaterialProperty({ color: Color.WHITE, dashLength: 12 }),
          clampToGround: true,
        },
      })
    }
    hazards.forEach((cell, i) => {
      source.entities.add({
        name: `Hazard ${i + 1}`,
        position: toCartesian(cell),
        point: {
          pixelSize: 14,
          color: Color.BLACK,
          outlineColor: red,
          outlineWidth: 4,
          heightReference: HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: `Hazard ${i + 1}`,
          font: '700 13px system-ui, sans-serif',
          fillColor: Color.WHITE,
          outlineColor: red,
          outlineWidth: 4,
          style: LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: VerticalOrigin.TOP,
          pixelOffset: new Cartesian2(0, 12),
          heightReference: HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      })
    })
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
    if (fail) {
      source.entities.add({
        name: 'Fails here',
        position: toCartesian(fail),
        point: {
          pixelSize: 16,
          color: Color.WHITE,
          outlineColor: red,
          outlineWidth: 5,
          heightReference: HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: 'Fails here: no way home in time',
          font: '700 13px system-ui, sans-serif',
          fillColor: Color.WHITE,
          outlineColor: red,
          outlineWidth: 4,
          style: LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: VerticalOrigin.TOP,
          pixelOffset: new Cartesian2(0, 14),
          heightReference: HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      })
    }
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
    setFail(next) {
      fail = next
      redraw()
    },
    setHazards(next) {
      hazards = next
      redraw()
    },
    setBaseline(next) {
      baseline = next
      redraw()
    },
  }
}
