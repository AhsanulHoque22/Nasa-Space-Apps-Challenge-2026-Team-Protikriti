/**
 * NASA's Space Exploration Vehicle concept as a 3D body at true size, in metres, from the fact sheet
 * (2011: 14.7 ft long, 10 ft high, 12 wheels 39 in across): the shared shape for the rover stage and
 * the rover on the map. Drawn from those dimensions, not a model of the real vehicle.
 */
import { ROVER } from '../core/traverse'

const WHEEL_WIDTH_M = 12 * 0.0254 // fact sheet: 12 in wide
const TRACK_M = 3.2 // across the outer wheels: drawn

export function roverBody(THREE: typeof import('three')) {
  const mat = (color: number, extra: Record<string, unknown> = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...extra })
  // The rover: 12 wheels, a chassis deck and a cabin with a rounded front (+x is forward).
  const rover = new THREE.Group()
  const r = ROVER.wheelDiaM / 2
  const wheelGeo = new THREE.CylinderGeometry(r, r, WHEEL_WIDTH_M, 24)
  wheelGeo.rotateX(Math.PI / 2)
  const tyre = mat(0xd98a2b)
  for (let k = 0; k < 6; k++)
    for (const side of [-1, 1]) {
      const w = new THREE.Mesh(wheelGeo, tyre)
      w.position.set(
        -ROVER.lengthM / 2 + r + (k * (ROVER.lengthM - 2 * r)) / 5,
        r,
        (side * TRACK_M) / 2,
      )
      rover.add(w)
    }
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(ROVER.lengthM, 0.25, TRACK_M - 0.4),
    mat(0x9aa3ad, { metalness: 0.4 }),
  )
  deck.position.y = 2 * r
  rover.add(deck)
  const cabinH = ROVER.heightM - 2 * r - 0.15
  const cabinL = ROVER.lengthM - 1.1
  const white = mat(0xeeeeea, { roughness: 0.5 })
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(cabinL, cabinH, 2.4), white)
  cabin.position.set(-0.3, 2 * r + 0.12 + cabinH / 2, 0)
  rover.add(cabin)
  const nose = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.2, cabinH, 24, 1, false, 0, Math.PI),
    white,
  )
  nose.position.set(cabin.position.x + cabinL / 2, cabin.position.y, 0)
  rover.add(nose)
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(
      1.22,
      1.22,
      cabinH * 0.45,
      24,
      1,
      true,
      Math.PI * 0.15,
      Math.PI * 0.7,
    ),
    mat(0x223344, { roughness: 0.1, metalness: 0.6 }),
  )
  glass.position.set(nose.position.x, cabin.position.y + cabinH * 0.12, 0)
  rover.add(glass)
  // Two suits on the rear suitports, backs to the cabin.
  const suit = mat(0xf2f0ea)
  for (const z of [-0.55, 0.55]) {
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.9, 6, 12), suit)
    body.position.set(cabin.position.x - cabinL / 2 - 0.32, cabin.position.y + 0.1, z)
    rover.add(body)
  }
  return { rover, wheelGeo, tyre, suit, r, cabin, cabinL }
}
