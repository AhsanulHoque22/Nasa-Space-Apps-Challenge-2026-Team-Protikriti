# Martian Map: engineering standards

Project: NASA Space Apps 2026, "Interplanetary Survival Guide: Martian Map".
A layered map of a Martian site that plans a safe Marswalk route using data from multiple NASA missions.
Plan: `docs/superpowers/plans/2026-09-28-martian-map.md`. Every rule below applies to every change.

## 1. Design principles (in priority order)

1. **Correct first, then simple, then fast.** Measure before optimizing (profile, don't guess).
2. **YAGNI.** Build only what a current task needs. No speculative flags, plugin systems or "for later" abstractions.
3. **KISS.** Code must be understood quickly by a reader. If a teammate can't follow it in one pass, simplify it.
4. **DRY, applied with judgment.** Extract only on the third real repetition. Two similar lines beat a premature abstraction.
5. **Single responsibility.** One module = one job. Pure computation (slope, cost, routing) is kept separate from I/O (files, network, DOM).
6. **Functional core, imperative shell.** Algorithms are pure functions on arrays/plain data. Loading, rendering and user input stay at the edges. This keeps the core fast to test.
7. **Explicit over implicit.** Units are in names (`pixel_size_m`, `slope_deg`, `duration_min`). No magic numbers: every physical constant is a named constant with a source comment.
8. **Fail loudly at boundaries, trust inside.** Validate external input (files, URLs, user clicks off-map) where it enters. Internal functions assume valid input.

## 2. Code quality

- **Python ≥3.11:** `uv` for environment and dependencies, one `pyproject.toml`, `ruff` (lint and format), `mypy --strict` on `pipeline/`, and `pytest`. Type hints on every public function.
- **TypeScript:** `strict: true`, ESLint and Prettier, and Vitest. No `any` without a comment saying why.
- **Naming:** names say what a thing is or does. Comments explain *why*, not *what*.
- **Functions:** short, one level of abstraction, and at most about 4 parameters (use a dataclass or type beyond that).
- **Errors:** never swallow exceptions. Raise specific errors with actionable messages. Never lose user data.
- **Dependencies:** check stdlib, then already-installed libraries, before adding anything. Each new dependency needs a one-line justification in the commit.
- **Style changes** never share a commit with behavior changes.

## 3. Testing (TDD by default)

- Write the failing test first, watch it fail, then make it pass (superpowers:test-driven-development).
- Unit-test every pure function, including edge cases: NaN/nodata, empty input, start == goal, unreachable goal, map edges.
- Tests must fail when the code is broken. Assert on values, not just "no crash".
- Keep tests small and deterministic. Use tiny synthetic arrays in fixtures, never real 100 MB DEMs.
- A single command runs everything: `make test` (pytest + vitest).

## 4. Geospatial data rules

- **Record the CRS on every dataset.** Mars is **not** Earth: never assume EPSG:4326 or Web Mercator. Use the Mars 2000 sphere (IAU_2015:49900, radius 3,396,190 m) unless the product says otherwise.
- **Raw data is immutable.** `data/raw/` is download-only and git-ignored. Every derived file is reproducible from a script in `pipeline/`.
- **Ship Cloud-Optimized GeoTIFFs.** DEMs use `COMPRESS=LERC_ZSTD` (lossless, or `MAX_Z_ERROR` ≤ 0.1 m). Imagery uses `COMPRESS=JPEG`. Store the smallest dtype that holds the precision.
- **Nodata is NaN** in float arrays and propagates through slope, cost and routing, which treats it as impassable.
- **Cite the source** of every dataset (mission, instrument, product ID, URL) in `docs/data-sources.md`. Judges check this, and so should we.

## 5. Frontend rules

- Static site, no backend unless one is truly needed. Heavy computation is preprocessed in the pipeline, and the browser only runs routing on a small grid.
- **Performance budgets:** LCP < 2.5 s, INP < 200 ms, CLS < 0.1 (Core Web Vitals). Lazy-load layers. Run routing off the main thread (Web Worker) if it takes over 50 ms.
- **Accessibility:** WCAG 2.2 AA basics. Keyboard-operable controls, visible focus, contrast ≥ 4.5:1, a label on every control. Hazards are never shown by color alone.
- UI and design work goes through the impeccable / frontend-design skills.

## 6. Security

- No secrets in the repo. Tokens (e.g. Cesium ion) come from `.env`, which is git-ignored, and `.env.example` documents them.
- Pin dependency versions (lockfiles committed: `uv.lock`, `package-lock.json`).
- Treat every fetched file or URL as untrusted input.

## 7. Workflow

- **Git:** small commits with one logical change each. Conventional Commit messages (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`). Never commit data files or secrets.
- **Definition of done:** tests pass, lint and type checks are clean, docs are updated if behavior changed, and it was verified by running it (superpowers:verification-before-completion). Evidence comes before any claim.
- **Review checklist (Google eng-practices):** design, functionality, complexity (no over-engineering), tests, naming, comments explain *why*, docs, and every line read.
- **Don't degrade code health.** Every change leaves the code at least as clean as it was.

## 8. Hackathon reality

- **Demo-first.** A working, narrow vertical slice beats a broad broken one. Protect the critical path: map → layers → route → mission summary.
- **Timebox research spikes** to 1 hour, then decide and write the decision into the plan.
- Judging (verify current criteria on spaceappschallenge.org): impact, creativity, validity (real NASA data used correctly), relevance to the challenge, and presentation.

Sources: Google eng-practices (code review), 12factor.net, OGC COG standard and geostandards-ch COG best practices, web.dev Core Web Vitals, WCAG 2.2, NASA Trek API, USGS Astrogeology Jezero products.
