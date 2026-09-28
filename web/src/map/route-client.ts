/** Promise wrapper around the routing worker; replies are matched by request id. */
import type { Cell, Grid } from '../core/grid'
import type { RouteReply } from '../core/route-service'

export type RouteClient = { route(start: Cell, goal: Cell): Promise<RouteReply> }

export function createRouteClient(grid: Grid): RouteClient {
  const worker = new Worker(new URL('../core/route.worker.ts', import.meta.url), {
    type: 'module',
  })
  worker.postMessage({ type: 'grid', grid })
  const pending = new Map<number, (reply: RouteReply) => void>()
  worker.onmessage = (event: MessageEvent<RouteReply>) => {
    pending.get(event.data.id)?.(event.data)
    pending.delete(event.data.id)
  }
  let nextId = 0
  return {
    route(start, goal) {
      const id = ++nextId
      return new Promise((resolve) => {
        pending.set(id, resolve)
        worker.postMessage({ type: 'route', id, start, goal })
      })
    },
  }
}
