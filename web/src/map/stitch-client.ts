/** Stitch a stop's panorama in a worker; frames are fetched through the same-origin NASA proxy. */
import type { Frame } from '../core/streetview'
import type { StitchReply, StitchRequest } from './stitch.worker'

const OUT_WIDTH = 4096 // ~11 px per degree: about the Navcam browse images' own resolution
const NASA = 'https://mars.nasa.gov'

const proxied = (url: string) =>
  url.startsWith(NASA) ? new URL(`nasa-raw${url.slice(NASA.length)}`, document.baseURI).href : url

/** The frame's place on the full sensor in tangent units (see core/stitch Source.sensorTan). */
function sensorTan(f: Frame): [number, number, number, number] {
  const [x, y, w, h] = f.subframe
  const [sw, sh] = f.sensor
  const tw = Math.tan((f.fovDeg[0] * Math.PI) / 360)
  const th = Math.tan((f.fovDeg[1] * Math.PI) / 360)
  return [
    ((x - 1 + w / 2) / sw - 0.5) * 2 * tw,
    -((y - 1 + h / 2) / sh - 0.5) * 2 * th, // sensor rows run down; tangent y runs up
    (w / sw) * tw,
    (h / sh) * th,
  ]
}

export type Stitched = { pixels: Uint8ClampedArray; width: number; height: number; used: number }

/** `yawDeg` turns rover-frame mast azimuths into compass bearings. Abort with `signal`. */
export function stitchPanorama(
  frames: readonly Frame[],
  yawDeg: number,
  onProgress: (loaded: number, total: number) => void,
  signal: AbortSignal,
): Promise<Stitched> {
  const worker = new Worker(new URL('./stitch.worker.ts', import.meta.url), { type: 'module' })
  const request: StitchRequest = {
    outWidth: OUT_WIDTH,
    frames: frames.map((f) => ({
      // The mast pointing is the camera's optical axis; the subframe is a window of its sensor.
      url: proxied(f.url),
      azDeg: f.azDeg + yawDeg,
      elDeg: f.elDeg,
      widthDeg: f.fovDeg[0],
      heightDeg: f.fovDeg[1],
      sensorTan: sensorTan(f),
    })),
  }
  return new Promise<Stitched>((resolve, reject) => {
    signal.addEventListener('abort', () => {
      worker.terminate()
      reject(signal.reason)
    })
    worker.onerror = (e) => reject(new Error(e.message))
    worker.onmessage = ({ data }: MessageEvent<StitchReply>) => {
      if (data.type === 'progress') return onProgress(data.loaded, data.total)
      worker.terminate()
      if (data.type === 'error') reject(new Error(data.message))
      else resolve(data)
    }
    worker.postMessage(request)
  })
}
