# Testing

## What testing framework is used?

**[Vitest](https://vitest.dev) 5**, configured in [vitest.config.ts](../vitest.config.ts). The assertions are still Node's built-in `node:assert`. Vitest treats any thrown error as a failure, so the checks didn't need rewriting. Each suite imports Vitest's `test` under the name the suites have always used:

```ts
import { describe, test as ok } from 'vitest';

function fast() {
  ok('every temperament has lines wherever a bank is written per temperament', () => { … });
  …
}
describe('v77 fast', fast);
```

Every file matching `src/tests/**/*.test.ts` is found by name. Nothing lists the suites, so a new `src/tests/vNN.test.ts` runs in `npm test`, `make test-all` and CI as soon as it exists. (The lists that used to be kept by hand in `package.json`, the Makefile and the CI matrix had drifted: `v86`, `v87` and the V88 `portrait` suite ran nowhere until the move to Vitest.)

How a run behaves:

- **Files run in parallel**, one worker process each. The checks inside a file run in order and share the file's module state, such as a cached base world.
- **Each file has its own module instances.** A tuning switch flipped in one file can't leak into another. Within a file, a check that flips one must restore it: v74 resets `AGENCY.audit` in `afterEach`.
- **Timeouts are generous** (20 minutes per check or hook). Several checks simulate a year of play, and a CI runner is two to three times slower than a recent laptop.
- **Failures are reported per check**, with the assertion's message and diff. A failing check doesn't stop the others in its file, and the run exits non-zero.

### The fast set and the opt-in modes

The suites used to take a mode argument (`process.argv[2]`). Those modes are now environment switches, read in [src/tests/modes.ts](../src/tests/modes.ts):

| Switch | Adds | Run it with |
| --- | --- | --- |
| *(none)* | The fast set: every suite's quick checks | `npm test` |
| `COMPAT=1` | The synthetic schema-migration checks (`v73`/`v74`/`v75`, schemas 3–5). About 20 s in all | `npm run test:all` (fast set + compat), `npm run test:compat` (compat only) |
| `SLOW=1` | Also the long simulations: `v72` stable/roundtrip/growth, `v73` stable/roundtrip, `v74`/`v75` sim and roundtrip, `v76` sim and the trace of the player's road to boss, and eight seeds instead of four in `v87`. Implies `COMPAT` | `npm run test:slow`, `make test-slow` |
| `SEED=3[,7,…]` | The seeds the long simulations use (default 3). A list runs each seed as its own check (`test.each`) | `make test-sim SEED=3,7` |
| `DAYS=180` | How many days a `sim` lasts (default 180) | `make test-sim SEED=3 DAYS=365` |

| Suite | What it covers | Checks (fast + compat) | Opt-in (`SLOW=1`) | Time* |
| --- | --- | --- | --- | --- |
| [storage.test.ts](../src/tests/storage.test.ts) | `writeSave` against a fake quota-limited store: snapshot budget, shedding oldest first, a corrupted write rolled back, a full or blocked store reported | 5 | — | <1 s |
| [v72.test.ts](../src/tests/v72.test.ts) | Hierarchy and succession repair, promotions applied once, **"rank has one door"** source scan, rackets catalogue, ambitions tick once, fact retention, schema-2 bloated save shrinks, mid-scene save/load | 20 | stable, roundtrip, growth | 15 s |
| [v73.test.ts](../src/tests/v73.test.ts) | Economic foundation: business accounts, `bizMove` as the only door, ledger, stakes, protection arrears, `ledgerCheck`/`audit` stay empty | 34 + 1 | stable, roundtrip | 33 s |
| [v74.test.ts](../src/tests/v74.test.ts) | NPC goals (`w.agency`): formation, stages, funding, endings, asking the player, round trip | 28 + 1 | sim, roundtrip | 60 s |
| [v75.test.ts](../src/tests/v75.test.ts) | Situations: persistence, stages, NPC-only resolution, player choices, sit-downs, **no information leaks**, claims and lies, no duplicates | 31 + 1 | sim, roundtrip | **197 s** |
| [v76.test.ts](../src/tests/v76.test.ts) | Dynamic organisations: N families, splinter groups, treasuries, the **no hardcoded family ids / count** source scan, the player's climb to boss, determinism | 16 | sim, trace | 48 s |
| [v77.test.ts](../src/tests/v77.test.ts) | Voices and memory: every archetype has lines, no shared lines, no machinery words or unfilled placeholders, recall | 17 | — | 7 s |
| [v78.test.ts](../src/tests/v78.test.ts) | Conversation layers: root menu reach, knowledge-gated topics, used-option greying, rank authority | 21 | — | 12 s |
| [v79.test.ts](../src/tests/v79.test.ts) | **Conversation crawler**: random walks through every menu for many characters at many trust levels. Checks for no crashes, no dead ends, nothing rewarded twice, nothing that talks like a database (`DUMP=file` writes the problems found) | 6 | — | 7 s |
| [v86.test.ts](../src/tests/v86.test.ts) | The opening: name lists, generated and typed names, backgrounds on old records, name/look/background survive a save | 7 | — | <1 s |
| [v87.test.ts](../src/tests/v87.test.ts) | Backgrounds and starting lives: each package is real state in the ordinary systems, applied once, and the world runs on from it for 35 days | 8 | eight seeds instead of four | 21 s |
| [portrait.test.ts](../src/tests/portrait.test.ts) | Portraits (V88): deterministic, well-formed SVG for every rank × gender × option, old looks still render, the face survives a promotion, the creator's options, size and speed. Each numbered section is one check that evaluates all its conditions (2,097 in all) and lists every one that failed | 7 | — | <1 s |
| [oldsave.test.ts](../src/tests/oldsave.test.ts) | Every `fixtures/*.save` loads, plays 3 days and round-trips byte-identically | 2 (one per fixture) | — | 1 s |
| [determinism.test.ts](../src/tests/determinism.test.ts) | **Determinism** (seed 7, 120 days, built twice in separate processes, gives identical serialisation), save/load continuation, 8 seeds × 180 days with no NaN cash | 10 | — | 20 s† |

\* Wall-clock per file during `npm run test:all` on an 18-core Apple-silicon Mac with Node 25, with all files running at once. A file runs a little faster on its own.
† Measured on its own. The ten worlds are independent, so [determinism.job.ts](../src/tests/determinism.job.ts) builds each one in a child process of its own and they share the machine's cores (about 190 s of CPU in 20 s). Built one after another, they would take about three minutes and be the slowest file but one.

`npm run test:all` takes **3 min 18 s** (208 checks). Before the move to Vitest, the same checks without compat, v86 and v87 took 5 min 29 s on the same machine, run one suite after another. v75 is now the whole critical path. It's one file of serial checks, several of which simulate 200–400 days, so splitting it into two files would be the next speed-up.

### Not tests: measurement and trace scripts

These live beside the tests but assert nothing. They print numbers or narratives for a human to judge, and they still run with `tsx`:

| Script | Prints |
| --- | --- |
| `econ_measure.ts <seed> [days]` | What the money did over N days |
| `agency_measure.ts <seed> [days] [off]` | What NPCs achieved unattended, optionally with goals switched off for comparison |
| `sit_measure.ts`, `sit_freq.ts`, `sit_trace.ts` | Situation frequency, and situations followed from cause to consequence |
| `v76_smoke.ts`, `v76_trace_probe.ts` | Organisation smoke runs with `audit()` |
| [src/stress.ts](../src/stress.ts), [src/bot.ts](../src/bot.ts) | Long random-policy player runs |
| [playtest/pt.ts](../playtest/pt.ts) | The interactive command-line harness used for the V85 playtest. **It hardcodes `/home/claude/omerta/playtest`**, so it fails on any other machine until that path is fixed |

## Kinds of checks in use

- **Invariant audits.** `audit(w)` ([consistency.ts](../src/consistency.ts)) aggregates `economyIssues`, `agencyIssues`, `sitIssues`, `hierarchyIssues` and `orgIssues`. `ledgerCheck(w)` checks the ledger. Suites assert both are empty after simulating. This is the strongest safety net in the codebase.
- **Determinism and round trip.** The same seed must give a byte-identical `serialize()`, and `deserialize(serialize(w))` must continue identically. These stay `assert.equal` on serialised strings. Don't use Vitest snapshots for worlds that are megabytes in size.
- **Real old saves.** These are genuine saves from older builds ([02-state-saves-and-compatibility.md](02-state-saves-and-compatibility.md)).
- **Source-scanning "architecture tests".** Rank is only assigned in `rank.ts`/`world.ts`. Business cash only changes in `econ.ts`. No file names a family id or assumes five families. The scans find `src/` from `import.meta.url`, so they work from any working directory.
- **Content checks.** Voice banks have per-archetype coverage, with no duplicates and no leaked internals.
- **Crawlers.** Random walks over the dialogue tree.
- **Scenario tests.** Build a world, set up a situation, act, then assert the consequence (for example, a boss dies and the underboss takes over).

## Are there coverage targets?

**Yes.** `npm run test:cov` (or `make test-cov`) runs `test:all` with [`@vitest/coverage-v8`](https://vitest.dev/guide/coverage) over `src/**/*.ts`, excluding the tests and the entry points that have no tests of their own (`web.ts`, `ui/`, `cli.ts`, `bot.ts`, `stress.ts`). It prints a summary and writes an HTML report to `coverage/`. The run fails if coverage drops below the thresholds in [vitest.config.ts](../vitest.config.ts), which were set just below the measured figures so they can only rise:

| Metric | Measured (Oct 2026) | Threshold |
| --- | --- | --- |
| Lines | 59.05% | 58 |
| Statements | 55.95% | 55 |
| Branches | 53.96% | 53 |
| Functions | 62.57% | 62 |

The long-term target is 80% of lines. The most uncovered lines are in `dialogue.ts` (63% covered, 620 lines not reached), `jobs.ts` (28%), `meetings.ts` (24%), `encounters.ts` (33%), `powers2.ts` (39%), `orders.ts` (24%) and `life.ts` (21%). `revenge.ts` (140 lines) is never reached at all by the fast set. When coverage rises, raise the thresholds to match.

Coverage costs about a quarter more run time (v75: 197 s → 244 s), which is why plain `test:all` runs without it. The determinism suite's worlds are built in child processes, which coverage doesn't see. Everything they run is also exercised in-process by other suites.

The suites are written per version (V72–V88) around the features of that version, so coverage follows recent work. Code that predates V72 (`actions.ts`, `jobs.ts`, `encounters.ts`, `meetings.ts`, much of `dialogue.ts`) is exercised by the long simulations and the crawler, but rarely asserted directly. The HTML report shows which lines are never reached. Apart from the portrait suite, which renders `ui/portrait.ts` directly, the UI layer (`web.ts`, `ui/*`, about 4,000 lines) has **no tests**. A Playwright smoke test of the core loop (new game, talk, wait, save, reload, continue) is the recommended next step ([08-framework-migration.md](08-framework-migration.md#5-suggested-order-and-checkpoints)).

## Is there a GitHub Actions test runner?

**Yes:** [.github/workflows/ci.yml](../.github/workflows/ci.yml). It runs on every push to `main`, on every pull request, and on manual dispatch.

- **Free tier compatible.** The repository is public, and GitHub-hosted runners are free for public repositories. The workflow uses only `ubuntu-latest` and first-party actions (`checkout`, `setup-node` with the npm cache, `upload-artifact`, `download-artifact`). If the repository ever goes private, the free plan includes 2,000 minutes a month.
- **Job `build`** runs `make all` (install, typecheck, build) and uploads `dist/omerta.html` as a downloadable artifact. It warns, without failing, if the committed `dist/omerta.html` or `index.html` no longer match a fresh build (the build is deterministic, so any difference means a stale commit).
- **Job `suite`** runs the suites with `COMPAT=1` and coverage, in three parallel jobs with `fail-fast: false`: v75 alone, v74 alone, and every other suite. The third job uses `--exclude`, not a list, so a new suite lands there by itself. v75 takes about 7.5 minutes on a runner, so it sets the wall-clock time. Each job uploads a Vitest blob report, which includes its coverage.
- **Job `report`** ("All suites and coverage") merges the three blob reports (`vitest run --merge-reports --coverage`). It prints every check's result in one place, adds GitHub annotations for failures, and checks the coverage thresholds on the merged coverage. The parts can't check thresholds themselves, because each one covers only part of the code.
- To make it a gate, go to **Settings → Branches → Branch protection** for `main` and require the `Typecheck and build` and `All suites and coverage` checks.

To run what CI checks locally:

```bash
make ci
```

## Running tests

| Goal | Command |
| --- | --- |
| Minimum pre-ship check (CLAUDE.md) | `make test` (typecheck plus v77, v78, v79) |
| Everything CI runs | `make test-all` or `npm run test:all` (fast set plus schema migrations) |
| The fast set only | `npm test` |
| One suite, or several | `npx vitest run v73` (file name filter), `npm test -- v77 v78` |
| One check by name | `npx vitest run v73 -t "ledger"` (a regular expression over "describe + check" names) |
| Re-run on every change | `npm run test:watch` (then `p` to filter by file, `t` by name) |
| Schema migrations only | `make test-compat` or `npm run test:compat` |
| Long simulations for some seeds | `make test-sim SEED=3 DAYS=180` (v74, v75 and v76 `sim`) |
| Every long run (stable, sim, roundtrip, growth, trace) | `make test-slow SEED=3` or `SLOW=1 npx vitest run` |
| Save growth | `SLOW=1 SEED=3 npx vitest run v72 -t growth` |
| Coverage | `make test-cov` or `npm run test:cov`, then open `coverage/index.html` |
| Hide what the checks print | add `--silent` (or `--silent=passed-only` to keep the output of failing checks) |

## Writing a test

1. Pick the suite for the area you're changing, or create `src/tests/vNN.test.ts`. A new file is picked up automatically. Import `describe` and `test as ok` from `vitest`. Use `node:assert` (`assert.equal`, `assert.deepEqual`, `assert.ok`) for the checks.
2. Build worlds deterministically, for example `createWorld(3, 'Tony Marino')` then `advance(w, w.now + N * DAY)`. Cache an expensive base world as a serialised string, and `deserialize` a fresh copy per check, as `v77` does in `fresh()`. Building it at module scope or in `beforeAll` is fine. Each file pays for its own.
3. Assert behaviour through the state downstream systems read, not the field you just wrote. That is the "integration" rule in [07-guidelines.md](07-guidelines.md).
4. End scenario tests with `assert.deepEqual(audit(w), [])`, and also `ledgerCheck(w)` if money moved.
5. Keep the fast checks under about a minute per suite. Put long runs behind `describe.skipIf(!SLOW)` and parameterise them by `SEEDS`/`DAYS` from [modes.ts](../src/tests/modes.ts) with `ok.each(SEEDS)(…)`. Put synthetic migrations behind `describe.skipIf(!COMPAT)`.
6. If a check flips an exported tuning switch (`AGENCY`, `SIT`), restore it in `afterEach`.

## Gaps

- Apart from the portrait suite, nothing tests the UI.
- `playtest/` is not typechecked, and its harness has a hardcoded path.
- There are only two real old-save fixtures (schema 2 and schema 7).
- v75 is a single file of slow serial checks and sets the wall-clock time of every run, locally and in CI.
- Coverage doesn't see the worlds the determinism suite builds in child processes.
