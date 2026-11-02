# ATLAS redesign: Mission Episodes and retro tools

Date: 2026-11-02. Status: draft for the owner's review. The story and new additions await the winners research and the council.

Evidence: `reports/Mars learning app redesign.md`, `docs/council/council-report-2026-11-02.html`, and `research_notes/Mars learning app redesign/app_audit.md`. Direction contract: `.impeccable/surfaces/web-index-html.md`.

## 1. Goal

ATLAS becomes a fun, mission-based Mars survival guide that is easy to use on a phone and doesn't break. All science stays real.

The problem is timing more than colour: numbers arrive before anything depends on them. Mission 1.1 shows 491 words and 68 numerals before the player does anything. The fix has three parts: put a choice first, make its consequence the climax, and give it all a look nobody else has.

### Success checks

| Check | Today | Target | How it's checked |
|---|---|---|---|
| Time to first real decision, new player, unaided | Step 4 of 7 | Under 30 s | Watching 3 outside players |
| Player can say why the crew failed | Not tested | 3 of 3 | Asked after the run |
| Words on 1.1's first screen | 491 | About 120 (team target) | Re-run the audit script |
| Numerals on 1.1's first screen | 68 | About 5 (team target) | Re-run the audit script |
| Controls off-screen, phone start screen | 56 | 0 | Re-run the audit script |
| Primary controls under 44 px | 65 in view | 0 | Re-run the audit script |
| Opening all 8 mission scenes in a row on a mid-range Android | Not tested | No lost map or scene | Real phone |
| Demo with wifi off | Partial | Full demo path works | Rehearsal on the real device |

## 2. Decisions

**Settled**
- Visual world: Mission Episodes for the story and Retro Sixteen-Colour for the astronaut tools, chosen by the owner on 2 Nov.
- Depth: every screen changes. Missions 1.1, 1.5 and 1.6 also get new step-by-step play.
- Core fun: an early choice comes back later, with the exact shortfall and its source.
- No new science, simulation or data. This work is only design, ease of use and copy.

**The owner needs to confirm these**
1. **Team rule.** Replace "It is not a game. No points, no invented events, no made-up numbers." in `docs/story-mode-guide.md` with: "No invented numbers or events. No points or streaks. Stakes are real." This reverses a decision from 25 Oct, so it stays the owner's call.
2. **Crew identity.** The crew stay as roles: the Commander, the Engineer, the Scientist, the Medic. Named characters would be fiction. Roles speak through faceless suited silhouettes.
3. **What stays out.** 15 missions keep their current step structure, and the 5 unbuilt Expedition 3 missions stay hidden. Section 9 shows which survival topics that affects.
4. **Where the work lands.** Build on a `redesign` branch, and merge to `main` only after the 8 Nov check, because every push to `main` deploys to production.

## 3. The visual world

Two looks with one job each, chosen by the owner on 2 Nov:
- **Story: Mission Episodes.** Mars survival told as a series. Every mission opens like a jazz-era anime episode.
- **Astronaut tools: Retro Sixteen-Colour.** When a player uses a real tool, the screen cuts to an old adventure-game terminal: fixed windows, bitmap lettering, a locked palette.

The cut between them means something: colour and big type are the story, and the terminal is where real data and real calculations live.

### Where each look applies

| Episodes | Retro tools |
|---|---|
| First screen, trail, title cards | Route planner and GO/NO-GO |
| Crew lines, decisions in a mission | Wrist console and on-foot readouts |
| Consequence moment, tombstone | Walking range, line of sight, sun, storm and hazard tools |
| Survival Guide | "Show the numbers" sheet, map panels |

### Episode tokens

| Token | Hex | Use | Measured contrast |
|---|---|---|---|
| `--mustard` | `#E0A82A` | Main field | Ink on it 9.01 |
| `--brick` | `#A8341F` | Second field, big titles | Cream on it 5.34; on mustard 3.09, large type only |
| `--brick-deep` | `#7E2413` | Small labels on mustard | 4.56 on mustard |
| `--teal` | `#0F5F62` | Slicing bars, third field | Cream on it 5.99 |
| `--cream` | `#F1E6CF` | Reading panels | Ink on it 15.59 |
| `--ink` | `#0E0E0E` | Text, silhouettes, control fields | Mustard on it 9.01 |

Each mission floods a different field behind its title, so the 18 missions stop looking identical. Print grain sits over colour fields, and never over small text or numbers. Ink on brick measures 2.92, so it's never used for text.

### Retro tool tokens

A fixed set of up to 16 colours, used only in tools:

| Token | Hex | Use | Measured contrast on ground |
|---|---|---|---|
| `--crt-ground` | `#07072B` | Window ground | Reference |
| `--crt-text` | `#F4ECD8` | Body text | 16.6 |
| `--crt-line` | `#F0DDB0` | Window borders | 14.59 |
| `--crt-hi` | `#FFD86B` | Who is speaking, key values | 14.23 |
| `--crt-data` | `#58D0D8` | Live values | 10.64 |
| `--crt-select` | `#E0467C` | Selected row, ground-colour text on it | 4.97 |

The remaining slots are filled only as tools need them, each measured first. GO and NO-GO always use icon, word and shape together, never colour alone.

### Type

All self-hosted and licensed under the SIL Open Font License:
- **Anton:** episode titles and big story numbers. Oversized, tight, allowed to collide.
- **Atkinson Hyperlegible Next:** everything people read in the story.
- **DotGothic16:** tool lettering. It must stay readable at 16 px or larger and follow the user's text size.

Check that all three have the characters the app uses (`²`, `°`, `µ`, `≥`), and fall back to Atkinson where they don't.

### Components

| Today | Episodes | Retro tools |
|---|---|---|
| Navy rounded panel | Flat colour field sliced by hard diagonal bars | Fixed bordered window |
| Heading | Colliding title with episode number | Window title bar |
| Help text | Role silhouette with a line of text | Docked message window, "Engineer:" |
| `−` value `+` | Very large number, two big square buttons | Menu rows, selected row inverted, or stepper |
| Status text | Gauge with value, direction, word and icon | Same data as a dithered bar with value and word |
| "Next" | Action named for what it does | Named menu command |
| "Source" link | "Show the numbers" opens the retro sheet | Same sheet, with exact figure, formula and dataset |

### Crew silhouettes

Four original, faceless suited figures, one per role: Commander, Engineer, Scientist, Medic. Each gets a distinct outline so they can be told apart. They're illustrations, clearly not photos, drawn by the team or built as simple vector shapes.

### Rules that keep it from looking AI-made

Episodes: no glass, gradients, drop shadows, emoji, card grids or hairline rules. Hard flat fields only.

Tools: the retro form is a known style, so it must be strict: regions that never move, whole-pixel scaling for art, dither instead of blends, no glow or scanline effects, and no neon-on-black. Add real team sketches where they help, which also counts as evidence of the team's own work.

Big colliding type never carries a safety number or a limit. Those are always set plainly.

### Imagery

- Each mission's trail card is built from one real, credited NASA image cropped hard, with print grain and its colour field, using one script. Script and output are committed, with source and credit per image.
- Every card opens to the original unfiltered photo, credit and link. **Real NASA photos are never dithered** when they're shown as evidence.
- No images showing identifiable people as panel art. JPL posters are shown unmodified or not at all.
- **The 3D scene** stays in real colour in story steps. Dithering it inside tools is optional, done within three.js, and tested on a real phone on 3 Nov. **If it costs too much, it stays in full colour,** with no further debate.
- The Martian Map keeps real colour, because its imagery is the data. Tool windows sit around it, and text never sits directly on terrain.

### Legal

- Replace the logo in `ui/profile-gate.ts`, which resembles the NASA insignia, with an original mark.
- Remove `--nasa-blue` and `--nasa-red`.
- Add "Independent student project. Not endorsed by NASA." to the start screen.
- Add a rule to `api/explain.ts` so Ask ATLAS never says "according to NASA", and label its replies as AI-generated. Source lines come from the tested code beside the reply.

## 4. Player journey

**First screen.** Real HTML that paints before any JavaScript loads: one full-height episode title card, "Four people are going to Mars. Keep them alive.", and one button, "Pack the lander". Two small links sit below it: "Explore Mars" and "Jump to a saved run".

**First decision.** The button goes straight into mission 1.1's power decision. The name is asked after the first mission as "Sign the crew log". Until then the run saves under a placeholder, so nothing is lost.

**Trail.** Replaces the accordion. It's a vertical strip of tall panels, one for each mission, with one obvious next mission. Semantically it stays one `<ol>` per expedition. Finished missions stay replayable. Locked missions show their picture and name, never "After 1.1". Expedition 3 stays hidden.

**Saved runs.** Missions lock in sequence, so judges and filming need saved runs: one that succeeds, and one that fails at 1.6. They're labelled as saved runs, and "Jump to a saved run" loads them.

**Martian Map.** Becomes "Explore Mars", reachable from the trail and opened by missions when a decision needs it. Its instrument panels stay as they are in content. On a phone they collapse into one drawer, closed by default, so only the map shows.

## 5. The mission panel

`ui/mission-dock.ts` is shared by all 18 missions, so its redesign reaches all of them at once. `DockStep` stays compatible, so existing missions keep working unchanged. It gains:

- **Three step layouts.** On a phone:
  - `scene`: the 3D scene takes 55-60% of the height, with a short panel below.
  - `read`: full-screen episode fields.
  - `decide`: a big control, showing the scene only if the decision needs it.
  - On a desktop, the scene takes the larger share of the screen.
- **Fixed action bar** that respects safe areas, with content that scrolls fully clear of it.
- **Crew gauges** across the top of every mission, using the existing `ui/stores-bar.ts` data: at most 4 plain-word gauges, each with value, direction of change, word and icon. All from existing code.
- **"Why?"** collapses each mission's long text in one place. In the 15 lighter missions, long text moves behind it with no rewriting, so no number gets retyped.
- **Crew voice.** A step can include a line from a role, tap to continue, never on a timer. In the 15 lighter missions this field is simply left empty.
- **Accessibility.** Focus moves to the heading on each step, as today. Every 3D scene is paired with a text summary of the same numbers, and all decisions stay in the DOM.

## 6. The three deep missions

These were chosen because the early choice bites later in the code that exists today.

### Mission 1.1: Pack the lander
- Starts on the power decision, not the briefing. The briefing's content moves into "Why?" and role lines.
- Order: Power, Oxygen plant, Supplies, then route and stay, then the go/no-go. No decision is removed, so later missions keep their inputs.
- Each decision shows its immediate effect live through the same pure functions, such as "16.24 kW spare for greenhouse lights".
- The 11-row review becomes a go/no-go panel. The existing `laterView` data (SHORT and READY for 1.5, 1.6, 1.7) becomes the main event. The player can launch while short, which is what makes the later failure their own doing.
- "Load the lander" gets its ceremony: a stamp, a short sound, and the 3D scene reacting.

### Mission 1.5: First Marswalk
- Same treatment. The walk's existing suit failure becomes a full consequence moment.

### Mission 1.6: Greenhouse trial
- The climax of the demo: too few reactors from 1.1 means the lights can't run. It shows the kW needed, the kW available and the decision that caused it.

### The rule on previews

Show the immediate effect, and warn about the delayed one without fully drawing it. An early choice can then come back as a surprise with no randomness involved. A failure must explain itself at once, because the research shows retrying without feedback teaches almost nothing.

## 7. Failure and the survival guide

**Consequence moment.** Replaces `ui/mission-over.ts` visually, using the same data from `core/run-report.ts`. A full panel flip to hot orange, then:
1. What failed, on which sol, by how much.
2. Which earlier mission and choice caused it.
3. What to do next time, with the numbers and a source link.
4. A one-tap retry labelled with what it reloads.

**Tombstone.** The player can write a short epitaph, saved with the run, and it marks the real site on the map. Player words are the only jokes allowed: the science copy stays straight.

**Your Survival Guide.** One page collecting the run's existing lessons and decisions: mistake, next time, real numbers, source. No new calculations. It works offline and closes the demo video. Printing and Bangla wait until after the hackathon.

Mission patches, field-guide unlocks and shareable recap cards are stretch items only.

## 8. Foundations

### Performance (first, in this order)
1. Delete `explore-camera.ts:145`, which applies device pixel ratio twice in walk mode.
2. Pause the globe behind full-screen scenes with `useDefaultRenderLoop = false`, the pattern Street View already uses (`main.ts:561`).
3. Add a shared release helper calling `forceContextLoss()` in all 8 three.js stages, in the same commit as step 2. The rule from then on: exactly one 3D loop runs at any moment.
4. Handle `webglcontextlost`: save state, show a notice, reload, with a guard against reload loops.
5. Add a thin `main.ts` calling `import('./app')`, and put the first screen in `index.html`.
6. Add `viewport-fit=cover` and use `svh`, so safe areas and mobile browser bars behave.
7. Add a low-quality preset plus a frame-time monitor that only steps quality down.
8. Add `requestRenderMode` on the map if time allows.
9. Stop shipping `props_mars.glb` (21 MB) after checking nothing loads it.
10. Add a "Prepare offline" step covering the demo path, including range requests for the landing video.

### Theme sweep
Replace 347 literal colours in `style.css` and review the 106 in TypeScript. Map layer and chart colours stay data-driven, and they change only where text or contrast requires it. One token file. Colour alone never carries meaning.

### State safety
- `Progress` keeps `version: 1`, and changes are additive only, so existing saves keep loading.
- No saved decision is removed or renamed. Reordering steps doesn't change what gets saved.
- Saved runs are generated by a test script calling the real `record*` functions, never written by hand, so they can't contain invented values. If those functions change, the test fails.

### Copy rule
Cut rather than rewrite. **Never retype a number into text:** new copy gets numbers from the same functions the mission uses. Every new line in the deep missions is checked against `docs/data-sources.md`.

### Motion and sound
- Medium intensity, attached only to consequence: at most one stamp and one panel shake per mission. The map never shakes.
- Only `transform` and `opacity` animate.
- Reduced-motion users get a static change in place of each effect.
- Sound is short Web Audio tones after a user gesture, with a mute control. No audio files.
- Numbers animate only when a decision is changing them.

### Testing
- Test first for each new pure function (saved runs, the gauge model, cause lookup).
- All existing tests pass before each merge: `make test` and `make lint`.
- One Playwright script walks all 18 missions at 360, 390 and 1440 px, failing on console errors, off-screen controls or overlapping action bars. It grows from the audit script and adds no new dependency.
- Keyboard pass and contrast check on every new component.
- Update `docs/AI_USE.md` as the work proceeds, and `docs/story-mode-guide.md` when the rule changes.

## 9. Survival topics coverage

The owner asked for all aspects of Mars survival. Topic mentions in the 18 built missions, by a text search of the mission files (this shows a topic appears, not how deeply it's taught):

| Topic | Coverage | After this redesign |
|---|---|---|
| Power, oxygen, water, food, dust, terrain, radiation dose, toxic soil | Present in the built missions | Kept in all 18 |
| Medical care | Very thin (1 file) | Stays thin |
| Crew psychology, isolation | Thin (3 files) | Stays thin |
| Communication delay | Very thin in missions (1 file); exists in the map tools | Stays thin |
| Long-term radiation, food independence, Phobos, base handover | Expedition 3, unbuilt | Hidden |

**Decision for the owner:** the Survival Guide could show these thin topics honestly as "not yet covered". Adding real content for them would be new science and must wait.

## 10. Schedule

Nothing below starts until this spec and its implementation plan are approved.

| Date | Work | Done when |
|---|---|---|
| 2-3 Nov | Performance 1-6, safe build tagged, rule changed, real-phone test. Test screens for both looks on real terrain and on a phone. Shot lists for both videos | All 8 scenes open in a row on a real Android; the owner approves the test screen |
| 4-5 Nov | Fonts, tokens, colour sweep, logo, first screen, trail, new mission panel | One outsider finds the next mission unaided; all 18 still run |
| 6-8 Nov | Mission 1.1, saved runs, consequence moment, 1.6 | Audit numbers meet targets on 1.1 |
| **8 Nov evening** | **Go/no-go** | If 1.1 and the trail aren't solid, stop new work and film the themed build |
| 9 Nov | Mission 1.5, survival guide, tombstone, sound. **3 outsiders play on a phone** | They reach a decision within 30 s and can say why the crew failed |
| 10 Nov | Map theme and drawer, phone fixes, "Prepare offline", 18-mission script passes | Script is clean at all 3 widths |
| 11 Nov | Stop adding features. Finish review, DESIGN.md, merge to `main` | Production matches the branch |
| 12 Nov | Wifi-off rehearsal on the real device, backup build on a laptop | Full demo runs offline |
| 13 Nov | Record and subtitle the 240 s video, due 18:30 | Datasets named aloud |
| 14 Nov | 30 s video by 09:00, freeze and project page by 12:00 | Submitted |

Re-plan on 5 Nov using how fast the shell really went. These dates assume one person working with agents, and they haven't been tested against real pace.

**Fallback.** Tag the current build as `pre-redesign` before any work. Production stays on it until the merge, so a bad day on the branch never reaches judges.

### Cut order when behind
1. Patches, field-guide unlocks, recap card
2. Extra animation and sound
3. `requestRenderMode`, low-quality preset
4. Mission 1.5's deep work
5. Map tombstones
6. The guide page, leaving only the consequence moment

**Never cut:** performance 1-4, crew gauges, the lander moment, the explained failure, the new mission panel, the wifi-off rehearsal.

## 11. Out of scope

Expedition 3 missions; new simulation or data; deep rewrites of the 15 lighter missions; Bangla; printing; merging the map into the guide; a UI framework; new heavy dependencies; points, streaks, badges, leaderboards or random events.

## 12. Known risks

| Risk | What protects against it |
|---|---|
| Anime styling feels childish to judges | The science stays straight in the retro tools, with sources one tap away. Owner reviews on 3 Nov |
| Either look reads as a stock retro or AI template | Strict rules in section 3, real NASA images, real sketches. Show it to outsiders |
| Bitmap lettering tires readers or fails on small phones | Tools keep text short, 16 px minimum, follows text size. Test on a phone |
| Two looks feel like two apps | The cut is deliberate and repeated, with the same crew voice and numbers in both |
| Dithered scene too slow on phones | Tested 3 Nov, with a set fallback to full colour |
| A number goes wrong in new copy | Numbers come from code, and the deep missions are checked against sources |
| Themed lighter missions feel unfinished | Shared panel, gauges and printed art reach all 18, and the script checks them |
| Real-phone behaviour is unknown | First task. No performance gain here has been measured on a device yet |
| Schedule slips | Fixed go/no-go, cut order, and production stays safe until merge |
