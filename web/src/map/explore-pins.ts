/**
 * On foot, a red pin over everything worth finding (the base, the site's hardware, named places
 * nearby) with its name above it. Pins show through hills, so they point the way from afar.
 */
import {
  BillboardCollection,
  Cartesian2,
  Cartesian3,
  LabelCollection,
  NearFarScalar,
  VerticalOrigin,
  type Viewer,
} from 'cesium'
import { distanceKm } from '../core/site-report'
import { MARS_SPHERE } from './mars'
import { platedLabel } from './plated-label'
import { pin } from './streetview-layer'

export type PinPlace = { name: string; lon: number; lat: number }

const WITHIN_KM = 40 // a walk covers a few km; craters this far still help to find the way
const PIN_RED = '#d6312a'
const PIN_H_PX = 46 // streetview-layer.ts pin height
// Near pins at full size, far ones smaller, so the closest read first.
const SCALE_BY_DISTANCE = new NearFarScalar(200, 1, 30_000, 0.55)

type NamesFile = {
  features: Array<{ geometry: { coordinates: [number, number] }; properties: { name: string } }>
}

/** Every IAU named feature on Mars. */
export async function loadNamedPlaces(): Promise<PinPlace[]> {
  const response = await fetch('data/layers/names.geojson')
  if (!response.ok) throw new Error(`names.geojson: HTTP ${response.status}`)
  const { features } = (await response.json()) as NamesFile
  return features.map((f) => ({
    name: f.properties.name,
    lon: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
  }))
}

/**
 * Pins the places within reach of `from`; the returned function removes them. `groundM` is the
 * true ground height (on foot the terrain is drawn without exaggeration).
 */
export function addExplorePins(
  viewer: Viewer,
  from: { lon: number; lat: number },
  places: readonly PinPlace[],
  groundM: (lon: number, lat: number) => number,
): () => void {
  const pins = new BillboardCollection({ scene: viewer.scene })
  const labels = new LabelCollection({ scene: viewer.scene })
  const image = pin(PIN_RED)
  for (const p of places) {
    if (!p.name || distanceKm(from.lon, from.lat, p.lon, p.lat) > WITHIN_KM) continue
    const h = groundM(p.lon, p.lat)
    const position = Cartesian3.fromDegrees(p.lon, p.lat, Number.isFinite(h) ? h : 0, MARS_SPHERE)
    pins.add({
      position,
      image,
      verticalOrigin: VerticalOrigin.BOTTOM,
      scaleByDistance: SCALE_BY_DISTANCE,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    })
    labels.add({
      position,
      ...platedLabel(p.name, undefined, 14),
      pixelOffset: new Cartesian2(0, -PIN_H_PX - 4),
      pixelOffsetScaleByDistance: SCALE_BY_DISTANCE,
      scaleByDistance: SCALE_BY_DISTANCE,
    })
  }
  viewer.scene.primitives.add(pins)
  viewer.scene.primitives.add(labels)
  viewer.scene.requestRender()
  return () => {
    viewer.scene.primitives.remove(pins)
    viewer.scene.primitives.remove(labels)
  }
}
