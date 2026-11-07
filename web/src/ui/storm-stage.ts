/**
 * Mission 1.7's base in the dust storm, in 3D: the habitat (NASA HDU model at its real 5 m), the
 * solar wings (12 m) and Kilopower units (3.4 m) packed in mission 1.1, under a sky that darkens as
 * the optical depth rises. The direct sunlight falls as e^(−τ / cos z) (Beer–Lambert); the haze and
 * blowing dust are drawn, not measured. Parts stand closer together than on the map.
 */
import { sceneHint } from './scene-hint'
import { holdStage } from './stage-loop'
import {
  HARDWARE,
  KILOPOWER_HEIGHT_M,
  KILOPOWER_RADIATOR_DIAMETER_M,
  ULTRAFLEX_WING_DIAMETER_M,
  WINGS_PER_SET,
  fitScale,
  liftToGround,
} from '../core/hardware'
import { applyRegion, freeRegion } from './stage-region'

export type StormStage = { setTau: (tau: number) => void; remove: () => void }

const SUN_ZENITH_DEG = 40 // an afternoon Sun, for the look of the light
const CLEAR_SKY = 0xd9a77a // butterscotch: the Martian sky on a clear day
const STORM_SKY = 0x5a2c18 // deep red-brown under heavy dust
const DUST_PARTICLES = 2500

export async function openStormStage(o: {
  kilopower: number
  solarSets: number
}): Promise<StormStage> {
  const THREE = await import('three')
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
  const { MeshoptDecoder } = await import('three/examples/jsm/libs/meshopt_decoder.module.js')
  const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js')
  const { CSS2DRenderer, CSS2DObject } =
    await import('three/examples/jsm/renderers/CSS2DRenderer.js')

  const host = document.createElement('div')
  host.className = 'cargo-bay storm-stage'
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  const releaseStage = holdStage(renderer)
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
  renderer.domElement.setAttribute('aria-hidden', 'true') // the dock says what is shown
  host.append(renderer.domElement)
  const labels = new CSS2DRenderer()
  labels.domElement.className = 'journey-labels'
  host.append(labels.domElement)
  host.append(sceneHint('Drag to turn the base · scroll to zoom', renderer.domElement))
  const credit = document.createElement('p')
  credit.className = 'cargo-bay-credit'
  credit.textContent =
    'True sizes, closer together than on the map. Habitat: NASA HDU model. Direct sunlight dims as e^(−τ/cos z); the haze and blowing dust are drawn to show the storm, not measured.'
  host.append(credit)

  const scene = new THREE.Scene()
  const sky = new THREE.Color(CLEAR_SKY)
  scene.background = sky
  scene.fog = new THREE.FogExp2(sky.getHex(), 0.002)
  const ambient = new THREE.HemisphereLight(0xffe2c4, 0x6a3a22, 0.8)
  scene.add(ambient)
  const sun = new THREE.DirectionalLight(0xfff1dd, 2.2)
  const z = (SUN_ZENITH_DEG * Math.PI) / 180
  sun.position.set(Math.sin(z) * 80, Math.cos(z) * 80, 40)
  scene.add(sun)
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(4, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff6e8, transparent: true, fog: false }),
  )
  sunDisc.position.copy(sun.position).multiplyScalar(3)
  sunDisc.lookAt(0, 0, 0)
  scene.add(sunDisc)

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(400, 64),
    new THREE.MeshStandardMaterial({ color: 0x9a5a36, roughness: 1 }),
  )
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)

  const tag = (text: string, x: number, y: number, zz: number) => {
    const div = document.createElement('div')
    div.setAttribute('aria-hidden', 'true')
    const span = document.createElement('span')
    span.className = 'journey-label'
    span.textContent = text
    div.append(span)
    const t = new CSS2DObject(div)
    t.position.set(x, y, zz)
    scene.add(t)
  }

  // The habitat, from the same model and real size as on the map.
  const hab = HARDWARE.find((h) => h.id === 'habitat')
  if (hab) {
    const loader = new GLTFLoader()
    loader.setMeshoptDecoder(MeshoptDecoder)
    // Loaded in the background: the storm scene shows at once and the habitat appears in it.
    void loader.loadAsync(hab.url).then((gltf) => {
      gltf.scene.scale.setScalar(fitScale(hab.extent, hab.real))
      gltf.scene.position.y = liftToGround(hab)
      scene.add(gltf.scene)
    })
    tag('Habitat', 0, 6, 0)
  }

  // Solar wings: 12 m discs on masts, tilted to the Sun.
  const wingMat = new THREE.MeshStandardMaterial({
    color: 0x2b3f6b,
    metalness: 0.3,
    roughness: 0.4,
  })
  const mastMat = new THREE.MeshStandardMaterial({ color: 0x9aa3ad })
  const wings = o.solarSets * WINGS_PER_SET
  for (let i = 0; i < wings; i++) {
    const g = new THREE.Group()
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 7, 8), mastMat)
    mast.position.y = 3.5
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(
        ULTRAFLEX_WING_DIAMETER_M / 2,
        ULTRAFLEX_WING_DIAMETER_M / 2,
        0.05,
        32,
      ),
      wingMat,
    )
    disc.position.y = 7
    disc.rotation.x = -0.6
    g.add(mast, disc)
    g.position.set(-25 - (i % 2) * 15, 0, -12 + Math.floor(i / 2) * 15)
    scene.add(g)
  }
  if (wings) tag(`Solar arrays · ${wings} wings`, -32, 13, 0)

  // Kilopower units: column under an umbrella radiator.
  const metal = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.5, roughness: 0.4 })
  const radiator = new THREE.MeshStandardMaterial({
    color: 0xc9ced4,
    metalness: 0.4,
    roughness: 0.5,
  })
  for (let i = 0; i < o.kilopower; i++) {
    const g = new THREE.Group()
    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.45, KILOPOWER_HEIGHT_M, 16),
      metal,
    )
    col.position.y = KILOPOWER_HEIGHT_M / 2
    const umb = new THREE.Mesh(
      new THREE.CylinderGeometry(KILOPOWER_RADIATOR_DIAMETER_M / 2, 0.6, 0.6, 32),
      radiator,
    )
    umb.position.y = KILOPOWER_HEIGHT_M
    g.add(col, umb)
    g.position.set(25 + (i % 2) * 12, 0, -10 + Math.floor(i / 2) * 12)
    scene.add(g)
  }
  if (o.kilopower) tag(`Kilopower · ${o.kilopower} units (really 1 km away)`, 31, 6, 0)

  // Blowing dust: particles drifting downwind, more of them as τ rises.
  const positions = new Float32Array(DUST_PARTICLES * 3)
  for (let i = 0; i < DUST_PARTICLES; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 140
    positions[i * 3 + 1] = Math.random() * 30
    positions[i * 3 + 2] = (Math.random() - 0.5) * 140
  }
  const dustGeo = new THREE.BufferGeometry()
  dustGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const dust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({ color: 0xc08055, size: 0.35, transparent: true, opacity: 0 }),
  )
  scene.add(dust)

  const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 2000)
  camera.position.set(28, 18, 52)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, 3, 0)
  controls.enableDamping = true
  controls.maxPolarAngle = Math.PI / 2.05
  controls.minDistance = 10
  controls.maxDistance = 140

  const dock = document.querySelector<HTMLElement>('.mission-dock')
  const resize = () => {
    applyRegion(host, freeRegion(dock))
    const w = host.clientWidth
    const h = Math.max(1, host.clientHeight)
    renderer.setSize(w, h, false)
    labels.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  document.body.append(host)
  window.addEventListener('resize', resize)
  const watch = new ResizeObserver(resize)
  if (dock) watch.observe(dock)
  resize()

  const clear = new THREE.Color(CLEAR_SKY)
  const storm = new THREE.Color(STORM_SKY)
  const setTau = (tau: number) => {
    const beam = Math.exp(-tau / Math.cos(z)) // Beer–Lambert: the direct beam through the dust
    const heavy = Math.min(1, tau / 8.5)
    sky.copy(clear).lerp(storm, heavy)
    ;(scene.fog as InstanceType<typeof THREE.FogExp2>).color.copy(sky)
    ;(scene.fog as InstanceType<typeof THREE.FogExp2>).density = 0.002 + 0.012 * heavy
    sun.intensity = 2.2 * beam
    ambient.intensity = 0.8 - 0.45 * heavy
    ;(sunDisc.material as InstanceType<typeof THREE.MeshBasicMaterial>).opacity = Math.max(
      0.03,
      beam,
    )
    ;(dust.material as InstanceType<typeof THREE.PointsMaterial>).opacity = 0.75 * heavy
  }
  setTau(0.65)

  let raf = 0
  let last = performance.now()
  const tick = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000)
    last = now
    const p = dustGeo.attributes.position as InstanceType<typeof THREE.BufferAttribute>
    for (let i = 0; i < DUST_PARTICLES; i++) {
      let x = p.getX(i) + dt * 9
      if (x > 70) x -= 140
      p.setX(i, x)
    }
    p.needsUpdate = true
    controls.update()
    renderer.render(scene, camera)
    labels.render(scene, camera)
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)

  return {
    setTau,
    remove: () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      watch.disconnect()
      controls.dispose()
      releaseStage()
      host.remove()
    },
  }
}
