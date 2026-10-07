/** Promise wrapper around the routing worker; replies are matched by request id. */
import type { Cell, Grid } from '../core/grid'
import type { RangeReply, RouteReply } from '../core/route-service'

export type RouteClient = {
  route(stops: Cell[], hazards?: Cell[]): Promise<RouteReply>
  range(start: Cell): Promise<RangeReply>
}

export function createRouteClient(grid: Grid): RouteClient {
  const worker = new Worker(new URL('../core/route.worker.ts', import.meta.url), {
    type: 'module',
  })
  worker.postMessage({ type: 'grid', grid })
  const pending = new Map<number, (reply: RouteReply | RangeReply) => void>()
  worker.onmessage = (event: MessageEvent<RouteReply | RangeReply>) => {
    pending.get(event.data.id)?.(event.data)
    pending.delete(event.data.id)
  }
  let nextId = 0
  const call = <T extends RouteReply | RangeReply>(message: object): Promise<T> => {
    const id = ++nextId
    return new Promise((resolve) => {
      pending.set(id, (reply) => resolve(reply as T))
      worker.postMessage({ ...message, id })
    })
  }
  return {
    route: (stops, hazards) => call<RouteReply>({ type: 'route', stops, hazards }),
    range: (start) => call<RangeReply>({ type: 'range', start }),
  }
}
