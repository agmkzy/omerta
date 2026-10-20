# Tech stack

This document covers what OMERTÀ is built with, why, what that costs, and where it will strain as the project grows. State, saves and backwards compatibility have their own document ([02-state-saves-and-compatibility.md](02-state-saves-and-compatibility.md)). The Vue/Vitest/Pinia question is treated in depth in [08-framework-migration.md](08-framework-migration.md).

## What it is built with

| Layer | Technology | Where |
| --- | --- | --- |
| Language | TypeScript 5.6, `strict: true`, typechecked only (`noEmit`) | [tsconfig.json](../tsconfig.json) |
| Runtime (game) | Any modern browser. The whole game is **one self-contained HTML file** with an inline `<script type="module">` | [web/index.html](../web/index.html), `dist/omerta.html` |
| Runtime (tools/tests) | Node.js 22 (see [.nvmrc](../.nvmrc)) running TypeScript directly through `tsx` | [package.json](../package.json) |
| Bundler | Vite 8 (Rolldown, Oxc minifier) → one minified ES module (`target: es2020`), inlined into the page shell by `vite-plugin-singlefile`. `npm run dev` gives a live-reload dev server | [vite.config.ts](../vite.config.ts) |
| UI | No framework. Views are functions returning HTML strings. `render()` assigns them to `#app.innerHTML`. One delegated click listener dispatches `data-a="action:value"` codes | [src/web.ts](../src/web.ts), [src/ui/](../src/ui) |
| Styling | Hand-written CSS in the page shell, CSS custom properties, no preprocessor. It ships as authored, without minification | [web/index.html](../web/index.html) |
| Graphics | Procedurally painted SVG portraits (must not change, see CLAUDE.md) | [src/ui/portrait.ts](../src/ui/portrait.ts) |
| Simulation | Plain TypeScript functions over one serialisable `World` object. A seeded PRNG (mulberry32) and a discrete event queue | [src/engine.ts](../src/engine.ts), [src/rng.ts](../src/rng.ts), [src/types.ts](../src/types.ts) |
| Persistence | `localStorage` (main save + up to 3 rolling snapshots), plus manual JSON download/upload | [src/storage.ts](../src/storage.ts), [src/web.ts](../src/web.ts) |
| Tests | Vitest 5 runs the suites in parallel, with `@vitest/coverage-v8` for coverage. The assertions are `node:assert` | [src/tests/](../src/tests), [vitest.config.ts](../vitest.config.ts), [05-testing.md](05-testing.md) |
| Hosting | Static file: GitHub Pages (legacy build from `main`, path `/`, serves `index.html`) and a claude.ai artifact | [06-deployment.md](06-deployment.md) |

**Runtime dependencies: none.** The five dev dependencies are `typescript`, `tsx`, `vite`, `vite-plugin-singlefile` and `@types/node`. They install 23 packages in total, most of them Vite's (Rolldown, Lightning CSS, PostCSS and their platform-specific native binaries). Nothing is fetched at runtime, and the page makes no network requests.

Size: about 27,700 lines of TypeScript (roughly 21,000 engine, 3,000 UI, 3,500 tests) in about 85 files. The bundle is about 1.08 MB, including the template and CSS.

## Why this stack

The project has no written decision record. The reasons below are inferred from the code, [HISTORY_early_README.md](HISTORY_early_README.md) and [AUDIT.md](AUDIT.md), and labelled as such.

1. **It started as a Claude artifact.** A claude.ai artifact is a single HTML page with no build server and no external fetches. A single self-contained file with an inline script is the natural fit. `downloadSave()` in [web.ts](../src/web.ts) still has a code path for the `window.claude` downloads capability. This is the biggest single driver of the build design.
2. **Determinism and testability over UI richness.** The early README is explicit: "If the world can't produce good stories as plain text, no illustrated map will save it." The simulation was built first, as pure functions over plain data, runnable headless in Node (`cli.ts sim`, `bot.ts`, `playtest/pt.ts`). A UI framework would have added nothing to that.
3. **Plain-data world = free saves.** Keeping the whole game in one JSON-serialisable object means a save is `JSON.stringify(world)`. Determinism tests compare serialised worlds byte for byte. No ORM, store or class hierarchy gets in the way.
4. **Zero-dependency runtime.** Nothing can break from upstream releases. The page works offline and from `file://`, and is trivially hostable anywhere.
5. **Fast inner loop.** The original esbuild build took about 15 ms. The Vite build that replaced it takes about 0.1 s and adds a live-reload dev server. `tsx` runs any TypeScript file directly, so any module or test is one command away with no compile step.

## Cons of the current stack

| Area | Problem | Evidence |
| --- | --- | --- |
| UI rendering | Every action rebuilds the entire screen as a string and replaces `#app.innerHTML`. It is simple and correct, but it discards focus, scroll position (restored manually) and DOM state. Per-frame cost scales with the size of the current view | `render()` in [web.ts](../src/web.ts) |
| XSS surface | Every interpolated string must be passed through `esc()` by hand. Forgetting once is an injection bug, because there is no auto-escaping templating. Names come from generated data today, but the player types their own name | `esc()` in [ui/links.ts](../src/ui/links.ts) |
| UI ↔ sim coupling | `web.ts` (879 lines) imports 43 modules and mutates the world directly in some handlers. Views also read deep into the `World` shape. There is no query layer | [04-architecture.md](04-architecture.md) |
| Global mutable singleton | UI state is one exported object `S` holding the world, the current view, a back stack and about 40 loose fields. Any module can write any of it | [ui/state.ts](../src/ui/state.ts) |
| Module tangle | 30 engine modules form one strongly connected import cycle (core ↔ econ ↔ world ↔ …). Nothing stops it growing | [04-architecture.md](04-architecture.md#dependency-structure) |
| Tests | Since the move to Vitest there is a runner with filtering, watch mode, parallel files and coverage thresholds. What's left: the UI has no tests at all, and v75 is one slow file that sets the wall-clock time of every run | [05-testing.md](05-testing.md) |
| Type safety at the edges | `tsc` checks `src/` only. `playtest/` is not in `tsconfig.json`. Saves are parsed with `JSON.parse` and cast to `World` with no runtime validation. `ensureShape` and the migration chain are the only defence | [tsconfig.json](../tsconfig.json), `deserialize` in [engine.ts](../src/engine.ts) |
| Persistence | `localStorage` is synchronous, about 5 M characters per origin, and blocks the main thread on every save. Saves grow with play (measured below) | [storage.ts](../src/storage.ts) |
| Build | There are no source maps in the shipped file and no linter or formatter config | [vite.config.ts](../vite.config.ts) |
| Main-thread simulation | `advance()` runs synchronously on the UI thread. A long wait (days) freezes the page until the simulation catches up | `advance()` in [engine.ts](../src/engine.ts) |

## Where the hurdles will be as the project grows

These are ordered by how soon they bite.

1. **Save size against the `localStorage` quota.** Measured with `createWorld(3)` running unattended (no player actions, which add more memos, knowledge and ledger entries than this):

   | Game day | Save size | `serialize()` time | Largest parts |
   | --- | --- | --- | --- |
   | 0 | 0.25 MB | 0.4 ms | chars 228 k |
   | 30 | 1.22 MB | 3.4 ms | chars 933 k, facts 136 k |
   | 60 | 1.53 MB | 4.8 ms | chars 1,146 k, facts 157 k |
   | 120 | 1.89 MB | 6.0 ms | chars 1,395 k, facts 196 k |
   | 180 | 2.05 MB | 6.4 ms | chars 1,540 k, facts 217 k |
   | 365 | 2.87 MB | 11.7 ms | chars 2,277 k, facts 240 k |

   The real played fixture `v84-day35-mid.save` is already 1.08 MB at day 28. With three snapshots the game wants four copies, so by about day 60 snapshots are being shed to fit the 4.2 M-character budget. That matches the "save-size failure around day ~60" noted in CLAUDE.md. Per-character `known` and `rels` maps dominate, and they grow with population × facts. More characters, families or districts make this worse quadratically. See [02-state-saves-and-compatibility.md](02-state-saves-and-compatibility.md#7-size-and-the-quota) for options (compression, IndexedDB, delta snapshots).
2. **The import cycle and the giant modules.** `dialogue.ts` (2,358 lines), `jobs.ts` (1,244), `encounters.ts` (986), `voicesheet.ts` (994) and `meetings.ts` (943) carry mixed responsibilities. Every new system currently joins the 30-module cycle because it needs `core`, and `core` reaches back into `econ`, `rank`, `orgs` and `goals`. Isolated testing and replacement get harder with every addition.
3. **Simulation cost on the main thread.** The unattended 365-day run took about 32 s in Node, roughly 90 ms per simulated day, and it grows with fact count. In the browser, a "wait a week" action is a visible stall. Moving `advance()` into a Web Worker is straightforward because the world is plain data, but every UI action would then become async.
4. **The UI string-rendering model.** More screens, animation, maps or partial updates will fight the full re-render. A component model (Vue, Svelte or Lit) becomes worthwhile around the point where the UI needs local component state or incremental updates.
5. **The test harness.** Without a runner, adding tests means adding to bespoke scripts. Slow suites (v74 and v75 simulate months) block a quick pre-commit loop. There is no coverage visibility. See [05-testing.md](05-testing.md).
6. **Single-file distribution.** The artifact constraint forbids code-splitting and lazy loading. At about 1 MB this is fine. If art or audio is ever added, it becomes the limit.

## Viability of switching to Vue + Vitest (+ Pinia)

**Short version.** Vitest is a low-risk, high-value change you can make today without touching gameplay code. Vue is viable for the UI layer only, as an incremental rewrite of `src/ui/*` and `web.ts`. The simulation should stay framework-free plain TypeScript. Pinia can hold the UI state and a reference to the world, but the world itself must not become reactive deep state. The full analysis, a migration plan and a cost estimate are in [08-framework-migration.md](08-framework-migration.md).

## How global state is stored

There are exactly two pieces of global state. Both are covered in detail in [02-state-saves-and-compatibility.md](02-state-saves-and-compatibility.md).

1. **The `World`** ([types.ts](../src/types.ts)). One plain object containing everything that exists: characters, businesses, families, facts, debts, jobs, situations, the event queue, the RNG state and the clock. It holds no classes except `Rng`, which is serialised as its integer state. Every engine function takes `w: World` as its first argument and mutates it in place. All game state lives here. The engine also keeps some module-level values outside the world. There are performance caches (`ownerCache` in core.ts, `aliveCache` in actions.ts, `tailCache`/`troubleCache` in econ.ts, all keyed by World object, and `medians` in books.ts, keyed by seed and day). There are a few counters (`nextItem` in meetings.ts, `spentOut` in goals.ts, `REPAIRS` in rank.ts, `w0` in jobs.ts) and exported tuning switches (`AGENCY`, `SIT`) that tests flip. None of these is saved, and some of the caches can make a reloaded game diverge (see [02-state-saves-and-compatibility.md](02-state-saves-and-compatibility.md#gaps)).
2. **UI state `S`** ([ui/state.ts](../src/ui/state.ts)). A module-level singleton: `S.w` (the current World), `S.view` (a discriminated-union `View`), `S.stack` (back navigation) and transient fields such as log lines, news, chips, pending option lists, expanded banners and character-creator choices. Only `S.w` is saved. Everything else in `S` resets on reload. One exception: an in-progress club conversation is stored on the world (`w.scene`) on purpose, so a reload resumes it.

## How the save system works

In one paragraph: after every state-changing action, `web.ts save()` calls `serialize(world)` (`JSON.stringify` plus schema number plus RNG state). `storage.writeSave()` then writes it to `localStorage['omerta-save-v3']`, reads it back to verify, rolls back on corruption, and keeps up to three snapshots taken at least three game days apart. Loading calls `deserialize()`, which runs `ensureShape()`, the schema migration chain (v1 → v7) and per-character defaults. If the main save is unreadable, loading falls back to the newest readable snapshot. The full description is in [02-state-saves-and-compatibility.md](02-state-saves-and-compatibility.md).

## Can saves be exported? Backed up to the cloud?

- **Export/import: yes, already.** "Download a backup file" (`dlsave:`) writes `omerta-day-N.json`. "Load a backup file" (`ulsave:`, the `#ulfile` input) reads one back through the same `deserialize()` path, so old exported files are migrated like any other save.
- **Cloud backup: not implemented.** It is possible and fairly cheap, because a save is one JSON string, but it needs a backend or third-party storage plus identity. Options and a recommendation are in [02-state-saves-and-compatibility.md](02-state-saves-and-compatibility.md#cloud-backup).

## Could saves load from a localStorage backup into a Pinia store?

Yes, mechanically. `deserialize(localStorage.getItem(KEY))` returns a plain `World`, and a Pinia store can hold it. The important caveat is that the world must be stored as a **non-reactive** value (`markRaw`/`shallowRef`). Making 1–3 MB of nested data deeply reactive would put Vue proxies on every access in the hot simulation loop. It would also break the determinism tests' byte-for-byte comparisons if proxies leak into serialisation. The pattern that works is a store holding `world: shallowRef<World>` plus a `version` counter bumped after each engine call. Code is in [08-framework-migration.md](08-framework-migration.md#4-pinia-and-the-world).

## How reactivity is handled today

**Manually, by full re-render.** There is no observer, signal, proxy or diffing. The cycle is:

1. A click lands on any element with `data-a="action:value"`. One `document` listener finds it with `closest('[data-a]')`.
2. `handle(action, value)` in [web.ts](../src/web.ts) calls engine functions (which mutate `S.w`), updates `S.view`/`S.stack`, and usually calls `save()`.
3. The listener then always calls `render()`. That rebuilds the whole screen HTML from `S` and the world and assigns `#app.innerHTML`. Scroll is reset to the top unless the action is in a small "in place" list (`tog`, `lsub`, `pf`, …).
4. Exceptions thrown in `handle()` or a view are caught. The UI falls back to the Today tab with a message, and the world is not rolled back.

This is predictable and has no stale-state bugs, because everything is recomputed. The costs are the full DOM replacement and the fact that derived data is recomputed on every frame.
