/** Promise wrapper around the routing worker; replies are matched by request id. */
import type { Cell, Grid } from '../core/grid'
import type { RangeReply, RouteReply, SightReply, SolarReply } from '../core/route-service'

export type RouteClient = {
  route(stops: Cell[], hazards?: Cell[], limitDeg?: number): Promise<RouteReply>
  range(start: Cell, hazards?: Cell[]): Promise<RangeReply>
  sight(observer: Cell): Promise<SightReply>
  solar(utcMs: number): Promise<SolarReply>
  /** Stop the worker (a walk ends; its grid would otherwise stay in memory). */
  close(): void
}

/** A site grid may still be downloading: messages wait until the worker has its heights. */
export function createRouteClient(grid: Grid | Promise<Grid>): RouteClient {
  const worker = new Worker(new URL('../core/route.worker.ts', import.meta.url), {
    type: 'module',
  })
  const ready = Promise.resolve(grid).then((g) => worker.postMessage({ type: 'grid', grid: g }))
  const pending = new Map<
    number,
    (reply: RouteReply | RangeReply | SightReply | SolarReply) => void
  >()
  worker.onmessage = (event: MessageEvent<RouteReply | RangeReply | SightReply | SolarReply>) => {
    pending.get(event.data.id)?.(event.data)
    pending.delete(event.data.id)
  }
  // A crashed worker must not leave the panel stuck on "Finding the safest route…".
  const failAll = (message: string) => {
    for (const [id, resolve] of pending) resolve({ type: 'error', id, message })
    pending.clear()
  }
  worker.onerror = (event) => {
    event.preventDefault()
    failAll(
      `Route planner stopped unexpectedly: ${event.message || 'unknown error'}. Reload to try again.`,
    )
  }
  worker.onmessageerror = () => failAll('Route planner sent a reply that could not be read.')
  let nextId = 0
  const call = <T extends RouteReply | RangeReply | SightReply | SolarReply>(
    message: object,
  ): Promise<T> => {
    const id = ++nextId
    return new Promise((resolve) => {
      pending.set(id, (reply) => resolve(reply as T))
      ready.then(
        () => worker.postMessage({ ...message, id }),
        (error: unknown) => {
          pending.delete(id)
          resolve({
            type: 'error',
            id,
            message: `Site terrain did not load: ${String(error)}`,
          } as T)
        },
      )
    })
  }
  return {
    route: (stops, hazards, limitDeg) =>
      call<RouteReply>({ type: 'route', stops, hazards, limitDeg }),
    range: (start, hazards) => call<RangeReply>({ type: 'range', start, hazards }),
    sight: (observer) => call<SightReply>({ type: 'sight', observer }),
    solar: (utcMs) => call<SolarReply>({ type: 'solar', utcMs }),
    close: () => {
      failAll('Route planner closed.')
      worker.terminate()
    },
  }
}
