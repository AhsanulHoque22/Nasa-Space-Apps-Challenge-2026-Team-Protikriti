/**
 * The ground Cesium draws: walk patches (2 m) over site models (20-32 m) over global MOLA, each
 * feathered into the next so no cliff shows where they meet. Walk patches load on first use.
 */
import { GeographicTilingScheme, Rectangle, UrlTemplateImageryProvider, type Viewer } from 'cesium'
import { type Site, sampleGrid } from '../core/elevation'
import type { Grid } from '../core/grid'
import { type WalkPatch, feathered, parseWalkPatch } from '../core/walk-patch'
import { MARS_SPHERE } from './mars'
import { type HeightFn, createTerrain } from './terrain'

// Site models and MOLA differ by up to tens of metres at a site's edge: blend over 500 m.
const SITE_FEATHER_M = 500
// The HiRISE stereo DEM and the 20 m CTX model agree to a few metres: 60 m is enough.
const PATCH_FEATHER_M = 60

const gridHeight = (g: Grid) => (lon: number, lat: number) => sampleGrid(g, lon, lat)

export function createWalkGround(viewer: Viewer, sites: readonly Site[], mola: Grid) {
  const base = sites.reduce<HeightFn>(
    (coarse, s) => feathered(gridHeight(s.grid), s.grid, coarse, SITE_FEATHER_M),
    gridHeight(mola),
  )
  let height = base
  const patches = new Map<string, Promise<WalkPatch | null>>()

  const addImagery = (siteId: string, p: WalkPatch) => {
    const [west, south, east, north] = p.tiles.rect
    viewer.imageryLayers.addImageryProvider(
      new UrlTemplateImageryProvider({
        url: `data/walk/${siteId}/tiles/{z}/{x}/{y}.jpg`,
        tilingScheme: new GeographicTilingScheme({ ellipsoid: MARS_SPHERE }),
        rectangle: Rectangle.fromDegrees(west, south, east, north),
        minimumLevel: p.tiles.minLevel,
        maximumLevel: p.tiles.maxLevel,
        credit: 'NASA/JPL-Caltech/University of Arizona HiRISE; USGS orthomosaic',
      }),
    )
  }

  const load = async (siteId: string): Promise<WalkPatch | null> => {
    const [meta, bin] = await Promise.all([
      fetch(`data/walk/${siteId}/walk.json`).then((r) => (r.ok ? r.json() : null)),
      fetch(`data/walk/${siteId}/dem.bin`).then((r) => (r.ok ? r.arrayBuffer() : null)),
    ])
    if (!meta || !bin) return null // no patch for this site: walk on the site model
    const p = parseWalkPatch(meta, bin)
    height = feathered(gridHeight(p.grid), p.grid, height, PATCH_FEATHER_M)
    addImagery(siteId, p)
    // Tiles already made from the coarser model must be rebuilt: a new provider reloads them.
    viewer.terrainProvider = createTerrain((lon, lat) => height(lon, lat))
    return p
  }

  return {
    /** Ground height as drawn (before vertical exaggeration); follows patches as they load. */
    height: (lon: number, lat: number) => height(lon, lat),
    /** The site's walk patch, loaded once; null when the site has none or it failed to load. */
    patch(siteId: string): Promise<WalkPatch | null> {
      let p = patches.get(siteId)
      if (!p) {
        p = load(siteId).catch((error: unknown) => {
          console.warn(`Walk patch for ${siteId} not loaded:`, error)
          patches.delete(siteId) // let a later visit try again
          return null
        })
        patches.set(siteId, p)
      }
      return p
    },
  }
}
