# Economy, money and the ledger

In game terms this group is everything to do with money: shops trading and paying protection, the weekly envelope (kick-ups) passed up the chain of command, loans and the debts they create, the side hustles NPC associates and soldiers run, the rackets the player can start, one-off gig work, blackjack at the family casinos, the earned specialisations that tweak earnings, and the filter that decides which events reach the player. In code terms it is a set of modules that change `Character.cash` (directly, or through `core.earn()`), change `Business.cash` (only through `econ.bizMove()`), and keep three separate records of money: `w.txns` (every movement of a business's till), `Character.books` (each man's weekly income by source, what he owed upward and what he paid), and `w.ledger` (a display ledger for the player's own circle). The work is driven by the weekly tick (`businessWeek`, the debt loop inside `engine.ts weekly()`, `hustleWeek`, `reportTick`, `settleWeek`, `opsWeek`) and the daily tick (`opsDaily`, and `gigTick` via `jobs.daily`), plus player actions from the UI. The world is not a closed economy: wages, trade revenue, hustle and racket income create money; living costs, lifestyle spending and business expenses destroy it. Conservation is enforced for business tills (a replayable record) and the family treasury (in `orgs.ts`), and tested for specific transfers; see [Money conservation](#money-conservation).

> **Tracked bugs:** the "Known issues" notes below were checked against the source, and the confirmed ones are filed as GitHub issues: [`area: economy`](https://github.com/agmkzy/omerta/issues?q=is%3Aissue+milestone%3A%22V85+baseline+review%22+label%3A%22area%3A+economy%22).

## Modules

| file | lines | responsibility |
|---|---|---|
| [ledger.ts](../../src/ledger.ts) | 118 | Display ledger of money movements inside the player's circle; derives each man's weekly `Statement`. |
| [econ.ts](../../src/econ.ts) | 452 | Business economy: `bizMove` (the only door for business cash), `w.txns`, weekly accounts, protection fees and arrears, stakes, ownership, `ledgerCheck`/`economyIssues`. |
| [books.ts](../../src/books.ts) | 590 | Kick-ups: weekly settlement up the chain, skimming and concealment, superiors' reactions, rate talks, the player's envelope and audit tools; also `influence()`. |
| [rackets.ts](../../src/rackets.ts) | 219 | Player-run standing operations (numbers, docks, union, front, ...) and one-off hijacks: weekly take, runners' skim, raids, rival squeeze. |
| [hustle.ts](../../src/hustle.ts) | 104 | NPC associates' and soldiers' own lines of work: choice, weekly income, bad weeks, expansion, street arrests. |
| [gigs.ts](../../src/gigs.ts) | 341 | Situational one-off jobs offered to the player (muscle, shipment, escort, courier, inspector), resolved through `jobs.ts`. |
| [blackjack.ts](../../src/blackjack.ts) | 70 | Blackjack at the family casinos, settled against the casino's till. |
| [specs.ts](../../src/specs.ts) | 31 | The player's derived specialisation (earner, operator, negotiator, enforcer) and the perks it unlocks. |
| [reports.ts](../../src/reports.ts) | 134 | What reaches the player: fact relevance, crew reporting styles, weekly crew reports; crew requests to invest in a hustle. |

---

## ledger.ts

**Purpose.** A single list of money movements for the player's circle (the player, the men whose `bossId` is the player, and the player's own boss), so that the Sunday page, a man's books and the envelope text read the same numbers. It also derives a `Statement` (one man's week: own takings, crew takings, due, carried, handed, short) from those entries. It never moves money; it only records what other code tells it.

**State owned.**
- `World.ledger?: LedgerEntry[]`. Sole writer is `post()`. Created lazily (`w.ledger ??= []`). Bounded: when it holds more than 400 entries and the oldest is older than `KEEP_WEEKS` (8) weeks, it is filtered down to the last 8 weeks ([ledger.ts:27](../../src/ledger.ts)).
- Through `refreshHistory()`, the latest `Character.books.history` row's `paid`, `due` and (player only) `own`, `crewGross`.

**Public API.**

| export | returns | notes |
|---|---|---|
| `type Flow = 'earn' \| 'owe' \| 'expect' \| 'kickup' \| 'loan' \| 'repay' \| 'gift' \| 'stake' \| 'spend' \| 'wager' \| 'upkeep'` | | Kind of entry. `owe` and `expect` are obligations, not movements. |
| `interface LedgerEntry { t; wk; from: Id \| 'world'; to: Id \| 'world'; amt; flow; src?; note? }` | | One entry. `wk` is a week number. |
| `wkOf(t: number)` | `number` | `Math.floor(t / WEEK)`. Duplicated in econ.ts. |
| `post(w, e: { from; to; amt; flow; src?; note?; wk? })` | `void` | Appends an entry if `amt > 0` (or the flow is `owe`/`expect`, which are posted at any amount) and `from` or `to` is in the circle at the moment of posting. Rounds `amt`. Mutates `w.ledger`, prunes. No money moves. |
| `interface Statement { has; wk; own; crew; crewMen; weekDue; carry; due; handed; short; expected; light }` | | One man's week. |
| `lastWeek(w, id)` | `number \| undefined` | Latest week with an `owe` entry from `id`. |
| `statement(w, c, wk?)` | `Statement` | From that week's entries: `own` = `earn` to `c` excluding source `kickups`; `crew` = `kickup` to `c`; `weekDue`/`carry` = `owe` with `src` `week`/`carry`; `handed` = `kickup` from `c`; `expected` = `expect` from `c`; `light` = `short > max(25, 15% of due)`. If the ledger has no `owe` from `c` for the week, falls back to `c.books.history` (`has: false`). |
| `previous(w, c)` | `Statement \| undefined` | The statement for the week before `lastWeek`. |
| `flowsOf(w, id, weeks = 4)` | `Record<string, { in; out }>` | Totals by flow over recent weeks, excluding `owe`/`expect`. Not used anywhere. |
| `FLOW_WORD` | `Record<string, string>` | Labels for flows. Not used anywhere. |
| `balanceBetween(w, a, b)` | `number` | Net balance of `active` and `defaulted` debts between two men. Not used anywhere. |
| `refreshHistory(w, c)` | `void` | Copies the ledger statement for the latest history row back into that row (the row is described as a cache of the ledger). |

Internal: `inCircle(w, id)`.

**Tick hooks.** None of its own. `post` is called from `books.settleOne` (weekly), from `core.createDebt`/`core.payDebt` (whenever a debt is made or paid), from `books.handOver` (Sunday, player action), and from player choices in `club.ts`, `pulse.ts`, `powers2.ts` and `web.ts`.

**Depends on / used by.** Imports only `types`. Used by [core.ts](../../src/core.ts) (`post`), [books.ts](../../src/books.ts) (`post`, `refreshHistory`, `statement`, `wkOf`), [club.ts](../../src/club.ts) (`post`, `statement`), [pulse.ts](../../src/pulse.ts) (`post`), [powers2.ts](../../src/powers2.ts) (`post`), [web.ts](../../src/web.ts) (`post`, `statement`), [ui/sunday.ts](../../src/ui/sunday.ts) (`previous`, `statement`).

**Invariants & rules.**
- The ledger is a record for display, not a balance. Nothing reconciles it with anyone's cash.
- Earnings are not posted as they happen. `settleOne` posts one `earn` entry per income source per week at settlement, using the weighted amount (loan income counts at 30%, see books.ts `WEIGHT`), so mid-week the ledger has no earnings for the current week.
- Whether an entry is kept depends on the circle at posting time; entries persist if the circle changes later.
- Statements are keyed by the week of posting (`wkOf(w.now)`), except `handOver`, which passes `wk: wkOf(w.sunday.t)` so a Sunday hand-over lands in the week just settled.

**Save compatibility notes.** `w.ledger` is optional and created on first post; an older save without it makes `statement()` fall back to `books.history`. No migration. Bounded to roughly eight weeks.

**Known issues / gaps.**
- `flowsOf`, `FLOW_WORD` and `balanceBetween` are exported and unused: the "money page" the file comment describes is not wired into the UI.
- Flow kinds `stake`, `spend`, `wager` and `upkeep` are declared and labelled but never posted. Racket start-up costs, blackjack, the player's half of a crew investment, living costs and obligations are not in the ledger. Only `earn`, `owe`, `expect`, `kickup`, `loan`, `repay` and `gift` are ever written.
- The header comment says everything that shows money reads from the ledger; in practice many views read `books.history`, `c.cash`, `hustle` fields and business accounts directly.
- `PathState.ledger` (career log in powers2.ts) is an unrelated field with the same name.

---

## econ.ts

**Purpose.** The business economy introduced in V73. `bizMove()` is the only way a business's cash changes, and it writes a transaction (`Txn`) in the same call, so the record can always be replayed against the balance (`ledgerCheck`). Once a week `businessWeek()` runs every open business: revenue scaled by a performance multiplier, expenses, the protection fee (with arrears and a reason when short), other people's stakes, owner injections, reinvestment, the owner's draw, and failure after five weeks in the red. It also owns ownership changes, stakes, managers, the protection-arrears helpers other modules use, and the visitor's view of a business (`evidence`).

**State owned.**
- `Business.cash` (declared `readonly` in [types.ts:159](../../src/types.ts); `bizMove` writes it through a cast). Sole writer.
- `World.txns?: Txn[]` (`{ t, k: TxKind, b, d, bal, who? }`, `d` signed from the business's side). Sole writer. Capped at `TXN_CAP` 3000 by `pruneTxns`; trimmed to the last week by `strikeAccounts`.
- `Business.acct?: WeekAcct[]`, at most `ACCT_WEEKS` (8) rows; zero fields omitted.
- `Business.protection.owed`, `.late`, `.why`, `.total`, `.since` (via `payProtection`, `creditCollector`, `takeFromBiz`, `giveTime`, `clearArrears`); the whole `protection` object via `setCollector`. Reads `protection.hold` (set by disputes.ts).
- `Business.managerId`, `stakes`, `owners`, `invest`, `rivals0`, `distress`, `damaged` (decrements), `open` (closes on failure or dead owner), `ownerId` (`transferBusiness`).
- `Character.cash` of collectors, owners and stake holders; `Character.wage` (raised to at least 90 when the owner's business fails).
- `Debt.balance` and `Debt.status` for debts backed by a seized stake (`payStake`).
- Creates civilians (`spawnCivilian`, $90 each) as managers.
- Module-level caches, not saved: `tailCache: WeakMap<World, Map<Id, Txn>>` (latest txn per business, for merging) and `troubleCache: WeakMap<World, { wk; by }>` (violent facts per district, rebuilt once per calendar week).

**Public API.**

| export | returns | notes |
|---|---|---|
| `ACCT_WEEKS = 8`, `INVEST_CAP = 0.08` | | `INVEST_CAP` is also read by goals.ts. |
| `wkOf(t)` | `number` | Floor of `t / WEEK`. |
| `bizMove(w, b, delta, kind: TxKind, who?: Id)` | `number` (the rounded delta) | The only door. Rounds, returns 0 for 0. Adds to `b.cash`; merges into the business's latest txn if it has the same `kind`, same `who`, same day and the chain still holds (one entry for a night of casino bets), otherwise appends a new txn. Calls `pruneTxns` above 3000. Does not touch any character: the caller moves the other side. |
| `pruneTxns(w)` | `void` | Drops the oldest txns beyond the cap. Safety valve. |
| `interface BizWeek { revenue; expenses; protection; stakes; drawn; injected; invested; lost; net }` | | |
| `bizBetween(w, id, from, to)` | `BizWeek` | Sums txns with `from < t <= to` by kind. `protection` and `extort` both count as protection; other kinds count as `lost` if negative, `revenue` if positive. |
| `strikeAccounts(w)` | `void` | For every business (open or not) pushes a `WeekAcct` for the week just ended (`wk = Math.round(w.now / WEEK)`, `close = b.cash`), keeps 8, then drops txns older than one week. |
| `bizWeek(w, b, wk)` | `BizWeek` | The struck row for `wk`, or a recomputation from txns. |
| `trade(w, b, n = 4)` | `{ revenue; profit; weeks }` | Average over the last `n` struck weeks that had activity. Used by goals.ts pricing and ui/views_a. |
| `slump(w, b)` | `number` | Last struck revenue divided by `b.income` (1 = normal). |
| `ledgerCheck(w)` | `string[]` (max 20) | Replays `w.txns` per business: each `bal` must equal the previous `bal + d`, and the last `bal` must equal `b.cash`. |
| `operatorOf(w, b)` | `Character \| undefined` | Live manager, else owner. |
| `mgmtQuality(w, b)` | `number` 0..1 | `brains*0.5 + caution*0.25 + (1-vice)*0.25`, halved if jailed, x0.75 if hurt; 0.3 with no live operator. |
| `rivalsOf(w, b)` | `number` | Open businesses of the same kind in the same district. |
| `interface Perf { mult; mgmt; demand; rivals; invest; trouble; notes }` | | |
| `perf(w, b)` | `Perf` | `mult = mgmt (0.94..1.06) x demand (0.97..1.03, fixed per district by hash) x rivals (1 - 0.04*(rv - rivals0), clamped 0.9..1.06) x (1 + invest) x trouble (1 - 0.012*max(0, tr - 3), clamped 0.93..1) x 0.95 if an open/violated dispute is about it`. Each factor centred on 1. `notes` are the visible reasons. |
| `owedOf(b)` | `number` | `protection.owed ?? 0`. |
| `feeDue(b)` | `number` | Fee plus owed. Unused. |
| `creditCollector(w, b, col, pay)` | `void` | Pays the collector for what was actually handed over: `earn(col, pay, 'protection')`, then 22% upkeep is deducted (destroyed, added to `books.expenses`), and if a settled dispute gives a third party a cut of this business, that cut is moved to him. Updates `protection.total`, `since`. |
| `takeFromBiz(w, b, want, who?, pocket = false)` | `number` | Takes from the till first (`'protection'` txn), then, if `pocket`, from the owner's own cash. Reduces `owed`, clearing `late`/`why`/`owed` when it reaches 0. The caller credits whoever receives the money. Used by encounters, dialogue, orders. |
| `giveTime(b)` | `void` | Keeps `owed`, clears `late` and `why`. |
| `clearArrears(b)` | `void` | Clears `late`, `owed`, `why`. |
| `businessWeek(w)` | `void` | Weekly accounts for every open business, then `strikeAccounts`. Uses rng. See below. |
| `stakesOf(w, holder)` | `{ b; s }[]` | All stakes a man holds. |
| `addStake(w, b, holder, share, how)` | `Stake` | Adds a stake, or tops up an existing one to at most 0.6. Does not move money. |
| `transferBusiness(w, b, to, how, text?)` | `boolean` | Appends to `b.owners`, sets `ownerId`, drops the new owner's stake/management/collection, resets `distress`, invalidates the owner cache (`ownersChanged`), adds an `ownership` fact. False if the heir is dead or is already the owner. Cash, books, txns stay with the business. |
| `succeedOwner(w, b, dead)` | `boolean` | On the owner's death, a live, free, non-player manager inherits; otherwise false (core.handleDeath then closes it). |
| `seizeShare(w, d)` | `void` | On default, the creditor takes a 15% stake (`how: 'debt:<id>'`) in the debtor's first open business, plus an `ownership` fact. |
| `setCollector(w, b, collectorId, familyId, o = { fee?, keepOwed? })` | `void` | Replaces the protection arrangement; keeps the fee unless given; carries `owed`/`late`/`why` only with `keepOwed`. Refuses if the collector is the owner. |
| `evidence(w, b)` | `string[]` | What a visitor can see (damage, empty or busy, behind with suppliers, money in the till, recently done up, trouble on the street). Used by dialogue, encounters, situ. |
| `describeOwnership(w, b)` | `string[]` | Owner, previous owners, manager, stakes. Unused. |
| `economyIssues(w)` | `string[]` | `ledgerCheck` plus structural rules (see Invariants). Called by `consistency.audit()`. |

Internal: `payProtection`, `appointManager`, `payStake`, `districtTrouble`, `hash`, `TROUBLE`.

**`businessWeek` in order**, per open business ([econ.ts:277](../../src/econ.ts)):
1. Owner dead or missing: close it (no fact) and skip.
2. Initialise `rivals0` if absent.
3. If no manager and not a casino: appoint one if the owner is jailed for more than 14 more days, or with 1% chance when cash > 900, no distress and fewer than a quarter of businesses are managed. A dead manager is removed.
4. Revenue: `income x U(0.82, 1.2) x (0.4 if damaged) x perf.mult` (`'revenue'`); `damaged` decrements.
5. Expense: `-expense` (`'expense'`).
6. Protection, if `fee > 0`: `payProtection` with a live collector, otherwise the arrangement is deleted.
7. Stakes: each live holder gets `min(cash, income x share x 0.8)` (`'stake'`, `earn(h, pay, 'business')`); a stake bought with a debt pays that debt down and is removed when it clears.
8. If cash is negative, the owner injects up to `cash - 100` of his own (`'inject'`).
9. `distress` +1 if still negative, else -1 (min 0).
10. Reinvestment: if cash > 600, no distress, owner ambition > 0.45 and `invest < 0.7 x INVEST_CAP`, spend `min(120, 40% of (cash - 450))` if at least 40 (`'invest'`, money destroyed); `invest += spend / max(200, income x 6)`, capped. `invest` then decays by 0.003 a week.
11. Draw: everything above $300 goes to the owner (`'draw'`, `o.cash += draw` directly, not through `earn`).
12. `distress >= 5`: closed, owner's wage raised to at least 90, `business_failed` fact.

`payProtection` decides between paying, being unable and delaying: `due = fee + owed`, `able = max(0, cash)`. A delay is only possible when `able >= fee`, and happens if the arrangement is on hold (`protection.hold > now`) or with probability `clamp(0.02 + greed*0.05 + grudge*0.1 + 0.08 if contested + 0.04 if damaged - fear*0.08, 0.005, 0.25)`, where fear is the collector's violence x 0.5 plus 0.1 if his boss is a family boss. What is unpaid becomes `owed` (capped at 8 x fee). A missed week (paid less than the fee) increments `late`, records `why` (`'unable'` or `'delayed'`) and adds a `protection_late` fact witnessed by the collector. Only the simulation knows `why`; other code is expected to use `evidence()`.

**Tick hooks.** Weekly: `businessWeek` from `engine.ts weekly()` ([engine.ts:117](../../src/engine.ts)), after the random robbery pass and before the debt loop; `seizeShare` from the debt loop. `economyIssues`/`ledgerCheck` run only via `consistency.audit()` and tests (audit is not called during play; `reconcile` does not call it). Everything else is called on demand from simulation modules and the UI.

**Depends on / used by.** Imports [core.ts](../../src/core.ts) (`addFact`, `clamp`, `earn`, `money`, `ownersChanged`, `rel`), [world.ts](../../src/world.ts) (`spawnCivilian`), types. Used by: core (`bizMove`, `succeedOwner`), engine (`addStake`, `bizMove`, `businessWeek`, `seizeShare`), actions (`bizMove`, `setCollector`), blackjack (`bizMove`), books (`setCollector`), consistency (`economyIssues`), dialogue (`bizMove`, `clearArrears`, `evidence`, `giveTime`, `owedOf`, `setCollector`, `takeFromBiz`), encounters (`bizMove`, `clearArrears`, `evidence`, `giveTime`, `owedOf`, `takeFromBiz`), gigs (`bizMove`), goals (`INVEST_CAP`, `addStake`, `bizMove`, `transferBusiness`, `trade`), jobs (`bizMove`), orders (`clearArrears`, `owedOf`, `takeFromBiz`), path (`bizMove`), powers2 (`addStake`, `bizMove`, `stakesOf`), pulse (`clearArrears`, `setCollector`), revenge (`bizMove`), situ (`addStake`, `clearArrears`, `evidence`, `giveTime`, `seizeShare`, `transferBusiness`), situations (`bizMove`), specs (`stakesOf`), ui/views_a (`owedOf`, `perf`, `trade`), ui/views_b (`owedOf`, `stakesOf`); tests v73, v74, v75.

**Invariants & rules.**
- Only `bizMove` changes `Business.cash`. Enforced by the `readonly` type and by a v73 test that scans `src/*.ts` (not `src/ui`) for direct `biz.cash =`/`b.cash +=` patterns ([tests/v73.test.ts:52](../../src/tests/v73.test.ts); disputes.ts is excluded because its `b` is a character).
- Per business, txns chain: `bal[i] = bal[i-1] + d[i]`, and the last `bal` equals `cash`.
- Merging only ever extends the business's latest txn. The tail cache is rebuilt from `w.txns` the first time a World object is used, so a loaded save merges exactly as one that never stopped (tested: [tests/v73.test.ts:310](../../src/tests/v73.test.ts)).
- `economyIssues` rules: an open business has a live owner; the owner is not its protector (casinos exempt: they are "protected" by their owning capo at fee 0); the manager is not the owner; stake holders exist and are not the owner; other people's shares total at most 90%; an open protected business is not protected by a dead man; `owed >= 0`; `late > 0` implies `owed > 0`.
- `protection.owed` is capped at 8 x fee by `payProtection` (the excess is silently forgiven).
- The performance factors are centred on 1 so the overall price level does not drift (tested: mean multiplier 0.96..1.04).
- Determinism: randomness through `w.rng`; the demand factor is a fixed hash of the district name.

**Save compatibility notes.** `w.txns` is guaranteed by `world.ensureShape`. `acct`, `rivals0`, `invest`, `managerId`, `stakes`, `owners`, `protection.owed/why/hold/total/since` are optional and appear as the world runs. The schema-4 migration in `engine.deserialize` ([engine.ts:255](../../src/engine.ts)) moves the pre-V73 `path.stakes` onto the businesses as `Stake`s and converts `protection.late` (weeks) into `owed = min(fee x late, fee x 8)` with `why: 'unable'`. Txns are bounded (one week, 3000 hard cap), accounts 8 weeks.

**Known issues / gaps.**
- `troubleCache` is a determinism hazard. The per-district trouble count is built by the first `perf()`/`evidence()` call in a calendar week, from the facts that exist at that moment, and then reused all week. The weekly run fires at Sunday 20:00 ([world.ts:278](../../src/world.ts)), i.e. inside the week it is closing, so `businessWeek` usually uses a cache built days earlier. `perf()` is also called by a UI view ([ui/views_a.ts:298](../../src/ui/views_a.ts)) and `evidence()` by dialogue, so whether and when the player looked at a business can change the revenue the simulation computes, and a reloaded save rebuilds the cache from later facts. The v73 round-trip test passes, but it does not exercise UI calls.
- The owner's draw is paid with `o.cash += draw`, not `earn()`, so it never reaches `books.gross` and is never declared or kicked up (relevant for the capos who own the casinos).
- `appointManager` creates a new civilian with $90, which is created money.
- `bizMove` allows a negative balance. Blackjack and dice payouts, fixed `'damage'` charges (actions.ts, revenge.ts) and `payDebt` called without an affordability check can push a till below zero (`jobs.paid` and `takeFromBiz` cap at the till); recovery is the owner's injection, then `distress`, then closure after five weeks.
- After the weekly draw every open business holds at most $300 plus whatever comes in before the next run, so anything that pays out of a till between weekly runs (gig fees via `jobs.paid`, debts via `payDebt`, casino winnings) has little to draw on.
- `ledgerCheck` cannot see a direct edit to a business with no txns in the retained window, and opening balances (world generation, and `addShops` at $300) are set directly without a txn; the chain starts at a business's first retained txn.
- `bizMove` only proves the business side. The counterparty is moved separately by each caller (for example `o.cash += draw`), so it does not on its own guarantee conservation.
- `payStake` can clear a stake-backed debt to `'paid'` without calling `core.onDebtCleared`, without a `debt_paid` fact and without a ledger `repay` entry, unlike `payDebt`.
- `strikeAccounts` uses `Math.round(w.now / WEEK)` for `WeekAcct.wk` (the next week number, since the run is at Sunday 20:00), while `books.history[].week` and ledger `wk` use `Math.floor`. The two week numbers are off by one.
- `Business.protection` is also created or replaced directly in other modules (actions, dialogue, jobs, situ, pulse and others), so `setCollector` is not the only door for protection.
- The dispute cut and the 22% upkeep in `creditCollector` are recorded only in `books.expenses`.
- `feeDue` and `describeOwnership` are unused; `operatorOf`, `rivalsOf` and `pruneTxns` are exported but only used internally; `trade` and `slump` take an unused `w` (`void w`).

---

## books.ts

**Purpose.** Each character's financial record and the weekly kick-up. Every dollar earned through `core.earn()` is recorded against a source in `c.books.gross`. Once a week, bottom-up through each family, every member declares what he made and passes a share (`kickRate`, plus any family levy) to his superior. NPCs may hide income their superior cannot see, skim visible income, delay or refuse; the superior compares what he received with what he can see (`expected`), and may warn, demand, discipline or ease the load. The player is never charged automatically: his share goes into `arrears` and he hands the envelope over in person on Sunday. The module also has the player's tools (`handOver`, `auditMember`, `checkBooks`, `rule`, `setStance`), rate negotiations (`askRate`), and `influence()`, a social standing metric that lives here for historical reasons.

**State owned.**
- `Character.books: Books` (main writer). `gross` (written by `core.record`, read and reset here weekly), `expenses` (written by engine, hustle, people, econ and others, reset here weekly), `received`, `arrears` (capped at 2500 at settlement; also written by club.ts, meetings.ts, powers2.ts, situ.ts, web.ts), `missed`, `honest`, `skim`, `hide`, `history` (max 8 `WeekBook` rows), `flags` (discrepancies a superior has noticed about each subordinate), `stance`, `prepaid`, `side`, `sideKnown`.
- `Character.kickRate` (also written by path.ts, people.ts, jobs.ts, meetings.ts, goals.ts), `weekIncome` (reset weekly), `lifetimeKick`, `lifetimeGross` (when the player is the receiving boss).
- `Family.levy` (created with 4% weekly chance, expires after four weeks).
- `cooldown` keys: `handed`, `rate:ask`, `summons:accounts`, `forbear`; reads `friction`.
- Relationship values (trust, respect, grudge, affection) between men and their superiors.
- Facts: `levy`, `shortfall`, `discipline`, `terms`, `side_operation`. Jobs: a `summons` with `meeting: 'accounts'` (via `jobs.mkJob`).
- Module-level `medians: Map<string, number>` cache for `influence()`, keyed by `${w.seed}:${day}`, cleared when over 20 entries.

**Public API.**

| export | returns | notes |
|---|---|---|
| `emptyBooks()` | `Books` | Fresh record. Used by world.ts and `engine.deserialize`. |
| `BASE_RATE: Record<Rank, number>` | | Default share: associate/soldier/capo 0.2, underboss 0.1, civilian/boss 0. |
| `SOURCE_LABEL` | `Record<string, string>` | Display names of income sources. |
| `visibleSources(c, s)` | `string[]` | Sources with value > 0 that a superior can see (visibility >= 0.5). |
| `effectiveRate(w, c)` | `number` | `kickRate` plus an active family levy. |
| `subordinates(w, c)` | `Character[]` | Live men whose `bossId` is `c` and who share his family. |
| `kickWindow(w, p)` | `boolean` | True within two days of `w.sunday.t` if not already handed this Sunday. |
| `envelopeSum(w, p)` | `{ own; crew; rate; weekDue; overdue; due }` | The envelope sum from the latest statement. |
| `envelopeText(w, p)` | `string` | The sum said out loud (one fixed template). |
| `envelopeDue(w, p)` | `number` | `max(0, arrears)` if his boss is alive, else 0. |
| `handOver(w, p, boss, amt)` | `string[]` | Player hands cash to his boss: caps at cash, sets `cooldown.handed`, posts a `kickup` (week of the Sunday), updates the history row, moves `p.cash` to `boss.cash`, credits `boss.books.received/gross.kickups/weekIncome`, `p.lifetimeKick`, `p.books.prepaid`, raises trust and respect, reduces `arrears`. |
| `settleWeek(w)` | `void` | The weekly settlement. Uses rng. See below. |
| `visibleSlump(c)` | `number` | This week's visible income against the average of up to 8 past weeks (1 if fewer than 3 or a small average). |
| `settleOne(w, c)` | `void` | One man's settlement (exported for tests). |
| `askRate(w, c, boss, byPlayer = false)` | `{ outcome: 'agree' \| 'counter' \| 'refuse'; lines }` | Ask for a smaller share. Score from trust, the boss's greed, a steady record, a visible slump, a levy and the boss's own cash. Agree -0.03, counter -0.015, floor `max(0.05, base - 0.1)`. One `rng.next()`. Lines only when `byPlayer`. |
| `react(w, boss, c, fl, cause)` | `void` | An NPC superior's escalation on a flag: warn (n <= 1), demand the amount into `arrears` (n == 2), then `discipline` and reset the flag. |
| `discipline(w, boss, c, cause, amt)` | `void` | A violent boss (> 0.55) has him beaten (`hurtUntil` +3 days, boss heat); otherwise takes one of his protected shops (`setCollector`, keeping arrears); otherwise adds `amt` to arrears and raises his rate by 0.05 (max 0.3). Facts broadcast to the boss's men. |
| `influence(w, c)` | `number` 0..100 | Rank, support from trusting men, access to respected superiors, holdings, wealth and standing, normalised against the median of all family men. |
| `influenceWord(n)` | `string` | Label for an influence value. |
| `setStance(c, s: 'honest' \| 'shave' \| 'stall')` | `void` | The player's policy toward his own boss. |
| `auditMember(w, p, sub)` | `{ minutes; lines }` | Go through a man's books (moves `p.district`). May fail and cost trust. Shows only visible income over 4 weeks, flags the gap, discovers a side operation. Uses rng. |
| `RULINGS` | `{ code; label; hint }[]` | The player's options on a flagged man. |
| `rule(w, p, sub, code)` | `{ minutes; lines }` | Apply a ruling: `warn`, `demand` (flag amount into arrears), `beat` (calls `actions.perform` with a retaliation), `raise` (+0.05, max 0.35), `lower` (-0.05, min 0.05), `forgive`. Adds a `discipline` fact. |
| `checkBooks(w, p, sub)` | `string[]` | The quick Sunday look at a man's statement, which may fail. Uses rng. |

Internal: `VIS` (visibility per source), `WEIGHT` (`loans: 0.3`), `LIVING`, `wt`, `reckoned`, `seen`, `pushHistory`, `rateTalks`, `summonPlayer`, `discoverSide`, `rawInfluence`, `medianRaw`, `RW`, `PROBLEM_WORD`, `DAYS`.

**Weekly settlement in detail** ([books.ts:99](../../src/books.ts)).
1. Levy: each family with a live boss and no levy has a 4% chance of a 7% levy for four weeks (broadcast `levy` fact).
2. Squeeze: a greedy (> 0.7) NPC soldier, capo or underboss short of cash (< 3 x living) has a 12% chance to raise subordinates' rates by 0.05 (max 0.3); a flush one eases them back by 0.01 a week toward base.
3. Side operations: ambitious (>= 0.7) NPC soldiers and capos start one with 3% chance ($150-400 a week); every live man with one gets it each week (`c.cash += side`, `gross.side`). This is created money.
4. Settlement order: every live family member sorted by height in the chain (bottom first, depth guard 8), so kick-ups received this week are in the receiver's gross when he settles.
5. `settleOne` for each:
   - No live boss in the same family: push an empty history row and stop (nothing is paid or posted).
   - Decisions that last 2-6 weeks rather than being rolled weekly: `hide` (do not mention sources the boss cannot see) and `skim` (keep 20-50% of visible sources), driven by greed, trust, caution, money pressure, his `problem` and his `want`. NPCs may also refuse outright (low respect plus high ambition, or a resentment problem).
   - Declared income per source; the player declares 70% with stance `shave`.
   - `due`: NPC `declared x rate`; player `((declared - declared kick-ups) + all crew kick-ups) x rate`.
   - NPC: `owed = due + arrears - prepaid`, pays `min(owed, cash - 40)` unless jailed, refusing or deliberately delaying (a rare choice under money pressure). Player: pays nothing; `owed = due + arrears` all goes to `arrears`.
   - `arrears = min(2500, owed - pay)`; payment moves cash to the boss and credits his `received`, `weekIncome`, `gross.kickups` (so kick-ups are taxed again at the next level up).
   - `expected` = visible income x rate. `tone` records the true reason (`paid`, `downturn`, `unable`, `delayed`, `underreported`, `withheld`, `jailed`).
   - Ledger: one `earn` per source (weighted), `expect`, `owe`/`week`, `owe`/`carry`, and the `kickup`. Then a history row.
   - Missed (NPC paid less than owed; player carried arrears): `shortfall` fact, trust loss (small if the boss can see trade collapsed). A trusting boss who sees a collapse eases the load after 3 missed weeks (halves arrears, lowers the rate, `forbear` cooldown 8 weeks). Otherwise discipline every 3 (or 5, if trusted) missed weeks. The player loses standing after 2 missed weeks and is summoned.
   - Concealment: if `expected - due > max(40, 15%)`, the boss may notice (probability from his caution and the gap size), adding to `flags`; the player is summoned, an NPC goes through `situ.skimNoticed` or `react`.
   - Honest weeks build `honest`; the player gains 1 standing every 4.
   - A rate above 25% costs trust and respect; a rate below base gains trust.
   - 6% x (caution + 0.5) chance the boss discovers a side operation.
6. `rateTalks`: NPCs with a steady record ask their NPC boss for a lower share (about 1-2% a week, 8-week cooldown).
7. Reset `gross`, `expenses`, `received`, `weekIncome` for every character, alive or not.

**Tick hooks.** Weekly: `settleWeek` from `engine.ts weekly()` ([engine.ts:207](../../src/engine.ts)), after wages, living costs, obligations and `peopleWeek`, and before `careerTick`. UI and player actions: `handOver` (web.ts Sunday page, dialogue `b_envelope`), `checkBooks`, `rule`, `auditMember`, `setStance` (web.ts, bot.ts), `askRate` (dialogue), `envelopeSum`/`envelopeText`/`envelopeDue`/`kickWindow` (dialogue, ui/sunday.ts), `react` (dialogue, meetings), `discipline` (situ), `influence` (career, meetings, situ, ui/common, ui/views_b).

**Depends on / used by.** Imports [situ.ts](../../src/situ.ts) (`skimNoticed`), [voicesheet.ts](../../src/voicesheet.ts) (`say`), econ (`setCollector`), [actions.ts](../../src/actions.ts) (`perform`), core (`addFact`, `clamp`, `money`, `rel`, `travelTime`), [jobs.ts](../../src/jobs.ts) (`mkJob`), ledger (`post`, `refreshHistory`, `statement`, `wkOf`), types. Used by engine (`BASE_RATE`, `emptyBooks`, `settleWeek`), world (`BASE_RATE`, `emptyBooks`), career (`influence`), dialogue (`react`, `envelopeDue`, `handOver`, `kickWindow`, `envelopeText`, `askRate`), bot (`RULINGS`, `auditMember`, `influence`, `rule`, `setStance`), meetings (`RULINGS`, `effectiveRate`, `influence`, `react`, `rule`, `subordinates`), situ (`discipline`, `influence`), web (`auditMember`, `checkBooks`, `envelopeSum`, `handOver`, `rule`, `setStance`), ui/views_a, ui/views_b, ui/views_c, ui/common, ui/sunday; tests v73, v77.

**Invariants & rules.**
- Settlement among NPCs only moves money between men: total character cash is unchanged by `settleWeek` when side operations are switched off (tested: [tests/v73.test.ts:199](../../src/tests/v73.test.ts)).
- The player is never charged without his say (tested).
- Settlement is bottom-up so the same week's kick-ups are counted once at each level.
- `arrears <= 2500` after settlement; `history.length <= 8`.
- Rate bounds: `askRate` floor `max(0.05, base - 0.1)`; `rule` 0.05..0.35; squeeze and discipline cap 0.3.
- Knowledge: a superior judges only `expected`, built from sources he can see; `tone` and `why` are simulation truth that is never shown as such, and a man short through a visible downturn is treated differently from one who is skimming (tested across seeds).

**Save compatibility notes.** `engine.deserialize` fills `c.books` with `emptyBooks()` and `c.kickRate` with `BASE_RATE[rank]` when missing. `skim`, `hide`, `stance`, `prepaid`, `side`, `sideKnown`, `WeekBook.own/crewGross/tone/why/cause` and `Family.levy` are optional. History is bounded at 8 rows.

**Known issues / gaps.**
- `prepaid` is effectively dead. Only `handOver` sets it, `handOver` is only called for the player, and the player branch of `settleOne` ignores `prepaid` and zeroes it.
- `discipline`'s third branch says the boss "doubled his debt" but adds `amt` (the due, capped at 300, or the flag amount) to arrears.
- `LIVING` is duplicated from [engine.ts:89](../../src/engine.ts) (people.ts has a third, different table).
- Side income is created money and is added to `gross.side` directly, not through `earn`.
- `influence()` caches its median in a module-level map keyed by seed and day, not by World. Two worlds with the same seed in one process (a reload of an earlier save, tests, the bot) can share a median computed from a different state.
- A man whose boss is missing, dead or in another family pays nothing and posts nothing.
- `SOURCE_LABEL` and `VIS` lack the racket sources `shylock`, `cigarettes`, `nightclub`, `carting`, `construction`, `trucking`; visibility defaults to 0.5 (visible) and labels fall back to the raw key where `?? s` is used.
- `WEIGHT.loans = 0.3` treats 70% of loan income as returned principal. The `loans` hustle already computes interest only, so its income is discounted twice.
- The CLAUDE.md item "flat weekly-envelope prompt" is `envelopeText`, which is a single fixed template.
- books.ts imports actions.ts (for `rule('beat')`) and jobs.ts (for summons), which ties the record-keeping module to two of the largest modules and to import cycles.

---

## rackets.ts

**Purpose.** Standing operations the player can start and run (12 kinds, `OPS`) plus one-off hijacks. Each kind has a start-up cost, a base weekly take, a raid risk, weekly heat, a minimum rank, sometimes allowed districts, and a skill that sets the runner's aptitude. Every week the take arrives through the player's books (so what his superior can see is a consequence), a runner may skim, the police may raid, and a rival family may ask for a weekly gesture.

**State owned.**
- `World.ops: Op[]`. Created only here (`startOp`, `hijack`); never pruned (closed and done ops stay).
- `Op.state`, `last`, `total`, `skimmed`, `weeks`, `runner`, `until`.
- Cash of the owner, runner and hijack crew; `heat`; `jailedUntil`.
- Facts `raid`, `report`, `theft`, `arrest`; a `squeeze` encounter (`encounters.addEnc`).

**Public API.**

| export | returns | notes |
|---|---|---|
| `interface OpDef { label; group; cost; base; risk; heat; rank; districts?; blurb; skill }` | | |
| `OPS: Record<Exclude<OpKind, 'hijack'>, OpDef>` | | numbers, bookie, vending, dock, union, shylock, cigarettes, nightclub, carting, construction, trucking, front. |
| `OP_GROUPS` | `readonly string[]` | Betting, Street trades, Waterfront and unions, Fronts. |
| `canStart(w, p, kind, district)` | `string \| null` | Reason it cannot start: rank, district, cash, duplicate, family ground and the capo's trust for made-men rackets. |
| `startOp(w, p, kind, district, runner)` | `string[]` | Deducts the cost from `p.cash` (destroyed, not recorded), pushes the op; dock or union earns the capo's respect. |
| `hijack(w, p, crew: Id[])` | `string[]` | Needs two free men; creates an op in state `out` due in two days. Cargo text picked with `voice.pick` from a string seed, not rng. |
| `closeOp(w, op)` | `string[]` | State `closed`. No refund. |
| `countOp(w, p, op)` | `{ lines; found }` | Reveals and resets `op.skimmed`. |
| `opRule(w, p, op, code, found)` | `string[]` | `repay` (runner hands back up to his cash), `fire` (runner removed, grudge), otherwise a warning. |
| `opsDaily(w)` | `void` | Resolves due hijacks; lifts raids whose `until` has passed. |
| `opsWeek(w)` | `void` | The weekly take. Uses rng. |

Internal: `resolveHijack` (success `clamp(0.3 + strength*0.55, 0.2, 0.85)`: gross $1,800-3,800 scaled by crew aptitude, 12% to each man, the rest to the owner as `hijack` income, heat, 30% chance of a hidden-actor `theft` fact; a dud pays 20%; failure jails each man with 50% chance), `gross0`, `PL`.

**Weekly take** ([rackets.ts:158](../../src/rackets.ts)): `base x (0.55 + aptitude x 0.9) x U(0.8, 1.25)`; x1.12 with the player's earner perk; a bookie has an 18% chance of losing $150-500; a front pays `base x U(0.8, 1.2)` regardless of aptitude and lowers heat; x0.7 outside the family's districts; a jailed runner leaves only 30% of last week. Raid chance `risk + owner.heat x 0.06`: raided for 2-4 weeks, a $150-450 fine (floored at zero cash), 60% chance the runner is jailed. A runner who is tempted (problem severity > 0.35, or archetype schemer or bitter) skims 8-30% with probability `0.35 - loyalty x 0.2`. Net income goes to `earn(owner, net, op.kind)`; a loss is `owner.cash += net` with no floor.

**Tick hooks.** Daily `opsDaily` (engine daily list). Weekly `opsWeek` from `advance()` after `weekly()`, `sweep`, `repairAll` and `ventureWeek` ([engine.ts:49](../../src/engine.ts)); racket income therefore lands in `books.gross` after that week's settlement and counts toward the following week's envelope. Player actions through web.ts (`startOp`, `countOp`, `opRule`, `closeOp`, `hijack`); ui/views_b and ui/views_c read `OPS`/`OP_GROUPS`/`canStart`; ways.ts reads `OPS`; stress.ts drives `startOp`.

**Depends on / used by.** Imports specs (`hasPerk`), [people.ts](../../src/people.ts) (`aptitude`, `grow`), core (`addFact`, `clamp`, `earn`, `handleDeath` (unused), `money`, `newId`, `rel`), [encounters.ts](../../src/encounters.ts) (`addEnc`), [voice.ts](../../src/voice.ts) (`arch`, `pick`), types. Used by engine, web, ui/views_b, ui/views_c, ways, stress, tests v72.

**Invariants & rules.** Ops of a dead owner close; a dead runner is removed. Ops are only processed when a player exists (`if (!p) return`). Operations are only created by the player, so all `OPS` income is player income in practice, though the code is written per owner. Randomness through `w.rng`, except the hijack cargo text (deterministic string hash).

**Save compatibility notes.** `w.ops` is guaranteed by `ensureShape`. `Op.until`, `crew`, `due`, `note` are optional.

**Known issues / gaps.**
- Start-up costs, raid fines and bookie losses are unrecorded sinks; nothing is posted to the ledger.
- A runner's skim and hijack crew cuts are paid straight into cash, not through `earn`, so they never appear in those men's books or envelopes.
- A bookie loss can push the owner's cash negative.
- `w.ops` grows without bound (closed and done ops are never removed); small in practice because only the player creates ops.
- `void handleDeath` is a leftover import.
- `hijack` is an `OpKind` but not in `OPS`, so several places cast (`op.kind as Exclude<OpKind, 'hijack'>`).
- Six racket sources are missing from books.ts `VIS`/`SOURCE_LABEL` (see books.ts).

---

## hustle.ts

**Purpose.** NPC associates and soldiers each run their own line of work (8 kinds in `HUSTLES`), chosen by expected net income given their skills, what they can afford, how crowded the district is, their heat and caution, and temperament. Every week it pays (into the books, so it feeds the envelope), costs money, sometimes goes wrong, and occasionally gets a man arrested. An ambitious man with spare cash grows it; if his boss is the player and the player asked to be consulted, he asks first.

**State owned.**
- `Character.hustle?: Hustle` (main writer; path.ts changes `level`/`stake`, meetings.ts sets `lull`, `reports.investChoose` sets `level`/`stake`/`bad`).
- `Character.cash`, `books.expenses`, `heat`, `jailedUntil`; career log (`recordCareer`); `arrest` facts.

**Public API.**

| export | returns | notes |
|---|---|---|
| `HUSTLES: Record<HustleKind, Def>` | | numbers, bookie, loans, cars, fence, vending, shakedown, odd. `Def` (not exported): label, base, cost fraction, skill(s), risk, stake, swing, income source, bad/good causes. |
| `hustleWeek(w)` | `void` | The weekly pass. Uses rng. |
| `hustleLine(c)` | `string \| undefined` | One-line description. |
| `money` | | Re-export of `core.money`. |

Internal: `sk`, `crowd`, `netExpected`, `choose`.

**Weekly pass** ([hustle.ts:50](../../src/hustle.ts)), for live non-player family associates and soldiers who are not jailed or lying low (`lull`): create a hustle if none; switch after 3 bad weeks or with 2% chance at level 1 (lifetime `total` kept, `stake` lost); expand (level < 3, cash > 1200 x level + stake, ambition > 0.45, no bad run, 7%) by spending 600 x level, or ask the player via `reports.askToInvest` when the player is the boss and `w.expect.invest` is `'ask'` (the default). Gross: `base x (0.7 + skill x 1.3) x (1 + (level-1) x 0.55) x swing`, or for `loans` `min(cash x 0.6, 1200 x level) x 0.4`; then competition, x1.3 for soldiers, the family directive (push x1.25, quiet x0.85) and x1.1 if the player is the boss and has an HQ. A bad week (12% + swing + heat) cuts gross to 15-55%; a bookie has a 12% chance of a $100-400 loss. Costs are `gross x cost + 20 x level` above level 1. Net (floored at `-cash`) goes through `earn(c, net, src)` or is subtracted. Street risk adds heat and can jail him for 2-9 days.

**Tick hooks.** Weekly: `hustleWeek` from `engine.ts weekly()` ([engine.ts:153](../../src/engine.ts)), after the debt loop and before `settleWeek`, so hustle income is in the same week's envelope.

**Depends on / used by.** Imports core (`addFact`, `clamp`, `earn`, `money`, `recordCareer`), [reports.ts](../../src/reports.ts) (`askToInvest`), types. Used by engine (`hustleWeek`), dialogue (`hustleLine`, reads `c.hustle`), meetings (`HUSTLES`), ui/views_a (`hustleLine`). `c.hustle` is also read by gigs (courier offers), jobs (`lull`), path, clubdata and flows.

**Invariants & rules.** Only non-player family associates and soldiers hustle; capos and the player never do. `level` stays within 1..3. A hustle loss cannot take cash below zero. All randomness through `w.rng` (including `choose`).

**Save compatibility notes.** `c.hustle` is optional and created lazily; `lull` and `cause` are optional.

**Known issues / gaps.**
- The `loans` hustle is notional: no `Debt` records exist behind it and its income is derived from the man's own cash. `shakedown` is notional too (income source `protection`, but no `Business.protection` records).
- Expansion money (600 x level) is destroyed, and the `stake` is simply reset when he switches hustle.
- `askToInvest` can be re-attempted every week at 7%; it is only deduplicated while an earlier encounter is still open.
- Hustle sources carry books visibility: `boost` (cars) and `scam` (fence) are 0.15 (hidden, so skimmable unseen); `loans` gets the 0.3 weight on top of an already interest-only figure.

---

## gigs.ts

**Purpose.** Opportunities that turn up because of what is going on, offered to the player as `Job`s of kind `gig`: stand behind a creditor (`muscle`), hit or protect a delivery to a real shop (`shipment`, `escort`), carry a bookie's bag (`courier`), or deal with an inspector (`inspector`). Each is tied to real characters and businesses; the outcome changes relationships, favours, heat and facts. Offers and resolution go through jobs.ts.

**State owned.**
- `Job` records with `kind: 'gig'`, `via` `'opportunity'` or `'tip'`, and `extra.gig` plus `owed`/`value`/`bag`/`amt` (created via `jobs.mkJob`).
- Cash of the giver, target, doer and player; relationship values; `b.distress`; favours (`encounters.addFavour`); facts `beating`, `robbery`, `report`, `theft`; heat (`jobs.bump`), jail (`jobs.jail`), `doer.district`, `hurtUntil`, player standing.

**Public API.**

| export | returns | notes |
|---|---|---|
| `type GigKind = 'muscle' \| 'shipment' \| 'escort' \| 'courier' \| 'inspector'` | | |
| `GIG_LABEL`, `GIG_HELP` | `Record<GigKind, string>` | UI text. |
| `isGig(j)` | `boolean` | Unused outside the file. |
| `gigOffer(w)` | `boolean` | Tries up to five generators in random order; true when one created a job. Uses rng. |
| `gigTick(w)` | `void` | If the player is alive and in a family and fewer than two gigs are on offer: chance 0.2 (0.32 with the operator perk) of `gigOffer`. |
| `gigApproaches(w, j)` | `Approach[]` | The choices per kind. |
| `gigResolve(w, j, doer, code)` | `Result` | Resolves the chosen approach. Uses rng. Moves money (see below). |
| `gigStale(w, j)` | `string \| null` | Why an offered gig no longer makes sense. |

Internal: the five generators, `deliveryShops`, `nearby`, `when`, `GOODS`.

Money in `gigResolve`: fees are paid through `jobs.paid(w, doer, amount, from?, src)`, which takes the fee from the giver's cash and then his business till (`'aid'` txn) and credits the player (or splits 35% `cut` to a crew doer and 65% `delegated` to the player). `muscle` also moves `min(owed, target.cash)` from the target to the giver. `shipment` hijack/skim calls `paid` with no payer (created money) and gives the tipster 10% from the player's cash. `courier` dip credits `earn(doer, dip, 'side')` (created; the bookie loses nothing). `inspector` bribe takes the amount from the player's cash (destroyed); a failed lean fines the shop up to $200 (`'fine'` txn).

**Tick hooks.** Daily: `gigTick` at the end of `jobs.daily` ([jobs.ts:847](../../src/jobs.ts)), which engine calls first in the daily list; `gigOffer` is also one of the offer types in `jobs.newOffer`. Player actions: `jobs.approaches` calls `gigApproaches`, `jobs.resolve` calls `gigResolve`, `jobs.staleReason` calls `gigStale`.

**Depends on / used by.** Imports specs (`hasPerk`), econ (`bizMove`), core (`addFact`, `clamp`, `earn`, `money`, `notifyProtector`, `ownerBiz` (unused, `void`), `rel`, `witnessesAt`), encounters (`addFavour`), jobs (`bump`, `jail`, `mkJob`, `paid`, `Approach`, `Result`), types. Used by jobs (all gig exports), ui/views_a (`GIG_LABEL`), ui/views_b (`GIG_HELP`, `GIG_LABEL`). jobs.ts and gigs.ts import each other.

**Invariants & rules.** Each generator refuses if a gig of its kind is already offered or active; `gigTick` stops once two gigs are on offer (the `jobs.newOffer` path does not check that limit). Facts follow the knowledge rules: hijacks and beatings are hidden-actor with sampled witnesses, and the protector is told (`notifyProtector`). Shipments are only offered against shops not protected by the player's family.

**Save compatibility notes.** Gigs are ordinary `Job`s; nothing gig-specific is stored outside `Job.extra`.

**Known issues / gaps.**
- A `muscle` gig built from a real debt moves money from debtor to creditor but never updates the `Debt` (no `payDebt`, `j.debt` not set), so the debt stays on the books at its full balance and the debtor effectively pays twice.
- The `muscle` settlement is credited with `giver.cash += settle`, not `earn`, and is not posted to the ledger.
- The inspector bribe and the tipster's cut use the player's cash even when a crew member is the doer.
- The failed-inspector text always says $200, though the fine is capped at the till.
- Gig income created from nothing (hijacked goods, the courier dip) has no counterparty, so robbing a shop's delivery does not affect that business's accounts.

---

## blackjack.ts

**Purpose.** Blackjack for the player at the family casinos. The table rules (stakes, decks, blackjack payout, soft-17 rule) come from four tiers assigned by the casino's position among open casinos sorted by id. Every hand uses a freshly shuffled shoe from `w.rng`, and wins and losses are settled against the casino's till through `bizMove('gamble')`.

**State owned.** `World.bj?: BJ` (the hand in progress, or the last hand). The player's cash; the casino's `Business.cash` via `bizMove`.

**Public API.**

| export | returns | notes |
|---|---|---|
| `interface TableRules { label; min; max; decks; bj; h17; note }` | | |
| `casinos(w)` | `Business[]` | Open casinos sorted by id. |
| `rulesFor(w, b)` | `TableRules` | Tier by index among open casinos. |
| `interface BJ { biz; bet; p; d; deck; done; msg; net; doubled? }` | | Cards are integers; rank `c % 13`, suit `floor(c / 13) % 4`. |
| `total(h)` | `{ n; soft }` | Hand value with aces. |
| `cardName(c)` | `string` | Display. |
| `deal(w, p, b, bet)` | `string[]` | Refuses if a hand is live, the bet is outside the table limits, or the player cannot cover it. Shuffles a new shoe with `w.rng`, takes the bet from `p.cash`, deals; settles at once on a natural. |
| `act(w, p, what: 'hit' \| 'stand' \| 'double')` | `string[]` | Double only on the first two cards and if he can cover it. |

Internal: `TIERS`, `val`, `natural`, `pay` (`p.cash += back; bizMove(b, -(back - bet), 'gamble')`), `finish` (dealer draws to 17, hitting soft 17 where the table does).

**Tick hooks.** None. UI only: [ui/blackjack.ts](../../src/ui/blackjack.ts) calls `casinos`, `rulesFor`, `deal`, `act`, `total`, `cardName`; web.ts charges 10 minutes for a deal (`bjbet`) and 5 for each hit, stand or double (`bjact`).

**Depends on / used by.** Imports core (`clamp`, `money`), econ (`bizMove`), types. Used by ui/blackjack.ts; types.ts imports the `BJ` type.

**Invariants & rules.** One hand at a time. The stake leaves the player's cash at `deal`/`double` and comes back (or not) at `finish`; the casino pays or takes only the difference, so a finished hand conserves money.

**Save compatibility notes.** `w.bj` is optional; a saved live hand resumes.

**Known issues / gaps.**
- While a hand is live the bet is in neither the player's cash nor the casino's till (a `moneyTotal` taken mid-hand is short by the bet). If the casino no longer exists when the player acts, `act` returns nothing and the bet is lost.
- Payouts can push the casino's till negative (it holds about $300 after the weekly draw; the high-limit table takes bets up to $3,000 and pays 3:2), leading to owner injections, distress and possibly closure.
- Closing one casino reassigns the other casinos' tiers.
- No split, insurance or surrender.
- Nothing is recorded beyond the txn: no fact, no ledger entry (`wager` is unused), no books entry (unlike the dice game in actions.ts, which records `gambling_loss` facts).
- `p.standing = clamp(p.standing, 0, 100)` in `finish` does nothing.
- The module checks no rank, district or opening hours; the UI decides where it is reachable.

---

## specs.ts

**Purpose.** The player's specialisation, read from what he has actually done: earner (rackets, shops, stakes, lifetime gross), operator (completed career entries, crew, deeds), negotiator (kept promises, close friends, standing) and enforcer (kills, muscle, nerve). Nothing is chosen or spent. Tier 2 or higher (score >= 45) unlocks a perk.

**State owned.** None. Pure functions.

**Public API.**

| export | returns | notes |
|---|---|---|
| `type Spec = 'earner' \| 'operator' \| 'negotiator' \| 'enforcer'` | | |
| `SPEC_LABEL`, `SPEC_PERK` | `Record<Spec, string>` | UI text. |
| `TIER_WORD` | `string[]` | Unproven, Known for it, Established, A master. |
| `specScores(w, p)` | `Record<Spec, number>` (0..100) | Recomputed on every call (loops over characters, businesses, ops). |
| `tierOf(score)` | `0..3` | Thresholds 20, 45, 75. |
| `specTier(w, p, s)` | `number` | |
| `hasPerk(w, p, s)` | `boolean` | `specTier >= 2`. |

Perk effects live in the callers: earner, racket take x1.12 ([rackets.ts:174](../../src/rackets.ts)); operator, gig offer chance 0.32 instead of 0.2 ([gigs.ts:44](../../src/gigs.ts)); negotiator, +0.15 in [powers2.ts:301](../../src/powers2.ts); enforcer, +0.12 in [pulse.ts:154](../../src/pulse.ts).

**Tick hooks.** None; evaluated on demand (daily in `gigTick`, weekly per op in `opsWeek`, and in UI views).

**Depends on / used by.** Imports econ (`stakesOf`), types. Used by rackets, gigs, pulse, powers2 (`hasPerk`) and ui/views_b (`SPEC_LABEL`, `SPEC_PERK`, `TIER_WORD`, `specScores`, `tierOf`, `Spec`).

**Invariants & rules.** Deterministic, no rng, no side effects.

**Save compatibility notes.** Nothing stored. Reads optional fields with defaults (`p.lifetimeGross ?? p.lifetimeKick`, `p.career?.done ?? 0`, `w.path?.deeds ?? 0`, `p.rep?.kept ?? 0`, `w.path?.kills ?? 0`).

**Known issues / gaps.** Reads state owned by other modules (`p.rep`, `p.career`, `w.path`, `lifetimeGross`). `specTier` is exported but only used inside the file. The cost of recomputing scores on every `hasPerk` call is small at the current world size.

---

## reports.ts

**Purpose.** What reaches the player and how loudly. `relevance()` grades a fact for the player (0 background, 1 relevant, 2 critical) with a plain-language reason; it is used to rank the news feed. `reportTick()` has each crew member decide, weekly, which recent facts he knows to bring to the player, depending on his reporting style (open, alarmist, solo, hider, cautious), trust and the player's stated expectations. It also holds the crew-investment request: `askToInvest()` (raised by `hustleWeek`) and `investChoose()` (the player's answer). Only the last two touch money, which is why the module sits in this group.

**State owned.**
- `World.expect?` (created with defaults by `expectOf`; meetings.ts also creates and sets it).
- The player's knowledge (`core.learn` with the crew member as source); `c.problem.revealed`; `report` facts; `invest` encounters; `c.hustle.level/stake/bad`; cash of the player and the crew member.

**Public API.**

| export | returns | notes |
|---|---|---|
| `type Style`, `STYLE_WORD` | | Unused outside the file. |
| `styleOf(c)` | `Style` | From traits and an unrevealed problem. Unused outside the file. |
| `expectOf(w)` | `{ report; trouble; invest }` | Lazily creates `w.expect` (`weekly`, `tell`, `ask`). Unused outside the file. |
| `type Level = 0 \| 1 \| 2`, `interface Rele { level; why }` | | |
| `relevance(w, p, f)` | `Rele` | Pure. Critical for hunts against the player and serious events involving him, his crew or his boss; relevant for his own reports, quarrels he is in, close friends, his shops, new unprotected businesses, poaching on family ground, debts he holds or owes, and serious events to men of rank in his family. |
| `levelOf(w, p, f)` | `Level` | Unused (sitmoves.ts has its own `levelOf`). |
| `reportTick(w)` | `void` | Weekly crew reports. Uses rng. |
| `askToInvest(w, c, cost, line)` | `void` | Opens an `invest` encounter (5 days) unless one from him is already open. |
| `investChoose(w, p, e, code)` | `string[]` | `no` (trust -0.02, resets `bad`), `yes` (he spends `min(cash, cost)`), `back` (player puts in half). Level +1 (max 3), `stake += cost`. |

**Tick hooks.** Weekly: `reportTick` from `engine.ts weekly()` ([engine.ts:157](../../src/engine.ts)), after `rankWeek` and before `situationTick`. `askToInvest` from `hustleWeek`; `investChoose` from encounters.ts when the player answers ([encounters.ts:584](../../src/encounters.ts)); `relevance` from web.ts (news feed) and club.ts.

**Depends on / used by.** Imports encounters (`addEnc`), core (`addFact`, `clamp`, `learn`, `money`, `rel`), types. Used by engine (`reportTick`), hustle (`askToInvest`), encounters (`investChoose`), club and web (`relevance`). encounters.ts and reports.ts import each other.

**Invariants & rules.** Knowledge rule: the player can only learn from a crew member a fact that the man knows (`c.known`), learned in the last seven days, that the player does not already know; `knowsActor` is passed through, so a hidden culprit stays hidden. Jailed crew do not report. Minor facts are only passed on by alarmists.

**Save compatibility notes.** `w.expect` is optional with defaults.

**Known issues / gaps.**
- `investChoose('back')` looks wrong: the player's half is given to the man and he then pays out half, so his own cash is unchanged and only the player's half is spent, while `stake` still grows by the full cost.
- `investChoose('yes')` takes `min(c.cash, cost)` but raises the level and the stake by the full cost whatever was actually paid.
- The player's contribution is not posted to the ledger, although it is a movement inside his circle (`stake` flow exists for this).
- The two age checks in `reportTick` (`w.now - k.t > 10 * DAY` and `k.t < w.now - 7 * DAY`) overlap; the effective window is seven days.
- `STYLE_WORD`, `styleOf`, `expectOf` and `levelOf` are exported but unused elsewhere; meetings.ts and hustle.ts read and write `w.expect` directly.

---

## Debts

Debts are not owned by any module in this group: the record type is `Debt` in [types.ts:244](../../src/types.ts), the helpers are in [core.ts](../../src/core.ts), and the weekly collection is inline in `engine.ts weekly()`. They are documented here because they move money and feed the ledger.

**Record.** `w.debts: Debt[]` holds `{ id, creditor, debtor, principal, balance, weeklyRate, weeklyPayment, nextDue, missed, status: 'active' | 'paid' | 'defaulted' | 'void', reason, cause?, paid? }`. The array is never pruned: paid, void and defaulted debts stay for the life of the save.

**`createDebt(w, creditor, debtor, principal, rate, reason, cause?): Debt`** ([core.ts:257](../../src/core.ts)). Pushes an active debt with `balance = principal`, `weeklyPayment = round(principal x 0.12 / 5) x 5`, `nextDue = now + 7 days`, and posts a ledger `loan` (kept only if a party is in the player's circle). It does not move any money: the caller must hand over the principal. Most callers do (`p.cash -= amt; c.cash += amt; createDebt(...)` in actions, dialogue, crewlife's player loan, encounters, situations, goals, meetings), but some do not:
- world generation creates eight pre-existing business loans with no cash moved (intended as history);
- [crewlife.ts:91](../../src/crewlife.ts) creates "a private loan between friends" without moving the principal, so the borrower repays money he never received;
- [people.ts:73](../../src/people.ts) (`crisis`) gives the borrower 40% of the amount from nowhere and takes nothing from the lender.
The casino marker in [actions.ts:379](../../src/actions.ts) moves the stake from the owner's own cash to the gambler before creating the debt.

**`payDebt(w, d, amount)`** ([core.ts:286](../../src/core.ts)). The debtor pays from his pocket first, then from his first open business (`ownerBiz`, `bizMove(..., 'debt', debtor)`); the creditor receives `earn(creditor, amount, 'loans')` (so repayments are income under `loans`, counted at 30% for the envelope); a ledger `repay` is posted; `d.paid` and `d.balance` are updated; `missed` resets when the payment is at least the weekly payment or the debt clears; at zero the status becomes `paid`, `onDebtCleared` runs and a minor `debt_paid` fact is added. Preconditions it does not check: if the debtor has no business and his pocket is short, the creditor is still credited the full amount (money created); a negative pocket makes `fromCash` negative and the business covers the difference; the business till may go negative. Callers are expected to check affordability first (the weekly loop does).

**Weekly loop** ([engine.ts:127](../../src/engine.ts)), after `businessWeek` and before `hustleWeek`. For each `active` debt whose `nextDue` has passed:
1. If either party is dead: status `void` (no null check on the lookups).
2. Compound interest: `balance = round(balance x (1 + weeklyRate))`.
3. `pay = min(weeklyPayment, balance)`; `avail = debtor.cash + max(0, biz.cash - 100)`.
4. If `avail >= pay`, `payDebt(pay)`. Payment is all or nothing; there are no partial weekly payments.
5. Otherwise `missed++` and a `debt_missed` fact (minor after the first); at 4 missed the status becomes `defaulted`, a `debt_default` fact is added and `econ.seizeShare` gives the creditor a 15% stake in the debtor's business.
6. `nextDue += WEEK`.

Defaulted debts no longer accrue interest and are not collected by the loop. They are paid down by a seized stake (`econ.payStake` subtracts each stake payout from the balance and marks the debt `paid` at zero, without `onDebtCleared`, a fact or a ledger entry), and they remain targets for situ.ts debt situations, goals.ts recovery goals and dialogue. `balanceBetween` (unused) counts both active and defaulted.

**Other debt helpers in core.ts.** `onDebtCleared(w, d)` ([core.ts:353](../../src/core.ts)) expires open jobs with `j.debt === d.id`, marks related memos done, eases the creditor's grudge and raises his trust, and lapses open encounters tied to the debt. `handleDeath` voids active debts of the dead man ([core.ts:337](../../src/core.ts)); defaulted ones stay `defaulted`. `isResolved` treats `loan`, `debt_missed` and `debt_default` facts as resolved once no active debt remains between the two men, which `reconcile` uses to close memos and grievances.

**Other movers of debt.** NPC collection visits (`actions.ts` `collect`, which calls `payDebt` and may end in a beating), player loans and negotiations (dialogue.ts, club.ts, encounters.ts), situ.ts debt situations and buy-outs, goals.ts `debt` goals and business-purchase loans, situations.ts friends' loans. `audit()` checks that no active debt has a non-positive balance, no paid debt has a positive balance, and no open job points at a debt that is not active.

**Gaps.** The `muscle` gig moves money for a real debt without touching it (see gigs.ts). `w.debts` grows without bound, which is one of the contributors to save size over long games. Interest accrues on missed weeks, so a debtor who cannot pay the weekly amount sees the balance grow until default at week four.

---

## Money conservation

### The doors and the records

| store | door | record | proof |
|---|---|---|---|
| `Business.cash` | `econ.bizMove` only (type is `readonly`) | `w.txns` (one week kept, max 3000), struck weekly into `Business.acct` (8 weeks) | `ledgerCheck` replays the chain per business; `economyIssues` includes it |
| `Family.treasury` | `orgs.treasuryMove` only ([orgs.ts:63](../../src/orgs.ts)) | `Family.tlog` (max 40) and lifetime `tin`/`tout` | `treasuryCheck(f) = tin - tout - treasury` must be 0; `orgIssues` also flags a negative treasury and unbounded logs |
| `Character.cash` | none: written directly by dozens of modules, or through `core.earn()` | `books.gross` for income that goes through `earn`/`record` (reset weekly; history row per week); `books.expenses` for some sinks; `w.ledger` for selected flows inside the player's circle | nothing checks it |

`bizMove` and `treasuryMove` each prove one side of a movement. The other side (a character's cash) is moved by the caller with ordinary arithmetic, so the business and treasury records do not by themselves prove that a transfer was balanced. `w.ledger` is a display record; nothing replays it against cash, and only `earn`, `owe`, `expect`, `kickup`, `loan`, `repay` and `gift` are ever posted.

`core.earn(c, amt, src)` adds to cash and calls `record`, which adds to `weekIncome`, the player's `lifetimeGross` and `books.gross[src]`. Income that bypasses `earn` (owner's draws, wages, side operations, runners' skim, hijack crew cuts, gig settlements, blackjack wins) never enters a man's books and so is never declared or kicked up.

### Checks and the tests that rely on them

- `ledgerCheck(w)`: v73 ("the record chains" after 28 days, "notices a hand-edited balance", every 7 days in 180-day `stable()` runs, after a save round trip, after a schema-3 save loads), v74 (after goal purchases, 60-day runs), v75 (situations, debt negotiation, long runs).
- `economyIssues(w)` through `consistency.audit(w)`: v72, v73 `stable()` and compat, v74, v75, v76 (`clean()`), plus the measurement scripts (`sit_measure`, `sit_freq`, `agency_measure`, `v76_smoke`) and stress.ts. `audit()` is not run during play.
- Source scan: v73 "no source file changes a business's cash directly" (top-level `src/*.ts` only).
- `goals.moneyTotal(w)` ([goals.ts:31](../../src/goals.ts)) = all character cash + all business cash + all treasuries. v74 asserts it is unchanged by business purchases, financed purchases, failed plans, extra debt payments and every goal step over a 60-day run; v76 by `treasuryWeek`, `treasuryMove` and the boss's fund draw. goals.ts also uses it at runtime when `AGENCY.audit` is on, counting "leaks" per goal step.
- v73 "money paid up the chain is conserved": total character cash before and after `settleWeek`, with side operations disabled.
- `treasuryCheck`/`orgIssues`: v76.
- [test.ts](../../src/test.ts): every character's and business's cash is a finite number.

The V73 report states the position plainly: conservation of transfers was verified, not of the total, because wages and living costs are faucets and sinks ([V73_REPORT.md](../V73_REPORT.md)).

### Deliberate sources (money created)

| flow | where | recorded |
|---|---|---|
| Business revenue | `businessWeek` (`'revenue'`); an owner's `work` action adds $30, [actions.ts:222](../../src/actions.ts) | txn |
| Wages | `engine.weekly()` [engine.ts:176](../../src/engine.ts): `cash + wage - LIVING[rank]`; wages are civilian 110, associate 80, soldier 150, capo 300, underboss 600, boss 1000 against living 70/100/170/330/520/900 | no |
| Negative cash wiped | same line: the result is floored at 0, so a negative balance is forgiven | no |
| Hustle income | `hustleWeek` `earn(net, src)` | books, ledger `earn` if in circle |
| Racket income | `opsWeek` `earn(owner, net, kind)`; runner skim `runner.cash += skim` | owner: books; skim: no |
| Hijack | `resolveHijack`: crew cuts `m.cash += cut`, owner `earn(net, 'hijack')` | owner: books |
| Side operations | `settleWeek`: `c.cash += side`, `gross.side` | books |
| Gig takings with no payer | `shipment` hijack/skim via `jobs.paid` with no `from`; `courier` dip `earn('side')` | books |
| New managers | `appointManager` spawns a civilian with $90 | no |
| Unbacked loans | `people.ts crisis` (40% of the loan), `crewlife.ts:91` (no principal) | ledger `loan` if in circle |
| `payDebt` shortfall | creditor credited in full when the debtor cannot cover it and has no business | books, ledger `repay` |
| New shops on load | `deserialize` calls `addShops` if fewer than 34 businesses | no |

### Deliberate sinks (money destroyed)

| flow | where | recorded |
|---|---|---|
| Business expenses | `businessWeek` (`'expense'`); `'invest'`; `'damage'` (revenge, actions); `'fine'` (gigs) | txn |
| Living costs | `engine.weekly()` `LIVING[rank]` | `books.expenses` only |
| Lifestyle | `engine.weekly()` [engine.ts:178](../../src/engine.ts): 6% (associate, soldier, civilian), 8% (capo), 10% (underboss, boss) of cash above a floor of 3,000/3,000/5,000/8,000/15,000/25,000 | `books.expenses` only |
| Player obligations | `engine.weekly()` [engine.ts:186](../../src/engine.ts): 30% chance a week, $80-300 x rank scale, only if he can pay | `books.expenses`, a minor `report` fact |
| Lawyers on arrest | `engine.weekly()` [engine.ts:227](../../src/engine.ts): `min(15% of cash, 500)` | no |
| Collector's upkeep | `creditCollector`: 22% of each protection payment | `books.expenses` |
| Problem drain | `peopleWeek` (people.ts), outside this group | `books.expenses` |
| Hustle expansion and losses | `hustleWeek` | expansion: `books.expenses` |
| Racket start-up, raid fines, bookie losses | `startOp`, `opsWeek` | no |
| Inspector bribe | `gigResolve` | no |
| Crew investment | `investChoose` | no |

### Transfers (conserved) and how they are recorded

| transfer | recorded as |
|---|---|
| Protection fee, business to collector | txn `'protection'` + collector `earn('protection')`; settled-dispute cut to a third party: `books.expenses` only |
| Shakedown out of the till or the owner's pocket (`takeFromBiz`) | txn `'protection'` for the till part; the receiver is credited by the caller |
| Stake payout | txn `'stake'` + `earn('business')` |
| Owner's draw / injection | txn `'draw'`/`'inject'`; owner's cash changed directly |
| Random robbery in `weekly()` | txn `'theft'` + thief `earn('scheme')` + `robbery` fact |
| Kick-ups (`settleOne`, `handOver`) | ledger `kickup` (circle only), boss `books.received`/`gross.kickups` |
| Debt principal and repayments | caller's cash moves, ledger `loan`; `payDebt`: ledger `repay`, creditor `earn('loans')`, txn `'debt'` for any business part |
| Treasury dues, support, draws | `treasuryMove`: `tin`/`tout`, `tlog` |
| Gig fees (`jobs.paid`) | txn `'aid'` for any till part; doer/player `earn` |
| `muscle` gig settlement, tipster's cut, `opRule('repay')`, dispute compensation | direct cash, unrecorded |
| Blackjack and dice | player cash direct; casino txn `'gamble'` |
| Player gifts in club.ts, web.ts, pulse.ts | ledger `gift` |

### Known leaks and unrecorded flows

- Covering a crew man's envelope in [club.ts:142](../../src/club.ts) and [club.ts:220](../../src/club.ts) takes the player's cash and reduces the man's arrears, but the money goes to nobody (it is posted as a `gift` with no matching receipt).
- `investChoose('back')` (see reports.ts) and the `muscle` gig (see gigs.ts).
- A live blackjack hand holds the bet outside every balance.
- Character cash can go negative through `rackets.opsWeek` bookie losses, `payDebt` preconditions and arithmetic in other modules, and is then silently reset to zero by the weekly wage line.

---

## How this group connects to the rest

- Every income path: caller → `core.earn` → `books.gross[src]` → `settleOne` declares it, posts ledger `earn`, passes a share up the chain. Sources from jobs (`jobs.paid`: `handle`, `cut`, `delegated`), protection (`creditCollector`), stakes (`payStake`), debts (`payDebt`: `loans`), hustles, rackets, gigs.
- Business tills: actions, revenge, jobs, path, encounters, dialogue, goals, situations, powers2, gigs, blackjack, core.payDebt and engine's robbery pass → `econ.bizMove` → `w.txns` → weekly `strikeAccounts` → `Business.acct` → `trade()` (goals.ts business prices, ui/views_a) and `slump()`/`evidence()` (what NPCs and the player can see).
- Protection: dialogue, encounters and orders collect arrears through `takeFromBiz`/`giveTime`/`clearArrears`; `payProtection` adds `protection_late` facts witnessed by the collector, which situ.ts and dialogue react to; disputes.ts sets `protection.hold` to make an owner sit on his envelope; settled disputes give a third party a cut in `creditCollector`.
- Settlement → knowledge and consequences: `shortfall`, `discipline`, `terms`, `levy` and `side_operation` facts go through `addFact` and `learn`; skimming detection hands over to `situ.skimNoticed`; the player is summoned via a `summons` job (meetings.ts runs the meeting); `discipline` can move a protected shop up a level (`setCollector`).
- Debts: many modules → `core.createDebt`/`payDebt` → ledger `loan`/`repay`; engine's weekly loop → `debt_missed`/`debt_default` facts (grudges via `core.learn`) → `econ.seizeShare` → a stake that pays the debt from trade.
- Ownership: goals.ts (NPC purchases) and situ.ts (buy-outs, inheritance) → `transferBusiness`/`addStake`; `core.handleDeath` → `succeedOwner`.
- Hustles and rackets → heat, arrests (`arrest` facts), the player's crew view (dialogue, meetings); hustle expansion → `reports.askToInvest` → an encounter → `investChoose`.
- `specs.hasPerk` → rackets (take), gigs (offer rate), powers2 (quarrels), pulse (holding a street).
- `reports.reportTick` → `core.learn` for the player; `relevance` → web.ts news feed ranking and club.ts.
- Integrity: `econ.economyIssues` and `orgs.orgIssues` → `consistency.audit()` → tests.

---

## Replacing this system

**Surface other modules actually use.**
- econ: `bizMove` (17 modules), `takeFromBiz`, `giveTime`, `clearArrears`, `owedOf`, `setCollector`, `evidence`, `addStake`, `stakesOf`, `transferBusiness`, `seizeShare`, `succeedOwner`, `trade`, `perf`, `INVEST_CAP`, `businessWeek`, `ledgerCheck`, `economyIssues`.
- books: `settleWeek`, `emptyBooks`, `BASE_RATE` (world generation and `deserialize`), `react`, `discipline`, `influence`, `influenceWord`, `envelopeDue`, `envelopeText`, `envelopeSum`, `kickWindow`, `handOver`, `askRate`, `auditMember`, `checkBooks`, `rule`, `RULINGS`, `setStance`, `effectiveRate`, `subordinates`, `SOURCE_LABEL`, `visibleSources`; tests call `settleOne` directly.
- ledger: `post`, `statement`, `previous`, `refreshHistory`.
- core (not in this group, but part of the contract): `earn`/`record` and the `books.gross` convention, `createDebt`, `payDebt`, `onDebtCleared`, `ownerBiz`.
- rackets: `OPS`, `OP_GROUPS`, `canStart`, `startOp`, `hijack`, `closeOp`, `countOp`, `opRule`, `opsDaily`, `opsWeek`. hustle: `HUSTLES`, `hustleWeek`, `hustleLine`. gigs: everything jobs.ts imports. blackjack: the six exports used by ui/blackjack.ts. specs: `hasPerk` and the UI exports. reports: `relevance`, `reportTick`, `askToInvest`, `investChoose`.

**World fields it must keep (all persisted in saves).** `w.txns`, `w.ledger`, `w.debts`, `w.ops`, `w.bj`, `w.expect`; `Business.cash/acct/protection/stakes/owners/managerId/invest/rivals0/distress/damaged/open/ownerId`; `Character.books` (every field), `kickRate`, `weekIncome`, `lifetimeKick`, `lifetimeGross`, `hustle`, `wage`; `Family.levy`, `treasury/tin/tout/tlog`. The shapes of `Txn`, `WeekAcct`, `LedgerEntry`, `WeekBook` and `Debt` are in existing save files, and `oldsave.test.ts` loads genuine old saves.

**Ticks it must answer.** Weekly, in this order inside `engine.ts weekly()`: the robbery pass, `businessWeek`, the debt loop, `hustleWeek`, `reportTick`, wages/living/lifestyle, obligations, `peopleWeek`, `settleWeek`; then, after `weekly()`, `opsWeek`. Daily: `opsDaily`, and `gigTick` from inside `jobs.daily`. Settlement has to run after every same-week income it is meant to tax (protection credited in `businessWeek`, debt repayments, hustles) and racket income currently lands in the following week.

**What makes it hard.**
- Character money has no door. `Character.cash` is changed by plain arithmetic in dozens of modules, so a replacement cannot intercept or audit it without touching all of them.
- Shared mutable fields: `books.arrears` is written by club.ts, meetings.ts, powers2.ts, situ.ts and web.ts; `books.expenses` by engine, hustle, people and econ; `books.gross` by `core.record`; `kickRate` by path, people, jobs, meetings and goals; `Business.protection` is created directly in actions, dialogue, jobs, situ, pulse and others; `c.hustle` by path, meetings and reports.
- Logic that belongs to this group lives elsewhere: the debt loop, wages, living costs, lifestyle, obligations and the robbery pass are inline in `engine.ts weekly()`; `createDebt`/`payDebt`/`earn` are in core.ts; `jobs.paid` is the gig payout path.
- Import cycles: core ↔ econ; econ → world → books → econ; books ↔ situ; gigs ↔ jobs; hustle → reports ↔ encounters → jobs → gigs; books also imports actions and jobs. They work because every use is inside a function body, but moving code between these files is easy to get wrong.
- Module-level caches: `tailCache` must be rebuilt from `w.txns` exactly as now, or a loaded save stops merging txns the same way and the byte-identical continuation tests fail; `troubleCache` and the `influence` median cache would need fixing rather than copying.
- Tests pin exact behaviour: v73 (the economy suite, including settlement outcomes, determinism by comparing `serialize()` output, and merge-after-load), v74/v75/v76 (`moneyTotal`, `ledgerCheck`, `audit`), v77 (`askRate`).
