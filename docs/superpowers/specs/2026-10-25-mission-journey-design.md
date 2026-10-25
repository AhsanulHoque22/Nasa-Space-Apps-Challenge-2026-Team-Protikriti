# Mission Journey — Design Spec

**Date:** 2026-10-25
**Project:** ATLAS — NASA Space Apps 2026, Challenge 11 (Team Protikriti)
**Status:** Design approved in chat 2026-10-25; this written spec awaits review. No code yet.

---

## 1. Why

ATLAS has many strong tools (route planner, colony placement, storm replay, Street View,
site reports) but no story connecting them. Judges score Presentation and Impact, and the
challenge is a *survival guide*. This spec turns the tools into one guided, learning-first
journey in **Story mode**: expeditions made of many missions. Choose where to land, pack what
NASA would send, build the base, and keep a crew alive until the return window opens; later
expeditions build on the same base. Users fail, read why, and retry. The existing app stays as
the second mode, **Martian Map**.

**Audience:** students and science enthusiasts, not flight crews. (Mars has no internet; no
astronaut will use a website on the surface.)

**Tone rule: a mission, not a game.** No points, coins, lives, timers-for-drama or loot.
Words used: briefing, decision, consequence, debrief. The only outcomes are *sols survived*
and *margin*. Every number on screen shows its source. Models and one intro video per mission
are the only illustrative content, and are labelled as such.

## 2. Decisions taken (2026-10-25)

| Topic | Decision |
|---|---|
| Modes | Two: **Story mode** (this spec) and **Martian Map** (the current app, unchanged). |
| Login | Local profile (name + chosen hat badge), progress in the browser. No backend, works offline. |
| Roles | Crew roles: Commander, Engineer, Scientist, Medic. |
| Role play | "Switch hats": one user leads all four; every decision is tagged with the role that owns it. |
| Baseline | NASA DRA 5.0 architecture, with power/ISRU numbers from NASA's Jezero solar-vs-fission study (Rucker et al. 2016, EMC operations). |
| Crew | 4 (CHAPEA analog, EMC ops). |
| Finish line | Survive the 539-day surface stay until the Earth-return window (DRA 5.0). No resupply is possible in between: launch windows are ~26 months apart. |
| Failure | Debrief names the failing resource, sol and cause; retry from the mission where the fatal decision was made (checkpoint at every mission start). |
| Screen | Globe stays the stage; a left **mission rail** shows expedition, mission, objective and the life ledger; existing panels appear only when a mission needs them. |
| Structure | **Expeditions made of many missions.** 3 expeditions to one site (NASA EMC basis); each expedition is one crew, one 525-sol stay, one ledger; missions unlock in order. |
| Scope by freeze (14 Nov 12:00) | **8 playable missions** (Expedition 1, missions 1.1–1.8); every other mission listed and locked with its briefing readable. |

## 3. Research basis (what the numbers come from)

No agency has a baselined human Mars mission (NASA/CR-20240015749, 2024: no crew size is
baselined). We therefore use the two best-documented NASA studies and say so on screen.

| Fact | Value | Source |
|---|---|---|
| Surface stay | 539 days (= 524.6 sols → **525 sols**) | Drake et al., *Human Exploration of Mars DRA 5.0*, NASA 2009 (NTRS 20090040343) |
| Transit | ~180 days out, 201 days back | DRA 5.0 |
| Cargo pre-deployed | ~2 years before crew; crew launch only after ascent propellant is confirmed made | DRA 5.0; Rucker 2016 |
| Landed payload per cargo lander | 30–50 t | DRA 5.0 |
| Surface habitat | ~21.5 t, 12.1 kWe external power (DRA). Point-of-use: 14.9 kW peak, 8.0 kW keep-alive (crewed phase) | DRA 5.0; Rucker 2016 Table 3 |
| Ascent vehicle (MAV) propellant conditioning | 6.655 kW, always on | Rucker 2016 Table 3 |
| Optional science lab | 9.544 kW peak, 0.174 kW keep-alive | Rucker 2016 Table 3 |
| ISRU oxygen for return propellant | 22,728 kg LOX within 420 days → ≥2.2 kg/h; 19.7 kW during cargo phase | Rucker 2016 |
| ISRU technology | Solid-oxide CO₂ electrolysis (same as MOXIE); 2 plants for redundancy; 400 kg H₂ from Earth reacted with ISRU O₂ for water | DRA 5.0 |
| MOXIE demonstrated | 122 g O₂ total, peak 12 g/h, ≥98% purity | NASA/JPL, Sept 2023 |
| Fission | Kilopower 10 kWe unit, 1,754 kg incl. growth; EMC baseline 4 + 1 spare; ≥1 km from habitat (shield sizing); output independent of dust and latitude | Rucker 2016 |
| Fission (newer) | FSP 40 kWe, <6,000 kg, 10-year life | NASA IAC 2024 FSP manuscript (NTRS 20240011694) |
| Solar at Jezero | 11,713 kg solar + storage gives 23 kW through a 120-day τ = 5 storm (35% of nominal energy); fission alternative 9,154 kg | Rucker 2016 |
| Solar arrays | UltraFlex-derived, 5.6 m diameter, ~30 kg each; 4 arrays ≈ 8 kW daylight at the equator | Rucker 2016 (demonstrator) |
| Batteries | Li-S 270 Wh/kg (crewed); Li-ion 165 Wh/kg (near-term) | Rucker 2016 |
| Landing limits | Latitude within ±50°, elevation ≤ +2 km MOLA (preliminary) | NASA Mars surface field station constraints; MSL EDL guide |
| Exploration Zone | ~100 km radius around landing site | NASA HLS2 workshop 2015 (LPI Contrib. 1879) |
| Radiation | Surface 0.67 mSv/sol (GCR, Gale); cruise 1.8 mSv/day | Hassler et al. 2014 *Science* 343; Zeitlin et al. 2013 *Science* 340 |
| Career limit (recommended) | 600 mSv | National Academies 2021 |
| Crop area | ~20–25 m² per person for O₂; ~50 m² per person for food | Wheeler (NASA KSC) 2022 |
| Analog | CHAPEA 1: 4 crew, 378 days, 3D-printed habitat, JSC | NASA 2024 |
| Dust storm | MY34 (2018) global storm, peak τ ≈ 8.5 at Gale | Guzewich et al. 2019 *GRL* 46 (already in app) |

**Crew consumables (BVAD Rev2, 2022, Table 3-31 and §3.3):** O₂ 0.895 kg, drinking water
3.217 kg, packed food 2.39 kg (incl. packaging) per crew member per day. These replace the
secondary-source 0.84 kg O₂ used in earlier drafts.

**Cargo units (Rucker et al. 2016, Tables 5–7):** Kilopower 1,754 kg each + 385 kg cabling;
solar set 2,034 kg; Li-S battery bank 3,168 kg; oxygen plant ≈1,678 kg (derived from "about
40%, or 671 kg").

**Verify before coding (open items, §11):** ISS O₂ and water recovery rates, lander tilt limit.

**Honest finding to show, not hide:** 180 days of cruise (324 mSv) plus 525 sols on the
surface (352 mSv) is ~676 mSv, above the recommended 600 mSv limit. Dose is therefore tracked
and explained by the Medic, not used as a pass/fail rule. This is a real open problem in
human Mars planning, and saying so is good science communication.

## 4. The journey

### Two modes
- **Story mode** — this spec: expeditions made of missions, unlocked in order.
- **Martian Map** — the current app (map, layers, route planner, Street View, colony tools),
  unchanged and always available.

### Entry
Landing page → **Create profile** (name; no password) → **Story mode** or **Martian Map**.
Profile and progress are saved in localStorage; every read/write is wrapped so a blocked
browser still runs (progress then lasts for the session only).

### Structure: expeditions → missions
Basis: NASA's Evolvable Mars Campaign reuses one site for **three crewed expeditions in the
first decade**, each ~500 days on the surface, with new landers adding to the same base;
fission units reach end of life after ~12 years (Rucker et al. 2016). DRA 5.0 likewise plans a
minimum of three consecutive opportunities.

- An **expedition** = one crew of 4, one stay of 525 sols, one life ledger.
- A **mission** = one problem inside an expedition, with its own briefing, decision(s),
  consequence and debrief. Missions unlock one after another.
- The ledger **carries across missions**: each mission starts from the sol and stores the
  previous one ended with, and advances it to its own end sol. A checkpoint (ledger state +
  decisions) is saved at the start of every mission; retry restores it.
- Expedition 2 starts with what Expedition 1 left on the surface (base, power farm, remaining
  stores), plus a new cargo lander the user packs.

### Mission list
**P** = playable by the freeze (8). **L** = shown locked ("coming next"), with its briefing
readable so the arc is visible.

**Expedition 1 — First Footprints** (crew of 4, sols 1–525)

| # | Mission | Hat | Status | Decision → consequence | Reuses |
|---|---|---|---|---|---|
| 1.1 | Briefing and cargo | Commander, Engineer | P | Pack a 40 t lander (habitat fixed 21.5 t) → starting stores and power | new |
| 1.2 | Choose the landing site | Scientist, Commander | P | Per-zone **evidence card** (water potential, landing safety, science value, farming suitability from Spec B, confidence, mission/instrument behind each line; "orbital data is evidence, not ground truth"). 1 of 30 NASA zones; hard rules ±50°, ≤ +2 km; final pick among the 4 zones with high-res terrain → latitude, τ, ice, EDL margin. Ends with the **cargo-phase verdict**: did ISRU fill the ascent tanks (22,728 kg LOX in 420 days)? | `zone-rank`, zones, MOLA, SWIM |
| 1.3 | Landing | — | P | No decision: 45–60 s NASA Perseverance EDL footage, captioned, offline, skippable | new |
| 1.4 | Build the base | Engineer, Medic | P | Place habitat, power farm, ISRU/MAV on real terrain: slope limit, reactor ≥ 1 km, arrays not shadowed → ledger starts at sol 1. **Event:** the next Phobos transit at the site (SPICE, Spec B): "Phobos covers up to X% of the Sun for Y s; solar dip up to X% (approximate)" — then the contrast with a months-long dust storm. | `colony-modules`, slope grid, `sunlitMask` |
| 1.5 | First Marswalk | Scientist, Medic | P | Plan a walk to a science stop: slope limit, walk time, return margin, dose → GO/NO-GO; walk cost drawn from the ledger | route planner, EVA card, dose |
| 1.6 | Greenhouse trial | Scientist, Engineer | P | Choose crop unit area and crop (crop picker, perchlorate card: grow without local soil) → lighting power, net water and food kcal enter the ledger; the food calculator shows how far the trial is from NASA's ~50 m²/person | Spec B farming core |
| 1.7 | Dust storm | Commander, Engineer | P | Storm season of the site (2018 storm profile): habitat nominal 14.9 kW or keep-alive 8.0 kW, lab on/off → survive or fail | storm replay, `surface-conditions` |
| 1.8 | Return window | Commander | P | Ledger runs to sol 525; MAV tanks must still be conditioned → expedition debrief | new |
| 1.9 | Water from ice | Engineer, Scientist | L | Find shallow ice inside the zone (SWIM) and plan the haul → water at a sourced rate | SWIM, haul tool |
| 1.10 | Long traverse | Scientist, Commander | L | Pressurised rover, 100 km in 15 days, crew of 2 (DRA 5.0); 2 crew stay in the habitat | route planner |
| 1.11 | Power unit failure | Engineer | L | One Kilopower unit fails; spare activation and load shedding | ledger |

**Expedition 2 — Second Crew** (reuses the base; all L)
2.1 Pack the second lander · 2.2 Wake the base (what survived dormancy) · 2.3 Greenhouse
scale-up (~20–25 m²/person for O₂, ~50 m²/person for food) · 2.4 Ice mining at scale ·
2.5 Cave and lava-tube scouting (existing caves layer) · 2.6 Sample campaign · 2.7 Return.

**Expedition 3 — Toward Permanence** (all L)
3.1 Power farm end-of-life planning (~12-year life) · 3.2 Food independence trial ·
3.3 Radiation budget across three crews · 3.4 Phobos waypoint: what MMX's samples (due on Earth 2031) tell a crew about using Phobos · 3.5 Handover to a permanent outpost.

Order note for 1.1 → 1.2: the user packs first, then picks the site; the cargo-phase verdict
appears at the end of 1.2 because solar output depends on latitude. A NO-GO is a failure of
1.1 (retry packing).

### Shared parts (adopted from the extension brief, used on every Story screen)
- **Source chip** on every number (mission, instrument, product, link).
- **Confidence label** (High / Medium / Low + data resolution).
- **Assumptions drawer**: every parameter a mission used, with value, range, unit, source,
  confidence; editable where the mission allows; Reset.
- **"Assumption pending" guard**: a parameter whose value is null in the production build
  blocks the mission that needs it and says why. No unsourced number can reach the screen.
- **Simple / Expert view**: Simple = verdict and one line; Expert = factors, rates, ledger table.
- **Wording guide**: use "planning aid", "estimate", "approximate", "based on [source]";
  never "Mars can be farmed", "guaranteed", "safe to land" without the stated checks.

### Debrief (after every mission, and at expedition end)
- Line 1: outcome. *"Oxygen ran out on sol 214."* or *"Mission complete, sol 142, margin:
  O₂ 61 days, water 48 days, battery 1.4 nights."*
- Line 2: cause chain from the ledger. *"Storm cut solar to 31% for 96 sols; battery empty on
  sol 198; ECLSS offline; O₂ drawn from reserve."*
- Line 3: the decision that caused it and its mission, with **Retry mission X.Y**.
- Medic's dose line (always), with the 600 mSv note.
- Every figure links to its source (existing provenance view).

## 5. The life ledger (pure core)

Deterministic, sol-step simulation. No randomness. Same inputs → same outputs.

```
simulateCargoPhase(manifest, site) -> { solsToFill: number | null, lox_kg_at_window: number, verdict }
initialState(manifest, site, placement, cargoResult) -> LedgerState            // sol 0
advance(state, site, decisions, toSol) -> { state: LedgerState, records: SolRecord[] }
applyDraw(state, draw) -> LedgerState      // one-off costs/gains: a Marswalk, a water haul
firstFailure(records) -> Failure | null
```

The ledger is **resumable**: each mission calls `advance` from where the last one stopped,
and the `LedgerState` it starts from is the mission's checkpoint. Expedition 2 builds its
`initialState` from Expedition 1's final state plus the new manifest.

`SolRecord`: sol, Ls, τ, power generated (kWh), load (kWh), battery (kWh), O₂ store (kg),
water store (kg), food store (kg), MAV conditioned (bool), crew dose (mSv), ECLSS on (bool).

**Per sol:**
1. **Generation.** Fission: units × 10 kWe × 24.66 h (spare activates if a unit is marked
   failed; locked mission 1.11). Solar: existing `solar.ts` physics (insolation by latitude and Ls,
   atmospheric attenuation by τ) × array area. A test pins it to Rucker: 4 × 5.6 m arrays
   ≈ 8 kW daylight at the equator, τ = 1; τ = 5 → ~35% of nominal energy.
2. **Loads.** MAV conditioning 6.655 kW (must-run) + habitat (14.9 or 8.0 kW by decision) +
   science lab (if packed: 9.544 or 0.174 kW).
3. **Battery** covers night and deficits, capacity = battery mass × Wh/kg.
4. **Shedding order when short:** science → habitat to keep-alive → ECLSS recycling off →
   MAV conditioning. Unmet keep-alive with an empty battery is a failure (*"Habitat lost
   keep-alive power on sol X"*). Unmet MAV conditioning is a failure (*"Return propellant
   lost conditioning on sol X"*).
5. **Life support.** With ECLSS on, stores lose crew need × (1 − recovery). With ECLSS off,
   stores lose the full need. Starting stores = packed food/water/O₂ + cargo-phase ISRU
   products (water from 400 kg H₂ + ISRU O₂ = 3,600 kg by stoichiometry, DRA 5.0).
6. **Dose.** 0.67 mSv per sol per crew member (tracked, not a fail rule).
   **One-off draws** (`applyDraw`): a Marswalk subtracts suit O₂/power from the existing EVA
   card's numbers.
   **Greenhouse** (from 1.6 on): daily lighting load = area × W/m² × photoperiod; net water =
   area × crop water × (1 − recycling); food produced = area × yield kcal/m²/day, offsetting the
   food store. Formulas and parameters come from Spec B's farming core and `assumptions.json`.
7. **Failure** = first store at zero or a power failure above; `firstFailure` returns the
   resource, sol and the chain of preceding causes for the debrief.

**Cargo phase:** ISRU LOX rate = 2.2 kg/h × min(1, power available to ISRU / 19.7 kW),
day-by-day for 420 days with solar daylight/battery rules; ≥22,728 kg → GO.

## 6. Architecture

Follows the project's functional core / imperative shell rule. New code sits beside what
exists; the current app stays as **Martian Map**.

### 6.1 New pure modules (`web/src/core/`)
| File | Job |
|---|---|
| `mission-constants.ts` | Every rate and limit above as a named constant with a source comment. |
| `manifest.ts` | Catalogue of packable items (mass, power, Wh, source); `manifestMass`, `validateManifest(limit_kg)`. |
| `ledger.ts` | `simulateCargoPhase`, `simulateCrewed`, `firstFailure`. |
| `missions.ts` | The mission registry as data: id, expedition, title, hats, status (playable/locked), briefing text, end sol rule, unlock rule. Adding a mission = adding a row + its screen. |
| `mission.ts` | Story state machine as a pure reducer over the registry: unlocks, checkpoints, retry target, expedition carry-over. |
| `profile.ts` | Profile type, `parseProfile(unknown)` (validate at the boundary), serialise. |

### 6.2 Manifest catalogue (Expedition 1)
Habitat (fixed, 21.5 t) · Kilopower 10 kWe (1,754 kg) · Solar array 5.6 m (30 kg, plus
structure/PMAD allowance from Rucker) · Battery block (kg → kWh at 270 Wh/kg) · ISRU plant ·
Food (kg) · Water reserve (kg) · Science lab · Pressurised rover · Spares. Items without a
sourced mass (ISRU plant, lab, rover, spares) stay out until a source is found (§11); the
user is never shown an invented mass.

### 6.3 New UI (`web/src/ui/`)
| File | Job |
|---|---|
| `profile-gate.ts` | Create/continue profile; Story mode / Martian Map. |
| `mission-map.ts` | The expedition/mission list: playable, done, locked; locked briefings readable. |
| `mission-rail.ts` | Left rail: expedition, mission, objective, hat badge, ledger gauges with sources. |
| `missions/cargo.ts` | 1.1 manifest packing table with live mass bar. |
| `missions/site.ts` | 1.2 zone picker on the globe (reuses `zone-rank`, zone layer) + cargo-phase verdict. |
| `missions/landing.ts` | 1.3 video player with captions, skip. |
| `missions/base.ts` | 1.4 placement on terrain (reuses `colony-modules`, slope grid, `sunlitMask`). |
| `missions/marswalk.ts` | 1.5 wraps the existing route planner and EVA card; result → `applyDraw`. |
| `missions/greenhouse.ts` | 1.6 crop unit choice using Spec B's budget, crop picker and perchlorate card; adds the greenhouse terms to the ledger. |
| `missions/storm.ts` | 1.7 storm timeline (reuses storm replay, `surface-conditions`) and power decisions. |
| `missions/return.ts` | 1.8 run to sol 525, MAV check, expedition debrief. |
| `debrief.ts` | Outcome, cause chain, retry, provenance links. |

`main.ts` routes between Martian Map and Story mode. `colony-budget.ts` has constants that
disagree with Rucker (2 kWh/sol per person vs 14.9 kW habitat); mission mode uses the ledger,
and reconciling Martian Map's colony panel is a follow-up (§10).

### 6.4 Data
- Depends on Spec B outputs: `phobos_transits.json` (4 terrain sites), `assumptions.json`,
  `crops.json`, and the farming score core.
- **Mission calendar:** sols map to dates through one mission epoch (crew landing date) so Ls,
  storm season and Phobos transits line up. Epoch from a published trajectory (open item).
- No other new datasets for the 8 playable missions; all site inputs exist (zones, MOLA, SWIM, dust, slope grids).
- One video file in `web/public/media/` (compressed MP4 ≤ 10 MB, poster, `.vtt` captions),
  credited in `docs/data-sources.md`.

## 7. Error handling
- Profile JSON from localStorage is untrusted: parse and validate; on failure start fresh
  and say so (never crash, never silently lose progress without telling the user).
- localStorage unavailable → session-only progress with a visible note.
- Video fails to load → poster + facts, mission continues.
- Placement off the site terrain → rejected at the click with a message.

## 8. Testing (TDD)
- `manifest`: mass sum, over-limit rejection, empty manifest.
- `ledger`:
  - fission constant output regardless of τ;
  - solar pinned to Rucker reference values (8 kW daylight / 35% at τ = 5);
  - battery drains and refills across night;
  - shedding order; keep-alive failure; MAV failure;
  - ECLSS off doubles store draw;
  - exact finish at sol 525; start == finish edge (zero-length run);
  - cargo phase: fission GO, daylight-only solar NO-GO (Rucker: 1,098 sols for demo scale).
- `ledger` resumability: advancing 0→200 then 200→525 equals 0→525 in one call; `applyDraw`
  never goes below zero silently (it fails with the resource named).
- Greenhouse terms: zero area adds nothing; null parameter → mission blocked ("Assumption
  pending"), not a zero.
- `missions`: every playable mission has a screen; ids unique; unlock rules reference real ids.
- `mission`: unlock order, retry restores the right checkpoint, Expedition 2 carry-over.
- `profile`: corrupt JSON, missing fields, old version.
- Playwright end-to-end before freeze: missions 1.1–1.8 in order on the fission path
  (survives); undersized solar fails in 1.7 with the right debrief text; retry restores the
  1.7 checkpoint; Martian Map still works; offline run with wifi off.

## 9. Demo (240 s video beat)
Create profile → pack 40 t (choose solar to save mass) → pick Jezero (Rucker's own study
site) → cargo-phase GO → landing footage (10 s) → place base → first Marswalk GO → storm: power falls, keep-alive
decision → debrief *"Oxygen ran out on sol 2xx"* → retry with one Kilopower → survives to
sol 525. Names datasets aloud: MOLA, SWIM, HiRISE/CTX, RAD, MEDA/REMS, plus NASA DRA 5.0 and
Rucker 2016.

## 10. Out of scope (by the freeze)
Real accounts and multi-user crews · locked missions (1.9–1.11, Expeditions 2 and 3) beyond
their readable briefings · random failures/events · greenhouse
modelling · extra EVA dose beyond the surface rate · cable mass and line losses · reconciling Martian Map's
colony panel constants (follow-up) · AI narration of results.

## 11. Open items (resolve before the relevant task)
1. ~~BVAD crew consumables~~ — resolved 2026-10-25 (see §3).
2. ISS ECLSS O₂ and water recovery fractions (NASA 2023 water-recovery announcement; O₂ via
   Sabatier).
3. Lander/habitat slope limit for pad placement (source needed; else reuse the app's walk
   limit and label it a team assumption).
4. Sourced masses for science lab, pressurised rover, spares (DRA 5.0 full report
   NASA-SP-2009-566 addendum); items stay out until found. ISRU plant resolved (derived,
   Rucker 2016).
5. Primary citation for the ±50° / +2 km MOLA landing bounds (found in a NASA surface field
   station presentation via search; pin the exact NTRS document before it goes on screen).
6. Licence line for the chosen Perseverance EDL clip (NASA media guidelines; check the
   NASA Image and Video Library credit).
7. Water extraction rate from shallow ice for locked mission 1.9 (the app cites
   NTRS-20190002020 for 3 L/sol; confirm before reuse).
8. Suit consumables per Marswalk for mission 1.5 (confirm the EVA card's numbers are sourced).
9. Greenhouse parameters for 1.6: lighting W/m² and photoperiod, crop water L/m²/day, water
   recycling fraction, edible yield kcal/m²/day per crop, crop-unit mass for the manifest.
   Start from Wheeler's Biomass Production Chamber papers (NTRS); 1.6 stays blocked until set.
10. Mission epoch: crew landing date from a published conjunction-class trajectory (2033 or
   2035 opportunity), so Ls and Phobos transit dates are real.

## 12. Schedule and cut order
- By 31 Oct: constants, manifest, resumable ledger, mission registry and reducer (tests green).
- By 4 Nov: Spec B cores Story mode depends on: farming score + greenhouse budget (pure),
  `phobos_transits.json` for the 4 terrain sites, sourced `assumptions.json` values.
- By 4 Nov: profile gate, mission map, mission rail, debrief, missions 1.1–1.3.
- By 9 Nov: missions 1.4–1.8; locked briefings for all other missions.
- 10–12 Nov: polish, accessibility pass, offline rehearsal, 240 s recording.
- Freeze 14 Nov 12:00.
- **Cut order if behind:** 1.6 greenhouse → locked (if its parameters are not sourced by 5 Nov); 1.5 Marswalk → locked; landing video → still
  image with facts; base placement → auto-place with checks shown; storm decisions → fixed
  keep-alive. Never cut the ledger, the mission map or the debrief.

## Sources
- Drake (ed.), *Human Exploration of Mars Design Reference Architecture 5.0*, NASA 2009. https://ntrs.nasa.gov/citations/20090040343
- Rucker et al., *Solar Versus Fission Surface Power for Mars*, AIAA Space 2016. https://ntrs.nasa.gov/citations/20160010550
- NASA FSP IAC 2024 manuscript. https://ntrs.nasa.gov/api/citations/20240011694/downloads/IAC%202024%20Manuscript_FSP%20FINAL.pdf
- NASA Moon to Mars architecture white papers (Mars surface power, crew complement). https://www.nasa.gov/wp-content/uploads/2024/12/acr24-compiled-white-papers.pdf
- *Humans to Mars, But How Many?* NASA/CR-20240015749. https://ntrs.nasa.gov/citations/20240015749
- MOXIE final results, MIT AeroAstro 2023. https://aeroastro.mit.edu/news-impact/oxygen-generating-experiment-moxie-completes-mars-mission
- Hassler et al. 2014, RAD surface dose (SwRI release). https://www.swri.org/press-release/swri-scientists-publish-first-radiation-measurements-surface-mars
- National Academies 600 mSv recommendation (Scientific American summary). https://www.scientificamerican.com/article/new-space-radiation-limits-needed-for-nasa-astronauts-report-says
- Wheeler, *Bioregenerative Life Support*, NASA 2022. https://ntrs.nasa.gov/api/citations/20220006578/downloads/USC%20Talk%20on%20Bioregenerative%20Life%20Support%20April%202022.pdf
- NASA HLS2 Exploration Zone workshop. https://www.lpi.usra.edu/lpi/contribution_docs/LPI-001879.pdf
- MSL EDL engineering guide (elevation limit). https://marsoweb.nas.nasa.gov/landingsites/msl/memoranda/MSL_Eng_User_Guide_v2.pdf
- CHAPEA Mission 1 (Space.com). https://space.com/nasa-simulated-mars-mission-chapea-1-end
- NASA media guidelines. https://www.nasa.gov/nasa-brand-center/images-and-media

## 13. Visual redesign of missions (approved 2026-10-25)

User test of mission 1.1: "no visuals at all… all text… boring". Missions are rebuilt so the
hardware is seen and the maths is shown.

- **Stage + dock.** A mission closes the start screen and runs on the live map. The map's own
  controls are hidden; the 3D terrain is the stage. A bottom **mission dock** holds the step
  header, picture cards, one live chart, "Show the maths" and Back / Next (lower half on phones).
- **Guided steps.** One decision per step with a one-line "why it matters" and a picture; a final
  review step lists every choice and lets the user go back.
- **Mission 1.1 steps:** (1) The plan: lander photo and timeline (cargo launch → landing → oxygen
  made → crew launch 26 months later). (2) Power: Kilopower, solar wings, batteries, with the chart
  **One sol of power** (solar rising and setting, reactors flat, demand line, battery state).
  (3) Oxygen plant: MOXIE photo, with the chart **Oxygen tank over 420 days**. (4) Supplies: food
  and water against the 525-sol stay. (5) Review: lander mass gauge, checks, Load.
- **Preview site.** Steps 2–3 use Jezero (the Rucker study site) as a labelled preview so power
  choices get feedback early; mission 1.2 recomputes at the chosen site.
- **Show the maths:** every chart fills its formula with the user's numbers.
- **Pictures:** NASA public-domain photos (NASA Image and Video Library), stored in the app for
  offline use, each with a credit line. 3D models only where their licence is known and credited;
  hardware without a model gets a plain stand-in shape labelled as such.
- **3D on the stage:** packed items appear as models beside the lander on the terrain.
- **Mission 1.2** follows: the globe flies to each zone as it is selected, evidence as cards, the
  verdict as the oxygen-tank chart.
- **Build order:** stage + dock + step flow → steps with picture cards → charts + Show the maths →
  3D models → mission 1.2. Each piece is browser-tested and shown before the next.
