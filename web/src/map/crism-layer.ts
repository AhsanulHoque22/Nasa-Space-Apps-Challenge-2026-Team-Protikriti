/** Chemical hazard: CRISM mineralogy draped over each site, orange from safe to hazardous. */
import { Rectangle, SingleTileImageryProvider, type ImageryLayer, type Viewer } from 'cesium'
import type { Site } from '../core/elevation'
import { ORANGE_RAMP, rampRaster } from '../core/ramp'
import { type CrismGrid, parseCrism } from '../core/crism'

const OVERLAY_ALPHA = 170

export type SiteCrism = { site: Site; grid: CrismGrid }

/** Every site's grid that the pipeline wrote; a missing file is skipped with a warning. */
export async function loadCrismGrids(sites: readonly Site[]): Promise<SiteCrism[]> {
  const loaded = await Promise.all(
    sites.map(async (site) => {
      try {
        const [meta, bin] = await Promise.all([
          fetch(`data/sites/${site.id}/crism.json`).then((r) => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`)
            return r.json() as Promise<unknown>
          }),
          fetch(`data/sites/${site.id}/crism.bin`).then((r) => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`)
            return r.arrayBuffer()
          }),
        ])
        return { site, grid: parseCrism(meta, bin) }
      } catch (error) {
        console.warn(`Ground chemistry not available for ${site.id}:`, error)
        return null
      }
    }),
  )
  return loaded.filter((x): x is SiteCrism => x !== null)
}

function dataUrl(grid: CrismGrid): string {
  const canvas = document.createElement('canvas')
  canvas.width = grid.width
  canvas.height = grid.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('2D canvas is not available for the chemical hazard layer')
  const px = rampRaster(grid.values, grid.p02, grid.p98, ORANGE_RAMP, OVERLAY_ALPHA)
  context.putImageData(new ImageData(new Uint8ClampedArray(px), grid.width, grid.height), 0, 0)
  return canvas.toDataURL('image/png')
}

export async function addCrismLayer(viewer: Viewer, grids: readonly SiteCrism[]) {
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
