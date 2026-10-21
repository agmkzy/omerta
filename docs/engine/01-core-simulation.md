# Simulation core and world foundations

In game terms, this group is the city itself: the clock that moves 1970 New York forward, the people, families and shops that exist when a new game starts, the rule that everything that happens becomes a remembered event (a `Fact`) that only some people know about, the relationships between every pair of people, debts and death, and a few pieces of ambient life (the Monday paper, the club, the barber, what a man brings up about your shared past). In code terms it is the deterministic kernel every other module stands on: the seeded RNG ([rng.ts](../../src/rng.ts)), the single serialisable `World` type ([types.ts](../../src/types.ts)), the event queue and the fixed order of daily, weekly and per-NPC work ([engine.ts](../../src/engine.ts)), the most-imported helper module ([core.ts](../../src/core.ts): facts, knowledge, relationships, scheduling, money bookkeeping, debts, death), world generation and shape repair ([world.ts](../../src/world.ts)), the weekly retention sweep that keeps the save from growing without limit ([retain.ts](../../src/retain.ts)), and the consistency audit and daily repairs ([consistency.ts](../../src/consistency.ts)).

> **Tracked bugs:** the "Known issues" notes below were checked against the source, and the confirmed ones are filed as GitHub issues: [`area: simulation`](https://github.com/agmkzy/omerta/issues?q=is%3Aissue+milestone%3A%22V85+baseline+review%22+label%3A%22area%3A+simulation%22).

## Modules

| File | Lines | Responsibility |
|---|---|---|
| [rng.ts](../../src/rng.ts) | 27 | Seeded mulberry32 PRNG class `Rng`; the only legitimate source of randomness in the simulation. |
| [types.ts](../../src/types.ts) | 688 | All shared data shapes: `World`, `Character`, `Business`, `Family`, `Fact`, `Debt`, jobs, situations, goals, etc., plus the time constants `HOUR`, `DAY`, `WEEK`. |
| [engine.ts](../../src/engine.ts) | 317 | The game loop `advance()`, per-NPC `think`, the weekly economy block, `serialize`/`deserialize` with schema migrations, CLI `history`/`report`. |
| [core.ts](../../src/core.ts) | 400 | Facts and knowledge (`addFact`, `learn`), relationships (`rel`, `link`), event scheduling, income bookkeeping (`earn`, `record`), debts, death and succession hooks, formatting helpers. |
| [world.ts](../../src/world.ts) | 329 | `createWorld` generator, `ensureShape` collection repair, `addShops`, `spawnCivilian`, name and business tables. |
| [people.ts](../../src/people.ts) | 157 | Skills and aptitude, personal problems (gambling, drink, debt...) and their weekly drain, the player helping a man. |
| [places.ts](../../src/places.ts) | 104 | The three rooms (club, barber, bar): who is present, and the player's "sit at the club", "get a shave", "have a drink" actions. |
| [where.ts](../../src/where.ts) | 21 | `whereIs`: where a character is right now, relative to the player. |
| [retain.ts](../../src/retain.ts) | 122 | Fact retention tiers, gossip caps, and the weekly `sweep` that drops expired facts and thins knowledge. |
| [consistency.ts](../../src/consistency.ts) | 68 | `audit()` (read-only cross-system checks used by tests) and `reconcile()` (daily repairs). |
| [pulse.ts](../../src/pulse.ts) | 447 | Weekly ambient world: NPC wants drifting, shops changing hands between families, new shops, turf disputes, family offers and everyday encounters for the player. |
| [news.ts](../../src/news.ts) | 56 | The Monday paper, written from the last week's non-minor facts. |
| [memory.ts](../../src/memory.ts) | 65 | `recall`: the one remark about your shared history a man might make in conversation today. |
| [notebook.ts](../../src/notebook.ts) | 16 | The player's contact book: tags and pins on people. |
| [background.ts](../../src/background.ts) | 65 | The player's pre-1970 background chosen at new game: who already knows him, small skill/cash/standing adjustments. |

## The tick, step by step

This section is the authoritative description of the game loop for the whole documentation set.

### Time and the queue

- Time is an integer count of minutes since the start: `HOUR = 60`, `DAY = 1440`, `WEEK = 10080` ([types.ts:4](../../src/types.ts)). Minute 0 is Monday 2 March 1970, 00:00 ([core.ts:15](../../src/core.ts)); a new world starts at minute 480 (08:00 on day 0) ([world.ts:147](../../src/world.ts)).
- `w.queue` is an array of `Ev { t, seq, kind: 'think' | 'weekly' | 'daily', who? }` kept sorted by `(t, seq)`. `core.schedule` inserts by binary search and stamps `seq = w.seq++`, so events at the same minute run in the order they were scheduled ([core.ts:53](../../src/core.ts)).
- `createWorld` schedules the first weekly event at day 6 20:00 (Sunday evening), the first daily event at day 1 09:00, and one `think` per non-player character at a random minute in the first three hours ([world.ts:278](../../src/world.ts)). Every daily and weekly handler reschedules itself at the end, so the queue always holds exactly one `daily` (every day at 09:00), one `weekly` (every Sunday at 20:00) and at most one `think` per living NPC. A seed-3 world starts with 164 events (162 thinks) and holds 165 from day 60 to day 180 (one new shop owner).
- Time only moves when the UI (or a test, the CLI, the bot, the playtest driver) calls `advance(w, until)`. In the browser, `web.ts pass(minutes)` calls `advance(w, w.now + minutes)` after each player action, then `jobs.pruneJobs`, and if the player was jailed during that span it calls `advance(w, p.jailedUntil)` to skip the sentence; it then autosaves ([web.ts:169](../../src/web.ts)). Player actions themselves are performed before `advance`, by `actions.perform` (for `doAction`) or the relevant module (dialogue, encounters, jobs, places...).

### `advance(w, until)` ([engine.ts:40](../../src/engine.ts))

1. While the head of the queue has `t <= until`: shift it, set `w.now = ev.t`, and dispatch on `ev.kind` (weekly, daily, otherwise think).
2. After the loop, `w.now = Math.max(w.now, until)`.

If any handler throws, the event has already been removed and its successor is never scheduled, so the daily or weekly clock stops for that world (and stays stopped if the world is then saved).

### Weekly event (Sundays 20:00)

`engine.weekly(w)` runs first ([engine.ts:91](../../src/engine.ts)); its steps, in order:

1. `paperTick` ([news.ts](../../src/news.ts)): print the Monday paper from the previous seven days' non-minor facts into `w.papers` (ring of 10).
2. `lapsedAsks` ([crewlife.ts](../../src/crewlife.ts)): every crew encounter (`kind 'crew'`) that lapsed unanswered costs the player trust/respect with the asker and counts as ignored/broken in `p.rep`.
3. `crewTick` ([crewlife.ts](../../src/crewlife.ts)): every non-civilian NPC gets a `want`; occasional nicknames; between the player's crew, at most one friendship, falling-out, private loan (`createDebt`) or side arrangement; wants shape crew behaviour (a restless man may go over the player's head); `favourRequest`; keeps two "tells" for the Sunday page in `w.sunday`. Player-gated.
4. Briefing snapshot (inline): push `{ t, cash, standing, heat, rank, kids }` for the player onto `w.snaps` (ring of 6).
5. Hunt expiry (inline): a family's `hunt` is deleted when its target is dead or after `(60 + sev*15)` days.
6. Random shop robbery (inline): for each open non-casino business not under guard, 1% (protected) or 4% (unprotected) chance; a random living, unjailed associate or soldier (the player is not excluded, see Known issues under engine.ts) robs it, unless he owns it or his family protects it, of $150-450 via `econ.bizMove(..., 'theft')` and `core.earn(thief, amt, 'scheme')`, heat +0.1; a `robbery` fact with `hiddenActor` and up to two witnesses; `notifyProtector`.
7. `businessWeek` ([econ.ts](../../src/econ.ts)): each business's week: revenue, costs, protection fee, stakeholders' shares, the owner's draw, managers appointed, accounts struck into `acct`.
8. Former protectors informed (inline): for each business with `informPrev`, that man `learn`s the fact from the owner; the marker is deleted.
9. Debts fall due (inline): for each active debt with `nextDue <= now`: void if either party is dead; otherwise compound `balance *= 1 + weeklyRate`, then if the debtor's cash plus his business till above $100 covers `min(weeklyPayment, balance)` call `core.payDebt`, else `missed++` and a `debt_missed` fact (minor after the first); on the fourth miss the debt is `defaulted`, a `debt_default` fact is added and `econ.seizeShare` gives the creditor a 15% stake in the debtor's business. `nextDue += WEEK` in all cases.
10. `hustleWeek` ([hustle.ts](../../src/hustle.ts)): every NPC associate/soldier in a family runs his own line of work (numbers, bookie, loans, cars...): choose or change hustle, possibly expand, earn the week's net via `earn`, risk of heat and street arrest.
11. `turfWeek` ([path.ts](../../src/path.ts)): districts the player has claimed (`w.path.turf`) pay him 10% of each business's income via `bizMove(..., 'extort')` and `earn`. Player-gated.
12. `orgWeek` ([orgs.ts](../../src/orgs.ts)): `ensureClubs`, `leadershipWeek`, sync each family's `hq` and club host, `treasuryWeek`, `relWeek`, `standingWeek`, `churnWeek`, `retireWeek`.
13. `rankWeek` ([powers2.ts](../../src/powers2.ts)): player-only rank powers: records `path.origin`, adds `p.books.side` to the player's cash "off the books", then `ledgerTick`, `lifeWeek`, `stakeWeek`, `agendaTick`, `commissionWeek`, `consigTick`. Player-gated.
14. `reportTick` ([reports.ts](../../src/reports.ts)): each man in the player's crew decides which facts from the last week he will tell the player (`learn` with the teller as source), by reporting style and the player's `w.expect`. Player-gated.
15. `situationTick` ([situations.ts](../../src/situations.ts)): pre-V75 situations (money trouble, ambition) for people near the player: emerge, progress through brewing/handling/asking, offer loans, resolve. Situations with a `key` (V75) and `turf`/`org` kinds are skipped here. Player-gated.
16. `sitWeek` ([situ.ts](../../src/situ.ts)): V75 situations: pacing statistics in `w.sitpace`, `syncLinks`, `leak`, `crewWord`, `tributeScan`, `debtScan`, `partnerScan`; open situations of a stepped kind that began more than 20 weeks ago fade. Gated by the `SIT.on` switch.
17. `friendsTell` ([sitmoves.ts](../../src/sitmoves.ts)): at most one trusted family member per week whispers something about a situation to the player. Player-gated.
18. `pulseWeek` ([pulse.ts](../../src/pulse.ts)): `motiveTick`, `ambientWeek`, `turfStart`, `turfAdvance` for open turf situations, `orgOffer`, `lifeOffer` (see pulse.ts below). Player-gated.
19. Seat quotas (inline): for each family with an NPC boss, a small chance (0.4% plus up to 2% from total tension) that the boss opens one more soldier (80%) or capo seat in `fam.capBonus` (max 3 each).
20. Wages and living (inline): every living character: `cash = max(0, cash + wage - LIVING[rank])`, then a lifestyle spend of 6-10% of cash above a rank floor; both go into `books.expenses`. Wages are a money source, living and lifestyle are sinks.
21. Obligations (inline): 30% chance the player is asked for an envelope (wedding, wake, bail...) scaled by rank; paid only if he can afford it; a minor `report` fact.
22. `peopleWeek` ([people.ts](../../src/people.ts)): NPC personal problems start, worsen, drain cash, show signs (`trouble` facts), may trigger a crisis loan, or pass; prospects drift away.
23. `settleWeek` ([books.ts](../../src/books.ts)): family levies, greedy superiors squeezing kick-up rates, side operations pay out (for every character with `books.side`, the player included), then every family member settles his kick-up from the bottom of the chain up (`settleOne`), `rateTalks`, and finally every character's weekly `books.gross`, `expenses`, `received` and `weekIncome` are reset to zero.
24. `careerTick` ([career.ts](../../src/career.ts)): each family fills a vacant capo or soldier seat with its best eligible NPC candidate (50% chance per week when one exists), noting when the player was passed over.
25. `agencyWeek` ([goals.ts](../../src/goals.ts)): NPC goals (`w.agency`): end goals of the dead, handle lapsed questions to the player, let active NPCs form goals, step every goal whose review is due, expire cooldowns, `joinAsk`. Gated by `AGENCY.on`.
26. `purge` ([consequences.ts](../../src/consequences.ts)): a violent, ambitious capo/underboss/boss may (1.2%) have a lower-ranked man in his own family he holds a grudge against killed: `core.handleDeath`, a hidden-actor `murder` fact broadcast to the victim's friends, `afterKilling`.
27. Relationships, heat and arrests (inline), for every living character: every grudge decays by 8% (to 0 below 0.05); trust and affection toward anyone not met in 14 days decay by 6% with a floor of 0.1; then if `heat > 0.45` a `heat * 0.5` chance of arrest (jailed 5-40 days, heat reset to 0.1, lawyer cost up to 15% of cash capped at $500, an `arrest` fact broadcast to his family), otherwise heat falls by 0.08.

Then, still in the weekly branch of `advance` ([engine.ts:44](../../src/engine.ts)):

28. `sweep` ([retain.ts](../../src/retain.ts)): drop expired facts and thin knowledge (see retain.ts below).
29. `repairAll` ([rank.ts](../../src/rank.ts)): `repairHierarchy` for every family (dead or missing bosses, broken `bossId` chains); returns diagnostics only.
30. `ventureWeek` ([jobs.ts](../../src/jobs.ts)): the player's chop-shop ventures process stock, pay the host his share and the owner via `earn`, and risk a police raid.
31. `opsWeek` ([rackets.ts](../../src/rackets.ts)): the player's rackets (numbers, bookie, vending...) produce the week's take, risk raids and rival squeezes, and runners may skim. Returns if there is no player.
32. `politicsWeek` ([politics.ts](../../src/politics.ts)): after day 45 an informant may be chosen once; informants accumulate evidence, are glimpsed (`rumour` facts), may lead to a federal indictment (`raid` fact, mass jailing), and may prompt a suspicion encounter for the player.
33. `schedule(w, w.now + WEEK, 'weekly')`.

Order matters for the money: anything credited through `record`/`earn` before step 23 counts toward this week's kick-up settlement; anything credited after it (steps 24-32, and every daily and think event until next Sunday) counts toward next week's.

### Daily event (09:00 every day)

1. `daily` ([jobs.ts](../../src/jobs.ts)): `pruneJobs` (expire stale offers/active jobs with a reason), expire offered jobs past their deadline (ignored boss jobs cost standing and trust; a second ignored summons in 30 days gets the player beaten or his kick-up raised), auto-resolve NPC jobs that are due, trim `w.jobs` when it exceeds 80 entries, offer a new job (60% when fewer than four are on offer), `gigTick`. Returns at once if there is no player; skips new offers if he is dead.
2. `sitDay` ([situ.ts](../../src/situ.ts)): V75 situations: questions to the player that ran out of time are settled by an NPC chair; due situations take one step (skim, intel, tribute, debt, partner, grudge). `SIT.on`-gated.
3. `summonsTick` ([meetings.ts](../../src/meetings.ts)): the player's boss may call a family meeting, an accounts meeting, etc. (as a `summons` job). Player-gated.
4. `memoTick` ([dialogue.ts](../../src/dialogue.ts)): every memo (promise, question...) past its due date is judged kept or broken; broken ones cost trust/respect (and player standing) and add a minor `ruling` fact "X didn't keep his word to Y"; memos are bounded to 24 per character.
5. `pendingTick` ([consequences.ts](../../src/consequences.ts)): run every due `w.pending` item: `intent` (a planned NPC action, performed via `actions.perform`), `hunt`, `seat`, `dispute` (a superior takes up a complaint), `reveal` (a hidden culprit comes out to the people hurt), `heat`, `blackmail`, `truth`.
6. `encounterTick` ([encounters.ts](../../src/encounters.ts)): prune and lapse expired encounters, drop old closed ones, and (if fewer than four are open) maybe generate one new encounter for the player from the weighted generators. Player-gated.
7. `eventTick` ([encounters.ts](../../src/encounters.ts)): funerals for ranked men who died in the last three days, and occasional weddings/dinners, pushed into `w.events` with invitations. Player-gated.
8. `dangerTick` ([danger.ts](../../src/danger.ts)): threats against the player escalate or cool; NPCs with a strong grudge (or a family hunt) may start a new threat. Player-gated.
9. `opsDaily` ([rackets.ts](../../src/rackets.ts)): resolve hijackings that are due; raided rackets reopen when their closure ends.
10. `promoTick` ([career.ts](../../src/career.ts)): advance the player's promotion case `w.promo` through sponsor, rival, boss and decision stages. Player-gated.
11. `pathTick` ([path.ts](../../src/path.ts)): count completed jobs by the player and his men as deeds toward the next rank; settle due guarantees the player stood for.
12. `politicsCoup` ([politics.ts](../../src/politics.ts)): resolve a running coup when due, or let an ambitious, disrespectful underboss start one.
13. `commissionTick` ([politics.ts](../../src/politics.ts)): every 28 days, if the most tense pair of families exceeds a threshold, the Commission rules on them.
14. `lifeDaily` ([life.ts](../../src/life.ts)): the player's private life: kin and partner warmth decay, partner trouble, births, proposals, introductions, the fortnightly Sunday dinner, a mother's illness. Player-gated.
15. `christeningDue` ([life.ts](../../src/life.ts)): called inline only if the player is alive; offers the christening encounter for his child.
16. `ambitionTick` ([ambition.ts](../../src/ambition.ts)): the player's current ambition, and completion of milestone ambitions recorded in `w.goals.done` with their rewards. Player-gated.
17. `reconcile` ([consistency.ts](../../src/consistency.ts)): daily repairs (see consistency.ts below).
18. `disputeScan` ([disputes.ts](../../src/disputes.ts)): merge duplicate disputes, open a dispute for each new cross-family incident fact since the last scan (or mark agreed terms as violated), lapse disputes idle for 60 days, drop old closed ones.
19. `disputeTick` ([disputes.ts](../../src/disputes.ts)): each open dispute whose `next` is due: the offender presses, eases off or pays; the injured side takes it up the chain (a `dispute` pending) or plans a reply.
20. `schedule(w, w.now + DAY, 'daily')`.

### Think event (per NPC, continuous)

`think(w, id)` ([engine.ts:78](../../src/engine.ts)):

1. If the character is missing, dead or the player: return without rescheduling (his think chain ends for good).
2. If jailed: reschedule at `jailedUntil + rng.int(10, 120)`.
3. If asleep (`core.isAwake` false): reschedule at `core.nextWake` plus `rng.int(0, 90)`.
4. Otherwise `actions.chooseAction(w, c)` scores the options of each kind (work, socialise, lend, collect, shakedown, gamble, retaliate; only `work` when hurt; no shakedown/retaliate while `cooldown.restraint` is running) with a small random jitter, and `actions.perform(w, action)` carries it out and returns the minutes it took.
5. Reschedule at `now + minutes + rng.int(15, 90)`.

Only `createWorld` ([world.ts:280](../../src/world.ts)) and `addShops` ([world.ts:325](../../src/world.ts)) ever start a think chain. Characters created any other way (`spawnCivilian`: the player's mother, sibling, partners, children, business managers) never act on their own.

## rng.ts

**Purpose.** A tiny seedable mulberry32 generator. Every random decision in the simulation is drawn from one instance stored at `w.rng`, so a seed plus the same sequence of player actions reproduces the same history exactly.

**State owned.** `World.rng` (an `Rng` instance in memory; saved as its `state` number by `serialize`).

**Public API.**

| Export | Returns | Notes |
|---|---|---|
| `class Rng { state: number; constructor(seed: number) }` | | `state = seed >>> 0`. |
| `next(): number` | `[0, 1)` | Advances `state`. |
| `range(a: number, b: number): number` | float in `[a, b)` | One draw. |
| `int(a: number, b: number): number` | integer in `[a, b]` inclusive | One draw. |
| `chance(p: number): boolean` | `next() < p` | One draw. |
| `pick<T>(arr: T[]): T` | an element | One draw; returns `undefined` for an empty array. |

**Tick hooks.** None directly; used by everything.

**Depends on / used by.** No imports. Imported by [engine.ts](../../src/engine.ts) (to rebuild `w.rng` on load), [world.ts](../../src/world.ts) (new world), [people.ts](../../src/people.ts) (`rollSkills` takes an `Rng`), [types.ts](../../src/types.ts) (type only) and `tests/v79.test.ts`.

**Invariants & rules.** Never use `Math.random`, `Date.now` or wall-clock time in simulation code. The number and order of draws is part of the save's identity: adding, removing or reordering a draw anywhere changes every subsequent event for every seed. `engine.deserialize` builds a fresh `Rng(0)` and overwrites `state`, and `deserialize` also derives throwaway `Rng`s from `w.seed` for backfilling skills, so those do not disturb `w.rng`.

**Save compatibility notes.** Saved as a bare number under `rng`.

**Known issues / gaps.** None in the module. Non-simulation code legitimately uses `Math.random`: the new-game seed and the "shuffle face" button in [web.ts](../../src/web.ts), and the CLI's default seed uses `Date.now()`.

## types.ts

**Purpose.** The single source of truth for every serialisable data shape. There are no classes in the world model apart from `Rng`; everything is a plain object so that `JSON.stringify` is the save format. It also exports the time constants `HOUR = 60`, `DAY = 1440`, `WEEK = 10080`.

**State owned.** Defines all of it; owns none at run time.

**Main entity types** (line numbers in [types.ts](../../src/types.ts)):

- `Character` ([types.ts:98](../../src/types.ts)). Identity: `id`, `name`, `nick?`, `look?`, `bg?`. Personality: `traits: Traits` (greed, violence, ambition, caution, sociability, vice, courage, all 0..1), `skills: Skills` (muscle, driving, charm, nerve, brains), `want?`, `problem?`. Position: `familyId`, `rank: Rank` (`civilian | associate | soldier | capo | underboss | boss`), `bossId`, `sponsor?`, `backer?`, `district`, `prospect?`. Status: `alive`, `diedAt?`, `jailedUntil`, `hurtUntil`, `heat`, `wake`/`sleep` (hours; `sleep > 24` means past midnight), `informant?`. Money: `cash`, `wage`, `weekIncome`, `lifetimeKick`, `lifetimeGross?`, `books: Books`, `kickRate`, `hustle?`, `job?: DayJob`, `cars`, `goods`. Social and knowledge: `rels: Record<Id, Rel>` (directional trust/respect/affection/grudge/lastMet), `known: Record<Id, Knowledge>` (fact id to `{ t, from, knowsActor }`), `struggling`, `cooldown: Record<string, number>`, `memos: Memo[]`, `career?`. Player-only fields: `isPlayer?`, `standing` (all characters carry it, but it is the player's reputation), `ambition?`, `insight?`, `rep?`, `notes?`, `intro?`, `talk?`, `denied?`.
- `Business` ([types.ts:151](../../src/types.ts)): `ownerId`, `managerId?`, `kind`, `district`, `income`/`expense` (weekly baselines), `readonly cash` (only `econ.bizMove` may change it), `distress`, `open`, `damaged`, `protection?` (collector, family, fee, arrears `owed`, `late`, `why`, `hold`), `stakes?`, `owners?`, `invest?`, `acct?`, `informPrev?`, `guardedUntil?`, `lastApproach?`, `rivals0?`.
- `Family` ([types.ts:192](../../src/types.ts)): `bossId`, `districts`, `tension: Record<familyId, number>`, and V76 organisation fields (`standing`, `treasury`/`tlog`/`tin`/`tout`, `hist`, `rel`, `hq`, `unrest`, `acting`, `consigliere`, `heir`, `levy`, `directive`, `capBonus`, `seatNo`, `watch`, `hunt`, `booksClosed`, `lastPromo`, `lastChurn`, `founded`, `history`, `leaderSince`).
- `Fact` ([types.ts:302](../../src/types.ts)): `id` (`f<n>`), `t`, `kind: FactKind` (39 kinds, [types.ts:260](../../src/types.ts)), `actor?`, `victim?`, `business?`, `amount?`, `text`, `textHidden?`, `hiddenActor?`, `minor?`, `cause?` (fact id), `story?`, `heard?`, `district`.
- `Knowledge` ([types.ts:40](../../src/types.ts)) and `Rel` ([types.ts:31](../../src/types.ts)) as above.
- `Debt` ([types.ts:244](../../src/types.ts)): creditor, debtor, principal, balance, weekly rate and payment, `nextDue`, `missed`, `status: 'active' | 'paid' | 'defaulted' | 'void'`, `reason`, `cause?`, `paid?`.
- `Books`/`WeekBook` ([types.ts:79](../../src/types.ts), [types.ts:48](../../src/types.ts)): this week's gross by source, expenses, kick-up arrears, history of settled weeks, discrepancy flags about subordinates, skim/hide decisions, side income.
- Commitments and scenes: `Job` ([types.ts:365](../../src/types.ts)), `Memo` ([types.ts:414](../../src/types.ts)), `Pending` ([types.ts:426](../../src/types.ts)), `Enc`/`EncOpt` ([types.ts:578](../../src/types.ts)), `Favour` ([types.ts:592](../../src/types.ts)), `Threat` ([types.ts:602](../../src/types.ts)), `LifeEvent` ([types.ts:612](../../src/types.ts)), `Grievance` ([types.ts:399](../../src/types.ts)), `Dispute` ([types.ts:224](../../src/types.ts)), `Situation` ([types.ts:453](../../src/types.ts), with V75 fields `parties`, `phase`, `k`, `claims`, `truth`, `hist`, `m`).
- Player progress: `PathState` ([types.ts:533](../../src/types.ts)), `PromoCase` ([types.ts:541](../../src/types.ts)), `Life`/`Kin`/`Partner` ([types.ts:623](../../src/types.ts)), `Op` ([types.ts:554](../../src/types.ts)), `Venture` ([types.ts:439](../../src/types.ts)), `Coup` ([types.ts:524](../../src/types.ts)).
- NPC goals: `Goal`, `GoalEnd`, `Agency` ([types.ts:653](../../src/types.ts)).
- Loop types: `Ev` ([types.ts:338](../../src/types.ts)), `Action` and `Kind` ([types.ts:320](../../src/types.ts)).
- Money record types: `Stake`, `OwnerSpell`, `PayWhy`, `TxKind`, `WeekAcct`, `Txn` ([types.ts:178](../../src/types.ts)), `OrgEvent`, `TreasuryTx`, `OrgRel` ([types.ts:189](../../src/types.ts)).

**Every top-level `World` field** ([types.ts:478](../../src/types.ts)). "Req" fields are non-optional in the type and are always present after `createWorld` or `deserialize`.

| Field | Req | Owner module(s) | Meaning |
|---|---|---|---|
| `seed` | yes | world.ts | The seed the world was created from. |
| `rng` | yes | rng.ts / engine.ts | The live PRNG; saved as its numeric state. |
| `now` | yes | engine.ts (`advance`) | Current time in minutes. |
| `seq` | yes | core.ts (`schedule`) | Monotonic tie-breaker for queue order. |
| `queue` | yes | core.ts / engine.ts | Pending `Ev`s sorted by `(t, seq)`. |
| `nextId` | yes | core.ts (`newId`), and direct `'<prefix>' + w.nextId++` in 17 other modules | Global id counter shared by every kind of record. |
| `playerId` | yes | world.ts | The player's character id. |
| `schema` | no | engine.ts | Save schema version (`SCHEMA = 7`). |
| `chars` | yes | world.ts creates; everyone mutates | All characters, alive and dead, by id (never deleted). |
| `biz` | yes | world.ts creates; econ.ts is the main writer | All businesses by id (never deleted; closed ones stay). |
| `fam` | yes | world.ts creates; orgs.ts is the main writer | Families/organisations by id (`fam_<name>`). |
| `facts` | yes | core.ts (`addFact`); retain.ts deletes | Every remembered event, by id. |
| `debts` | yes | core.ts (`createDebt`, `payDebt`); engine.ts weekly | All debts, including paid/void/defaulted ones (append-only). |
| `jobs` | yes | jobs.ts (`mkJob`), orders.ts, meetings.ts, gigs.ts; consistency.ts repairs | Jobs offered to or held by the player and NPCs; trimmed by `jobs.daily`. |
| `ventures` | yes | jobs.ts, dialogue.ts | The player's chop-shop ventures (append-only). |
| `grievances` | yes | meetings.ts, dialogue.ts; consistency.ts drops | Complaints between members (append-only). |
| `pending` | yes | created by core.ts (`reveal`), disputes.ts, actions.ts, jobs.ts, revenge.ts, violence.ts, encounters.ts; consumed by consequences.ts | Delayed consequences, removed when run. |
| `enc` | yes | encounters.ts (`addEnc`), called from ~15 modules | Encounters put to the player; closed ones dropped after 20 days. |
| `favours` | yes | encounters.ts (`addFavour`) | Favours owed between people (append-only). |
| `threats` | yes | danger.ts, encounters.ts | Threats against the player, keyed by enemy id. |
| `events` | yes | encounters.ts (`eventTick`), life.ts | Funerals, weddings, christenings (append-only). |
| `ops` | yes | rackets.ts | The player's rackets (append-only). |
| `disputes` | no | disputes.ts | Cross-family quarrels; closed ones dropped after a while. |
| `disputeScan` | no | disputes.ts | Time of the last daily incident scan. |
| `situations` | no | situations.ts, situ.ts, pulse.ts | Ongoing matters (V75 shape); closed ones capped by situ.ts. |
| `sitcool` | no | situ.ts | Cool-down before a closed situation key can reopen. |
| `sitpace` | no | situ.ts (sitmoves.ts writes `stats`) | Pacing of quiet and busy periods. |
| `txns` | no | econ.ts (`bizMove`) | Every movement of business cash, recent weeks. |
| `ledger` | no | ledger.ts (`post`) | Money movements inside the player's circle (bounded to about 8 weeks). |
| `clubs` | no | clubdata.ts (`ensureClubs`) | One social club per family. |
| `scene` | no | club.ts | A club conversation in progress, so a reload resumes it. |
| `bj` | no | blackjack.ts | Current or last blackjack hand. |
| `expect` | no | reports.ts, meetings.ts | The player's standing instructions to his crew (report, trouble, invest). |
| `sunday` | no | crewlife.ts | The crew's Sunday tells for the player. |
| `papers` | no | news.ts | The Monday papers, ring of 10. |
| `snaps` | no | engine.ts | Weekly player snapshots for the briefing, ring of 6. |
| `promo` | no | path.ts creates, career.ts runs | The player's promotion case. |
| `path` | no | path.ts, powers2.ts | The player's road to the next rank, perks and rank powers. |
| `goals` | no | ambition.ts | The player's completed milestone ambitions (`done: key -> time`). Not NPC goals. |
| `agency` | no | goals.ts | NPC goals (V74). |
| `coup` | no | politics.ts | A plot against a boss in progress. |
| `life` | no | life.ts | The player's kin, partner and social pool. |
| `commissionAt` | no | politics.ts | When the Commission last sat. |

**Tick hooks.** None.

**Depends on / used by.** Imports only the `Rng` type, plus inline `import('./clubdata')`, `import('./ledger')` and `import('./blackjack')` type references for `clubs`, `scene`, `ledger` and `bj`. Imported by essentially every module, the UI and all tests.

**Invariants & rules.** Every field must be JSON-serialisable (no `Map`, `Set`, functions or class instances other than `rng`, which `serialize` replaces). `Business.cash` is `readonly` at the type level; code that must change it casts, and only `econ.bizMove` should.

**Save compatibility notes.** New fields must be optional (as the V72-V76 additions are) and given safe defaults where read. The comment on `PathState.stakes` records a pre-V73 field kept only so the v4 migration can read it.

**Known issues / gaps.** `Pending.kind` includes `'plan'`, which nothing creates and `pendingTick` does not handle. `Character.standing` is required on every character although only the player's is meaningful. `World.goals` is the player's ambition record, not NPC goals; NPC goals are `World.agency` (the CLAUDE.md remark that "`w.goals` rarely visibly drives NPC behaviour" refers to the latter).

## engine.ts

**Purpose.** Runs the world forward. `advance()` drains the event queue up to a time, dispatching `weekly`, `daily` and `think` events in a fixed order (see [The tick, step by step](#the-tick-step-by-step)). It also contains the weekly economy block that no other module owns (random robbery, debt payments, wages and living costs, obligations, relationship decay, police heat and arrests), save serialisation with schema migrations, and two CLI reporting helpers.

**State owned.** `w.now` (set per event), `w.snaps`, `w.schema`; within `weekly()` it writes `fam.hunt` (deletion), `fam.capBonus`, `Debt.balance`/`missed`/`status`/`nextDue`, `Character.cash`, `books.expenses`, `heat`, `jailedUntil`, every `Rel.grudge`/`trust`/`affection`, and deletes `Business.informPrev`.

**Public API.**

| Export | Returns | Notes |
|---|---|---|
| `advance(w: World, until: number)` | void | The loop. Mutates everything, uses rng, schedules events. |
| `serialize(w: World): string` | JSON | `JSON.stringify({ ...w, schema: SCHEMA, rng: w.rng.state })`. |
| `SCHEMA = 7` | const | Current save schema. |
| `deserialize(s: string): World` | World | Parse, rebuild `Rng`, `ensureShape`, run migrations, backfill per-character fields. Uses rng (see below). |
| `history(w, opts?: { includeMinor?: boolean }): string[]` | lines | `[Day N HH:MM] text` for every (non-minor) fact; CLI only. |
| `report(w): string` | text | Families, businesses, debts, fact counts, the dead, top feuds; CLI only. |

Internal: `think(w, id)` ([engine.ts:78](../../src/engine.ts)), `weekly(w)` ([engine.ts:91](../../src/engine.ts)), the `LIVING` table ([engine.ts:89](../../src/engine.ts)).

**Serialisation, briefly.** `serialize` writes the whole world, with the RNG state as a number and `schema: 7`. `deserialize` ([engine.ts:244](../../src/engine.ts)) restores the RNG, calls `world.ensureShape`, applies the step-wise migrations for schemas older than 4, 3 and 2 (moving pre-V73 player stakes onto businesses, converting protection lateness into an amount owed, backfilling `intro`, adding `capBonus`/`seatNo`), sets `schema = 7`, calls `addShops(w, 14)` if the world has fewer than 34 businesses, and backfills `skills`, `standing`, `books`, `memos`, `kickRate`, `cars` and `goods` on every character. Schemas 5-7 need no explicit step because `ensureShape` supplies the new collections. Module-level caches (`core.ownerCache`, `econ.tailCache`) are not saved and rebuild on first use. Save format, fixtures and compatibility rules are covered by the save-format document in this set (`docs/engine/`).

**Tick hooks.** It is the tick.

**Depends on / used by.** Imports the tick functions of 28 modules (listed in the tick section) plus `core` helpers (`addFact`, `clamp`, `earn`, `isAwake`, `learn`, `money`, `nextWake`, `notifyProtector`, `ownerBiz`, `payDebt`, `schedule`, `shortTime`), `books` (`BASE_RATE`, `emptyBooks`, `settleWeek`), `econ` (`addStake`, `bizMove`, `businessWeek`, `seizeShare`), `world` (`addShops`, `ensureShape`), `people` (`peopleWeek`, `rollSkills`), `retain` (`sweep`), `rank` (`repairAll`), `consistency` (`reconcile`), `rng`. Used by [web.ts](../../src/web.ts) (`advance`, `serialize`, `deserialize`), `cli.ts` (all, including `history`, `report`), `bot.ts`, `stress.ts`, `test.ts`, every test in `src/tests/` (`advance`, `serialize`, `deserialize`, `SCHEMA`) and `playtest/pt.ts` via the CLI.

**Invariants & rules.**
- The order of calls in `advance` and `weekly` is part of the game's behaviour and of every seed's history; reordering changes outcomes and which week earnings settle in.
- The daily and weekly handlers must always reschedule themselves (there is no try/finally).
- `think` only ever reschedules the character it ran for; there is never more than one think per character in the queue.
- Debt payments in `weekly` are only attempted when the debtor can cover them from cash plus the till above $100, which keeps `payDebt` from crediting money the debtor does not have.

**Save compatibility notes.** Migrations are cumulative and must never be deleted; add a step for a new schema version and bump `SCHEMA`. `deserialize` consumes `w.rng` only when it calls `addShops` (worlds with fewer than 34 businesses), which is deterministic for a given save. Backfilled skills use `new Rng(w.seed + c.id.length * 7 + c.name.length)`, so characters with ids and names of equal length get identical skills.

**Known issues / gaps.**
- The player can be chosen as the random weekly shop thief ([engine.ts:101](../../src/engine.ts)): the thief pool filters only on rank, alive and not jailed. The player is then credited the money as `scheme` income, gains heat, and is the actor of a `robbery` fact he never chose to commit. A probe of six seeds over 180 days with no player input found this in three of them (days 34, 83 and 153).
- The player's side income is credited twice a week: `powers2.rankWeek` (step 13) adds `p.books.side` to his cash "off the books", and `books.settleWeek` (step 23), whose payout loop does not exclude the player, adds it to his cash again and records it in `books.gross.side` and `weekIncome`.
- The weekly trust/affection decay uses `Math.max(0.1, x * 0.94)`, so a relationship with trust or affection below 0.1 (after a betrayal, say) is raised to 0.1 after two weeks apart.
- Lawyer fees on arrest and the obligations envelope are money sinks with no ledger entry; arrest lawyer fees are not added to `books.expenses`.
- The `LIVING` table is duplicated in [books.ts](../../src/books.ts), [pulse.ts](../../src/pulse.ts) and [situations.ts](../../src/situations.ts) (`LIVING_LINE`), and [people.ts](../../src/people.ts) uses a different one.
- Unused imports: `famName` from core, `ensureClubs` from clubdata (the latter imported mid-file at [engine.ts:240](../../src/engine.ts)).
- A throw inside any tick function stops the daily or weekly clock permanently for that world.

## core.ts

**Purpose.** The shared vocabulary of the simulation, imported by about 60 files. It implements the knowledge model (every significant event is a `Fact`; a character knows it only if it is in his `known` map, possibly without knowing who did it; victims guess and may guess wrong), directional relationships, the event queue insert, income bookkeeping that feeds kick-up settlement, debt creation and payment, the death of a character and what lets go when he dies or a debt clears, and small formatting helpers.

**State owned.**
- `World.facts` (sole creator), `World.pending` (adds `reveal` items), `World.queue` and `World.seq` (via `schedule`), `World.nextId` (via `newId`), `World.debts` (creates; `payDebt` updates).
- `Character.known` (main writer, via `learn`), `Character.rels` (lazily created by `rel`; updated by `learn`, `suspect`, `link`, `onDebtCleared`), `Character.struggling` (set by `learn` on `business_struggling` facts), `Character.weekIncome`, `books.gross`, `lifetimeGross` (via `record`/`earn`), `Character.career` (via `recordCareer`, ring of 12), `alive`/`diedAt` (via `handleDeath`).
- On death: `Business.open`, deletes `Business.protection` where the dead man collected, `Debt.status = 'void'`, `Dispute.status = 'dropped'`, `Family.heir`/`consigliere`/`acting`, subordinates' `bossId`.
- A module-level cache `ownerCache: WeakMap<World, { t, map }>` ([core.ts](../../src/core.ts)), not saved. `ownersChanged(w)` drops it; anything that adds a business or moves one between owners must call it.

**Public API.**

Constants and formatting:

| Export | Returns | Notes |
|---|---|---|
| `DISTRICTS: string[]` | | The seven districts. Only world.ts imports it; life.ts repeats the list literally. |
| `clamp(x, lo = 0, hi = 1)` | number | Pure. |
| `money(n)` | `"$1,234"` / `"-$1,234"` | Pure (locale `en-US`). |
| `travelTime(a, b)` | 10 if same district, else 35 (minutes) | Pure. |
| `dayNo(t)` | 1-based day number | Pure. |
| `fmtTime(t)` | e.g. `"Mon, 2 Mar 1970, 08:00"` | Pure function of `t` (uses `Date` only to format). |
| `shortTime(t)` | `"Day N HH:MM"` | Pure. |
| `famName(w, c)` | family name or `'independent'` | Pure. |
| `flavour(f, text)` | string | If `text` is the fact's plain `text`, rewrites it with one of several phrasings chosen by an FNV hash of `f.id` (stable across looks). |
| `factText(f, knowsActor)` | string | `text` if the reader knows the actor (or there is no `textHidden`), else `textHidden`, then `flavour`. The standard way to show a fact to someone. |

Ids, relationships and scheduling:

| Export | Returns | Notes |
|---|---|---|
| `newId(w, prefix)` | `prefix + w.nextId++` | Mutates `nextId`. |
| `rel(c, id): Rel` | the relationship | Creates `{ trust 0.1, respect 0.3, affection 0.1, grudge 0, lastMet -1e9 }` if absent, so a read creates an entry. Use `c.rels[id]` for read-only checks. |
| `link(a, b, trust)` | void | Raises both directions to at least `trust`, affection to `trust*0.6`, respect to 0.4. |
| `schedule(w, t, kind, who?)` | void | Sorted insert into `w.queue`. Only engine.ts and world.ts call it. |
| `isAwake(c, t)` | boolean | Using `wake`/`sleep` hours. |
| `nextWake(c, t)` | minute | Next `wake` hour after `t`. |

Money bookkeeping:

| Export | Returns | Notes |
|---|---|---|
| `record(c, amt, src)` | void | If `amt > 0`: adds to `weekIncome`, `books.gross[src]`, and (player) `lifetimeGross`. Does not move cash. |
| `earn(c, amt, src = 'odd')` | void | `c.cash += amt` then `record`. Money appears from outside unless the caller removed it elsewhere. |
| `ownerBiz(w, id)` | `Business \| undefined` | The first open business the character owns, from a cache rebuilt when 30 minutes have passed, time went backwards, or `ownersChanged` dropped it (a business was added or changed hands). |
| `ownersChanged(w)` | void | Invalidates that cache; `econ.transferBusiness` calls it. |
| `concealedGap(w, c)` | number | What he should have passed up over the last four settled weeks and did not: `sum(max(0, gross - declared)) * (kickRate + active levy)`. Used by jobs.ts. |

Facts and knowledge:

| Export | Returns | Notes |
|---|---|---|
| `interface FactOpts { witnesses?, victimKnows?, broadcast? }` | | |
| `addFact(w, f, o?)` ([core.ts:191](../../src/core.ts)) | `Fact` | Assigns `id`, `t = now`, `district` (given, else actor's, else victim's, else Little Italy); stores it. If `hiddenActor` and there is an actor, 30% chance of a `reveal` pending due in 14-56 days (uses rng). Actor, victim (unless `victimKnows === false`) and witnesses `learn` it; they know the actor unless it is hidden and they are neither the actor nor a witness, in which case `suspect` runs. `broadcast` recipients learn it as `'public'` (knowing the actor only if it is not hidden) and suspect if hidden. Dead characters learn nothing. |
| `learn(w, cid, fact, from, knowsActor)` ([core.ts:142](../../src/core.ts)) | void | First knowledge wins: returns at once if the character already has the fact. Records `{ t, from, knowsActor }`; marks `struggling` for `business_struggling`. If alive, knows the actor and is not the actor, applies the `GRUDGE` table: the victim gets `+g` grudge and `-g/2` trust toward the actor; anyone close to the victim (affection over 0.5, or same family) gets `+0.3g` grudge. |
| `notifyProtector(w, b, f)` | void | The business's collector learns the fact from the owner (actor only if not hidden), and suspects if hidden. |
| `witnessesAt(w, district, exclude, max = 3)` | ids | Each awake, unjailed, living person in the district has a 25% chance; trimmed at random to `max`. One rng draw per candidate. |
| `isResolved(w, f)` ([core.ts:369](../../src/core.ts)) | boolean | Whether the matter a fact describes is over: loan/missed/default facts when no active debt links the two; `shortfall` when arrears and flags are clear; `arrest` when released; `beating` when healed and its dispute is closed; `poach`/`vandalism`/`robbery` when their dispute is closed; `protection_refused` once the shop is protected. Used by consistency.ts and dialogue.ts. |

Internal: `suspect(w, c, fact)` ([core.ts:165](../../src/core.ts)) picks the member of another family with the highest `grudge + tension*0.05` above 0.12 and adds 0.3 grudge toward him. Civilians, independents and the victim's own family are never suspected, so an internal killing is blamed on an outside family or on nobody. The `GRUDGE` table ([core.ts:131](../../src/core.ts)) covers beating 0.5, vandalism 0.5, murder 0.8, robbery 0.4, poach 0.4, debt_missed 0.15, debt_default 0.4, protection_refused 0.2.

Debts, death and careers:

| Export | Returns | Notes |
|---|---|---|
| `createDebt(w, creditor, debtor, principal, rate, reason, cause?)` ([core.ts:257](../../src/core.ts)) | `Debt` | Weekly payment `round(principal*0.12/5)*5`, first due in 7 days; pushes to `w.debts`; posts a `loan` ledger entry. Does not move any cash: the caller must hand over the principal. |
| `payDebt(w, d, amount)` ([core.ts:286](../../src/core.ts)) | void | Takes from the debtor's cash, then the rest from his business via `bizMove(..., 'debt')`; credits the creditor the full `amount` with `earn(..., 'loans')`; posts `repay`; updates `paid`, `balance`, resets `missed` on a full payment; on clearing sets `paid`, calls `onDebtCleared`, adds a minor `debt_paid` fact. |
| `onDebtCleared(w, d)` ([core.ts:353](../../src/core.ts)) | void | Expires open jobs on the debt, marks related debt memos done, softens the creditor (grudge -0.15, trust +0.05), lapses open encounters tied to the debt. |
| `handleDeath(w, id, o?: { cause?, favoured? })` ([core.ts:318](../../src/core.ts)) | void | Marks dead, ends his NPC goals (`goals.goalsOnDeath`), passes each business to its manager (`econ.succeedOwner`) or closes it with a minor `business_failed` fact, removes protection he collected, voids his debts, drops his open disputes, runs boss succession (`orgs.succeed`) or re-parents his subordinates to his own boss, clears family heir/consigliere/acting, `rank.repairHierarchy`. Adds no fact about the death itself (callers do). |
| `recordCareer(w, c, text, ok?)` | void | Appends to `c.career.log` (ring of 12) and counts done/failed. |

**Tick hooks.** None of its own. Called from every tick.

**Depends on / used by.** Imports `ledger.post` (debt ledger entries), `econ.bizMove`/`succeedOwner`, `rank.repairHierarchy` (and an unused `applyRank`), `orgs.succeed`, `goals.goalsOnDeath`. Each of those modules imports core in turn, so core sits in import cycles with econ, rank, orgs and goals; they work because all uses are inside functions. Most-used exports, by number of importing files (including tests and tools): `money` 46, `rel` 41, `addFact` 39, `clamp` 38, `ownerBiz` 22, `famName` 17, `learn` 16, `createDebt` 15, `shortTime` 12, `factText` 11, `handleDeath` 11, `earn` 10, `witnessesAt` 8, `payDebt` 8, `recordCareer` 7, `fmtTime` 7, `travelTime` 6, `notifyProtector` 4, `newId` 3. The UI imports formatting helpers, `rel`, `ownerBiz`, `famName` and `factText` (`ui/views_a.ts`, `views_b.ts`, `views_c.ts`, `brief.ts`, `common.ts`, `links.ts`, `family.ts`, `pathview.ts`, `stories.ts`, `sunday.ts`, `blackjack.ts`, `clubview.ts`).

**Invariants & rules.**
- Knowledge: only `learn` (and `addFact` through it) should add to `known`. Dialogue, gossip and jobs must check `known[f]` and `knowsActor` before letting a character mention a fact or its culprit.
- `learn` is first-write-wins: once a character knows a fact without its actor, no later `learn` can tell him the actor.
- Every fact id is `f<n>`; retain.ts relies on that pattern to find references.
- `earn`/`record` are how income becomes visible to kick-up settlement; cash moved directly (`c.cash += x`) is invisible to the books.
- `createDebt` never moves cash; `payDebt` assumes the debtor can pay (the weekly engine checks this; other callers must too).
- After changing `Business.ownerId`, call `ownersChanged` (only `econ.transferBusiness` changes owners today, and it does).
- `rel()` creates entries; reading relationships in a loop over everyone inflates `rels`.

**Save compatibility notes.** Facts, knowledge and relationships are plain records; `Fact.heard`, `cause`, `story` and similar are optional. `ownerCache` is not saved; because it is time-windowed, a world reloaded inside the 30-minute window could in a rare case (an owner's first business closed and he owns another open one) return a different answer from the same world run without a reload.

**Known issues / gaps.**
- Delayed reveals do not reach the people they are aimed at. `consequences.pendingTick`'s `reveal` case calls `learn(..., knowsActor: true)` for the victim, the protector and the victim's friends, but the victim and the protector already know the fact without the actor (from `addFact` and `notifyProtector`), so `learn` returns early and they never learn who did it. Only people who had not heard of the event at all learn it with the culprit. A probe of two seeds over 150 days found two reveals due on living victims; neither victim knew the culprit afterwards. The same rule means gossip can never complete a victim's partial knowledge.
- [revenge.ts:147](../../src/revenge.ts) writes `known[f.id]` directly, bypassing `learn` and its grudge rules; [encounters.ts:811](../../src/encounters.ts) stores a non-fact key `'leave:<id>'` in `known`.
- `payDebt` credits the creditor the whole amount even if the debtor's cash and till cannot cover it, and does not clamp `fromCash` at 0. Every current caller checks affordability first, so this is latent rather than reachable today. A new caller that skips the check would create money.
- `onDebtCleared` matches memos by `fact.cause === d.cause`; when both are undefined, unrelated debt memos of the same creditor or debtor are also marked done.
- The comment "Protected businessmen phone their protector..." ([core.ts:227](../../src/core.ts)) sits above `concealedGap`, not above `notifyProtector`.
- `applyRank` is imported and unused.

## world.ts

**Purpose.** Builds a new city and keeps any world (new or loaded) in the same shape. `createWorld` generates the families (boss, underboss, capos, soldiers, associates), one casino per family, the player and his mentor, 40 civilian businesses with owners, extra civilians, women and prospects, neighbour links, existing protection arrangements and loans, the initial event queue, the player's family life and ambitions. `ensureShape` fills in every collection that later versions added. `addShops` grows the city.

**State owned.** Creates `World` itself and the initial contents of `chars`, `biz`, `fam`, `debts`, `facts`, `queue`; `playerId`, `seed`. `ensureShape` initialises `jobs`, `ventures`, `grievances`, `pending`, `enc`, `favours`, `threats`, `events`, `ops`, `goals`, `disputes`, `txns`, `situations`, `sitcool`, `sitpace`, `agency`, and via `ensureClubs`/`ensureOrgs` the `clubs` and the V76 family fields.

**Public API.**

| Export | Returns | Notes |
|---|---|---|
| `interface OrgDef { name; districts; casino; capos? }` | | Definition of one family. |
| `STANDARD_ORGS: OrgDef[]` | | Corrente, Marchetti, Falco (3 capos each), Brancato, Santangelo (2 each). |
| `EXTRA_ORGS: OrgDef[]` | | Lucchesi, Barzini, for tests and alternative cities. |
| `FEMALE: string[]` | | Women's first names. Also read by `ui/portrait.ts` to decide whether to paint a woman, and by life.ts. |
| `spawnCivilian(w, name, district, cash = 120)` | `Character` | A civilian with a unique name (suffixing `2`, `3`...), no problem. Uses rng. Does not schedule a think event. |
| `createWorld(seed, playerName = 'Tony Marino', opts?: { orgs?: OrgDef[] })` ([world.ts:143](../../src/world.ts)) | `World` | See order below. |
| `ensureShape(w)` ([world.ts:290](../../src/world.ts)) | void | Idempotent `??=` defaults for every collection; calls `ensureClubs` and `ensureOrgs`. |
| `addShops(w, n)` ([world.ts:312](../../src/world.ts)) | owner ids | `n` new businesses (from the later part of the kinds table) with new civilian owners, four neighbour links each, and a think event for each owner. Uses rng. |

Internal: `mk(w, used, o)` ([world.ts:73](../../src/world.ts)) creates a character with rank-dependent traits (made men 0.3-1 greed, 0.3-0.95 violence...; civilians milder), wages (civilian 110, associate 80, soldier 150, capo 300, underboss 600, boss 1000), wake/sleep (made men 10:00-02:00, civilians 07:00-22:00), skills (`rollSkills`), kick rate (`BASE_RATE`) and a 16% chance of a personal problem for made men below boss. Full names are unique, and no randomly named character is given the player's surname.

`createWorld` order: families (boss surnamed after the family, underboss, `capos` capos each with 2-3 soldiers each with 0-2 associates, `link`ed down the chain); zero tension between every pair; a casino per family owned and "protected" (fee 0) by its first capo; the player as an associate under the first family's second capo (`player.intro = {}`, fixed traits, wake 09:00); 40 civilian businesses (expense 88% of income, $300 cash); 14 more civilians; 12 women; 9 prospects; each character linked to up to four neighbours in his district (trust 0.2); 55% of businesses protected by a soldier or associate of a family whose districts include the shop (fee 8% of income); up to 8 business loans at 5% from soldiers/capos to owners (one per owner) with `loan` facts; schedule weekly, daily and one think per non-player; `lifeInit` (mother and sibling via `spawnCivilian`); `ambitionInit`; `ensureShape`.

**Tick hooks.** None. `addShops` is also called from `pulse.ambientWeek` (14% a week) and from `deserialize`. `spawnCivilian` is called from econ.ts (managers) and life.ts (kin, partners, children).

**Depends on / used by.** Imports orgs (`ensureOrgs`), clubdata (`ensureClubs`), ambition (`ambitionInit`), books (`BASE_RATE`, `emptyBooks`), people (`rollProblem`, `rollSkills`), core (`addFact`, `createDebt`, `link`, `money`, `schedule`, `DISTRICTS`), rng, life (`lifeInit`). Used by web.ts, cli.ts, bot.ts, stress.ts, test.ts and every test (`createWorld`), engine.ts (`addShops`, `ensureShape`), pulse.ts (`addShops`), econ.ts and life.ts (`spawnCivilian`), life.ts and `ui/portrait.ts` (`FEMALE`), `tests/v76.test.ts` (`STANDARD_ORGS`, `EXTRA_ORGS`). world.ts and life.ts import each other.

**Invariants & rules.**
- Generation is fully determined by `seed`, `playerName` and `opts.orgs` (the player's name affects which surnames are excluded and therefore every later draw).
- The player always starts in `opts.orgs[0]` under its second capo, so that family needs at least two capos.
- `ensureShape` must stay idempotent and must give a new world and a loaded old save the same shape (and so the same saved text once both have run).
- The initial loans create debts without moving cash (they predate the game).

**Save compatibility notes.** `ensureShape` is the repair point for added collections; add new collections there with a safe empty default. `deserialize` calls `addShops(w, 14)` for worlds with fewer than 34 businesses (pre-V73 cities); a new world has 45.

**Known issues / gaps.**
- `LADY_USED` ([world.ts:132](../../src/world.ts)) is a module-level `Set` that is never added to, so its filter does nothing.
- `spawnCivilian` never starts a think chain, and `lifeInit` runs after the think events are scheduled, so the player's kin, partners, children and every appointed business manager never act autonomously. A seed-3 probe showed 2 such characters at the start and 4 by day 90.
- Changing `FEMALE` would change portrait output, which CLAUDE.md forbids.
- Casinos are "protected" by their own owner with fee 0, which `econ.setCollector` otherwise refuses ("a man cannot collect from himself").

## people.ts

**Purpose.** Skills and what work leans on them; personal problems (gambling, debt, family trouble, drink, saving to leave, resentment, a woman) that drain an NPC's money each week, show as visible signs others notice, and can push him into borrowing from the wrong man. Also the player's action of helping one of his men.

**State owned.** `Character.skills` (initial roll; `grow` raises them), `Character.problem` (start, severity drift, removal), `Character.prospect` (cleared only), `Character.cash` and `books.expenses` (problem drain), `cooldown.helped`; for help: `kickRate`, the man's `rels` toward the player.

**Public API.**

| Export | Returns | Notes |
|---|---|---|
| `SKILLS`, `SKILL_LABEL` | consts | The five skills. |
| `rollSkills(rng: Rng, rank: Rank): Skills` | Skills | Ranges by rank plus a +0.2 "gift" in one skill. Draws from the given `Rng`. |
| `skillWord(v)` | `'poor' ... 'gifted'` | UI wording. |
| `bestSkill(c)` | Skill | Unused outside the module. |
| `NEEDS: Record<string, Skill[]>` | | Skills each kind of work uses. |
| `aptitude(c, kind)` | 0..1 | Mean of the needed skills (default `nerve`). |
| `grow(c, kind, amt = 0.025)` | void | Improves the needed skills. |
| `PROBLEM_LABEL` | | Text for each problem kind. |
| `rollProblem(w, c)` | `Problem \| undefined` | Weighted by traits and cash; severity 0.15-0.4. Uses rng. |
| `peopleWeek(w)` ([people.ts:78](../../src/people.ts)) | void | Weekly, see below. |
| `lateOf(b)` | weeks late on protection | |
| `clearLate(b)` | void | Unused. |
| `helpMan(w, p, c, how: 'cash' \| 'duties' \| 'leave')` ([people.ts:131](../../src/people.ts)) | lines | `cash`: $400 from the player to him, trust/affection up, problem eased; `duties`: kick rate -5 points, problem eased; `leave`: trust -0.04. Help adds a `favour` fact with `story: 'man:<id>'`; a problem eased to 0.12 or less ends with a second fact. |
| `ageDays(w, t)`, `_unused` | | Unused. |

`peopleWeek`: for each NPC associate/soldier/capo in a family: without a problem, a 1.6% (capo 0.6%) weekly chance of one, plus 1.2% if he is ambitious and distrusts his boss; with one, severity drifts up (faster for gambling, debt, drink), cash drains by `sev * living * factor`, a `trouble` fact may be seen by witnesses, a severe gambling or debt problem may trigger `crisis` (a 7% loan from a soldier or associate of another family, of which he keeps 40% in cash), and the problem may pass. Finally every prospect has a 6% chance of stopping being one.

**Tick hooks.** `peopleWeek` from weekly (step 22). `helpMan` from the UI (web.ts) and from dialogue.ts/encounters.ts.

**Depends on / used by.** Imports core (`addFact`, `clamp`, `createDebt`, `money`, `witnessesAt`), rng. Used by engine.ts (`peopleWeek`, `rollSkills`), world.ts (`rollSkills`, `rollProblem`), jobs.ts/orders.ts/rackets.ts (`aptitude`, `grow`), dialogue.ts, encounters.ts, flows.ts, orders.ts (`PROBLEM_LABEL`, `lateOf`, `helpMan`), web.ts (`helpMan`), and the UI (`ui/common.ts`, `views_a.ts`, `views_b.ts`, `views_c.ts`, `stories.ts`).

**Invariants & rules.** The player never gets a problem from `peopleWeek`. Skills stay in `[0, 1]`.

**Save compatibility notes.** `problem` and `prospect` are optional; skills are backfilled on load by `deserialize`.

**Known issues / gaps.**
- `crisis` creates the debt without the lender paying anything, and gives the borrower 40% of the principal from nowhere.
- `helpMan` moves $400 between characters without a ledger entry.
- Prospects are only created by `createWorld` and only ever removed here, so the pool shrinks with a half-life of about 11 weeks.
- A no-op line ([people.ts:96](../../src/people.ts)) adds 0 to `books.gross.odd`.
- Its own `living` figures (associate 90, soldier 130, capo 250) differ from the `LIVING` table used elsewhere.

## places.ts

**Purpose.** The three rooms the player can go to and the people in them: the family's social club, the barber shop and the corner bar. Presence at the barber and bar is a hash of the man's id and the four-hour time slot, so it is stable between looks; the club delegates to clubdata.ts. Sitting at the club, getting a shave and drinking at the bar are player actions that surface gossip, encounters and boss job offers.

**State owned.** None of its own. Writes the player's `known` (via `learn`), `cash`, `heat`, one present man's `rels[player].trust`/`lastMet`, and a new `p.rels` entry for a stranger met at the bar.

**Public API.**

| Export | Returns | Notes |
|---|---|---|
| `interface Place { id; name; blurb; open: [number, number] }` | | Opening hours; values over 24 mean after midnight. |
| `PLACES: Place[]` | | club 11-26, barber 8-19, bar 16-28. |
| `present(w, p, placeId)` | `Character[]` | Club: `clubPresent` of the player's family club. Otherwise, when open, every living non-civilian member of the player's family, not jailed or hurt, whose hash for the current four-hour slot falls under 0.3. |
| `isOpen(w, id)` | boolean | |
| `sitAtClub(w, p)` | `{ lines, minutes: 90 }` | May overhear (55%) a recent non-minor fact a present man knows; adds `sitmoves.sceneLines` and `clubTalk`; one present man's trust in the player +0.015; with the player's boss, an underboss or a boss present, 30% `jobs.forceBossOffer`; 55% `encounters.forceEncounter`. Uses rng. |
| `shave(w, p)` | `{ lines, minutes: 50 }` | $20; the player learns the most recent non-minor fact from his district in the last 45 days that he does not know; heat -0.03. |
| `drinkAt(w, p)` | `{ lines, minutes: 150 }` | $30; may meet a stranger in his district; 35% `forceEncounter`. |

**Tick hooks.** None; player actions from web.ts.

**Depends on / used by.** Imports sitmoves (`clubTalk`, `sceneLines`), encounters (`forceEncounter`), jobs (`forceBossOffer`), core (`clamp`, `learn`, `money`, `rel`), voice (`hash`, `pick`), clubdata (`clubOf`, `clubPresent`). Used by web.ts (`sitAtClub`, `shave`, `drinkAt`), where.ts and `ui/views_b.ts` (`PLACES`, `present`, `isOpen`), tests (`v76`, `sit_freq`).

**Invariants & rules.** Presence must stay a pure function of the clock and the people so that the "who is here" list and `whereIs` agree.

**Save compatibility notes.** Nothing stored.

**Known issues / gaps.**
- Both `sitAtClub` and `shave` break the knowledge rule: they call `learn(..., knowsActor: true)` and print `f.text`, so the player learns the culprit of a hidden-actor fact even when the man he overheard does not know it (club) or nobody in particular told him (barber).
- The shave and drink costs are money sinks with no ledger entry.
- The stranger met at the bar gets a one-directional relationship (the player knows him; he has no entry for the player).

## where.ts

**Purpose.** Answers "where is he right now?" for the conversation and contact screens, as a pure function of the clock, the player and the man: jail, laid up hurt, in one of the rooms, at his shop during business hours, or at home, with the travel time from the player's district.

**State owned.** None.

**Public API.**

| Export | Returns | Notes |
|---|---|---|
| `type WhereKind = 'club' \| 'bar' \| 'barber' \| 'shop' \| 'home' \| 'jail' \| 'hurt'` | | |
| `interface Where { kind; name; line; mins; placeId? }` | | `mins`: minutes to reach him. |
| `whereIs(w, p, c)` ([where.ts:9](../../src/where.ts)) | `Where` | Order: jailed, hurt, any open place where `present` includes him (15 minutes), his open business between 09:00 and 19:00, home. |

**Tick hooks.** None; UI and web.ts (`doAction`, `talkTo`).

**Depends on / used by.** Imports core (`ownerBiz`, `travelTime`), places (`PLACES`, `isOpen`, `present`). Used by web.ts, `ui/views_a.ts`, `ui/views_b.ts`, `tests/v78`, `tests/v79`.

**Invariants & rules.** Read-only. The answer is relative to the player: men of other families or civilians are never in the rooms, because `present` only lists the player's family.

**Save compatibility notes.** None.

**Known issues / gaps.** None found.

## retain.ts

**Purpose.** Keeps facts and knowledge from growing without limit (V72). A fact survives while anything can still use it: some kinds are permanent; any fact referenced by a live structure (debt, dispute, pending item, memo, encounter, scene, job, situation, or a later kept fact's `cause` chain) is kept; routine observations expire after a few weeks. Knowledge of old significant facts is thinned for bystanders but never for the people involved or the player. It also limits how far gossip carries routine news.

**State owned.** Deletes from `World.facts` and from every `Character.known`. Exports one mutable global, `RETENTION`.

**Public API.**

| Export | Returns | Notes |
|---|---|---|
| `PERMANENT: Set<FactKind>` | | murder, promotion, ruling, sitdown, event, business_failed, debt_default, exposed, informant, side_operation, levy, raid, ownership. Never dropped. |
| `ROUTINE: Set<FactKind>` | | gambling_loss, protection_refused, protection_late, report, business_struggling, gathering, rumour, debt_paid, debt_missed, attempt, trouble, loan, terms. Every other kind is "significant". |
| `RETENTION = { on: true }` | | Switch; the comment says tests turn it off, but no code in the repository does. |
| `ROUTINE_DAYS = 21`, `PLAYER_ROUTINE_DAYS = 60`, `SIGNIFICANT_DAYS = 150`, `PLAYER_SIGNIFICANT_DAYS = 365`, `BYSTANDER_DAYS = 60` | | Age limits; "player" means the player is the actor or victim. |
| `tierOf(kind)` | `'permanent' \| 'routine' \| 'significant'` | |
| `gossipCap(f)` | number | How many NPC-to-NPC tellings a fact may have: permanent unlimited, significant 14, routine 3. Read by actions.ts `share`. |
| `gossipFresh(w, f)` | boolean | Whether a fact is still worth repeating: routine under 10 days, significant under 45, permanent always. |
| `referencedFacts(w)` ([retain.ts:50](../../src/retain.ts)) | `Set<Id>` | Walks every value in the world except `w.facts`, `w.rng` and each character's `known` (the queue entries are walked too), and collects every string value matching `/^f\d+$/`. Does not descend into objects whose `status` is paid/void/settled/dropped and that have a `balance` or `claim` field (closed debts, disputes and dropped grievances). |
| `interface SweepStats { facts; known; before; after }` | | |
| `sweep(w)` ([retain.ts:77](../../src/retain.ts)) | `SweepStats` | See below. |

`sweep`: a fact is kept if it is permanent, referenced, belongs (`story`) to an open or violated dispute, or is younger than its tier's limit; every kept fact also keeps its `cause` chain (up to 50 links). Everything else is deleted. Then for every character: `known` entries whose fact is gone are removed (only keys of the form `f<n>`; other keys belong to other systems); for non-player characters, knowledge of a non-permanent fact they were not involved in and that is not referenced is removed if the fact is over 60 days old, or at any age if the character is dead.

**Tick hooks.** `sweep` runs every weekly event straight after `engine.weekly` (step 28). `gossipCap`, `gossipFresh` and `tierOf` are read by actions.ts whenever NPCs share news.

**Depends on / used by.** Imports types only. Used by engine.ts (`sweep`), actions.ts (`gossipCap`, `gossipFresh`, `tierOf`), `tests/v72.test.ts` (`sweep`, `referencedFacts`).

**Invariants & rules.**
- Any new field that stores a fact id is protected automatically, provided it stores the id as a value. Fact ids used as object keys (for example `Character.denied`) are not seen by the walk.
- A closed structure must carry `status` in the listed values and a `balance` or `claim` field to release its facts; finished jobs (`done`, `failed`, `expired`) keep theirs until `jobs.daily` trims them.
- The player never forgets a fact that still exists.

**Save compatibility notes.** Older saves are swept on their first weekly event. Nothing new is stored.

**Known issues / gaps.**
- The comment at [retain.ts:59](../../src/retain.ts) says a finished job releases its facts; jobs have neither `balance` nor `claim`, so they do not.
- `Character.denied` (fact id -> day, the lies a man told the player) is keyed by fact id, so those facts are not protected and the record of a lie can disappear when its fact expires.
- The variable named `deadLong` is just `!c.alive`, with no age check.
- Measured on seed 3 with no player input: facts 675 at day 30, 769 at day 60, 906 at day 90, 1047 at day 180; `known` entries 4152, 6235, 8405, 11455. The save grew from 1.2 MB (day 30) to 2.0 MB (day 180); characters (mostly `known` and `rels`) account for about 75% of it.

## consistency.ts

**Purpose.** "One world, one truth." `audit()` lists every contradiction it can find between linked records (used by the tests and the stress harness to prove nothing has drifted). `reconcile()` runs every day and fixes the causes of the most common drift.

**State owned.** `Grievance.status` (to `dropped`), `Memo.done`, `Job.status` (to `expired`) and `Job.notes`.

**Public API.**

| Export | Returns | Notes |
|---|---|---|
| `audit(w): string[]` ([consistency.ts:11](../../src/consistency.ts)) | issue descriptions | Read-only. Checks: NPCs with more than one active non-summons job; offered/active jobs on settled or missing debts; active jobs held by dead men; duplicate active jobs on the same `kind/target/biz`; active debts with no balance and paid debts with a balance; open grievances or disputes between dead men; living men answering to dead ones; jailed men with jobs overdue by more than five days. Then appends `rank.hierarchyIssues`, `orgs.orgIssues`, `econ.economyIssues`, `goals.agencyIssues`, `situ.sitIssues`. |
| `reconcile(w)` ([consistency.ts:42](../../src/consistency.ts)) | void | Drops open grievances whose parties are dead, money grievances with no active debt left, and grievances whose cause fact `isResolved`; marks memos done when their referenced fact `isResolved`; for duplicate active jobs on the same `kind/target/biz` (ignoring summons, boost, watch) keeps the first in array order; for NPCs with several active jobs keeps the first (the player may hold several). |

**Tick hooks.** `reconcile` from the daily event (step 17). `audit` is never called by the game.

**Depends on / used by.** Imports econ (`economyIssues`), goals (`agencyIssues`), situ (`sitIssues`), core (`isResolved`), rank (`hierarchyIssues`), orgs (`orgIssues`). Used by engine.ts (`reconcile`), stress.ts and the v72-v76 tests and measurement scripts (`audit`).

**Invariants & rules.** `audit()` returning an empty list is the main cross-system invariant the tests rely on (with `ledgerCheck` in econ). `reconcile` should fix causes, not hide messages.

**Save compatibility notes.** None.

**Known issues / gaps.** `reconcile` decides which duplicate job survives by array order, not by creation time or relevance. Expired jobs keep their facts referenced until `jobs.daily` trims them.

## pulse.ts

**Purpose.** The world's own weekly pulse, mostly around the player: NPC wants shift with their fortunes; shops change hands between families at war; new shops open; a rival family leans on one of the player's shops (a turf situation with its own encounter); the family offers him collection rights or a man who wants to transfer to him; and everyday life encounters (a crewman's daughter's wedding, a robbed client, a detective, a crewman with an offer from another family, a crewman asking for a lower kick-up, a stranger opening on his ground). It also resolves the player's choices in those encounters.

**State owned.** `Character.want` (shared with crewlife.ts), `p.insight[id]` (removes `'want'` when a want changes), `p.cooldown` keys `turf`, `turf:<bizId>`, `org`, `lifeev`, `World.situations` items of kind `turf`, encounters with `data.what` of `sit_turf`, `sit_org`, `sit_life`. Through its choices it writes `Business.protection` (via `econ.setCollector`, `clearArrears`), `Family.tension`, `p.standing`, `p.heat`, `c.kickRate`, `c.bossId`, relationships, favours and ledger entries.

**Public API.**

| Export | Returns | Notes |
|---|---|---|
| `motiveTick(w)` ([pulse.ts:22](../../src/pulse.ts)) | void | For each non-civilian, non-boss NPC in a family whose want is three weeks old: a new want if money is tight (gamble/rich), he keeps being passed over (independent/respect), he is sore at his boss (independent), he was hurt or jailed recently (respect), he is a rich ambitious associate (made), or he is trusted and ambitious (lieutenant), each applied with 30% chance. A minor `rumour` fact if he answers to the player. Uses rng. |
| `ambientWeek(w)` ([pulse.ts:52](../../src/pulse.ts)) | void | For each pair of families with combined tension of at least 1.5, a chance (scaled by `orgs.hostility`) that a member of one takes over a shop the other protects in his own districts (`setCollector`, `poach` fact broadcast to six members of each, tension +0.3 each way); shops the player or his men collect from are exempt. 14% chance a new shop opens (`addShops(w, 1)`), with an `event` fact the player witnesses if it is on his family's ground. |
| `pulseWeek(w)` ([pulse.ts:430](../../src/pulse.ts)) | void | Player-gated: `motiveTick`, `ambientWeek`, `turfStart`, `turfAdvance` for open turf situations, `orgOffer`, `lifeOffer`. |
| `pulseChoose(w, p, e, code)` ([pulse.ts:441](../../src/pulse.ts)) | `string[] \| undefined` | Dispatches the player's answer to a `sit_turf`, `sit_org` or `sit_life` encounter; `undefined` for any other encounter. |

Internal: `turfStart` (one turf situation at a time, six-week cooldown, needs a rival family with tension above 0.4 toward his own), `turfAdvance` (after a week becomes an encounter with options show/parley/pay/yield; unanswered for seven days, the shop is lost), `turfLose`, `turfChoose`, `orgOffer` (35% chance, three-week cooldown: collection rights on up to two unprotected shops in the family's ground if standing is at least 25, or a transfer if the player is made and has fewer than six men), `orgChoose`, `lifeOffer` (45% chance, two-week cooldown, picks one of wedding/robbed/cop/defect/rate/newcomer by eligibility), `lifeChoose`.

**Tick hooks.** `pulseWeek` from weekly (step 18). `pulseChoose` from `crewlife.ts`'s encounter answer chain, which the UI calls.

**Depends on / used by.** Imports econ (`clearArrears`, `setCollector`), rank (`leaveCrew`), core (`addFact`, `clamp`, `money`, `rel`), encounters (`addEnc`, `addFavour`), career (`members`), crewlife (`wantFor`), world (`addShops`), ledger (`post`), specs (`hasPerk`), orgs (`hostility`). Used by engine.ts (`pulseWeek`) and crewlife.ts (`pulseChoose`). pulse.ts and crewlife.ts import each other.

**Invariants & rules.** At most one open encounter of each `sit_*` family at a time, and one unresolved turf situation. A shop cannot be given to a man who owns it (`setCollector` refuses, and callers exclude owners).

**Save compatibility notes.** Situations and encounters it creates use the older situation fields (`stage`, `weeks`, `asked`), with no `key`; `situations.ts` and `situ.ts` both skip turf situations.

**Known issues / gaps.**
- Money: the wedding envelope is taken from the player and recorded in the ledger as a gift to the host, but the host's cash is not increased; the robbed client "hunt" ($200) and the detective's envelope ($300) leave the economy with no ledger entry; the newcomer's $400 comes from nowhere (recorded as `world` income).
- The detective "feed" option always names the first matching man in `w.chars` iteration order, and the resulting `report` fact ("Someone gave the police X's name") lists the player as actor without hiding him, so the named man knows the player informed on him.
- The newcomer "welcome" option records a favour owed by an arbitrary civilian (the first unaffiliated one found), because the newcomer is not a character.
- The detective and newcomer encounters set `from: null as any`.
- `c.want` is changed here and in crewlife.ts with separate rules.
- Its `LIVING` table duplicates engine.ts's.

## news.ts

**Purpose.** Writes the Monday paper every week from the last seven days of non-minor facts, in the voice of a paper that knows the police blotter and the society page and rarely who did it. The briefing screen shows the latest one.

**State owned.** `World.papers` (ring of 10).

**Public API.**

| Export | Returns | Notes |
|---|---|---|
| `interface Paper { t; lead; items: { head; body? }[]; filler: string[] }` | | |
| `makePaper(w)` ([news.ts:38](../../src/news.ts)) | `Paper` | Picks facts of the reportable kinds (murder, beating, vandalism, robbery/burglary/theft, arrest, raid, business_failed, scam, and `event` facts about marriages and births), ranks them (murder 5, raid and arrest 4, beating 3, property crime and closures 2) then by recency, takes up to five; the first becomes the lead. Adds filler from a 1970-1972 headline list by game year (generic list after that). Deterministic (`voice.pick` hashing), no rng. |
| `paperTick(w)` ([news.ts:53](../../src/news.ts)) | void | Pushes `makePaper` and trims to 10. |

**Tick hooks.** `paperTick` is the first step of the weekly event.

**Depends on / used by.** Imports core (`famName`, `ownerBiz`, both unused), voice (`pick`). Used by engine.ts. `ui/brief.ts` reads `w.papers` directly.

**Invariants & rules.** Never prints an actor for a hidden-actor kind: headlines name victims, businesses or the arrested man.

**Save compatibility notes.** `papers` is optional; older saves start with none.

**Known issues / gaps.** Reading the paper adds nothing to the player's knowledge; it is display only. The victim-name expression at [news.ts:21](../../src/news.ts) has two identical branches.

## memory.ts

**Purpose.** V77: in conversation, a man may make one remark about the history between him and the player, read from records the game already keeps: harm the player did to him (that he knows the player did), a broken promise, a favour either way, sponsorship, the player's origin crew, jobs he gave the player, how the player's rank and standing read to him. At most once a day per man, each kind at most once a fortnight, and not every day.

**State owned.** `p.cooldown['recall:<id>']` and `p.cooldown['recallk:<id>:<kind>']`, both stored as day numbers rather than minutes.

**Public API.**

| Export | Returns | Notes |
|---|---|---|
| `interface Memory { kind: 'broken' \| 'harm' \| 'favour' \| 'owe' \| 'sponsor' \| 'made' \| 'origin' \| 'job' \| 'rank' \| 'name'; line }` | | |
| `recall(w, p, t)` ([memory.ts:21](../../src/memory.ts)) | `Memory \| undefined` | Gate: `hash(t.id + ':' + day) % 6` decides whether today is a day for it (values 0-2 allow a memory; "owe" needs 0). Priority: harm (last 120 days, `t.known[f].knowsActor`), broken word (a `ruling` fact with text matching `/keep his word/` in the last 60 days), favour the player did him, favour he owes the player, sponsor/backer and made entries in his `powers2.ledgerOf`, the player's origin crew, jobs he gave that the player finished in the last 60 days, rank, standing. Lines come from `voicesheet.say` (`recall_*` keys). Sets the cooldowns when it returns a memory. |

**Tick hooks.** None; called from dialogue.ts when a conversation turn is rendered ([dialogue.ts:890](../../src/dialogue.ts)).

**Depends on / used by.** Imports voice (`hash`), voicesheet (`say`, `rk`, `surname`), powers2 (`ledgerOf`). Used by dialogue.ts and `tests/v77`, `tests/v78`.

**Invariants & rules.** Never invents: each branch needs its own record, and the harm branch respects the knowledge model.

**Save compatibility notes.** Only cooldown keys, which are optional.

**Known issues / gaps.**
- The broken-promise branch depends on the exact wording "didn't keep his word" written by `dialogue.memoTick`; rewording that fact silently disables the memory.
- Cooldown keys are per man and never cleaned up, and use day units in a bag where other keys hold minutes.
- CLAUDE.md lists a "presumptuous recall line" from the V85 playtest; the lines live in [voicesheet.ts](../../src/voicesheet.ts) under the `recall_*` keys this function chooses.

## notebook.ts

**Purpose.** The player's own contact book: eight fixed tags and a pin per person.

**State owned.** `p.notes` (`Record<Id, { tags: string[]; pin?: boolean }>`); an entry with no tags and no pin is deleted.

**Public API.**

| Export | Returns | Notes |
|---|---|---|
| `TAGS: string[]` | | "Owes me", "I owe him", "Good earner", "Watch him", "Trusted", "Family matters", "Dangerous", "Useful contact". |
| `noteOf(p, id)` | note or undefined | |
| `toggleTag(p, id, i)` | void | Toggles `TAGS[i]`. |
| `togglePin(p, id)` | void | |
| `pinned(w, p)` | `Character[]` | Pinned people who are alive. |

**Tick hooks.** None; UI only (web.ts commands `ntag`, `npin`; `ui/views_a.ts`, `ui/brief.ts`).

**Depends on / used by.** Types only. Used by web.ts, `ui/views_a.ts`, `ui/brief.ts`.

**Invariants & rules.** Purely the player's own annotations; no simulation system reads them.

**Save compatibility notes.** `notes` is optional.

**Known issues / gaps.** Tags are stored as their display text, so renaming a tag orphans existing notes.

## background.ts

**Purpose.** At new game the player chooses who he was before March 1970 (street hustler, former boxer, connected family, small businessman, ex-convict, driver). The choice decides who already knows him (mutual trust, an introduction record, a `lastMet` ten days ago) and gives small adjustments to skills, cash, standing, heat or stolen cars. It does not restrict what he can become.

**State owned.** `p.bg`, `p.intro`, `p.rels` and the chosen people's `rels[player]`, `p.skills`, `p.cash`, `p.standing`, `p.heat`, `p.cars`.

**Public API.**

| Export | Returns | Notes |
|---|---|---|
| `interface Background { id; label; blurb }` | | |
| `BACKGROUNDS: Background[]` | | The six backgrounds. |
| `bgLabel(id?)` | label or undefined | |
| `applyBackground(w, p, id)` ([background.ts:27](../../src/background.ts)) | void | Applies the background; picks the acquaintances at random (uses `w.rng`). |

**Tick hooks.** None; called once by web.ts right after `createWorld` ([web.ts:380](../../src/web.ts)).

**Depends on / used by.** Imports core (`clamp`, `rel`). Used by web.ts and `ui/views_b.ts` (`bgLabel`).

**Invariants & rules.** Because it draws from `w.rng`, the same seed with different backgrounds produces different histories. The CLI, tests and the playtest driver do not apply a background.

**Save compatibility notes.** `bg` is optional.

**Known issues / gaps.** Cash bonuses (+$300, +$1,500, +$200) are created without a ledger entry (harmless at creation).

## How this group connects to the rest

- `advance` → every system's `*Tick`/`*Week` function in the fixed order above; `think` → `actions.chooseAction`/`perform` for NPC autonomy.
- Every module that records an event → `core.addFact` → `core.learn` for actor, victim, witnesses and broadcast lists → `known` maps that dialogue, gossip (`actions.share`), reports, boss jobs and memories must consult. Hidden culprits → `core.suspect` → grudges against (possibly the wrong) outside family member → `actions` retaliation and `danger.ts` threats.
- `core.learn` → `rel().grudge`/`trust` → retaliation scoring in actions.ts, purge targets in consequences.ts, threats in danger.ts, wants in pulse.ts.
- `core.earn`/`record` → `books.gross` and `weekIncome` → `books.settleWeek` kick-up settlement; engine's ordering decides which week income settles in.
- `core.createDebt`/`payDebt` ↔ `ledger.post` (records only) and `econ.bizMove` (till payments); engine weekly → `econ.seizeShare` on default; `onDebtCleared` → jobs, memos, encounters.
- `core.handleDeath` → `goals.goalsOnDeath`, `econ.succeedOwner`/`transferBusiness`, `orgs.succeed` (boss succession), `rank.repairHierarchy`; later cleanup of threats, ventures, rackets and goals happens lazily in their own ticks.
- `world.createWorld` → `life.lifeInit`, `ambition.ambitionInit`, `orgs.ensureOrgs`, `clubdata.ensureClubs`; `econ` and `life` → `world.spawnCivilian`.
- `retain.sweep` deletes facts that nothing references; any module that keeps a fact id in a value is automatically protected. `actions.share` uses `gossipCap`/`gossipFresh` to limit NPC gossip.
- `consistency.audit` aggregates the issue checks of rank, orgs, econ, goals and situ; `reconcile` uses `core.isResolved` to close grievances and memos.
- `pulse.pulseWeek` → `econ.setCollector` (shops changing hands), `world.addShops`, `encounters.addEnc`; answers come back through `crewlife` → `pulse.pulseChoose`.
- `places`/`where` → `clubdata.clubPresent`, `encounters.forceEncounter`, `jobs.forceBossOffer`; `memory.recall` → `voicesheet.say`, `powers2.ledgerOf`, read by dialogue.ts.

## Replacing this system

A drop-in replacement of the core would have to provide:

- **The `World` shape and field names** exactly as in [types.ts](../../src/types.ts). About 60 modules and the UI read and write `w.chars`, `w.biz`, `w.fam`, `w.facts`, `c.known`, `c.rels`, `c.cooldown`, `c.books`, `w.debts`, `w.pending`, `w.enc` and the rest directly; there is no accessor layer.
- **The core function surface** that others actually import: `addFact`, `learn`, `rel`, `link`, `money`, `clamp`, `ownerBiz`, `ownersChanged`, `famName`, `factText`, `flavour`, `createDebt`, `payDebt`, `handleDeath`, `earn`, `record`, `witnessesAt`, `notifyProtector`, `recordCareer`, `newId`, `isResolved`, `concealedGap`, `shortTime`, `fmtTime`, `travelTime`, `isAwake`, `nextWake`, `schedule`, `DISTRICTS`, with the same side effects (including `learn`'s grudge rules and first-write-wins behaviour, `addFact`'s 30% reveal pending and its rng draws).
- **The loop**: `advance(w, until)` with `(t, seq)` ordering, the daily 09:00 and weekly Sunday 20:00 cadence, one think chain per NPC, and the same call order (tests compare seeded histories, and the old-save fixtures are replayed).
- **World creation and repair**: `createWorld(seed, playerName, opts)`, `ensureShape`, `addShops`, `spawnCivilian`, `STANDARD_ORGS`, `EXTRA_ORGS`, `FEMALE` (also used by the portrait painter).
- **Saves**: `serialize`, `deserialize`, `SCHEMA` with every existing migration intact.
- **Retention**: `sweep`, `referencedFacts`, `tierOf`, `gossipCap`, `gossipFresh`, honouring the `f<n>` id convention that the reference walk depends on.
- **Checks**: `audit` (tests depend on an empty result) and the daily `reconcile`.

What makes it hard:

- **Circular imports.** core imports econ, rank, orgs, goals and ledger, all of which import core; world and life import each other; pulse and crewlife import each other. They work only because nothing calls across the cycle at module-evaluation time.
- **Shared mutable fields with many writers.** `c.rels`, `c.known`, `c.cooldown` (about 46 key patterns across modules, mixing minute timestamps, day numbers and counters such as `restless`), `c.want` (pulse and crewlife), `Business.protection`, `Family.tension`, `w.nextId` (incremented directly in 17 modules with ad hoc prefixes).
- **Generic bags and conventions.** Non-fact keys in `known` (`'leave:<id>'`), `Situation.m`, `Job.extra`, `Enc.data` are untyped; text-matching couplings such as memory.ts reading the wording of a memoTick `ruling` fact.
- **Order-dependent bookkeeping.** `settleWeek` resets the weekly books mid-way through the weekly event, so moving a call across it changes which week money is settled in; the RNG stream makes any reordering change every seeded history.
- **Implicit contracts.** `createDebt` does not move money; `payDebt` trusts its caller; `ownersChanged` must follow any change of owner; only `econ.bizMove` may touch `Business.cash`; characters made outside `createWorld`/`addShops` never think.
- **Hidden module state.** `core.ownerCache` and `econ.tailCache` are process-local caches keyed on the world object; `retain.RETENTION`, `situ.SIT.on` and `goals.AGENCY.on` are exported mutable switches.
