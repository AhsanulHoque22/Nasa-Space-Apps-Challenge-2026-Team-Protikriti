/// <reference lib="webworker" />
/** Downloads a panorama's frames, decodes them and stitches them off the main thread. */
import { type Source, prepare, renderPrep } from '../core/stitch'

export type StitchRequest = {
  outWidth: number
  previewWidth: number
  frames: Array<Omit<Source, 'pixels' | 'width' | 'height'> & { url: string }>
}
export type StitchReply =
  | { type: 'progress'; loaded: number; total: number }
  | { type: 'stitching'; loaded: number; total: number }
  | { type: 'preview'; pixels: Uint8ClampedArray; width: number; height: number; used: number }
  | { type: 'done'; pixels: Uint8ClampedArray; width: number; height: number; used: number }
  | { type: 'error'; message: string }

const post = (reply: StitchReply, transfer: Transferable[] = []) =>
  self.postMessage(reply, transfer)

async function decode(url: string): Promise<Pick<Source, 'pixels' | 'width' | 'height'>> {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const bitmap = await createImageBitmap(await response.blob())
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no 2D canvas in worker')
  ctx.drawImage(bitmap, 0, 0)
  const { data, width, height } = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
  bitmap.close()
  return { pixels: data, width, height }
}

self.onmessage = async ({ data }: MessageEvent<StitchRequest>) => {
  let loaded = 0
  const settled = await Promise.allSettled(
    data.frames.map(async ({ url, ...pose }) => {
      const image = await decode(url)
      post({ type: 'progress', loaded: ++loaded, total: data.frames.length })
      return { ...pose, ...image }
    }),
  )
  const sources = settled.flatMap((s) => (s.status === 'fulfilled' ? [s.value] : []))
  if (!sources.length) return post({ type: 'error', message: 'none of the frames downloaded' })
  // Tell the UI stitching has started so it doesn't appear frozen on large frame counts.
  post({ type: 'stitching', loaded: sources.length, total: data.frames.length })
  // Preprocessing runs once; both renders share it.
  const prep = prepare(sources)
  // A quick low-resolution sphere first, so the viewer can look around within seconds.
  const preview = renderPrep(prep, sources, data.previewWidth)
  post({ type: 'preview', ...preview, used: sources.length }, [preview.pixels.buffer])
  const pano = renderPrep(prep, sources, data.outWidth)
  post({ type: 'done', ...pano, used: sources.length }, [pano.pixels.buffer])
}
