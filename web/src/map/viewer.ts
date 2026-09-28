/** Cesium viewer configured for Mars: Mars ellipsoid, NASA Trek imagery, no Earth services. */
import {
  Cartesian3,
  GeographicTilingScheme,
  ImageryLayer,
  Math as CesiumMath,
  Rectangle,
  Viewer,
  WebMapTileServiceImageryProvider,
} from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import { MARS_SPHERE } from './mars'

const TREK_WMTS = 'https://trek.nasa.gov/tiles/Mars/EQ'

/** NASA Trek WMTS layer (EQ = geographic, 2x1 tiles at level 0, matrix set default028mm). */
function trekLayer(id: string, format: 'jpg' | 'png', maximumLevel: number, rect?: Rectangle) {
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

// MRO HiRISE controlled orthomosaic of Jezero, 25 cm/px -> ~level 17.
const JEZERO_HIRISE = trekLayer(
  'JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd',
  'png',
  17,
  Rectangle.fromDegrees(77.2229331, 18.3067994, 77.583964, 18.669315),
)

export function createMarsViewer(container: HTMLElement): { viewer: Viewer; hirise: ImageryLayer } {
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
  const hirise = viewer.imageryLayers.addImageryProvider(JEZERO_HIRISE)
  viewer.scene.verticalExaggeration = VERTICAL_EXAGGERATION
  viewer.scene.globe.showGroundAtmosphere = false // Earth-tuned; causes artifacts on Mars
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
