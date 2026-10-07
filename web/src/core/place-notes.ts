/** Short, sourced remarks on places worth a sentence. Each is what the IAU gazetteer itself says. */

const NOTES: Record<string, string> = {
  // https://planetarynames.wr.usgs.gov/Feature/5677 : "Town in Bangladesh", approved 1991.
  // The entry names no district, so none is claimed here.
  Sripur: 'named for a town in Bangladesh (IAU, approved 1991)',
}

export function placeNote(name: string): string | undefined {
  return NOTES[name]
}
