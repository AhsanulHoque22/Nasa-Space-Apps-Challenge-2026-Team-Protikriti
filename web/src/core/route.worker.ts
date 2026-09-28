/// <reference lib="webworker" />
/** Runs A* off the main thread so the globe stays responsive (worst case ~0.4 s). */
import { type RouteRequest, createRouteService } from './route-service'

const handle = createRouteService()
self.onmessage = (event: MessageEvent<RouteRequest>) => {
  const reply = handle(event.data)
  if (reply) self.postMessage(reply)
}
