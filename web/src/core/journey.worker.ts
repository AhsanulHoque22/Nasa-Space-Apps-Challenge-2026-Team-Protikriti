/// <reference lib="webworker" />
/** Searches the 2031, 2033 and 2035 transfer windows off the main thread (~0.3 s on a laptop). */
import { cargoJourney, crewJourneys, nextShipJourneys } from './journey'

self.onmessage = () => {
  self.postMessage({ cargo: cargoJourney(), routes: crewJourneys(), nextShip: nextShipJourneys() })
}
