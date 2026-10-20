# Testing

## What testing framework is used?

**None.** The tests are plain TypeScript scripts that use Node's built-in `node:assert` and run with `tsx`. Each version suite defines its own small helper:

```ts
let failed = 0;
const ok = (name: string, f: () => void) => {
  try { f(); console.log('ok   ' + name); }
  catch (e) { failed++; console.log('FAIL ' + name + ': ' + (e as Error).message.split('\n').slice(0, 6).join(' ')); }
};
// … at the end:
setTimeout(() => { console.log(failed ? `${failed} FAILED` : 'all passed'); process.exit(failed ? 1 : 0); }, 50);
```

`storage.test.ts`, `oldsave.test.ts` and `src/test.ts` call `assert` at top level, so the first failure throws and exits non-zero. The version suites keep going after a failure and exit 1 at the end. Every script therefore reports failure through its exit code, which is all CI needs.

Most suites take a **mode argument** (`process.argv[2]`). `fast` is the default used by `test:all`. The slower modes are run by hand:

| Suite | What it covers | Modes | Checks | `fast` time* |
| --- | --- | --- | --- | --- |
| [storage.test.ts](../src/tests/storage.test.ts) | `writeSave` against a fake quota-limited store: snapshot budget, shedding oldest first, a corrupted write rolled back, a full store reported | — | 4 blocks | 1 s |
| [v72.test.ts](../src/tests/v72.test.ts) | Hierarchy and succession repair, promotions applied once, **"rank has one door"** source scan, rackets catalogue, ambitions tick once, fact retention, schema-2 bloated save shrinks, mid-scene save/load | `fast`, `slow:<seed>`, `growth:<seed>` | 21 | 9 s |
| [v73.test.ts](../src/tests/v73.test.ts) | Economic foundation: business accounts, `bizMove` as the only door, ledger, stakes, protection arrears, `ledgerCheck`/`audit` stay empty | `fast`, `stable:<seed>`, `roundtrip:<seed>`, `compat` | 37 | 22 s |
| [v74.test.ts](../src/tests/v74.test.ts) | NPC goals (`w.agency`): formation, stages, funding, endings, asking the player, round trip | `fast`, `sim:<seed>[:days]`, `roundtrip:<seed>`, `compat` | 31 | 47 s |
| [v75.test.ts](../src/tests/v75.test.ts) | Situations: persistence, stages, NPC-only resolution, player choices, sit-downs, **no information leaks**, claims and lies, no duplicates | `fast`, `sim:<seed>[:days]`, `compat`, `trace` | 34 | see below |
| [v76.test.ts](../src/tests/v76.test.ts) | Dynamic organisations: N families, splinter groups, treasuries, the **no hardcoded family ids / count** source scan, determinism | `fast` (+`det`), `sim:<seed>[:days]`, `det`, `trace` | 16 | see below |
| [v77.test.ts](../src/tests/v77.test.ts) | Voices and memory: every archetype has lines, no shared lines, no machinery words or unfilled placeholders, recall | `fast` | 17 | see below |
| [v78.test.ts](../src/tests/v78.test.ts) | Conversation layers: root menu reach, knowledge-gated topics, used-option greying, rank authority | `fast` | 21 | see below |
| [v79.test.ts](../src/tests/v79.test.ts) | **Conversation crawler**: random walks through every menu for many characters at many trust levels. Checks for no crashes, no dead ends, nothing rewarded twice, nothing that talks like a database (`DUMP=file` writes every line seen) | `fast` | 6 | see below |
| [oldsave.test.ts](../src/tests/oldsave.test.ts) | Every `fixtures/*.save` loads, plays 3 days and round-trips byte-identically | — | 2 fixtures | see below |
| [src/test.ts](../src/test.ts) | **Determinism** (seed 7, 120 days, twice gives identical serialisation), save/load continuation, 8 seeds × 180 days with no NaN cash | — | 3 blocks | see below |

\* Measured on an Apple-silicon Mac with Node 25.

The whole `npm run test:all` took **7 min 36 s** and passed (182 `ok` lines), run serially and stopping at the first failing suite.

### Not tests: measurement and trace scripts

These live beside the tests but assert nothing. They print numbers or narratives for a human to judge:

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
- **Determinism and round trip.** The same seed must give a byte-identical `serialize()`, and `deserialize(serialize(w))` must continue identically.
- **Real old saves.** These are genuine saves from older builds ([02-state-saves-and-compatibility.md](02-state-saves-and-compatibility.md)).
- **Source-scanning "architecture tests".** Rank is only assigned in `rank.ts`/`world.ts`. No file names a family id or assumes five families.
- **Content checks.** Voice banks have per-archetype coverage, with no duplicates and no leaked internals.
- **Crawlers.** Random walks over the dialogue tree.
- **Scenario tests.** Build a world, set up a situation, act, then assert the consequence (for example, a boss dies and the underboss takes over).

## Are there coverage targets?

**No.** Nothing measures coverage and there is no threshold. The suites are written per version (V72–V79) around the features of that version, so coverage follows recent work. Code that predates V72 (`actions.ts`, `jobs.ts`, `encounters.ts`, `meetings.ts`, much of `dialogue.ts`) is exercised by the long simulations and the crawler, but rarely asserted directly. The UI layer (`web.ts`, `ui/*`, about 4,000 lines) has **no tests at all**.

Recommendation: adopt Vitest with `@vitest/coverage-v8` ([08-framework-migration.md](08-framework-migration.md#1-vitest)), measure, then set the threshold just below the measured figure so it can only rise. Target 80% lines for `src/*.ts`, excluding entry points and UI. Add a Playwright smoke test for the UI's core loop: new game, talk, wait, save, reload, continue.

## Is there a GitHub Actions test runner?

**There wasn't one. This change adds it:** [.github/workflows/ci.yml](../.github/workflows/ci.yml). It runs on every push to `main`, on every pull request, and on manual dispatch.

- **Free tier compatible.** The repository is public, and GitHub-hosted runners are free for public repositories. The workflow uses only `ubuntu-latest` and first-party actions (`checkout`, `setup-node` with the npm cache, `upload-artifact`). If the repository ever goes private, the free plan includes 2,000 minutes a month. One CI run is roughly 12 parallel jobs of 1–4 minutes each.
- **Job `build`** runs `make all` (install, typecheck, build) and uploads `dist/omerta.html` as a downloadable artifact. It warns, without failing, if the committed `dist/omerta.html` or `index.html` no longer match a fresh build (the build is deterministic, so any difference means a stale commit).
- **Job `suite`** is a matrix with one job per suite (storage, v72–v79, old saves, determinism, schema migrations), run in parallel with `fail-fast: false`. A red suite doesn't hide the others, and the wall-clock time is that of the slowest suite instead of the serial 7.5 minutes.
- To make it a gate, go to **Settings → Branches → Branch protection** for `main` and require the `Typecheck and build` and suite checks.

To run what CI runs locally:

```bash
make ci
```

## Running tests

| Goal | Command |
| --- | --- |
| Minimum pre-ship check (CLAUDE.md) | `make test` (typecheck plus v77, v78, v79) |
| Everything `test:all` runs | `make test-all` or `npm run test:all` |
| Schema migrations | `make test-compat` |
| One suite | `npx tsx src/tests/v73.test.ts fast` |
| A long simulation for one seed | `npx tsx src/tests/v74.test.ts sim:3:180` or `make test-sim SEED=3 DAYS=180` |
| Save growth | `npx tsx src/tests/v72.test.ts growth:3` |

There is no way to run a single `ok(...)` case by name. Comment out the others, or move to Vitest.

## Writing a test

1. Pick the suite for the area you're changing, or create `src/tests/vNN.test.ts` by copying the header, the `ok` helper and the mode dispatch from an existing suite.
2. Build worlds deterministically, for example `createWorld(3, 'Tony Marino')` then `advance(w, w.now + N * DAY)`. Cache an expensive base world as a serialised string, and `deserialize` a fresh copy per test, as `v77` does in `fresh()`.
3. Assert behaviour through the state downstream systems read, not the field you just wrote. That is the "integration" rule in [07-guidelines.md](07-guidelines.md).
4. End scenario tests with `assert.deepEqual(audit(w), [])`, and also `ledgerCheck(w)` if money moved.
5. Keep `fast` mode under about a minute per suite. Put long runs behind a mode argument.
6. Add the suite to the `test:all` loop in `package.json` and to the matrix in `.github/workflows/ci.yml`.

## Gaps

- No runner: no filtering, no watch mode, no parallelism, no coverage, no structured reports.
- `compat` modes (synthetic migrations for schemas 3–6) are not in `test:all`. They are in CI and `make test-compat`.
- There is no UI test of any kind.
- `playtest/` is not typechecked, and its harness has a hardcoded path.
- `v72` scans `process.cwd() + '/src/'`, so it must be run from the repository root.
- There are only two real old-save fixtures (schema 2 and schema 7).
