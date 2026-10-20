# Organisations, rank, careers and politics

In game terms this group decides who belongs to which family, who answers to whom, who gets made, who takes the chair when a boss dies, goes inside for a long time, retires or is pushed out, and what each rank lets the player do. It runs the player's climb from associate to boss (path goals, the "make your bones" trial, the promotion case, the induction summons), the NPC families' own promotions, membership churn (retirement, expulsion, defection, splinter families), family treasuries and relations between organisations, a federal informant plot, underboss coups, the Commission's monthly rulings, and the rank-gated "powers" and lifestyle purchases. In code terms it is six modules that read and write `Character.rank` / `bossId` / `familyId`, the `Family` records in `w.fam`, and four optional `World` fields (`w.path`, `w.promo`, `w.coup`, `w.commissionAt`). The hierarchy is never stored a second time: it is derived from the characters, and `rank.ts` keeps it valid. `rank.ts` is the only module allowed to assign `c.rank` (a source-grep test in `src/tests/v72.test.ts` enforces this for every file except `rank.ts` and `world.ts`). The modules are driven by `engine.ts` ticks (daily: `promoTick`, `pathTick`, `politicsCoup`, `commissionTick`; weekly: `turfWeek`, `orgWeek`, `rankWeek`, `careerTick`, then `repairAll` and `politicsWeek`), by player actions dispatched from `web.ts`, by encounter choices routed through `encounters.ts` / `crewlife.ts`, and by the induction ceremony in `meetings.ts`.

> **Tracked bugs:** the "Known issues" notes below were checked against the source, and the confirmed ones are filed as GitHub issues: [`area: organisations`](https://github.com/agmkzy/omerta/issues?q=is%3Aissue+milestone%3A%22V85+baseline+review%22+label%3A%22area%3A+organisations%22).

## Modules

| File | Lines | Responsibility |
|---|---|---|
| [orgs.ts](../../src/orgs.ts) | 533 | Organisation records: succession scoring, leader change, treasury, inter-org relations, standing, churn (retire/expel/defect/splinter), integrity check. |
| [rank.ts](../../src/rank.ts) | 184 | The ladder, the single door for rank changes (`applyRank`), hierarchy repair and its read-only audit. |
| [career.ts](../../src/career.ts) | 528 | Seats and vacancies, readiness/eligibility, `promote`, NPC weekly promotions, the player's promotion case (`w.promo`), recommend/recruit/reward. |
| [path.ts](../../src/path.ts) | 596 | The player's road to the next rank (goals, trial, seat-making), the chair (step-aside or coup), making/breaking men, half the rank powers, turf income. |
| [powers2.ts](../../src/powers2.ts) | 637 | The rank powers table and the other half of the handlers, "who made whom" ledger, lifestyle purchases, stakes shake-downs, underboss agenda, the player's Commission, consigliere/heir. |
| [politics.ts](../../src/politics.ts) | 307 | Made-man permission rule, the informant, NPC underboss coups, Commission rulings between the most tense pair of families. |

---

## orgs.ts

**Purpose.** Since V76 an organisation is a `Family` record in `w.fam` with a stable id; nothing here assumes a number or names of families (the world generator creates five; `MAX_ORGS = 9` caps splinters). The file adds on top of the characters: the record (history, leader and since when, standing, HQ, treasury, relations), a scored succession used for every change at the top, membership churn, a treasury with a reconciling ledger, and persistent cooperation/competition/grievance between organisations that other systems read back.

**State owned.**
- `Family` (in `w.fam`): writes `bossId` (in `succeed`), `founded`, `history`, `leaderSince`, `acting`, `standing`, `hist` (ring of 40 `OrgEvent`), `treasury`, `tlog` (ring of 40 `TreasuryTx`), `tin`, `tout`, `rel` (one `OrgRel` per other organisation; `deals` ring of 6), `unrest`, `hq`, `lastChurn`; clears `heir`, `consigliere`, `acting` when they become invalid; writes `tension` in `defect`, `foundOrg` and `ensureOrgs`.
- Creates whole new `Family` records (`foundOrg`).
- `Character`: `familyId`, `bossId` (leave/defect/foundOrg/succeed), `cash` (only through `treasuryMove`), `standing` of passed-over rivals, relationships through `rel()`, and rank changes through `rank.applyRank`.
- `Club.hostId` (from `clubdata.ts`) on a leader change and in the weekly HQ sync.
- No generic bags.

**Public API.**

| Export | Returns | Description and side effects |
|---|---|---|
| `MAX_ORGS` | `9` | Cap on organisations (splinters stop at it). |
| `orgList(w)` | `Family[]` | All families sorted by id (deterministic iteration order). |
| `membersOf(w, fid)` | `Character[]` | Living, non-civilian members. |
| `leaderOf(w, fid)` | `Character \| undefined` | `fam.bossId` if alive and still a member. |
| `runningOf(w, fid)` | `Character \| undefined` | Acting boss if valid, else leader. Unused outside this file. |
| `orgOf(w, c)` | `Family \| undefined` | The character's family. Unused. |
| `hierarchyOf(w, fid)` | `{ leader?, reports, depth }` | Reporting tree and head-count per rank, read off the characters. |
| `interestsOf(w, fid)` | `Business[]` | Open businesses owned, protected or part-held by a member. |
| `logOrg(w, fid, kind, text, who?)` | void | Appends to `fam.hist` (bounded 40). |
| `orgRecord(w, fid)` | object | Read model for the UI and the boss's `orgreview` power. |
| `treasuryMove(w, fid, c, amt, why)` | number moved | The only door into or out of `fam.treasury`; positive = from `c.cash` into the fund (capped at his cash), negative = out (capped at the balance). Updates `tin`/`tout`, appends to `tlog`. |
| `treasuryCheck(f)` | number | `tin - tout - treasury`; must be 0. |
| `treasuryWeek(w)` | void | Dues (3% of up to $3,000 above a rank floor of 1,500/4,000/8,000), a rich NPC boss's contribution, support for made men in jail (120-400 per week by rank), trust erosion if the fund is short, a greedy NPC leader drawing 30% above $15,000. |
| `Cand`, `SuccOpts` | types | Candidate score breakdown; `{ favoured?, cause? }`. |
| `candidates(w, fid, not?, o?)` | `Cand[]` | Pure scoring of every member except `not` and prospects: rank weight, authority (reach / 10), weighted support of non-player made voters, reputation, ambition, named heir, consigliere, loyalty to a dead boss, jail/hurt penalties, `favoured` mandate. Sorted by score then id. |
| `chooseLeader(w, fid, not?, o?)` | `Character \| undefined` | Pure: favoured candidate if present, else the top score. Used by `rank.successor`. |
| `leaderChanged(w, fid, winner, oldId, cause, cs?)` | void | Aftermath of a change (new man already installed): sets `leaderSince`, clears `acting`/stale heir/consigliere, rewards backers, gives near-equal NPC rivals a grudge and -2 standing, sets `unrest` for a coup or thin margin, adjusts `standing`, may demote a capo rival (rng 0.4), logs, records career, hands over the club, repairs the hierarchy. |
| `succeed(w, fid, old, cause, o?)` | `Character \| undefined` | Picks and installs a successor via `applyRank(..., 'boss')` (broadcast fact to members), moves the old boss's direct reports, calls `leaderChanged`. Called by `core.handleDeath` for a dead boss. |
| `leave(w, c, 'retire' \| 'expel', why)` | void | Turns a member into a civilian with no family (succession first if he led), reattaches his men, strips a racket from an expelled collector, fact broadcast to members, sets `lastChurn`. |
| `defect(w, c, to, why)` | void | Moves a member to another family, one rank lower if capo/underboss, protection follows him, old boss's grudge, `noteGrievance`, tension +1 each way, standing changes. |
| `foundOrg(w, leader, name, why)` | `Family \| undefined` | Splinter: a capo takes everyone under him into a new family (standing 25, tension 3 with the parent). Never the player (enforced by the caller). |
| `noteDeal(w, a, b, text, coop=0.1)` | void | Raises cooperation, lowers grievance both ways; records a deal line at most once a week. |
| `noteGrievance(w, a, b, text, amt=0.15)` | void | Raises grievance, lowers cooperation both ways. |
| `hostility(w, a?, b?)` | 0.4..2 | Multiplier for trouble between members of two families; read by `pulse.ts`. |
| `relWeek(w)` | void | Moves each pair's `comp`/`coop`/`grievance` 15% towards targets built from tension, shared districts, leaders' mutual trust and grudge, cross-family business arrangements and open cross-family disputes; rounds to 3 decimals. |
| `discontent(w, c, lead, unrest=0)` | 0..1.5 | Grudge, low trust, ambition capped by rank, unrest. |
| `orgWeek(w)` | void | Weekly entry point (see tick hooks). |
| `ensureOrgs(w)` | void | Fills every optional field on old or new worlds (see save notes). |
| `orgIssues(w)` | `string[]` | Read-only integrity check used by `consistency.audit()`. |

Internal weekly passes: `standingWeek` (standing drifts 5% towards a target from size, districts, interests, a leader present and free, unrest), `leadershipWeek` (validates heir/consigliere, names an acting boss after 21 days inside, ends a reign after 120 days inside for an NPC boss by `succeed(..., 'imprisonment')` and shelving him as capo, rare voluntary step-down after 156 weeks for a careful rich NPC boss), `churnWeek` (expulsion at grudge >= 0.6, defection at discontent >= 0.5, splinter by a capo with 3+ men in an unsettled house; one event per family, then 6 weeks' rest), `retireWeek` (careful, cash-rich made men retire at 0.4% a week).

**Tick hooks.** `orgWeek` is called from `weekly()` in [engine.ts:155](../../src/engine.ts) and runs, in order: `ensureClubs`, `leadershipWeek`, HQ/host sync, `treasuryWeek`, `relWeek`, `standingWeek`, `churnWeek`, `retireWeek`. `ensureOrgs` runs from `world.ensureShape` (new world and every `deserialize`) and after `foundOrg`. `succeed` runs from `core.handleDeath` whenever a boss dies. `orgIssues` runs only through `audit()` (tests and `stress.ts`), not in the live loop.

**Depends on / used by.**
- Imports: `core` (`addFact`, `clamp`, `recordCareer`, `rel`), `rank` (`applyRank`, `rankIdx`, `repairHierarchy`, `WAGE`), `clubdata` (`ensureClubs`, `clubOf`), `types`.
- Imported by: `rank` (`chooseLeader`, `logOrg`), `core` (`succeed`), `path` (`candidates`, `leaderChanged`, `noteDeal`), `powers2` (`noteDeal`, `orgRecord`, `treasuryMove`), `politics` (`logOrg`), `meetings` (`noteDeal` after a cross-family settlement), `actions` (`noteGrievance`), `pulse` (`hostility`), `consistency` (`orgIssues`), `world` (`ensureOrgs`), `engine` (`orgWeek`), `ui/views_b` (`orgRecord`); tests `v76.test.ts`, `v76_smoke.ts`, `storage.test.ts`.

**Invariants & rules.**
- Treasury money is only ever moved between a character's cash and the fund through `treasuryMove`; `treasuryCheck(f) === 0` and `treasury >= 0` are checked by `orgIssues`.
- Per family with living members: exactly one living boss, and he is `fam.bossId`. `heir`, `consigliere`, `acting` must be living members; `acting !== bossId`.
- `rel` keys must be existing other families; `coop`, `comp`, `grievance` in [0, 1].
- `hist` <= 40, `tlog` <= 40, `deals` <= 6.
- Every family with members has a club HQ belonging to it whose host is a member.
- Civilians have no `familyId`; every non-civilian has one that exists.
- `candidates`/`chooseLeader` are pure (no rng, no writes). Where rng is consumed, member lists are sorted by id first.
- The player is never expelled, never defects, never splinters, never retires as boss and is never shelved by `leadershipWeek`. He can, however, be chosen by `succeed` (the candidate pool includes him; only the voter pool excludes him).

**Save compatibility notes.** All V76 `Family` fields are optional. `ensureOrgs` gives older saves `founded` (synthetic, negative: before the game), `history`, `treasury`/`tin`/`tout` = 0, `hist = []`, `rel = {}`, `standing = 50`, `leaderSince` (synthetic, negative), a `tension` entry and an `OrgRel` for every pair, and `hq`. Schema 7 is documented in `engine.deserialize`; no separate migration step is needed because `ensureShape` runs on load.

**Known issues / gaps.**
- `runningOf` and `orgOf` are exported but nothing uses them. The acting boss (`f.acting`) is recorded, logged, broadcast and shown in the UI, but no decision reads it: jobs, envelopes, permissions and sit-downs still go to `fam.bossId`. By the project's own rule this is state without integration.
- Interplay with `repairHierarchy`: `succeed` installs the new boss with `repair: false`, but `leaderChanged` ends with `repairHierarchy`, which finds the outgoing boss still holding rank `boss` (in the imprisonment and retirement paths) and demotes him to underboss by direct assignment, with no career line or fact, before the caller (`leadershipWeek` or `leave`) applies the rank it intended. The end state is right; the career log shows an extra step.
- `leaderChanged` never treats the player as a passed-over rival.
- `ensureOrgs` builds a `names` set that is never read; `churnWeek` declares `r` and voids it.
- Nothing in the group fills a vacant underboss chair in an NPC family (see career.ts). When the underboss wins a succession the family runs without one.

---

## rank.ts

**Purpose.** One place for rank (V72). `applyRank` is the single door for every rank change: rank, wage, career line, the historical `promotion` fact and a hierarchy repair. `repairHierarchy` enforces the structural invariants, `hierarchyIssues` checks them read-only for `audit()`, and `successor` (now just `orgs.chooseLeader`) answers who takes an empty chair.

**State owned.**
- `Character.rank` (the only writer: [rank.ts:44](../../src/rank.ts) in `applyRank`, plus direct writes inside `repairHierarchy` at [rank.ts:96](../../src/rank.ts) and [rank.ts:106](../../src/rank.ts)); `Character.wage` on rank change; `Character.bossId` during repair.
- `Family.bossId`, `leaderSince`, `acting` (deleted) when repair fills an empty chair.
- Module-level `REPAIRS: string[]`: a process-global diagnostics array (not saved, never read by the simulation, capped at 5,000 entries). Tests read it.

**Public API.**

| Export | Returns | Description and side effects |
|---|---|---|
| `LADDER` | `Rank[]` | `['associate','soldier','capo','underboss','boss']`. Re-exported by `career.ts`. |
| `WAGE` | `Record<string, number>` | Weekly wage by rank: 150 / 300 / 600 / 1000 (associate is 80, set in `applyRank`). |
| `rankIdx(r)` | number | Index in `LADDER` (-1 for civilian). |
| `RankFact`, `RankOpts` | types | Options for the fact and for `applyRank` (`by`, `fact` or `false`, `place`, `wage`, `career` or `false`, `repair: false`). |
| `applyRank(w, c, to, o?)` | boolean | Returns `false` and changes nothing if he already holds `to` (so a promotion is never applied twice). Otherwise sets rank and wage, records a career line, runs `o.place`, adds a `promotion` fact (unless `fact: false` or the new rank is civilian), and repairs his family's hierarchy (unless `repair: false`). |
| `successor(w, fid, not?)` | `Character \| undefined` | Alias for `chooseLeader`. |
| `REPAIRS` | `string[]` | See above. |
| `repairHierarchy(w, fid)` | `string[]` | (1) If the chair is empty or invalid, installs `successor()` directly (log, career line, broadcast fact). Demotes any second boss to underboss. (2) Gives every member with an invalid superior his old superior's superior, else the senior man with fewest direct reports (ties by id). (3) Breaks loops by pointing the man at the boss. Returns a description of each repair. |
| `repairAll(w)` | `string[]` | `repairHierarchy` for every family. |
| `leaveCrew(w, c, toFamily?)` | void | Clears `bossId`, optionally sets a new `familyId`, repairs both families. Keeps rank. |
| `hierarchyIssues(w)` | `string[]` | The same invariants, read-only. |

**Tick hooks.** `repairAll` runs weekly in `advance()` right after `weekly()` and `sweep()` ([engine.ts:47](../../src/engine.ts)). Everything else is called by other modules on demand.

**Depends on / used by.**
- Imports: `core` (`addFact`, `recordCareer`), `orgs` (`chooseLeader`, `logOrg`), `types`.
- Imported by: `career`, `path`, `orgs`, `core` (`applyRank`, `repairHierarchy` in `handleDeath`), `powers2`, `orders` (`applyRank` when the player takes on a prospect), `goals`, `situ`, `pulse`, `web` (`leaveCrew`), `sitmoves`/`violence`/`goals`/`situ`/`ui/family` (`LADDER`), `consistency` (`hierarchyIssues`), `engine` (`repairAll`); tests v72, v74, v76, `sit_freq.ts`.

**Invariants & rules.**
- Per family with living members: `fam.bossId` is alive, a member and rank `boss`; nobody else is rank `boss`.
- Every other non-civilian member answers to a living man of the same family who is strictly senior, or (for an associate) another associate ("a runner"). No loops.
- `applyRank` is idempotent per target rank.
- No `.rank =` assignment may appear in any source file except `rank.ts` and `world.ts` (test-enforced).
- Repair choices are deterministic (sorted by id, fewest reports first).

**Save compatibility notes.** Nothing saved here beyond the character and family fields it writes. `REPAIRS` is not saved.

**Known issues / gaps.**
- The empty-chair repair bypasses `orgs.leaderChanged`: no unrest, no rival grudges, no club host change (the weekly `orgWeek` sync fixes the host later). It also writes `rank` directly instead of through `applyRank`.
- `hierarchyIssues` does not check seat counts against `CAP` or the number of underbosses.
- `REPAIRS` is shared by every world in the process.
- Two ways to change a man's family exist with different bookkeeping: `orgs.defect` (grievance, tension, standing, history, rank drop) and `rank.leaveCrew(w, c, toFamily)` (none of that). `pulse.ts` uses the latter when an NPC walks to another family.

---

## career.ts

**Purpose.** Promotion as a process: "Nobody is promoted because a number ticked over. Someone with standing has to speak for you, there has to be a vacancy, and the man at the top has to agree." It owns seat counts and vacancies, the single readiness function (NPC rule of thumb, or the player's road from `path.ts`), `promote`, the weekly NPC promotions, the slow "noticing" that opens extra seats, the player's multi-stage promotion case in `w.promo`, and the player's own recommend/recruit/reward actions.

**State owned.**
- `World.promo` (`PromoCase`: `to`, `stage` 0..4, `since`, `next`, `sponsor`, `rival?`, `points`, `log`, `result?`). Created by `path.pathTick`, advanced and deleted here.
- `Family.lastPromo`, `Family.watch` (weeks an eligible man has waited with no seat), and shared writes to `Family.capBonus` and `Family.seatNo` (also written by `path.ts`, `powers2.ts`, `consequences.ts` and `engine.ts`).
- `Character.sponsor` (set in `promote`), `Character.backer` (set by `recommend`, cleared by `promote`), `standing`, `problem` (the resentful new crew member), relationships.
- Player's `cooldown` keys: `induct`, `rw:bonus:<id>`, `rw:praise:<id>`. Memos pushed onto `p.memos`.
- Encounters of kind `promo` (stages 0-2; the trial encounter is created in `path.ts`).

**Public API.**

| Export | Returns | Description and side effects |
|---|---|---|
| `LADDER`, `WAGE` | | Re-exported from `rank.ts`. |
| `CAP` | `{ soldier: 6, capo: 3, underboss: 1 }` | Base seats per family. |
| `isRunner(w, c)` | boolean | Associate who works for an associate: not in line for a seat. |
| `members(w, fid)` | `Character[]` | Living characters with this `familyId` (any rank). |
| `seats(w, fid, r)` | number | Count at rank `r`. |
| `capOf(w, fid, r)` | number | `CAP[r] + fam.capBonus[r]`. |
| `vacancy(w, fid, r)` | boolean | `seats < capOf`; always `false` for boss. |
| `Readiness` | type | `{ to, score, earn, sponsor?, openSeat, parts, blockers, ready? }`. |
| `sponsorOf(w, c)` | `Character \| undefined` | `c.backer` if alive, else his superior; must be at least soldier and trust `c` >= 0.35. |
| `readiness(w, c)` | `Readiness \| undefined` | Player: built from `path.pathInfo` (score = mean of goal fractions excluding the trial, `ready` set). NPC: `earn = lifetimeKick / KICK_NEEDED` (1,500 / 6,000 / 14,000), score from earnings, the boss's trust, standing, `books.influence`, sponsor, weighted by `familyStyle`. |
| `familyStyle(w, fid)` | `'old' \| 'new'` | Deterministic hash of the family id; changes the readiness weights and the UI text. |
| `eligibleIgnoringSeat(w, c)` | boolean | Player: `ready`. NPC: `earn >= 1 && sponsor && score >= 0.55`. |
| `eligible(r?)` | boolean | As above plus an open seat. |
| `promote(w, c, to, by?)` | void | `applyRank` with a broadcast fact (returns early if already that rank), `situ.promotedOver`, sets `sponsor`, clears `backer`, standing +6, re-seats capos/underbosses. Player only: ledger entry for the sponsor, a cash gift (1,000 / 2,500 / 6,000), his runners become family associates when he is made, a new capo is handed the 3 best unattached associates (one glad, one resentful with a `problem`), a new underboss's old crew passes to the best capo. Ambitious same-rank NPC rivals near the threshold get grudge +0.1. Repairs the hierarchy. |
| `careerTick(w)` | void | Weekly NPC promotions (see below). |
| `inductPlayer(w, p, to, shown)` | void | Called at the end of the induction ceremony: standing + `shown`, `promote(p, to, sponsorOf(p))`, sets `lastPromo`. |
| `turnedDown(w, p)` | void | Player refused or walked out of the ceremony: boss respect -0.2, standing -8, `cooldown.induct` = 70 days. |
| `recommendable(w, p)` / `recommend(w, p, c)` | list / lines | A made player puts one of his own associates forward: `c.backer = p.id`, trust/affection up. |
| `recruitable(w, p)` / `recruit(w, p, c)` | list / lines | A made player takes on a civilian who trusts him (>= 0.45, violence + ambition > 0.7) as an associate under him (`applyRank` to associate with `place`). |
| `careerLines(w, p)` | `string[]` | One-line summary for the UI. |
| `Row`, `standingTable(w, p)` | `{ rows, verdict }` | The "Your standing" table: earnings, reputation, support, sponsor, seats, family values, others in line, and a verdict. |
| `Step`, `promoSteps(w, p)` | `Step[] \| undefined` | Five-step view of `w.promo` for the UI. |
| `promoTick(w)` | void | Daily: advances `w.promo` (see the career section). |
| `promoChoose(w, p, e, code)` | `string[]` | Applies a promo-encounter choice (routes the trial to `path.trialChoose`). Adjusts `points`, relationships, cash, favours; one branch rolls rng. |
| `RewardOpt`, `rewardOptions(w, p, c)`, `reward(w, p, c, code)` | | The player rewarding his own man: $250 / $800 bonus (14-day cooldown per man), praise (10-day cooldown), or sponsoring him (`recommend`). Bonus effect is stronger for a man who has "earned it" (steady books or a good career record). |

`careerTick` (weekly, per family with a living boss, skipped for 10 days after `lastPromo`): for `capo` then `soldier`, skip soldier if `booksClosed`, skip the rank the player's case is holding (`w.path.hold`). With no vacancy it runs `noticeTick`; with one, it picks the eligible non-player candidate with the best score and promotes him on a 50% roll, then stops for that family that week. If the player was at the same rank with at least 80% of the NPC kick threshold, he loses 0.03 of the boss's respect and gets a memo. `noticeTick` counts consecutive weeks each eligible man has waited; at 3 and 7 weeks it reports to the man, his sponsor and the boss (`report` fact with `story: 'seat:<rank>'`; at 7 the boss's respect rises and the player gets a memo); from 12 weeks it rolls 0.2-0.85 (score, old-family trust, boss greed) to add one `capBonus` seat, otherwise sets `seatNo` for 30 days and drops the count to 6. It stops once `capBonus` for the rank reaches 3.

**Tick hooks.** `careerTick` from `weekly()` after `settleWeek` ([engine.ts:208](../../src/engine.ts)); `promoTick` daily ([engine.ts:62](../../src/engine.ts)), before `pathTick`. Player actions: `recommend`, `recruit`, `reward` from `web.ts` (and `club.ts`, `dialogue.ts`); `inductPlayer`/`turnedDown` from `meetings.ts`; `promoChoose` from `encounters.ts`.

**Depends on / used by.**
- Imports: `situ` (`promotedOver`), `powers2` (`ledgerAdd`), `core` (`addFact`, `clamp`, `famName`, `money`, `recordCareer`, `rel`), `books` (`influence`), `jobs` (`mkJob` for the induction summons), `encounters` (`addEnc`, `addFavour`), `voice` (`arch`, `pick`), `rank`, `path` (`trialChoose`, `pathInfo`; imported at the bottom of the file), `types`.
- Imported by: `engine`, `path`, `powers2`, `meetings`, `encounters`, `dialogue`/`flows`/`goals` (`readiness`), `consequences` (`capOf`, `seats`), `club` (`recommend`, `recommendable`), `violence`/`pulse` (`members`), `web`, `ui/family`, `ui/views_a`, `ui/views_b`, `ui/pathview`; tests v72, v74, v76, `v76_trace_probe.ts`.

**Invariants & rules.**
- A promotion needs a sponsor, a seat and a decision. For NPCs the decision is a 50% roll per week; for the player it is the promotion case plus the ceremony.
- `promote` can never be applied twice (guarded by `applyRank`).
- One promotion per family per week at most from `careerTick`, and none within 10 days of the previous one.
- A seat being held for the player's case (`w.path.hold`) is not given to an NPC.
- `noticeTick` never takes `capBonus` above 3 for a rank.

**Save compatibility notes.** `w.promo`, `lastPromo`, `watch`, `capBonus`, `seatNo`, `sponsor`, `backer` are all optional. The schema-2 migration in `engine.deserialize` sets `capBonus` and `seatNo` to `{}` on very old saves. `promoTick` deletes a decided case 60 days after it began.

**Known issues / gaps.**
- In the promotion decision, `myScore` and `rvScore` are computed and then voided ([career.ts:382](../../src/career.ts)), so the outcome is `win = vacancy && points > -2.5`. This is deliberate, per the comment ("You did the whole road. What you say at the table can still sink you, but not for long."). The rival still matters through the stage-1 point choices.
- In `promoTick`, if the sponsor has died `pc.sponsor` is reassigned to the boss but the local `sp` still refers to the dead man, who is then named in the summons brief.
- `npcReadiness` contains a dead clause (`to === 'boss' && false`).
- `careerTick` only handles `capo` and `soldier`. No NPC is ever promoted to underboss, so an underboss chair vacated by a succession, death or demotion stays empty unless the player fills it.
- `noticeTick` dereferences `r.sponsor!` when the count reaches 7. For the player, readiness can be `ready` with no `sponsorOf` (the capo and underboss goals do not require one), so a sponsorless player at the top of the watch list would throw. It is only reachable when no case is holding the seat, most plausibly during the 70-day `turnedDown` cooldown.
- The NPC thresholds (`KICK_NEEDED` 1,500 / 6,000 / 14,000) are a tenth of the player's (`path.NEED` 15,000 / 25,000 / 50,000). The passed-over memo and the "Others in line" row use the NPC values.
- Cash moves that skip the ledger or create money: the player's promotion gift comes from nowhere (not from the treasury); the stage-0 envelope ($300) is a direct transfer, not posted; the stage-1 tribute ($500) leaves the economy; `reward` bonuses are direct transfers. Character cash is not audited (only business cash and treasuries are), so tests do not catch this.
- `members()` duplicates `orgs.membersOf` (which excludes civilians) and `rank.ts`'s private helper.
- `recruitable` does not check the target's family and takes the first four in object order.
- `fam.watch` entries for men who die or change rank are never removed.
- A "passed" decision always tells the player he "said the wrong things at the table", even when the cause was that no seat was free.

---

## path.ts

**Purpose.** The player's road up. Each rank has a visible list of goals with progress, a trial for the first rank, and a guarantee that once everything is done the family makes room. Above capo the road is the chair: ask the boss to step aside or move against him. The file also holds what rank lets the player do to others (make men as underboss, set any rank as boss), the dispatcher for rank powers (shared with `powers2.ts`), and weekly turf income.

**State owned.**
- `World.path` (`PathState`), created lazily by `pathState()`: `deeds`, `counted` (job ids already counted; trimmed by 100 once over 300), `trial` (per rank), `retry`, `hold`, `latch`, `fails`, `kills`, `turf`, `book`, `guar` (guarantees from the `stand` power). `powers2.ts` adds more fields to the same object.
- Player `cooldown` keys: `famHit`, `chair`, `raise`, `pw:<code>`.
- `Family.capBonus` (`openSeat`), `Family.directive` and `Family.levy` (powers), `Family.tension` (`lean`, `peace`), `Character.kickRate` (`rules_*`), `Character.books.side`/`sideKnown` (`piece`, `book`, `review`), `Character.hustle` (`stand`, `award`).
- Creates the `w.promo` case, trial encounters, family-hit jobs and the chair "induction" summons.

**Public API.**

| Export | Returns | Description and side effects |
|---|---|---|
| `pathState(w)` | `PathState` | Creates `w.path` if missing. |
| `underlings(w, c)` | `Character[]` | Everyone below `c`, breadth first. |
| `Goal`, `PathInfo` | types | Goal rows; `{ to, goals, ready, trial, retryAt }`. |
| `pathInfo(w, p)` | `PathInfo \| undefined` | Goals for the next rank (see the career section). For `to === 'boss'` a single "chair" goal, done only if the boss is dead, with `ready: true`. If `latch[to]` is set every non-trial goal reports done. |
| `pathBlockers(w, p)` | `string[]` | Tips for unmet goals. Unused outside the file. |
| `pathTick(w)` | void | Daily: counts deeds and kills, settles due guarantees, then (unless a case is open) offers the family hit, the trial, or opens the promotion case (see below). |
| `trialChoose(w, p, e, code)` | `string[]` | Resolves the trial encounter: rng against `chanceOf(way)` (0.35-0.92, +0.12 per earlier failure up to +0.3). Pass: `trial[to] = 'passed'`, standing +3. Fail: retry in 3 days, standing -1. |
| `chairReady(w, p)` | boolean | Player is underboss and the boss is alive. |
| `ChairOpt`, `chairOptions(w, p)` | `ChairOpt[]` | "Ask him to step aside" (boss trust/respect against his ambition/greed) and "Move against him" (capos who trust you, your nerve, men loyal to him); +0.2 each if he is inside; 0 while `cooldown.chair` runs. |
| `chairAct(w, p, code)` | `string[]` | Rolls the chosen option. Ask/win: boss becomes capo, `takeChair`, ceremony summons, broadcast fact. Ask/lose: 30-day cooldown, boss trust -0.25, grudge +0.3. Move/win: murder fact broadcast to the family, `handleDeath(boss, { cause: 'coup', favoured: p })`, ceremony, standing -6. Move/lose: 45-day cooldown, hurt 10 days, standing -20, boss grudge 0.9, capos' trust -0.2. |
| `Raise`, `raisable(w, p)`, `raise(w, p, c, to)` | | Underboss only: make an associate (lifetime kick >= 400) a soldier. Opens a seat if the boss trusts him >= 0.5, `promote`, ledger entry, 3-day cooldown. |
| `RANKS`, `setRank(w, p, c, to)` | | Boss only: set any member's rank (associate..underboss), re-seat his men, broadcast fact, no seat cap. |
| `Power`, `powerOptions(w, p)` | `Power[]` | Delegates to `powers2.powerOptions`. |
| `usePower(w, p, code)` | `string[]` | Refuses if the option is off; tries `powers2.usePower2` first; otherwise handles the codes listed below. |
| `turfWeek(w)` | void | Weekly: each claimed district's businesses (not the player's own) pay 10% of income, capped at their cash, via `econ.bizMove(..., 'extort', p.id)`; the player gets it through `earn(..., 'protection')`; heat +0.01 per district. |

Powers handled in `path.usePower` (minimum rank in brackets; cooldown in days):
`lawyer` (soldier; heat to 0, out of jail; a boss frees every jailed member; 10/14), `courtesy` (soldier; $200-600; 5), `crewscore` → `score` (capo; $250-700 per crew member, heat, 20% chance a man is jailed; 7), `dinner` (capo; -$400, crew trust; 7), `tax` (underboss; $900-2,000 per capo; 7), `counsel` (underboss; boss trust/respect; 8), `tribute` (boss; envelopes by rank; 7), `piece` (soldier; rng on the superior's trust, +$250/week side income; 30), `stand` (soldier; guarantee a crew member's hustle expansion, settled in 90 days by `pathTick`; 14), `award` (capo; hustle level +1, ambition, may set `want: independent`; 14), `quiet`/`push` (underboss; `fam.directive` for 14 days, read by `hustle.ts`; 14), `review` (underboss; exposes hidden side income and under-declaring; 10), `rules_down`/`rules_up` (boss; every member's `kickRate` ±0.05; 45), `book` (soldier; up to 3 loan books, side income 10% of cost; 3), `claim` (soldier; -$1,500, add a family district to `turf`, fact; 10), `ear` (capo; -$250, learn two recent unknown facts as `informant`; 6), `lean` (underboss; $3,000-6,500, tension +2 with a random other family, fact; 10), `peace` (underboss; -$1,000, worst tension -3, `noteDeal`; 12), `levy` (boss; 7% for 4 weeks, read by `books.ts` and `core.concealedGap`; 60), `bonus` (boss; $200 to every made man; 30), `commission` (boss; heat -0.3, standing +4; 14).

**Tick hooks.** `pathTick` daily after `promoTick` ([engine.ts:63](../../src/engine.ts)); `turfWeek` from `weekly()` ([engine.ts:154](../../src/engine.ts)). Player actions through `web.ts`: `chairAct`, `raise`, `setRank`, `usePower`. `trialChoose` via `career.promoChoose`.

**Depends on / used by.**
- Imports: `powers2` (`ledgerAdd`, `powerOptions`, `usePower2`), `econ` (`bizMove`), `core` (`addFact`, `clamp`, `earn`, `factText`, `famName`, `handleDeath`, `learn`, `money`, `rel`), `encounters` (`addEnc`), `jobs` (`mkJob`), `career` (`capOf`, `isRunner`, `LADDER`, `members`, `promote`, `sponsorOf`, `vacancy`, `WAGE`), `rank` (`applyRank`, `repairHierarchy`), `orgs` (`candidates`, `leaderChanged`, `noteDeal`), `types`.
- Imported by: `career` (`pathInfo`, `trialChoose`), `powers2` (`pathState`, `underlings`), `dialogue` and `ambition` (`pathInfo`), `engine`, `web`, `ui/pathview`, `ui/views_a`; tests v72, v76, `v76_trace_probe.ts`. `hustle.ts`, `specs.ts` and `memory.ts` read `w.path` fields directly.

**Invariants & rules.**
- Progress is cumulative across the whole climb: `lifetimeKick`, `deeds` and `kills` are never reset, and the thresholds in `NEED` are totals.
- Deeds count completed non-summons jobs of the player and everyone under him, once per job id. Kills count only `hit` jobs given by the boss (`via: 'boss'`) and done by the player himself.
- Once the non-trial goals for a rank are all met, `latch[rank]` is set and stays set: later losses of trust or backers do not undo it.
- A seat is never what holds the player back once the road is done: `makeRoom` opens one (or, for underboss, moves the sitting underboss aside).

**Save compatibility notes.** `w.path` is optional and created on demand; every field except `deeds`, `counted`, `trial`, `retry` is optional. The v4 migration in `engine.deserialize` moves pre-V73 `path.stakes` onto the businesses and deletes it (the field stays in the type).

**Known issues / gaps.**
- `crewscore` has no effective cooldown: `usePower` renames the code to `score` before `set()` runs, so the cooldown is written to `pw:score` while `powerOptions` reads `pw:crewscore` ([path.ts:406](../../src/path.ts), [powers2.ts:158](../../src/powers2.ts)).
- `TRIAL` has capo and underboss entries but only the soldier rank uses a trial (`pathInfo` reports `'passed'` for the others), so that content is never shown.
- `makeRoom` for underboss demotes the sitting NPC underboss when the case opens, not when it is won. If the player then loses the case, the family is left without an underboss, and no NPC mechanism fills the seat.
- `openSeat` adds up to 8 `capBonus` seats with no regard for the cap of 3 used by `noticeTick` and the engine's random seat growth.
- `familyHit` picks a random associate or soldier in another family (`w.rng.pick`) and gives a reason ("taking what isn't his on your ground") that no fact supports, against the "nothing happens without a reason" rule. It does not consult `sanctioned`.
- Knowledge: the chair coup's murder fact is broadcast to the whole family with the player as a visible actor, so every member knows who did it, while the text says "Don't let anyone work out how". The `lean` fact is broadcast to the other family with the actor known, while its text says "Somebody".
- Money is created by `courtesy`, `score`, `tax`, `tribute` and `lean` (credited through `earn()` without debiting anyone), by a good guarantee, and by `stand` (the man receives 20% of the stake from nowhere). It is destroyed by `dinner`, `claim`, `peace`, `ear`, `book` and a bad guarantee. None of this is audited.
- Unused: `cd`, `waitDays`, `TURF_CAP` (lines 395-397; `powers2.ts` has its own `TURF_CAP`), the `WAGE` import, `void capOf`, `void promote`, `void was`. `pathBlockers` is exported but unused.
- A boss can exceed every seat cap with `setRank`; `raise` is underboss-only.

---

## powers2.ts

**Purpose.** What each rank can do, cumulatively: promotions never take a power away. Besides the powers table and the handlers that only live here, it keeps the "who made whom" ledger (read back in dialogue), lifestyle purchases with weekly upkeep, the business-stake shake-down by another family's made man, the underboss's weekly agenda requests from capos, the player's Commission (courting other bosses, proposals, alliances), and naming a consigliere and heir.

**State owned.**
- `PathState` extras: `ledger` (ring of 40), `origin`, `life`, `comm` (`court`, `allies`, `cd`), `chest`, `lieut`, `successor`, `favs`.
- `Family.consigliere`, `heir`, `booksClosed`, `levy` (emergency), `directive` (Commission collective response), `capBonus` (opening the books), `tension` (agenda, alliances, Commission), `treasury` (through `treasuryMove`).
- `Character.insight` (holding court), `p.rep.favoured`, `Character.kickRate` (crew powers), `books.side`, `books.arrears`, `Stake.share`/`shaken`, `Business.distress`, `Dispute.status`.
- Player `cooldown` keys `pw:<code>`.

**Public API.**

| Export | Returns | Description and side effects |
|---|---|---|
| `ledgerAdd(w, kind, who, text)` | void | Appends to `path.ledger` (40). Written with `'sponsor'` by `career.promote` and `'made'` by `path.raise`. |
| `ledgerOf(w, who)` | entries | Ledger entries about one man (read by `memory.ts`, `ui/pathview`). |
| `historyLines(w, p, t)` / `ledgerLine(w, p, c)` | `string[]` / string | Lines a man says about your shared history (sponsor, made, one of your first men). `historyLines` is used by `dialogue.ts`; `ledgerLine` is unused. |
| `LifeItem`, `lifeOf(w)`, `lifeOptions(w, p)`, `buyLife(w, p, code)` | | Apartment, house, estate, Cadillac, Lincoln, own social club, driver, each with a minimum rank, a prerequisite, a price and weekly upkeep. `buyLife` takes the price from `p.cash` and adds standing +2. |
| `hasHQ(w)` | boolean | Unused; `hustle.ts` reads `w.path.life.hq` directly for a +10% crew bonus. |
| `Power2`, `powerOptions(w, p)` | `Power2[]` | The whole powers table by rank (associate, soldier, capo, underboss, boss), cooldown hints and availability flags, de-duplicated by code. |
| `usePower2(w, p, codeIn)` | `string[] \| undefined` | Handles `fund_out`, `fund_in`, `orgreview`, `proposition:<biz>`, `errand`, `tipoff`, `squeeze`, `findscore`, `sidearr`, `favour:<id>`, `protect`, `blame`, `court`, `crew_up`/`crew_down`, `lieut`, `successor`, `chest_in`/`chest_out`, `council`, `allocate`, `replace`, `books`, `emergency`, `dispense`, `grant`; returns `undefined` for anything else so `path.usePower` can handle it. |
| `agendaChoose(w, p, e, code)` | `string[] \| undefined` | Resolves `crew` encounters with `data.what` = `shake`, `agenda_expand`, `agenda_territory`, `agenda_funds` (called from the `crewlife.ts` chain). |
| `CommState`, `commOf(w)` | | `path.comm`, created on demand. |
| `supportOf(w, p, fid)` / `supportWord(s)` | 0.05..0.95 / label | Another boss's support: tension, his trust in you, courting, alliance. |
| `courtBoss(w, p, fid)` | `string[]` | -$2,000, `court[fid]` +0.15 (max 0.3, decays 0.02/week), his trust +0.08, 14-day cooldown per family. |
| `Proposal`, `proposals(w, p)` | `Proposal[]` | Peace, joint investment ($8,000), recognition, collective response to heat ($1,000), alliance with each family. |
| `propose(w, p, code, fid?)` | `string[]` | One rng vote per other boss (`supportOf` adjusted by traits); majority passes (alliance: the one boss). Effects on tension, standing, heat, `directive`, `allies`, money. 21-day cooldown per proposal key. |
| `setConsigliere(w, p, c)` / `setHeir(w, p, c)` | `string[]` | Boss only. Both feed `orgs.candidates` (heir +1.6 scaled by support; consigliere +0.1). Naming an heir costs the other capos' trust. |
| `setBoss(w, p, c, to)` | `string[]` | Underboss or boss moves an associate/soldier under a capo. |
| `rankWeek(w)` | void | Weekly entry point (see below). |

Internal weekly passes, all called by `rankWeek`: `ledgerTick` (men the player made either start claiming they rose alone or send an envelope), `lifeWeek` (upkeep, heat relief from home and driver, standing from an estate, crew trust from the club), `stakeWeek` (a stake reduces distress; after 6 weeks, while the player is at most soldier, an 8% chance a rival family's capo-or-above demands 10%), `agendaTick` (40% chance a week, player underboss only, a capo brings a request), `commissionWeek` (courting decays; each ally lowers tension by 1 and pays a boss player $500), `consigTick` (player boss's consigliere passes on one non-minor fact he knows that the player does not). `rankWeek` also fixes `path.origin` the first time it runs and adds `books.side` to the player's cash.

**Tick hooks.** `rankWeek` from `weekly()` right after `orgWeek` ([engine.ts:156](../../src/engine.ts)). Player actions from `web.ts`: `buyLife`, `courtBoss`, `propose`, `setConsigliere`, `setHeir`, `setBoss`, and powers through `path.usePower`. `agendaChoose` from `crewlife.ts`.

**Depends on / used by.**
- Imports: `orgs` (`noteDeal`, `orgRecord`, `treasuryMove`), `econ` (`addStake`, `bizMove`, `stakesOf`), `core` (`addFact`, `clamp`, `earn`, `factText`, `learn`, `money`, `rel`), `encounters` (`addEnc`, `addFavour`), `career` (`members`, `LADDER`), `jobs` (`newOffer`), `path` (`pathState`, `underlings`), `rank` (`applyRank`, `repairHierarchy`), `ledger` (`post`), `specs` (`hasPerk`), `types`.
- Imported by: `path`, `career` (`ledgerAdd`), `dialogue` (`historyLines`), `memory` (`ledgerOf`), `crewlife` (`agendaChoose`), `engine` (`rankWeek`), `web`, `ui/pathview`; test v76.

**Invariants & rules.**
- Powers are cumulative by rank (`at(min)`), each with a cooldown stored as `p.cooldown['pw:<code>']`.
- The family fund is touched only through `orgs.treasuryMove`.
- The consigliere only passes on facts he actually knows, with his own `knowsActor`.
- `squeeze` posts each collection to the ledger as a kick-up.

**Save compatibility notes.** Every field is optional on `PathState`/`Family`; `lifeOf` and `commOf` create their objects on first use. `path.ledger` is a ring of 40.

**Known issues / gaps.**
- Favour direction. The project convention (`encounters.owedTo`/`owing`, `flows.ts`, `memory.ts`, `ui/views_a.ts`) is `from` = the man owed, `to` = the man who owes. The `favour` collection power lists favours with `f.to === p.id`, which are the ones the player owes, and takes cash from `f.from`, the creditor ([powers2.ts:143](../../src/powers2.ts), [powers2.ts:288](../../src/powers2.ts)). The `shake` branch where the sponsor steps in records `addFavour(w, p.id, sp.id, ...)`, which makes the sponsor the debtor, while the text says the player owes him ([powers2.ts:482](../../src/powers2.ts)).
- `lieut`, `successor` and `chest` are written but nothing reads them, although the hints promise effects (the lieutenant collects more; the successor gets a crew when you move up; the chest covers legal bills).
- `path.origin` is fixed the first time `rankWeek` runs. An empty array is truthy, so a player with no men in week one keeps `origin = []` forever and the "one of your first men" lines never appear. The V85 playtest save has `origin: []` (the player's first runner joined on day 12).
- Ledger kinds `'chair'` and `'backer'` are never written; the `'backer'` branch in `historyLines` is dead.
- Money created or lost without a counterparty: weekly `books.side` (intended: "off the books"), ally income, `propose` investment (+$14,000 on success; a failure refunds $4,000 of $8,000 and the `earn(p, 0)` call does nothing), `allocate` (each hustler under the capo also gets `amt/8` from nowhere), agenda "funds" (the boss pays up to $3,000 of what he has, the capo always gets $3,000), agenda "expand" (+$1,500 to the capo), `proposition` (the player pays $2,000, the business receives $1,600), `ledgerTick` envelopes from a man with less cash than the envelope, `chest_in` (money parked outside any account until `chest_out`).
- `propose`, `courtBoss` and `setBoss` rely on the UI for rank gating (the Commission screen is offered only to a boss); `propose` has no rank check of its own.
- `court` shuffles the crew with an rng comparator (`sort(() => rng.next() - 0.5)`): deterministic for a given JS engine, but biased.

---

## politics.ts

**Purpose.** What happens above and around the player: the rule that a made man cannot be touched without permission, a federal informant inside one family who is eventually exposed in an indictment (or found out earlier with the player's help), NPC underbosses plotting against their bosses with the player asked to take a side, and the Commission ruling every 28 days on the most tense pair of families.

**State owned.**
- `Character.informant` (`{ since, evidence, agent, exposed? }`).
- `World.coup` (`Coup`: `fam`, `plotter`, `boss`, `start`, `resolveAt`, `back`).
- `World.commissionAt`.
- `Family.tension` (Commission rulings), `Family.standing` (failed coup).
- Player `cooldown` key `sanction:<targetId>`; `p.backer` after a coup; `w.threats` via `threatOf`.
- Encounters of kind `suspect` and `side`.

**Public API.**

| Export | Returns | Description and side effects |
|---|---|---|
| `isMade(c)` | boolean | Soldier or above. |
| `sanctioned(w, p, target)` | boolean | May the player move against `target`: always for a non-made man; for a made man only while `sanction:<id>` runs or family tension is >= 9. Read by `actions.ts`, `revenge.ts`, `violence.ts` and the UI. |
| `askPermission(w, p, target)` | `string[]` | The player asks his superior. Same family: always refused. Otherwise an rng roll on trust, a known grievance (facts the player knows with him as victim and the target as actor), rank and standing. Yes: 14-day sanction. No: respect -0.03. |
| `politicsWeek(w)` | void | Weekly: after day 45, 20% chance to pick one informant (made, not boss, with debt, gambling, a frightened voice or a recent spell inside; 45% preference for the player's family). Evidence grows 0.025-0.06 times a rank weight each week; 20% chance a family member sees him with the agent (rumour fact). At evidence >= 1, `indict`. While above 0.25 in the player's family, a 22% chance of a `suspect` encounter. |
| `suspectChoose(w, p, e, code)` | `string[]` | `watch` (may confirm), `boss` (the boss kills him; if he was innocent, 30% chance he is killed anyway on the rumour), `confront`, `ignore`. |
| `politicsCoup(w)` | void | Daily: resolves the open coup when due; otherwise per family, if the underboss has ambition >= 0.65 and respect for the boss <= 0.55, a 1.2% daily chance (+7% if the boss is inside, scaled up by unrest) to start one. Rumour fact to made men; a `side` encounter for a made player in that family. Only one coup at a time in the world. |
| `sideChoose(w, p, e, code)` | `string[]` | Back the plotter, warn the boss (resolution brought forward to within 10 days), or stay out. |
| `commissionTick(w)` | void | Every 28 days: the pair of families with the highest combined tension, if >= 6, gets a ruling: 55% tension x0.4, 25% x0.7, 20% +2. `ruling` fact broadcast to both families' made men. |
| `politicsChoose(w, p, e, code)` | `string[]` | Dispatcher for `suspect` and `side` encounters (called by `encounters.ts`). |

Internal: `indict` (up to 5 made men of the family jailed 45-150 days, the informant exposed and jailed 900 days, raid fact broadcast to everyone alive, the player picked up with probability 0.25 + heat x0.2 if he is in that family), `suspicion` (creates the encounter through a family member who trusts the player), `resolveCoup` (weighs backers and the capos'/soldiers' leanings; the winner has the loser killed through `core.handleDeath`, with `cause: 'coup', favoured: plotter` when the plotter wins, so `orgs.succeed` installs him; the player is rewarded or marked according to the side he took).

**Tick hooks.** Daily `politicsCoup` and `commissionTick` ([engine.ts:64-65](../../src/engine.ts)); weekly `politicsWeek` in `advance()` after `repairAll` ([engine.ts:50](../../src/engine.ts)). `askPermission` from `web.ts` and `revenge.ts`; `politicsChoose` from `encounters.ts`.

**Depends on / used by.**
- Imports: `actions` (`tension`, unused), `core` (`addFact`, `clamp`, `handleDeath`, `money` (unused), `rel`), `encounters` (`addEnc`, `addFavour`), `danger` (`threatOf`), `orgs` (`logOrg`), `voice` (`arch`, `pick`), `types`.
- Imported by: `actions` and `violence` (`sanctioned`, `isMade`), `revenge` (`askPermission`, `isMade`, `sanctioned`), `encounters` (`politicsChoose`), `engine`, `web`, `ui/views_a`, `ui/views_b`, `ui/views_c`; test v76.

**Invariants & rules.**
- A made man of another family is off-limits without a sanction (or open war, tension >= 9); a made man of your own family is never sanctioned, and the remedy is a sit-down.
- Coup murders and informant killings are hidden-actor facts (`hiddenActor: true`); bystanders who hear of them get suspicions, not certainty. `addFact` may schedule a later reveal.
- At most one coup at a time.

**Save compatibility notes.** `informant`, `coup` and `commissionAt` are optional; absence means none yet. `commissionAt` undefined is treated as 0, so the first ruling can happen on day 28.

**Known issues / gaps.**
- `tension` (from `actions.ts`) and `money` are imported but unused. The `tension` import alone creates an `actions` ↔ `politics` import cycle.
- At most one informant per world, ever: the "choose one" test (`some((c) => c.informant)`) also counts exposed and dead informants, and characters are never deleted. This matches the comment `// choose one, once`, so it is by design. Change the test to `c.informant && !c.informant.exposed && c.alive` if repeat informants are wanted.
- `politicsCoup` does not exclude the player. A player underboss with ambition >= 0.65 and respect for the boss <= 0.55 can be chosen as the plotter (he would get an encounter from himself, and a failed plot runs `handleDeath` on him). A player boss can be the target, and the encounter then asks him to side with or against himself.
- Favour direction is inverted three times relative to the project convention: [politics.ts:141](../../src/politics.ts) (giving the boss the informant), [politics.ts:245](../../src/politics.ts) and [politics.ts:267](../../src/politics.ts) (coup outcomes) record the player as owing the man he helped.
- `sideChoose('stay')` changes nothing, although the text says "Nobody trusts you quite as much afterwards".
- The Commission's ruling text says "whoever started it pays", but no money moves; only tension is scaled.
- `RANKW.associate` is never used because informants are always made men.
- `indict` shuffles targets with an rng comparator (deterministic per engine, biased). `suspectChoose('watch')` contains a no-op (`p.known = p.known ?? {}`) and caps the evidence at 0.95, which only delays the indictment.

---

## The player's career, end to end

### Starting point

The default start is an associate of the Corrente family whose superior (`p.bossId`) is a capo, with no `w.path` and no `w.promo`. Everything below is evaluated against the family's boss (`w.fam[fid].bossId`), the player's superior and his `backer`.

### The goals for each rank

`pathInfo` ([path.ts:42](../../src/path.ts)) builds the goals from `NEED` ([path.ts:16](../../src/path.ts)). The kick-up, deed and kill thresholds are cumulative totals over the whole climb.

| Next rank | Pass up (`lifetimeKick`) | Jobs finished (`path.deeds`) | Kills on the boss's orders (`path.kills`) | Relationship goal | Trial |
|---|---|---|---|---|---|
| soldier | $15,000 | 20 | 0 | At least 3 made men of the family trust you >= 0.4, and `sponsorOf(p)` exists | Yes |
| capo | $25,000 | 40 | 1 | The boss and the underboss (if any) both trust you >= 0.5 | No |
| underboss | $50,000 | 50 | 2 | The boss trusts you >= 0.6 | No |
| boss | none | none | none | "The chair is taken, not given": done only if the boss is dead | No |

How each counter moves:
- **Earnings.** `lifetimeKick` rises only when the player hands money up in person (`books.handOver`, [books.ts:88](../../src/books.ts)) or through two dialogue gifts ([dialogue.ts:1888](../../src/dialogue.ts), [dialogue.ts:1920](../../src/dialogue.ts)). `settleWeek` never collects from the player (`pay = 0` for him, [books.ts:229](../../src/books.ts)).
- **Deeds.** `pathTick` adds one for each completed non-summons job assigned to the player or anyone under him, once per job id.
- **Kills.** Only a `hit` job with `via: 'boss'` completed by the player himself. When kills are the only unmet goal, `pathTick` creates one (`familyHit`) at most every 6 days if none is offered or active: a random associate or soldier of another family, $2,500.
- **Sponsor.** `sponsorOf` ([career.ts:38](../../src/career.ts)) is the player's `backer` if alive, otherwise his superior, provided that man is at least a soldier and trusts the player >= 0.35. The player obtains a backer mainly by asking a made man in conversation (`rk_back` in [flows.ts:86](../../src/flows.ts): needs trust >= 0.5 and respect >= 0.35, or a favour that man owes; costs a favour owed back). Other writers of `p.backer`: [dialogue.ts:1720](../../src/dialogue.ts), [orders.ts:486](../../src/orders.ts) (a made man who has noticed the player's work), and the coup outcomes in `politics.resolveCoup`.

When every non-trial goal is met, `pathTick` sets `path.latch[to] = true` ([path.ts:131](../../src/path.ts)) and the goals stay met from then on.

### The trial (soldier only)

Once latched for soldier, and while the player is neither jailed nor hurt and the boss is alive, `pathTick` offers the "Make your bones" encounter from the sponsor (or the boss) with four ways (muscle, charm, nerve, brains), each showing its odds from `chanceOf` ([path.ts:223](../../src/path.ts)). The encounter lasts 9 days. A failure, or letting it lapse, means a 3-day wait; each failure adds +0.12 to the odds (max +0.3).

### Seat and promotion case

With the road done (and the trial passed for soldier), on the next daily `pathTick` ([path.ts:145-150](../../src/path.ts)), provided `cooldown.induct` has expired and no induction summons is already waiting:
1. `path.hold = to`, so `careerTick` will not give that rank to an NPC.
2. `makeRoom`: for soldier or capo, if there is no vacancy `openSeat` raises `capBonus` until there is one and a `report` fact tells the player. For underboss, the sitting NPC underboss is demoted to capo at once (grudge +0.25 towards the player).
3. `w.promo = { to, stage: 0, since: now, next: now + 4h, sponsor: (sponsorOf(p) ?? boss).id, points: 1, log: [] }`.

`promoTick` (daily, [career.ts:339](../../src/career.ts)) then walks the case:
- **Stage 0**: the sponsor's encounter (humble +1; prove myself +0.7; $300 envelope +1.2, or -1.2 with a proud or earnest sponsor; asking about rivals -0.2).
- **Stage 1**: if an NPC of the player's rank has a readiness score > 0.35, the best of them becomes the rival and the player chooses: undermine (62%: +1; otherwise -2.5 and a big grudge), $500 tribute (+1.2), ally (+0.4 and a favour), or let the work speak. With no rival the stage is skipped.
- **Stage 2**: the boss asks "Why you?" (loyal +0.8; earner +1.6 / +0.6 / -0.6 by earnings; silence +1.5 with a cold or proud boss, else -0.8; bold +1.4 or -1.2 on an rng roll).
- A lapsed encounter costs 0.5 points. Each resolved stage waits one more day.
- **Decision** (stage 3 → 4): `win = vacancy(fam, to) && points > -2.5`. The readiness scores of the player and the rival are computed and discarded. A win sets `result: 'chosen'`, a 3-day `induct` cooldown and creates the induction summons job (`kind: 'summons'`, `meeting: 'induction'`, 7 days, from the boss). A loss sets `result: 'passed'`, a 10-day `induct` cooldown, clears `hold`, costs a little respect for the boss and leaves a memo.
- If the player is jailed at any point the case ends as passed (5-day cooldown).

If the player answers each encounter on the day it appears, the case takes roughly six to seven game days from the first `pathTick` to the summons.

### The induction ceremony

The player attends the summons from the Today screen (`web.ts` calls `meetings.openInduction`, [meetings.ts:870](../../src/meetings.ts)). The boss and the sponsor (`sponsorOf(p) ?? boss`) must both be available: alive, free, unhurt and awake ([meetings.ts:41](../../src/meetings.ts)); otherwise the meeting will not open. Up to four capos or underbosses attend as witnesses. The soldier ceremony has five items (the room, what it means, omertà, the blood oath with the saint card, the embrace); capo and underboss have four each. Choices add to a `shown` score (`sure` +2, `humble` +1). Choosing `out` (hesitate, drop the card, turn it down), or closing the meeting midway, calls `career.turnedDown`: boss respect -0.2, standing -8, and a 70-day `induct` cooldown. Finishing calls `career.inductPlayer` ([career.ts:182](../../src/career.ts)): standing + `shown`, then `promote(p, to, sponsorOf(p))`, which applies the rank and the player-specific consequences (cash gift, runners recognised as family associates, a crew of three for a new capo with one glad and one resentful man, the old crew handed on for a new underboss, the sponsor entry in the ledger). If the summons is left to expire, `jobs.daily` takes 3 standing and 0.05 of the giver's trust, and `pathTick` opens a new case once the cooldown allows.

### Beyond capo: the chair

As underboss the player has no goals to fill. `pathInfo` reports a single "chair" goal and `pathTick` does nothing. The routes to boss are:
- `chairAct('ask')`: the boss steps aside, becomes a capo, `takeChair` installs the player through `applyRank` and `orgs.leaderChanged` (cause `stepped`).
- `chairAct('move')`: the boss is killed through `handleDeath(..., { cause: 'coup', favoured: p })`, so `orgs.succeed` installs the player with a mandate.
- The boss dies of anything else: `orgs.succeed` scores every member, the player included, and may choose him.
- An NPC boss inside for more than 120 days: `leadershipWeek` runs a succession that may choose the player.

The two `chairAct` routes also issue a "The family gathers" induction summons with `to: 'boss'`, whose ceremony only adds standing and a career line. The NPC coup in `politics.ts` never makes the player boss (though see the guard issue noted there).

Ranks also open powers (see `powers2.powerOptions`): as underboss, `raise` makes soldiers; as boss, `setRank`, consigliere and heir, the family fund and the Commission.

### What gates each step

| Step | Gate | Where |
|---|---|---|
| Any progress | In a family, alive | `pathTick` |
| Goals | Cumulative kick-up, deeds, kills; relationship thresholds; sponsor for soldier | `pathInfo` |
| Trial | Latched; not jailed/hurt; boss alive; 3-day retry | `pathTick`, `trialChoose` |
| Case opens | No open case; `cooldown.induct` expired; no waiting induction summons | `pathTick` |
| Seat | Always made (`makeRoom`); for underboss the incumbent is moved aside | `makeRoom`, `openSeat` |
| Case won | Seat still free and `points > -2.5`; not jailed | `promoTick` |
| Ceremony | Boss and sponsor available; complete every item without `out` | `openInduction`, `inductionChoose` |
| Boss | Underboss; rng on trust/backers; 30/45-day cooldown after failure | `chairOptions`, `chairAct` |

### Why no promotion happened in the 35-day playtest

CLAUDE.md and HANDOFF.md record that no promotion (the player's or anyone else's) occurred in the V85 playtest (seed 3, "Tony Marino", 35 days). The saved state in `playtest/state.json` at day 35 shows why, and the constants explain it:

- **The player's binding gate is earnings.** He had passed up `lifetimeKick = $310` of the $15,000 needed (2%). His weekly hand-overs were $0, $186, $124, $0, $0. The other goals were close or done: 14 of 20 deeds, six made men trusting him >= 0.4, a backer, so the sponsor goal was met. With a 20% kick rate (`BASE_RATE.associate`), passing $15,000 by paying only what is due means declaring about $75,000. At the playtest's average (about $62 a week) that is roughly 240 weeks; even at the best week ($186) it is about 80. The relationship gates do not pace anything, because trust saturates quickly (his capo's trust was 0.99, one of the known limitations).
- **The player's threshold is ten times the NPC one.** `path.NEED.soldier.kick` is 15,000 while `career.KICK_NEEDED.soldier` is 1,500 (capo 25,000 against 6,000; underboss 50,000 against 14,000). This looks like an unreconciled change of scale rather than a deliberate gap.
- **NPC families start full.** The generator gives each capo 2-3 soldiers, so the three-capo families start at or above the soldier cap of 6. At day 35: Corrente 7/6, Marchetti 8/6, Falco 9/6, Brancato 6/6, Santangelo 6/6. Capos were 3/3 in the big three. Brancato and Santangelo (two capos each) had a capo vacancy, but no NPC soldier had reached even 30% of the $6,000 kick-up.
- **Seats open slowly.** With no vacancy, `noticeTick` needs an NPC who is already eligible (the closest, Mickey Galante, was at $1,081 of $1,500, score 0.63) to be seen in 12 consecutive weekly checks before it rolls 45-85% to open a seat. The engine's own random seat growth is 0.4% per family per week plus up to 2% with tension ([engine.ts:162-171](../../src/engine.ts)). Even with a vacancy, `careerTick` promotes on a 50% roll and then waits 10 days. `fam.watch` was empty on every family at day 35.
- **The seat request path is dead.** `consequences.seatDecision` (a boss deciding on a request for another seat) handles a `pending` of kind `seat`, but nothing in `src/` creates one.

In short: once the road is done the player's seat is guaranteed, so the road itself is the pacing, and its money term dominates by more than an order of magnitude. NPC promotions are held back by full seat caps from day 0 and a 12-week noticing period.

---

## How this group connects to the rest

- `core.handleDeath` → `orgs.succeed` → `rank.applyRank` → `rank.repairHierarchy`: every death of a boss (including coups from `politics.ts` and `path.chairAct`) runs the scored succession.
- `career.promote` / `rank.applyRank` → `core.addFact(kind: 'promotion', broadcast: members)` → NPC knowledge: men learn about promotions they would plausibly hear of, and `retain.ts` keeps `promotion` facts permanently.
- `career.promote` → `situ.promotedOver`: a passed-over ambitious rival becomes a grudge situation.
- `books.handOver` / `books.settleWeek` → `Character.lifetimeKick` → `career.readiness` and `path.pathInfo`: earnings are what drives the career for both NPCs and the player.
- `jobs.ts` completed jobs → `path.pathTick` deeds and kills; `path.familyHit` / `promoTick` / `chairCeremony` → `jobs.mkJob` (hits and summons) → `meetings.openInduction` → `career.inductPlayer`.
- `flows.ts` / `dialogue.ts` / `orders.ts` / `politics.resolveCoup` write `p.backer` → `career.sponsorOf`. `dialogue.ts` and `flows.ts` read `career.readiness` so conversations report the same blockers as the standing screen.
- `orgs.hostility` → `pulse.ts` (chance of trouble between members of two families); `actions.ts` → `orgs.noteGrievance`; `meetings.ts` sit-down settlements and the `peace` power → `orgs.noteDeal`.
- `orgs.treasuryWeek` takes dues from members' cash and pays jailed members, so arrests (`engine.ts` weekly heat, `politics.indict`) cost the fund; a short fund lowers trust in the leader, which feeds `orgs.discontent`, defection and splinters. `goals.ts` reads total treasury.
- `Family.unrest` (set by `leaderChanged`) → `politics.politicsCoup` chance, `orgs.churnWeek` splinters, `orgs.standingWeek`.
- `Family.levy` (path `levy`, powers2 `emergency`, also `books.ts`) → `books.ts` kick-up rate and `core.concealedGap`; `Family.directive` → `hustle.ts` earnings; `path.life.hq` → `hustle.ts` crew bonus.
- `politics.sanctioned` → `actions.ts`, `revenge.ts`, `violence.ts`: whether violence against a made man is allowed.
- `engine.ts` weekly also writes `Family.capBonus` directly (random seat growth), and `consequences.ts` would write `capBonus`/`seatNo` if a seat request ever existed.
- `encounters.ts` routes `promo`, `suspect` and `side` encounters to `career.promoChoose` and `politics.politicsChoose`; `crewlife.ts` routes agenda and shake encounters to `powers2.agendaChoose`.

---

## Replacing this system

**Exported surface other modules actually use** (tests aside):
- `orgs`: `succeed` (core), `chooseLeader`, `logOrg` (rank), `candidates`, `leaderChanged`, `noteDeal` (path), `noteDeal` (meetings, powers2), `noteGrievance` (actions), `hostility` (pulse), `orgRecord`, `treasuryMove` (powers2, ui), `orgWeek` (engine), `ensureOrgs` (world), `orgIssues` (consistency).
- `rank`: `applyRank` (career, path, orgs, orders, core, powers2), `repairHierarchy` (path, career, core, orgs, powers2), `repairAll` (engine), `leaveCrew` (web, situ, goals, pulse), `hierarchyIssues` (consistency), `LADDER`, `WAGE`, `rankIdx`.
- `career`: `readiness` (dialogue, flows, goals, ui), `members` (many), `isRunner`, `seats`, `capOf`, `vacancy`, `eligible`, `sponsorOf`, `promote`, `inductPlayer`, `turnedDown` (meetings), `recommend`/`recommendable` (club, web, ui), `recruit`/`recruitable`, `reward`/`rewardOptions`, `careerTick`, `promoTick` (engine), `promoChoose` (encounters), `standingTable`, `promoSteps`, `careerLines` (ui).
- `path`: `pathInfo` (career, dialogue, ambition, ui), `pathState`, `underlings` (powers2), `pathTick`, `turfWeek` (engine), `trialChoose` (career), `chairOptions`, `chairAct`, `raisable`, `raise`, `setRank`, `RANKS`, `powerOptions`, `usePower` (web, ui).
- `powers2`: `ledgerAdd` (career, path), `ledgerOf` (memory, ui), `historyLines` (dialogue), `agendaChoose` (crewlife), `rankWeek` (engine), `buyLife`, `courtBoss`, `propose`, `setBoss`, `setConsigliere`, `setHeir` (web), `commOf`, `lifeOptions`, `proposals`, `supportOf`, `supportWord` (ui), `powerOptions`, `usePower2` (path).
- `politics`: `isMade`, `sanctioned` (actions, revenge, violence, ui), `askPermission` (revenge, web), `politicsWeek`, `politicsCoup`, `commissionTick` (engine), `politicsChoose` (encounters).

**World fields it must keep** (read directly elsewhere): `Character.rank`, `bossId`, `familyId`, `sponsor`, `backer`, `prospect`, `informant`, `lifetimeKick`, `standing`, `wage`; every `Family` field listed under orgs.ts and career.ts (`bossId`, `districts`, `tension`, `levy`, `directive`, `heir`, `consigliere`, `acting`, `treasury`/`tin`/`tout`, `rel`, `unrest`, `capBonus`, `seatNo`, `watch`, `lastPromo`, `booksClosed`, `standing`); `w.path` (read by `hustle.ts`, `specs.ts`, `memory.ts`, `ui/pathview.ts`), `w.promo`, `w.coup`, `w.commissionAt`. Old saves must keep loading: all of these are optional today, and `ensureOrgs` plus the schema-2/4 migrations fill them.

**Ticks it must answer.** Daily: `promoTick` then `pathTick`, `politicsCoup`, `commissionTick`. Weekly inside `weekly()`: `turfWeek`, `orgWeek`, `rankWeek` (in that order, after the businesses and debts), `careerTick` (after `settleWeek`). Weekly after `weekly()` and `sweep()`: `repairAll`, then `politicsWeek`. On death: `succeed` from `core.handleDeath`. On load and world creation: `ensureOrgs`.

**What makes it hard.**
- **Import cycles.** `core` ↔ `orgs` ↔ `rank` (core needs `succeed`/`applyRank`; both import core; orgs and rank import each other); `career` ↔ `path` (career imports path at the bottom of the file); `path` ↔ `powers2`; `career` ↔ `powers2`; `career` ↔ `encounters`; `politics` ↔ `actions` (through an unused import); `politics` ↔ `encounters`. They work only because every cross-module use happens at call time. A module-level constant that reads an import from inside a cycle would hit the temporal dead zone at load.
- **Shared mutable fields with many writers.** `c.bossId` is written by orgs, rank, career, path, `powers2.setBoss`, and through `leaveCrew` by web, situ, goals and pulse. `c.backer` by flows, dialogue, orders, encounters, crewlife, goals, situ and politics. `fam.capBonus` by career, path, powers2, consequences and engine. `fam.tension` by orgs, path, powers2, politics, actions and others. `fam.levy` by path, powers2 and books. A replacement cannot own these exclusively without changing those callers.
- **The rank door is enforced only by a grep test** for `.rank = `. Other invariants (one underboss, seat caps) are not enforced anywhere, and `setRank` and `openSeat` ignore the caps.
- **Two halves of one feature in two files.** Powers are listed in `powers2.powerOptions` and handled partly in `powers2.usePower2` and partly in `path.usePower`, with their cooldown keys derived separately (hence the `crewscore` bug). The player's career is split across `path.ts` (goals, trial, seat, case creation), `career.ts` (case progression, decision, `promote`) and `meetings.ts` (ceremony).
- **Character cash is not conserved by this group**: many powers and outcomes create or destroy money (listed under each module). Only treasuries (`treasuryCheck`) and business cash (`econ.ledgerCheck`) are audited, so a replacement that conserved money strictly would change balance.
- **Knowledge discipline is uneven**: most facts here are broadcast to family members with the actor visible; a replacement must decide deliberately which of them should be hidden-actor facts (the chair coup and `lean` are the obvious candidates).
- **Determinism**: all randomness goes through `w.rng` (no `Math.random` or `Date` in these files), but three places shuffle with an rng comparator (`path` `ear`, `powers2` `court`, `politics.indict`). Their rng draw count depends on the engine's sort implementation, so a replacement that changes those sorts will change the history of a seed.
