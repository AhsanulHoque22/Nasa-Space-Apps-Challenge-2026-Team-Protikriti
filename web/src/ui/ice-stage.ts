/**
 * Mission 1.8's dig site in 3D, at true size: a cut-away of the ground under the base, the pit the
 * excavator opens as the sols pass, the spoil it piles up, the water tank it fills, a RASSOR-class
 * excavator and a person for scale. The pit follows M-WIP (2016): 16 t of water from 90% ice takes
 * an 8.5 m × 1 m × 2 m slot (17.4 m³). Shapes are drawn, not models: an illustration of the numbers.
 */
import { sceneHint } from './scene-hint'
import { holdStage } from './stage-loop'
import { type FeedstockId, MWIP_WATER_KG } from '../core/ice-water'
import { applyRegion, freeRegion } from './stage-region'

export type IceStage = {
  /** The source, and the depth to ice (m) when the source is ice. */
  setSource: (id: FeedstockId, iceDepthM: number) => void
  /** Water made and ground moved so far, kg. */
  setProgress: (waterKg: number, movedKg: number) => void
  remove: () => void
}

/** M-WIP slide 46: the slot for 16 t of water from ice. */
const SLOT = { lengthM: 8.5, widthM: 1, depthM: 2 }
/** Loose dug soil, kg/m³: a team assumption for drawing the spoil heap and the soil strip. */
const SOIL_KG_M3 = 1500
const ANGLE_OF_REPOSE_DEG = 45 // M-WIP slide 46 draws the pit walls at 45°
const PERSON_M = 1.8
/** RASSOR drum: the size limits of NASA's 2020 RASSOR drum challenge (450 mm × 360 mm). */
const DRUM = { diaM: 0.45, lengthM: 0.36 }
const BLOCK = { lengthM: 16, widthM: 8, depthM: 3.5 }
const STRIP_DEPTH_M = 0.3 // soil and mineral sources are scraped in shallow strips (drawn)

export async function openIceStage(): Promise<IceStage> {
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
  host.append(sceneHint('Drag to turn the dig site · scroll to zoom', renderer.domElement))
  const credit = document.createElement('p')
  credit.className = 'cargo-bay-credit'
  credit.textContent =
    'Illustration at true size. Ice slot 8.5 × 1 × 2 m for 16 t of water (NASA M-WIP 2016, slide 46); pit walls at 45°. Drums at the size limits of NASA’s RASSOR drum challenge; the body is drawn. Spoil heap at 1,500 kg/m³ (team assumption).'
  host.append(credit)

  const scene = new THREE.Scene()
  scene.add(new THREE.HemisphereLight(0xffe8d0, 0x30201a, 1.1))
  const sun = new THREE.DirectionalLight(0xffffff, 0.9)
  sun.position.set(-8, 12, 10)
  scene.add(sun)
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.maxPolarAngle = Math.PI / 1.9

  const mat = (color: number, extra: Record<string, unknown> = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra })
  const tag = (text: string) => {
    const div = document.createElement('div')
    div.setAttribute('aria-hidden', 'true')
    const span = document.createElement('span')
    span.className = 'journey-label'
    span.textContent = text
    div.append(span)
    return new CSS2DObject(div)
  }
  const setTag = (t: InstanceType<typeof CSS2DObject>, text: string) => {
    ;(t.element.firstChild as HTMLElement).textContent = text
  }

  // The ground as a cut-away block: the top of the block is the surface (y = 0).
  const ground = new THREE.Group()
  scene.add(ground)
  const lag = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat(0xa0613a))
  const ice = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    mat(0xcfe6f2, { roughness: 0.35, transparent: true, opacity: 0.92 }),
  )
  ground.add(lag, ice)
  const lagTag = tag('')
  const iceTag = tag('')
  ground.add(lagTag, iceTag)

  // The pit, drawn as a dark hole the size of what has been dug.
  const pit = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat(0x20120c))
  scene.add(pit)
  const pitTag = tag('')
  scene.add(pitTag)

  // Spoil heap: a cone of the dug ground that is not water.
  const heap = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 32), mat(0x8a5532))
  heap.position.set(-BLOCK.lengthM / 2 - 3, 0, -1)
  scene.add(heap)
  const heapTag = tag('')
  scene.add(heapTag)

  // Water tank: 1 m³ holds 1 t; the water inside rises as it fills.
  const TANK_R = 1.1
  const TANK_H = (MWIP_WATER_KG / 1000 / (Math.PI * TANK_R ** 2)) * 1.05
  const tank = new THREE.Mesh(
    new THREE.CylinderGeometry(TANK_R, TANK_R, TANK_H, 32, 1, true),
    mat(0xdfe3ea, { transparent: true, opacity: 0.25, side: THREE.DoubleSide }),
  )
  tank.position.set(BLOCK.lengthM / 2 + 3, TANK_H / 2, -1)
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(TANK_R * 0.97, TANK_R * 0.97, 1, 32),
    mat(0x3f8fe0, { roughness: 0.2 }),
  )
  scene.add(tank, water)
  const tankTag = tag('')
  tankTag.position.set(tank.position.x, TANK_H + 0.5, tank.position.z)
  scene.add(tankTag)

  // A RASSOR-class excavator: two drums on arms either side of a low body.
  const rassor = new THREE.Group()
  const drumGeo = new THREE.CylinderGeometry(DRUM.diaM / 2, DRUM.diaM / 2, DRUM.lengthM, 20)
  drumGeo.rotateZ(Math.PI / 2)
  for (const side of [-1, 1])
    for (const x of [-0.32, 0.32]) {
      const drum = new THREE.Mesh(drumGeo, mat(0x8c8f96, { metalness: 0.4 }))
      drum.position.set(x, DRUM.diaM / 2, side * 0.62)
      rassor.add(drum)
    }
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 0.6), mat(0xe8e6e0))
  body.position.y = 0.4
  rassor.add(body)
  rassor.rotation.y = Math.PI / 2
  scene.add(rassor)
  const rassorTag = tag('Excavator, 66 kg, two 40 kg drums')
  rassorTag.position.set(0, 1, 0)
  rassor.add(rassorTag)

  const person = new THREE.Group()
  const suit = mat(0xe8e6e0)
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, PERSON_M - 0.7, 6, 12), suit)
  torso.position.y = (PERSON_M - 0.25) / 2
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), suit)
  head.position.y = PERSON_M - 0.13
  person.add(torso, head)
  person.position.set(BLOCK.lengthM / 2 + 1, 0, 2.5)
  const personTag = tag(`Person, ${PERSON_M} m`)
  personTag.position.set(0, PERSON_M + 0.25, 0)
  person.add(personTag)
  scene.add(person)

  let source: FeedstockId = 'ice'
  let iceDepthM = 0.5

  const layers = () => {
    const isIce = source === 'ice'
    const top = isIce ? iceDepthM : BLOCK.depthM
    lag.scale.set(BLOCK.lengthM, top, BLOCK.widthM)
    lag.position.set(0, -top / 2, 0)
    ;(lag.material as InstanceType<typeof THREE.MeshStandardMaterial>).color.set(
      source === 'gypsum' ? 0xd8c8a8 : source === 'clay' ? 0x8f6a4a : 0xa0613a,
    )
    ice.visible = isIce
    ice.scale.set(BLOCK.lengthM, BLOCK.depthM - top, BLOCK.widthM)
    ice.position.set(0, -top - (BLOCK.depthM - top) / 2, 0)
    setTag(
      lagTag,
      isIce ? `Dry layer, ${iceDepthM.toFixed(1)} m (drawn)` : 'Ground dug in shallow strips',
    )
    lagTag.position.set(-BLOCK.lengthM / 2, -top / 2, BLOCK.widthM / 2)
    setTag(iceTag, 'Ice, about 90% pure (M-WIP Case A)')
    iceTag.position.set(-BLOCK.lengthM / 2, -top - 0.6, BLOCK.widthM / 2)
  }

  const setProgress = (waterKg: number, movedKg: number) => {
    const share = Math.min(1, waterKg / MWIP_WATER_KG)
    if (source === 'ice') {
      // The slot through the ice, plus the dry layer above it opened at 45°.
      const length = Math.max(0.01, SLOT.lengthM * share)
      const depth = iceDepthM + SLOT.depthM
      const opening =
        SLOT.widthM + (2 * iceDepthM) / Math.tan((ANGLE_OF_REPOSE_DEG * Math.PI) / 180)
      pit.scale.set(length, depth, opening)
      pit.position.set(-SLOT.lengthM / 2 + length / 2, -depth / 2 + 0.01, 0)
    } else {
      const area = movedKg / SOIL_KG_M3 / STRIP_DEPTH_M
      const side = Math.sqrt(Math.max(area, 0.0001))
      const length = Math.min(BLOCK.lengthM, side)
      const width = Math.min(BLOCK.widthM, area / length)
      pit.scale.set(length, STRIP_DEPTH_M, Math.max(0.01, width))
      pit.position.set(-BLOCK.lengthM / 2 + length / 2, -STRIP_DEPTH_M / 2 + 0.01, 0)
    }
    pit.visible = waterKg > 0
    setTag(pitTag, `Dug: ${(movedKg / 1000).toFixed(1)} t`)
    pitTag.position.set(pit.position.x, 0.6, 0)
    // The heap holds everything dug that did not become water.
    const spoilM3 = Math.max(0, movedKg - waterKg) / SOIL_KG_M3
    const r = Math.cbrt((3 * spoilM3) / Math.PI) || 0.001 // a 45° cone: height equals radius
    heap.scale.set(r, r, r)
    heap.position.y = r / 2
    heap.visible = spoilM3 > 0
    setTag(heapTag, `Spoil heap, ${spoilM3.toFixed(0)} m³`)
    heapTag.position.set(heap.position.x, r + 0.5, heap.position.z)
    const h = Math.max(0.001, waterKg / 1000 / (Math.PI * (TANK_R * 0.97) ** 2))
    water.scale.y = h
    water.position.set(tank.position.x, h / 2, tank.position.z)
    setTag(tankTag, `Water: ${(waterKg / 1000).toFixed(1)} of 16 t`)
    rassor.position.set(pit.position.x + pit.scale.x / 2 + 0.8, 0, 2)
  }

  const VIEW = new THREE.Vector3(0.45, 0.5, 0.95).normalize()
  const fit = { centre: new THREE.Vector3(0, -0.6, 0), radius: 13 }
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
    const d = (0.8 * fit.radius) / (Math.tan(halfFov) * Math.min(1, camera.aspect))
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

  layers()
  setProgress(0, 0)
  return {
    setSource: (id, depth) => {
      source = id
      iceDepthM = depth
      layers()
    },
    setProgress,
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
