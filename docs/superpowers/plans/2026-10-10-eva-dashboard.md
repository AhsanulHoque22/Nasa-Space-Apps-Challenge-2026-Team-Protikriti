# EVA walk dashboard with handheld camera

**Goal:** Starting an EVA walk takes over the screen with one dashboard that holds everything the side panel shows for a walk, plus live telemetry for the current position, named features, science notes and an elevation profile. The map view moves like a hand-held camera.

**Scope decisions**
- Replaces the footer in `ui/walk-player.ts`; keeps its single-session behaviour and `data-act` buttons.
- While a walk runs, every other panel is hidden (`body.eva-mode`); ending the walk restores them.
- Only data the app already has: route result, EVA card, grid, places (named features, samples, landing sites, zones), Mars time and sun, surface conditions, THEMIS ground firmness, dose rates. Anything without a site-specific source is labelled as a stand-in.
- Handheld view: small, slowly changing rotation (breathing, drift, fine tremor) added as increments, so mouse control still works; eased in over 2.5 s; off for `prefers-reduced-motion`; a toggle in the dashboard.

**Layout (Operate mode, mission-control look kept):** top bar (verdict, EVA progress, clock and season, End walk); left column (route numbers, stops with what is near each); right column (live telemetry, conditions, near you, know before you go); bottom (elevation profile with position, stop controls).

**Tasks**
1. `core/eva-telemetry.ts`: slope at a cell, route profile, nearby places, dose over the EVA. Tests.
2. `core/handheld.ts`: bounded, smooth sway and the ease-in. Tests.
3. Walk player: dashboard markup, live updates, `body.eva-mode`, handheld loop. Tests (happy-dom).
4. Route panel and main: pass the full plan and the context (places, time, conditions, ground firmness).
5. Styles; verify; commit.
