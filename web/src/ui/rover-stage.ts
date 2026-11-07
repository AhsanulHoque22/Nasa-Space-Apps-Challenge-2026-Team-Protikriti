/**
 * Mission 1.9's pressurised rover in 3D, at true size: NASA's Space Exploration Vehicle concept
 * (fact sheet, 2011: 14.7 ft long, 10 ft high, 12 wheels 39 in across), two suits docked on its
 * rear suitports, a person for scale and, with the power-cart plan, a Kilopower unit on a trailer.
 * Shapes are drawn from those dimensions, not a model of the real vehicle.
 */
import { sceneHint } from './scene-hint'
import { holdStage } from './stage-loop'
import {
  KILOPOWER_COLUMN_DIAMETER_M,
  KILOPOWER_HEIGHT_M,
  KILOPOWER_RADIATOR_DIAMETER_M,
} from '../core/hardware'
import { ROVER } from '../core/traverse'
import { roverBody } from './rover-body'
import { applyRegion, freeRegion } from './stage-region'

export type RoverStage = {
  /** Show the power cart behind the rover. */
  setCart: (on: boolean) => void
  remove: () => void
}

const PERSON_M = 1.8
const CART_GAP_M = 3

export async function openRoverStage(): Promise<RoverStage> {
  const THREE = await import('three')
  const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js')
  const { CSS2DRenderer, CSS2DObject } =
    await import('three/examples/jsm/renderers/CSS2DRenderer.js')

  const host = document.createElement('div')
  host.className = 'cargo-bay greenhouse-stage'
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  const releaseStage = holdStage(renderer)
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
  renderer.setClearColor(0x0b0d16, 1)
  renderer.domElement.setAttribute('aria-hidden', 'true') // the dock says what is shown
  host.append(renderer.domElement)
  const labels = new CSS2DRenderer()
  labels.domElement.className = 'journey-labels'
  host.append(labels.domElement)
  host.append(sceneHint('Drag to turn the rover · scroll to zoom', renderer.domElement))
  const credit = document.createElement('p')
  credit.className = 'cargo-bay-credit'
  credit.textContent =
    'Illustration at true size from NASA’s SEV fact sheet (2011): 4.5 m long, 3 m high, 12 wheels 1 m across. Cabin shape, track width and cart are drawn. Kilopower size as on the map (mission 1.4).'
  host.append(credit)

  const scene = new THREE.Scene()
  scene.add(new THREE.HemisphereLight(0xffe8d0, 0x30201a, 1.1))
  const sun = new THREE.DirectionalLight(0xffffff, 0.9)
  sun.position.set(-6, 10, 8)
  scene.add(sun)
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.maxPolarAngle = Math.PI / 2.05

  const mat = (color: number, extra: Record<string, unknown> = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...extra })
  const tag = (text: string) => {
    const div = document.createElement('div')
    div.setAttribute('aria-hidden', 'true')
    const span = document.createElement('span')
    span.className = 'journey-label'
    span.textContent = text
    div.append(span)
    return new CSS2DObject(div)
  }

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), mat(0x9a5a36, { roughness: 1 }))
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)

  const { rover, wheelGeo, tyre, suit, r, cabin, cabinL } = roverBody(THREE)
  scene.add(rover)
  const roverTag = tag(
    `Pressurised rover · ${(ROVER.massKg / 1000).toFixed(1)} t · 2 crew, 14 days`,
  )
  roverTag.position.set(0, ROVER.heightM + 0.5, 0)
  rover.add(roverTag)
  const portTag = tag('Suitports: suits dock to the back')
  portTag.position.set(cabin.position.x - cabinL / 2 - 0.4, cabin.position.y + 1.1, 1.3)
  rover.add(portTag)

  // The power cart: a trailer carrying one Kilopower unit, radiator folded up to its column.
  const cart = new THREE.Group()
  const bed = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.3, 2.2),
    mat(0x9aa3ad, { metalness: 0.4 }),
  )
  bed.position.y = 0.9
  cart.add(bed)
  for (const x of [-0.8, 0.8])
    for (const z of [-1.1, 1.1]) {
      const w = new THREE.Mesh(wheelGeo, tyre)
      w.position.set(x, r, z)
      cart.add(w)
    }
  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(
      KILOPOWER_COLUMN_DIAMETER_M / 2,
      KILOPOWER_COLUMN_DIAMETER_M / 2,
      KILOPOWER_HEIGHT_M,
      20,
    ),
    mat(0x9aa3ad, { metalness: 0.5 }),
  )
  column.position.y = 1.05 + KILOPOWER_HEIGHT_M / 2
  cart.add(column)
  const cartTag = tag(
    `Power cart: one Kilopower, 8.75 kW (radiator ${KILOPOWER_RADIATOR_DIAMETER_M} m across when open)`,
  )
  cartTag.position.set(0, 1.05 + KILOPOWER_HEIGHT_M + 0.5, 0)
  cart.add(cartTag)
  cart.position.set(-ROVER.lengthM / 2 - CART_GAP_M - 1.2, 0, 0)
  cart.visible = false
  scene.add(cart)

  const person = new THREE.Group()
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, PERSON_M - 0.7, 6, 12), suit)
  torso.position.y = (PERSON_M - 0.25) / 2
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), suit)
  head.position.y = PERSON_M - 0.13
  person.add(torso, head)
  person.position.set(ROVER.lengthM / 2 + 1.6, 0, 2.2)
  const personTag = tag(`Person, ${PERSON_M} m`)
  personTag.position.set(0, PERSON_M + 0.25, 0)
  person.add(personTag)
  scene.add(person)

  const VIEW = new THREE.Vector3(0.6, 0.45, 0.85).normalize()
  const fit = { centre: new THREE.Vector3(-1.5, 1.4, 0), radius: 7 }
  const dock = document.querySelector<HTMLElement>('.mission-dock')
  const resize = () => {
    applyRegion(host, freeRegion(dock))
    const w = host.clientWidth
    const h = Math.max(1, host.clientHeight)
    renderer.setSize(w, h, false)
    labels.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    const halfFov = ((camera.fov / 2) * Math.PI) / 180
    const d = (0.85 * fit.radius) / (Math.tan(halfFov) * Math.min(1, camera.aspect))
    controls.target.copy(fit.centre)
    camera.position.copy(fit.centre).add(VIEW.clone().multiplyScalar(d))
    controls.minDistance = 2
    controls.maxDistance = d * 3
  }
  document.body.append(host)
  window.addEventListener('resize', resize)
  const watchDock = new ResizeObserver(resize)
  if (dock) watchDock.observe(dock)
  resize()

  let raf = 0
  const tick = () => {
    controls.update()
    renderer.render(scene, camera)
    labels.render(scene, camera)
    raf = requestAnimationFrame(tick)
  }
  tick()

  return {
    setCart: (on) => {
      cart.visible = on
    },
    remove: () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      watchDock.disconnect()
      controls.dispose()
      releaseStage()
      host.remove()
    },
  }
}
