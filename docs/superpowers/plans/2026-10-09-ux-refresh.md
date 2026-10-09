# UX refresh: grouped workbench and visible selected states

**Goal:** Make the app understandable at a glance and make every toggle show whether it is on.

**Findings (from running the app):**
- The right column stacks ~14 unrelated panels (weather, explore, walkthrough, route, sync, benchmark, comms link, dose, dust, scenario, zones, compare, geology) in one scrolling list.
- Toggles use `aria-pressed` / `aria-checked`, but only 4 control types style that state, so most look identical on or off.

**Scope:** `web/src/ui/dock.ts` (new), `web/src/main.ts` (one call), `web/src/style.css`. No change to panel logic.

## Design
- Keep identity: mission-control dark panels, NASA blue = selected/primary, NASA red = hazard/route only.
- One tab bar on top of the right column, grouped by purpose:
  - **Plan**: walkthrough, route, saved hazards, comms link.
  - **Explore**: weather stations, explore on foot, landing-zone ranking.
  - **Science**: geology, Jezero vs Jamuna, dust, scenarios, radiation dose, route benchmark.
- A one-line plain-language hint under the tabs says what the tab is for.
- Transient panels (weather result, site report, activity and cave cards) stay visible on every tab.
- Selected state, one rule for all toggles: blue gradient fill, white bold text, light inset ring, soft glow, plus a check mark (not colour alone). Unselected: quiet fill with a visible hover and pressed (scale) state.

## Tasks
1. [ ] `dock.ts`: `renderDock(side)` builds the tablist, classifies panels by class (MutationObserver for late ones), arrow-key navigation, roving tabindex.
2. [ ] `main.ts`: call `renderDock(side)` after the panels are mounted.
3. [ ] `style.css`: dock styles; global selected/hover/active button rules; panel polish.
4. [ ] Verify in browser at desktop and 390 px; `tsc`, ESLint, Vitest.
5. [ ] Commit and push.
