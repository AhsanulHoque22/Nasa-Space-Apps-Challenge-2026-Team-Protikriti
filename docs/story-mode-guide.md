# Story mode: developer guide

How we build ATLAS Story mode, so everyone works the same way. Read this before you change
anything under `web/src/ui/missions/`, `web/src/core/` mission files, or the mission data.

Related documents:

- Design spec (the why and the full mission list): `docs/superpowers/specs/2026-10-25-mission-journey-design.md`
- Phobos and farming spec (Spec B): `docs/superpowers/specs/2026-10-25-phobos-farming-design.md`
- Every number and dataset with its source: `docs/data-sources.md`
- AI use log (required for submission): `docs/AI_USE.md`
- Engineering standards for the whole repo: `CLAUDE.md` (they all apply here too)

Last updated 2026-10-26.

---

## 1. What Story mode is

NASA Space Apps 2026, Challenge 11 ("Interplanetary Survival Guide: Martian Map"), Team
Protikriti. ATLAS has two modes, chosen on the start screen:

- **Martian Map**: the original free-exploration map (layers, route planner, rover views).
- **Story mode**: a learning journey for students and science enthusiasts. A crew of four
  (Commander, Engineer, Scientist, Medic; one user "switches hats") must survive 525 sols on Mars
  until the return window. Missions unlock one after another. A wrong plan fails, and the user
  retries from the failing mission.

**No invented numbers or events. No points or streaks. Stakes are real.** It is a guided,
problem-solving mission built on real NASA plans, real data and real maths.

### Decisions already taken (do not re-open without the team)

| Topic                    | Decision                                                                                                                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Login                    | Local profile in the browser (name only), no backend                                                                                                                                                                     |
| Baseline                 | NASA Design Reference Architecture 5.0, with numbers updated from Rucker et al. 2016                                                                                                                                     |
| Crew                     | 4 people, roles as hats                                                                                                                                                                                                  |
| Finish                   | Survive 525 sols (539 days) to the return window                                                                                                                                                                         |
| Failure                  | Retry from the failing mission; earlier choices stay as the starting point                                                                                                                                               |
| Structure                | Expeditions made of missions; about 8 playable by the freeze, the rest shown locked with briefings                                                                                                                       |
| Spacecraft               | DRA 5.0 only. The crew's trajectory is a decision; the vehicle is not                                                                                                                                                    |
| Spec B (Phobos, farming) | Built by us. Greenhouse = mission 1.6, water from ice = locked 1.9, Phobos = event in 1.4 plus locked 3.4                                                                                                                |
| Look                     | Hybrid: 3D stage plus charts, guided steps (one decision per step)                                                                                                                                                       |
| Before landing           | The rotating globe stays in the background (no flying to a site before we have landed)                                                                                                                                   |
| Lander visual            | No real lander model exists, so the cargo bay shows a habitat plus cargo crates, labelled as a stand-in. The user-supplied `3D models/habitat_lander_pod.glb` is reserved for when a lander is needed (e.g. 1.3 Landing) |

---

## 2. The non-negotiable rules

1. **Never invent a fact or a number.** Every figure on screen traces to a source in
   `docs/data-sources.md`. If a value is not sourced yet, the feature waits or the value is
   labelled a team assumption (and listed as an open item, section 13).
2. **Positions come from data, never by eye.** Map pins use rover positions from NASA image
   metadata, PDS traverses or our terrain models (section 5.3).
3. **AI only explains, never computes.** All science lives in tested pure code in `web/src/core/`.
4. **Real pictures only.** NASA public-domain images or properly licensed models, each credited
   on screen. No computer-generated "photos", no 3-D anaglyphs (they need glasses).
5. **Offline-first.** Everything the demo needs is committed and served locally. The only
   exception today is the full-screen habitat viewer (a Sketchfab embed), which says on screen
   that it needs internet.
6. **Accessible.** Keyboard-operable, visible focus, labels on every control, contrast ≥ 4.5:1,
   never colour alone (charts use shapes too).
7. **Small, verified steps.** We build one piece at a time, test it in a real browser, show it,
   then move on.

---

## 3. Architecture

Functional core, imperative shell (see `CLAUDE.md`). Vite + TypeScript (strict), CesiumJS for
the globe, three.js (lazy-loaded) for 3D scenes, Vitest for tests.

```
web/src/core/          pure, tested: physics, data, progress (no DOM)
web/src/ui/            DOM: start screen, mission list, dock, steps, charts, 3D scenes
web/src/map/           Cesium: terrain, layers, pins, camera
web/public/data/       generated data (committed; rebuilt by pipeline/)
web/public/media/      photos (WebP, committed)
web/public/models/     3D models (optimised GLB, committed)
pipeline/              Python: builds every derived data file from raw sources
```

### 3.1 Core modules (Story mode)

| File                                                      | Job                                                                                                                                  |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `core/missions.ts`                                        | `EXPEDITIONS`, `MISSIONS` (id, title, briefing, hats, `built`)                                                                       |
| `core/mission-progress.ts`                                | Progress record, `missionStatus`, `completeMission`, `recordCargo`, `recordSite`, `retryFrom`, load/save with per-mission validators |
| `core/profile.ts`, `core/local-store.ts`                  | Profile and safe localStorage (damaged values are backed up, never lost)                                                             |
| `core/mission-constants.ts`                               | Every DRA 5.0 / Rucker 2016 constant, named with units and a source comment                                                          |
| `core/cargo.ts`                                           | Cargo items, mass, checks                                                                                                            |
| `core/cargo-phase.ts`                                     | Does the oxygen plant fill the return tanks in the worst 420 days?                                                                   |
| `core/surface-solar.ts`, `core/power-profile.ts`          | Sunlight per sol (Appelbaum & Flood), power through a sol                                                                            |
| `core/ephemeris.ts`, `core/lambert.ts`, `core/journey.ts` | Earth–Mars trajectories (JPL elements, Lambert solver)                                                                               |
| `core/landing-sites.ts`                                   | ±50° / +2 km limits, which zones have detailed terrain                                                                               |
| `core/site-features.ts`                                   | Mission 1.2 points of interest: text, position, source, photo                                                                        |

### 3.2 UI modules

| File                                                              | Job                                                                   |
| ----------------------------------------------------------------- | --------------------------------------------------------------------- |
| `ui/profile-gate.ts`                                              | Start screen: profile, mode choice, opens Story mode                  |
| `ui/story.ts`                                                     | Mission list; hands a mission to the player                           |
| `ui/mission-list.ts`                                              | Expeditions and missions; Start / Play again                          |
| `ui/mission-play.ts`                                              | Runs a mission on the map (`playCargo`, `playSite`), saves the result |
| `ui/mission-dock.ts`                                              | The dock: steps, Back/Next, header status, layouts                    |
| `ui/missions/cargo-steps.ts`, `journey-step.ts`, `cargo-views.ts` | Mission 1.1                                                           |
| `ui/missions/site-steps.ts`                                       | Mission 1.2                                                           |
| `ui/charts.ts`                                                    | All SVG charts (power, oxygen, zones)                                 |
| `ui/journey-scene.ts`, `ui/cargo-bay.ts`, `ui/habitat-viewer.ts`  | 3D scenes and the full-screen habitat view                            |
| `map/feature-pins.ts`                                             | Numbered pins on the terrain for mission 1.2                          |

### 3.3 How the pieces talk

`main.ts` creates the map, then passes **StoryServices** to the start screen:
`loadZones`, `showSite(siteId)`, `showGlobe()`, `pins`. Missions only use these services, never
the Cesium viewer directly. The services may be called before the map has loaded; `main.ts`
queues the request (the `siteView` holder).

While a mission plays, `document.body.dataset.story = 'mission'`. This hides the map's own
controls, and `isExploring()` (`map/picking.ts`) makes every map click tool ignore terrain
clicks. Without it, a click on the terrain would silently add route stops behind the dock.

---

## 4. How a mission is built

### 4.1 The dock and steps

A mission is a list of `DockStep`s (`ui/mission-dock.ts`):

```ts
type DockStep = {
  title: string;
  why: string; // one line: why this decision matters
  render: () => HTMLElement; // called every time the step is shown
  nextLabel?: string; // main button text ("Next" by default)
  onNext?: () => boolean; // return false to stay on the step
  layout?: "scene" | "map"; // wide screens: 'scene' = 3D left, dock right; 'map' = dock left, map right
  onShow?: () => void; // e.g. fly the camera, open a 3D scene, show pins
  onHide?: () => void; // undo whatever onShow did
};
```

Rules for steps:

- **One decision per step.** A final step reviews or confirms.
- **Show, don't tell.** Every step has a visual: a photo card, a live chart, a 3D scene or the map.
- **"Show the maths"** (a `<details>`) under every chart, filled with the user's own numbers.
- **The last step's own button finishes** the mission (`onFinish` is a no-op); it records the
  result through `mission-progress.ts` and calls `onDone(progress, note)`.
- Phones get the stacked layout automatically; test at 390 px wide.

### 4.2 Recording results

Each mission has a `record…` function in `core/mission-progress.ts`. A replay of a finished
mission reopens every later mission (their results depended on it): `recordCargo` and
`recordSite` call `retryFrom` first. Add a validator for the new saved field in
`SAVED_RESULT` so a damaged save reopens the mission instead of crashing.

### 4.3 Checklist for a new mission

1. **Sources first.** List every number and fact the mission needs, with its source, in
   `docs/data-sources.md`. Missing sources go to section 13 of this guide; the mission waits.
2. **Core, test first.** Write the failing Vitest test, watch it fail, write the pure function,
   watch it pass. Edge cases: empty input, zero, limits, NaN.
3. **Progress.** Add the `record…` function and the saved-result validator, with tests.
4. **Steps.** Build `ui/missions/<name>-steps.ts` from `DockStep`s; reuse charts and cards.
5. **Wire it.** `mission-play.ts` (a `play…` function), `story.ts` (route the id to `onPlay`),
   and set `built: true` in `core/missions.ts`.
6. **Visuals.** Photos and models (section 6), credited on screen and in `docs/data-sources.md`.
7. **Browser test** at 1440 px and 390 px (section 9).
8. **Docs.** `docs/data-sources.md`, `docs/AI_USE.md`, and this guide's status table.
9. **Commit** in small pieces (section 10).

---

## 5. Data and sourcing method

### 5.1 Where numbers come from

The baseline is DRA 5.0 (NASA-SP-2009-566) with updates from Rucker et al. 2016 (ISRU and power
for a Mars surface mission). Crew consumables come from BVAD Rev2 (NASA/TP-2015-218570).
Physics: Appelbaum & Flood net-flux tables, JPL approximate planetary elements, Lambert's
problem (Curtis, algorithm 5.2), the rocket equation. All are cited in
`docs/data-sources.md`, and every constant in code is a named constant with a source comment.

### 5.2 Researching a fact

- Prefer primary NASA, JPL and PDS sources, then peer-reviewed papers, then reputable science
  news. Wikipedia is fine for well-known facts and coordinates, cited as Wikipedia.
- Cite only URLs that turned up in a search or loaded; never a guessed URL. (JPL's site blocks
  scripted checks with HTTP 403; that does not mean the page is missing.)
- When sources disagree (e.g. 0.64 vs 0.67 mSv/day), pick the one you cite and say which.
- Dates to sols: sol = (date − landing time) / 1.0275 days. Landing times used: Perseverance
  18 Feb 2021 20:55 UTC, Curiosity 6 Aug 2012 05:17 UTC.
- Distances in text are measured between the stored positions on the 3,396,190 m sphere.

### 5.3 Placing map pins (mission 1.2 method)

| Source                                                                 | Use it for                                           | How                                                                                  |
| ---------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `web/public/data/stops/m20.json`, `msl.json` (NASA raw-image metadata) | Perseverance, Curiosity events                       | The rover's position at the stop nearest the event's sol; say which sol in `located` |
| PDS Geosciences Node corrected traverse (`MERA_traverse.csv`)          | Spirit events                                        | Equirectangular about 175.5°E, 0°N, R = 3,396,190 m, at the event's sol              |
| Site terrain model (`web/public/data/sites/<id>/grid.bin`)             | Features measurable from terrain (crater floor, rim) | Lowest/highest cell; check against published sizes                                   |

Opportunity's traverse (`MERB_traverse_5130.csv`) is relative to the landing point; anchored on
published landing coordinates it came out ~370 m off Victoria's rim in our terrain, so we do not
pin Opportunity positions. Do the same check (does the pin sit on the feature in the terrain?)
for any new source before trusting it.

Every pin in `core/site-features.ts` carries `finding`, `forCrew`, `located`, `source` and
`photo`. The tests in `site-features.test.ts` enforce that every pin lies on or beside its terrain
tile and has all of these.

### 5.4 Terrain data rules

- Mars is not Earth: Mars 2000 sphere (3,396,190 m) unless a product says otherwise.
- Nodata is NaN.
- **HiRISE DTEEC DTMs also write 0.0 where stereo matching failed.** Read them with
  `zero_is_nodata: true` in `pipeline/data/sites.json`: the pipeline reads full resolution, masks
  the zeros and averages a 5 m cell only if every 1 m pixel is valid. Averaging zeros into real
  ground made walls up to 4.3 km high (fixed 2026-10-26).
- Never edit a generated file by hand. Change the pipeline, rebuild, compare, then copy.

---

## 6. Assets

### 6.1 Photos

- Source: NASA Image and Video Library API (`https://images-api.nasa.gov/search?q=…&media_type=image`),
  or Wikimedia Commons for NASA originals the API lacks (check the licence says public domain).
- Read the NASA description before choosing; reject computer-generated models and anaglyphs.
- Convert to WebP, longest side 960 px, quality 78 (Pillow); crop wide panoramas to 16:9 at the
  centre. Store in `web/public/media/<area>/pia#####.webp`.
- Caption only what NASA's description says. Credit with NASA's own credit line (from the
  asset's `metadata.json`, e.g. "NASA/JPL-Caltech/MSSS"), linked to the Photojournal page.

### 6.2 3D models

- Use models from NASA 3D Resources (`github.com/nasa/NASA-3D-Resources`) or CC BY models from
  the team folder `3D models/`. Confirm the licence (Sketchfab API: `api.sketchfab.com/v3/search`).
- Optimise with glTF-Transform:
  `gltf-transform optimize in.glb out.glb --compress meshopt --texture-compress webp --texture-size 1024`
  (add `--simplify-ratio` for heavy meshes). The habitat went from 517 KB to 49 KB.
- Inspect materials after export: the NASA habitat was marked glass-like (transmission) and
  metallic, which rendered black or see-through. Fix the file (matte, non-metal), not the code.
- Credit every model on screen and in `docs/data-sources.md`.
- **Adding the Starship cargo rocket (mission 1.3):** download "SpaceX Starship Cargo" by
  AllThingsSpace (CC BY 4.0) from Sketchfab as glTF/GLB (needs a free account), put it in
  `3D models/`, then run
  `gltf-transform optimize "3D models/<file>.glb" web/public/models/landing/starship-cargo.glb --compress meshopt --texture-compress webp --texture-size 1024`.
  The landing stage shows it automatically, with its credit; check its size and materials.
  If you choose a different model, update the credit in `ui/landing-stage.ts` and `docs/data-sources.md`.

---

## 7. The Flight Director (help when stuck)

`core/flight-director.ts` (pure, tested) and `ui/flight-director.ts`. When a cargo plan gets a
NO-GO, a "Stuck? Ask the Flight Director" button appears under the verdict (mission 1.2) and under
the oxygen preview (mission 1.1). Rules, agreed with the team:

- **The user tries first.** Nothing shows until there is a NO-GO, and nothing opens until the user
  asks. Verdict text gives no hints of its own.
- **Options, never a plan.** It names the problem (night cooling or seasonal energy), how far short
  the tanks are, and up to three _changes_ (e.g. "+1 Solar array set") with the mass each adds and
  how much must come off other cargo to stay under 40 t. There is no "apply" button: the user makes
  the change.
- **Computed, not generated.** It tries every addition of up to three power units (reactors, solar
  sets, batteries, oxygen plants) within each item's maximum, keeps only changes that pass the
  same `cargoPhase` model as the verdict, drops any change that contains a smaller passing one,
  and lists the lightest first. The search runs only when the user asks.
- New missions with a pass/fail check get the same pattern: a pure `…Options()` function with
  tests proving every option passes when applied, and the shared `flightDirectorHelp` UI.

## 8. Charts and design

- Inline SVG in `ui/charts.ts`. One y-axis per chart, a legend for two or more series, direct
  labels for the few marks that matter, a hover readout, an `aria-label` summary.
- Palette (validated with the dataviz checker on the dock surface #121a2c): reactor/primary
  `#5b8def`, solar `#c27c22`, status red `#ff8a78`, muted `#a9b6cc`. Never colour alone: use shapes.
- Console text sizes: body 16 px, notes 15 px, small print 13 px minimum.
- Design tokens are the existing ones in `web/src/style.css` (`--nasa-blue`, `--surface`, …).
  Do not add a new look.

---

## 9. Testing and verification

- **Unit tests:** `make test` (pytest + vitest) must be green. TDD for every pure function and
  every bug fix: the failing test comes first.
- **Lint and types:** `make lint` (ruff, mypy --strict, tsc, eslint, prettier).
- **Browser:** run `npm run dev -- --host` in `web/` (port 5173) and test the real flow.
  We drive installed Chrome with `playwright-core` from a Node script and take screenshots with
  CDP `Page.captureScreenshot` (the plain screenshot call can hang on the Cesium canvas). Seed
  the browser with a profile and progress in `localStorage` (`atlas.profile`, `atlas.progress`)
  to start at any mission.
- Headless Chrome renders Cesium and three.js in software: allow 30–100 s for scenes and
  imagery. That slowness is not the app's.
- Check both 1440×900 and 390×844. Look at every screenshot before saying it works.
- A flaky test exists: `src/core/stitch.test.ts` (Street View) sometimes times out under load.
  Re-run before chasing it.

---

## 10. Git workflow

- Conventional Commits (`feat:`, `fix:`, `docs:`, `style:`, `test:`, `chore:`, `refactor:`),
  one logical change per commit. Style changes never share a commit with behaviour changes.
  Pipeline code fixes and regenerated data go in separate commits.
- The owner commits to `main`; teammates work on their own branches and open PRs.
- Every push to `main` deploys production, so push only green, browser-tested work.
- No secrets in the repo. No AI attribution lines in commit messages.
- Generated web data in `web/public/data/` is committed on purpose (the site deploys complete).
- Do not commit: `3D models/`, `HiRISE_IMages/`, `.playwright-cli/`, raw data.

---

## 11. Known traps (each cost us time)

| Trap                          | What happens                                                                                                                                                                                 | Do this                                                                                                         |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| CSS class names collide       | `.zone-name` (zone panel, `all: unset`) wiped chart label styles; `.timeline` had clashed too                                                                                                | Grep `style.css` before naming a class; prefix by feature (`zone-chart-label`, `plan-timeline`)                 |
| SVG attributes vs CSS         | Any CSS rule beats an SVG presentation attribute such as `text-anchor`                                                                                                                       | Check computed style in the browser when an SVG looks wrong                                                     |
| Cesium `CLAMP_TO_GROUND`      | Points stay at the datum, km above the exaggerated terrain, and drift in tilted views                                                                                                        | Place points at `surfaceM(lon, lat)` (rendered ground height), as stops and pins do                             |
| Standard site camera          | `viewAoi` misses small tiles (Victoria)                                                                                                                                                      | Frame a step on its own content (`flyToBoundingSphere` of the pins)                                             |
| three.js `position`           | `object.position = …` throws (read-only)                                                                                                                                                     | `object.position.set(x, y, z)`                                                                                  |
| three.js labels               | `CSS2DObject` elements stay in the page after `group.clear()`                                                                                                                                | Remove label elements first                                                                                     |
| Map clicks during a mission   | Hidden tools reacted to terrain clicks                                                                                                                                                       | Keep `body.dataset.story = 'mission'`; new map click handlers must check `isExploring()`                        |
| Model materials               | Exported glass/metal flags render black or see-through                                                                                                                                       | Inspect and fix the GLB material                                                                                |
| HiRISE zeros                  | 0.0 means failed stereo, not ground at datum                                                                                                                                                 | `zero_is_nodata` (section 5.4)                                                                                  |
| Cesium models on the live map | At close range the drawn terrain keeps refining (hundreds of metres at Gale), so models at the DEM height get buried, clamping jumps between tiles, and in headless Chrome they never showed | Show 3D hardware on a three.js stage in front of the map (cargo bay, landing stage) and only fly the map camera |
| Prettier reformatting         | Exact-text edits fail after Prettier rewraps lines                                                                                                                                           | Re-read the file before editing                                                                                 |

---

## 12. Status (2026-10-26)

| Mission                                                          | Status                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Start screen, profile, mission list, Play again                  | Done                                                                                                                                                                                                                                                                                                                        |
| 1.1 Briefing and cargo                                           | Done: journey (3D trajectories, routes with resources), power, oxygen plant, supplies, review; live charts with Show the maths; 3D cargo bay (NASA habitat, crates, Jezero terrain); full-screen habitat viewer                                                                                                             |
| Flight Director (help after a NO-GO)                             | Done in 1.1 and 1.2                                                                                                                                                                                                                                                                                                         |
| 1.2 Choose the landing site                                      | Done: limits chart of all 30 zones; visit to 4 certified sites with zone numbers and 15 sourced, pinned points of interest with NASA photos; oxygen verdict at the chosen site                                                                                                                                              |
| 1.3 Landing                                                      | Done: Perseverance's landing explained with NASA photos; the real onboard footage (offline, captioned); air pressure against elevation for the four sites; touchdown with the lander pod in 3D in front of the real site. The Starship cargo rocket appears once its model file is added (section 6.2)                      |
| 1.4 Build the base                                               | Done: place habitat, reactors, arrays and oxygen plant on the real terrain; slope (15°, team assumption), reactor ≥ 1 km (Rucker 2016), array shadow on the darkest sol (10%, team assumption); Flight Director hints on request; sol 1 starting supplies. The Phobos transit event comes later (needs Spec B transit data) |
| 1.5–1.8                                                          | Planned (see the spec, section 4). 1.6 Greenhouse is blocked until its parameters are sourced                                                                                                                                                                                                                               |
| Spec B cores (farming score, greenhouse budget, Phobos transits) | Planned                                                                                                                                                                                                                                                                                                                     |
| Everything else                                                  | Locked, briefings shown                                                                                                                                                                                                                                                                                                     |

Schedule: missions 1.4–1.8 by 9 Nov; polish, accessibility and offline rehearsal 10–12 Nov;
feature freeze 14 Nov 12:00. Cut order if behind: 1.6 → locked, 1.5 → locked, landing video →
still image with facts, base placement → auto-place with checks shown.

---

## 13. Open items (resolve before the mission that needs them)

1. ISS ECLSS oxygen and water recovery fractions.
2. Lander slope limit for pad placement (else reuse the walk limit, labelled a team assumption).
3. Sourced masses for the science lab, pressurised rover and spares (DRA 5.0 addendum).
4. Primary NTRS citation for the ±50° / +2 km landing bounds (on screen already; pin the document).
5. Water extraction rate from shallow ice (locked 1.9; the app cites NTRS-20190002020 for 3 L/sol).
6. Suit consumables per Marswalk (mission 1.5).
7. Greenhouse parameters (mission 1.6): lighting, photoperiod, crop water, recycling, yield, mass.
8. Mission epoch: crew landing date from a published conjunction-class trajectory.

Map clutter to decide: during 1.2 the map's own sample labels crowd Jezero; we may hide those
layers while a mission plays.

---

## 14. Later phase: the mission explainer (chatbot)

Planned for after the freeze-critical missions; not built yet. A chatbot that explains the what,
why and how of everything in Story mode: the planning, the physics, the data and why a verdict came
out as it did. Rules it must follow:

- **It explains, it never computes.** Every number it uses comes from the app's pure core (the
  verdict, the Flight Director's options, `docs/data-sources.md`), passed to it as context. It does
  not make up numbers or plans, and it does not give away a full plan (same rule as section 7).
- **It cites.** Answers point to the source of each fact (the cited documents and datasets).
- **Offline fallback.** A language model needs a server holding the API key (never in the repo)
  and internet. Without them the app falls back to its own written explanations ("Show the maths",
  the Flight Director), so the offline demo still works.
- Logged in `docs/AI_USE.md` like every AI use; judges must see that the science is deterministic.

## 15. Working with an AI assistant on this repo

We use Claude Code. Every AI contribution is logged in `docs/AI_USE.md` (what it did, what the
team decided). The assistant follows `CLAUDE.md`, this guide and the rules in section 2: it
researches and cites, never invents numbers, writes tests first, and checks its work in a browser
before calling it done. Review its diffs like any teammate's.
