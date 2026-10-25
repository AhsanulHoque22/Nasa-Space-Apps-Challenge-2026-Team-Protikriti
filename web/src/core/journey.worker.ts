/// <reference lib="webworker" />
/** Searches the 2031 and 2033 transfer windows off the main thread (~0.3 s on a laptop). */
import { cargoJourney, crewJourneys } from './journey'

self.onmessage = () => {
  self.postMessage({ cargo: cargoJourney(), routes: crewJourneys() })
}
