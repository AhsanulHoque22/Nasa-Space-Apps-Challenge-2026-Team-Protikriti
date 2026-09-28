/** Data layers on the globe. Each layer loads once and is toggled by visibility. */
import {
  ArcType,
  Cartesian2,
  Cartesian3,
  Color,
  ColorMaterialProperty,
  ConstantProperty,
  CustomDataSource,
  DistanceDisplayCondition,
  GeoJsonDataSource,
  HeightReference,
  ImageryLayer,
  LabelCollection,
  LabelStyle,
  NearFarScalar,
  Rectangle,
  SingleTileImageryProvider,
  VerticalOrigin,
  type Viewer,
} from 'cesium'
import { graticuleLines, labelMaxDistanceM } from '../core/coords'
import type { Grid } from '../core/grid'
import { MARS_SPHERE } from './mars'

export type LayerId =
  'imagery' | 'slopeHazard' | 'traverses' | 'landingSites' | 'names' | 'zones' | 'graticule'

export type LayerToggles = Record<LayerId, (visible: boolean) => void>

/** Symbology shared with the legend so the panel swatch is the real map symbol. */
export const LAYER_STYLE = {
  hazard: '#FC3D21', // NASA red: reserved for hazards and the active route
  perseverance: '#FFB547',
  curiosity: '#6FD3FF',
  landed: '#FFFFFF',
  crashed: '#9AA6B8',
  zone: '#5B8DEF', // NASA blue, lifted for contrast on dark terrain
  graticule: 'rgba(255,255,255,0.28)',
} as const

const LABEL_FONT = '600 13px system-ui, -apple-system, "Segoe UI", sans-serif'
const LABEL_OUTLINE = Color.fromCssColorString('#05070C')
// Keep labels readable over terrain but hidden when the planet is between camera and label.
const LABEL_DEPTH_TEST_OFF_WITHIN_M = 400_000
// Declutter by zoom: whole-planet view shows symbols, labels appear as you approach.
const LANDING_LABEL_MAX_M = 5_000_000
const ZONE_LABEL_MAX_M = 2_500_000

type FeatureCollection = {
  radius_km?: number
  features: Array<{ geometry: { coordinates: unknown }; properties: Record<string, unknown> }>
}

async function loadJson(url: string): Promise<FeatureCollection> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status} (did you run make data?)`)
  return (await response.json()) as FeatureCollection
}

function label(text: string, color = Color.WHITE) {
  return {
    text,
    font: LABEL_FONT,
    fillColor: color,
    outlineColor: LABEL_OUTLINE,
    outlineWidth: 3,
    style: LabelStyle.FILL_AND_OUTLINE,
    verticalOrigin: VerticalOrigin.BOTTOM,
    pixelOffset: new Cartesian2(0, -10),
    disableDepthTestDistance: LABEL_DEPTH_TEST_OFF_WITHIN_M,
  }
}

async function addSlopeHazard(viewer: Viewer, grid: Grid): Promise<ImageryLayer> {
  const provider = await SingleTileImageryProvider.fromUrl('data/slope_hazard.png', {
    rectangle: Rectangle.fromDegrees(grid.west, grid.south, grid.east, grid.north),
  })
  return viewer.imageryLayers.addImageryProvider(provider)
}

async function addTraverses(viewer: Viewer): Promise<GeoJsonDataSource> {
  const source = await GeoJsonDataSource.load('data/layers/traverses.geojson', {
    clampToGround: true,
  })
  for (const entity of source.entities.values) {
    const rover = entity.properties?.rover?.getValue() as string | undefined
    if (!entity.polyline) continue
    const color = rover === 'Curiosity' ? LAYER_STYLE.curiosity : LAYER_STYLE.perseverance
    entity.polyline.material = new ColorMaterialProperty(Color.fromCssColorString(color))
    entity.polyline.width = new ConstantProperty(3)
  }
  await viewer.dataSources.add(source)
  return source
}

async function addLandingSites(viewer: Viewer): Promise<CustomDataSource> {
  const data = await loadJson('data/layers/landing_sites.geojson')
  const source = new CustomDataSource('landing-sites')
  for (const f of data.features) {
    const [lon, lat] = f.geometry.coordinates as [number, number]
    const { mission, year, status } = f.properties as {
      mission: string
      year: number
      status: string
    }
    const crashed = status === 'crashed'
    const color = Color.fromCssColorString(crashed ? LAYER_STYLE.crashed : LAYER_STYLE.landed)
    source.entities.add({
      name: mission,
      position: Cartesian3.fromDegrees(lon, lat, 0, MARS_SPHERE),
      point: {
        pixelSize: crashed ? 7 : 9,
        color: crashed ? Color.TRANSPARENT : color,
        outlineColor: color,
        outlineWidth: 2,
        heightReference: HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: LABEL_DEPTH_TEST_OFF_WITHIN_M,
      },
      label: {
        ...label(`${mission} · ${year}${crashed ? ' (crash)' : ''}`, color),
        heightReference: HeightReference.CLAMP_TO_GROUND,
        distanceDisplayCondition: new DistanceDisplayCondition(0, LANDING_LABEL_MAX_M),
      },
    })
  }
  await viewer.dataSources.add(source)
  return source
}

function addNames(viewer: Viewer, data: FeatureCollection): LabelCollection {
  const labels = new LabelCollection({ scene: viewer.scene })
  for (const f of data.features) {
    const [lon, lat] = f.geometry.coordinates as [number, number]
    const { name, diameter_km: diameterKm } = f.properties as { name: string; diameter_km: number }
    labels.add({
      ...label(name, Color.fromCssColorString('#E8ECF4')),
      position: Cartesian3.fromDegrees(lon, lat, 0, MARS_SPHERE),
      distanceDisplayCondition: new DistanceDisplayCondition(0, labelMaxDistanceM(diameterKm)),
      scaleByDistance: new NearFarScalar(2e5, 1.0, 8e6, 0.75),
    })
  }
  viewer.scene.primitives.add(labels)
  return labels
}

/** Circle as [lon, lat] ring on the sphere (small-angle offsets are fine at 100 km). */
function ringDegrees(lon: number, lat: number, radiusKm: number, steps = 72): number[] {
  const angular = (radiusKm * 1000) / MARS_SPHERE.maximumRadius
  const degrees: number[] = []
  for (let i = 0; i <= steps; i++) {
    const a = (2 * Math.PI * i) / steps
    const dLat = angular * Math.sin(a)
    const dLon = (angular * Math.cos(a)) / Math.cos((lat * Math.PI) / 180)
    degrees.push(lon + (dLon * 180) / Math.PI, lat + (dLat * 180) / Math.PI)
  }
  return degrees
}

async function addZones(viewer: Viewer): Promise<CustomDataSource> {
  const data = await loadJson('data/layers/exploration_zones.geojson')
  const radiusKm = data.radius_km ?? 100
  const color = Color.fromCssColorString(LAYER_STYLE.zone)
  const source = new CustomDataSource('exploration-zones')
  for (const f of data.features) {
    const [lon, lat] = f.geometry.coordinates as [number, number]
    const { name } = f.properties as { name: string }
    source.entities.add({
      name: `${name} (candidate human Exploration Zone)`,
      position: Cartesian3.fromDegrees(lon, lat, 0, MARS_SPHERE),
      polyline: {
        positions: Cartesian3.fromDegreesArray(ringDegrees(lon, lat, radiusKm), MARS_SPHERE),
        width: 2,
        material: color,
        clampToGround: true,
      },
      label: {
        ...label(name, color),
        heightReference: HeightReference.CLAMP_TO_GROUND,
        distanceDisplayCondition: new DistanceDisplayCondition(0, ZONE_LABEL_MAX_M),
      },
    })
  }
  await viewer.dataSources.add(source)
  return source
}

function addGraticule(viewer: Viewer): CustomDataSource {
  const source = new CustomDataSource('graticule')
  const color = Color.fromCssColorString(LAYER_STYLE.graticule)
  for (const line of graticuleLines(10)) {
    source.entities.add({
      polyline: {
        positions: Cartesian3.fromDegreesArray(line.points.flat(), MARS_SPHERE),
        width: line.value === 0 ? 1.5 : 1,
        material: color,
        arcType: ArcType.RHUMB,
      },
    })
  }
  void viewer.dataSources.add(source)
  return source
}

export async function addLayers(
  viewer: Viewer,
  grid: Grid,
  hirise: ImageryLayer,
): Promise<LayerToggles> {
  const names = await loadJson('data/layers/names.geojson')
  const [slope, traverses, landing, zones] = await Promise.all([
    addSlopeHazard(viewer, grid),
    addTraverses(viewer),
    addLandingSites(viewer),
    addZones(viewer),
  ])
  const nameLabels = addNames(viewer, names)
  const graticule = addGraticule(viewer)
  graticule.show = false
  const redraw = () => viewer.scene.requestRender()
  const toggle =
    (target: { show: boolean }) =>
    (visible: boolean): void => {
      target.show = visible
      redraw()
    }
  return {
    imagery: toggle(hirise),
    slopeHazard: toggle(slope),
    traverses: toggle(traverses),
    landingSites: toggle(landing),
    names: toggle(nameLabels),
    zones: toggle(zones),
    graticule: toggle(graticule),
  }
}
