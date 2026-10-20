# OMERTÀ V72 — Stability & Consolidation: technical report

Scope: V72 only. Nothing from V73–V76 was started. No interface redesign. Existing saves still load.

## 1. Verdict against the brief

| # | Item | Result |
|---|---|---|
| 1 | Unbounded save growth | **Fixed.** 180-day saves are ~1.3–1.7 MB instead of ~9.5–10.9 MB (table in §4). |
| 2 | Reliable saving | **Done.** Read-back verified, banner on failure, last good save protected, snapshots budgeted. |
| 3 | Serialization / migration tests | **Fixed at the cause**, strict assertion unchanged. |
| 4 | One promotion mechanism | **Done** (`rank.ts`); player and NPC criteria deliberately kept distinct but read through one function. |
| 5 | Ambition systems | **Merged** into one module with one tick. Both were player-only. |
| 6 | One racket definition | **Done.** `OPS` is the source; the interface list is generated from it; a missing sheet fails to compile. |
| 7 | Hierarchy integrity | **Done.** Single succession path, repair, and a stronger `audit()`. |
| 8 | Tests and measurements | Done; every result is in §6. Nothing failed in the final runs. |

## 2. What the audit got right, and what it got slightly wrong

I verified each finding in the code before changing anything.

* **Save growth** — confirmed and located. 83% of the bytes were per-character `known` maps (≈159,000 entries for ≈3,800 facts at day 180). The cause was the gossip routine `share()` in `actions.ts`: it passed the two most recent facts of any kind to anyone it talked to, with no age limit, so a routine $300 gambling loss ended up known by ~30 people. `gambling_loss` alone was 45,000 of 78,000 knowledge entries at day 90.
* **Failing round-trip test** — the audit blamed the `intro` migration. That was the visible symptom. There were two causes: a fresh world did not create `intro` (the loader added it later), and about 25 places set optional fields to `undefined` instead of deleting them, which leaves a different key order after a reload. After the first cause was fixed the same test exposed a third of the same kind (`disputes` missing from fresh worlds).
* **Two promotion systems** — partly right. `career.ts` holds the family's rules for NPCs, the ceremony, and the generic `promote()`. `path.ts` is the player's road (goals, trial, seats). The real defects were: nine places assigning `c.rank` directly, each with its own side effects; the player's "Your standing" screen, dialogue and family view reading the *NPC* thresholds (1,500 / 6,000 / 14,000 passed up) while the actual gate needs 15,000 / 25,000 / 50,000; and a player branch in `careerTick` that could never run.
* **Two ambition systems** — both are player-only: a milestone ladder per rank band (`ambitions.ts`, auto-tracked, pays rewards) and the one Current Ambition you choose (`ambition.ts`). Neither is NPC motivation; what NPCs want lives in `people.ts` / `pulse.ts` and was not touched. The real problems were two modules, two ticks (one daily, one weekly), duplicated measures, and two screens that both read like "your ambitions".
* **OPS vs WAYS** — confirmed: two hand-maintained lists for the same twelve rackets.
* **Dead boss as active boss** — confirmed as a code path, **not observed in 180-day runs** before the fix. When a boss died and no underboss or captain existed, `handleDeath` left the family pointing at the dead man. I did not reproduce the original failure in simulation; the new tests reproduce the *scenario* and show the new code resolves it.

## 3. What changed

### Save growth (`retain.ts`, new)
Facts are classified by kind into three tiers, and nothing is dropped merely for being old.
* **Permanent** — promotions, murders, rulings, sit-downs, events, failed businesses, defaults, exposures, informants, side operations, levies, raids. Never dropped.
* **Active** — anything that something live points at is kept at any age: an active debt, an open dispute, a pending event, a memo, an open encounter, the scene in progress, a later fact's `cause`. This is detected by walking the whole world for fact ids (everything except the fact store and the knowledge maps), so a new field that stores a fact id is protected automatically. Settled debts and closed disputes stop protecting their facts.
* **Disposable** — routine observations (gambling losses, refused/late protection, reports, struggling-business notes, loans and debt chatter, trouble, rumours) are dropped after 21 days (60 if they involve the player), along with every copy in anyone's knowledge. Other facts live 150 days (365 if they involve you). Bystanders forget non-permanent facts after 60 days; the people involved, and you, do not.
* **Gossip cap** — between NPCs, routine news may be repeated at most 3 times and only for 10 days; other news 14 times and 45 days; permanent news without limit. This is what stops the cascade at the source. It does not limit what you can be told.
* The sweep runs **once a week** over the facts, not on every tick. Dead characters' knowledge of ordinary facts goes with them.

### Saving (`storage.ts`, new; `web.ts`)
* A save only reports success after it has been read back and compared. If the written copy does not match, the previous save is restored and the failure is reported.
* A failed write never touches the last good save. On a full browser, the oldest snapshot is dropped first, and the newest snapshot is never sacrificed; if the main save still does not fit, you are told.
* Snapshots are held to a space budget (4.2 million characters of the ~5 million a browser gives) instead of always keeping three full copies.
* Failures show a red banner on every screen ("Your progress is not being saved… the last good save is from …") with **Download a backup**. A size warning appears at 70% of the browser limit. Settings now shows the real size of the save and snapshots, plus **Download / Load a backup file**.
* "Save now" no longer says "Saved." unless it was.
* If the main save will not open, the game falls back to the newest readable snapshot and tells you. Nothing is deleted at load.

### Round trip and migration
* `SCHEMA` is now 3. The `intro` backfill runs only for saves older than 3, and new worlds create the field. `ensureShape()` gives new worlds and loaded saves the same set of collections.
* About 25 `x.y = undefined` assignments became `delete x.y`.
* Load → resave now returns byte-identical text; a loaded save continues byte-identically to the original; the same seed gives the same history.

### Rank (`rank.ts`, new)
* `applyRank()` is the only code that assigns a rank (a test fails if any other source line does). It sets rank and wage, writes the career record and the history fact, refuses to apply the same rank twice, and then repairs the hierarchy.
* `successor()` is the only succession rule: named heir → underboss → strongest captain → soldier → associate.
* `repairHierarchy()` guarantees a living boss as family head, a valid senior living superior of the same family for everyone, and no loops. `hierarchyIssues()` is the read-only version; `audit()` now includes it.
* `leaveCrew()` replaces three places that set `bossId = null`. A man you cut loose stays in the family under someone else; a defector actually ends up in the other family, as his text always said.
* **Eligibility:** `readiness()` is the single question "is he ready?". For NPCs it is the family's rule of thumb; for the player it reads the road in `path.ts`, so the screen, dialogue and promotion cannot disagree. The player and NPC criteria remain different on purpose.

### Ambition (`ambition.ts`)
`ambitions.ts` was merged in and deleted. One tick (daily, from the engine) updates both the milestone ladder and your chosen ambition; the weekly call from `pulse.ts` is gone; shared measures are shared. The old ladder screen is renamed **Milestones**, and an unused duplicate card was removed.

### Rackets (`ways.ts`)
`OPS` in `rackets.ts` is the definition. `OP_SHEETS` (the written description of each racket) is a `Record` keyed by the same names, so a racket added to `OPS` without a sheet does not compile, and the interface list is generated from `OPS`. Extra: `handleDeath` now closes open disputes involving the dead man immediately (stress seed 3 had flagged "disputes between dead men").

## 4. Save growth, before and after

Same seeds, same code, with retention switched off (`RETENTION.on=false`, pre-V72 gossip) versus V72. Size of the serialized save, KB.

| Seed | | d30 | d60 | d90 | d120 | d150 | d180 | avg KB/day | after day 30 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | before | 2,267 | 3,934 | 5,480 | 7,095 | 8,341 | 9,499 | 51.4 | 48.2 |
| 1 | **V72** | 931 | 1,123 | 1,162 | 1,209 | 1,231 | 1,336 | **6.1** | **2.7** |
| 7 | before | 2,029 | 3,623 | 5,085 | 6,731 | 8,315 | 9,643 | ≈52 | 50.8 |
| 7 | **V72** | 953 | 1,125 | 1,147 | 1,237 | 1,257 | 1,346 | **6.2** | **2.6** |
| 13 | before | 2,312 | 4,210 | 5,908 | 7,773 | 9,318 | 10,936 | 59.3 | 57.5 |
| 13 | **V72** | 1,134 | 1,365 | 1,397 | 1,385 | 1,522 | 1,665 | **7.8** | **3.5** |

The first month still grows by about 23–29 KB/day because the world is filling in (relationships between ~160 people form and then plateau at about 550 KB). The audit's 62 KB/day figure came from a different period; my own measurement of the old code is ~52–59 KB/day averaged over 180 days.

**Longer horizon (one seed, 540 days):** 1,125 KB at d60 → 1,346 d180 → 1,762 d360 → 2,032 KB at d540, i.e. about 1.9 KB/day after day 180, with `audit()` and the hierarchy check clean at the end and no slow-down in simulation time (about 20 s per 60 days throughout). This is one seed; I did not run longer. The old build would have crossed a typical 5 MB browser limit at roughly day 85–90.

## 5. Save migration details
* Key names are unchanged (`omerta-save-v3`, `omerta-snaps-v1`), so existing saves and snapshots are found and kept. Snapshot index entries gained an optional `size`.
* Loading never deletes anything. On the first weekly tick after a load the sweep applies the retention rules to the loaded world, so an old, bloated save shrinks by itself (a bloated test world shrank to <60% within a week).
* Verified by loading five real saves from earlier builds (three at schema 2, two with no schema field at all), advancing each 14 days, and running `audit()`: all loaded, all clean.
* The new fields are optional (`Fact.heard`, `Character.intro` now always present).
* **Behaviour of a loaded old save:** most routine history older than 21 days disappears on the first week. Permanent history and everything still in use stays.

## 6. Test results (final build)

| Test | Result |
|---|---|
| Storage unit tests (quota, corruption, blocked storage, snapshot budget) | **5/5 pass** |
| V72 fast suite (hierarchy, succession ×5, double promotion, chair paths, cut/defect, readiness, rackets, ambition, retention, old save, mid-scene) | **20/20 pass** |
| Hierarchy over 180 days, seeds 1, 2, 3, checked every day | 0 invalid boss references, 0 loops, 0 orphans, 0 duplicate promotions, `audit()` clean |
| Round trip + determinism (60-day save, 30 days on, vs a straight 90-day run), seeds 3, 12 | **pass**, byte-identical |
| Original `test.ts` (determinism, round trip, 8 seeds × 180 days, no NaN) | **pass** |
| Bot-played stress, 250 days, seeds 1 and 3 | audit violations: 0 and 0 |
| Player road end-to-end (associate → soldier → capo → underboss, chair options) | all ceremonies complete |
| Browser: all 12 rackets present, save-failure banner, "Saved." not shown on failure, recovery clears banner, corrupt-save fallback, backup download and reload | pass |
| 400 random UI actions in a real browser | no errors |

Hierarchy repairs fired 3, 4 and 2 times in the three 180-day seeds. All were a promotion leaving a man under someone now his peer; none left a bad state behind.

## 7. Known limitations
* **Browser limit is an assumption.** I used ~5 million characters. I did not measure the quota inside the published artifact frame or on a phone.
* **Retention tiers are by kind**, not a judgment on each fact. A fact kind I classed as routine could turn out to matter in a story I have not seen.
* **Less second-hand news.** At day 60 on seed 7 the player knows 17 facts instead of 30, nearly all of the difference routine kinds (refused protection, small gambling losses). NPCs also know fewer routine facts. I think this is closer to what you intended ("information discipline") but it is a visible change.
* **Same seed, different world.** The gossip change alters random draws, so a given seed no longer produces the same city as v71. Saved games are unaffected.
* The damaged-save fallback is overwritten by the next save, since the damaged text cannot be read.
* The backup download relies on the browser allowing downloads from the page. It worked in local Chromium; I could not test it inside the claude.ai frame.
* `localStorage` remains the store. At the measured ~3 KB/day it is adequate for well over a year of play on current content, but V73–V76 will add state; moving to IndexedDB (asynchronous, far larger quota) is the sensible next step if that growth is not offset. I did not do it because it would make saving asynchronous and needs its own migration.
* Contested succession, coups, and organisation entities are intentionally not implemented (V76).

## 8. What the player will notice
* A red banner, and a warning in Settings, if saving ever fails; a size line and backup buttons in Settings.
* "Your standing" and the promotion conversations now describe the same requirements the promotion actually uses (15,000 / 25,000 / 50,000 passed up, jobs, backers, trial) rather than an easier NPC table.
* "Your ambitions" is now **Milestones**; "Your ambition" on the Today page is unchanged.
* Fewer routine rumours reach you second-hand; older routine history disappears after about three weeks.
* A man you cut loose stays in the family under another man; a defector really joins the other family.
* A dead boss is always replaced.

## 9. Files
New: `src/retain.ts`, `src/storage.ts`, `src/rank.ts`, `src/tests/storage.test.ts`, `src/tests/v72.test.ts`.
Merged/removed: `src/ambitions.ts` → `src/ambition.ts`.
Changed (substantive): `actions.ts` (gossip), `engine.ts` (sweep, repair, schema 3), `world.ts` (shape, intro), `core.ts` (succession, dispute closing), `career.ts`, `path.ts`, `powers2.ts`, `orders.ts` (rank door, readiness), `ways.ts` (generated from OPS), `consistency.ts` (audit), `web.ts` and `ui/*` (saving, banner, Milestones), `pulse.ts`, `types.ts`.
Changed (mechanical): `x = undefined` → `delete x` in `people`, `books`, `life`, `meetings`, `situations`, `disputes`, `politics`, `orders`, `pulse`, `world`, `core`, `career`, `path`, `engine`.
