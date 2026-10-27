# Base Stores, Mission Over and Mission Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Expedition 1 becomes a survival run:
  - the player chooses the stay length and the next ship's route;
  - the stores are a running balance, sol by sol, refilled by the recycler, the greenhouse and solar;
  - running out ends the run.
- A versioned Mission report v1, v2, … lists the mistakes and the suggested fixes, and warns the player when a later run repeats a mistake.

**Architecture:**
- **Pure core:**
  - `core/stay.ts`: stay options and the next ship's landing sol;
  - `core/base-stores.ts`: the sol-by-sol ledger;
  - `core/run-report.ts`: lessons and guards;
  - `core/mission-reports.ts`: storage of the versioned reports.
- **UI shell:**
  - `ui/stores-bar.ts`;
  - `ui/mission-over.ts`;
  - `ui/lessons.ts`, used by the dock and the step warnings.
- Each mission's recorder in `ui/mission-play.ts` runs the ledger after saving. When the ledger fails, the Mission over screen opens instead of the mission list.

**Tech Stack:** TypeScript strict, Vitest, the existing `el()` DOM helper, localStorage through `KeyValueStore`.

**Spec:** `docs/superpowers/specs/2026-10-27-base-stores-and-run-report-design.md`

## Global Constraints

- Every number names its source. Unsourced values say "team assumption" in the UI and in `docs/data-sources.md`.
- Water recovery is 0.98 (ISS ECLSS, NASA June 2023), a team assumption for Mars.
- Greenhouse hardware is **81.5 kg/m²**: BVAD Rev2 Table 4-88 without the crops (Drysdale 1999b).
- Recycler: **743 W** while processing (Carter 2009, NTRS 20090033097). Its mass of **1,400 kg** is a team assumption (two ISS racks); no NASA mass was found in the 30-minute timebox. Its power is treated as part of the habitat's 12.1 kW (DRA 5.0 habitat power covers its life support). That too is a team assumption.
- Stays: **1,319 or 2,099 days**, from 539 days (DRA 5.0) plus 1 or 2 synodic periods of **779.94 days** (NASA Mars Fact Sheet).
- The next ship flies in the window after the crew's: search **2035-02-01 to 2035-11-01**, the same Lambert planner.
- Warnings never block. The run ends only on the failures listed in spec §3.
- Words as well as colours: OK / Low / Out.

## Review Focus

- **Old saves without the new cargo fields:** they must load. 1.1 reopens; the app must not crash.
- **A greenhouse built with 0 m² of hardware packed:** 1.6 caps the area at the packed m² and says why.
- **Storage that throws** (private mode): reports live in memory, and the run still ends cleanly.
- **A new crew name:** no reports, no warnings.
- **The storm arriving after the next ship's sol:** it doesn't count against Expedition 1.

---

### Task 1: Stay options and the next ship's route

**Files:**
- Create: `web/src/core/stay.ts`, `web/src/core/stay.test.ts`
- Modify: `web/src/core/journey.ts` (add `nextShipJourneys()`), `web/src/core/journey.worker.ts`, `web/src/ui/journey-client.ts` (`Journeys` gains `nextShip: Journey[]`)

**Interfaces — produces:**
- `STAY_DAYS = [1319, 2099] as const`
- `staySols(days: number): number`, which is `Math.ceil(days / DAYS_PER_SOL)`
- `nextShipSol(crewArriveMs: number, shipArriveMs: number): number`, which is `Math.ceil((ship − crew) / (DAYS_PER_SOL × 86.4e6))`
- `nextShipJourneys(): Journey[]`: minimum energy, then the `FAST_ROUTE_DAYS` routes, in the 2035 window

- [ ] **Step 1:** Write the tests:
  - `staySols(1319) === 1284` and `staySols(2099) === 2043`;
  - `nextShipSol(0, 780*86.4e6) === 760`;
  - `nextShipJourneys()[0].departMs` lies between 2035-02-01 and 2035-11-01;
  - `nextShipJourneys()[0].arriveMs > crewJourneys()[0].arriveMs + 700 days`.
- [ ] **Step 2:** `npx vitest run src/core/stay.test.ts` FAILS (no module).
- [ ] **Step 3:** Implement. The worker posts `{ cargo, routes, nextShip }`.
- [ ] **Step 4:** The tests PASS.
- [ ] **Step 5:** Commit `feat: stay options and the next ship's routes in the 2035 window`.

### Task 2: Regrowth cargo, and the stay saved in 1.1

**Files:** `core/cargo.ts`, `core/cargo.test.ts`, `core/mission-progress.ts` (+test), `core/mission-constants.ts`

**Interfaces — produces:**
- `CargoPlan` gains `recycler: number` (0–2, 1,400 kg each) and `greenhouseM2: number` (0–60, step 5, 81.5 kg/m²).
- The `foodSols` maximum becomes 800.
- `checkCargo(plan, targetSol: number)`: the food warning reads "Packed food lasts N of the T sols until the next ship".
- New warnings:
  - no recycler: "Without a water recycler, every litre is used once.";
  - `greenhouseM2 === 0`: "No greenhouse hardware: no food can be grown."
- `Progress` gains `stay?: { days: number; sols: number; nextShipSol: number; nextShipRouteDays: number }`. Rule 1.1 needs a valid `stay`.
- `recordCargo(missions, progress, cargo, crewRouteDays, stay)`.
- `SURFACE_STAY_SOLS` is deleted. Each caller reads `progress.stay` (Task 8).

- [ ] **Step 1:** Write the tests:
  - mass with `{recycler:1}` adds 1,400; with `{greenhouseM2:10}` adds 815;
  - `checkCargo` warns with target 760;
  - an old plan without `recycler` fails `isCargoPlan`;
  - `recordCargo` saves `stay`; a progress without `stay` doesn't count 1.1 as done.
- [ ] **Step 2:** The tests FAIL.
- [ ] **Step 3:** Implement. The `CARGO_ITEMS` entries carry their source strings, using the Global Constraints values.
- [ ] **Step 4:** The tests PASS. The full suite may fail only in the callers of `SURFACE_STAY_SOLS`; they are fixed in Task 8, in the same commit series.
- [ ] **Step 5:** Commit.

### Task 3: The stores ledger

**Files:** create `core/base-stores.ts` and `core/base-stores.test.ts`

**Interfaces — produces:**
```ts
type StoresInput = {
  cargo: CargoPlan
  untilSol: number            // run the ledger to this sol
  solarKwhPerSol: (sol: number) => number   // packed arrays at the site, storm included
  greenhouse: { kcalPerDay: number; firstHarvestSol: number; lightsKw: number } | null
  walks: { sol: number; suitKwh: number }[]
  extraKwPerSol?: (sol: number) => number   // storm loads etc.
}
type StoresDay = { sol: number; foodSols: number; waterKg: number; batteryKwh: number }
type StoresFailure = { store: 'food' | 'water' | 'power'; sol: number; why: string }
type StoresRun = { days: StoresDay[]; failure: StoresFailure | null; lastsUntilSol: number }
function runStores(i: StoresInput): StoresRun
```

**The balance for each sol:**
- **Food:** −1 sol of food, plus `kcalPerDay × DAYS_PER_SOL / crew kcal per sol` from `firstHarvestSol` on.
- **Water:** −`4 × 3.217 × DAYS_PER_SOL × (recycler ? 0.02 : 1)`.
- **Power:**
  - the steady load is habitat + MAV + greenhouse lights + extra;
  - the reactors cover first;
  - any shortfall comes from solar, then the battery;
  - solar surplus charges the battery up to its capacity;
  - a walk draws its suit kWh from the battery.
- **Failure:** the first sol a store goes below 0.
- **`lastsUntilSol`:** the projection of the slowest-falling store. Food and water extrapolate their last 30-sol trend; a store that isn't falling counts as forever and is capped at `untilSol`.

- [ ] **Step 1:** Write the tests:
  - 400 food sols with no greenhouse fails on food at sol 401;
  - a greenhouse of `kcalPerDay = crew kcal` from sol 30 never fails on food;
  - with no recycler, 750 kg of water fails on water near sol 57 (750 / (4 × 3.217 × 1.0275));
  - with a recycler it doesn't fail by sol 760;
  - 2 reactors, no solar, no battery fails on power at sol 1;
  - the battery refills from solar surplus.
- [ ] **Step 2:** The tests FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** The tests PASS.
- [ ] **Step 5:** Commit.

### Task 4: Mission reports, lessons and guards

**Files:**
- Create `core/run-report.ts` (+test) and `core/mission-reports.ts` (+test).

**Interfaces — produce:**
```ts
type Guard =
  | { kind: 'min'; field: GuardField; value: number }
  | { kind: 'max'; field: GuardField; value: number }
  | { kind: 'equals'; field: GuardField; value: number | string }
type GuardField = 'cargo.kilopower' | 'cargo.battery' | 'cargo.solar' | 'cargo.recycler'
  | 'cargo.greenhouseM2' | 'cargo.foodSols' | 'cargo.waterKg' | 'greenhouse.peakKw'
  | 'storm.habitatKw' | 'storm.greenhouseKw'
type Lesson = { missionId: string; mistake: string; measure: string; numbers: string; guard: Guard; fatal: boolean }
type MissionReport = { version: number; owner: string; endedSol: number; cause: string; lessons: Lesson[] }
function runReport(p: Progress, failure: StoresFailure): Lesson[]
function guardHit(g: Guard, values: Partial<Record<GuardField, number | string>>): boolean
function loadReports(store, owner): MissionReport[]
function appendReport(store, owner, failure, lessons): MissionReport   // version = last + 1
function activeWarnings(reports: MissionReport[], missionId: string,
  values: Partial<Record<GuardField, number | string>>): { version: number; lesson: Lesson }[]
```

**Rules:**
- Each lesson's suggested fix is checked with the existing models:
  - `reactorsNeeded` for reactors;
  - `stormOptions`/`stormRun` for the storm;
  - `runStores` again with the fix applied, for food, water and solar.
- Only lessons whose fix passes its check are kept.
- `activeWarnings` returns the newest report's lesson for each guard field.

- [ ] **Step 1:** Write the tests:
  - a 2-reactor greenhouse run yields a 1.1 lesson with `guard {min, 'cargo.kilopower', 3}`, marked fatal;
  - `guardHit` covers min, max and equals at the boundary;
  - `appendReport` numbers 1 then 2 and keeps both;
  - reports of another owner are ignored;
  - storage that throws gives `[]`.
- [ ] **Step 2:** The tests FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** The tests PASS.
- [ ] **Step 5:** Commit.

### Task 5: 1.1 UI: stay, next ship, new items, warnings

**Files:** `ui/missions/journey-step.ts`, `ui/missions/cargo-steps.ts`, `ui/missions/cargo-views.ts`, `ui/mission-play.ts`

**Changes:**
- The journey step gains a second row of route cards: "Next ship (2035 window)". It shares the existing `routeCard` component.
- A stay choice: two radio cards, 1,319 days / 1,284 sols and 2,099 days / 2,043 sols, each with its source line.
- `JourneyChoice` gains `shipIndex` and `stayDays`.
- The Supplies step adds the cards `recycler`, `greenhouseM2`, `foodSols` and `waterKg`.
- `foodView` measures against `nextShipSol` and shows a `runStores` projection ("Supplies last until sol X") for the reactors-and-battery case with no solar. Solar is judged once the site is known.
- `ui/lessons.ts` `warningFor(…)` shows amber notes under each card whose guard fires.
- Verify in the browser:
  - pack 2 reactors with a stored v1 report → the "Mission report v1" warning shows;
  - the review lists the stay and the next ship.
- Commit.

### Task 6: The stores bar, the Mission over screen, and the lessons button

**Files:**
- Create `ui/stores-bar.ts`, `ui/mission-over.ts` and `ui/lessons.ts`.
- Modify `ui/mission-dock.ts` (option `lessons?: () => HTMLElement | null`, shown in the header), `ui/mission-play.ts`, `ui/story.ts`, `style.css`.

**What each piece does:**
- **`storesBar(run, nextShipSol)`:**
  - shows Sol, Food, Water, Battery and "Lasts until sol X / next ship sol Y";
  - each item carries `data-level` = ok / low / out, plus the text word;
  - low means under 60 sols of reserve.
- **`showMissionOver(failure, report, onRestart)`:**
  - a full-screen panel with what ran out, on which sol, and the numbers;
  - the report's lessons grouped by mission, with the fatal one marked;
  - the button "Start Expedition 1 again". It calls `onRestart`, which saves `{ version: 1, owner, completed: [] }` and opens 1.1.
- **Story screen:** a "Mission reports" list (v1, v2, …), each opening `showMissionOver` in read-only form.
- **Dock:** the closed button "Lessons from Mission report vN (k)". It is omitted when k = 0.
- Verify in the browser. Commit.

### Task 7: Wire the failures and run the ledger after each mission

**Files:** `ui/mission-play.ts`, `ui/missions/walk-live.ts`, `ui/missions/greenhouse-steps.ts`, `ui/missions/storm-steps.ts`

**Where each failure comes from:**
- **1.5:** when `oxygenLeftShare` or `powerLeftShare` reaches ≤ 0 before the airlock, the walk ends with failure `{store:'power'|'oxygen' → reported as 'suit'}`. Extend `StoresFailure.store` with `'suit'`.
- **1.6:**
  - the bed area is capped at `cargo.greenhouseM2`;
  - building on a NO-GO records the greenhouse, then the failure `{store:'power', sol: harvest-free sol of build}`.
- **1.7:** `shortKwh > 0` → failure on the first short storm sol.
- **After each recorder:** `runStores` up to the sol reached (1.3 → 1, 1.4 → 3, 1.5 → 5, 1.6 → 5 + the greenhouse's first harvest, 1.7 → storm arrival + 100, capped at `nextShipSol`). On a failure: `appendReport` then `showMissionOver`.
- **Warnings in 1.6 and the 1.7 prepare step:** `ui/lessons.ts`.
- **Browser test:** a 2-reactor run fails at 1.6 build or 1.7 → report v1 → restart → 1.1 shows the warning. Commit.

### Task 8: Remove the fixed 525-sol stay, docs

**Files:**
- All `SURFACE_STAY_SOLS` callers: `base-steps.ts`, `sol-visuals.ts`, `cargo-steps.ts`, `cargo-views.ts`, `storm-steps.ts`. They take the stay's sols as a parameter.
- `docs/data-sources.md`: a "Base stores" table with every value in Global Constraints and its source.
- **Done when:**
  - `make test`, lint and `tsc` are clean;
  - the browser check of 1.4 and 1.7 shows the chosen stay;
  - committed.
