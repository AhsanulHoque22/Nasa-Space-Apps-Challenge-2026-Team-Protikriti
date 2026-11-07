/**
 * The journey in 3D: the Sun, Earth's and Mars's real orbits, and the transfer arcs solved in
 * core/journey.ts, drawn behind the mission dock. The crew ship flies its chosen arc while the
 * planets move to their positions on each date. Sizes of bodies are exaggerated to be visible.
 * three.js loads only when this scene opens, so the map's start-up is not slowed.
 */
import { holdStage } from './stage-loop'
import { type Vec3, planetPosition } from '../core/ephemeris'
import type { Journey } from '../core/journey'
import type { Journeys } from './journey-client'
import { applyRegion, freeRegion } from './stage-region'

const DAY_MS = 86_400_000
const FLIGHT_SECONDS = 7 // one crossing on screen
const HOLD_SECONDS = 1.5
/** Radius the camera keeps in view: Mars's aphelion (1.67 AU) plus room for labels. */
const FIT_RADIUS_AU = 1.9
const COLOURS = {
  sun: 0xffc861,
  earth: 0x5b8def, // --nasa-blue-lift
  mars: 0xd2693c,
  crew: 0xfc3d21, // --nasa-red: the active route
  cargo: 0xa9b6cc, // --text-muted
  other: 0xeef2f8,
}

export type JourneyScene = { select: (routeIndex: number) => void; remove: () => void }

/** Ecliptic (x, y, z) in AU to three.js world (y up). */
const world = (p: readonly number[]): [number, number, number] => [
  p[0] as number,
  p[2] as number,
  -(p[1] as number),
]

const dateText = (ms: number) =>
  new Date(ms).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })

/** Labels for the dashed earlier flight and the moving ship (mission 1.11 replays the way home). */
export type SceneLabels = { earlier: string; ship: string }

export async function openJourneyScene(
  j: Journeys,
  selected: number,
  labels?: SceneLabels,
): Promise<JourneyScene> {
  const THREE = await import('three')
  const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js')
  const { CSS2DRenderer, CSS2DObject } =
    await import('three/examples/jsm/renderers/CSS2DRenderer.js')

  const host = document.createElement('div')
  host.className = 'journey-scene'
  host.setAttribute('aria-hidden', 'true') // the dock states every number in text
  const caption = document.createElement('p')
  caption.className = 'journey-caption'
  const credit = document.createElement('p')
  credit.className = 'journey-credit'
  credit.textContent =
    'Not to scale. Orbits: JPL approximate planetary elements. Transfers solved in ATLAS (Lambert). Concept after ESA / Zhang et al. 2026.'
  host.append(caption, credit)
  document.body.append(host)

  // The backdrop covers the whole screen; the view (canvas + labels) only the part above the dock.
  const view = document.createElement('div')
  view.className = 'journey-view'
  host.prepend(view)
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  const releaseStage = holdStage(renderer)
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
  view.append(renderer.domElement)
  const labelLayer = new CSS2DRenderer()
  labelLayer.domElement.className = 'journey-labels'
  view.append(labelLayer.domElement)
  const hint = document.createElement('p')
  hint.className = 'scene-hint'
  hint.textContent = 'Drag to turn the solar system · scroll to zoom'
  view.append(hint)
  renderer.domElement.addEventListener('pointerdown', () => (hint.dataset.done = ''), {
    once: true,
  })

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x02040a)
  const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 50)
  const VIEW_DIRECTION = new THREE.Vector3(0.1, 0.82, 0.56).normalize() // looking down at ~55°, still 3D
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.enablePan = false
  controls.minDistance = 1.5
  controls.maxDistance = 14
  controls.target.set(0.1, 0, -0.1)

  scene.add(new THREE.AmbientLight(0xffffff, 0.35))
  scene.add(new THREE.PointLight(0xffffff, 2.2, 0, 0))

  const label = (text: string, kind = '') => {
    // CSS2DRenderer owns the outer element's transform, so the offset lives on an inner span.
    const div = document.createElement('div')
    const span = document.createElement('span')
    span.className = `journey-label ${kind}`
    span.textContent = text
    div.append(span)
    return new CSS2DObject(div)
  }
  const ball = (radius: number, colour: number, emissive = false) =>
    new THREE.Mesh(
      new THREE.SphereGeometry(radius, 32, 16),
      emissive
        ? new THREE.MeshBasicMaterial({ color: colour })
        : new THREE.MeshStandardMaterial({ color: colour, roughness: 0.9 }),
    )
  const line = (
    points: readonly Vec3[],
    colour: number,
    opts: { dashed?: boolean; opacity?: number } = {},
  ) => {
    const geometry = new THREE.BufferGeometry().setFromPoints(
      points.map((p) => new THREE.Vector3(...world(p))),
    )
    const material = opts.dashed
      ? new THREE.LineDashedMaterial({
          color: colour,
          dashSize: 0.04,
          gapSize: 0.03,
          transparent: true,
          opacity: opts.opacity ?? 1,
        })
      : new THREE.LineBasicMaterial({
          color: colour,
          transparent: true,
          opacity: opts.opacity ?? 1,
        })
    const l = new THREE.Line(geometry, material)
    if (opts.dashed) l.computeLineDistances()
    return l
  }

  const sun = ball(0.1, COLOURS.sun, true)
  sun.add(label('Sun', 'sun'))
  scene.add(sun)

  const orbit = (planet: 'earth' | 'mars', periodDays: number) =>
    Array.from({ length: 181 }, (_, i) =>
      planetPosition(planet, (j.routes[0] as Journey).departMs + (i / 180) * periodDays * DAY_MS),
    )
  scene.add(line(orbit('earth', 365.25), COLOURS.earth, { opacity: 0.55 }))
  scene.add(line(orbit('mars', 686.98), COLOURS.mars, { opacity: 0.55 }))

  const cargoArc = line(j.cargo.arcAu, COLOURS.cargo, { dashed: true, opacity: 0.8 })
  const cargoTag = label(
    labels?.earlier ?? `Cargo · ${new Date(j.cargo.departMs).getUTCFullYear()}`,
    'muted',
  )
  cargoTag.position.set(...world(j.cargo.arcAu[Math.floor(j.cargo.arcAu.length / 2)] as Vec3))
  cargoArc.add(cargoTag)
  scene.add(cargoArc)

  const routeLines = j.routes.map((r) => {
    const l = line(r.arcAu, COLOURS.other, { opacity: 0.25 })
    scene.add(l)
    return l
  })

  const earth = ball(0.035, COLOURS.earth)
  earth.add(label('Earth'))
  const mars = ball(0.03, COLOURS.mars)
  mars.add(label('Mars'))
  const ship = ball(0.016, COLOURS.crew, true)
  ship.add(label(labels?.ship ?? 'Crew ship', 'accent below'))
  scene.add(earth, mars, ship)

  let route = j.routes[selected] ?? (j.routes[0] as Journey)
  const select = (i: number) => {
    route = j.routes[i] ?? route
    routeLines.forEach((l, k) => {
      const m = l.material as InstanceType<typeof THREE.LineBasicMaterial>
      m.color.setHex(k === i ? COLOURS.crew : COLOURS.other)
      m.opacity = k === i ? 1 : 0.25
    })
    start = performance.now()
  }

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let start = performance.now()
  const place = (fraction: number) => {
    const t = route.departMs + fraction * route.days * DAY_MS
    earth.position.set(...world(planetPosition('earth', t)))
    mars.position.set(...world(planetPosition('mars', t)))
    const k = Math.min(route.arcAu.length - 1, Math.round(fraction * (route.arcAu.length - 1)))
    ship.position.set(...world(route.arcAu[k] as Vec3))
    caption.textContent = `${dateText(t)} · day ${Math.round(fraction * route.days)} of ${route.days}`
  }

  // Fill only the screen the mission dock leaves free, so the planets are never hidden behind it.
  const dock = document.querySelector<HTMLElement>('.mission-dock')
  const resize = () => {
    applyRegion(view, freeRegion(dock))
    const w = view.clientWidth
    const h = Math.max(1, view.clientHeight)
    renderer.setSize(w, h, false)
    labelLayer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    // Step back far enough that Mars's orbit (out to 1.67 AU) fits the narrower side of the view.
    const halfFov = ((camera.fov / 2) * Math.PI) / 180
    const fit = FIT_RADIUS_AU / (Math.tan(halfFov) * Math.min(1, camera.aspect))
    camera.position.copy(controls.target).add(VIEW_DIRECTION.clone().multiplyScalar(fit))
  }
  window.addEventListener('resize', resize)
  const watchDock = new ResizeObserver(resize)
  if (dock) watchDock.observe(dock)
  resize()

  let frame = 0
  const tick = () => {
    const seconds = (performance.now() - start) / 1000
    const fraction = reduced
      ? 1
      : Math.min(1, (seconds % (FLIGHT_SECONDS + HOLD_SECONDS)) / FLIGHT_SECONDS)
    place(fraction)
    controls.update()
    renderer.render(scene, camera)
    labelLayer.render(scene, camera)
    frame = requestAnimationFrame(tick)
  }
  select(selected)
  tick()

  return {
    select,
    remove: () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
      watchDock.disconnect()
      controls.dispose()
      releaseStage()
      host.remove()
    },
  }
}
