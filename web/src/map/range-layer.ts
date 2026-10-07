/** The walking-range raster draped over a site, one pixel per grid cell. */
import { Rectangle, SingleTileImageryProvider, type ImageryLayer, type Viewer } from 'cesium'
import type { Grid } from '../core/grid'

export type RangeLayer = {
  /** RGBA pixels (width x height of the grid), or null to remove the overlay. */
  setRaster(pixels: Uint8ClampedArray | null): Promise<void>
}

export function createRangeLayer(viewer: Viewer, grid: Grid): RangeLayer {
  let layer: ImageryLayer | undefined
  let latest = 0
  const remove = () => {
    if (layer) viewer.imageryLayers.remove(layer, true)
    layer = undefined
  }
  return {
    async setRaster(pixels) {
      const id = ++latest
      if (!pixels) {
        remove()
        viewer.scene.requestRender()
        return
      }
      const canvas = document.createElement('canvas')
      canvas.width = grid.width
      canvas.height = grid.height
      const context = canvas.getContext('2d')
      if (!context) throw new Error('2D canvas is not available for the walking-range overlay')
      context.putImageData(
        new ImageData(new Uint8ClampedArray(pixels), grid.width, grid.height),
        0,
        0,
      )
      const provider = await SingleTileImageryProvider.fromUrl(canvas.toDataURL('image/png'), {
        rectangle: Rectangle.fromDegrees(grid.west, grid.south, grid.east, grid.north),
      })
      if (id !== latest) return // a newer raster (or a removal) arrived while this one loaded
      remove()
      layer = viewer.imageryLayers.addImageryProvider(provider)
      viewer.scene.requestRender()
    },
  }
}
