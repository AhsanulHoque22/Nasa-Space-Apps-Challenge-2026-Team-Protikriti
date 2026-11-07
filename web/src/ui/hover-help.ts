/**
 * A hover note on every control in Map mode: what it does or what it means. Notes live in one
 * table so they read alike; they are applied as controls appear (panels, windows, the walk
 * console re-render), and only where a control has no note of its own already.
 */
import { ZONE_PURPOSES } from '../core/objective'

type Note = string | ((el: HTMLElement) => string | null)

const text = (el: HTMLElement) => (el.textContent ?? '').replace(/\s+/g, ' ').trim()
const within = (el: HTMLElement, sel: string) => !!el.closest(sel)

const ZONE_WHY = Object.fromEntries(
  Object.values(ZONE_PURPOSES).map((p) => [p.label, `Rank the zones for ${p.label}: ${p.why}`]),
)

const SHIFT: Record<string, string> = {
  '-88775244':
    'Move the Mars clock back one sol (24 h 39 min): the light, the sun and the conditions follow.',
  '-3600000': 'Move the Mars clock back one hour.',
  '0': 'Back to the real time on Mars now.',
  '3600000': 'Move the Mars clock forward one hour.',
  '88775244': 'Move the Mars clock forward one sol (24 h 39 min).',
}

const WALK_TABS: Record<string, string> = {
  now: 'Where you are now: position, slope, the next stop and a map of the route.',
  route: 'The whole route: totals and every stop; click a stop to jump to it.',
  nearby: 'Named places within 8 km of you.',
  profile: 'The height of the ground along the route, with you marked on it.',
  know: 'What to know out here: gravity, radiation and how the route was checked.',
  tools: 'Map tools: the 360 panorama, recenter and zoom.',
}

/** First match wins. Selectors are scoped to Map mode's panels, windows and console. */
const RULES: Array<[string, Note]> = [
  // Header, search, workbench keys
  ['.story-link', 'Leave the map and play the story: the crew’s missions, one decision at a time.'],
  ['.view-select select', 'Fly to one of the mapped sites, or back to the whole planet.'],
  ['.foot-link', 'Walk the chosen site on the ground in first person, with a field tablet.'],
  ['#search-input', 'Search craters, landing sites, rock samples and exploration zones by name.'],
  ['.dock-tabs [data-tab="plan"]', 'Plan tab: draw a Marswalk route and check it is safe to walk.'],
  [
    '.dock-tabs [data-tab="explore"]',
    'Explore tab: weather, landing zones, the delta and colony scores.',
  ],
  [
    '.dock-tabs [data-tab="science"]',
    'Science tab: radiation, dust, seasons, geology and how the planner was checked.',
  ],
  ['.dock-close', 'Close the side panel; the tab keys open it again.'],
  ['.ask-atlas-trigger', 'Ask ATLAS a question about Mars, this map or your plan.'],
  ['.drawer-toggle', 'Show or hide the map’s instrument panels (small screens).'],
  ['.layers > summary', 'Show or hide the list of map layers.'],
  [
    '.layer-info',
    'Where this layer’s data comes from: mission, instrument, resolution and a link.',
  ],
  [
    '.centre-toggle',
    'Show or hide the crosshair on the view centre, the spot the site report describes.',
  ],
  [
    '.report-button',
    'Open a site report on the view centre: photos, colony scores, a sol of weather, dust and daylight.',
  ],
  ['[data-shift]', (el) => SHIFT[el.dataset.shift ?? ''] ?? null],
  [
    '.clock-more > summary',
    'Season, sun height, rover sols, Mars Sol Date and how positions are given.',
  ],
  // Mission replay
  ['.timeline [data-rover="m20"]', 'Replay Perseverance’s drive at Jezero.'],
  ['.timeline [data-rover="msl"]', 'Replay Curiosity’s drive at Gale.'],
  ['.tl-play', 'Play or pause the rover’s drive along its real traverse.'],
  ['.tl-speed select', 'How many sols of the drive pass each second.'],
  ['.tl-follow input', 'Keep the camera on the rover as it drives.'],
  ['.tl-close', 'Hide the mission replay bar.'],
  ['.timeline input[type="range"]', 'Drag to any sol of the rover’s drive.'],
  // Plan tab
  ['.quest > summary', 'A five-step walkthrough of planning a safe Marswalk.'],
  [
    '[data-act="add"]',
    'Add a stop at the centre of the view; the first point is where the walk starts.',
  ],
  ['[data-act="undo"]', 'Remove the last stop you added.'],
  ['[data-act="clear"]', 'Remove every stop and start the route again.'],
  [
    '.route-purpose [data-purpose="explore"]',
    'Explore: spend 20 minutes of science at every stop.',
  ],
  [
    '.route-purpose [data-purpose="emergency"]',
    'Emergency: reach each point as fast as possible, no time at stops.',
  ],
  [
    '.route-tools > summary',
    'Extra planning tools: walking range, line of sight, hazards, haul road, storm, sunlight.',
  ],
  [
    '[data-act="range"]',
    'Shade how far the crew can walk from the start and still get home within the EVA limit.',
  ],
  [
    '[data-act="sight"]',
    'Shade the ground the start point can see, for radio and safety lines of sight.',
  ],
  ['[data-act="hazard"]', 'Click the map to mark ground the route must go around.'],
  ['[data-act="clear-hazards"]', 'Remove every hazard you marked.'],
  ['.eva-why > summary', 'How the GO / NO-GO verdict and its margin are worked out.'],
  ['.route-words > summary', 'The route described in words, leg by leg.'],
  ['.route-audio', 'Play the route’s height as a rising and falling tone.'],
  ['.walk-start', 'Walk the route stop by stop with the EVA console.'],
  [
    '.sync > summary',
    'Simulated offline sync: hazard edits queue while offline, then merge with Ground’s copy.',
  ],
  [
    '.link > summary',
    'Simulated Crew-to-Ground link: what the Earth–Mars signal delay does to a shared plan.',
  ],
  [
    '.storm-warning input',
    'Minutes of warning before the storm arrives: does the crew reach cover in time?',
  ],
  [
    '.link input[type="radio"]',
    (el) => `One-way signal delay to Ground: ${text(el.parentElement as HTMLElement)}.`,
  ],
  ['.dose > summary', 'Radiation on Mars against a whole career’s limit, and in transit.'],
  [
    '.geology > summary',
    'Jezero’s rock units as a geologist reads them, and why weaker gravity changes slopes.',
  ],
  ['.ask-close', 'Close Ask ATLAS.'],
  ['.ask-send', 'Send your question to ATLAS.'],
  [
    '.benchmark > summary',
    'How the planner’s slope rule compares with the slopes Perseverance really drove.',
  ],
  [
    'button',
    (el) => {
      const t = text(el)
      if (t === 'Haul road')
        return 'Find the gentlest road for a cargo vehicle between the start and the last stop.'
      if (t === 'Storm warning')
        return 'If a dust storm warning came now: time from the farthest point to cover.'
      if (t === 'Sunlight')
        return 'Paint a sol of clear-sky sunlight on the terrain: where panels would get the most light.'
      if (t === 'Go offline' || t === 'Reconnect')
        return 'Simulate losing and regaining the link: edits made offline wait, then merge.'
      if (t === 'Send plan to Ground')
        return 'Send this plan to Ground over the simulated delayed link.'
      if (t === 'Download the plan as a file')
        return 'Save this plan as a file you can share or load later.'
      return null
    },
  ],
  // Explore tab
  [
    '.wx-launch [data-station="rems"]',
    'Curiosity’s REMS weather station at Gale: the latest sol and a year of readings.',
  ],
  [
    '.wx-launch [data-station="meda"]',
    'Perseverance’s MEDA weather station at Jezero: the latest sols it reported.',
  ],
  ['.wx-close', 'Close this panel.'],
  ['.wx-table > summary', 'The last 10 sols of readings as a table.'],
  ['.popup-launch', (el) => `Open “${text(el)}” in a window over the map.`],
  [
    '.colony-panel summary, .colony-sources summary',
    'Where each colony score comes from, and what it leaves out.',
  ],
  [
    '.colony-summary summary',
    'The sums behind the colony budget: what each module makes and uses.',
  ],
  // Windows
  ['.sd-close', 'Close this window (Esc).'],
  ['.popup-back', 'Back to the window you came from.'],
  ['.zones .dust-sites button', (el) => ZONE_WHY[text(el).replace('✓', '').trim()] ?? null],
  ['.zone-name', (el) => `Close the window and fly to ${text(el)}.`],
  ['.zr-more', 'Show every zone in the ranking, or only the leaders.'],
  [
    '.zone-weights input[type="range"]',
    'How much this measure counts in the ranking: 0 ignores it, 5 counts most.',
  ],
  [
    '.scenario .dust-sites button',
    (el) => `Plan the season at ${text(el)}: sun, dust and the best hours to walk.`,
  ],
  [
    '.scenario input[type="range"]',
    'Pick the season (solar longitude, Ls) or the local hour to test.',
  ],
  [
    '.scenario .route-actions button',
    (el) =>
      text(el).startsWith('Show')
        ? 'Close the window and set the map’s clock to this season and hour.'
        : 'Set the map’s clock back to now.',
  ],
  ['.dust-season .dust-sites button', (el) => `Show the 13-year dust record at ${text(el)}.`],
  [
    '.compare input[type="range"]',
    'Swipe between Jezero and the Jamuna, or step through the Jamuna’s years.',
  ],
  ['.archive-card', 'Open this sample’s record, with a map view of where it was taken.'],
  ['.delta-samples button', (el) => `Open the record of sample ${text(el).split(' ·')[0]}.`],
  ['[data-act="sv"]', 'Open the 360 panorama from the rover’s cameras at this spot.'],
  ['.geology .quiet', (el) => `${text(el)}: fly the map to this rock unit.`],
  [
    '.geology-slope input, .geology input[type="range"]',
    'Slope angle to test: see whether the same soil holds on Mars and on Earth.',
  ],
  ['.see-more > summary', 'Show the full explanation, method and sources.'],
  ['a[target="_blank"]', 'Opens the source in a new tab.'],
  // Walk console
  ['[data-act="prev"]', 'Go to the previous stop.'],
  ['[data-act="next"]', 'Go to the next stop; the map glides there at your zoom.'],
  ['[data-act="goto"]', 'Jump to this stop.'],
  ['.ws-tabs [data-tab]', (el) => WALK_TABS[el.dataset.tab ?? ''] ?? null],
  ['[data-act="close"]', 'End the walk and go back to the map (Esc).'],
  [
    '.ws-verdict',
    'GO if the walk home stays inside the suit’s time and slope limits from every stop.',
  ],
  ['.ec-ring', 'Share of the suit’s supply left at this stop, from the suit model.'],
  ['.ec-eva', 'Share of the 8-hour EVA limit used by the time you reach this stop.'],
  ['.ec-alarm', 'The most serious warning for this stop; stripes mean act on it.'],
]

const CONTROLS =
  'button, select, input, summary, a[href], [role="button"], [role="tab"], [role="radio"], .ws-verdict, .ec-ring, .ec-eva, .ec-alarm'
/** Controls that already explain themselves on hover (the layer rows have their own box). */
const SKIP = '.layer-list label, [data-tip], .eva-wrist'

function noteFor(el: HTMLElement): string | null {
  for (const [sel, note] of RULES) {
    if (!el.matches(sel)) continue
    const n = typeof note === 'string' ? note : note(el)
    if (n) return n
  }
  // Nothing written for it: its accessible name still says what it is.
  return el.getAttribute('aria-label') || null
}

function annotate(root: ParentNode): void {
  for (const el of root.querySelectorAll<HTMLElement>(CONTROLS)) {
    if (el.title || el.closest(SKIP) || within(el, '.gate, .episodes, [data-story]')) continue
    const note = noteFor(el)
    if (note) el.title = note
  }
}

/** Notes every control in Map mode now, and every one that appears later. */
export function installHoverHelp(root: HTMLElement = document.body): void {
  let queued = false
  const run = () => {
    queued = false
    annotate(root)
  }
  new MutationObserver(() => {
    if (queued) return
    queued = true
    requestAnimationFrame(run)
  }).observe(root, { childList: true, subtree: true })
  run()
}
