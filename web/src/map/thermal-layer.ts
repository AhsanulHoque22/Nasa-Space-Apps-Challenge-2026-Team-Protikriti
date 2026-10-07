/** "Ground firmness": THEMIS thermal inertia draped over each site, blue from loose to firm. */
import { Rectangle, SingleTileImageryProvider, type ImageryLayer, type Viewer } from 'cesium'
import type { Site } from '../core/elevation'
import { BLUE_RAMP, rampRaster } from '../core/ramp'
import { type ThermalGrid, parseThermal } from '../core/thermal'

const OVERLAY_ALPHA = 170

export type SiteThermal = { site: Site; grid: ThermalGrid }

/** Every site's grid that the pipeline wrote; a missing file is skipped with a warning. */
export async function loadThermalGrids(sites: readonly Site[]): Promise<SiteThermal[]> {
  const loaded = await Promise.all(
    sites.map(async (site) => {
      try {
        const [meta, bin] = await Promise.all([
          fetch(`data/sites/${site.id}/thermal.json`).then((r) => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`)
            return r.json() as Promise<unknown>
          }),
          fetch(`data/sites/${site.id}/thermal.bin`).then((r) => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`)
            return r.arrayBuffer()
          }),
        ])
        return { site, grid: parseThermal(meta, bin) }
      } catch (error) {
        console.warn(`Ground firmness not available for ${site.id}:`, error)
        return null
      }
    }),
  )
  return loaded.filter((x): x is SiteThermal => x !== null)
}

function dataUrl(grid: ThermalGrid): string {
  const canvas = document.createElement('canvas')
  canvas.width = grid.width
  canvas.height = grid.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('2D canvas is not available for the ground firmness layer')
  const px = rampRaster(grid.values, grid.p02, grid.p98, BLUE_RAMP, OVERLAY_ALPHA)
  context.putImageData(new ImageData(new Uint8ClampedArray(px), grid.width, grid.height), 0, 0)
  return canvas.toDataURL('image/png')
}

export async function addThermalLayer(viewer: Viewer, grids: readonly SiteThermal[]) {
  const layers: ImageryLayer[] = await Promise.all(
    grids.map(async ({ grid }) => {
      const provider = await SingleTileImageryProvider.fromUrl(dataUrl(grid), {
        rectangle: Rectangle.fromDegrees(grid.west, grid.south, grid.east, grid.north),
      })
      const layer = viewer.imageryLayers.addImageryProvider(provider)
      layer.show = false
      return layer
    }),
  )
  return {
    get show() {
      return layers.some((l) => l.show)
    },
    set show(v: boolean) {
      for (const l of layers) l.show = v
      viewer.scene.requestRender()
    },
  }
}
