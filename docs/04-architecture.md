# Architecture: how the systems fit together

This is the map of the game engine: its layers, how systems talk to each other, the actual dependency structure (measured, not aspirational), what keeps it from becoming a tangle, and whether a system can be swapped for a new implementation. Each system's own public API is documented under [engine/](engine/README.md).

## Layers

```
┌───────────────────────────── Entry points ──────────────────────────────┐
│ web.ts (browser)   cli.ts (sim/play)   bot.ts   stress.ts   playtest/pt.ts   tests │
└──────────────┬───────────────────────────────────────────────┬──────────┘
               │ imports ui/* (web.ts only)                     │
┌──────────────▼──────────────┐                                 │
│ Presentation: src/ui/*       │  HTML-string views, S (UI state),│
│ (no simulation logic*)       │  portrait painter                │
└──────────────┬──────────────┘                                 │
               │ calls exported engine functions, reads World    │
┌──────────────▼─────────────────────────────────────────────────▼──────────┐
│ Engine: src/*.ts (≈21k lines, no DOM, no framework, deterministic)         │
│   engine.ts   advance() – the clock and the tick order                     │
│   systems     core · econ · books · ledger · actions · goals · situ · jobs │
│               encounters · dialogue · orgs · rank · career · path · …      │
│   persistence serialize/deserialize (engine.ts) · storage.ts (pure)        │
└──────────────┬────────────────────────────────────────────────────────────┘
               │ every function: fn(w: World, …) mutates in place
┌──────────────▼────────────────────────────────────────────────────────────┐
│ World: one plain JSON-serialisable object (types.ts) + Rng state           │
└───────────────────────────────────────────────────────────────────────────┘
```

\* There are a few exceptions, where `web.ts` handlers mutate world fields directly. See [07-guidelines.md](07-guidelines.md#modules).

What holds today, verified by searching the source:

- **The engine never imports the UI** and never touches `document`, `window` or `localStorage`. Only `web.ts` imports `ui/*`.
- **Game state is in the `World`.** The exceptions are a handful of module-level caches and counters (listed in [01-stack.md](01-stack.md#how-global-state-is-stored)) and the tuning switches used by tests. Some of those caches are time-keyed, which can make a reloaded save diverge from an uninterrupted run (see below).
- **The engine draws no outside randomness.** `Math.random` and `Date` appear only in entry points (choosing a seed, the character creator, timing output). Determinism holds within one uninterrupted process. It does **not** survive a reload, because of time-keyed caches and render-time world changes ([02-state-saves-and-compatibility.md](02-state-saves-and-compatibility.md#gaps)).

## How the engine is driven

There are exactly three ways in:

1. **Time passes.** `advance(w, until)` pops events from `w.queue` (sorted by time, then `seq`) until `until`:
   - `think` (one per NPC, rescheduled after each action): the NPC picks and performs an action ([engine/03-npc-autonomy.md](engine/03-npc-autonomy.md#how-an-npc-decides)).
   - `daily`: 19 calls in a fixed order (jobs, situations, summons, memos, pending consequences, encounters, life events, danger, rackets, promotions, path, coups, the Commission, private life, christenings, ambitions, reconcile, dispute scan, dispute tick).
   - `weekly`: the economy (businesses, debts, wages, kick-ups via `settleWeek`), careers, NPC goals, organisations, ranks, reports, situations, gossip, the retention sweep and hierarchy repair.

   The **authoritative step-by-step order** is in [engine/01-core-simulation.md](engine/01-core-simulation.md#the-tick-step-by-step). The order matters. For example, `settleWeek` reads the week's gross after `businessWeek` and `hustleWeek` have written it.
2. **The player acts.** A UI handler calls an engine function directly (`say`, `takeJob`, `resolve`, `giveOrder`, `openSitdown`, …). Most of those return the in-game minutes the action cost. The UI's `pass(minutes)` then calls `advance` so the rest of the world catches up, and saves. Time never advances on its own. There is no offline progression.
3. **A save is loaded.** `deserialize` runs `ensureShape`, the migrations and the defaults ([02-state-saves-and-compatibility.md](02-state-saves-and-compatibility.md)).

## How systems talk to each other

The engine uses five coupling mechanisms. From loosest to tightest:

| Mechanism | How it works | Examples |
| --- | --- | --- |
| **Facts and knowledge** (the event bus) | A system records an event with `addFact(w, {kind, actor, victim, …}, {witnesses, broadcast})`. Witnesses get it in `known` immediately. Gossip spreads it later, and only to people who could plausibly hear. Other systems react by scanning what a character *knows*, never the global fact list | A beating becomes a fact. The victim's boss learns of it, then a boss job to deal with the attacker appears. Revenge and retaliation read the facts a victim knows, including wrong guesses |
| **Delayed consequences** (`w.pending`) | A system schedules `{kind, due, a, b, fact}`. `pendingTick` fires it later | A killing leads to heat, blackmail or a revealed truth weeks afterwards |
| **Shared records** | Long-lived matters are records that several systems read and advance: `situations`, `disputes`, `debts`, `favours`, `threats`, `jobs`, `enc`, `agency.goals`, `memos` | A situation is created by `situ.ts`, advanced by NPC moves (`sitmoves.ts`), put to the player as an encounter, and settled at a sit-down (`meetings.ts`) |
| **Shared fields** | One system writes a field that another reads: `rels` (trust, respect, affection, grudge), `standing`, `heat`, `books`, `protection`, `cooldown` | `books.ts` flags a short kick-up. `career.ts` reads standing and the books when choosing who to promote |
| **Direct calls** | A static import plus a function call | `jobs.ts` → `econ.bizMove` to pay out. `core.ts` → `rank.repairHierarchy` when someone dies |

The engine has no event emitter, plug-in registry or dependency injection. Orchestration lives in one place: the tick lists in `engine.ts`.

## Dependency structure

Measured by parsing every non-type `import` in `src/` and `src/ui/` (type-only imports excluded, since they vanish at build time).

**Fan-in** (how many modules import it), the main hubs:

| Module | Imported by | Imports | Exported names used elsewhere |
| --- | --- | --- | --- |
| `core` | 60 | 6 | 28 |
| `types` | 57 | 0 | 54 (types only) |
| `encounters` | 25 | 13 | 10 |
| `econ` | 21 | 3 | 23 |
| `jobs` | 21 | 9 | 41 |
| `voice` | 20 | 0 | 12 |
| `career` | 17 | 10 | 26 |
| `actions` | 14 | 9 | 8 |
| `people` | 14 | 3 | 11 |
| `books` | 13 | 8 | 23 |
| `rank` | 13 | 2 | 9 |
| `orgs` | 12 | 4 | 24 |
| `engine` | 5 | 36 | 6 |
| `web` | 0 | 43 | — |

**Cycles.** Tarjan's algorithm over the import graph finds:

- **One strongly connected component of 30 engine modules:** actions, ambition, books, career, clubdata, consequences, core, crewlife, danger, disputes, econ, encounters, gigs, goals, jobs, life, orders, orgs, path, people, politics, powers2, pulse, rank, reports, situ, situations, specs, violence, world. Each of these can reach every other through imports.
- Two small UI cycles: `ui/views_a ↔ ui/views_b` and `ui/stories ↔ ui/views_c`.

**Why the big cycle exists.** `core.ts` is the base module (facts, knowledge, relationships, scheduling, money helpers), but it imports upward:

```ts
// core.ts
import { post } from './ledger';
import { bizMove, succeedOwner } from './econ';        // econ imports core
import { applyRank, repairHierarchy } from './rank';   // rank imports core
import { succeed } from './orgs';                      // orgs imports core
import { goalsOnDeath } from './goals';                // goals imports core, situ, …
```

These are almost all used by **death and succession** (`handleDeath()`: owner succession, family succession, hierarchy repair, dropping a dead man's goals) and by the debt helpers (`createDebt`/`payDebt` post to the ledger and move business cash). Because `core` reaches `goals`, and `goals` reaches most of the simulation, every module that imports `core` (60 of them) sits inside the cycle. `encounters` (13 imports) and `career` (10) widen it further.

ES modules tolerate cycles as long as no module uses an import during its own initialisation, which holds here. All cross-module use happens inside functions. The cost is architectural, not a runtime bug: no system in the component can be loaded, tested or replaced without loading the other 29.

**Leaves.** These are cleanly separable today: `rng`, `types`, `voice` (imports nothing), `voicesheet`, `ledger` (imports only types), `storage` (imports nothing), `negotiate`, `memory`, `where`, `news`, `blackjack`, `retain`, `consistency`.

## How are we guaranteeing these systems won't become a tangled mess?

Honestly: **partly**. Some guard-rails are enforced by tests, some only by convention, and the import graph is not guarded at all.

**Enforced by tests today:**

| Guard-rail | Test |
| --- | --- |
| One door for rank changes (`applyRank`) | [architecture.test.ts](../src/tests/architecture.test.ts): source scan for `.rank =` |
| One door for business cash (`bizMove`, `readonly cash`) | Type system plus `economyIssues` in `audit()` |
| The ledger agrees with balances | `ledgerCheck()`, [economy/ledger.test.ts](../src/tests/economy/ledger.test.ts) |
| No hardcoded family ids or family count | [architecture.test.ts](../src/tests/architecture.test.ts): source scan |
| Cross-record consistency (hierarchy, organisations, agency, situations, economy) | `audit()` asserted empty after simulations in most suites |
| Determinism, and saves continuing identically | [determinism.test.ts](../src/tests/determinism.test.ts) and every test tagged `determinism` (`npx vitest run --tagsFilter determinism`) |
| Information restrictions (no leaks) | [situations/information.test.ts](../src/tests/situations/information.test.ts), the [dialogue tests](../src/tests/dialogue) |
| Old saves load | [saves/oldsave.test.ts](../src/tests/saves/oldsave.test.ts) and every test tagged `compat` |

**Convention only:** engine/UI layering and no DOM in the engine; no `Math.random`; `addFact`/`learn` as the only way to create or spread knowledge; bounded collections; UI handlers calling engine functions instead of mutating.

**Not guarded:** import cycles and module size; generic scratch bags (`Situation.m`, `Job.extra`, `cooldown`, `goals.done`) that let systems share undeclared state; UI handlers that mutate the world.

### Keeping it from becoming a tangle

These are recommendations in order of payoff. None is implemented yet.

1. **Freeze the cycle.** Add a dependency rule check that fails CI if a module **not** in today's 30-member list joins the cycle, or if any engine module imports `ui/*`, `web` or `storage`. Use `dependency-cruiser` (one dev dependency plus a config file) or a 40-line test like the existing source scans.
2. **Break the core hub with dependency inversion.** Move death and succession (`handleDeath`) and the debt helpers out of `core.ts` into a `death.ts` that sits above `econ`, `rank`, `orgs` and `goals`. Alternatively, give `core` a tiny hook registry (`onDeath(handler)`) that those modules register into at start-up. Either way, `core` stops importing upward. On its own, that change shrinks the cycle dramatically, because `core`'s 60 importers no longer reach `goals` through it.
3. **Split the giant modules by responsibility**, without changing behaviour: `dialogue.ts` (2,358 lines: menus, nodes, memos, recall), `jobs.ts` (offers, approaches, resolution, schemes, ventures) and `encounters.ts` (scene kinds). Keep the public names re-exported from the original module so callers don't change.
4. **A determinism and DOM lint test** (see [07-guidelines.md](07-guidelines.md#5-enforcing-more-of-this-automatically-recommendations)).
5. **Declare scratch data.** Give the kind-specific contents of `Situation.m` and `Job.extra` types per kind, so cross-system reads show up in the type checker.
6. **A query layer for the UI.** Views currently walk the `World` freely. A small set of selector functions (`crewOf`, `whereIs` and `statement` already exist) would let engine internals change without touching views, and is a prerequisite for a Vue port ([08-framework-migration.md](08-framework-migration.md)).

## Is it possible to swap out a main system for a new version that keeps its public API?

**Yes for leaves and well-fenced systems. Hard for anything in the 30-module cycle, until the cycle is reduced.** There are no formal interfaces. A system's "public API" is the set of exported functions other modules actually import (the right-hand column above, and each [engine/](engine/README.md) document's "Replacing this system" section).

What a replacement must preserve:

1. **The imported surface:** every exported name other modules use, with the same signature and meaning. Find it with `grep -rn "from './<module>'" src playtest`.
2. **The `World` fields the system owns,** or a migration, because those fields are in players' saves. Others read some of them directly (for example, views read `b.protection`, and `career.ts` reads `c.books`).
3. **Tick participation:** the functions `engine.ts` calls daily or weekly, in the same slot of the order.
4. **The invariants `audit()` checks** (and `ledgerCheck` for money).
5. **Determinism:** draw randomness only from `w.rng`. A replacement that draws a different number of random values changes every world's future history. That is allowed, because the determinism tests compare two runs of the same build. But it changes every long-run measurement, so re-baseline the `*_measure` scripts.

How easy each system is to swap today:

| Ease | Systems | Why |
| --- | --- | --- |
| Easy | `storage` (for example to IndexedDB, behind the existing `StoreLike`), `rng`, `voice`/`voicesheet` (text banks), `ledger`, `negotiate`, `blackjack`, `retain`, `news`, `memory` | Leaves with a small used surface, no cycle membership, or pure functions |
| Moderate | `consistency`, `reports`, `specs`, `hustle`, `pulse`, `revenge`, `violence`, `flows` | 2–4 used exports, but in or next to the cycle |
| Hard | `core`, `econ`, `jobs`, `encounters`, `career`, `orgs`, `books`, `situ`, `dialogue` | 15–41 used exports, many importers, shared fields read directly elsewhere, and in the cycle |

**Recommended method for swapping a hard system:**

1. Write down its contract: the exports in use, the World fields, the ticks and the invariants. The engine/ documents are the starting point.
2. Put a façade module in front of it (for example `economy.ts` re-exporting `bizMove`, `businessWeek`, …). Point every importer at the façade. This changes no behaviour.
3. Characterise the current behaviour: run `tools/econ_measure.ts` / `tools/agency_measure.ts` / `tools/sit_measure.ts` for several seeds and keep the output as a baseline.
4. Build the new implementation behind the façade, with a switch (as `AGENCY.on` and `SIT.on` already do for goals and situations).
5. Run `test:all`, `audit()` and the measurements under both implementations. Compare them, then flip the switch, then delete the old one.
6. If the World fields change, bump `SCHEMA`, migrate, and add a fixture from the old build.
