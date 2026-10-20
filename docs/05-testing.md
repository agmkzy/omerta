# Testing

## What testing framework is used?

**[Vitest](https://vitest.dev) 5**, configured in [vitest.config.ts](../vitest.config.ts). The assertions are Node's built-in `node:assert`. Vitest treats any thrown error as a failure. Each file imports Vitest's `test` under the name the suites have always used:

```ts
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { newWorld } from '../helpers';

describe('protection money', () => {
  ok('a shake takes from the till then the owner\'s pocket, once, and clears what was owed', { tags: ['unit'] }, () => {
    const w = newWorld(7);
    …
    assert.equal(owedOf(b), 0);
  });
});
```

Every file matching `src/tests/**/*.test.ts` is found by name. Nothing lists the files, so a new one runs in `npm test`, `make test-all` and CI as soon as it exists.

How a run behaves:

- **Files run in parallel**, one worker process each. The checks inside a file run in order and share the file's module state, such as a cached base world.
- **Each file has its own module instances.** A tuning switch flipped in one file can't leak into another. Within a file, a check that flips one must restore it: `agency/goals.test.ts` resets `AGENCY.audit` in `afterEach`.
- **Failures are reported per check**, with the assertion's message and diff. A failing check doesn't stop the others in its file, and the run exits non-zero.

## Where the tests are: by game system

Tests are grouped by the system whose rules they prove, not by the release that added them. A check that follows a chain across modules (a beating, then the boss learns of it, then a boss job) lives with the system it proves. Each folder's `fixtures.ts` holds its world builders and helpers; [helpers.ts](../src/tests/helpers.ts) holds the shared ones.

| Folder / file | What it proves | Files | Checks |
| --- | --- | --- | --- |
| [architecture.test.ts](../src/tests/architecture.test.ts) | Source scans: rank is only assigned in `rank.ts`/`world.ts`, business cash only changes in `econ.ts`, no file names a family id or assumes five families | 1 | 3 |
| [saves/](../src/tests/saves) | `writeSave` and its snapshot budget (`storage`), genuine old saves load and round-trip (`oldsave`), fact retention, a bloated schema-2 save shrinks, a scene resumes mid-way (`save-load`) | 3 | 12 |
| [hierarchy/](../src/tests/hierarchy) | Who takes the chair (`succession`: deaths, heirs, scoring, a boss inside, coups) and rank changes applied once (`promotion`) | 2 | 19 |
| [economy/](../src/tests/economy) | The record and the ledger (`ledger`), protection money, tribute and rate talks, ownership, trade, debts that become shares, the rackets catalogue | 7 | 37 |
| [agency/](../src/tests/agency) | NPC goals (`goals`), buying businesses, careers (recruiting, backing, terms), debtors' plans and asking the player (`debts`), ambitions | 5 | 33 |
| [situations/](../src/tests/situations) | Situation lifecycle, sit-downs and the player's moves, who knows what (no leaks, claims and lies, word of mouth), bounded growth, pacing, legacy situations | 6 | 34 |
| [organisations/](../src/tests/organisations) | Each family's record, membership, treasury, relations, clubs and splinter groups (`structure`), and the player's road to boss (`player-boss`) | 2 | 12 |
| [dialogue/](../src/tests/dialogue) | Voices, memory, menus, what people tell you, and the conversation crawler | 5 | 44 |
| [creation/](../src/tests/creation) | Names, backgrounds and starting lives, portraits | 3 | 22 |
| [determinism.test.ts](../src/tests/determinism.test.ts) | Same seed, same history (built in separate processes), save/load continuation, 8 seeds × 180 days with no NaN cash | 1 | 10 |

The tests used to be one file per release (`v72.test.ts` … `v87.test.ts`). The file headers still say which release suite each test came from. The two V76 snapshots the menu checks compare against are [dialogue/baselines/](../src/tests/dialogue/baselines) (`v76-option-codes.json`, `v76-root-reach.json`).

### Where a new test goes

1. Find the system whose rule it proves and add it to the file for that topic, for example a new protection-money rule in `economy/protection.test.ts`. Start a new file in the folder for a new topic (`economy/loans.test.ts`). A new system gets a new folder.
2. Keep tests that share an expensive fixture in the same file. Each file builds its own worlds, so spreading tests that use the 60-day world across many files multiplies its cost.
3. Never put tests next to the code in `src/*.ts`. The architecture scans read every top-level `src/*.ts` file, and test code legitimately does what they forbid.

## What kind of test: tags

Every test carries exactly one kind, as a Vitest tag declared in [tags.ts](../src/tests/tags.ts). The tag names are typed, so a misspelt tag doesn't compile, and [setup.ts](../src/tests/setup.ts) fails a file if any of its tests, skipped ones included, lacks exactly one kind. Tag a whole `describe` when every test in it is the same kind, otherwise tag each test.

| Kind | What drives it | Example | Limit | Checks |
| --- | --- | --- | --- | --- |
| `unit` | A direct call to one function or module. A world may be its fixture, but the clock never moves | `takeFromBiz` takes from the till, then the owner's pocket | 10 s | 85 |
| `scenario` | A staged chain across systems: set up a situation, act, check the consequence | A sit-down gives every participant a consistent result, and the loser remembers | 5 min | 84 |
| `sim` | Many simulated days, then invariants: the audit, the ledger, bounded growth, rates | 400 days of situations stay within their bounds | — | 10 |
| `determinism` | The same seed, or a save and a load, gives identical output | A save made mid-plan continues identically | — | 23 |
| `compat` | Saves from older builds, real or synthetic, load and play on | A V73 save (schema 4) loads, and NPCs start forming goals | — | 9 |
| `architecture` | Source scans | Rank has one door | — | 3 |
| `property` | Random walks checked against rules | The conversation crawler | — | 1 |

The limit is a timeout that catches a misfiled test: a "unit" test that quietly simulates a month. Kinds are for choosing what to run. `npm run test:unit` runs the 85 unit tests in about 6 seconds, which suits watch mode (`npx vitest --tagsFilter unit`). Filters combine: `--tagsFilter 'scenario && !slow'`.

### Opt-in long runs

A test tagged `slow` as well as its kind is skipped unless `SLOW=1`. These are the 180-day stability runs, long simulations, long round trips, save growth, the trace of the player's road to boss, and v87's full seed set. They take their parameters from [modes.ts](../src/tests/modes.ts):

| Variable | Meaning | Example |
| --- | --- | --- |
| `SLOW=1` | Run the `slow` tests too | `npm run test:slow`, `make test-slow` |
| `SEED=3[,7,…]` | The seeds the long runs use (default 3). A list runs each seed as its own check | `make test-sim SEED=3,7` |
| `DAYS=180` | How many days a `sim` lasts (default 180) | `make test-sim SEED=3 DAYS=365` |

## How long it takes, and why

`npm test` takes about **47 seconds** on an 18-core Apple-silicon Mac (6 performance and 12 efficiency cores) with Node 25. When the tests were one file per release it took 192 seconds, because the v75 file alone ran for over three minutes. Splitting the files by system brought it to 72 s, and two fixes in the simulation brought it to 47 s.

**Almost all the time is simulation.** A world costs about 14 ms to generate and, since the fixes, about 40 ms per simulated day to run (60 days take about 2.3 s). Saving and loading that world (1.5 MB) takes 6–7 ms. Two things follow:

- **Reuse worlds rather than rebuild them.** The cached builders simulate a world once per file and hand each check a copy loaded from the save. `agencyWorld` used to simulate again for every check. Caching it halved the agency tests' CPU time (57 s → 32 s). A file whose unit tests start from a cached world builds it in `beforeAll`, so a unit test's time limit measures only its own work.
- **The wall-clock floor is a handful of single checks.** A 400-day run and loops that build 16–24 worlds each take tens of seconds, more when every file runs at once and some land on efficiency cores. A check can't be split without changing what it checks, so the floor drops only if the simulation gets faster.

**Where the simulation spends its time.** A CPU profile of a 60-day run used to put 30% in `ownerBiz` (core.ts), which counted every business on each of millions of calls to decide whether its cache was stale. It no longer counts: whatever adds a business calls `ownersChanged`, so the map is rebuilt at exactly the same moments. `generate` (actions.ts) copied the list of living men without the actor on every call, although only three kinds of action use it, and now copies it only when needed. Together, 60 days went from 3.81 s to 2.33 s. Every history stayed byte-identical: [history_hashes.ts](../src/tests/tools/history_hashes.ts) fingerprints 28 points across eight seeds, a seven-family world, a background start and a reloaded save, and the fingerprints match before and after. Use it for any further engine speed-up.

What's left is NPC decision-making in actions.ts: `chooseAction` and `generate` (about 40% between them: one option object and one random draw per candidate, and the draws must stay in the same order), `aliveList` (12%: rebuilt once per game minute), and `share` (12%: sorts what a man knows each time he passes something on). Each would need restructuring checked the same way.

What doesn't help: sharing a world across files through Vitest's `globalSetup` would save CPU but add its build time to the start of every run, and the 60-day world costs only a few seconds per file. The determinism suite already spreads its ten worlds over child processes.

### Not tests: measurement and trace scripts

These live in [src/tests/tools/](../src/tests/tools) and assert nothing. They print numbers or narratives for a human to judge, and they run with `tsx`, for example `npx tsx src/tests/tools/econ_measure.ts 3 180`:

| Script | Prints |
| --- | --- |
| `econ_measure.ts <seed> [days]` | What the money did over N days |
| `agency_measure.ts <seed> [days] [off]` | What NPCs achieved unattended, optionally with goals switched off for comparison |
| `sit_measure.ts`, `sit_freq.ts`, `sit_trace.ts` | Situation frequency, and situations followed from cause to consequence |
| `v76_smoke.ts`, `v76_trace_probe.ts` | Organisation smoke runs with `audit()` |
| `history_hashes.ts [case …]` | Fingerprints of world histories at 28 points. Run it before and after an engine change and diff: an identical output means no history changed |
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

Coverage costs about a quarter more run time, which is why plain `test:all` runs without it. **CI doesn't measure it for now**: run `make test-cov` before a change that could lower it. The determinism suite's worlds are built in child processes, which coverage doesn't see. Everything they run is also exercised in-process by other suites.

The tests were written per release (V72–V88) around the features of that release, so coverage follows recent work. Code that predates V72 (`actions.ts`, `jobs.ts`, `encounters.ts`, `meetings.ts`, much of `dialogue.ts`) is exercised by the long simulations and the crawler, but rarely asserted directly. The HTML report shows which lines are never reached. Apart from the portrait suite, which renders `ui/portrait.ts` directly, the UI layer (`web.ts`, `ui/*`, about 4,000 lines) has **no tests**. A Playwright smoke test of the core loop (new game, talk, wait, save, reload, continue) is the recommended next step ([08-framework-migration.md](08-framework-migration.md#5-suggested-order-and-checkpoints)).

## Is there a GitHub Actions test runner?

**Yes:** [.github/workflows/ci.yml](../.github/workflows/ci.yml). It runs on every push to `main`, on every pull request, and on manual dispatch.

- **Free tier compatible.** The repository is public, and GitHub-hosted runners are free for public repositories. The workflow uses only `ubuntu-latest` and first-party actions (`checkout`, `setup-node` with the npm cache, `upload-artifact`). If the repository ever goes private, the free plan includes 2,000 minutes a month.
- **Job `build`** runs `make all` (install, typecheck, build) and uploads `dist/omerta.html` as a downloadable artifact. It warns, without failing, if the committed `dist/omerta.html` or `index.html` no longer match a fresh build (the build is deterministic, so any difference means a stale commit).
- **Job `suite`** runs the tests in three parallel jobs of roughly equal work, with `fail-fast: false` and `--maxWorkers=100%` (Vitest otherwise leaves one of the runner's four cores idle). The jobs are `situations` (the most simulation), `determinism` (ten worlds in child processes), and `other tests`, everything else. The third uses `--exclude`, not a list, so a new file lands there by itself. Vitest annotates failures on the pull request. Coverage isn't measured in CI for now (see above). A whole run takes about 2½ minutes (each test job about 2), against nearly 12 minutes when the tests were one file per release and CI measured coverage.
- To make it a gate, go to **Settings → Branches → Branch protection** for `main` and require `Typecheck and build`, `situations`, `determinism` and `other tests`.

To run what CI checks locally:

```bash
make ci
```

## Running tests

| Goal | Command |
| --- | --- |
| Minimum pre-ship check (CLAUDE.md) | `make test` (typecheck plus `dialogue/`) |
| Everything except the opt-in long runs (what CI runs) | `npm test`, `npm run test:all` or `make test-all` |
| Fast feedback while editing | `npm run test:unit` (seconds), or `npx vitest --tagsFilter unit` to re-run on every change |
| One system, file or topic | `npx vitest run economy` (path filter), `npx vitest run situations/pacing` |
| One check by name | `npx vitest run economy -t "ledger"` (a regular expression over "describe > check" names) |
| One kind | `npx vitest run --tagsFilter scenario`, combinable: `--tagsFilter 'scenario && !slow'` |
| Re-run on every change | `npm run test:watch` (then `p` to filter by file, `t` by name) |
| Save compatibility only | `make test-compat` or `npm run test:compat` (every `compat` test) |
| Long simulations for some seeds | `make test-sim SEED=3 DAYS=180` (every test tagged `sim` and `slow`) |
| Every long run | `make test-slow SEED=3` or `SLOW=1 npx vitest run` |
| Save growth | `SLOW=1 SEED=3 npx vitest run saves -t growth` |
| Coverage | `make test-cov` or `npm run test:cov`, then open `coverage/index.html` |
| Hide what the checks print | add `--silent` (or `--silent=passed-only` to keep the output of failing checks) |

## Writing a test

1. Put it where it belongs ([Where a new test goes](#where-a-new-test-goes)) and give it one kind ([tags](#what-kind-of-test-tags)). A new file is picked up automatically. Import `describe` and `test as ok` from `vitest`. Use `node:assert` (`assert.equal`, `assert.deepEqual`, `assert.ok`) for the checks.
2. Build worlds with a named builder from [helpers.ts](../src/tests/helpers.ts) or the folder's `fixtures.ts`, with every argument written out: `newWorld(7)` (day 0), `agencyWorld(7, 20)`, `situationWorld(7, 20)`, `orgWorld(3, 20, 5)`, `world60()`. The cached builders simulate once per file, keep the world as a save and hand each check a fresh copy. Simulating is about 40 ms per day, and loading a save is about 7 ms, so reusing a world is far cheaper than building it again. If unit tests start from a cached world, build it in `beforeAll` (`beforeAll(() => { situationWorld(7, 20); })`) so it isn't charged to the first test's 10 s limit. For a new kind of world, add a builder that says what it builds, never a `fresh()` with hidden defaults.
3. Assert behaviour through the state downstream systems read, not the field you just wrote. That is the "integration" rule in [07-guidelines.md](07-guidelines.md).
4. End scenario tests with `assert.deepEqual(audit(w), [])`, and also `ledgerCheck(w)` if money moved.
5. Keep a file under about 30 seconds. Put long runs in a `describe` tagged with their kind plus `slow`, and parameterise them by `SEEDS`/`DAYS` from [modes.ts](../src/tests/modes.ts) with `ok.each(SEEDS)(…)`.
6. If a check flips an exported tuning switch (`AGENCY`, `SIT`), restore it in `afterEach`.
7. A known bug can be written down before it is fixed as `ok.fails(…)`. It passes while the bug is there, and fails, as a reminder to make it a normal test, once someone fixes it.

## Gaps

- Apart from the portrait suite, nothing tests the UI.
- `playtest/` is not typechecked, and its harness has a hardcoded path.
- There are only two real old-save fixtures (schema 2 and schema 7).
- A handful of long single checks (a 400-day run, loops over 16–24 worlds) set the floor of a local run. They can't be split without changing what they check. Only a faster simulation lowers it (see [How long it takes](#how-long-it-takes-and-why)).
- Coverage isn't measured in CI, and it doesn't see the worlds the determinism suite builds in child processes.
