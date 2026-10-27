# Base stores, mission over, and the last-run report

Story mode, Expedition 1. Agreed with the user on 2026-10-27.

## 1. What the user asked

- The crew live on what they packed in 1.1 and what they make on Mars. If any supply runs out early, the expedition is over and the player **starts again from 1.1**.
- Reports are numbered: **Mission report v1, v2, …**, one per failed run, and all of them are kept.
- In a later run, a choice that repeats a mistake from a report gets a **warning** at once, naming the report ("Mission report v2 warned about this").
- After a failed run, the player gets a **report of the mistakes**, mission by mission, with **suggested measures** for each mission. In the next run the report sits **inside each mission**, closed by default, for the player to open when they want help.

## 2. The stores

A pure module `core/base-stores.ts` keeps a ledger on a **sol clock**. Every number comes from code that already exists, or is labelled a team assumption.

| Store | Starts with | Used by | Made by | Source |
|---|---|---|---|---|
| Food (crew-sols) | `cargo.foodSols` | 1 per sol | greenhouse kcal ÷ crew kcal per sol, from the first harvest day | BVAD Rev2 12.707 MJ/CM/day (`crewKcalPerDay`) |
| Water (kg) | `cargo.waterKg` | 4 × 3.217 kg/day × (1 − recovery) | — (1.9 "Water from ice" adds later) | BVAD Table 3-31; recovery **98 %, ISS ECLSS (NASA, June 2023)**, applied to the Mars habitat as a team assumption |
| Steady power (kW) | reactors × 8.75 | habitat 12.1 + return rocket 6.655 + greenhouse lights | — | DRA 5.0, Rucker 2016 (`spareReactorKw`) |
| Battery (kWh) | battery banks × 658 | storm sols short of sunlight | solar surplus | Rucker 2016; `stormRun` |
| Suit oxygen / battery | full suit per EVA | the walk | refilled at the airlock | `suit-model` (Bellcomm, Carson 1972) |

The ledger is not ticked live. Each mission, when it ends, hands over **the sols it took** and **what it used**. The ledger then says either "still alive" or "ran out of X on sol N".

**How the sol clock moves:**
- 1.3 lands on sol 1.
- 1.4 to 1.6 take the sols they already show, such as the greenhouse growth days.
- 1.7 jumps to the storm's arrival sol + 100.
- 1.8 runs to sol 525.

Food and water are checked at every step of the clock. So a 400-sol food pack fails on the sol it runs out, even when that sol falls during the jump to 1.8.

## 3. What ends the run

| Mission | What ends the run | Today |
|---|---|---|
| 1.1 | No change. The cargo checks already block launch. | blocks |
| 1.5 | Suit oxygen or suit battery reaches 0 before the airlock. | warns only |
| 1.6 | Building a greenhouse whose lights exceed the spare reactor power: the base browns out. The NO-GO stays a warning, so the player may build it anyway and live with the result. | warns only |
| 1.7 | Any storm sol with a power shortfall (`shortKwh > 0`): habitat life support stops. | records it |
| any | Food or water reaches 0 on the sol clock. | not tracked |

**The "Mission over" screen:**
- what ran out, on which sol, and the numbers behind it;
- the run report (§4);
- one button, **"Start Expedition 1 again"**, which clears `atlas.progress`, keeps the profile, and opens 1.1.

## 4. The run report

`core/run-report.ts`, pure: `runReport(progress, failure) → Lesson[]`.

```ts
type Lesson = {
  missionId: string
  mistake: string
  measure: string
  numbers: string
  /** The choice that caused it, as a rule the next run can test (§4a). */
  guard: Guard
}
type MissionReport = {
  version: number // 1, 2, … per profile
  endedSol: number
  cause: string
  lessons: Lesson[]
}
```

Rules use the same models as the missions, so every suggested measure is checked before it is shown. For example:
- "pack 3 reactors" is offered only if `reactorsNeeded` says 3 fits.
- "keep-alive mode" is offered only if `stormRun` holds with it.

Examples:

- **1.1:**
  - "You packed 2 reactors. The habitat and return rocket need 18.8 kW and 2 give 17.5 kW." → "Pack at least 3. Your greenhouse plan needs 3."
  - "Food for 400 of 525 sols." → "Pack 525 sols, or plan a greenhouse that grows the rest."
- **1.5:** "Suit oxygen ran out 600 m from the airlock." → "Pick a nearer stop, or turn back when oxygen reaches 40 %."
- **1.6:** "Lights 2.7 kW, spare power −1.3 kW." → the `reactorsNeeded` / `greenhouseOptions` fix.
- **1.7:**
  - "The habitat stayed in normal mode."
  - "The battery ran flat on storm sol 11."

  → the cut from `stormOptions` that holds, or more battery banks from 1.1.

There are also lessons from missions that didn't end the run, such as a walk that only just made it back. The mission that ended the run is marked.

**Storage:**
- Reports are saved under their own key, `atlas.reports`, bound to the profile owner.
- It is a list `MissionReport[]`, oldest first; a failed run appends the next version.
- It survives the restart. A new crew name starts with no reports.

## 4a. Warnings from past reports

A `Guard` is plain data that a pure function `guardHit(guard, choice) → boolean` tests against the current choice. Examples:

| Guard | Fires when |
|---|---|
| `{ kind: 'min', field: 'cargo.kilopower', value: 3 }` | packing fewer than 3 reactors in 1.1 |
| `{ kind: 'min', field: 'cargo.foodSols', value: 525 }` | packing too little food (unless the greenhouse plan covers it) |
| `{ kind: 'max', field: 'greenhouse.peakKw', value: spare }` | planting more lights than the reactors carry |
| `{ kind: 'equals', field: 'storm.habitatMode', value: 'nominal' }` | keeping the habitat in normal mode for the storm |
| `{ kind: 'min', field: 'walk.marginMin', value: 60 }` | planning a walk with less than the 1 h reserve |

**When a guard fires:**
- An amber warning appears beside the control at that moment, not at the end of the mission. It reads: **"Mission report v2: last time 2 reactors left the greenhouse with no power. Pack at least 3."**
- It links to that lesson in the report.
- Warnings never block. The player can ignore them and live with the result, as with the Flight Director.
- Only the newest report that has a lesson for that choice gives the warning, so the same mistake doesn't warn twice.

## 5. Where the player sees it

1. **Stores bar** in Story mode while a mission is open. It shows:
   - Sol N / 525;
   - food sols left;
   - water kg;
   - spare power kW;
   - battery kWh.

   Each item shows a word as well as a colour (OK / Low / Out), so the state is never shown by colour alone.
2. **The Mission over screen** (§3), with the full report.
3. **In each mission of the next run:** a closed button in the dock header, "Lessons from Mission report v2 (2)". It opens only that mission's lessons. It doesn't appear when there are none.
4. **Live warnings** (§4a) beside the control when a choice repeats a reported mistake.
5. **The Story screen** keeps a "Mission reports" list (v1, v2, …), and each one opens in full.

## 6. Testing

- **TDD for the pure modules:**
  - `base-stores`: food runs out on the right sol; the greenhouse adds sols; water with recovery; storm shortfall ends the run.
  - `run-report`: each rule fires with its numbers; each suggested measure passes its own check.
  - `guardHit` for each guard kind;
  - versions count up and old reports are kept;
  - the `atlas.reports` validator.
- **Browser:**
  - a 2-reactor run fails in 1.7 and shows the report;
  - Start again opens 1.1;
  - the lessons button shows in 1.1 and 1.6;
  - packing 2 reactors again shows the "Mission report v1" warning.

## 7. Not in scope

- Live ticking of stores inside a mission.
- Repairing or trading supplies.
- Fuel for the return rocket: the cargo phase in 1.1 already checks it.
- Mission 1.8 is not built yet. It will call the ledger for sols up to 525.
