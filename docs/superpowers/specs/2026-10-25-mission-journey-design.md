# Mission Journey — Design Spec

**Date:** 2026-10-25
**Project:** ATLAS — NASA Space Apps 2026, Challenge 11 (Team Protikriti)
**Status:** Design approved in chat 2026-10-25; this written spec awaits review. No code yet.

---

## 1. Why

ATLAS has many strong tools (route planner, colony placement, storm replay, Street View,
site reports) but no story connecting them. Judges score Presentation and Impact, and the
challenge is a *survival guide*. This spec turns the tools into one guided, learning-first
journey: choose where to land, pack what NASA would send, build the base, and keep a crew
alive until the return window opens. Users fail, read why, and retry.

**Audience:** students and science enthusiasts, not flight crews. (Mars has no internet; no
astronaut will use a website on the surface.)

**Tone rule: a mission, not a game.** No points, coins, lives, timers-for-drama or loot.
Words used: briefing, decision, consequence, debrief. The only outcomes are *sols survived*
and *margin*. Every number on screen shows its source. Models and one intro video per chapter
are the only illustrative content, and are labelled as such.

## 2. Decisions taken (2026-10-25)

| Topic | Decision |
|---|---|
| Login | Local profile (name + chosen hat badge), progress in the browser. No backend, works offline. |
| Roles | Crew roles: Commander, Engineer, Scientist, Medic. |
| Role play | "Switch hats": one user leads all four; every decision is tagged with the role that owns it. |
| Baseline | NASA DRA 5.0 architecture, with power/ISRU numbers from NASA's Jezero solar-vs-fission study (Rucker et al. 2016, EMC operations). |
| Crew | 4 (CHAPEA analog, EMC ops). |
| Finish line | Survive the 539-day surface stay until the Earth-return window (DRA 5.0). No resupply is possible in between: launch windows are ~26 months apart. |
| Failure | Debrief names the failing resource, sol and cause; retry from the chapter where the fatal decision was made. |
| Screen | Globe stays the stage; a left **mission rail** shows chapter, objective and the life ledger; existing panels appear only when a chapter needs them. |
| Scope by freeze (14 Nov 12:00) | Core 5 chapters. Chapters 6–9 shown as locked "next missions". |

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

**Verify before coding (open items, §11):** BVAD crew consumables (O₂, water, packaged food
per crew-day), ISS O₂ and water recovery rates, lander tilt limit.

**Honest finding to show, not hide:** 180 days of cruise (324 mSv) plus 525 sols on the
surface (352 mSv) is ~676 mSv, above the recommended 600 mSv limit. Dose is therefore tracked
and explained by the Medic, not used as a pass/fail rule. This is a real open problem in
human Mars planning, and saying so is good science communication.

## 4. The journey

### Entry
Landing page → **Create profile** (name; no password) → choose **Begin mission** or
**Free explore** (the current app, unchanged). Profile and progress are saved in
localStorage; every read/write is wrapped so a blocked browser still runs (progress then
lasts for the session only).

### Chapter 1 — Briefing and cargo (Commander, Engineer)
- Briefing card: the DRA 5.0 plan in 5 lines, the 26-month window, why cargo goes first.
- **Pack the cargo lander, 40 t limit.** Fixed: surface habitat 21.5 t. Choose from the
  catalogue (§6.2): Kilopower units, solar arrays, batteries, ISRU plants (1 or 2), food,
  water reserve, spares, science lab, pressurised rover. Each row: mass, power, source.
- **Cargo-phase simulation** runs with the chosen site from Chapter 2 (see order below):
  does ISRU make 22,728 kg of LOX before the crew's launch window (420 days)?
  Result: *GO for crew launch* or *NO-GO: tanks 61% full by the window, crew waits 26 months*
  (mission failure, retry Chapter 1).
- Order: the user packs first, Chapter 2 picks the site, and the cargo-phase verdict is
  shown at the end of Chapter 2 (it needs latitude for solar). This is the first
  consequence the user sees.

### Chapter 2 — Choose the landing site (Scientist, Commander)
- All 30 NASA Exploration Zones on the globe, ranked by the existing `zone-rank` (ice,
  elevation, latitude).
- Hard rules drop zones: beyond ±50° latitude, above +2 km MOLA. The reason is shown.
- **Final pick is one of the four zones with high-resolution terrain in ATLAS** (Jezero,
  Gale, Gusev, Meridiani). The others show "not certified: no high-resolution terrain";
  this is how NASA works too (no crew to an unimaged site).
- The site sets latitude (insolation, night length), seasonal τ, SWIM ice (recorded for
  later chapters), and elevation (shown as EDL margin).
- Ends with the cargo-phase verdict from Chapter 1.

### Chapter 3 — Landing (no decision)
- 45–60 s NASA Perseverance EDL footage (NASA/JPL-Caltech, credited, English captions),
  self-hosted so it plays offline, with three facts: entry speed, time to land, why
  elevation matters. Skippable. Labelled "Perseverance, 2021, the closest real footage of
  a Mars landing".

### Chapter 4 — Build the base (Engineer, Medic)
- On the real terrain of the chosen site: place the habitat, power farm and ISRU/MAV area.
- Checks (from existing slope grid and geometry):
  - habitat and lander pads below the slope limit (value: open item §11);
  - Kilopower farm ≥ 1 km from the habitat (Rucker 2016); closer → Medic flags it and the
    placement is rejected with the distance shortfall in metres;
  - solar arrays not in permanent shadow (existing `sunlitMask`).
- Commit → **the life ledger starts at sol 1**. The mission rail now shows O₂, water, food,
  battery, power margin and crew dose.

### Chapter 5 — Dust storm, then the return window (Commander, Engineer)
- At the season of the 2018 storm (existing storm replay) τ rises. Solar users see power
  fall; fission users see it hold (the honest lesson).
- Decisions while the storm lasts: habitat at **nominal (14.9 kW)** or **keep-alive
  (8.0 kW: science stops, Marswalks suspended)**; science lab on or off.
- After the storm the ledger runs forward to **sol 525**. Pass → debrief and the Earth-return
  window. Fail → debrief.

### Debrief (every end)
- Line 1: outcome. *"Oxygen ran out on sol 214."*
- Line 2: cause chain from the ledger. *"Storm cut solar to 31% for 96 sols; battery empty on
  sol 198; ECLSS offline; O₂ drawn from reserve."*
- Line 3: the decision that caused it and its chapter, with a **Retry Chapter N** button.
- Dose line from the Medic (always shown), with the 600 mSv note.
- Every figure links to its source (existing provenance view).

### Locked next missions (shown, not built)
6 First Marswalk (existing route planner), 7 Water from ice (SWIM + haul tool),
8 Greenhouse, 9 Second crew arrives.

## 5. The life ledger (pure core)

Deterministic, sol-step simulation. No randomness. Same inputs → same outputs.

```
simulateCargoPhase(manifest, site) -> { solsToFill: number | null, lox_kg_at_window: number, verdict }
simulateCrewed(manifest, site, placement, decisions) -> SolRecord[]   // 1..525 or until failure
firstFailure(records) -> Failure | null
```

`SolRecord`: sol, Ls, τ, power generated (kWh), load (kWh), battery (kWh), O₂ store (kg),
water store (kg), food store (kg), MAV conditioned (bool), crew dose (mSv), ECLSS on (bool).

**Per sol:**
1. **Generation.** Fission: units × 10 kWe × 24.66 h (spare activates if a unit is marked
   failed; not in core 5). Solar: existing `solar.ts` physics (insolation by latitude and Ls,
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
7. **Failure** = first store at zero or a power failure above; `firstFailure` returns the
   resource, sol and the chain of preceding causes for the debrief.

**Cargo phase:** ISRU LOX rate = 2.2 kg/h × min(1, power available to ISRU / 19.7 kW),
day-by-day for 420 days with solar daylight/battery rules; ≥22,728 kg → GO.

## 6. Architecture

Follows the project's functional core / imperative shell rule. New code sits beside what
exists; the current app stays as **Free explore**.

### 6.1 New pure modules (`web/src/core/`)
| File | Job |
|---|---|
| `mission-constants.ts` | Every rate and limit above as a named constant with a source comment. |
| `manifest.ts` | Catalogue of packable items (mass, power, Wh, source); `manifestMass`, `validateManifest(limit_kg)`. |
| `ledger.ts` | `simulateCargoPhase`, `simulateCrewed`, `firstFailure`. |
| `mission.ts` | Chapter state machine as a pure reducer: unlocks, checkpoints, retry target. |
| `profile.ts` | Profile type, `parseProfile(unknown)` (validate at the boundary), serialise. |

### 6.2 Manifest catalogue (core 5)
Habitat (fixed, 21.5 t) · Kilopower 10 kWe (1,754 kg) · Solar array 5.6 m (30 kg, plus
structure/PMAD allowance from Rucker) · Battery block (kg → kWh at 270 Wh/kg) · ISRU plant ·
Food (kg) · Water reserve (kg) · Science lab · Pressurised rover · Spares. Items without a
sourced mass (ISRU plant, lab, rover, spares) stay out until a source is found (§11); the
user is never shown an invented mass.

### 6.3 New UI (`web/src/ui/`)
| File | Job |
|---|---|
| `profile-gate.ts` | Create/continue profile; Begin mission / Free explore. |
| `mission-rail.ts` | Left rail: chapter, objective, role badge, ledger gauges with sources. |
| `chapter-cargo.ts` | Manifest packing table with live mass bar. |
| `chapter-site.ts` | Zone picker on the globe (reuses `zone-rank`, zone layer). |
| `chapter-landing.ts` | Video player with captions, skip. |
| `chapter-base.ts` | Placement on terrain (reuses `colony-modules`, slope grid, `sunlitMask`). |
| `chapter-storm.ts` | Storm timeline (reuses storm replay, `surface-conditions`) and power decisions. |
| `debrief.ts` | Outcome, cause chain, retry, provenance links. |

`main.ts` routes between Free explore and Mission. `colony-budget.ts` has constants that
disagree with Rucker (2 kWh/sol per person vs 14.9 kW habitat); mission mode uses the ledger,
and reconciling Free explore's colony panel is a follow-up (§10).

### 6.4 Data
- No new datasets for core 5; all site inputs exist (zones, MOLA, SWIM, dust, slope grids).
- One video file in `web/public/media/` (compressed MP4 ≤ 10 MB, poster, `.vtt` captions),
  credited in `docs/data-sources.md`.

## 7. Error handling
- Profile JSON from localStorage is untrusted: parse and validate; on failure start fresh
  and say so (never crash, never silently lose progress without telling the user).
- localStorage unavailable → session-only progress with a visible note.
- Video fails to load → poster + facts, chapter continues.
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
- `mission`: unlock order, retry goes to the right chapter, checkpoint restore.
- `profile`: corrupt JSON, missing fields, old version.
- Playwright end-to-end before freeze: fission path survives; undersized solar fails in the
  storm with the right debrief text; offline run with wifi off.

## 9. Demo (240 s video beat)
Create profile → pack 40 t (choose solar to save mass) → pick Jezero (Rucker's own study
site) → cargo-phase GO → landing footage (10 s) → place base → storm: power falls, keep-alive
decision → debrief *"Oxygen ran out on sol 2xx"* → retry with one Kilopower → survives to
sol 525. Names datasets aloud: MOLA, SWIM, HiRISE/CTX, RAD, MEDA/REMS, plus NASA DRA 5.0 and
Rucker 2016.

## 10. Out of scope (core 5)
Real accounts and multi-user crews · chapters 6–9 · random failures/events · greenhouse
modelling · EVA dose from walks · cable mass and line losses · reconciling Free explore's
colony panel constants (follow-up) · AI narration of results.

## 11. Open items (resolve before the relevant task)
1. BVAD (NASA/TP-2015-218570/REV2) crew consumables: O₂, potable+hygiene water, packaged food
   per crew-day. Use the table values, not secondary sources.
2. ISS ECLSS O₂ and water recovery fractions (NASA 2023 water-recovery announcement; O₂ via
   Sabatier).
3. Lander/habitat slope limit for pad placement (source needed; else reuse the app's walk
   limit and label it a team assumption).
4. Sourced masses for ISRU plant, science lab, pressurised rover, spares (DRA 5.0 full
   report NASA-SP-2009-566 addendum); items stay out until found.
5. Primary citation for the ±50° / +2 km MOLA landing bounds (found in a NASA surface field
   station presentation via search; pin the exact NTRS document before it goes on screen).
6. Licence line for the chosen Perseverance EDL clip (NASA media guidelines; check the
   NASA Image and Video Library credit).

## 12. Schedule and cut order
- By 31 Oct: constants, manifest, ledger, mission reducer (tests green).
- By 5 Nov: profile gate, mission rail, chapters 1–2.
- By 9 Nov: chapters 3–5, debrief.
- 10–12 Nov: polish, accessibility pass, offline rehearsal, 240 s recording.
- Freeze 14 Nov 12:00.
- **Cut order if behind:** landing video → still image with facts; base placement → auto-place
  with checks shown; storm decisions → fixed keep-alive. Never cut the ledger or the debrief.

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
