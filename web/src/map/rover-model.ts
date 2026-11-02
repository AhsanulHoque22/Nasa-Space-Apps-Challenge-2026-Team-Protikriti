/**
 * The rover on the map, as a glTF file made once in the browser from the same body as the rover
 * stage, so there is one rover and no model file to keep in step with it.
 */
import { roverBody } from '../ui/rover-body'

let url: Promise<string> | null = null

async function build(): Promise<string> {
  const THREE = await import('three')
  const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js')
  const { rover } = roverBody(THREE)
  // The body drives along +x; Cesium takes a glTF model's +z as forward.
  const turned = new THREE.Group()
  rover.rotation.y = -Math.PI / 2
  turned.add(rover)
  const glb = await new GLTFExporter().parseAsync(turned, { binary: true })
  return URL.createObjectURL(new Blob([glb as ArrayBuffer], { type: 'model/gltf-binary' }))
}

export const roverModelUrl = (): Promise<string> => (url ??= build())
