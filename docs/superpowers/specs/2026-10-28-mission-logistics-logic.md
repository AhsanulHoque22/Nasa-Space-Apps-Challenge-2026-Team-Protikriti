# Mission logistics logic (council-reviewed)

Story mode, Expedition 1.

**Sources:**
- Research: `reports/NASA Mars surface logistics planning.md`, with notes in `research_notes/NASA Mars surface logistics planning/`.
- LLM council of 5 advisors, 5 peer reviews and a chairman: `docs/council/council-transcript-2026-10-28.md`.

## The problem, with numbers

**One 40 t lander can't hold a base that regrows:**

| What's packed | Mass |
|---|---|
| Habitat 21.5 t + 3 reactors (with cabling) 5.65 t + 2 ISRU 3.36 t + food to the next ship | 37.8 t (ship on sol 742) / 38.4 t (ship on sol 804) |
| Adding recycler 1.4 t, water 0.75 t, one battery 3.17 t and 10 m² of greenhouse 0.82 t | 43.9–44.5 t |

**Two reactors can't run the base:** 17.5 kW is less than the constant load of 18.755 kW (habitat 12.1 + return-rocket conditioning 6.655).

**NASA never flies this on one lander.** DRA 5.0 lands:
- a cargo lander first, with 18,430 kg of surface payload (its ascent stages fill the rest of its 40 t);
- a habitat lander, with 40,400 kg.

## Rules to implement

| # | Rule | Source |
|---|---|---|
| L1 | Two landers. **Lander A** (cargo, landed about 26 months before the crew) holds ≤ 18,430 kg of surface payload. **Lander B** (habitat, with the crew) holds ≤ 40,400 kg. | DRA 5.0 Table 5-1 |
| L2 | Lander A is shown as "already on Mars": a pre-filled DRA manifest where the player edits only the reactor count, solar and battery, and the food share. The player packs lander B in full. There are two mass gauges. | team assumption (UX) |
| L3 | Reactors and ISRU go on lander A: the return rocket's oxygen is made before the crew launches. The cargo phase needs 26.355 kW (ISRU 19.7 + conditioning 6.655), so 3 reactors are 105 W short. The player needs **4 reactors, or 3 plus solar**. | Rucker 2016; DRA p.51 go/no-go |
| L4 | A delivered Kilopower gives 8.75 kWe (35 kWe ÷ 4). Label the 10 kWe figure as the nameplate rating. | Rucker 2016 |
| L5 | **Stored food covers 100%** of the time to the next ship, planned for the worst case of sol 804 (labelled), plus a 10% margin. It is split 75% on lander A and 25% on lander B. The greenhouse never reduces what must be packed. | DRA 5.0 Table 5-1 and the 10% surface margin |
| L6 | **GO check:** the stores ledger survives to sol 804 in two runs, (a) nominal and (b) greenhouse at zero yield. A third run, (c) a 120-sol storm at about 30% solar, gives a warning listing the cuts needed (keep-alive mode, lights off). | Rucker 2016 storm sizing |
| L7 | The greenhouse yields nothing until its first harvest. After that it gives area × BVAD nominal edible g/m²·day, only on sols when its lights have power. There is no learning derate. | BVAD Tables 4-89 and 4-90 |
| L8 | Light power = each crop's daily light need ÷ 1.66 µmol/J (BVAD) ÷ 80% delivery. Hardware mass is 81.5 kg/m². Kusuma's 3.4–4.1 µmol/J for modern LEDs is mentioned in the text only. | BVAD Tables 4-87 and 4-88 |
| L9 | **Regrowth earns time:** every harvested kg adds to the food store on top of the required stock. The ledger and run report show **"sols earned"** = surplus ÷ (4 × 2.39 kg). Earned sols pay for walks and survive a late ship. | team assumption |
| L10 | The next ship brings food for the rest of the stay. Expedition 1's window ends on sol 804. | DRA §6.3.1 supply pipeline; team assumption |
| L11 | Water use is 4.48 kg/person-day at an early base. The recycler recovers 98%; without one, water is used once. | BVAD; ISS 2023 |
| L12 | Crew oxygen comes from the ISRU plants. A derived "Air" line fails only if ISRU loses power. There is no water drain from electrolysis. | DRA 5.0; Hoffman 2022 (MOXIE) |
| L13 | A briefing at the start of 1.1 covers the lander limits (18.4 t and 40.4 t), sol 804, storms, why growing food doesn't save mass on a 2-year stay, what "sols earned" means, and each term in one line (sol, kWe, ISRU, keep-alive, BVAD, DRA, µmol/J). | team (copy) |
| L14 | A "What later missions need" table shows pass/fail rows computed from the plan: 1.5 suit charging, 1.6 spare kW for lights, 1.7 storm, 1.9 ISRU water, 1.10 rover, 1.11 spare reactor. | team assumption |
| L15 | Run reports gain mass per lander, sols earned, and the result of the zero-yield run. | — |

## Answers to the open questions

1. **Two landers,** with lander A pre-filled and only lightly editable.
2. **Greenhouse yield:** nominal BVAD, credited only from the first harvest and only while the lights have power.
3. **Oxygen** comes from ISRU and power, shown as a derived "Air" line. There is no separate oxygen store.
4. **Stored food covers 100%** to sol 804 plus 10%. The greenhouse earns sols (L9) instead of replacing packed food, so crop failure is covered and growing still pays.
5. **LED efficiency:** BVAD's 1.66 µmol/J. Kusuma 2020's 3.4–4.1 µmol/J appears in the text only.

## Cut until after the demo

- the Flight Director packing plans;
- the Mars low-moisture menu toggle;
- the net-mass panel;
- packing ship 2;
- the orbital-abort story beat.

## First step: a golden test

Before any UI, add a test that NASA's own DRA 5.0 manifest is valid and winnable:
- **Lander A ≤ 18,430 kg:** 4 reactors, 2 ISRU and 75% of the food.
- **Lander B ≤ 40,400 kg:** habitat, recycler, water, battery, 10 m² of greenhouse and 25% of the food.
- It must pass the L6 runs (a) and (b), with **sols earned > 0**.

**Checked by hand:**
- Lander A: 7.4 + 3.36 + 6.5 = 17.3 t.
- Lander B: 21.5 + 1.4 + 0.75 + 3.17 + 0.82 + 2.2 = 29.8 t.
