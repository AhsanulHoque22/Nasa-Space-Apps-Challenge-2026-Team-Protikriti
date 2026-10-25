/**
 * Mission 1.3's landers in 3D, in front of the map flown down to the landing spot: the crew's
 * lander pod and, when its model has been added, the cargo rocket that landed 26 months earlier.
 * Both are stand-ins, drawn at their own size in metres and credited on screen. three.js loads
 * only when the stage first opens (the same approach as the mission 1.1 cargo bay).
 */
import { applyRegion, freeRegion } from './stage-region'

export type LandingStage = { remove: () => void; rocket: boolean }

const POD_URL = 'models/landing/lander-pod.glb'
/** Added by hand: Sketchfab needs a login to download (see docs/story-mode-guide.md). */
const ROCKET_URL = 'models/landing/starship-cargo.glb'
const GAP_M = 12 // between the two landers
const SPIN_RAD_PER_S = 0.1

/** The dev server answers a missing file with the app page, so check the type too. */
async function exists(url: string): Promise<boolean> {
  return fetch(url, { method: 'HEAD' })
    .then((r) => r.ok && !(r.headers.get('content-type') ?? '').includes('text/html'))
    .catch(() => false)
}

export async function openLandingStage(): Promise<LandingStage> {
  const THREE = await import('three')
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
  const { MeshoptDecoder } = await import('three/examples/jsm/libs/meshopt_decoder.module.js')
  const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js')
  const { CSS2DRenderer, CSS2DObject } =
    await import('three/examples/jsm/renderers/CSS2DRenderer.js')

  const host = document.createElement('div')
  host.className = 'cargo-bay landing-stage'
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }) // the map shows through
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
  renderer.setClearColor(0x000000, 0)
  renderer.domElement.setAttribute('aria-hidden', 'true') // the dock says what is shown
  host.append(renderer.domElement)
  const labels = new CSS2DRenderer()
  labels.domElement.className = 'journey-labels'
  host.append(labels.domElement)

  const scene = new THREE.Scene()
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8aea4, 1.6))
  const sun = new THREE.DirectionalLight(0xffffff, 1.8)
  sun.position.set(30, 60, 40)
  scene.add(sun)
  const camera = new THREE.PerspectiveCamera(35, 1, 0.5, 2000)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.enablePan = false
  controls.maxPolarAngle = Math.PI / 2.05 // never look from under the ground

  const label = (text: string, height: number) => {
    const div = document.createElement('div')
    div.setAttribute('aria-hidden', 'true')
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
  /** A model standing on y = 0, centred on x/z, at its own size in metres. */
  const standing = async (url: string) => {
    const model = (await loader.loadAsync(url)).scene
    const box = new THREE.Box3().setFromObject(model)
    const centre = box.getCenter(new THREE.Vector3())
    model.position.sub(new THREE.Vector3(centre.x, box.min.y, centre.z))
    const holder = new THREE.Group()
    holder.add(model)
    const size = box.getSize(new THREE.Vector3())
    return { holder, size }
  }

  const rocket = await exists(ROCKET_URL)
  const [pod, cargo] = await Promise.all([
    standing(POD_URL),
    rocket ? standing(ROCKET_URL) : Promise.resolve(null),
  ])
  const group = new THREE.Group()
  scene.add(group)
  pod.holder.add(label('Crew lander pod', pod.size.y + 2))
  group.add(pod.holder)
  if (cargo) {
    const offset = (pod.size.x + cargo.size.x) / 2 + GAP_M
    pod.holder.position.x = -offset / 2
    cargo.holder.position.x = offset / 2
    cargo.holder.add(label('Cargo rocket (illustration)', cargo.size.y + 2))
    group.add(cargo.holder)
  }

  const credit = document.createElement('p')
  credit.className = 'cargo-bay-credit'
  credit.innerHTML = `Stand-in models, not to the map’s scale. Crew lander: <a href="https://sketchfab.com/3d-models/none-9a55af34f7654097bd72f0642d83ccce" target="_blank" rel="noopener">Habitat Lander Pod</a>, jmleach1987 (CC BY 4.0).${
    cargo
      ? ' Cargo rocket: <a href="https://sketchfab.com/3d-models/none-0c0b3a7708d04ee995e304f899d7b52b" target="_blank" rel="noopener">SpaceX Starship Cargo</a>, AllThingsSpace (CC BY 4.0), a different design shown for illustration: every number in ATLAS uses NASA’s DRA 5.0 vehicles.'
      : ''
  }`
  host.append(credit)

  // Frame everything, whatever the shape of the free screen.
  const bounds = new THREE.Box3().setFromObject(group)
  const radius = bounds.getSize(new THREE.Vector3()).length() / 2 + 4
  const target = bounds.getCenter(new THREE.Vector3())
  controls.target.copy(target)
  const VIEW_DIRECTION = new THREE.Vector3(0.35, 0.42, 0.84).normalize()
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
    const fit = radius / (Math.tan(halfFov) * Math.min(1, camera.aspect))
    camera.position.copy(target).add(VIEW_DIRECTION.clone().multiplyScalar(fit))
    controls.minDistance = fit * 0.4
    controls.maxDistance = fit * 3
  }
  document.body.append(host) // only now: the models are loaded, so no empty layer covers the map
  window.addEventListener('resize', resize)
  const watchDock = new ResizeObserver(resize)
  if (dock) watchDock.observe(dock)
  resize()

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let last = performance.now()
  let frame = 0
  const tick = () => {
    const now = performance.now()
    if (!reduced) group.rotation.y += SPIN_RAD_PER_S * ((now - last) / 1000)
    last = now
    controls.update()
    renderer.render(scene, camera)
    labels.render(scene, camera)
    frame = requestAnimationFrame(tick)
  }
  tick()

  return {
    rocket: Boolean(cargo),
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
