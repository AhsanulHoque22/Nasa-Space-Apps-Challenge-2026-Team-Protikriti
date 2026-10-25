/** The transfer search runs once, in a worker; every caller shares the same answer. */
import type { Journey } from '../core/journey'

export type Journeys = { cargo: Journey; routes: Journey[] }

let pending: Promise<Journeys> | null = null

export function loadJourneys(): Promise<Journeys> {
  return (pending ??= new Promise<Journeys>((resolve, reject) => {
    const worker = new Worker(new URL('../core/journey.worker.ts', import.meta.url), {
      type: 'module',
    })
    worker.onmessage = (event: MessageEvent<Journeys>) => {
      resolve(event.data)
      worker.terminate()
    }
    worker.onerror = (event) => {
      pending = null // let a later call try again
      reject(new Error(`Transfer search failed: ${event.message}`))
      worker.terminate()
    }
    worker.postMessage(null)
  }))
}
