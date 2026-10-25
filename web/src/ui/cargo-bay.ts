/**
 * The cargo bay in 3D, shown in front of the turning globe during mission 1.1's packing steps.
 * NASA's Habitat Demonstration Unit stands in for the 21.5 t habitat; every packed item appears as a cargo
 * container labelled with what it holds. No real cargo-lander model exists in our library, so the
 * deck is a plain disc and says so. three.js loads only when the bay first opens.
 */
import { CARGO_ITEMS, type CargoPlan } from '../core/cargo'
import { applyRegion, freeRegion } from './stage-region'

export type CargoBay = { update: (plan: CargoPlan) => void; remove: () => void }

const HABITAT_URL = 'models/cargo/nasa-hdu.glb'
const CONTAINER_URL = 'models/cargo/mars-cargo-container.glb'
const DECK_RADIUS = 1.6
const SPIN_RAD_PER_S = 0.12
/** Radius the camera keeps in view: the deck plus room for crate labels. */
const FIT_RADIUS = DECK_RADIUS + 0.5

export async function openCargoBay(plan: CargoPlan): Promise<CargoBay> {
  const THREE = await import('three')
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
  const { MeshoptDecoder } = await import('three/examples/jsm/libs/meshopt_decoder.module.js')
  const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js')
  const { CSS2DRenderer, CSS2DObject } =
    await import('three/examples/jsm/renderers/CSS2DRenderer.js')

  const host = document.createElement('div')
  host.className = 'cargo-bay'
  host.setAttribute('aria-hidden', 'true') // the dock lists every packed item in text
  const credit = document.createElement('p')
  credit.className = 'cargo-bay-credit'
  credit.innerHTML =
    'Habitat: <a href="https://github.com/nasa/NASA-3D-Resources/tree/master/3D%20Models/Habitat%20Demonstration%20Unit" target="_blank" rel="noopener">Habitat Demonstration Unit</a>, NASA 3D Resources. Cargo: <a href="https://sketchfab.com/3d-models/space-container-mars-mission-ea0983b287ad49769e988107039c22a6" target="_blank" rel="noopener">Space container, Mars mission</a>, Hansalex (CC BY 4.0). The deck is a stand-in, not a real lander design.'
  host.append(credit)

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }) // the globe shows through
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
  renderer.setClearColor(0x000000, 0)
  host.prepend(renderer.domElement)
  const labels = new CSS2DRenderer()
  labels.domElement.className = 'journey-labels'
  host.append(labels.domElement)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 50)
  const VIEW_DIRECTION = new THREE.Vector3(0, 0.46, 0.89).normalize() // a little above the deck
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.enablePan = false
  controls.minDistance = 2.5
  controls.maxDistance = 16
  controls.target.set(0, 0.35, 0)
  controls.maxPolarAngle = Math.PI / 2.1 // never look from under the deck
  scene.add(new THREE.HemisphereLight(0xffffff, 0x553322, 1.4))
  const sunLight = new THREE.DirectionalLight(0xffffff, 2)
  sunLight.position.set(3, 5, 2)
  scene.add(sunLight)

  const turntable = new THREE.Group()
  scene.add(turntable)
  const deck = new THREE.Mesh(
    new THREE.CylinderGeometry(DECK_RADIUS, DECK_RADIUS, 0.06, 64),
    new THREE.MeshStandardMaterial({ color: 0x3a4357, roughness: 0.8, metalness: 0.3 }),
  )
  deck.position.y = -0.03
  turntable.add(deck)

  const label = (text: string, height = 0) => {
    const div = document.createElement('div')
    const span = document.createElement('span')
    span.className = 'journey-label'
    span.textContent = text
    div.append(span)
    const tag = new CSS2DObject(div)
    tag.position.set(0, height, 0) // Object3D.position is read-only: set it, never assign it
    return tag
  }

  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)
  const fitted = async (url: string, size: number) => {
    const gltf = await loader.loadAsync(url)
    const model = gltf.scene
    const box = new THREE.Box3().setFromObject(model)
    const dims = box.getSize(new THREE.Vector3())
    model.scale.setScalar(size / Math.max(dims.x, dims.y, dims.z))
    const scaled = new THREE.Box3().setFromObject(model)
    const centre = scaled.getCenter(new THREE.Vector3())
    model.position.sub(new THREE.Vector3(centre.x, scaled.min.y, centre.z)) // stand on the deck
    const holder = new THREE.Group()
    holder.add(model)
    return holder
  }
  const [habitat, container] = await Promise.all([
    fitted(HABITAT_URL, 1.4),
    fitted(CONTAINER_URL, 0.38),
  ])
  habitat.add(label('Habitat · 21.5 t', 1.0))
  turntable.add(habitat)

  const cargo = new THREE.Group()
  turntable.add(cargo)
  const update = (p: CargoPlan) => {
    // clear() drops the 3D objects but leaves nested labels' elements on the page: remove them first.
    cargo.traverse((o) => {
      if (o instanceof CSS2DObject) o.element.remove()
    })
    cargo.clear()
    const packed = CARGO_ITEMS.filter((i) => p[i.id] > 0)
    packed.forEach((item, k) => {
      const angle = (k / Math.max(1, packed.length)) * Math.PI * 2 + Math.PI / 4
      const r = DECK_RADIUS * 0.72
      const count = item.unit === 'sols' || item.unit === 'kg' ? 1 : p[item.id] // one crate for supplies
      const group = new THREE.Group()
      for (let n = 0; n < count; n++) {
        const crate = container.clone()
        crate.position.set(0, n * 0.3, 0) // stacked: one crate per unit packed
        group.add(crate)
      }
      group.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r)
      group.lookAt(0, 0, 0)
      const text = count > 1 || item.unit === 'units' ? `${item.label} ×${p[item.id]}` : item.label
      group.add(label(text, count * 0.3 + 0.15))
      cargo.add(group)
    })
  }
  update(plan)

  const dock = document.querySelector<HTMLElement>('.mission-dock')
  const resize = () => {
    applyRegion(host, freeRegion(dock))
    const w = host.clientWidth
    const h = Math.max(1, host.clientHeight)
    renderer.setSize(w, h, false)
    labels.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    // Keep the whole deck and its labels in view, whatever the shape of the free screen.
    const halfFov = ((camera.fov / 2) * Math.PI) / 180
    const fit = FIT_RADIUS / (Math.tan(halfFov) * Math.min(1, camera.aspect))
    camera.position.copy(controls.target).add(VIEW_DIRECTION.clone().multiplyScalar(fit))
  }
  // Join the page only now: models loaded, so no empty layer ever covers the globe.
  document.body.append(host)
  window.addEventListener('resize', resize)
  const watchDock = new ResizeObserver(resize)
  if (dock) watchDock.observe(dock)
  resize()

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let last = performance.now()
  let frame = 0
  const tick = () => {
    const now = performance.now()
    if (!reduced) turntable.rotation.y += SPIN_RAD_PER_S * ((now - last) / 1000)
    last = now
    controls.update()
    renderer.render(scene, camera)
    labels.render(scene, camera)
    frame = requestAnimationFrame(tick)
  }
  tick()

  return {
    update,
    remove: () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
      watchDock.disconnect()
      controls.dispose()
      renderer.dispose()
      host.remove()
    },
  }
}
