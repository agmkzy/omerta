# Jobs, encounters and commitments

In game terms this group is everything that is *put to the player*: work offered by his boss, tip-offs and contracts from people with a grudge, opportunities from garages and pawnshops, his own schemes, and the small scenes in which people come to him (a loan request, an alibi, a call-in on a favour, a funeral invitation). It also covers the player's direct money-making moves (selling cars, pawning goods, running a chop shop) and the reference sheets that explain each way of earning. In code terms it owns two of the world's main commitment stores, `w.jobs` (offered/active/closed `Job` records with their resolution logic) and `w.enc` (open/closed `Enc` scenes with a central `choose()` dispatcher), plus the `w.favours` helpers, `w.ventures` and `w.events`. It runs from the engine's `daily` and `weekly` events, and the UI calls it when the player acts. The `## Commitments` section below maps the whole family of commitment records (memos, favours, debts, threats, encounters, jobs, pending consequences) across the codebase, including the ones owned by other modules.

> **Tracked bugs:** the "Known issues" notes below were checked against the source, and the confirmed ones are filed as GitHub issues: [`area: jobs`](https://github.com/agmkzy/omerta/issues?q=is%3Aissue+milestone%3A%22V85+baseline+review%22+label%3A%22area%3A+jobs%22).

## Modules

| file | lines | responsibility |
|---|---|---|
| [jobs.ts](../../src/jobs.ts) | 1244 | Creates job offers (boss, tip, contract, opportunity, scheme), runs the job lifecycle and resolution, ventures (chop shops), player moves, and the player's questioning of an assignment. |
| [encounters.ts](../../src/encounters.ts) | 986 | Encounter (`Enc`) scenes that come to the player: generators, daily tick and lapse, the `choose()` dispatcher for every encounter kind, favour helpers, life events (funerals, weddings, christenings). |
| [ways.ts](../../src/ways.ts) | 177 | Static, plain-language sheets for each way of making money, generated partly from `rackets.ts` `OPS`. |

---

## jobs.ts

**Purpose.** The file header says it holds "everything that starts from the player". It turns world state (debts the boss is owed, facts the boss knows, NPC grudges, businesses) into `Job` records, keeps the job inbox tidy (deduplication, staleness, expiry), and resolves a job when the player picks an approach or when a crew member's due time arrives. It also owns chop-shop `Venture`s, the scheme/move menus, and the "doubting an assignment" actions (ask why, press, investigate, ask around, haggle) that let the player test whether the reason given for a job is true.

**State owned.**
- `w.jobs: Job[]`. `mkJob` ([jobs.ts:98](../../src/jobs.ts)) is the only place a `Job` is pushed (every other module calls `mkJob`). Fields written here: `status`, `assignee`, `due`, `orders`, `pay` (haggle), `notes`, `checked`, `haggled`, `disproved`, plus all creation fields (`why`, `claimTrue`, `reason`, `subject`, `cause`, `debt`).
- `w.ventures: Venture[]`: created by `performMove('chop_start')` ([jobs.ts:1007](../../src/jobs.ts)), advanced and closed by `ventureWeek`. (`dialogue.ts:1132` also pushes a Venture directly for the `partner_chop` conversation option.)
- `w.pending`: pushes one `reveal` entry when a blackmail job is declined ([jobs.ts:359](../../src/jobs.ts)).
- Character fields written: `cars`, `goods` (stolen stock), `heat` (`bump`), `jailedUntil` (`jail`), `standing`, `kickRate` (summons discipline), `district` (travel), `cash`. Generic bag: `Character.cooldown.scammed` (21-day wariness after a scam).
- Business fields written: `lastApproach` (burglary), `damaged` (smash-and-grab, venture raid). Business cash only moves through `econ.bizMove` (in `paid()`).
- Mutates `Fact.actor` in place in `declineJob` for blackmail (see Known issues).
- Module-level mutable global `let w0: World` ([jobs.ts:1147](../../src/jobs.ts)), set by `questionJob` and read by `pickTell`.

**Public API.**

Types and labels

| export | description |
|---|---|
| `interface Approach { code; label; hint }` | One way of doing a job, shown to the player and used by `orders.runCrewJob`. |
| `interface Result { lines; minutes; ok; money?; note? }` | Outcome of `resolve`; also returned by `gigs.gigResolve`. |
| `interface Move { kind: 'sell_cars' \| 'pawn_goods' \| 'deliver_cars' \| 'chop_start' \| 'meeting' \| 'bonus' \| 'topic'; actor; biz?; target?; code?; label }` | A non-job action. Used by `ui/state.ts`. |
| `interface SchemeOpt { label; hint?; job?: { kind: 'boost' \| 'burgle' \| 'scam'; biz?; target? }; move?: Move }` | An entry on the Schemes menu. |
| `type NewJob = Omit<Job, 'id' \| 'created' \| 'expires' \| 'status'> & { days?; status? }` | Input to `mkJob`. |
| `KIND_LABEL: Record<Job['kind'], string>`, `KIND_HELP: Record<string, string>` | Display names and one-line help per job kind. |
| `JOB_STATE: Record<Job['status'], string>` | Display names per status. Not referenced anywhere (grep). |
| `traitWords(c: Character): string` | Up to two trait words ("violent, careful"). Pure. |
| `standingWord(s: number): string` | Standing band word ("on thin ice" … "a rising name"). Pure. |

Plumbing

| export | description / side effects |
|---|---|
| `mkJob(w: World, j: NewJob): Job` | Creates and pushes a job (`id` via `newId(w,'j')`, `expires = now + (days ?? 6) days`, `status ?? 'offered'`). **Deduplicates** (except `summons`): returns an existing job instead if one has the same kind/target/biz and is open (unless `via` is `order` or `scheme`), or has the same giver and assignee and is open or was created within 10 days with the same `via`. The returned job can be of any status, including `done` or `declined`. |
| `jail(w, c, days)` | Sets `jailedUntil`, `heat = 0.1`, career log, `arrest` fact broadcast to the family. |
| `paid(w, doer, amount, from?, src = 'scheme'): number` | Pays the doer. With `from`, the amount is capped at `from.cash + from's business cash`, taken from pocket first and then the till via `bizMove(..., 'aid')`. The player keeps all; a crew man keeps 35% (`earn` src `'cut'`) and 65% goes to the player (src `'delegated'`). Without `from`, the money is credited with no debit (the caller must have debited someone). Income goes through `core.earn`, so it lands in `books.gross[src]` and counts towards kick-ups. |
| `bump(c, d)` | `heat = clamp(heat + d, 0, 1.5)`. |

Offers

| export | description / side effects |
|---|---|
| `bossOffer(w: World, force = false): boolean` | Builds a list of candidate offers from the player's boss and runs one picked by `w.rng.pick`. Candidates: **collect** (boss is creditor of an active debt with `missed >= 1`); **lean** (an unprotected-by-us, non-casino shop in the family's districts, `lastApproach` older than 7 days; pay `120 + round(income/200)*10`); **handle** a wrong (boss *knows the actor* of a beating/vandalism/robbery/poach fact under 20 days old against a family member, pay 400, `claimTrue: true`); **internal purge** (a family member of soldier rank or above, below the boss, whom the boss holds a grudge of 0.25 or more against; 60% "disloyal" (true only if the target has a 0.35+ trust tie to another family), else "skimming" (true only if `concealedGap > 40`); pay 1500); and three **errand** entries that call `orders.bossErrand`. Without `force` it refuses while any boss job is offered or active; with `force` only while one is offered. Returns `true` whenever there was at least one candidate, even if the chosen candidate created nothing (see Known issues). Uses rng; mutates `w.jobs`. |
| `forceBossOffer(w)` | `bossOffer(w, true)`. Called from `club.ts` and `places.ts`. |
| `tipFrom(w: World, c: Character): boolean` | `c` was the victim of a hostile fact (beating, vandalism, robbery, poach, scam, burglary, theft) in the last 25 days that is not already a job's `cause`. Culprit is the true actor if `c` knows it, otherwise whoever `c` holds the largest grudge against (above 0.3), so the culprit can be wrong. Rejects the player, the player's own family, bosses and underbosses. Creates a `handle` job, `via: 'tip'`, pay `clamp(round(c.cash*0.25/50)*50, 150, 600)`, `why` from `voice.whyOf`, `claimTrue = (culprit === f.actor)`. |
| `oppFrom(w: World, t: Character): boolean` | If `t` owns a garage, offers a `boost` job (650 per car); if a pawnshop, a `burgle` tip on another unprotected shop (55% of the haul). |
| `newOffer(w: World)` | Draws up to six times without replacement from `['boss','boss','tip','opp','opp','gig','gig','gig','contract']` and stops at the first generator that succeeds. Internal generators: `tipOffer` (tries up to eight characters the player trusts at 0.2 or more), `contractOffer` (a character the player trusts at 0.2+, with $1,500+ cash, who holds a grudge of 0.6+ against someone outside the player's family; pay `clamp(round(cash*0.5/250)*250, 1500, 4000)`, 8 days, `claimTrue` true only if the target has a non-minor fact against the client), `oppOffer` (garage, pawnshop, or a `scam` on a flush owner with a random acquaintance as tipster), `gigs.gigOffer`. |

Lifecycle

| export | description / side effects |
|---|---|
| `takeJob(w, j)` | `status = 'active'`, `assignee = player`, clears `due`. |
| `declineJob(w, j)` | `status = 'declined'`; giver respect −0.03; boss jobs: standing −2. Blackmail jobs (`reason === 'blackmail'`): giver trust −0.2, grudge +0.3, rewrites the latest relevant murder fact's `actor` to the player and queues a `reveal` pending entry in 5–12 days. |
| `dropJob(w, j)` | Abandons an active job: `status = 'declined'`, boss jobs standing −4, giver trust −0.05. |
| `activityOf(w, c): { why; until } \| undefined` | The single "is he busy?" test: jailed, hurt, on an active non-summons job, or keeping his head down (`hustle.lull`). |
| `inHand(w, j, except?)` | An active job with the same kind/target/biz (ignores `summons`, `boost`, `watch`). |
| `assign(w, j, memberId, orders: 'quiet' \| 'hard'): string \| null` | Delegates to a crew man. Returns an error string if he is busy, the job is active, or someone already holds the same work. Silently expires matching offers ("Taken up under another name."). Sets `status='active'`, `assignee`, `orders`, `due = now + 1..3 days` (rng). |
| `approaches(w, j): Approach[]` | Per-kind approach codes (see the resolution table below). Delegates to `gigs.gigApproaches` for `gig`; `summons` has none. |
| `resolve(w: World, j: Job, code: string): Result` | Runs a job with the chosen approach (see below), then `conclude()`. Errand kinds go to `orders.resolveErrand`; `gig` to `gigs.gigResolve`. Uses rng, moves money, adds facts, may kill or jail. |
| `staleReason(w, j): string \| null` | Why an open job no longer makes sense: gig-specific staleness, sit-down grievance closed, a duplicate of an older or active job, target/assignee/giver dead, debt settled or caught up, shop closed or already paying the family, late payer paid up, jailed man already out, bad blood gone (non-boss `handle`). |
| `pruneJobs(w)` | Expires every open job with a `staleReason`, appends the reason to `notes`, and adds a minor `report` fact witnessed by the player. Also called by `web.ts`. |

Resolution, kind by kind (`adj = aptitude(doer, kind) − 0.5`)

| kind | codes | mechanics |
|---|---|---|
| `collect` | soft / firm / hard | `actions.perform({kind:'collect'})`; ok if the balance fell. The giver pays the doer 25% of what was collected (`giver.cash -= cut`, `paid(..., 'loans')`). |
| `lean` | soft / firm / hard | `actions.perform({kind:'shakedown'})`; ok if the doer is now the shop's collector; `paid(j.pay)` from the giver. |
| `handle` | warn / squeeze / beat | `guilty` = cause fact's actor is the target (true when there is no cause). *warn*: only works if guilty; restitution of up to $800 from target to giver. *squeeze*: up to $1,000 of the target's cash, 60% to the giver and 40% to the doer, heat +0.1, `robbery` fact. *beat*: `perform({kind:'retaliate', mode:'beat'})`. On success `paid(j.pay)` from the giver; an innocent target adds a doubt note. Failed or innocent warns and squeezes raise the target's grudge. |
| `hit` | specialist / self | *self*: `perform(retaliate, 'hit')`, then `consequences.afterClient` (blackmail/truth pendings). *specialist*: fee 35% of pay (doer pays; money leaves the world), 80% success: `handleDeath`, hidden-actor `murder` fact naming the giver, `afterKilling` (delayed heat on the doer), `tension(giver, target, 3)`. Success pays from the giver; a civilian victim costs standing −3. |
| `boost` | lot / street / showroom | Risk `clamp(base + (0.5 − caution)*0.2 − adj*0.3, 0.05, 0.8)`. Success: `cars += n`, heat, hidden-actor `theft` fact whose victim is a random civilian. Opportunity jobs sell straight to the giver at `n*pay`. Failure: heat; showroom has a 35% chance of 3–15 days in jail. |
| `burgle` | quiet / smash | "Guarded" if `lastApproach` is under 14 days; sets `lastApproach`. Success: `goods += value` (up to $2,500), smash damages the shop, `burglary` fact plus `notifyProtector`. Opportunity jobs sell to the giver at 55%. Smash failure has a 35% chance of 5–20 days in jail. |
| `scam` | charity / insurance / rigged / fakecoll / pyramid | Wary if `cooldown.scammed` is still running; sets it 21 days ahead. Under $100 on the mark: fail with the stake refunded. Success moves the mark's cash to the doer; a 40% + caution×30% chance the mark notices (`scam` fact). Failure: a `scam` fact with amount 0; the rigged $300 stake is lost. |
| errands (`watch deliver message guard find shake fix`) | go (or soft/firm/hard for `shake`) | `orders.resolveErrand`; money paid from the giver. |
| `gig` | from `gigs.gigApproaches` | `gigs.gigResolve`. |

`conclude()` ([jobs.ts:466](../../src/jobs.ts)): sets `done`/`failed`; career log for a non-player doer; `grow(assignee, kind, 0.02 \| 0.008)`; giver→player trust +0.08 and respect +0.05 on success, trust −0.06 on failure; boss jobs standing +4/−5; tip/contract success adds the "owes you one now" line (text only, no `Favour` record is created).

Tick and ventures

| export | description / side effects |
|---|---|
| `daily(w: World)` | `pruneJobs`; expires offered jobs past `expires` (boss: standing −3, trust −0.05; other givers: trust −0.03); two expired summons within 30 days leads to discipline (a beating with 3 days hurt and a grudge if the boss's violence is above 0.5, otherwise standing −6 and `kickRate +0.05`; either way a `discipline` fact); auto-resolves due delegated jobs (`orders.runCrewJob`); caps `w.jobs` (when over 80, keeps open jobs or ones under 20 days old); with fewer than 4 offers, a 60% chance of `newOffer`; `gigs.gigTick`. |
| `ventureWeek(w: World)` | For each open venture: closes it if the owner is dead; processes `min(stock, 2)` cars at $1,000 each (host gets `hostShare`, owner `earn(..., 'scheme')`, heat +0.05 per car); raid chance `0.03 + 0.025*stock + 0.02*processed` closes it, damages the garage, broadcasts a `raid` fact to the owner's family, 50% jail 10–30 days. |
| `ventureOf(w, c)` | The character's open venture, if any. |

Schemes and moves

| export | description |
|---|---|
| `startScheme(w, p, spec): Job` | Returns an existing matching active scheme, otherwise `mkJob(... via:'scheme', status:'active', days:5, giver:null)`. |
| `schemes(w, p): SchemeOpt[]` | Boost; burgle up to 4 unprotected shops (nearest first, then by income); scam up to 4 owners; chop shop partner ($2,000, 30%) or strong-arm ($300, 15%) if no venture, else deliver cars; sell cars ($550 each) and pawn goods (40%). |
| `crewMoves(w, p): Move[]` | Only the "$100 bonus each" move. |
| `topicOptions(w, p, t): Move[]` | Old-style talk topics (ask, bossjob/work, money, protect, drink). Only `bot.ts` calls it; live conversation is in `dialogue.ts`. |
| `performMove(w, m): { minutes; lines }` | Executes a move. `sell_cars` and `pawn_goods` credit the player with no debit (`earn`); `chop_start` (accept roll, cash to host, venture push, grudge on strong-arm); `deliver_cars`; `meeting` (no caller constructs this move); `bonus`; `topic` (calls `share`, `confide`, `bossOffer`, `tipFrom`, `oppFrom`, `perform(shakedown)`, or a $40 drink that leaves the world). |

Doubting an assignment

| export | description |
|---|---|
| `canQuestion(j)` | `hit` or `handle`, open, with a `reason`. |
| `jobChecks(j)` | Which checks are still available: `ask`, `press` (only after `ask`, and only if `why`), `inv`, `around`, `haggle` (not yet haggled, `pay > 0`, and `hit` or via `contract`/`tip`). |
| `questionJob(w, j)` | Shows `why.surface`; if the claim is false a "lie tell" with chance `clamp(0.45 + p.caution*0.25 − g.caution*0.2, 0.2, 0.8)`, if true a "true tell" at 55%, otherwise ambiguous. 20 minutes. Lines are appended to `j.notes`. |
| `pressJob(w, j)` | Chance `clamp(0.2 + trust*0.45 + respect*0.25 ± 0.1, 0.1, 0.9)` to hear `why.deep` (trust +0.03), else a dodge (trust −0.04). 15 minutes. |
| `investigateJob(w, j)` | Checks the claim against the world (other-family ties for `disloyal`, `concealedGap` for `skimming`, the cause fact's actor otherwise). With probability `acc = clamp(0.6 + caution*0.2, 0.55, 0.85)` the answer is correct, otherwise inconclusive. Sets `disproved` by matching the English output strings. 90 minutes. |
| `askAroundJob(w, j)` | A third party the player trusts (0.3+) gives his view of the target and the latest hostile non-minor fact he knows about him. 45 minutes. |
| `haggleJob(w, j)` | Chance `clamp(0.35 + standing/100*0.3 − greed*0.2 + respect*0.2, 0.1, 0.75)` to raise pay by 30% (rounded to $50); failure costs trust −0.05. 15 minutes. |

**Tick hooks.**
- `daily` is called first in the engine's daily event ([engine.ts:53](../../src/engine.ts)), before `summonsTick`, `memoTick`, `pendingTick` and `encounterTick`.
- `ventureWeek` is called in the weekly event after `weekly`, `sweep` and `repairAll` ([engine.ts:48](../../src/engine.ts)).
- Player actions: `web.ts` calls `takeJob` (`mine`), `resolve` (`go`), `assign` (`send`), `declineJob` (`pass`, `excuse`), `dropJob` (`drop`), `startScheme`, `performMove`, the five check functions (`jx`), and `pruneJobs` after time passes. `club.ts`, `places.ts` and `dialogue.ts` call `forceBossOffer`/`bossOffer`/`tipFrom`/`oppFrom`/`mkJob` from conversation and place visits.

**Depends on / used by.**
- Imports: `econ` (`bizMove` for taking from a giver's till), `orders` (errands, `runCrewJob`), `people` (`aptitude`, `grow`, `lateOf`), `voice` (`arch`, `bossWhy`, `whyOf`, `pitch`, `dodge`), `actions` (`perform` for collect/shakedown/retaliate, `share`, `confide`, `tension`), `consequences` (`afterClient`, `afterKilling`), `core` (facts, money, relationships, death), `gigs` (gig kind), `types`. Unused imports: `injury`, `factText`, `GIG_HELP`, `GIG_LABEL`.
- Imported by: `engine` (`daily`, `ventureWeek`); `orders` (`activityOf`, `approaches`, `assign`, `mkJob`, `resolve`); `gigs` (`bump`, `jail`, `mkJob`, `paid`, `Approach`, `Result`); `consequences`, `career`, `path`, `books`, `meetings` (`mkJob`, `tipFrom`, `traitWords`); `dialogue` (`mkJob`, `bossOffer`, `tipFrom`, `oppFrom`, `standingWord`, `traitWords`); `flows` (`standingWord`); `encounters` and `powers2` (`newOffer`); `club` and `places` (`forceBossOffer`, `takeJob`, `declineJob`); `web.ts`; `ui/views_a.ts` (`KIND_LABEL`, `standingWord`, `staleReason`), `ui/views_b.ts`, `ui/views_c.ts`, `ui/common.ts`, `ui/state.ts`; harnesses `bot.ts`, `stress.ts`, `playtest/pt.ts`.
- Circular imports: jobs ↔ orders, jobs ↔ gigs, jobs ↔ consequences. They work because nothing is used at module load time.

**Invariants & rules.**
- One time-consuming assignment per NPC: `activityOf` is the only "is he free" check. `consistency.audit` reports any NPC with more than one active non-summons job, any duplicate active `kind|target|biz` (except `summons`, `boost`, `watch`), and any open job on a settled debt. `consistency.reconcile` (daily) repairs the first two by expiring the later job.
- Knowledge: `bossOffer` only offers "deal with X for a wrong" when the boss's `known[f].knowsActor` is true. `tipFrom` can name the wrong culprit, and `claimTrue` records whether the accusation is true. That flag is hidden from the player and drives `investigateJob`, `questionJob` tells and the delayed `truth` consequence.
- Business cash only moves through `bizMove` (here inside `paid`), which keeps `econ.ledgerCheck` valid.
- Character cash is *not* globally conserved here. Money is created by `sell_cars`, `pawn_goods` and `ventureWeek` (and by `orders.runCrewJob` fencing). Money is destroyed by the specialist fee, the failed rigged stake and the $40 drink. Neither jobs.ts nor encounters.ts calls `ledger.post`; earnings appear only in `books.gross` via `earn`.
- Determinism: all randomness through `w.rng`; `pickTell` uses `w0.rng`, which is the same world because `questionJob` sets `w0` first. No `Math.random` or `Date`.
- Bounds: `w.jobs` is trimmed only once it exceeds 80 entries. `notes`/`checked` per job are small. `w.ventures` is never pruned.

**Save compatibility notes.** `ensureShape` ([world.ts:290](../../src/world.ts)) guarantees `w.jobs`, `w.ventures` and `w.pending`. All `Job` fields added since the early versions are optional (`due`, `orders`, `reported`, `reason`, `why`, `claimTrue`, `subject`, `notes`, `checked`, `haggled`, `disproved`, `rep`, `acked`, `meeting`, `extra`). `deserialize` defaults `c.cars` and `c.goods` to 0 ([engine.ts:282](../../src/engine.ts)). `Job.extra` is a generic `Record<string, number | string>` (sit-down summons use `extra.g`, gigs use `extra.gig`). No migration in this module.

**Known issues / gaps.**
- **Player-held active jobs never time out.** `daily()` only expires `offered` jobs, and only delegated jobs are auto-resolved at `due`. A job the player took stays `active` until he resolves it, drops it, or `staleReason` prunes it. This is part of why "ignored promises are penalised less than failed ones" (CLAUDE.md): a failed promise job costs the `conclude()` trust −0.06 *plus* the `memoTick` penalty, while an ignored one costs only the `memoTick` penalty.
- **Relationship saturation** (CLAUDE.md: boss trust ~0.99 by day 35): `conclude()` ([jobs.ts:472](../../src/jobs.ts)) adds +0.08 trust and +0.05 respect per success with no diminishing returns, and three of the boss's candidate offers are zero- or low-pay errands that count the same as major jobs.
- `bossOffer` returns `true` when the picked candidate made nothing: `void bossErrand(...)` ignores the errand's boolean, and `mkJob` may return an existing job (even a closed one). Callers such as `dialogue.ts:1876`, `dialogue.ts:1912` and `places.ts:74` then say the boss has work when the inbox is unchanged.
- In the purge option `lethal = x.rank !== 'associate'` is always true, because the filter already requires soldier rank or above (`rankOrder.indexOf(x.rank) >= 1`). The non-lethal `handle` variant and its $300 pay are unreachable.
- `declineJob` for blackmail sets `f.actor = p.id` on an existing murder fact ([jobs.ts:358](../../src/jobs.ts)). This rewrites the recorded truth rather than creating an accusation fact, so if the specialist route was used the giver's own guilt is erased from history.
- Blackmail jobs (created by `consequences.ts:91` with `reason: 'blackmail'` and no `why`) satisfy `canQuestion`, and `questionJob` then prints the raw reason: `Name: "blackmail"`. That is internal vocabulary shown to the player.
- `haggleJob` accepts a raise with no stated reason, which is the same class of problem as the encounter haggling bug below.
- `investigateJob` is never *wrong*, only sometimes inconclusive, although its comment says "more likely to be right than wrong, but not certain". `disproved` is decided by matching English output (`said.includes('not nothing')`) and is **write-only**: nothing reads `Job.disproved`.
- Summons discipline counts every summons with `status === 'expired'` in the last 30 days. That includes summons that `pruneJobs` expired as stale (e.g. a sit-down whose grievance closed), which the player did not ignore.
- The `boost` theft fact names a random civilian anywhere in the city as the victim, so a stranger can learn about it and hold a grudge.
- `ventureWeek` does not check that the host is alive or the garage is open.
- Dead or unused code: `JOB_STATE`, `Move` kind `meeting` (never constructed), `topicOptions` (only `bot.ts`), `autoResolve` (a one-line wrapper).

---

## encounters.ts

**Purpose.** Small scenes in which somebody comes to the player, written in the speaker's voice and offering choices with consequences. The module owns the encounter store (`addEnc`), a set of generators that pick a candidate scene by weight each day, lapse and pruning of unanswered scenes, and `choose()`, the single dispatcher through which *every* encounter kind is answered, including kinds created and resolved by other modules (crew, threat, promo, sit-down, invest, life, politics, racket squeeze). It also holds the `Favour` helpers and the life-event (funeral, wedding, christening) invitations.

**State owned.**
- `w.enc: Enc[]`: created by `addEnc` ([encounters.ts:18](../../src/encounters.ts); default 4-day expiry), status changed by `choose`, `lapse` and `pruneEnc`, and pruned in `encounterTick`. `Enc.data` is a generic `Record<string, string | number>` bag. Keys by kind: loan `{amt, reason, real, asked}`, favour_ask `{kind: 'word' | 'cover' | 'release', fact, when, where, jailed}`, shop `{biz}`, tip `{price, kind, who}`, callin `{ask, fav}`, tell `{fact}`, debtor `{debt}`, shophelp `{dispute}`, invite `{ev}`, threat `{enemy, hide}` (set by danger.ts), squeeze `{op}`, suspect `{sus}`.
- `w.favours: Favour[]`: created only through `addFavour` ([encounters.ts:35](../../src/encounters.ts)); `settled`/`asked` written here (call-ins) and in `flows.ts` and `powers2.ts`.
- `w.events: LifeEvent[]`: funerals and happy occasions pushed by `eventTick`; `done` set in `inviteReply`. (`life.ts:422` also pushes christenings.)
- `w.pending`: one `intent` entry (`note: 'raidop'`) when the player refuses a racket squeeze ([encounters.ts:533](../../src/encounters.ts)).
- Character bags: `p.cooldown.favask` (6 days after a favour ask is generated), `p.cooldown.tipsale` (30 days), `p.known['leave:<id>']` (a non-fact knowledge key; `retain.sweep` deliberately preserves non-fact keys). Also writes `c.backer`, `c.problem.revealed` / `sev`, `who.books.sideKnown`, `jailedUntil` (release), `Fact.hiddenActor` and other characters' `known[f].knowsActor` (alibi), debt `nextDue`/`missed`, `Dispute.seen`, `Situation.helped`/`knows`/`stage`, `Business.distress`.

**Public API.**

| export | description / side effects |
|---|---|
| `addEnc(w: World, e: Omit<Enc, 'id' \| 't' \| 'status' \| 'expires'> & { days?: number }): Enc` | Pushes an open encounter. Used by 14 other modules. |
| `owedTo(w, id): Favour[]` | Unsettled favours where `from === id` (others owe `id`). |
| `owing(w, id): Favour[]` | Unsettled favours where `to === id` (`id` owes others). |
| `addFavour(w, from: Id, to: Id, size: number, what: string): Favour` | Records that `from` did `to` a good turn of `size` 1–3 (`to` owes `from`). |
| `favourWord(n)` | "a small one" / "a real one" / "a big one". |
| `makeLoan(w, p, c)` | Builds a `loan` encounter with an amount ($200–$900, rounded to $50), a stated reason keyed to `c.problem.kind`, and five options. Called by `situations.ts`; the module's own `loanAsk` generator is disabled. |
| `whenWords(now, t): string` | "yesterday evening", "3 days ago, at night", etc. Pure. |
| `encounterTick(w: World)` | Daily. Requires a living player with a family. Runs `pruneEnc`, lapses expired scenes, drops closed scenes created more than 20 days ago, and stops if 4 or more are open. Otherwise, with chance `0.4 + rankBonus + clamp(standing/400, 0, 0.2)`, gathers candidates from `GENERATORS`, divides each weight by `1 + recentOf(key)*1.5` (repetition damping over 25 days), and makes one by weighted roulette on `w.rng.next()`. Sets `cooldown.favask` if a favour ask was produced. |
| `forceEncounter(w: World): boolean` | Same roulette without the chance gate, the repetition damping, or the favask cooldown. Called by `places.ts` when the player visits somewhere. |
| `choose(w: World, p: Character, e: Enc, code: string): { lines: string[]; minutes: number }` | Answers an encounter. Kind-specific handlers set `e.status = 'done'` via `done()` or leave it open via `keep()` (e.g. not enough cash, or after "what's it really for?"). Dispatches: `crew` → `crewlife.crewChoose` (which sets status itself), `loan`, `favour_ask`, `mediate`, `shop`, `tip`, `callin`, `tell`, `squeeze` (inline), `meet`/`partner`/`kin` → `life.lifeChoose` (only if `w.life`), `suspect`/`side` → `politics.politicsChoose`, `promo` → `career.promoChoose`, `debtor`, `shophelp`, `invest` → `reports.investChoose`, `sitdown` → `disputes.sitdownChoose`, `invite`, `threat` → `danger.threatChoose`. Anything else returns "Nothing comes of it." |
| `eventTick(w: World)` | Daily. Creates a funeral `LifeEvent` (2 days ahead) for any made-rank family member who died in the last 3 days, and invites the player if it is his family or he trusted the dead man (0.3+). With a 3.5% chance per day, creates a wedding or christening (4 days ahead) hosted by a soldier, capo or underboss of the player's family who has not hosted in 90 days, and invites him. |

Encounters generated here (`GENERATORS`, [encounters.ts:394](../../src/encounters.ts)):

| kind | trigger (weight) | options → main effects |
|---|---|---|
| `loan` | `loanAsk` returns `[]` immediately; created by `situations.ts` via `makeLoan` | *lend* / *half*: cash to the borrower (or to his troubled business via `bizMove` if a situation names one), `createDebt` at 5% a week, `loan` fact. *give*: favour size 2, trust and affection +0.12. All money options lower `problem.sev` by 0.15 and mark the linked situation as handled. *ask*: may reveal the real problem. *no*: trust −0.05, respect −0.02. |
| `favour_ask` / word | Non-civilian, non-boss NPC with trust and respect 0.3+ toward the player, whose own boss is not the player; only if the player is not an associate (weight 1) | Success chance `0.25 + standing/150 + boss trust*0.3 (−0.15 if his problem is severe)`. Success: boss respect for him +0.08, `c.backer = player`, favour size 2 (3 for *price*). Failure: standing −1.5. |
| `favour_ask` / cover (alibi) | He did a non-minor hostile deed in the last 12 days (0.7) | *do*: heat +0.08, favour size 2, sets the fact's `hiddenActor` and clears `knowsActor` for every other character who knew. *ask*: the player learns the fact. |
| `favour_ask` / release | Someone outside the player's family is jailed (0.5) | $300 (leaves the world), `jailedUntil` cut to at most 2 days, favour size 3. |
| `mediate` | A crew member holds a grudge of 0.22+ against a non-civilian family member (1.1) | *a* / *b*: trust shifts and a favour size 1 to the man backed; *split*: both grudges −0.2, standing +1; *leave*: 35% chance of a `beating` fact. |
| `shop` | A shop the player collects from is late (1.3) | *week*: `econ.giveTime`; *half*: `takeFromBiz` of half the arrears; *hard*: `takeFromBiz(max(fee, owed), pocket)` plus `clearArrears`, trust −0.1, grudge +0.1. The opening line depends on `protection.why` (truthful versus pleading), plus `econ.evidence`. |
| `tip` | A greedy or indebted non-capo with trust 0.2+ (0.08; 30-day cooldown) | *buy* / *haggle*: price to the seller; reveals a crew member's hidden side operation (`sideKnown` plus a `side_operation` fact), his problem, his plan to leave (`p.known['leave:id']`), or a "score" via `newOffer()` (half refunded if nothing appears). |
| `callin` | A favour the player owes, more than 8 days old and not yet asked (2) | Asks for money ($300), muscle or silence. *pay* settles it (money to him, or heat +0.12, or standing −0.5); *bargain* is half, with a `0.5 + trust*0.2` chance he accepts; *stall* resets `asked` and costs respect −0.05. |
| `tell` | NPC with trust 0.5+ knows the actor of a fact against the player or his crew that the player doesn't know (0.7) | The player learns the fact **when the encounter is generated**. *thanks* names up to four others who know. |
| `debtor` | Someone behind on a debt to a third party, trust 0.25+ (0.9) | *speak*: chance-based `nextDue += 7 days`, `missed −1`, favour size 1; *cover*: the player pays the week through `payDebt`, favour size 2. |
| `shophelp` | An open dispute over a shop the player collects from (1.2) | *look*: `dispute.seen = true`; *sit*: `disputes.callSitdown`; *no*: trust −0.08. |
| `invite` | From `eventTick` | Envelope of $250 / $100 / $40 (leaves the world) or regrets; host respect and standing changes; possible boss kiss, an introduction (trust set to 0.28 both ways), an overheard fact (`learn`), a cold guest. |

`lapse()` ([encounters.ts:465](../../src/encounters.ts)) penalises silence: loan, favour_ask and tell cost respect −0.04 and trust −0.03; callin costs respect −0.1, grudge +0.08 and a minor `favour` fact; mediate raises the grudge between the two men by 0.1; invite costs host respect −0.06 and standing −0.5; threat has no effect. `pruneEnc` ([encounters.ts:399](../../src/encounters.ts)) closes scenes whose premise has gone (speaker dead, shop paid, grudge gone, prisoner out, favour settled, threat in truce, event past, debt or dispute closed, op closed, suspect dead).

**Tick hooks.** `encounterTick` and `eventTick` run in the daily event ([engine.ts:58](../../src/engine.ts)), after `memoTick` and `pendingTick`, before `dangerTick`. `choose` is called from the UI (`web.ts:617` `echoose`), from conversation (`dialogue.ts:1440`), from the club (`club.ts:132`) and by the harnesses. `forceEncounter` is called from `places.ts`.

**Depends on / used by.**
- Imports: `jobs` (`newOffer` for the "score" tip), `people` (`lateOf`, `PROBLEM_LABEL`), `econ` (`bizMove`, `clearArrears`, `evidence`, `giveTime`, `owedOf`, `takeFromBiz`), `disputes` (`sitdownChoose`, `callSitdown`), `reports` (`investChoose`), `core`, `voice` (`arch`, `pick`), and at the bottom of the file `danger` (`threatChoose`), `career` (`promoChoose`), `crewlife` (`crewChoose`), `life` (`lifeChoose`), `politics` (`politicsChoose`). Unused: `helpMan`, `hash`, local `wk`.
- Imported by: `addEnc` from `danger`, `crewlife`, `path`, `career`, `reports`, `life`, `situations`, `rackets`, `goals`, `politics`, `disputes`, `powers2`, `pulse`, `situ`; `addFavour` from `crewlife`, `dialogue`, `flows`, `career`, `meetings`, `gigs`, `situations`, `club`, `politics`, `powers2`, `pulse`; `choose` from `web.ts`, `dialogue`, `club`, `stress.ts`, `playtest/pt.ts`, `tests/v74`; `encounterTick` and `eventTick` from `engine`; `forceEncounter` from `places`; `makeLoan` from `situations`; `owedTo` from `ambition` and `ui/views_a`; `owing` and `favourWord` from `ui/views_a`.
- Circular imports: encounters ↔ danger, career, crewlife, life, politics, disputes, reports (each imports `addEnc` or `addFavour`, and encounters imports its `*Choose`).

**Invariants & rules.**
- At most 4 open encounters for the daily tick and `forceEncounter`. Other modules call `addEnc` without checking this cap.
- Business cash moves only via `econ` helpers (`bizMove`, `takeFromBiz`). Character-to-character payments are paired debit and credit, except the $300 release fee and the invite envelopes, where money leaves the world.
- Knowledge: `tell` and `inviteReply` use `core.learn`; `favour_ask`/cover *ask* teaches the player the fact. The alibi deliberately removes other people's knowledge of the actor.
- Determinism: roulette and chance rolls use `w.rng`; voice lines use `voice.pick(arr, seed)`, a deterministic FNV hash of a seed string.
- Bounds: closed encounters are dropped once 20 days have passed since they were created (`e.t`). `w.favours` and `w.events` are never pruned (grep finds no filter or splice).

**Save compatibility notes.** `ensureShape` guarantees `w.enc`, `w.favours`, `w.events` and `w.threats`. `Favour.settled`/`asked` and `LifeEvent.done` are optional (undefined means false). Cooldown keys read as `?? 0`. `w.disputes` and `w.situations` are read with `?? []`. Unknown `Enc.kind` values from future or old saves fall through to "Nothing comes of it." and close the scene.

**Known issues / gaps.**
- **Haggling with no reason accepts too easily (CLAUDE.md known bug).** In `tipReply` ([encounters.ts:787](../../src/encounters.ts)) the haggle branch at [encounters.ts:795](../../src/encounters.ts) is:

  ```ts
  if (!w.rng.chance(0.4 + c.traits.greed * -0.2 + 0.3)) {
  ```

  If that roll fails the seller walks away; otherwise the half price is accepted. That is an acceptance chance of `0.7 − 0.2 × greed`. Sellers are selected for greed above 0.5 (or a debt problem), so roughly 50–60% of half-price offers succeed, and up to 70% for a low-greed indebted seller. Nothing else matters: the player's standing, the relationship, the seller's need, and any reason offered are all ignored, and neither outcome changes the relationship. The option label offers `Math.round(price / 20) * 10`, but the code charges `Math.round(price / 2)`, which can differ by $5. `haggleJob` in jobs.ts has the same no-reason design.
- **Loan text grammar (CLAUDE.md).** `makeLoan` builds `"... It’s ${reason}. ..."` ([encounters.ts:84](../../src/encounters.ts)), and several reasons in `stated` ([encounters.ts:63](../../src/encounters.ts)) are clauses, not noun phrases: "It’s the car is finished and I need it for work", "It’s I got behind", "It’s my mother needs looking after…".
- `tipReply` reads `e.data.fact`, which `tipSale` never sets (`void f`), and `pruneEnc`'s `tip` branch checks `p.known['undefined']`. Both are leftovers from an older "sell a fact" design, as are the unused helpers `teaser()` and `implication()`. The "score" tip calls the generic `newOffer()`, which can produce any kind of job (boss errand, gig, contract), not the promised "place where money is lying around".
- `loanAsk` returns before its body (dead code; loans now come from `situations.ts`).
- In `choose`, the reply fact for a `threat` encounter uses `e.from`, which is the *informant* who relayed the warning (and is `null` at ladder levels 3–4), not the enemy (`e.about`). It records "answered {informant}" with `story: 'threat:' + informant`, while the threat story elsewhere is keyed by the enemy's id. This is probably meant to be `e.about`.
- A lapsed `callin` leaves `Favour.asked = true`, so that favour is never called in again but stays owed (and listed) forever. Only *stall* and a refused *bargain* reset it.
- `callin` "muscle" and "silence" asks only change heat or standing; no beating happens and nothing is kept secret. The `squeeze` "take it to the boss" success line says "You owe {boss} something now", but no favour or memo is recorded.
- `forceEncounter` bypasses the `favask` cooldown and repetition damping, so place visits can repeat favour asks.
- `witnessTell` teaches the player the fact at generation time, before he has read the scene.

---

## ways.ts

**Purpose.** Plain-language reference sheets ("what it is, how it pays, what it needs, what can go wrong") for the Ways page in the UI. Racket sheets are a `Record` over `rackets.ts` `OPS` keys, so adding a racket without a sheet fails to compile; the non-racket ways (protection, loans, cars, burglary, hijack, fence, scams, favours) are listed by hand.

**State owned.** None. Pure static data.

**Public API.**

| export | description |
|---|---|
| `type OpKey = keyof typeof OPS` | Racket keys (all `OpKind` except `hijack`). |
| `type WayKind = 'op' \| 'protection' \| 'loans' \| 'cars' \| 'fence' \| 'burglary' \| 'hijack' \| 'scams' \| 'favours'` | |
| `interface Way { id; kind; op?; name; cat; icon; tone: 'g' \| 'a' \| 'b' \| 'r'; pitch; how: string[]; pays; needs; risks; tip }` | |
| `WAY_CATS` | `['Standing rackets', 'Squeezing people', 'Stealing', 'Cons and favours'] as const`. |
| `type Sheet = Omit<Way, 'id' \| 'kind' \| 'op'>` | |
| `OP_SHEETS: Record<OpKey, Sheet>` | One sheet per racket. |
| `WAYS: Way[]` | Racket ways generated from `OPS` keys, followed by `OTHER_WAYS`. |
| `wayById(id: string): Way \| undefined` | Lookup. |

**Tick hooks.** None. Read by `ui/views_c.ts` (the Ways page) only.

**Depends on / used by.** Imports `OPS` from `rackets.ts`. Used by `ui/views_c.ts` and `tests/v72.test.ts`. The test checks that every op has a non-empty sheet, the counts match and ids are unique.

**Invariants & rules.** Every `OPS` key must have an `OP_SHEETS` entry (enforced by the type checker). Way ids must be unique (enforced by the test).

**Save compatibility notes.** Not saved.

**Known issues / gaps.** The figures in the prose are copied by hand from code constants, and only presence is tested. Today they match the obvious constants: set-up costs equal `OPS[k].cost`, cars sell at $550 (`sell_cars`) or $650 (garage boost jobs), pawn pays 40%, loans run at 5% a week. They will drift silently if those constants change. "Pier tolls" and "Pier loading racket" (`OPS.dock.label`) name the same racket differently.

---

## Job lifecycle

```
            mkJob (status 'offered', expires = now + days)
                  |
   +--------------+-------------------+-----------------------------+
   | takeJob (player)                 | assign (crew, due 1-3 d)    | declineJob -> 'declined'
   v                                  v                             | daily: now >= expires -> 'expired'
 'active' (player)               'active' (crew)                    | pruneJobs/staleReason -> 'expired'
   | resolve(code) -> conclude        | daily: due <= now -> runCrewJob -> resolve -> conclude
   | dropJob -> 'declined'            |   (or fail branches set 'failed' directly, with a Report)
   v                                  v
 'done' | 'failed'               'done' | 'failed'  + j.rep (Report), then j.acked when the player reads it
```

- **Creation.** `mkJob` with `via`: `boss` (`bossOffer`, `orders.bossErrand`, `meetings.ts` summons, `path.ts`/`career.ts` induction summons and a `path.ts` trial hit, `books.ts` accounts summons, `meetings.ts:742` handle), `tip` (`tipFrom`, plus `dialogue.ts:2134`/`2189` promise jobs created already `active`), `contract` (`contractOffer`, and blackmail from `consequences.ts:91`), `opportunity` (`oppOffer`, `gigs.ts`), `scheme` (`startScheme`, plus crew ideas approved in `meetings.ts:638`), `order` (`orders.ts:341`, the player's own orders to crew). `mkJob` may return an existing job instead of creating one (see jobs.ts).
- **Offered → active.** `takeJob` (player) or `assign` (crew; sets `due`, `orders`). Jobs can also be created `active` directly (`status` in `NewJob`). `meetings.ts` and `web.ts` set `status = 'active'` and `'done'` directly for summons and meetings.
- **Active → done/failed.** `resolve()` → `conclude()` for the player and for crew (through `orders.runCrewJob`). `runCrewJob` first rolls a `Behaviour` (`clean`, `skim`, `gamble`, `unavailable`, `distracted`, `confront`, `mercy`, `bungle`) and may fail the job without calling `resolve`.
- **Closed without an outcome.** `declined` (`declineJob` from offered, `dropJob` from active, `dialogue.ts:2273` "refuse", `meetings.ts` excuses). `expired` (`daily` deadline for offered jobs; `pruneJobs` staleness; `assign` "Taken up under another name."; `consistency.reconcile` duplicates and one-job-per-man; `core.onDebtCleared` when the debt is paid). There is no timeout for the player's own active jobs.
- **Reports and lies (`rep`).** Only delegated jobs get a `Report { text, truth: Behaviour, lie, found?, amt?, by }`, written by `orders.runCrewJob` ([orders.ts:178](../../src/orders.ts)). When a crew man skims or gambles he takes part of the money from the player's cash and reports a false story (`lie: true`). `orders.questionReport` can draw out the truth (`found`), with chance based on trust, respect and the player's caution. The Today view lists unread reports (`ui/views_a.ts:61`, `rep && !acked`), and `web.ts` `ack` sets `acked`. Separately, `reported` marks a *done* job the player has walked its giver through (`dialogue.ts:2251`; standing +1 per job, up to 2 at a time).
- **Reasons (`reason`, `why`, `claimTrue`, `subject`).** `reason` is the stated cause; `why: { motive, surface, deep, hidden? }` is the voiced explanation from `voice.whyOf`/`bossWhy`; `claimTrue` is the hidden truth of the accusation (`undefined` for blackmail). The player can probe through `questionJob` (tells), `pressJob` (`why.deep`), `investigateJob` (world check), `askAroundJob` (third-party view), and in conversation `dialogue.ts` `challenge` (what the giver actually knows about the cause fact). Findings accumulate in `j.notes` and `j.checked`. Downstream: killing on a false claim (`claimTrue === false`) passes `false: true` to `afterClient`/`afterKilling`, which with 70% probability schedules a `truth` pending entry that exposes the accuser 21–56 days later (relationship damage to the accuser and the killer, an `exposed` fact, standing −4 for a player killer). A beating on an innocent target raises his grudge through `actions.perform`. `disproved` is computed but read nowhere.

---

## Commitments

"Commitment" here means any persisted record of something owed, promised, threatened or pending between characters. The family is spread over seven stores and several modules. They are only loosely linked: the links are `Memo.ref` → job or fact, `Job.debt` → debt, `Enc.data.fav`/`debt`/`dispute` → record, and `Pending.fact` → fact.

| record | store | shape (types.ts) | created | resolved / expired | bounded? |
|---|---|---|---|---|---|
| Memo | `Character.memos: Memo[]` on the *remembering* NPC; `other` is the counterparty (usually the player) | `kind: 'promise' \| 'threat' \| 'agreement' \| 'question' \| 'favour'`, `text`, `due?`, `done?`, `ref?` (a job id for job promises, a fact id for questions) | `dialogue.ts` (chop-shop and fee agreements 1134/1151/1170/1262, loans 1213/1294, threats 1274/1548/2224, favour 1355, question 1412, "find out who" question 2125, promise jobs 2135/2190), `flows.ts:36` `memoOnce` (no `due`), `career.ts:172/396/474` (pushed onto the player's own memos), `meetings.ts:673` (promise to make good arrears) | `memoTick` ([dialogue.ts:2338](../../src/dialogue.ts), daily): when `due` passes the memo is marked done, and if not kept the NPC's trust −0.1 and respect −0.06, the player's standing −1, and a minor `ruling` fact "didn't keep his word" is added (read by `memory.ts` recall lines). "Kept" means: a promise with `ref` whose job is `done`; a promise without `ref` when `p.books.arrears === 0`; a question with `ref` that both now know the actor of. Any other kind with a `due` counts as broken. Also closed by `dialogue.ts:2283` (selecting a promise whose job is done), `dialogue.ts:2291` `answer`, `core.onDebtCleared`, and `consistency.reconcile` (ref fact resolved). | Yes: over 24 per character, done memos are dropped and the newest 24 kept. |
| Favour | `w.favours: Favour[]` | `from` did `to` a good turn; `size` 1–3; `what`; `settled?`; `asked?` | `encounters.addFavour` only. Callers: encounters (loan give, word, cover, release, mediate, debtor), crewlife, dialogue, flows, gigs, politics, powers2, pulse, situations, career, club, meetings | `encounters.callReply` (the player repays an NPC); `flows.ts:129` (an NPC repays the player by speaking for him, `backer`); `powers2.ts:290` (cash a favour in); `asked` is set by the `callIn` generator | **No** pruning |
| Debt | `w.debts: Debt[]` | `creditor`, `debtor`, `principal`, `balance`, `weeklyRate`, `weeklyPayment` (12% of principal), `nextDue`, `missed`, `status: 'active' \| 'paid' \| 'defaulted' \| 'void'`, `reason`, `cause?`, `paid?` | `core.createDebt` (posts a ledger `loan` but moves no cash; the caller moves it). Callers: actions, crewlife, encounters (loan), goals, dialogue, meetings, situ, people, situations, world | Weekly in `engine.ts:128`: interest applied, payment taken via `core.payDebt`, or `missed++` with a `debt_missed` fact; at 4 misses `defaulted`, a `debt_default` fact and `econ.seizeShare`. `payDebt` (also called from actions collect, club, dialogue, encounters debtor, goals, situ) sets `paid` and runs `onDebtCleared` (expires jobs, closes memos, lapses encounters with `data.debt`). `void` on death (`core.handleDeath`, engine) or `goals.ts` intimidation. | **No** pruning |
| Threat | `w.threats: Record<Id, Threat>` keyed by enemy id | `level` 0–4 (rumour, warning, menace, attempt), `since`, `last`, `warned`, `truce`, `hidden`, `lethal` | `danger.threatOf` / `step` (called by `dangerTick` for NPCs with a high grudge and violence, family hunts, and `danger.menace`); each step adds an `Enc` of kind `threat` | `danger.threatChoose` via `encounters.choose` (boss, sit-down, pay → truce or reduced level; strike; hide; shrug); `dangerTick` decays the level when the grudge is below 0.3 and deletes the entry when the enemy is dead. A lapsed threat encounter has no effect. | Pruned on enemy death |
| Encounter | `w.enc: Enc[]` | see encounters.ts | `encounters.addEnc` (encounters plus 14 other modules) | `choose` (`done`), `lapse` (`lapsed` with penalties), `pruneEnc`, `core.onDebtCleared`, `crewlife`, `goals`, `situ` | Closed ones dropped 20 days after creation |
| Job | `w.jobs: Job[]` | see Job lifecycle | `jobs.mkJob` (jobs plus 8 other modules) | see Job lifecycle | Trimmed when over 80 |
| Pending | `w.pending: Pending[]` | `due`, `kind: 'reveal' \| 'heat' \| 'blackmail' \| 'truth' \| 'dispute' \| 'seat' \| 'intent' \| 'plan' \| 'hunt'`, `fact?`, `a?`, `b?`, `c?`, `amount?`, `tries?`, `note?` | `reveal`: `core.addFact` (30% of hidden-actor facts, 14–56 days) and `jobs.declineJob` (blackmail). `heat`: `consequences.afterKilling`. `blackmail` / `truth`: `consequences.clientParts`. `intent`: `actions.ts:402` (retaliation), `disputes.ts:133`, `encounters.ts:533`. `dispute`: `disputes.ts:110`, `revenge.ts:180`. `hunt`: `violence.ts:74`. `seat` and `plan`: no creator found by grep. | `consequences.pendingTick` (daily, [consequences.ts:36](../../src/consequences.ts)) removes due entries and handles them: `reveal` (victim, protector and close ones learn the actor), `heat`, `blackmail` (creates a pay-0 `handle` job via `contract`), `truth` (exposes a false accuser), `intent` → `disputes.intentDue`, `hunt` → `violence.huntDue`, `dispute` → `disputeStep` (re-queued while the mediator is jailed), `seat` → `seatDecision`. `plan` has no handler. | Drained when due |

Related records documented with their own modules: `Grievance` (`w.grievances`), `Dispute` (`w.disputes`), `Situation` (`w.situations`, whose `ask` links to an encounter), the player's word record `Character.rep` (`kept`/`broken`/`asked`/`ignored`, kept by crewlife and powers2), and `w.path.favs` (favouritism counters in powers2).

Findings across the family:
- **Completed promises still listed (CLAUDE.md).** A job-promise memo is closed only at its `due` date by `memoTick`, or when the player selects it in conversation after the job is done (`dialogue.ts:2283-2286`). `consistency.reconcile` looks up `w.facts[m.ref]`, which never matches a job id. So a finished promise stays on the memo list until its 10-day due date.
- **Ignored versus failed promises (CLAUDE.md).** See jobs.ts Known issues: the player's active jobs never expire, so ignoring a promise costs only the `memoTick` penalty, while failing it also costs `conclude()`'s trust −0.06.
- The question memo at `dialogue.ts:1412` has a `due` but no `ref`, so `memoTick` always counts it as broken after 30 days, whatever the player did. Its text also embeds the internal `want.kind` key ("He told you what he wants (independent)…").
- **Favour direction looks inverted in `powers2.ts`.** `Favour` means `to` owes `from` (`owedTo`, `owing`, `flows.ts`, `memory.ts`, `ui/views_a.ts:206` and `ambition.ts` all read it that way). `powers2.ts:143` lists favours with `f.to === p.id` (favours the player *owes*) under "Collect from {from} … He owes you", and `powers2.ts:290` then takes up to `size*400 + 200` from `f.from` and pays it to the player.
- `w.favours`, `w.debts` (closed ones), `w.events` and `w.ventures` grow without bound. They may contribute to the undiagnosed save-size failure around day 60 noted in CLAUDE.md, but this has not been measured.
- Tip and contract jobs say "{giver} owes you one now" on success (`conclude()`), but no `Favour` is created, so the call-in, backing and recall systems never see it.

---

## How this group connects to the rest

- `jobs.bossOffer` ← `core` knowledge (`boss.known[f].knowsActor`), `w.debts` (missed payments), boss grudges (`rels`), `econ` `concealedGap` (skimming truth) → `orders.bossErrand` for errands.
- `jobs.resolve` → `actions.perform` (collect, shakedown, retaliate beat/hit) for the violent and financial core; → `econ.bizMove` (via `paid`) when a giver pays from his till; → `core.addFact` / `notifyProtector` (robbery, theft, burglary, scam, murder facts that then spread as knowledge and grudges); → `consequences.afterClient` / `afterKilling` (delayed heat, blackmail, truth); → `core.handleDeath`.
- Delegated jobs: `jobs.assign` → `jobs.daily` → `orders.runCrewJob` → `jobs.resolve` → `Job.rep`, read by `ui/views_a.ts` and `orders.questionReport`.
- Income from jobs goes through `core.earn` into `books.gross[src]`, which `books.ts` settlement uses for the weekly kick-up. Boss jobs move `p.standing`, which `career.ts`/`path.ts` read for promotion.
- `consequences.pendingTick` → `jobs.mkJob` (blackmail jobs) → `jobs.declineJob` → `w.pending` `reveal` → `core.learn` (the client tells people).
- `encounters.choose` is the hub through which `danger`, `crewlife`, `career`, `life`, `politics`, `reports`, `disputes` and `rackets` scenes are answered. `encounterTick` reads `w.favours`, `w.debts`, `w.disputes`, crew `books`/`problem`/`want`, and `econ` lateness.
- Encounter choices write commitments: `core.createDebt` (loans), `addFavour` (many), `payDebt`, `econ.giveTime`/`takeFromBiz`/`clearArrears` (shop arrears), `disputes.callSitdown`, and `situations` (`helped`, `stage`).
- `encounters.eventTick` → `w.events` → `invite` encounters → `core.learn` (overheard facts) and relationship changes with the host and the boss.
- `core.onDebtCleared` reaches into both stores: it expires jobs and lapses encounters tied to a debt.
- `ways.ts` ← `rackets.OPS` → `ui/views_c.ts`.

## Replacing this system

A drop-in replacement must provide the following.

- **The exported surface other modules actually call.**
  - jobs: `mkJob` (with its dedupe semantics and `NewJob` shape), `bossOffer`/`forceBossOffer`, `tipFrom`, `oppFrom`, `newOffer`, `daily`, `ventureWeek`, `activityOf`, `approaches`, `assign`, `resolve`, `takeJob`, `declineJob`, `dropJob`, `pruneJobs`, `staleReason`, `startScheme`, `schemes`, `performMove`, `crewMoves`, `ventureOf`, `canQuestion`, `jobChecks`, the five check functions, `paid`, `jail`, `bump`, `KIND_LABEL`, `KIND_HELP`, `standingWord`, `traitWords`, and the `Approach`/`Result`/`Move`/`SchemeOpt` types.
  - encounters: `addEnc`, `addFavour`, `choose`, `encounterTick`, `eventTick`, `forceEncounter`, `makeLoan`, `owedTo`, `owing`, `favourWord`.
  - ways: `WAYS`, `WAY_CATS`, `Way`, `wayById`, `OP_SHEETS`.
- **The World fields and their exact shapes.** `w.jobs` (`Job`, including `status` strings, `via`, `rep`, `why`, `claimTrue`, `extra`), `w.enc` (`Enc` with `status: 'open' | 'done' | 'lapsed'` and the `data` keys listed above), `w.favours`, `w.ventures` and `w.events` must keep their shapes, because old saves contain them and `oldsave.test.ts` loads genuine fixtures. Character fields `cars`, `goods`, `cooldown.scammed`/`favask`/`tipsale` and the `known['leave:<id>']` convention are also read elsewhere.
- **The ticks.** The daily `daily` (before `memoTick`/`pendingTick`, so a blackmail job created by `pendingTick` appears the same day), `encounterTick` and `eventTick`, and the weekly `ventureWeek`.

What makes replacement hard:

- **Direct field access from outside.** `Job.status` is written directly by `orders.runCrewJob`, `core.onDebtCleared`, `consistency.reconcile`, `dialogue`, `meetings` and `web.ts` (plus the `bot.ts`/`stress.ts` harnesses), and `Enc.status` by `core`, `crewlife`, `goals` and `situ`. `consistency.audit` encodes job invariants (one active job per NPC, no duplicate active work, no jobs on settled debts) that a replacement must still satisfy. The UI filters on raw status strings and on `rep`/`acked`/`reported`.
- **Circular imports.** jobs ↔ orders ↔ gigs ↔ consequences, and encounters ↔ seven modules whose `*Choose` functions it dispatches to. `choose()` has to keep routing kinds it does not own, or every owner must be rewired.
- **Shared mutable records.** `w.pending`, `w.debts`, `Fact` objects (the alibi rewrites `knowsActor` for other characters; blackmail rewrites `actor`) and `Situation` objects are mutated from here and from many other modules.
- **Implicit contracts.** `mkJob` returns existing jobs (callers compare `w.jobs.length` before and after to detect a new offer); `bossOffer`'s boolean means "had candidates", not "created a job"; `paid()` pays from the giver's pocket and till with a 35/65 crew split; `earn` source strings feed kick-up accounting.
- **Hidden global.** `w0` in jobs.ts must be set before `pickTell` runs.
- **Hand-copied numbers.** The economy figures in `ways.ts` text must be kept in step with the constants by hand.
