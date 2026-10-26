/**
 * Mission 1.6's growth chamber in 3D, at true size: one bed per crop with the area chosen, plants
 * that rise to their mature height (NASA BVAD Rev2 Table 4-90) as the days pass, LED panels over
 * each bed, and a person for scale. The plant shapes are drawn, not models: an illustration of the
 * numbers. three.js loads only when the stage first opens, as in the other mission stages.
 */
import {
  AISLE_M,
  type Areas,
  BED_WIDTH_M,
  CROPS,
  type Crop,
  type CropId,
  bedLayout,
  canopyHeightM,
} from '../core/greenhouse'
import { applyRegion, freeRegion } from './stage-region'

export type GreenhouseStage = {
  setAreas: (areas: Areas) => void
  setDay: (day: number) => void
  remove: () => void
}

const PLANT_SPACING_M = 0.3 // the drawn plants' grid; not the real planting density
const LIGHT_GAP_M = 0.3 // LED panel above the canopy: BVAD Table 4-87 lighting height 0.15-0.3 m
const PERSON_M = 1.8
const MAX_PLANTS = 6000 // enough to fill the beds without slowing the page

/** A drawn look per crop: leaf colour, the ripe colour, and the plant's width against its height. */
const LOOK: Record<CropId, { leaf: number; ripe: number; width: number; tall: boolean }> = {
  lettuce: { leaf: 0x6fbf4a, ripe: 0x8fd35f, width: 1.3, tall: false },
  potato: { leaf: 0x3f8a3a, ripe: 0x5b9a3f, width: 0.9, tall: false },
  wheat: { leaf: 0x7fb24a, ripe: 0xd9b54a, width: 0.18, tall: true },
  soybean: { leaf: 0x4f9a45, ripe: 0x9aa84a, width: 0.8, tall: false },
  tomato: { leaf: 0x3e8a3e, ripe: 0xd8402c, width: 0.7, tall: false },
}

export async function openGreenhouseStage(): Promise<GreenhouseStage> {
  const THREE = await import('three')
  const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js')
  const { CSS2DRenderer, CSS2DObject } =
    await import('three/examples/jsm/renderers/CSS2DRenderer.js')

  const host = document.createElement('div')
  host.className = 'cargo-bay greenhouse-stage'
  const renderer = new THREE.WebGLRenderer({ antialias: true })
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
    'Illustration at true size. Bed areas are yours; plant heights at harvest from NASA BVAD Rev2 Table 4-90; LED panels 0.3 m above the plants (BVAD Table 4-87). Bed width, aisles and plant shapes are drawn, not measured.'
  host.append(credit)

  const scene = new THREE.Scene()
  scene.add(new THREE.HemisphereLight(0xffffff, 0x302838, 1.1))
  const key = new THREE.DirectionalLight(0xffffff, 0.8)
  key.position.set(6, 10, 8)
  scene.add(key)
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.maxPolarAngle = Math.PI / 2.05

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshStandardMaterial({ color: 0x2a2c34, roughness: 0.95 }),
  )
  floor.rotation.x = -Math.PI / 2
  scene.add(floor)

  // A person for scale: body and head, 1.8 m.
  const person = new THREE.Group()
  const suit = new THREE.MeshStandardMaterial({ color: 0xe8e6e0, roughness: 0.7 })
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, PERSON_M - 0.7, 6, 12), suit)
  body.position.y = (PERSON_M - 0.25) / 2
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), suit)
  head.position.y = PERSON_M - 0.13
  person.add(body, head)
  scene.add(person)

  const tag = (text: string) => {
    const div = document.createElement('div')
    div.setAttribute('aria-hidden', 'true')
    const span = document.createElement('span')
    span.className = 'journey-label'
    span.textContent = text
    div.append(span)
    return new CSS2DObject(div)
  }
  const personTag = tag(`Person, ${PERSON_M} m`)
  personTag.position.set(0, PERSON_M + 0.25, 0)
  person.add(personTag)

  type Bed = {
    crop: Crop
    group: InstanceType<typeof THREE.Group>
    plants: InstanceType<typeof THREE.InstancedMesh>
    fruit: InstanceType<typeof THREE.InstancedMesh> | null
    panel: InstanceType<typeof THREE.Group>
    label: InstanceType<typeof CSS2DObject>
    spots: [number, number][]
    m2: number
  }
  let beds: Bed[] = []
  let day = 0
  const beds3d = new THREE.Group()
  scene.add(beds3d)
  const dummy = new THREE.Object3D()
  const leafGeo = new THREE.SphereGeometry(0.5, 10, 8) // scaled per plant
  const stalkGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 6)
  const fruitGeo = new THREE.SphereGeometry(0.035, 8, 6)

  const placePlants = () => {
    for (const b of beds) {
      const look = LOOK[b.crop.id]
      const h = canopyHeightM(b.crop, day)
      const ripe = day >= b.crop.growthDays
      const colour = new THREE.Color(ripe ? look.ripe : look.leaf)
      b.spots.forEach(([x, z], i) => {
        const s = Math.max(h, 0.001)
        dummy.position.set(x, 0.2 + s / 2, z)
        const width = look.tall
          ? PLANT_SPACING_M * look.width
          : Math.min(PLANT_SPACING_M * 1.1, s * look.width)
        dummy.scale.set(width, s, width)
        dummy.updateMatrix()
        b.plants.setMatrixAt(i, dummy.matrix)
        b.plants.setColorAt(i, colour)
        if (b.fruit) {
          dummy.position.set(x + 0.05, 0.2 + s * 0.6, z)
          dummy.scale.setScalar(ripe ? 1 : 0)
          dummy.updateMatrix()
          b.fruit.setMatrixAt(i, dummy.matrix)
        }
      })
      b.plants.instanceMatrix.needsUpdate = true
      if (b.plants.instanceColor) b.plants.instanceColor.needsUpdate = true
      if (b.fruit) b.fruit.instanceMatrix.needsUpdate = true
      b.panel.position.y = 0.2 + Math.max(h, 0.05) + LIGHT_GAP_M
      const left = Math.max(0, b.crop.growthDays - day)
      const span = b.label.element.firstChild as HTMLElement
      span.textContent = `${b.crop.name} · ${b.m2} m² · ${left ? `harvest in ${Math.ceil(left)} days` : 'ready to harvest'}`
      b.label.position.set(0, b.panel.position.y + 0.2, b.m2 / BED_WIDTH_M / 2 + 0.4)
    }
  }

  const build = (areas: Areas) => {
    for (const b of beds) {
      b.plants.dispose()
      b.fruit?.dispose()
      b.label.element.remove()
    }
    beds3d.clear()
    beds = []
    const layout = bedLayout(areas)
    for (const { crop, m2, xM, lengthM: length } of layout) {
      const group = new THREE.Group()
      group.position.set(xM + BED_WIDTH_M / 2, 0, 0)
      const tray = new THREE.Mesh(
        new THREE.BoxGeometry(BED_WIDTH_M, 0.2, length),
        new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: 0.8 }),
      )
      tray.position.y = 0.1
      group.add(tray)
      const spots: [number, number][] = []
      for (
        let px = -BED_WIDTH_M / 2 + PLANT_SPACING_M / 2;
        px < BED_WIDTH_M / 2;
        px += PLANT_SPACING_M
      )
        for (let pz = -length / 2 + PLANT_SPACING_M / 2; pz < length / 2; pz += PLANT_SPACING_M)
          spots.push([px, pz])
      spots.length = Math.min(spots.length, Math.floor(MAX_PLANTS / CROPS.length))
      const look = LOOK[crop.id]
      const plants = new THREE.InstancedMesh(
        look.tall ? stalkGeo : leafGeo,
        new THREE.MeshStandardMaterial({ roughness: 0.75 }),
        spots.length,
      )
      group.add(plants)
      const fruit =
        crop.id === 'tomato'
          ? new THREE.InstancedMesh(
              fruitGeo,
              new THREE.MeshStandardMaterial({ color: 0xd8402c }),
              spots.length,
            )
          : null
      if (fruit) group.add(fruit)
      // The LED panel: see-through glowing bars, so the plants under them stay in view.
      const panel = new THREE.Group()
      const barMat = new THREE.MeshStandardMaterial({
        color: 0x2a1030,
        emissive: 0xff5ad8,
        emissiveIntensity: 1.1,
        transparent: true,
        opacity: 0.85,
      })
      const BAR_EVERY_M = 0.6
      for (let z = -length / 2 + BAR_EVERY_M / 2; z < length / 2; z += BAR_EVERY_M) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(BED_WIDTH_M, 0.03, 0.08), barMat)
        bar.position.z = z
        panel.add(bar)
      }
      group.add(panel)
      const glow = new THREE.PointLight(0xff7ae0, 1.2, 3, 1.5)
      glow.position.y = -0.2
      panel.add(glow)
      const label = tag('')
      group.add(label)
      beds3d.add(group)
      beds.push({ crop, group, plants, fruit, panel, label, spots, m2 })
    }
    const x = layout.length * (BED_WIDTH_M + AISLE_M)
    person.position.set(x + 0.4, 0, 0)
    const width = Math.max(x + 1.5, 4)
    const deep = Math.max(...beds.map((b) => b.m2 / BED_WIDTH_M), 3) + 2
    floor.scale.set(width + 2, deep + 2, 1)
    floor.position.set(width / 2 - 0.5, 0, 0)
    placePlants()
    frame(width, deep)
  }

  const VIEW = new THREE.Vector3(0.35, 0.55, 0.95).normalize()
  const CLOSER = 0.75 // the beds fill more of the view
  let fit = { centre: new THREE.Vector3(), radius: 4 }
  const frame = (width: number, deep: number) => {
    fit = {
      centre: new THREE.Vector3(width / 2 - 0.5, 0.4, 0),
      radius: Math.hypot(width, deep) / 2 + 1,
    }
    resize()
  }
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
    const d = (CLOSER * fit.radius) / (Math.tan(halfFov) * Math.min(1, camera.aspect))
    controls.target.copy(fit.centre)
    camera.position.copy(fit.centre).add(VIEW.clone().multiplyScalar(d))
    controls.minDistance = 1
    controls.maxDistance = d * 3
  }
  document.body.append(host)
  window.addEventListener('resize', resize)
  const watchDock = new ResizeObserver(resize)
  if (dock) watchDock.observe(dock)

  let raf = 0
  const tick = () => {
    controls.update()
    renderer.render(scene, camera)
    labels.render(scene, camera)
    raf = requestAnimationFrame(tick)
  }
  tick()

  return {
    setAreas: build,
    setDay: (d) => {
      day = d
      placePlants()
    },
    remove: () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      watchDock.disconnect()
      controls.dispose()
      renderer.dispose()
      host.remove()
    },
  }
}
