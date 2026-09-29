/// <reference lib="webworker" />
/** Downloads a panorama's frames, decodes them and stitches them off the main thread. */
import { type Source, stitch } from '../core/stitch'

export type StitchRequest = {
  outWidth: number
  frames: Array<Omit<Source, 'pixels' | 'width' | 'height'> & { url: string }>
}
export type StitchReply =
  | { type: 'progress'; loaded: number; total: number }
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
  const pano = stitch(sources, data.outWidth)
  post({ type: 'done', ...pano, used: sources.length }, [pano.pixels.buffer])
}
