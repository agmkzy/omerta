# State, saves and backwards compatibility

This document covers how game state is held in memory, how it is persisted, and how old saves keep working after upgrades. It also covers export, cloud backup, and how this would map onto a Pinia store.

Source files: [types.ts](../src/types.ts) (the `World` shape), [engine.ts](../src/engine.ts) (`serialize`, `deserialize`, `SCHEMA`), [world.ts](../src/world.ts) (`ensureShape`), [storage.ts](../src/storage.ts) (browser persistence), [web.ts](../src/web.ts) (`save`, `load`, `downloadSave`, upload handler), [retain.ts](../src/retain.ts) (fact retention), [consistency.ts](../src/consistency.ts) (`audit`, `reconcile`), [tests/oldsave.test.ts](../src/tests/oldsave.test.ts).

## 1. In-memory state

### The World

Everything that exists in the game is one plain object of type `World`. It contains no classes except `Rng`, no functions, no cycles, no `Map`/`Set`, and no `Date`. That makes it JSON-serialisable as-is.

| Group | Fields |
| --- | --- |
| Clock and randomness | `seed`, `rng` (an `Rng` whose only state is one 32-bit integer), `now` (minutes since 2 March 1970), `seq`, `queue` (sorted `Ev[]`: `think`/`daily`/`weekly`), `nextId` |
| People and places | `chars: Record<Id, Character>`, `biz: Record<Id, Business>`, `fam: Record<Id, Family>`, `clubs`, `playerId` |
| History and knowledge | `facts: Record<Id, Fact>` (every significant event). Each character's `known` map says which facts they know, how, and whether they know who did it |
| Money | `debts`, `txns` (business transactions, bounded), `ledger` (the player's circle, bounded), `ops` (rackets), `ventures`, family `treasury`/`tlog` |
| Commitments and matters | `jobs`, `enc` (encounters), `favours`, `threats`, `pending` (delayed consequences), `grievances`, `disputes`, `situations`, `sitcool`, `sitpace`, `agency` (NPC goals) |
| Player progression | `path`, `promo`, `goals`, `coup`, `life`, `commissionAt`, `expect` |
| Presentation that must survive reload | `scene` (an in-progress club conversation), `sunday`, `papers`, `snaps` (weekly figures for the briefing), `bj` (blackjack hand) |
| Meta | `schema` |

Every engine function has the shape `fn(w: World, …)` and mutates `w` in place. All game state is in the world. The engine keeps a few unsaved module-level caches and counters beside it (listed in [01-stack.md](01-stack.md#how-global-state-is-stored)), and exported tuning objects (`AGENCY`, `SIT`) that tests toggle. A complete field-by-owner map is in [engine/01-core-simulation.md](engine/01-core-simulation.md).

### UI state

[ui/state.ts](../src/ui/state.ts) exports one singleton `S`:

- `S.w`: the current `World`, or `null` on the start screen. **This is the only part that is saved.**
- `S.view`, `S.stack`: the current screen (a discriminated union of about 45 `View` variants) and a back stack capped at 30.
- Transient presentation: `log`, `news`, `chips`, `notice`, option lists (`opts`, `dopts`, `planOpts`, `moves`, …), expanded banners (`open`), filters, character-creator choices (`look`, `startName`, `bg`), Sunday-screen scratch, and the latest `SaveStatus`.

On reload all of `S` except the world resets. The player lands on the Today tab. A club conversation in progress survives because it lives in `w.scene`, not in `S`. A `talk` conversation (dialogue.ts `Convo`) or a meeting held in `S.view` does not survive a reload.

## 2. Serialisation

```ts
// engine.ts
export const SCHEMA = 7;
export function serialize(w: World): string {
  return JSON.stringify({ ...w, schema: SCHEMA, rng: w.rng.state });
}
export function deserialize(s: string): World { … }
```

`serialize` is a single `JSON.stringify`. The RNG is replaced by its integer state. Field order follows object insertion order, which is deterministic because the simulation is. Two worlds built from the same seed and actions therefore serialise to **byte-identical** strings, and the tests depend on this (`test.ts`, `v73`, `v74`, `v76`, `oldsave`).

`deserialize(s)` runs these steps, in order:

1. `JSON.parse`, then rebuild `Rng` from the stored state.
2. **`ensureShape(w)`** ([world.ts](../src/world.ts)) gives every optional top-level collection a default (`jobs`, `pending`, `enc`, `favours`, `threats`, `events`, `ops`, `disputes`, `txns`, `situations`, `sitcool`, `sitpace`, `agency`, …). It also calls `ensureClubs` (every family gets a club) and `ensureOrgs` (every family gets `founded`, `history`, `treasury`, `tin`/`tout`, `hist`, `rel`, …).
3. **Versioned migrations** keyed on `o.schema` (missing means 1), newest step first:
   - `v < 4` (V73): player stakes move from `w.path.stakes` onto each business's `stakes`. Protection lateness (a count of weeks) becomes `protection.owed` (an amount).
   - `v < 3` (V72): `player.intro` (who you have been introduced to) is derived from `rels[*].lastMet`.
   - `v < 2`: families get `capBonus` and `seatNo`.
   - v5 (V74), v6 (V75) and v7 (V76) needed **no** explicit step. Their data is optional and filled by `ensureShape`/`ensureOrgs` or grows as the world runs. Comments in `deserialize` record this.
4. Set `w.schema = SCHEMA`.
5. **World top-up**: if there are fewer than 34 businesses, `addShops(w, 14)`. This consumes RNG, so an old save's future diverges from what the old build would have produced. That is acceptable, because no old build will ever run it again.
6. **Per-character defaults**: `skills` (rolled from a seed derived from the character, not from `w.rng`), `standing = 40`, `books = emptyBooks()`, `memos = []`, `kickRate = BASE_RATE[rank]`, `cars = 0`, `goods = 0`.

After loading, the daily `reconcile(w)` ([consistency.ts](../src/consistency.ts)) and the weekly `repairAll` ([rank.ts](../src/rank.ts)) repair any references that have drifted (dead bosses, orphaned crews, stale protection and so on). Old saves are therefore also healed by the running simulation.

## 3. Browser persistence

[storage.ts](../src/storage.ts) is pure logic over a `StoreLike` (`getItem`/`setItem`/`removeItem`), so it is unit-tested with a fake store ([tests/storage.test.ts](../src/tests/storage.test.ts)).

| Key | Contents |
| --- | --- |
| `omerta-save-v3` (`KEY`) | The main save, the output of `serialize()` |
| `omerta-snaps-v1` (`SNAPS`) | JSON index of snapshots `{ day, key, label, size }`, newest first |
| `omerta-snap-<day>` | Up to `MAX_SNAPS = 3` older saves, at least `SNAP_DAYS = 3` game days apart |

**When it saves.** `save()` in [web.ts](../src/web.ts) is called from about 30 places: after every action that changes the world (`pass()`, the shared "time passes" path, always saves), after a new game, and after a restore or upload. Pure navigation (tabs, back, expanding banners) doesn't save. There is also an explicit "Save now" button.

**`writeSave(st, s, day, label)` guarantees:**

1. If the main save plus snapshots would exceed `BUDGET = 4,200,000` characters, the oldest snapshots are shed first. The newest snapshot is never shed to make room.
2. The main save is written, retrying up to 6 times and shedding a snapshot after each `QuotaExceededError`.
3. **Read-back verification.** If `getItem(KEY) !== s`, the previous save is written back and the result is a failure.
4. A snapshot is taken if one is due and fits. A snapshot failure never fails the save.
5. It returns a `SaveStatus { ok, available, bytes, used, snapshots, error?, warn?, lastGood? }`. `warn` is set at 70% of the nominal 5 M quota.

**Saving is never silent.** `S.save` holds the latest status. `render()` shows a red banner when `ok` is false ("Your progress is not being saved…") and an info banner at the warning level, each with a **Download a backup** button.

**Loading (`load()`).** `deserialize(localStorage[KEY])` runs first. If that throws, each snapshot is tried from newest to oldest, and the player is told which day they were returned to. A damaged save is never deleted. It is simply overwritten by the next successful save.

**Restore an earlier day.** The settings screen lists the snapshots (`restore:<key>`). Choosing one deserialises it, replaces the world and saves.

**Reset.** `reset:` (with a second-tap confirmation) removes `KEY` only. Snapshots remain until they are overwritten.

## 4. Export, import and cloud backup

### Export and import (implemented)

- **Download a backup file** (`dlsave:`) creates `omerta-day-<N>.json`, containing the exact `serialize()` output. In a normal browser it uses a Blob plus `<a download>`. Inside claude.ai it asks for the `downloads` capability via `window.claude.use('downloads')`.
- **Load a backup file** (`ulsave:`) opens the hidden `<input type="file" id="ulfile">`. The `change` listener reads the file, calls `deserialize`, replaces the world and saves. Invalid files show "That file is not a readable OMERTÀ save" and leave the current game untouched.
- Because import goes through `deserialize`, **exported files from any older version are migrated** exactly like stored saves.

### Cloud backup

Not implemented. A save is one JSON string (currently 0.3–3 MB, and it compresses about 8–10× with gzip), so the main work is the backend and identity. These options run from least to most effort:

| Option | How | Pros | Cons |
| --- | --- | --- | --- |
| **File-system sync (no code)** | Players download backups into iCloud, Dropbox or Drive folders | Works today | Manual |
| **File System Access API** | Let the player pick a file once, then write to it after each save (Chromium only) | No backend | Chromium only. The user still syncs the folder |
| **Third-party storage with OAuth** (Google Drive appData, Dropbox) | Upload the compressed save after N saves or on demand | No server of your own | OAuth client registration, token handling in a static page, and per-provider code |
| **Small backend** (recommended if accounts are wanted): a serverless function plus object storage (DigitalOcean Functions plus Spaces, Cloudflare Workers plus R2, Supabase storage) | `PUT /saves/:slot` with a gzip body, authenticated by a magic-link or OAuth session | Cross-device play, server-side snapshots/history, and the ability to keep more than 3 snapshots | Needs accounts, privacy and GDPR handling, and running costs. It breaks the "no network" property of the artifact build |

Whichever option is chosen, keep the local save as the source of truth and treat the cloud copy as a backup. Upload `serialize()` output unchanged (compressed). Download through `deserialize()`, so the migration chain still applies. Store the `schema` number alongside the blob for server-side diagnostics.

## 5. Could the save system load a localStorage backup into a Pinia store?

Yes. Nothing in the format prevents it:

```ts
const raw = localStorage.getItem('omerta-save-v3');
const world = raw ? deserialize(raw) : null;   // plain World, migrated
store.world = markRaw(world);                  // NOT deep-reactive
```

The constraint is reactivity, not loading. The world is 1–3 MB of nested objects that the simulation mutates thousands of times per simulated day. If it were deep-reactive (`ref(world)`/`reactive(world)`), every property read in `advance()` would go through a Vue proxy, which costs a large constant factor in the hottest loop. `JSON.stringify` of proxies works, but proxies would leak into code that compares identity. Keep the world raw. Expose a `version` ref that the UI layer bumps after each engine call, and derive views from it. [08-framework-migration.md](08-framework-migration.md#4-pinia-and-the-world) has a fuller store sketch, including how `storage.writeSave` stays unchanged.

## 6. Backwards compatibility: will a new version wipe progress?

**No, by design.** This is a hard requirement in [CLAUDE.md](../CLAUDE.md), and several mechanisms enforce it.

| Mechanism | What it guarantees | Where |
| --- | --- | --- |
| Stable storage key | Upgrading the page does not change where the save is read from. `omerta-save-v3` has stayed the same since V72. The `v3` refers to the key format, not the schema | [storage.ts](../src/storage.ts) |
| `schema` number + ordered migrations | Each change that needs data repaired bumps `SCHEMA` and adds an `if (v < N)` step. Steps are never deleted, so a schema-1 save still upgrades through every step | `deserialize` in [engine.ts](../src/engine.ts) |
| Optional fields with defaults | New fields are declared optional (`?`) in `types.ts`. Code reads them with `??` defaults or `ensureShape`/`ensureOrgs`/`ensureClubs` fills them on load. Most schema bumps need no explicit migration because of this | [types.ts](../src/types.ts), [world.ts](../src/world.ts), [orgs.ts](../src/orgs.ts), [clubdata.ts](../src/clubdata.ts) |
| Runtime repair | `reconcile` (daily) and `repairAll` (weekly) fix drifted references, so a slightly inconsistent old save heals | [consistency.ts](../src/consistency.ts), [rank.ts](../src/rank.ts) |
| Real old saves in the test suite | `oldsave.test.ts` loads every `src/tests/fixtures/*.save` (currently `pre-v85-club.save`, schema 2, and `v84-day35-mid.save`, schema 7, day 28). It plays each one for 3 days and checks the round trip is byte-stable. It is part of `npm run test:all` | [tests/oldsave.test.ts](../src/tests/oldsave.test.ts) |
| Synthetic migration tests | `v73`, `v74` and `v75` each have a `compat` mode that builds an old-shaped save (for example schema 3 with `path.stakes`) and checks the migration result. These are **not** in `test:all`; run them with `make test-compat` | [tests/v73.test.ts](../src/tests/v73.test.ts) etc. |
| Corruption safety | Read-back verification, rollback, snapshots and a fallback to the newest readable snapshot on load | [storage.ts](../src/storage.ts), `load()` in [web.ts](../src/web.ts) |
| Manual escape hatch | Players can download a JSON backup at any time, and the save-failure banner offers it | [web.ts](../src/web.ts) |

**Rules for contributors when the shape of `World` changes:**

1. Make the new field optional, and default it where it is read (`x ??= …`) or in `ensureShape`/`ensure*`.
2. If old data has to be *transformed* (moved, renamed or reinterpreted), bump `SCHEMA` and add an `if (v < N)` block **above** the existing ones. Comment it with the version and what changed. Never edit or remove an older block.
3. Generate a save with the **previous** build (play it a few weeks), and commit it to `src/tests/fixtures/` with a descriptive name such as `v86-day40.save`. This is the only real proof that old saves load.
4. Run `npm run test:all`, which includes the synthetic migrations (`make test-compat` runs only those).
5. Never rename `KEY`. If the storage layout must change, read the old key as a fallback and migrate.

### Gaps

- **A reloaded save does not continue identically.** Measured with seeds 3 and 7: run to day 20 13:00, save, then continue to day 90. Loading the same save in a fresh process and running to day 90 gives a different world. `determinism.test.ts` misses this because it reloads in the same process, where the module-level caches survive. Contributing causes found so far: caches whose contents depend on when they were first filled (`medians` in books.ts, keyed by seed and day and filled by whoever calls `influence()` first, including the header render; `troubleCache` in econ.ts, filled by the first caller each week, including views; the time-keyed `ownerCache`/`aliveCache`), and views that change the world or draw from `w.rng` while rendering. Disabling the four caches alone did not remove the divergence, so there is at least one more cause. Players don't lose progress, but "same seed + same actions = same history" only holds within one uninterrupted session, and bugs that need a reload can't be reproduced from a save.
- **No forward-compatibility guard.** If a save written by a *newer* build is opened by an *older* build (for example a cached page, or an older artifact link), `deserialize` sets `schema = 7` and carries on. Unknown fields survive because of the `...o` spread, but semantics the old build doesn't understand are silently ignored, and the next save stamps it as schema 7. A one-line check (`if (v > SCHEMA) refuse or warn`) would prevent silent downgrades.
- **No runtime validation.** A hand-edited or truncated-but-valid JSON save is cast to `World`. Only `ensureShape` defaults and the daily `reconcile` stand between it and a crash.
- **Only two real fixtures.** There is a schema-2 save and a schema-7 save, but none for schemas 3–6. The synthetic `compat` checks cover those transitions, and run in `test:all` and CI.
- `deserialize` is **not pure**. It can add shops, which consumes RNG. That is harmless for players, but it means "load then save" of a pre-V73 file is not a no-op.

## 7. Size and the quota

Browsers give each origin about 5 M UTF-16 characters of `localStorage`. The game budgets 4.2 M for its own keys. Measured growth (seed 3, unattended, so real play is larger):

| Day | Save | Main + 3 snapshots |
| --- | --- | --- |
| 30 | 1.22 MB | 4.9 MB (over budget, so snapshots are shed) |
| 60 | 1.53 MB | 6.1 MB |
| 180 | 2.05 MB | 8.2 MB |
| 365 | 2.87 MB | 11.5 MB |

From about day 30 the game keeps fewer than three snapshots. The main save alone fits until roughly 4 MB, about 18–24 months of unattended play and sooner with an active player. `retain.ts` already caps growth: routine facts that nothing refers to expire weekly, and bystanders' knowledge of old facts is thinned. Per-character `known` and `rels` maps still dominate, at about 75% of the save.

Options, cheapest first:

1. **Compress before storing.** For example LZ-string `compressToUTF16`, which needs no build changes and roughly halves to quarters the size. Alternatively use `CompressionStream('gzip')` plus base64. JSON of this shape compresses very well.
2. **Move storage to IndexedDB.** It has a much larger quota (hundreds of MB), is asynchronous and stores Blobs. `StoreLike` would become async, and so would `save()`. Keep `localStorage` as a small pointer or fallback.
3. **Store snapshots as compressed deltas,** or only keep the latest snapshot uncompressed.
4. **Tighten retention:** cap `known` per bystander and prune `rels` entries for long-dead or never-met characters.
