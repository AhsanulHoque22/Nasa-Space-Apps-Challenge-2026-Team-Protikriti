/** Weather station pins at each rover's latest position (end of its NASA traverse). */
import {
  Cartesian2,
  Cartesian3,
  Color,
  CustomDataSource,
  HeightReference,
  LabelStyle,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  VerticalOrigin,
  type Viewer,
} from 'cesium'
import { MARS_SPHERE } from './mars'
import { pickedId } from './picking'
import type { WeatherStation } from './weather-client'

const ROVER_STATION: Record<string, WeatherStation> = { Curiosity: 'rems', Perseverance: 'meda' }
export const STATION_ID_PREFIX = 'station:'

type Traverses = {
  features: Array<{ properties: { rover: string }; geometry: { coordinates: number[][][] } }>
}

/** Latest [lon, lat] per station: the last point of the rover's last traverse segment. */
export async function stationPositions(): Promise<Record<WeatherStation, [number, number]>> {
  const response = await fetch('data/layers/traverses.geojson')
  if (!response.ok) throw new Error(`traverses.geojson: HTTP ${response.status}`)
  const data = (await response.json()) as Traverses
  const out: Partial<Record<WeatherStation, [number, number]>> = {}
  for (const f of data.features) {
    const station = ROVER_STATION[f.properties.rover]
    const last = f.geometry.coordinates.at(-1)?.at(-1)
    if (station && last) out[station] = [last[0] ?? 0, last[1] ?? 0]
  }
  if (!out.rems || !out.meda) throw new Error('traverses.geojson: missing a rover traverse')
  return out as Record<WeatherStation, [number, number]>
}

export function addStationPins(
  viewer: Viewer,
  positions: Record<WeatherStation, [number, number]>,
  onOpen: (station: WeatherStation) => void,
): void {
  const source = new CustomDataSource('weather-stations')
  const labels: Record<WeatherStation, string> = {
    rems: 'Weather · Gale',
    meda: 'Weather · Jezero',
  }
  for (const station of Object.keys(positions) as WeatherStation[]) {
    const [lon, lat] = positions[station]
    source.entities.add({
      id: `${STATION_ID_PREFIX}${station}`,
      position: Cartesian3.fromDegrees(lon, lat, 0, MARS_SPHERE),
      point: {
        pixelSize: 14,
        color: Color.fromCssColorString('#0B3D91'),
        outlineColor: Color.WHITE,
        outlineWidth: 2,
        heightReference: HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: labels[station],
        font: '700 12px system-ui, sans-serif',
        fillColor: Color.WHITE,
        outlineColor: Color.fromCssColorString('#05070C'),
        outlineWidth: 3,
        style: LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: VerticalOrigin.BOTTOM,
        pixelOffset: new Cartesian2(0, -12),
        heightReference: HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })
  }
  void viewer.dataSources.add(source)
  new ScreenSpaceEventHandler(viewer.scene.canvas).setInputAction(
    (click: ScreenSpaceEventHandler.PositionedEvent) => {
      const id = pickedId(viewer, click.position)
      if (id?.startsWith(STATION_ID_PREFIX))
        onOpen(id.slice(STATION_ID_PREFIX.length) as WeatherStation)
    },
    ScreenSpaceEventType.LEFT_CLICK,
  )
}
