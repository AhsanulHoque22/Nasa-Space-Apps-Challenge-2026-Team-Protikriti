# Dashboard Mode Upgrade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-mode hero card with live KPIs, per-mode accent colour, and body `data-mode` attribute to the ATLAS Martian Map's three dashboard tabs (Plan / Explore / Science).

**Architecture:** A tiny `hero-state.ts` module holds typed KPI state and a subscriber list; panels call push functions after computing data; `dock.ts` renders a 4-stat hero card and repaints it on every hero change and tab switch; CSS custom properties per `body[data-mode]` colour each mode's accent.

**Tech Stack:** TypeScript (strict), vanilla DOM, CSS custom properties, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-17-dashboard-modes-design.md`

## Global Constraints

- TypeScript strict mode — no `any` without a comment.
- No new runtime dependencies.
- All new DOM built with `document.createElement` (no `innerHTML` for dynamic content).
- Hero stat labels: sentence case, 11 px, muted — no uppercase letter-spacing.
- No CSS gradients, no new box-shadows on elements at rest.
- Accent colours exactly: Plan `#5b8def`, Explore `#e86030`, Science `#2aab96` (lift values for text use; base values `#0b3d91 / #b84a10 / #156b5e` for fills).
- `make test` must stay green after every task.

## Review Focus

1. **Hero stays blank until panel data arrives** — `—` placeholder must render; no undefined crash.
2. **Mode switching while route is mid-computation** — hero must show stale plan KPIs, not crash.
3. **Weather panel rendered before a station is chosen** — explore hero must show `—` not `null` or empty string.
4. **Science KPIs pushed once on load** — if geology panel is not mounted yet when push fires, subscriber list must still be empty-safe.
5. **Layer group spotlight with no `data-mode` on body** — CSS must not break default layout when `data-mode` is absent.

---

### Task 1: `hero-state.ts` — typed KPI store

**Files:**
- Create: `web/src/ui/hero-state.ts`
- Test: `web/src/ui/hero-state.test.ts`

**Interfaces:**
- Produces:
  - `heroKPIs(): { plan: PlanKPIs; explore: ExploreKPIs; science: ScienceKPIs }`
  - `onHeroChange(fn: () => void): void`
  - `pushPlanKPIs(vals: Partial<PlanKPIs>): void`
  - `pushExploreKPIs(vals: Partial<ExploreKPIs>): void`
  - `pushScienceKPIs(vals: Partial<ScienceKPIs>): void`
  - Types: `PlanKPIs`, `ExploreKPIs`, `ScienceKPIs` (all fields `string`)

- [ ] **Step 1: Write the failing test**

```ts
// web/src/ui/hero-state.test.ts
import { describe, it, expect, vi } from 'vitest'
import { heroKPIs, onHeroChange, pushPlanKPIs, pushExploreKPIs, pushScienceKPIs } from './hero-state'

describe('heroKPIs', () => {
  it('initialises with em-dash placeholders', () => {
    const k = heroKPIs()
    expect(k.plan.verdict).toBe('—')
    expect(k.explore.temp).toBe('—')
    expect(k.science.radiation).toBe('0.67 mSv/d')
  })

  it('pushPlanKPIs merges and notifies', () => {
    const fn = vi.fn()
    onHeroChange(fn)
    pushPlanKPIs({ verdict: 'GO', dist: '4.2 km' })
    expect(heroKPIs().plan.verdict).toBe('GO')
    expect(heroKPIs().plan.dist).toBe('4.2 km')
    expect(heroKPIs().plan.dur).toBe('—')
    expect(fn).toHaveBeenCalledOnce()
  })

  it('pushExploreKPIs merges and notifies', () => {
    const fn = vi.fn()
    onHeroChange(fn)
    pushExploreKPIs({ temp: '−60 / −10 °C' })
    expect(heroKPIs().explore.temp).toBe('−60 / −10 °C')
    expect(fn).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd web && npx vitest run src/ui/hero-state.test.ts
```
Expected: FAIL — `hero-state` not found.

- [ ] **Step 3: Implement `web/src/ui/hero-state.ts`**

Export types and state as described. Default plan/explore fields all `'—'`. Science defaults: `radiation: '0.67 mSv/d'`, `unit: 'ETi · Jezero'`, `ice: 'trace'`, `firmness: 'medium'`. Push functions `Object.assign` the relevant sub-object then call each subscriber. `onHeroChange` appends to a module-level array.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd web && npx vitest run src/ui/hero-state.test.ts
```
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/ui/hero-state.ts web/src/ui/hero-state.test.ts
git commit -m "feat: hero-state KPI store for dashboard mode cards"
```

---

### Task 2: Upgrade `dock.ts` — hero card + body data-mode

**Files:**
- Modify: `web/src/ui/dock.ts`

**Interfaces:**
- Consumes: `heroKPIs`, `onHeroChange` from `./hero-state`
- Produces: sets `document.body.dataset.mode` to `'plan' | 'explore' | 'science'` on every tab select; renders `.hero-card` inside `.dock` panel above the hint line.

- [ ] **Step 1: Add hero card HTML structure to `renderDock`**

Below the `.dock-tabs` div, before the `.dock-hint` paragraph, add a `<div class="hero-card">` containing four `<div class="hero-stat">` children. Each stat has two `<span>` children: one with class `hero-val` and one with class `hero-label`. Give each stat `data-slot="0"` through `data-slot="3"` so `renderHero` can target them by index without querying by content.

- [ ] **Step 2: Add `renderHero(active: Tab, card: HTMLElement)` helper inside `renderDock`**

Signature: `(active: Tab, card: HTMLElement) => void`.

Define per-mode stat configs:
```ts
const HERO: Record<Tab, { val: () => string; label: string }[]> = {
  plan: [
    { val: () => heroKPIs().plan.verdict, label: 'Verdict' },
    { val: () => heroKPIs().plan.dur,     label: 'EVA time' },
    { val: () => heroKPIs().plan.dist,    label: 'Distance' },
    { val: () => heroKPIs().plan.climb,   label: 'Climb' },
  ],
  explore: [
    { val: () => heroKPIs().explore.temp,     label: 'Air temp' },
    { val: () => heroKPIs().explore.pressure, label: 'Pressure' },
    { val: () => heroKPIs().explore.sky,      label: 'Sky' },
    { val: () => heroKPIs().explore.sol,      label: 'Sol' },
  ],
  science: [
    { val: () => heroKPIs().science.unit,      label: 'Geo unit' },
    { val: () => heroKPIs().science.radiation, label: 'Radiation' },
    { val: () => heroKPIs().science.ice,       label: 'Ice' },
    { val: () => heroKPIs().science.firmness,  label: 'Firmness' },
  ],
}
```

For each slot 0–3, set the `hero-val` span's `textContent` and the `hero-label` span's `textContent` from `HERO[active][i]`.

- [ ] **Step 3: Wire `renderHero` into `select` and subscribe to state changes**

In the `select` function, after updating `active`, call `renderHero(active, heroCard)`. After `side.prepend(dock)`, call `onHeroChange(() => renderHero(active, heroCard))`.

In `select`, also set `document.body.dataset.mode = tab`.

- [ ] **Step 4: Manual smoke test** — open the app, switch tabs, confirm hero card shows four `—` slots per tab; confirm body has `data-mode` attribute.

- [ ] **Step 5: Commit**

```bash
git add web/src/ui/dock.ts
git commit -m "feat: dashboard hero card and body data-mode attribute"
```

---

### Task 3: CSS — hero card styles and per-mode accent

**Files:**
- Modify: `web/src/style.css`

**Interfaces:**
- Consumes: `data-mode` on `body`, `.hero-card`, `.hero-stat`, `.hero-val`, `.hero-label`, `.dock` panel.

- [ ] **Step 1: Add per-mode CSS custom properties**

After the `:root` block add three blocks — `body[data-mode="plan"]`, `body[data-mode="explore"]`, `body[data-mode="science"]` — each defining:
- `--mode-accent` (fill colour)
- `--mode-accent-lift` (text/highlight colour)

Values from spec.

- [ ] **Step 2: Add hero card layout styles**

```css
.hero-card {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-1);
  padding: var(--space-2) var(--space-1) 0;
  border-top: 1px solid var(--rule);
  margin-top: var(--space-2);
  border-left: 2px solid var(--mode-accent, var(--nasa-blue));
  padding-left: var(--space-2);
}

.hero-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.hero-val {
  font-size: 16px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hero-label {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
}
```

- [ ] **Step 3: Add active dock tab accent**

After the existing `[role='tab'][aria-selected='true']` rule, add a specificity override for dock tabs only so the active tab uses `--mode-accent-lift` for its gradient fill:

```css
.dock-tabs [role='tab'][aria-selected='true'] {
  background: linear-gradient(180deg,
    color-mix(in srgb, var(--mode-accent-lift, var(--nasa-blue-lift)) 60%, transparent),
    color-mix(in srgb, var(--mode-accent, var(--nasa-blue)) 80%, transparent)
  ) !important;
}
```

Wait — taste-skill bans gradients. Use flat fill instead:

```css
.dock-tabs [role='tab'][aria-selected='true'] {
  background: color-mix(in srgb, var(--mode-accent, var(--nasa-blue)) 90%, transparent) !important;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.2), 0 2px 6px rgb(0 0 0 / 0.4) !important;
}
```

- [ ] **Step 4: Layer group spotlight**

```css
/* Spotlight: relevant layer group is full brightness; others dim */
body[data-mode] .layer-group-wrap { opacity: 0.45; transition: opacity 180ms ease-out; }
body[data-mode] .layer-group-wrap[data-mode-group~="plan"],
body[data-mode="plan"] .layer-group-wrap[data-mode-group~="any"] { opacity: 1; }
body[data-mode="explore"] .layer-group-wrap[data-mode-group~="explore"] { opacity: 1; }
body[data-mode="science"] .layer-group-wrap[data-mode-group~="science"] { opacity: 1; }
```

- [ ] **Step 5: Commit**

```bash
git add web/src/style.css
git commit -m "feat: per-mode accent colours and hero card CSS"
```

---

### Task 4: Wire route panel → Plan hero KPIs

**Files:**
- Modify: `web/src/ui/route-panel.ts`

**Interfaces:**
- Consumes: `pushPlanKPIs` from `./hero-state`

- [ ] **Step 1: Import `pushPlanKPIs` at the top of `route-panel.ts`**

- [ ] **Step 2: Find where verdict, EVA time, distance, and climb are written to the DOM**

In `route-panel.ts`, the values are set via `field(k).textContent = …` for keys `"eva"`, `"distance"`, `"relief"`, and `evaBadge.textContent = …`. Locate these assignment points (they appear together when a route is computed successfully).

- [ ] **Step 3: After those DOM writes, call `pushPlanKPIs`**

```ts
pushPlanKPIs({
  verdict: evaBadge.textContent ?? '—',
  dur:     field('eva').textContent ?? '—',
  dist:    field('distance').textContent ?? '—',
  climb:   field('relief').textContent ?? '—',
})
```

Also call `pushPlanKPIs({ verdict: '—', dur: '—', dist: '—', climb: '—' })` in the route clear path (where `result.hidden = true` is set).

- [ ] **Step 4: Manual test** — draw a route, switch to Plan tab, confirm hero card shows real values.

- [ ] **Step 5: Commit**

```bash
git add web/src/ui/route-panel.ts
git commit -m "feat: push plan KPIs to dashboard hero card"
```

---

### Task 5: Wire weather panel → Explore hero KPIs

**Files:**
- Modify: `web/src/ui/weather-panel.ts`

**Interfaces:**
- Consumes: `pushExploreKPIs` from `./hero-state`

- [ ] **Step 1: Import `pushExploreKPIs` at the top of `weather-panel.ts`**

- [ ] **Step 2: In `renderWeatherPanel`, after `tiles(latest)` is appended, call `pushExploreKPIs`**

```ts
if (latest) {
  pushExploreKPIs({
    temp:     `${fmt(latest.minC, '°')} / ${fmt(latest.maxC, '°C')}`,
    pressure: fmt(latest.pressurePa, ' Pa'),
    sky:      latest.opacity ?? '—',
    sol:      latest.sol != null ? `Sol ${latest.sol}` : '—',
  })
}
```

- [ ] **Step 3: Manual test** — open weather panel, switch to Explore tab, confirm hero card shows the four weather values.

- [ ] **Step 4: Commit**

```bash
git add web/src/ui/weather-panel.ts
git commit -m "feat: push explore KPIs to dashboard hero card"
```

---

### Task 6: Layer panel `data-mode-group` and science KPIs push

**Files:**
- Modify: `web/src/ui/layer-panel.ts`
- Modify: `web/src/ui/geology-panel.ts` (or `main.ts` — wherever geology is mounted)

**Interfaces:**
- Consumes: `pushScienceKPIs` from `./hero-state`

Science KPIs are constants already known from the spec; push them once at module load.

- [ ] **Step 1: Read `layer-panel.ts` to find where layer groups are rendered**

The `LAYER_ITEMS` array has a `group` field. The `renderLayerPanel` function groups items by `group` string and renders each group in a `<details>` or wrapper element.

- [ ] **Step 2: Wrap each group in a `<div class="layer-group-wrap">` with `data-mode-group`**

Map each `group` string to a mode-group value:
- `'Surface'` → `data-mode-group="plan science"` (slope hazard for plan, thermal for science)
- `'Composition'` → `data-mode-group="explore science"`
- `'Missions'` → `data-mode-group="explore"`
- `'Human exploration'` → `data-mode-group="science any"` (caves/zones are always relevant)

Add `data-mode-group="any"` to groups that should always be full brightness (or that `plan` always sees).

- [ ] **Step 3: Push science KPIs once from `geology-panel.ts`**

At the top of `renderGeologyPanel`, call:
```ts
import { pushScienceKPIs } from './hero-state'
// push once — these are constants
pushScienceKPIs({ unit: 'ETi · Jezero', radiation: '0.67 mSv/d', ice: 'trace', firmness: 'medium' })
```

- [ ] **Step 4: Manual test** — verify layer groups dim/brighten on mode switch; verify Science hero shows constants on page load.

- [ ] **Step 5: Commit**

```bash
git add web/src/ui/layer-panel.ts web/src/ui/geology-panel.ts
git commit -m "feat: layer group mode spotlight and science hero KPIs"
```

---

### Task 7: Verification and visual QA

**Files:** None changed.

- [ ] **Step 1: Run full test suite**

```bash
cd /home/ahsanul-hoque/Nasa_Space_Apps && make test
```
Expected: all pass, no regressions.

- [ ] **Step 2: Build production bundle and check for TypeScript errors**

```bash
cd web && npm run build
```
Expected: zero type errors, successful build.

- [ ] **Step 3: Open app and walk through all three modes**

Verify:
- Plan tab: hero shows `—` placeholders; after drawing a route, shows verdict/EVA time/distance/climb; clearing the route resets to `—`.
- Explore tab: hero shows `—` until weather panel is opened; after opening it shows temperature/pressure/sky/sol.
- Science tab: hero shows constants immediately on load.
- Tab accent colour changes with each tab switch.
- Layer spotlight dims non-relevant groups.
- `body.dataset.mode` is set correctly (check DevTools).

- [ ] **Step 4: Commit any fixes found during QA**

```bash
git add -p
git commit -m "fix: dashboard mode QA fixes"
```
