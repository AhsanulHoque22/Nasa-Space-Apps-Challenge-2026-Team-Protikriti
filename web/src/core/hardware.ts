/**
 * Hardware on Mars, at true size: how big each 3D model is in its own units and how big the real
 * thing is (with its source), so the map can draw everything to scale.
 */

/** A model's bounding-box size in its own units; glTF axes, so `y` is up. */
export type Extent = { x: number; y: number; z: number }
/**
 * One sourced real dimension of the hardware. `axis` names the model axis it is measured along
 * when that is not the obvious one (height = y; length and diameter = the widest horizontal side).
 */
export type RealSize = {
  dimension: 'height' | 'length' | 'diameter'
  metres: number
  axis?: 'x' | 'y' | 'z'
}

/** The uniform scale that gives the model its real size along the sourced dimension. */
export function fitScale(extent: Extent, real: RealSize): number {
  const along = real.axis
    ? extent[real.axis]
    : real.dimension === 'height'
      ? extent.y
      : Math.max(extent.x, extent.z)
  return real.metres / along
}

export type Hardware = {
  id: string
  label: string
  url: string
  /** The model's bounding box in its own units (read from the file with glTF-Transform). */
  extent: Extent
  /** The lowest point of the model on its up axis, in its own units: lifted onto the ground. */
  floorY: number
  real: RealSize
  realSource: string
  credit: string
}

/** Every 3D model ATLAS draws on the map, with the real size it is scaled to. */
export const HARDWARE: readonly Hardware[] = [
  {
    id: 'habitat',
    label: 'Habitat',
    url: 'models/cargo/nasa-hdu.glb',
    extent: { x: 380.2, y: 217.4, z: 165.9 },
    floorY: 11.528,
    real: { dimension: 'diameter', metres: 5, axis: 'z' },
    realSource:
      'NASA’s Habitat Demonstration Unit: a 5 m diameter cylindrical shell (NASA Deep Space Habitat, Create the Future 2014 entry)',
    credit: 'Habitat Demonstration Unit, NASA 3D Resources',
  },
  {
    id: 'perseverance',
    label: 'Perseverance',
    url: 'models/perseverance.glb',
    extent: { x: 2.705, y: 1.846, z: 3.108 },
    floorY: 0.001,
    real: { dimension: 'length', metres: 3 },
    realSource: 'About 3 m (10 ft) long, NASA JPL Mars 2020 press kit',
    credit: 'Mars 2020 Perseverance Rover, NASA 3D Resources',
  },
  {
    id: 'curiosity',
    label: 'Curiosity',
    url: 'models/hardware/curiosity.glb',
    extent: { x: 2.756, y: 1.192, z: 3.267 },
    floorY: 0.633,
    real: { dimension: 'length', metres: 2.9 },
    realSource: '2.9 m long (Wikipedia: Curiosity rover)',
    credit: 'NASA Curiosity (Clean), Thomas Flynn (CC BY 4.0), from NASA’s model',
  },
  {
    id: 'spirit',
    label: 'Spirit',
    url: 'models/hardware/mer.glb',
    extent: { x: 8.691, y: 7.305, z: 12.708 },
    floorY: -2.407,
    real: { dimension: 'length', metres: 2.3 },
    realSource:
      '2.3 m wide across the solar wings (Mars Exploration Rover figures, solarviews.com; 1.5 m long per Wikipedia)',
    credit: 'Mars Exploration Rover, NASA 3D Resources',
  },
  {
    id: 'viking2',
    label: 'Viking 2 lander',
    url: 'models/viking-lander.glb',
    extent: { x: 16.739, y: 8.972, z: 12.552 },
    floorY: 0.207,
    real: { dimension: 'diameter', metres: 3, axis: 'z' },
    realSource:
      'About 3 m in diameter (NASA/JPL-Caltech/University of Arizona, HiRISE image of the Viking 2 lander)',
    credit: 'Viking Lander, NASA 3D Resources',
  },
  {
    id: 'lander-pod',
    label: 'Crew lander pod (stand-in)',
    url: 'models/landing/lander-pod.glb',
    extent: { x: 12.52, y: 10.08, z: 12.52 },
    floorY: 0.007,
    real: { dimension: 'diameter', metres: 3.9 },
    realSource:
      'No crewed Mars lander exists: sized as a crew capsule, the Apollo command module’s 3.9 m base diameter (NASA, Apollo CSM)',
    credit: 'Habitat Lander Pod, jmleach1987 (CC BY 4.0)',
  },
  {
    id: 'oxygen-plant',
    label: 'Oxygen plant (stand-in)',
    url: 'models/cargo/mars-cargo-container.glb',
    extent: { x: 2, y: 2, z: 3.708 },
    floorY: -1.0,
    real: { dimension: 'length', metres: 3.708 },
    realSource: 'Size not published: a stand-in crate at the model’s own size in metres',
    credit: 'Space container, Mars mission, Hansalex (CC BY 4.0)',
  },
]

/** A complete 10 kWe Kilopower unit is about 3.4 m tall (Space.com, reporting NASA's 2018 KRUSTY test). */
export const KILOPOWER_HEIGHT_M = 3.4
/** Solar array wings are 12 m across, four to a set (Rucker et al. 2016). */
export const ULTRAFLEX_WING_DIAMETER_M = 12
export const WINGS_PER_SET = 4

/** The rover's most recent position: the stop with the highest sol. */
export function latestStop<T extends { sol: number }>(stops: readonly T[]): T | null {
  return stops.reduce<T | null>((best, s) => (best && best.sol >= s.sol ? best : s), null)
}

/** Metres to raise a model so its lowest point stands on the ground. */
export function liftToGround(h: Hardware): number {
  return -h.floorY * fitScale(h.extent, h.real)
}

/**
 * Estimates for drawing the Kilopower unit, measured from NASA's concept art of the 10 kWe reactor
 * with its radiator deployed (only the 3.4 m height is published): the umbrella radiator is about
 * 2.7 times as wide as the unit is tall, and the column about 0.9 m across.
 */
export const KILOPOWER_RADIATOR_DIAMETER_M = 9
export const KILOPOWER_COLUMN_DIAMETER_M = 0.9
/** Spacing of the units in a farm, from the same art (about 2.5 radiator widths apart). */
export const KILOPOWER_SPACING_M = 25
/** Illustrative: how high an array wing's centre stands, and its tilt toward the equator. */
export const WING_MAST_M = 7
export const WING_TILT_DEG = 45

/** A point `east` and `north` metres from `p`, on the Mars sphere (small offsets). */
export function offsetM(
  p: { lon: number; lat: number },
  east: number,
  north: number,
): { lon: number; lat: number } {
  const r = 3_396_190
  const lat = p.lat + (north / r) * (180 / Math.PI)
  const lon = p.lon + (east / (r * Math.cos((p.lat * Math.PI) / 180))) * (180 / Math.PI)
  return { lon, lat }
}
