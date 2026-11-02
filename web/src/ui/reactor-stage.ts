/**
 * Mission 1.10's reactor field in 3D, at true size: the Kilopower units packed in mission 1.1 in a
 * row 25 m apart (3.4 m tall, umbrella radiators about 9 m across, as on the map), the failed one
 * dark with a warning, the others glowing as they run, and a person for scale. Drawn shapes.
 */
import { holdStage } from './stage-loop'
import {
  KILOPOWER_COLUMN_DIAMETER_M,
  KILOPOWER_HEIGHT_M,
  KILOPOWER_RADIATOR_DIAMETER_M,
  KILOPOWER_SPACING_M,
} from '../core/hardware'
import { applyRegion, freeRegion } from './stage-region'

export type ReactorStage = { remove: () => void }

const PERSON_M = 1.8
const RADIATOR_THICKNESS_M = 0.08

export async function openReactorStage(units: number, failed: number): Promise<ReactorStage> {
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
  const credit = document.createElement('p')
  credit.className = 'cargo-bay-credit'
  credit.textContent =
    'Illustration at true size: units 3.4 m tall (NASA, 2018); radiator width and spacing measured from NASA’s concept art, as on the map.'
  host.append(credit)

  const scene = new THREE.Scene()
  scene.add(new THREE.HemisphereLight(0xffe8d0, 0x30201a, 1.0))
  const sun = new THREE.DirectionalLight(0xffffff, 0.9)
  sun.position.set(-20, 30, 20)
  scene.add(sun)
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 2000)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.maxPolarAngle = Math.PI / 2.05

  const mat = (color: number, extra: Record<string, unknown> = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...extra })
  const tag = (text: string, warn = false) => {
    const div = document.createElement('div')
    div.setAttribute('aria-hidden', 'true')
    const span = document.createElement('span')
    span.className = warn ? 'journey-label warn' : 'journey-label'
    span.textContent = text
    div.append(span)
    return new CSS2DObject(div)
  }

  const width = Math.max(1, units - 1) * KILOPOWER_SPACING_M
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(width + 60, 60),
    mat(0x9a5a36, { roughness: 1 }),
  )
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)

  const column = KILOPOWER_HEIGHT_M - RADIATOR_THICKNESS_M
  for (let i = 0; i < units; i++) {
    const dead = i === failed
    const unit = new THREE.Group()
    unit.position.x = i * KILOPOWER_SPACING_M - width / 2
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(
        KILOPOWER_COLUMN_DIAMETER_M / 2,
        KILOPOWER_COLUMN_DIAMETER_M / 2,
        column,
        24,
      ),
      dead ? mat(0x3a3d44) : mat(0x9aa3ad, { metalness: 0.5 }),
    )
    body.position.y = column / 2
    const radiator = new THREE.Mesh(
      new THREE.ConeGeometry(KILOPOWER_RADIATOR_DIAMETER_M / 2, 1.2, 40, 1, true),
      dead
        ? mat(0x2b2d33, { side: THREE.DoubleSide })
        : mat(0xc9ced4, {
            side: THREE.DoubleSide,
            emissive: 0xff7a2a,
            emissiveIntensity: 0.18,
          }),
    )
    radiator.position.y = KILOPOWER_HEIGHT_M - 0.6
    unit.add(body, radiator)
    const label = tag(
      dead ? `Unit ${i + 1}: failed, 0 kW` : `Unit ${i + 1}: running, 8.75 kW`,
      dead,
    )
    label.position.y = KILOPOWER_HEIGHT_M + 1.2
    unit.add(label)
    scene.add(unit)
  }

  const suit = mat(0xe8e6e0)
  const person = new THREE.Group()
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, PERSON_M - 0.7, 6, 12), suit)
  torso.position.y = (PERSON_M - 0.25) / 2
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), suit)
  head.position.y = PERSON_M - 0.13
  person.add(torso, head)
  person.position.set(failed * KILOPOWER_SPACING_M - width / 2 + 6, 0, 6)
  const personTag = tag(`Person, ${PERSON_M} m`)
  personTag.position.set(0, PERSON_M + 0.25, 0)
  person.add(personTag)
  scene.add(person)

  const VIEW = new THREE.Vector3(0.3, 0.18, 0.95).normalize() // low, so the columns show under the radiators
  // Frame the failed unit and its neighbour: the whole field is too wide to read.
  const focusX =
    failed * KILOPOWER_SPACING_M - width / 2 + (units > 1 ? KILOPOWER_SPACING_M / 2 : 0)
  const fit = { centre: new THREE.Vector3(focusX, 2, 0), radius: KILOPOWER_SPACING_M / 2 + 6 }
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
    const d = (0.9 * fit.radius) / (Math.tan(halfFov) * Math.min(1, camera.aspect))
    controls.target.copy(fit.centre)
    camera.position.copy(fit.centre).add(VIEW.clone().multiplyScalar(d))
    controls.minDistance = 3
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
