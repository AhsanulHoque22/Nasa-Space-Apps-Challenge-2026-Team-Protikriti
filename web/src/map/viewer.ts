/** Cesium viewer configured for Mars: Mars ellipsoid, NASA Trek imagery, no Earth services. */
import {
  Cartesian2,
  Cartesian3,
  Color,
  DynamicAtmosphereLightingType,
  GeographicTilingScheme,
  ImageryLayer,
  Math as CesiumMath,
  Rectangle,
  SkyAtmosphere,
  UrlTemplateImageryProvider,
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

type StripRegion = {
  name: string
  rect: [number, number, number, number]
  minLevel: number
  maxLevel: number
}

/**
 * Tidied HiRISE strips (seams removed, aligned to CTX; made by `marsmap strips`) for the regions
 * processed so far. They sit over the raw strips and step aside below their finest level, where
 * the raw tiles carry more detail. A missing manifest just leaves the raw strips as they were.
 */
async function addTidyStrips(viewer: Viewer, above: ImageryLayer): Promise<ImageryLayer[]> {
  const response = await fetch('data/strips/manifest.json').catch(() => null)
  if (!response?.ok) return []
  const { regions } = (await response.json()) as { regions: StripRegion[] }
  let index = viewer.imageryLayers.indexOf(above)
  return regions.map((r) => {
    const provider = new UrlTemplateImageryProvider({
      url: 'data/strips/{z}/{x}/{y}.webp',
      tilingScheme: new GeographicTilingScheme({ ellipsoid: MARS_SPHERE }),
      tileWidth: HIRISE_GLOBAL_TILE_PX,
      tileHeight: HIRISE_GLOBAL_TILE_PX,
      minimumLevel: r.minLevel,
      maximumLevel: r.maxLevel,
      rectangle: Rectangle.fromDegrees(...r.rect),
      credit: 'NASA/JPL-Caltech/University of Arizona HiRISE, seams and alignment tidied here',
    })
    provider.errorEvent.addEventListener(() => undefined)
    const layer = new ImageryLayer(provider, { maximumTerrainLevel: r.maxLevel })
    viewer.imageryLayers.add(layer, ++index)
    return layer
  })
}

/** All HiRISE imagery (global strips + site mosaics) and CTX Gale, toggled together. */
export type SiteImagery = { show: boolean }

export function createMarsViewer(container: HTMLElement): {
  viewer: Viewer
  hirise: SiteImagery
  /**
   * Layers a walker never sees: the planet-wide HiRISE strips (uncontrolled) and the wide
   * CTX/HRSC composites that lie entirely under a sharper 25 cm site mosaic. Hidden on foot,
   * where every layer is one more request per tile to the slow remote server.
   */
  offFoot: { show: boolean }
} {
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
  const galeCtx = viewer.imageryLayers.addImageryProvider(GALE_CTX)
  const strips = viewer.imageryLayers.addImageryProvider(hiriseGlobal())
  const mosaics = HIRISE_MOSAICS.map((m) =>
    viewer.imageryLayers.addImageryProvider(
      trekLayer(m.id, 'png', m.maxLevel, Rectangle.fromDegrees(m.west, m.south, m.east, m.north)),
    ),
  )
  const layers = [galeCtx, strips, ...mosaics]
  const composites = mosaics.filter((_, i) => HIRISE_MOSAICS[i]?.id.includes('_Visible_Mosaic_'))
  const hiddenOnFoot = [strips, galeCtx, ...composites]
  void addTidyStrips(viewer, strips).then((tidy) => {
    layers.push(...tidy)
    hiddenOnFoot.push(...tidy)
    for (const layer of tidy) layer.show = strips.show
  })
  const offFoot = {
    get show() {
      return hiddenOnFoot.every((l) => l.show)
    },
    set show(v: boolean) {
      for (const l of hiddenOnFoot) l.show = v
    },
  }
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
  // Until the first NASA tiles arrive (they are slow) the globe shows this, not Cesium's Earth-blue.
  viewer.scene.globe.baseColor = Color.fromCssColorString(MARS_BASE_COLOR)
  viewer.scene.globe.showGroundAtmosphere = false // Earth-tuned; causes artifacts on Mars
  // Occlude labels and markers behind the planet or terrain (e.g. Phoenix's label seen from Jezero).
  viewer.scene.globe.depthTestAgainstTerrain = true
  // Cesium's Sun and Moon follow Earth ephemerides: hide them; lighting comes from map/sun.ts.
  if (viewer.scene.sun) viewer.scene.sun.show = false
  if (viewer.scene.moon) viewer.scene.moon.show = false
  viewer.scene.skyAtmosphere = marsSky()
  // Light the sky glow from the Mars sun that map/sun.ts sets, not from the camera.
  viewer.scene.atmosphere.dynamicLighting = DynamicAtmosphereLightingType.SCENE_LIGHT
  return { viewer, hirise, offFoot }
}

/** Average Mars regolith tone, close to the Viking mosaic's mean colour. */
const MARS_BASE_COLOR = '#8a5a44'

/** Mars atmospheric scale height (NASA Mars Fact Sheet: 11.1 km). */
const MARS_SCALE_HEIGHT_M = 11_100

/**
 * Cesium builds its sky glow only for the Earth, so Mars had a black sky. This is a thin,
 * dust-scattered one: red light scattered more than blue, giving the butterscotch daytime sky of
 * rover images. Illustrative, not a radiative-transfer model.
 */
function marsSky(): SkyAtmosphere {
  const sky = new SkyAtmosphere(MARS_SPHERE)
  sky.atmosphereRayleighScaleHeight = MARS_SCALE_HEIGHT_M
  sky.atmosphereMieScaleHeight = MARS_SCALE_HEIGHT_M
  sky.atmosphereRayleighCoefficient = new Cartesian3(9e-6, 6e-6, 3.5e-6)
  sky.atmosphereMieCoefficient = new Cartesian3(30e-6, 18e-6, 9e-6)
  sky.atmosphereMieAnisotropy = 0.8
  return sky
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
