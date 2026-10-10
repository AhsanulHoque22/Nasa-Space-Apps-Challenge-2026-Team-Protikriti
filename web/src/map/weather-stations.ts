/** Weather station pins at each rover's latest position (end of its NASA traverse). */
import {
  Cartesian2,
  Cartesian3,
  Color,
  CustomDataSource,
  DistanceDisplayCondition,
  LabelStyle,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  VerticalOrigin,
  type Viewer,
} from 'cesium'
import { type Cullable, cullFarSide } from './layers'
import { MARS_SPHERE } from './mars'
import { addClickables, pickedId } from './picking'
import type { WeatherStation } from './weather-client'

const ROVER_STATION: Record<string, WeatherStation> = { Curiosity: 'rems', Perseverance: 'meda' }
export const STATION_ID_PREFIX = 'station:'
// A pin belongs to its own crater: from Jezero the Gale pin must not be drawn (it used to show
// through the planet because depth testing was off). Hidden past this range and past the horizon.
const STATION_MAX_M = 1_500_000
const STATION_RANGE = new DistanceDisplayCondition(0, STATION_MAX_M)
const PIN_DEPTH_TEST_OFF_WITHIN_M = 20_000

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
  surfaceM: (lon: number, lat: number) => number,
  onOpen: (station: WeatherStation) => void,
): void {
  const source = new CustomDataSource('weather-stations')
  const farSide: Cullable[] = []
  const labels: Record<WeatherStation, string> = {
    rems: 'Weather · Gale',
    meda: 'Weather · Jezero',
  }
  for (const station of Object.keys(positions) as WeatherStation[]) {
    const [lon, lat] = positions[station]
    const position = Cartesian3.fromDegrees(lon, lat, surfaceM(lon, lat), MARS_SPHERE)
    addClickables([
      {
        id: `${STATION_ID_PREFIX}${station}`,
        position,
        shown: () =>
          source.show && Cartesian3.distance(viewer.camera.positionWC, position) < STATION_MAX_M,
      },
    ])
    const entity = source.entities.add({
      id: `${STATION_ID_PREFIX}${station}`,
      position,
      point: {
        pixelSize: 14,
        color: Color.fromCssColorString('#0B3D91'),
        outlineColor: Color.WHITE,
        outlineWidth: 2,
        distanceDisplayCondition: STATION_RANGE,
        disableDepthTestDistance: PIN_DEPTH_TEST_OFF_WITHIN_M,
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
        distanceDisplayCondition: STATION_RANGE,
        disableDepthTestDistance: PIN_DEPTH_TEST_OFF_WITHIN_M,
      },
    })
    farSide.push({ position, setShow: (show) => void (entity.show = show) })
  }
  cullFarSide(viewer, farSide) // a pin past the horizon is never drawn
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
