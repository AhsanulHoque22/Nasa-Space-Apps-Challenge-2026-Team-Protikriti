/**
 * Keeps map markers on the drawn ground when that ground changes under them: a site's heights
 * arrive after its markers were placed on the coarse MOLA surface, or a walk patch loads. Each
 * marker keeps its lift above the ground (0 for a dot, a few metres for a label).
 */
import {
  BillboardCollection,
  Cartesian3,
  Cartographic,
  ConstantPositionProperty,
  ConstantProperty,
  type Entity,
  HeightReference,
  JulianDate,
  LabelCollection,
  PointPrimitiveCollection,
  PrimitiveCollection,
  type Viewer,
} from 'cesium'
import { allClickables } from './picking'
import { MARS_SPHERE } from './mars'
import type { Bounds } from './viewer'

// Past a site's edge its heights still blend into MOLA (walk-ground.ts feathers over 500 m).
const MARGIN_DEG = 0.05

type Seat = { at: Cartesian3; liftM: number; set: (p: Cartesian3) => void }
type Positioned = { position: Cartesian3; heightReference?: HeightReference }

const ungrounded = (h: unknown) => h === undefined || h === HeightReference.NONE

function primitivesOf(c: PrimitiveCollection, out: Positioned[]): void {
  for (let i = 0; i < c.length; i++) {
    const p: unknown = c.get(i)
    if (p instanceof PrimitiveCollection) primitivesOf(p, out)
    else if (
      p instanceof BillboardCollection ||
      p instanceof LabelCollection ||
      p instanceof PointPrimitiveCollection
    )
      for (let j = 0; j < p.length; j++) out.push(p.get(j) as Positioned)
  }
}

function entitiesOf(viewer: Viewer): Entity[] {
  const all = [...viewer.entities.values]
  for (let i = 0; i < viewer.dataSources.length; i++)
    all.push(...viewer.dataSources.get(i).entities.values)
  return all
}

/** True when none of the entity's graphics already follow the terrain by themselves. */
function entityUngrounded(e: Entity, now: JulianDate): boolean {
  return [e.point, e.billboard, e.label, e.model].every(
    (g) => !g || ungrounded(g.heightReference?.getValue(now)),
  )
}

export function reseatOnSurface(
  viewer: Viewer,
  b: Bounds,
  /** The drawn ground height (terrain x exaggeration), read before and after `change`. */
  surfaceM: (lon: number, lat: number) => number,
  change: () => void,
): void {
  const now = viewer.clock.currentTime
  const inside = (c: Cartographic) => {
    const lon = (c.longitude * 180) / Math.PI
    const lat = (c.latitude * 180) / Math.PI
    return (
      lon >= b.west - MARGIN_DEG &&
      lon <= b.east + MARGIN_DEG &&
      lat >= b.south - MARGIN_DEG &&
      lat <= b.north + MARGIN_DEG
    )
  }
  const seats: Seat[] = []
  const commits: Array<() => void> = []
  const seat = (at: Cartesian3 | undefined, set: (p: Cartesian3) => void) => {
    if (!at) return
    const c = Cartographic.fromCartesian(at, MARS_SPHERE)
    if (!c || !inside(c)) return
    const ground = surfaceM((c.longitude * 180) / Math.PI, (c.latitude * 180) / Math.PI)
    seats.push({ at, liftM: c.height - ground, set })
  }

  const items: Positioned[] = []
  primitivesOf(viewer.scene.primitives, items)
  for (const item of items)
    if (ungrounded(item.heightReference)) seat(item.position, (p) => (item.position = p))
  // Clickables are hit-tested at their own positions: move them in place with their dots.
  for (const c of allClickables()) seat(c.position, (p) => Cartesian3.clone(p, c.position))
  for (const e of entitiesOf(viewer)) {
    if (e.position instanceof ConstantPositionProperty && entityUngrounded(e, now))
      seat(e.position.getValue(now), (p) => (e.position = new ConstantPositionProperty(p)))
    const line = e.polyline
    if (line && !line.clampToGround?.getValue(now) && line.positions?.isConstant) {
      const points = line.positions.getValue(now) as Cartesian3[] | undefined
      if (!points?.length) continue
      const moved = [...points]
      points.forEach((p, i) => seat(p, (q) => (moved[i] = q)))
      // Set once after every point moved: one geometry rebuild per line.
      commits.push(() => (line.positions = new ConstantProperty(moved)))
    }
  }

  change()

  for (const s of seats) {
    const c = Cartographic.fromCartesian(s.at, MARS_SPHERE)
    const lon = (c.longitude * 180) / Math.PI
    const lat = (c.latitude * 180) / Math.PI
    s.set(Cartesian3.fromDegrees(lon, lat, surfaceM(lon, lat) + s.liftM, MARS_SPHERE))
  }
  for (const commit of commits) commit()
  viewer.scene.requestRender()
}
