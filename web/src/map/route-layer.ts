/** The planned route and its end markers, clamped to terrain. */
import { Cartesian3, Color, CustomDataSource, HeightReference, type Viewer } from 'cesium'
import { type Cell, type Grid, cellToLonLat } from '../core/grid'
import { LAYER_STYLE } from './layers'
import { MARS_SPHERE } from './mars'

export type RouteLayer = {
  setEnds(start?: Cell, goal?: Cell): void
  setPath(path: Cell[] | null): void
}

export function createRouteLayer(viewer: Viewer, grid: Grid): RouteLayer {
  const source = new CustomDataSource('route')
  void viewer.dataSources.add(source)
  const red = Color.fromCssColorString(LAYER_STYLE.hazard)
  const toCartesian = (c: Cell) => {
    const [lon, lat] = cellToLonLat(grid, c)
    return Cartesian3.fromDegrees(lon, lat, 0, MARS_SPHERE)
  }
  const marker = (c: Cell, fill: Color, name: string) =>
    source.entities.add({
      name,
      position: toCartesian(c),
      point: {
        pixelSize: 12,
        color: fill,
        outlineColor: Color.WHITE,
        outlineWidth: 2,
        heightReference: HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })
  let path: Cell[] | null = null
  let ends: { start?: Cell; goal?: Cell } = {}
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
    if (ends.start) marker(ends.start, Color.fromCssColorString('#0B3D91'), 'Start')
    if (ends.goal) marker(ends.goal, red, 'Goal')
    viewer.scene.requestRender()
  }
  return {
    setEnds(start, goal) {
      ends = { start, goal }
      redraw()
    },
    setPath(next) {
      path = next
      redraw()
    },
  }
}
