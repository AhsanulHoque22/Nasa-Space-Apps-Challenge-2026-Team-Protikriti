/** Stitch a stop's panorama in a worker; frames are fetched through the same-origin NASA proxy. */
import { type Frame, exposureId, isRightNavcam } from '../core/streetview'
import type { StitchReply, StitchRequest } from './stitch.worker'

// ~11 px per degree, about the Navcam browse images' own resolution. Devices reporting under 8 GB
// get 3072 (~40% less memory): stitching every frame at a busy stop needs a few hundred MB.
// ponytail: deviceMemory is a coarse hint (Chromium only); measure on low-end phones if they fail.
const OUT_WIDTH =
  ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) >= 8 ? 4096 : 3072
const NASA = 'https://mars.nasa.gov'
// Perseverance Navcam browse images are black beyond tan² ≈ 1.66 off-axis (measured on sol 400
// frames) and dim from 1.52; Curiosity's 45° Navcam never gets that far off-axis.
const NAVCAM_IMAGE_CIRCLE_TAN2 = 1.5
// The right Navcam sits 42 cm from the left: nearby rocks and the rover deck would appear twice
// (~12° apart at 2 m), so right-eye frames only fill where no left-eye frame sees.
const RIGHT_EYE_WEIGHT = 0.001

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

const PREVIEW_WIDTH = 1024 // ~2.5 s for 66 frames, against ~20 s at full resolution

/**
 * `yawDeg` turns rover-frame mast azimuths into compass bearings. `onPreview` gets a quick
 * low-resolution sphere; the promise resolves with the full one. Abort with `signal`.
 */
export function stitchPanorama(
  { frames }: { frames: readonly Frame[] },
  yawDeg: number,
  on: { progress: (loaded: number, total: number) => void; preview: (p: Stitched) => void },
  signal: AbortSignal,
): Promise<Stitched> {
  const worker = new Worker(new URL('./stitch.worker.ts', import.meta.url), { type: 'module' })
  const request: StitchRequest = {
    outWidth: OUT_WIDTH,
    previewWidth: PREVIEW_WIDTH,
    frames: frames.map((f) => ({
      // The mast pointing is the camera's optical axis; the subframe is a window of its sensor.
      url: proxied(f.url),
      azDeg: f.azDeg + yawDeg,
      elDeg: f.elDeg,
      widthDeg: f.fovDeg[0],
      heightDeg: f.fovDeg[1],
      sensorTan: sensorTan(f),
      exposure: exposureId(f.url),
      imageCircleTan2: NAVCAM_IMAGE_CIRCLE_TAN2,
      weight: isRightNavcam(f.url) ? RIGHT_EYE_WEIGHT : 1,
    })),
  }
  return new Promise<Stitched>((resolve, reject) => {
    signal.addEventListener('abort', () => {
      worker.terminate()
      reject(signal.reason)
    })
    worker.onerror = (e) => reject(new Error(e.message))
    worker.onmessage = ({ data }: MessageEvent<StitchReply>) => {
      if (data.type === 'progress') return on.progress(data.loaded, data.total)
      if (data.type === 'preview') return on.preview(data)
      worker.terminate()
      if (data.type === 'error') reject(new Error(data.message))
      else resolve(data)
    }
    worker.postMessage(request)
  })
}
