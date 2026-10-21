# Project guidelines: clean code and best practice

These are the rules the codebase already follows, collected from [CLAUDE.md](../CLAUDE.md), [HANDOFF.md](../HANDOFF.md), the binding specs in this folder, and the conventions visible in the code and tests. Where a rule is enforced by a test, the test is named. Rules that are only convention are marked as such. The last section proposes how to enforce more of them automatically.

## 1. Design rules (gameplay)

1. **Nothing happens without a reason, and nothing significant happens without consequences.** Every significant event is a `Fact` with an optional `cause` link to the fact that led to it. The UI can follow that chain ("follow this ›").
2. **Integration means a downstream system reads it.** Changing a state variable is not a feature. Some other system has to read it and behave differently. When you add a field, name the reader in the pull request.
3. **Same rules for the player and the NPCs.** `generate()` produces the options. NPCs pick the best-scoring one and the player picks from a menu. Avoid player-only shortcuts in the simulation.
4. **Knowledge is a mechanic.** A character knows a fact only if it is in their `known` map, through `learn()` or `addFact(…, { witnesses, broadcast })`. Dialogue, jobs and boss behaviour must check knowledge before acting on a fact. For example, a boss only offers a "deal with X" job once he knows who wronged you. Victims may guess wrong (`knowsActor: false`). Checked by the dialogue tests (information-leak checks) and `situations/information.test.ts`.
5. **Don't add systems or change balance unless asked.** Report integration gaps instead of hiding them (CLAUDE.md).
6. **Player-facing text never shows the machinery:** no internal numbers, no database words, no ids, no unfilled placeholders. NPCs speak in their archetype's voice (`voice.ts`/`voicesheet.ts`). Lines are not repeated within a conversation (`Convo.spoken`). Used options grey out and give no further benefit until a new conversation. Enforced by the dialogue tests, including the crawler.

## 2. Engineering rules

### Determinism
- All randomness comes from `w.rng` (`next`, `range`, `int`, `chance`, `pick`). **Never** use `Math.random`, `Date.now`, `new Date()` or `performance.now()` in simulation code. The only allowed uses are at the edges: choosing a new game's seed and shuffling the character creator in `web.ts`, the CLI's default seed, and timing output in `stress.ts`. Enforced by `test.ts` (two runs of seed 7 must serialise identically) and the other `determinism` tests.
- Iteration order is part of determinism. `Object.values(w.chars)` follows insertion order, which is deterministic. Don't introduce `Set` or `Map` iteration over data whose insertion order depends on anything non-deterministic. Sort explicitly when order carries meaning.
- Don't call `w.rng` from UI rendering code. A view that rolls dice changes the world's future just because a screen was opened.

### State
- **The `World` is plain JSON-compatible data.** No classes (apart from `Rng`), no functions, no `Map`/`Set`/`Date`, and no cyclic references. Refer to other entities by `Id`, never by object reference.
- **New fields are optional** and get defaults where they are read or in `ensureShape`/`ensure*`. A field whose meaning changes for old data needs a `SCHEMA` bump and a migration step. Full rules are in [02-state-saves-and-compatibility.md](02-state-saves-and-compatibility.md#6-backwards-compatibility-will-a-new-version-wipe-progress).
- **Every growing collection needs a bound.** Use rings (`hist`, `tlog`, `ended`, `snaps`, `career.log`, `talk`), weekly sweeps (`retain.ts`) or explicit caps. Save size is the scaling limit ([01-stack.md](01-stack.md#where-the-hurdles-will-be-as-the-project-grows)). The `growth` long run in `saves/save-load.test.ts` measures it (`SLOW=1 npx vitest run saves -t growth`).
- Don't keep game state in module-level variables. If you need a cache, key it by the `World` object (`WeakMap<World, …>`) and make sure its answer is a pure function of the current world. A cache whose contents depend on *when* it was first filled (time-keyed, or filled by whichever caller asks first) makes a reloaded game diverge from an uninterrupted one. Exported tuning objects (`AGENCY`, `SIT`) are constants that only tests change.

### Single doors
Some state may only change through one function, so that the record can never disagree with the balance:

| State | The only door | Enforced by |
| --- | --- | --- |
| `Character.rank` | `applyRank` in [rank.ts](../src/rank.ts) (boss powers such as `setRank` in `path.ts` call it; the generator in `world.ts` is exempt) | `architecture.test.ts` "rank has one door" scans every source file for `.rank =` |
| `Business.cash` (typed `readonly`) | `bizMove()` in [econ.ts](../src/econ.ts), which records a `Txn` | The `readonly` type, plus `economyIssues()` in `audit()` |
| The record of money moving inside the player's circle | `post()` in [ledger.ts](../src/ledger.ts). It is a *record*: character `cash` is still changed by the caller, so every cash change in the circle must be paired with a `post()` | `ledgerCheck()` (`economy/ledger.test.ts`) |
| Family treasury | The treasury helpers in [orgs.ts](../src/orgs.ts) (`tin`/`tout` totals prove the balance) | `orgIssues()` in `audit()` |
| History | `addFact()` in [core.ts](../src/core.ts) | Convention |
| Knowledge | `learn()` / `addFact` options in [core.ts](../src/core.ts) | `situations/information` and dialogue leak checks |
| Scheduling | `schedule()` in [core.ts](../src/core.ts) (keeps the queue sorted, assigns `seq`) | Convention |

If you need to change one of these, add a function next to the door. Don't assign the field directly.

### No hardcoded world content
- Don't name family ids (`fam_corrente` …) or assume the number of families in engine code. `architecture.test.ts` scans every source file except `world.ts` for both.

### Modules
- **One system per module**, named after the game concept (`debts`, `disputes`, `rackets`). The public surface is what's `export`ed. Keep helpers unexported.
- **Layering:** UI (`web.ts`, `ui/*`) may import the engine, but the engine must never import the UI or touch `document`/`window`/`localStorage`. This holds today: only `web.ts` imports `ui/*`, and no engine file references the DOM. Persistence logic stays pure over `StoreLike` ([storage.ts](../src/storage.ts)).
- **UI handlers should call engine functions, not mutate the world.** Some handlers in `web.ts` still change world fields directly, for example the Sunday "let him keep half" handler adjusts both men's `cash` and `rel` inline, and `amb:` sets `p.ambition` ([AUDIT.md](AUDIT.md) M2). Move them into engine functions as you touch them.
- **New code should not deepen the import cycle.** See [04-architecture.md](04-architecture.md#keeping-it-from-becoming-a-tangle). Pass data in, or register a hook, instead of importing a heavier module from `core.ts`.

### Code style (convention)
Match the surrounding code. The existing style is deliberate and consistent:

- TypeScript `strict`. Avoid `any`. When widening is unavoidable, use `as unknown as T` with a comment.
- 2-space indentation, single quotes, semicolons, trailing commas in multi-line literals.
- Dense, expression-oriented code is normal here, including long lines and one-line `if`s. Don't reformat files wholesale. A formatter pass over the repo would destroy `git blame` for little gain.
- Short local names (`w` world, `c`/`p` character/player, `b` business, `f` fact or family, `d` debt) and full words for exported functions.
- **Comments explain why, in plain English and in game terms**, often as a sentence about the world ("Grudges cool: half-life of roughly two months unless something new happens."). Use them for intent and invariants, not for restating code.
- British spelling in identifiers, comments and player text (organisation, favour, behaviour).
- Player-facing strings use typographic apostrophes and quotes (`’`, `“ ”`), as the existing text does.

## 3. Tests

- Add checks to the file of the system whose rule they prove (`src/tests/<system>/<topic>.test.ts`), give each one kind (a tag), and put long runs behind `slow`. See [05-testing.md](05-testing.md#where-a-new-test-goes).
- Any change to simulation, economy or saves must keep `audit(w)` and `ledgerCheck(w)` empty after a run. Most suites assert this.
- Gameplay is judged by tracing consequences (action → recorded state → later behaviour), not by green tests. Use `playtest/pt.ts` and the `src/tests/tools/` scripts (`*_measure.ts`, `*_trace.ts`).
- Minimum before shipping: `make test` (typecheck plus the dialogue tests). Anything touching the simulation, saves or economy needs `make test-all`. Schema changes also need a new fixture (`make test-all` already runs the synthetic migrations).

## 4. Pull request checklist

- [ ] `make test` passes. `make test-all` passes if the simulation, saves or economy changed.
- [ ] No `Math.random`/`Date` in engine code. No DOM in engine code.
- [ ] New `World` fields are optional with defaults. `SCHEMA` is bumped with a migration if old data changes meaning. A fixture from the previous build has been added.
- [ ] Every new growing collection has a bound.
- [ ] Every new state variable has a named downstream reader.
- [ ] Player-facing text has no numbers, ids or database words.
- [ ] Portrait code and output are unchanged ([ui/portrait.ts](../src/ui/portrait.ts)).
- [ ] `dist/omerta.html` and `index.html` are rebuilt if deploying (until CI builds them).

## 5. Enforcing more of this automatically (recommendations)

None of these is configured yet. They are listed in order of value for effort:

1. **CI on every push and pull request** ([05-testing.md](05-testing.md#is-there-a-github-actions-test-runner)). It turns every rule above that already has a test into a gate.
2. **A determinism and DOM lint as a test.** Like the existing "rank has one door" scan, fail if any `src/*.ts` other than `web.ts`/`cli.ts`/`stress.ts` contains `Math.random`, `Date.now`, `new Date(` (except `core.ts`'s `fmtTime`), `document.` or `localStorage`. This is 15 lines in a test, with no new dependencies.
3. **A forward-compatibility guard** in `deserialize` (refuse or warn when `schema > SCHEMA`).
4. **Dependency rules.** Use `dependency-cruiser` (a dev dependency) or ESLint `import/no-cycle` with an allow-list of today's cycle members. That freezes the cycle at its current size and stops new modules joining it.
5. **ESLint with a minimal ruleset**: `@typescript-eslint/no-floating-promises`, `no-restricted-globals` for `Math.random`, and `eqeqeq`. Run it only on changed files at first, because a repository-wide pass would be noisy.
6. **Include `playtest/` in `tsconfig.json`**, so the harness is typechecked.
