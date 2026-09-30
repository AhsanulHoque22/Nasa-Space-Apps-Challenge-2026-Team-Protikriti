/** Cesium viewer configured for Mars: Mars ellipsoid, NASA Trek imagery, no Earth services. */
import {
  Cartesian2,
  Cartesian3,
  GeographicTilingScheme,
  ImageryLayer,
  Math as CesiumMath,
  Rectangle,
  Viewer,
  WebMapTileServiceImageryProvider,
} from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import type { ViewState } from '../core/deeplink'
import {
  HIRISE_GLOBAL_MAX_LEVEL,
  HIRISE_GLOBAL_TILE_PX,
  HIRISE_GLOBAL_URL,
  HIRISE_MOSAICS,
} from '../core/hirise'
import { MARS_SPHERE } from './mars'

const TREK_WMTS = 'https://trek.nasa.gov/tiles/Mars/EQ'

/** NASA Trek WMTS layer (EQ = geographic, 2x1 tiles at level 0, matrix set default028mm). */
export function trekLayer(
  id: string,
  format: 'jpg' | 'png',
  maximumLevel: number,
  rect?: Rectangle,
) {
  return new WebMapTileServiceImageryProvider({
    url: `${TREK_WMTS}/${id}/1.0.0//{Style}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.${format}`,
    layer: id,
    style: 'default',
    format: format === 'jpg' ? 'image/jpeg' : 'image/png',
    tileMatrixSetID: 'default028mm',
    tilingScheme: new GeographicTilingScheme({ ellipsoid: MARS_SPHERE }),
    maximumLevel,
    rectangle: rect,
    credit: 'NASA/JPL-Caltech Mars Trek',
  })
}

// Viking MDIM 2.1 global colour mosaic, 232 m/px -> useful to ~level 7.
const GLOBAL_BASE = trekLayer('Mars_Viking_MDIM21_ClrMosaic_global_232m', 'jpg', 7)

// MRO CTX block-adjusted mosaic of Gale crater, 6 m/px (15 levels) -> ~level 14: fills the
// crater around the HiRISE strip.
const GALE_CTX = trekLayer(
  'Gale_CTX_BlockAdj_dd',
  'png',
  14,
  Rectangle.fromDegrees(135.1842593, -6.5732988, 139.2413012, -2.8077809),
)

/** Every released HiRISE observation: 512 px geographic tiles, black (transparent) outside. */
function hiriseGlobal() {
  const provider = new WebMapTileServiceImageryProvider({
    url: HIRISE_GLOBAL_URL,
    layer: 'HiRISE',
    style: 'default',
    format: 'image/png',
    tileMatrixSetID: 'default028mm',
    tilingScheme: new GeographicTilingScheme({ ellipsoid: MARS_SPHERE }),
    tileWidth: HIRISE_GLOBAL_TILE_PX,
    tileHeight: HIRISE_GLOBAL_TILE_PX,
    maximumLevel: HIRISE_GLOBAL_MAX_LEVEL,
    credit: 'NASA/JPL-Caltech/University of Arizona HiRISE, via Esri OnMars and NASA Mars Trek',
  })
  // Tiles off the HiRISE footprints are 404s: expected, so keep them out of the console.
  provider.errorEvent.addEventListener(() => undefined)
  return provider
}

/** All HiRISE imagery (global strips + site mosaics) and CTX Gale, toggled together. */
export type SiteImagery = { show: boolean }

export function createMarsViewer(container: HTMLElement): { viewer: Viewer; hirise: SiteImagery } {
  const viewer = new Viewer(container, {
    baseLayer: new ImageryLayer(GLOBAL_BASE),
    baseLayerPicker: false,
    geocoder: false,
    animation: false,
    timeline: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    infoBox: false,
    selectionIndicator: false,
    fullscreenButton: false,
    scene3DOnly: true,
  })
  const layers = [
    viewer.imageryLayers.addImageryProvider(GALE_CTX),
    viewer.imageryLayers.addImageryProvider(hiriseGlobal()),
    ...HIRISE_MOSAICS.map((m) =>
      viewer.imageryLayers.addImageryProvider(
        trekLayer(m.id, 'png', m.maxLevel, Rectangle.fromDegrees(m.west, m.south, m.east, m.north)),
      ),
    ),
  ]
  const hirise: SiteImagery = {
    get show() {
      return layers.every((l) => l.show)
    },
    set show(v: boolean) {
      for (const l of layers) l.show = v
    },
  }
  // Cesium's defaults (inertia 0.9/0.9/0.8, zoomFactor 5) fling the map on release and jump on
  // each wheel notch; users found panning and zooming too twitchy. Lower = stops sooner.
  const controls = viewer.scene.screenSpaceCameraController
  controls.inertiaSpin = 0.6
  controls.inertiaTranslate = 0.6
  controls.inertiaZoom = 0.5
  controls.zoomFactor = 2.5
  viewer.scene.verticalExaggeration = VERTICAL_EXAGGERATION
  viewer.scene.globe.showGroundAtmosphere = false // Earth-tuned; causes artifacts on Mars
  // Occlude labels and markers behind the planet or terrain (e.g. Phoenix's label seen from Jezero).
  viewer.scene.globe.depthTestAgainstTerrain = true
  // Cesium's Sun and Moon follow Earth ephemerides: hide them; lighting comes from map/sun.ts.
  if (viewer.scene.sun) viewer.scene.sun.show = false
  if (viewer.scene.moon) viewer.scene.moon.show = false
  return { viewer, hirise }
}

/** Relief is subtle at 20 m/px over a ~12 km AOI; 2x makes the delta scarp readable. */
export const VERTICAL_EXAGGERATION = 2

export type Bounds = { west: number; south: number; east: number; north: number }

/** Oblique view from the south so terrain relief reads, framing the whole AOI. */
export function viewAoi(viewer: Viewer, b: Bounds): void {
  const spanLat = b.north - b.south
  viewer.camera.setView({
    destination: Cartesian3.fromDegrees(
      (b.west + b.east) / 2,
      b.south - spanLat * 0.55,
      OBLIQUE_VIEW_HEIGHT_M,
    ),
    orientation: { heading: 0, pitch: CesiumMath.toRadians(-35), roll: 0 },
  })
}

const OBLIQUE_VIEW_HEIGHT_M = 7_000 // above the Mars datum; Jezero floor is ~-2,600 m

const GLOBE_VIEW_HEIGHT_M = 9_000_000

/** Whole-planet view centred on a longitude/latitude. */
export function viewGlobe(viewer: Viewer, lon: number, lat: number): void {
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(lon, lat, GLOBE_VIEW_HEIGHT_M),
    duration: 1.2,
  })
}

const MIN_FLY_ALTITUDE_M = 25_000
const ALTITUDE_PER_KM = 2_500 // frame a feature at ~2.5x its diameter

/** Fly to a place, framing it by its size. */
export function flyToPlace(viewer: Viewer, lon: number, lat: number, sizeKm = 0): void {
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(
      lon,
      lat,
      Math.max(MIN_FLY_ALTITUDE_M, sizeKm * ALTITUDE_PER_KM),
      MARS_SPHERE,
    ),
    duration: 1.6,
  })
}

/** The camera as a shareable view (degrees, metres above the Mars sphere). */
export function currentView(viewer: Viewer): ViewState {
  const c = viewer.camera.positionCartographic
  return {
    lon: CesiumMath.toDegrees(c.longitude),
    lat: CesiumMath.toDegrees(c.latitude),
    altM: c.height,
    headingDeg: (CesiumMath.toDegrees(viewer.camera.heading) + 360) % 360 || 0, // 360 -> 0
    pitchDeg: CesiumMath.toDegrees(viewer.camera.pitch),
  }
}

export function applyView(viewer: Viewer, v: ViewState): void {
  viewer.camera.setView({
    destination: Cartesian3.fromDegrees(v.lon, v.lat, v.altM, MARS_SPHERE),
    orientation: {
      heading: CesiumMath.toRadians(v.headingDeg),
      pitch: CesiumMath.toRadians(v.pitchDeg),
      roll: 0,
    },
  })
}

/** Surface point at the centre of the view (lon/lat degrees), or null if looking at sky. */
export function viewCentre(viewer: Viewer): { lon: number; lat: number } | null {
  const canvas = viewer.scene.canvas
  const ray = viewer.camera.getPickRay(
    new Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2),
  )
  const hit = ray && viewer.scene.globe.pick(ray, viewer.scene)
  if (!hit) return null
  const c = MARS_SPHERE.cartesianToCartographic(hit)
  return { lon: CesiumMath.toDegrees(c.longitude), lat: CesiumMath.toDegrees(c.latitude) }
}
