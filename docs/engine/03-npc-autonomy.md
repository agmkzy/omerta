# NPC autonomy, consequences and situations

In game terms, this group is what makes the city act without the player: men lend, collect, lean on shops, gamble, make friends and hold grudges; a beating becomes a quarrel between families, a quarrel becomes a planned reply, a killing brings the police weeks later; men pursue multi-week plans (buy a business, get backed for promotion, break away from a boss); and "situations" (a gap in a man's numbers, a shop behind on its envelope, a debt nobody is paying, a man passed over) develop on their own, end in sit-downs chaired by NPCs, and only sometimes reach the player. In code terms, it is the per-NPC utility AI that answers every `think` event ([actions.ts](../../src/actions.ts)), the weekly NPC goal planner ([goals.ts](../../src/goals.ts)), the delayed-consequence queue `w.pending` ([consequences.ts](../../src/consequences.ts)), the inter-family `w.disputes` records ([disputes.ts](../../src/disputes.ts)), the player-facing violence, revenge and threat ladders ([violence.ts](../../src/violence.ts), [revenge.ts](../../src/revenge.ts), [danger.ts](../../src/danger.ts)), the crew's private wants and Sunday news ([crewlife.ts](../../src/crewlife.ts)), the player's milestone ladder ([ambition.ts](../../src/ambition.ts)), and two generations of the shared `w.situations` record ([situations.ts](../../src/situations.ts) for the pre-V75 "money/ambition" kinds, [situ.ts](../../src/situ.ts) and [sitmoves.ts](../../src/sitmoves.ts) for the V75 framework). Everything here is plain data on `World`, all randomness goes through `w.rng`, and every significant event is recorded as a `Fact` through `core.addFact`, so who knows what is decided by witnesses and gossip rather than by the simulation's truth.

> **Tracked bugs:** the "Known issues" notes below were checked against the source, and the confirmed ones are filed as GitHub issues: [`area: npc-ai`](https://github.com/agmkzy/omerta/issues?q=is%3Aissue+milestone%3A%22V85+baseline+review%22+label%3A%22area%3A+npc-ai%22).

## Modules

| file | lines | responsibility |
|---|---|---|
| [actions.ts](../../src/actions.ts) | 453 | Utility AI: generates and scores candidate actions, picks one for an NPC, and executes any action (NPC or player) with its facts, money and cooldowns. |
| [goals.ts](../../src/goals.ts) | 786 | V74 NPC goals (`w.agency`): weekly multi-step plans for wealth, a business, a recruit, advancement, clearing a debt, independence. |
| [ambition.ts](../../src/ambition.ts) | 166 | The player's rank-band milestones (`w.goals.done`) and his single chosen ambition (`Character.ambition`). Player only. |
| [crewlife.ts](../../src/crewlife.ts) | 273 | Crew wants (`Character.want`), crew friendships and fallings-out, Sunday tells, favour requests, the dispatcher for all `kind: 'crew'` encounters, the player's reputation summary. |
| [revenge.ts](../../src/revenge.ts) | 196 | The player's "settle a score" menu and its execution (beat, smash, rob, torch, kill by method, shame, undercut, go to a superior, ask permission, drop). |
| [consequences.ts](../../src/consequences.ts) | 211 | Processes `w.pending` (delayed consequences), schedules post-killing fallout, and runs the weekly in-family purge. |
| [disputes.ts](../../src/disputes.ts) | 327 | Cross-family quarrels (`w.disputes`): detection from facts, NPC escalation and planned replies, settlements with terms, the player's sit-downs and amends. |
| [violence.ts](../../src/violence.ts) | 170 | What violence by the player costs: warnings, aftermath (standing, relationships, hunts), family hunts, kill methods. |
| [danger.ts](../../src/danger.ts) | 224 | The threat ladder against the player (`w.threats`): rumour, warning, watched, attempt, and only then a lethal attempt; the player's responses. |
| [situations.ts](../../src/situations.ts) | 147 | Pre-V75 situations of kind `money` and `ambition` near the player: emerge weekly, NPC tries alone, then asks the player. |
| [situ.ts](../../src/situ.ts) | 913 | V75 situation framework: one shared record with parties, phase, knowledge, claims and history; kinds skim, intel, tribute, debt, partner, grudge, plus mirrors of disputes and grievances; NPC-chaired sit-downs. |
| [sitmoves.ts](../../src/sitmoves.ts) | 215 | The player's side of V75 situations: what he can see, the moves open to him, and how word of them reaches him (club talk, friends). |

## How an NPC decides

This walks through one `think` event from the queue to the next one. Line numbers are from the current source.

**1. The event exists.** Every non-player character gets one `think` event at world creation ([world.ts:280](../../src/world.ts)), and [world.ts:325](../../src/world.ts) (`addShops`) schedules one for owners added later. Characters created after that by `spawnCivilian` (relations in `life.ts`, managers in `econ.ts:271`) are never scheduled and so never act on their own. `core.schedule` ([core.ts:53](../../src/core.ts)) inserts into `w.queue` by `(t, seq)`, so ties are broken by insertion order and the run is deterministic.

**2. The loop pops it.** `advance` ([engine.ts:40](../../src/engine.ts)) shifts the earliest event, sets `w.now = ev.t`, and for `kind: 'think'` calls `think(w, ev.who)` ([engine.ts:78](../../src/engine.ts)).

**3. Guards.** `think` returns without rescheduling if the character is missing, dead or the player, so a dead man's chain ends for good. A jailed man is rescheduled at `jailedUntil + rng.int(10, 120)` minutes. A man who is asleep (`core.isAwake`: non-civilians are created with wake 10, sleep 26, i.e. 10:00 to 02:00; civilians 07:00 to 22:00, [world.ts:111](../../src/world.ts)) is rescheduled at `nextWake + rng.int(0, 90)`.

**4. Which kinds of action are allowed.** `chooseAction` ([actions.ts:143](../../src/actions.ts)):
- if `c.hurtUntil > now`: only `work`;
- else if `c.cooldown.restraint > now` (set after any violent act): `work, socialise, lend, collect, gamble`;
- otherwise also `shakedown` and `retaliate`.

**5. Generate and score.** `generate(w, c, kind)` ([actions.ts:38](../../src/actions.ts)) returns every candidate of each allowed kind with a score. `T` is `c.traits`, `crime = c.heat * 0.3`, and "made" in this function means any non-civilian.

| kind | eligible when | score |
|---|---|---|
| work | always (one candidate) | `(made ? 0.24 : 0.5) + (owns a business ? 0.1 : 0) + heat * 0.4` |
| socialise | each alive, unjailed man he has a `rels` entry with or who is in his district | `0.1 + sociability*0.35 + affection*0.1 + (same district ? 0.08 : -0.04) + (his boss and unseen > 4 days ? 0.3 : 0) - (seen < 1 day ? 0.35 : 0)` |
| lend | non-civilian, not boss, cash >= 700; target is a civilian business owner with no active debt and no `lend:<id>` cooldown; $500, or $1,000 only if he knows the place is struggling | `greed*0.5 + (known struggling in last 14 days ? 0.35 : 0) + (till < 250 ? 0.08 : 0) - caution*0.15 + (cash > 2500 ? 0.1 : 0) - ($1,000 ? 0.05 : 0) - crime` |
| collect | each active debt he is owed with `missed >= 1`, debtor alive and free, no `collect:<debtId>` cooldown | `0.8 + violence*0.15 + missed*0.05 - crime*0.3` |
| shakedown | associate or soldier in a family; open non-casino shop not protected by his family, no `shake:<bizId>` cooldown, nobody leaned on it in the last 7 days (`b.lastApproach`) | `greed*0.45 + ambition*0.3 + (family district ? 0.15 : -0.1) - caution*(protected ? 0.6 : 0.25) - (protected ? 0.15 : 0) + (his district ? 0.05 : 0) + income/10000 - crime` |
| gamble | each open casino he doesn't own | `vice*0.65 - (civilian ? 0.1 : 0) - (cash < 120 ? (vice > 0.75 ? 0 : 0.7) : 0) + (same district ? 0.08 : -0.08) - crime*0.5` |
| retaliate | non-civilian, not hurt; target has `grudge >= 0.45`, is not in his family, is free; the player additionally needs `politics.sanctioned` | base `grudge*0.7 + violence*0.35 - caution*0.45 + ambition*0.05 - (target boss/underboss ? 0.4 : 0) - crime - 0.08`. `beat` = base (target not hurt, no `ret:beat:<id>`); `torch` = base - 0.05 (target owns a business, no `ret:torch:<id>`); `hit` = base - 0.15 + ambition*0.15 (grudge >= 0.9, target not a civilian, NPC needs violence >= 0.7 and not an associate, no `ret:hit:<id>`) |

**6. Pick.** Each candidate's score gets `w.rng.next() * 0.12` added (in place) and the highest wins; `work` always exists, so there is always a choice. Example: a soldier with greed 0.7, ambition 0.5, caution 0.3, heat 0, next to an unprotected $600-a-week shop in his family's district and his own: shakedown scores `0.315 + 0.15 + 0.15 - 0.075 + 0.05 + 0.06 = 0.65`; work scores 0.24; socialising with a friend (sociability 0.5, affection 0.3, same district) scores `0.1 + 0.175 + 0.03 + 0.08 = 0.385`. He goes to lean on the shop.

**7. Perform.** `perform(w, a)` ([actions.ts:204](../../src/actions.ts)) is the same function the player's menu, jobs and orders use. Most kinds first call `go(t)`, which sets `c.district` to the target's district and costs `core.travelTime` (10 minutes same district, 35 otherwise). Continuing the example: the cooldown `shake:<bizId>` is set for 14 days and `b.lastApproach = now`; success chance is `clamp(0.35 + violence*0.35 + (soldier ? 0.1 : 0) - ownerCourage*0.45 - (already protected ? 0.3 : 0), 0.05, 0.95)`. On success `econ.setCollector` sets a fee of 8% of weekly income (rounded to $5), the owner's grudge rises by 0.1, and a `protection_started` fact (or a `poach` fact plus `b.informPrev` and `tension(..., 2)` if he took it from another collector) is added with up to two random witnesses from `core.witnessesAt`. On refusal a `protection_refused` fact is added; a man with violence > 0.5 then smashes the place (`b.damaged = 2`, `bizMove -150 'damage'`, heat +0.1, a `vandalism` fact passed to the protector by `notifyProtector`, and `restraint` for 10 days).

Every fact goes through `core.addFact` ([core.ts:191](../../src/core.ts)): the actor, the victim (unless `victimKnows: false`) and the witnesses `learn` it; `learn` ([core.ts:142](../../src/core.ts)) raises the victim's grudge toward a known actor by a per-kind amount (beating and vandalism 0.5, murder 0.8, robbery and poach 0.4) and people close to the victim by 30% of that; victims of hidden-actor facts `suspect` someone, possibly wrongly; 30% of hidden-actor facts also schedule a `reveal` in `w.pending` 14 to 56 days later.

**8. Retaliation is an intention first.** An NPC's `retaliate` does not act. `perform` pushes a `Pending` of kind `intent` (one per attacker-target pair) due in 1 to 4 days, sets `ret:<mode>:<target>` for 6 days, and returns 20 minutes ([actions.ts:398](../../src/actions.ts)). The daily `pendingTick` ([consequences.ts:36](../../src/consequences.ts)) hands it to `disputes.intentDue` ([disputes.ts:141](../../src/disputes.ts)), which drops it if either man is dead, the attacker is jailed or hurt, his boss has caution > 0.55 and says no (40%), or his grudge has fallen below 0.15 or he thinks better of it (18%). Otherwise it calls `perform` again with `approved: true`. The approved act sets a long cooldown (`beat` 25, `torch` 35, `hit` 60 days) and `restraint` (28, 45, 70 days), then: beat (victim hurt 3 days, heat +0.15, `beating` fact, `tension +1`), torch (`b.damaged = 3`, `bizMove -200`, hidden-actor `vandalism` fact, protector notified, `tension +1`), or hit (25% his nerve goes; otherwise heat +0.6, `core.handleDeath`, hidden-actor `murder` fact broadcast to the victim's family and friends, `consequences.afterKilling`, `tension +3`). If the target of an approved `hit` is the player, it becomes `danger.menace` instead (one step up the threat ladder) and nobody dies.

**9. Reschedule.** `think` schedules the next event at `now + r.minutes + rng.int(15, 90)`. Typical costs: work 240 minutes, socialise travel + 80 to 150, lend or collect travel + 45, shakedown travel + 40, gamble travel + 120 to 240, NPC retaliate 20.

**10. What reads the result later.** Facts are scanned daily by `disputes.disputeScan` (a cross-family beating, vandalism, robbery or poach opens a `Dispute`), spread by `share` the next time the people who know them socialise (subject to `retain.gossipCap`), and read by dialogue. Grudges feed later `retaliate` scores, `danger.dangerTick` (grudge toward the player of 0.7 or more starts a threat), `consequences.purge` and the V75 sit-down utilities. Debts created by `lend` are paid or missed in `engine.weekly`, and two missed payments can start a V75 `debt` situation. `struggling` entries written by `confide` raise later `lend` scores. Weekly, `goals.agencyWeek` steps each NPC's longer plans, which move money and businesses through the same econ and core functions.

## Situations lifecycle

`World.situations` is one array shared by three writers: [situations.ts](../../src/situations.ts) (kinds `money`, `ambition`, no `key`), `pulse.ts` (kinds `turf`, `org`, no `key`) and [situ.ts](../../src/situ.ts) (everything with a `key`). The `Situation` interface ([types.ts:453](../../src/types.ts)) keeps the pre-V75 fields (`who`, `biz`, `since`, `weeks`, `stage`, `cause`, `knows`, `told`, `helped`, `asked`, `resolvedAt`, `how`) and adds the V75 "shared record" as optional fields.

**Stage and phase.** `stage` is the cross-kind lifecycle: `brewing` (it exists, nobody has acted), `handling` (the people in it are dealing with it), `asking` (a question is with the player and the situation is waiting on him), `resolved`. `phase` is the kind's own state machine (`noticed → explain → doubt → inquiry → confront` for skim; `late → time/press → appeal` for tribute; `missed → pressed` for debt; `complaint → response → backing` for partner; `sulk → airing` for grudge; `found → squeeze/sitting` for intel; `asked` while waiting on the player; `closed` at the end). The helper `phase(s, ph, days, w)` ([situ.ts:88](../../src/situ.ts)) sets the phase and the clock `next = now + days` and promotes `brewing` to `handling`. Most V75 spawners set `stage = 'handling'` immediately.

**Spawning.** `spawn(w, kind, key, who, init)` ([situ.ts:37](../../src/situ.ts)) refuses when:
- `SIT.on` is false;
- an open situation with the same `key` exists (one open matter per key, e.g. `skim:<boss>:<man>`, `tribute:<biz>`, `debt:<debtId>`, `partner:<biz>:<holder>`, `grudge:<rival>:<winner>`, `intel:<witness>:<man>`, `dispute:<disputeId>`, `crew:<grievanceId>`);
- for non-mirror kinds, `w.sitcool[key]` is in the future (a closed matter is not reopened for `coolWeeks`), or 30 non-mirror situations are already open (`SIT.cap.open`);
- for major ones (`sev >= 0.5`), `allowMajor` ([situ.ts:29](../../src/situ.ts)) says no: five open majors already, or a major started less than 3 days ago (`sitpace.lastMajor`), or the player is a party and something reached him less than 7 days ago (`sitpace.lastVisible`).

Sources: `skimNoticed` (called by `books.ts` when a boss notices a subordinate's shortfall), `promotedOver` (called by `career.ts` when a man is made), the weekly scans `tributeScan` (protection at least 2 weeks late with money owed, 50%), `debtScan` (an NPC debt with 2 or more missed payments, 40%), `partnerScan` (a stake of 15% or more, at least 4 weeks old, in a weak business or held by a sour partner, 20%), `skimStep` spawning `intel` when a greedy witness keeps what he saw, `sitmoves.negotiateDebt` (the player asks for terms), and `syncLinks` mirrors of open disputes and grievances. Each situation gets `hist: [], k: {}, claims: [], cons: []` and a `truth` the simulation knows (`guilty`/`innocent`, `delayed`/`unable`, `willful`/`unable`, `weak`/`dodging`).

**The clock.** `sitDay` ([situ.ts:843](../../src/situ.ts)) runs daily: it syncs the mirrors, expires an unanswered player question (`stage === 'asking'` past `next`: the encounter is set `lapsed` and the player's superior, or the senior NPC party, chairs it instead), and for every open situation whose `next` has passed calls the kind's step function from `STEP` ([situ.ts:841](../../src/situ.ts)). Kinds with no step and no external owner are closed as `unknown`; `money`, `ambition`, `turf`, `org`, `dispute` and `crew` are left to their owners. `sitWeek` ([situ.ts:863](../../src/situ.ts)) increments `weeks` on every open situation, syncs, runs `leak`, `crewWord` and the three scans, and closes as `faded` any stepped situation older than 20 weeks.

**Knowledge (`k`) and facts.** What anyone knows comes from facts. `tell(w, s, text, o)` ([situ.ts:66](../../src/situ.ts)) adds a fact tagged `story: 'sit:<id>'` with the given witnesses or broadcast list, records the line in `hist` (cap 8), and for everyone named in it (witnesses, broadcast list, actor, victim) who actually learned the fact calls `know(w, s, id, 2, 'witness')`. `s.k` is an index on the situation, `Record<Id, { l: 1 | 2; via; t }>`, where 1 means suspects and 2 means knows; `know` only ever raises the level. It is written by the spawners (for example the boss at level 1 "numbers", the accused at 2 "self"), by `tell`, by `leak` (the hearer at 1), by `crewWord` and `sitmoves` (the player at 1), and by sit-downs (participants at 2). It is read by `leak` (only men at level 2, more than 2 days after they learned, pass on the newest `sit:` fact they personally know), by `sitmoves.doMove('inquire')` (who can be asked) and by `crewWord` (skip if the player is already in it). What the player sees is decided by facts, not by `k`: `sitmoves.visibleTo` is "a party, or knows at least one `sit:` fact". If the player learns a fact through `tell`, `leak`, `crewWord`, `friendsTell` or `clubTalk`, `s.knows` is set and `sitpace.weekVis` / `lastVisible` are bumped.

**Claims and truth.** `claim(w, s, by, text, honest)` ([situ.ts:75](../../src/situ.ts)) records what someone said (cap 3); `honest` is the simulation's own judgement and is never shown. `truth` drives NPC choices inside the step functions and kit utilities (a guilty man lies more often; a willful debtor's creditor wants enforcement), but it is not shown to the player.

**Sit-downs.** Each kind with a `Kit` (skim, tribute, debt, partner, grudge) has options, a utility `util(w, s, id, code)` in -1..1 for each attendee, and `apply`. `stanceOf` gives each attendee's preferred option and flexibility `clamp(0.18 + (1-ambition)*0.14 + caution*0.1 + (1-violence)*0.06, 0.1, 0.5)`. `chairPick` ([situ.ts:131](../../src/situ.ts)) scores every option as the chair's own utility (times 3 if he is a party) plus each attendee's weighted utility minus a penalty when it falls more than his flex below his preference, plus a violence bias toward punish/enforce and `rng.range(-0.05, 0.05)`. Weight is `0.7 + books.influence/100 + s.m['sup:<id>']`, reduced for an accused skimmer as certainty (`s.m.cert`) grows. `hold` ([situ.ts:148](../../src/situ.ts)) applies the option, splits attendees into accepted and opposed, adjusts their trust, respect and grudges, records `s.meet`, and tells a `sitdown` fact to everyone present. `convene` ([situ.ts:178](../../src/situ.ts)) decides who chairs: if it is the player he gets one encounter (`data.what: 'sit75'`, 8 days, at most one open and one per 10 days via `p.cooldown.sit75`) and the situation goes to `asking`; otherwise the NPC chair settles it at once.

**Closing.** `closeSit(w, s, out, cons, coolWeeks)` ([situ.ts:80](../../src/situ.ts)) sets `stage: 'resolved'`, `resolvedAt`, `how: 'alone'` (always), `out` (the outcome code), `phase: 'closed'`, appends to `cons` (cap 5), deletes `ask` and `next`, and sets `w.sitcool[key] = now + coolWeeks`. A closed mirror whose dispute or grievance reopens is reopened in place (`syncLinks`, [situ.ts:751](../../src/situ.ts)) and its cool-off key is deleted.

**Pacing.** `w.sitpace` holds `lastMajor`, `lastVisible`, `weekVis` (things that reached the player this week, reset in `sitWeek`), `sync` (last `syncLinks`, used by `sitIssues`), `weeks`, `quiet` (weeks with nothing visible), `busy` (weeks with 3 or more), `stats` (counters such as `start.<kind>`, `out.<kind>.<out>`, `sitdown`, `leak`, `word`, `club`, `friend`) and `wk` (initialised to 0, never used). The gates that use it: `allowMajor` (3 days between majors; 7 days since the player last saw something before a new major involving him), `crewWord` (only if nothing reached the player for 7 days, and at most one per week), `friendsTell` (at most one a week), `whisper` (the same matter is not passed on again within 5 days, `s.m.tp`), `clubTalk` (at most 2 per visit).

**Bounds.** `spawn` keeps at most 60 closed situations (oldest closed dropped first). Per record: `hist` 8, `claims` 3, `cons` 5. `s.m` holds kind-specific scratch (`cert`, `rounds`, `allies`, `paid`, `skim`, `passed`, `vouched`, `chk`, `tp`, `sup:<id>`, `inq:<id>`, `vouch:<id>`). `w.sitcool` is never pruned. See the `situations.ts` section for a cap there that also drops open V75 situations.

**The older kinds.** `money` and `ambition` situations (`situations.ts`) use only `stage`, `weeks`, `asked`, `knows`, `told`, `helped`, `how`; they reach the player through a loan request (`encounters.makeLoan`), an `ambition` crew encounter, or conversation (`askAbout`, `helpWith`). `turf` and `org` are run by `pulse.ts` and are skipped here.

## actions.ts

**Purpose.** The utility AI for every non-player character, and the shared executor for the eight basic action kinds (`work, socialise, lend, collect, shakedown, gamble, retaliate, wait`). The player's "what to do" menu calls the same `generate` and `perform`, and jobs, orders and the revenge menu reuse `perform` for collections, shakedowns and violence. It also holds the gossip function `share`, used by every conversation in the game.

**State owned.**
- `Character.cooldown` keys (a generic string-to-timestamp bag): `lend:<charId>` (10 days), `collect:<debtId>` (2 days), `shake:<bizId>` (14 days), `ret:beat|torch|hit:<charId>` (6 days when an NPC forms an intention; 25/35/60 days after the act; 4 days after a menace), `restraint` (10 days after vandalism on refusal, 18 after a harsh collection, 28/45/70 after an approved beat/torch/hit).
- `Business.lastApproach` (any shakedown blocks others on that shop for 7 days), `Business.damaged`, `Business.informPrev` (set on a poach; `engine.weekly` tells the old collector).
- `Character.district` (moved by every travelling action), `heat`, `hurtUntil` (on victims), `weekIncome` and `books.gross.odd` (errands).
- `Rel` trust, affection, respect and `lastMet` both ways on socialise; owner grudge on shakedown.
- `Family.tension` via `tension()`.
- `Fact.heard` (gossip count) on facts shared between NPCs.
- `w.pending` entries of kind `intent`.
- Module cache `aliveCache` (a `WeakMap<World, {t, list}>` of alive characters keyed by `w.now`; not saved).

**Public API.**

| export | returns | description and side effects |
|---|---|---|
| `describe(w: World, x: Character)` | `string` | "Name (owner of X or rank, family, district)" for menus. Pure. |
| `grudgeWord(g: number)` | `string` | `wary` / `resentful` (>= 0.3) / `bitter` (>= 0.55) / `murderous` (>= 0.8). Pure. |
| `generate(w: World, c: Character, kind: Kind)` | `Action[]` | All candidates of one kind with scores and labels (see the table in "How an NPC decides"). Reads only. |
| `chooseAction(w: World, c: Character)` | `Action` | Filters kinds by `hurtUntil` and `restraint`, generates, adds `rng.next()*0.12` to each score (mutating the action), returns the best. Uses rng. |
| `share(w, from, to, lines, opt?: { partial?; avoidActor?; exclude?; say? })` | `Fact[]` | Gossip. Needs `from`'s trust in `to` >= 0.25 or sociability > 0.65. Passes up to 1 fact (to the player) or 2 (to an NPC) that `to` doesn't know: never minor ones, never `from`'s own beating/vandalism/murder/robbery/poach, private kinds (`loan`, `debt_missed`, `debt_paid`) only at trust > 0.5, and for NPC listeners only facts that pass `retain.gossipFresh` and are under `retain.gossipCap`. The player hears his own matters first; non-routine before routine; newest first. Calls `learn` (with the actor's name unless `partial`), increments `Fact.heard` for NPC listeners, and pushes voiced lines (`voicesheet.say`) for the player. |
| `confide(w, c, t, lines)` | `void` | If `t`'s business has a till under $200 or is in distress and `c` hasn't heard in 14 days, with chance `0.3 + trust*0.6`, adds a `business_struggling` fact witnessed by `c` (which `learn` writes into `c.struggling`). Uses rng. |
| `tension(w, a, b, d)` | `void` | Adds `d` to both families' `tension` toward each other (cross-family only). `d >= 3` also calls `orgs.noteGrievance(..., 0.12)`. |
| `perform(w: World, a: Action)` | `{ minutes: number; lines: string[] }` | Executes the action. Mutates the world, adds facts, moves money, sets cooldowns, may push an `intent`, may kill. Uses rng. Lines are written in the second person for the player and discarded for NPCs. |

What `perform` does by kind:

| kind | effects |
|---|---|
| `wait` | `hours * 60` minutes, nothing else. Never generated for NPCs. |
| `work` | heat `-0.01 * hours`; owner: `bizMove +30 'revenue'`; family man: `+rng.int(15, 70)` cash recorded as `books.gross.odd`; 240 minutes. |
| `socialise` | travel; both directions: `lastMet = now`, trust +0.025, affection `+0.025 + 0.03 * other's sociability`, respect +0.01; `share` from actor to target and, unless `a.quiet`, back and `confide`. |
| `lend` | travel; `lend:<id>` for 10 days; acceptance `clamp(0.3 + need + (1-caution)*0.15 + trust*0.2, 0.05, 0.95)` where need is 0.35 for a distressed business; on yes moves cash, `core.createDebt` at 5% a week (payment 12% of principal), `loan` fact linked as `d.cause`. |
| `collect` | travel; `collect:<debtId>` for 2 days; asks `min(balance, weeklyPayment * (missed+1))` from cash plus till above $100; pays in full with chance `clamp(0.5 + pressure - debtorCourage*0.5, 0.15, 0.95)`; otherwise a harsh collector (approach `hard`, or violence > 0.55 or pressure > 0.65 with 3+ missed, 60%) beats him (hurt 3 days, `restraint` 18 days, heat +0.15, `beating` fact) and takes what there is, else he scrapes 60% of what is above $30. |
| `shakedown` | see the example in "How an NPC decides". `approach` (`soft`/`hard`) only comes from jobs and the player. |
| `gamble` | travel + 120 to 240 minutes; stake 40 to 400 (rounded), capped at 40% of cash; a vice > 0.6 man who can't cover it gets a marker from the owner (cash moves, `createDebt` at 10%, `loan` fact); wins 46% (`bizMove -stake`), loses otherwise (`bizMove +stake`, `gambling_loss` fact if stake >= 250, minor under 350). |
| `retaliate` | NPC without `approved`: intention (see step 8 above). Player or approved: executes beat / torch / hit; a `hit` on the player becomes `danger.menace`. |

**Tick hooks.** `think` (engine.ts:83 calls `perform(w, chooseAction(w, c))`). `perform` is also called on player actions (web.ts:202, web.ts:221, cli.ts:203), from `jobs.ts` (530, 549, 601, 621, 1080), `orders.ts:144`, `books.ts:540`, `revenge.settleDo`, and `disputes.intentDue` (passed in from `consequences.pendingTick`).

**Depends on / used by.** Imports `core` (facts, `learn`, `rel`, debts, `handleDeath`, `witnessesAt`, `travelTime`, `ownerBiz`), `econ` (`bizMove`, `setCollector`), `danger` (`menace`), `orgs` (`noteGrievance`), `politics` (`sanctioned`), `consequences` (`afterKilling`), `retain` (`gossipCap`, `gossipFresh`, `tierOf`), `voicesheet` (`say`). Imported by `engine` (`chooseAction`, `perform`), `web` and `cli` (`generate`, `perform`, `describe`, `grudgeWord`), `jobs` (`confide`, `perform`, `share`, `tension`), `orders`, `books`, `consequences` (`perform`), `revenge` (`perform`, `tension`), `danger` and `politics` (`tension`), `dialogue` (`share`, `confide`), `meetings` (`share`), `ui/views_a.ts` and `ui/views_b.ts` (`grudgeWord`), and `tests/v78.test.ts`.

**Invariants and rules.**
- Money: `lend` and gambling markers move cash between the two characters before `createDebt` (which does not move cash; it only posts to the ledger). Casino wins and losses go through `econ.bizMove`. Errand money (+15 to 70) and owner work (+30 business revenue) are inflows from outside; vandalism and torching destroy business cash via `bizMove(..., 'damage')`.
- Knowledge: every event is an `addFact` with explicit witnesses; torching and murder hide the actor; `share` never lets a man boast of his own violence and passes private money matters only to people he trusts.
- An NPC can only hurt someone through an intention that survives 1 to 4 days; an NPC can never kill the player through `perform`.
- Shops are leaned on at most once a week by anyone; each kind of revenge has its own cooldown per target; `restraint` makes violence rarer but heavier.
- Determinism: only `w.rng`; iteration is in `Object.values` insertion order.

**Save compatibility notes.** Owns no `World` field of its own. Cooldown keys are free-form strings in `Character.cooldown` and are never pruned anywhere (a 40-week run of seed 3 had about 710 keys, about 84% expired, roughly 14 KB of JSON). `Action` objects are never saved; `intent` pendings are.

**Known issues / gaps.**
- `perform`'s `retaliate` branch silently turns any non-player actor without `approved: true` into a deferred intention. `orders.ts:144` (a crew member told to "confront") and `jobs.ts:601`/`621` (beat or hit when the assignee is an NPC: `orders.ts:130` calls `jobs.resolve` with the crew member as assignee) pass no `approved`, so an ordered beating or hit is queued, can be abandoned in `intentDue` (no grudge, a cautious boss, or 18% chance), and the caller's immediate check (`t.hurtUntil > w.now`, `!t.alive`) sees nothing. Probably unintended.
- `aliveCache` is keyed by `w.now`, so a man killed earlier in the same minute can still appear in candidate lists; `lend` does not recheck `alive`.
- In `generate`, `made` means any non-civilian, so associates count as "made" for lending and retaliation.
- The shakedown refusal branch has a duplicated nested `if` (lines 346 to 347); harmless.
- The cooldown bag grows without bound (see above), which bears on the save-size question in CLAUDE.md.

## goals.ts

**Purpose.** V74 NPC agency. Once a week each made NPC may adopt up to two goals, and each goal is advanced one step at a time on its own review date over weeks or months: save, scout, approach, negotiate, finance, close; or pay down a debt, get backed, build outside ties. Every step that moves money, a business, a man or a rank goes through the same functions the player's moves use. Promotion is never granted here; an `advance` goal only works on what `career.careerTick` already considers. Three goal steps can put a question to the player.

**State owned.**
- `World.agency: Agency` ([types.ts:682](../../src/types.ts)): `goals: Goal[]`, `ended: GoalEnd[]` (ring of 60), `stats: Record<string, number>` (counters such as `started.<kind>`, `done.<kind>`, `inter.offer`, `refused.offer`, `ask.shown`, `leak`), `cool: Record<Id, number>` (when a man, or `id:kind` after a failure, may form a goal again), `lastAsk`.
- `Goal` records: stage machine fields (`stage`, `next`, `need`, `have`, `progress`, `review`, `deadline`, `tries`, `n`, `offer`, `share`, `mode`, `owner`, `with`, `fin`, `no`, `obstacle`, `ask`, `paused`).
- Written elsewhere through goal steps: `Character.cash` (via a local `give`), `backer`, `kickRate`, `standing` (own and a rival's), `rels`; `bossId` via `rank.leaveCrew`; `Debt.nextDue`, `missed`, `weeklyRate`, and `status = 'void'`; business ownership (`econ.transferBusiness`), stakes (`econ.addStake`), `Business.invest` and cash (`econ.bizMove`); encounters (`encounters.addEnc` with `data.what = 'goal'`); the player's `cooldown.joinAsk`.
- Module state: exported mutable config `AGENCY = { on, audit, caps: { perMan: 2, ended: 60 } }` and a module-level `let spentOut` used only by the audit.

**Public API.**

| export | returns | description and side effects |
|---|---|---|
| `AGENCY` | object | `on` (master switch), `audit` (check money totals per step), `caps`. Mutable; tests change it. |
| `KINDS` | `GoalKind[]` | `wealth, business, recruit, advance, debt, independence`. |
| `agencyOf(w)` | `Agency` | Returns `w.agency`, creating it if missing. |
| `goalsOf(w, id)` | `Goal[]` | A man's active goals. |
| `moneyTotal(w)` | `number` | Sum of all character cash, business cash and family treasuries (for audits and tests). |
| `priceOf(w, b)` | `number` | Asking price: `max(1200, round((max(0, weeklyProfit)*30 + max(0, b.cash)*0.5)/50)*50)`, weekly profit from `econ.trade` when there are at least 2 weeks of accounts, else `income - expense`. Also used by the V75 partner kit. |
| `begin(w, c, kind, motive, priority, o?)` | `Goal` | Creates a goal (`id 'g'+nextId`), review in 1 to 2 weeks, deadline 16 to 40 weeks, merged with `o`. Uses rng. |
| `endGoal(w, g, how, why)` | `void` | Removes it, refunds a backer if not `done`, appends to the `ended` ring, sets `cool` (3 weeks done, 8 failed, 5 dropped; a failure also blocks that kind for 20 weeks). |
| `goalsOnDeath(w, d)` | `void` | Fails all of a dead man's goals. Called by `core.handleDeath`. |
| `agencyWeek(w)` | `void` | The weekly run (see below). |
| `stepGoal(w, g, c)` | `void` | One review of one goal. Exported for tests. |
| `goalChoose(w, p, e, code)` | `string[] \| undefined` | Answers an encounter with `data.what === 'goal'`; `undefined` otherwise. |
| `joinChoose(w, p, e, code)` | `string[] \| undefined` | Answers the "wants to run with you" encounter (unreachable, see issues). |
| `agencyIssues(w)` | `string[]` | Consistency checks: dead or player owners, two goals of one kind, missing targets, financing on a non-business goal, a missing question, cap breaches. Used by `consistency.audit`. |
| `wealthReport(w)` | object | Cash distribution, Gini, ownership spread, debts, stakes. For measurement only. |

The weekly run, `agencyWeek` ([goals.ts:171](../../src/goals.ts)): end the goals of dead men; resolve goal questions the player let lapse (`answered(..., 'lapse')`, treated as a refusal); `consider` each active man (alive, not the player, not a civilian; not cooling down; free; fewer than 2 goals; 40% chance; best kind by `score * rng.range(0.75, 1.25)` above 0.5, a second goal only above 0.7); step every due goal in order of `review` then `id`; prune `cool` entries more than 4 weeks past; maybe `joinAsk`.

Goal kinds:

| kind | wanted when (score) | how it proceeds |
|---|---|---|
| `wealth` | `0.12 + greed*0.5 + (want rich ? 0.3 : 0) + (cash < 400 ? 0.1 : 0)` | Target `max(cash*1.4, cash+600)`. Each review picks invest in his own business (spends up to `min(30% cash, 600)` out of the world and raises `b.invest`), collect a missed debt owed to him (60% of the debtor's cash, grudge up), or lend up to `min(25% cash, 400)` to someone short at 2% (5% if greedy or violent). Done at target; dropped if he loses 60% of what he had. |
| `business` | cash >= 500 and owns fewer than 3: `0.15 + greed*0.4 + ambition*0.25 + want bonus + min(0.2, cash/15000)` | `scout` (best yield, distressed or indebted owners preferred; price cap by temperament; at most 2 other goals on the same place) → `save` (need 45% or 60% of the price, or `share * price`) → `approach` (needs reach: same family, the owner's shop in his streets or under his family's protection, or trust >= 0.15; else a mutual friend lifts both trusts to 0.2) → sounding (the owner's willingness threshold) → `negotiate` (opening at 82% to 95% of price by temperament; counters; a proud man walks) → `finance` (the player if he is a superior in the family with the cash and trust >= 0.3; else an NPC: 50% a loan at 1.5% a week if under $6,000, otherwise a partner whose money is recorded in `g.fin`) → `close` (cash to the owner; `transferBusiness` or `addStake`; a financing partner gets a 10% to 40% stake). |
| `recruit` | soldier or above, crew room (soldier 3, capo 8, underboss 10), cash >= `RECRUIT_COST + 150`, a free prospect | `spot` → `approach` (chance from sociability, rank, standing and the prospect's ambition and caution; a very ambitious prospect wants a soldier's boss to vouch) → `orders.recruitProspect`. |
| `advance` | a next rank that is not boss: `0.1 + ambition*0.65 + want bonus - caution*0.15` | Progress is `career.readiness(...).score`. Options: ask his boss to back him (`c.backer`), a gift to the boss (standing +0.8), undermine a rival of the same rank (rival standing -2, may be seen), or start a recruit goal. Deadline 52 weeks. |
| `debt` | has an active debt | `pay` part of it, ask for `time` (14 days; asks the player if he is the creditor), ask for better `terms` (rate x0.7), `sell` a 15% stake in his business, `lean` on a creditor of equal or lower rank (may void the debt), or `stall`. |
| `independence` | his boss is alive: `0.05 + (want independent ? 0.5 : 0) + ambition*0.15 + (1-trust in boss)*0.15 + (kickRate > 0.15 ? 0.1 : 0)` | `income` (a business, $1,500, or a 15% stake; otherwise he starts a business goal) → `ties` (three contacts outside the family) → `terms` (kick-up rate down 0.03, floor 0.1; after 3 refusals an ambitious man with means may `leaveCrew`, 30%). |

Questions to the player are gated by `askOk` (12 days since the last, no open goal question) and expire after 7 days: backing a purchase (`finance`), more time on a debt owed to the player (`debt`), and `joinAsk` (player soldier or above with crew room, at most every 30 days, 30% chance, an ambitious local prospect).

**Tick hooks.** Weekly `agencyWeek` (engine.ts:209). `goalsOnDeath` from `core.handleDeath`. `goalChoose` / `joinChoose` through `crewlife.crewChoose` (encounters.ts:501).

**Depends on / used by.** Imports `core` (`addFact`, `createDebt`, `payDebt`, `rel`, `ownerBiz`), `econ` (`INVEST_CAP`, `addStake`, `bizMove`, `transferBusiness`, `trade`), `rank` (`LADDER`, `leaveCrew`), `career` (`isRunner`, `members`, `readiness`), `orders` (`RECRUIT_COST`, `recruitProspect`), `encounters` (`addEnc`). Imported by `engine`, `core` (`goalsOnDeath`), `situ` (`begin`, `goalsOf`, `priceOf`), `crewlife` (`goalChoose`, `joinChoose`), `consistency` (`agencyIssues`), and tests `v74.test.ts`, `v76.test.ts`, `agency_measure.ts`.

**Invariants and rules.**
- Money moves only through `give`, `payDebt`, `createDebt`, `addStake`, `transferBusiness`, `bizMove`; the only deliberate outflow is improvement spending (`spentOut`). With `AGENCY.audit` on, every step checks `moneyTotal` and bumps `stats.leak` on a mismatch.
- At most 2 goals per man and one per kind; never for the player or civilians; never grants rank.
- Steps run in a stable order (`review`, then `id`); all chance through `w.rng`.
- A backer's money sits in the buyer's pocket until the deal closes; on failure `refund` returns what the buyer still has, and a shortfall gives the backer grudge +0.25 and trust -0.2.

**Save compatibility notes.** `w.agency` is optional (schema 5, V74): `ensureShape` ([world.ts:308](../../src/world.ts)) and `agencyOf` both create it, so older saves start with no goals. `ended` is a ring of 60; `cool` entries are pruned 4 weeks after expiry; all `Goal` extras are optional.

**Known issues / gaps.**
- `joinChoose` is unreachable. `joinAsk` creates its encounter with `data: { what: 'goal', t: 'join', g: '' }`; `crewlife.crewChoose` calls `goalChoose` first, which matches `what === 'goal'`, finds no goal with id `''`, marks the encounter done and returns "It has gone quiet." Confirmed with a scratch script: answering "yes" leaves the prospect a civilian.
- The debt step `lean` sets `d.status = 'void'` directly rather than going through `core.onDebtCleared`, so open collection jobs, memos and encounters tied to that debt are not released (the daily `reconcile` may catch some).
- `advance` stores a `Rank` in `Goal.target`, which is typed `Id`.
- A lapsed goal question is penalised twice: `answered(..., 'lapse')` here and `crewlife.lapsedAsks` (trust -0.07, respect -0.06, `rep.broken++`). The comment ("a refusal for everyone but the man's pride") suggests the stacking is deliberate. Lapsed sit-down asks are penalised only once.
- Most goal activity never reaches the player except through the three questions above (one of which is broken), which matches the CLAUDE.md note that goals rarely drive visible behaviour. Note that CLAUDE.md says `w.goals`: `w.goals` is the player's milestone record (ambition.ts); NPC goals are `w.agency`.
- A 40-week run of seed 3 started 185 business goals and completed 28; 59 advance goals, 11 completed.

## ambition.ts

**Purpose.** Two player-only systems sharing their measures. Milestones (`AMBITIONS`): a fixed ladder of goals for each rank band (associate, made, capo, top); meeting one in the current band pays its reward once, and anything from an earlier band is marked quietly. The current ambition (`AMBS`): the one thing the player chose to pursue (rise, crew, a betting operation, three shops, $10,000, respect), with a progress meter and a next-step hint for the UI.

**State owned.** `World.goals = { done: Record<string, number> }` (milestone key to the minute it was met). `Character.ambition.done` on the player (the record itself is created by the UI, web.ts:826). The player's `cash` and `standing` on rewards.

**Public API.**

| export | returns | description |
|---|---|---|
| `Band`, `Ambition`, `Prog`, `AmbKind`, `AmbDef`, `AmbProgress` | types | Milestone definition (`key, band, title, why, how, head?, measure, reward`), progress row, ambition kinds and progress. |
| `bandOf(r: Rank)` | `Band` | civilian and associate → associate, soldier → made, capo → capo, otherwise top. |
| `AMBITIONS` | `Ambition[]` | 21 milestones; one per band is the `head` (get made, capo, underboss, the chair). |
| `progress(w, p)` | `Prog[]` | Every milestone of the current band plus any already done. |
| `active(w, p)` | `{ head?: Prog; list: Prog[] }` | The band's headline plus the three closest unfinished milestones. |
| `ambitionTick(w)` | `void` | Checks the current ambition and every unmet milestone; awards cash and standing and adds a minor `report` fact witnessed by the player. |
| `ambitionInit(w)` | `void` | At world creation, marks current-band milestones already met as done without reward. |
| `AMBS` | `AmbDef[]` | The six choosable ambitions. |
| `ambProgress(w, p, kind)` | `AmbProgress` | Fraction, note and a next step with a UI action code (`tab:crew`, `recruit:`, `way:bookie`, ...). |

**Tick hooks.** Daily `ambitionTick` (engine.ts:68). `ambitionInit` from `world.createWorld`. `progress`/`bandOf` from `ui/views_c.ts`, `AMBS`/`ambProgress` from `ui/ambview.ts`, `AMBITIONS` from `stress.ts`.

**Depends on / used by.** Imports `core` (`addFact`, `clamp`, `money`, `rel`), `encounters` (`owedTo`), `path` (`pathInfo`, for the "rise" ambition), `orders` (`prospects`). Used by `engine`, `world`, `stress`, `ui/ambview.ts`, `ui/views_c.ts`, `tests/v72.test.ts`.

**Invariants and rules.** Each milestone pays at most once (`w.goals.done[key]` is set before rewards). A "made" ambition is complete when the player's rank differs from the rank he had when he chose it (`rank0`).

**Save compatibility notes.** `w.goals` is ensured by `ensureShape`; `ambitionTick` also creates it. `Character.ambition` is optional.

**Known issues / gaps.**
- Milestone cash rewards (`p.cash += reward.cash`) are created from nothing and are not recorded in the books or the ledger.
- The header says NPC wants live in `people.ts`/`pulse.ts`; `Character.want` is mainly initialised in `crewlife.crewTick`, and NPC goals are in `goals.ts`.
- The exported name `active` is generic and easy to confuse with unrelated helpers of the same name.

## crewlife.ts

**Purpose.** The crew as people. Weekly, it gives every made NPC a private want, occasionally a nickname, and generates one friendship, falling-out, private loan or side arrangement between two of the player's men; what each man wants shapes small behaviours (asking for dangerous work, resenting a favourite, proposing a betting book, drifting toward the player's boss). It builds the two Sunday tells, makes crew favour requests, and answers every `kind: 'crew'` encounter, first trying the dispatchers of other systems. It also computes the player's reputation lines from his record.

**State owned.**
- `Character.want` (set for every non-civilian NPC if missing; a made man's `made` want becomes `independent` or `respect`). Other writers: `pulse.ts`, `path.ts`, `powers2.ts`, `situ.ts` (skim punish), `dialogue.ts`.
- `Character.nick`, the player's `Character.insight` (`learnAbout` tags: `want`, `tie:<id>`, `rival:<id>`, `loan:<id>`, `leaving`), the player's `Character.rep` (`kept, broken, asked, ignored, favoured`).
- `World.sunday` (replaced each week; at most 2 tells).
- `Character.books.side` (+60 a week for each partner in an "arrangement"; `put/6` when the player funds a book).
- Cooldown keys: player `crewTie` (18 days), `favReq` (12 days); NPC `pair:<id>` (70 days), `friction` (14 days); `restless`, which is a counter (incremented and decremented weekly), not a timestamp.
- Traits nudged: courage +0.01 (men who want to be made), greed +0.002 (greedy men who want to be rich).
- `Character.bossId` when a restless independent man moves to the player's boss.

**Public API.**

| export | returns | description |
|---|---|---|
| `crewOf(w, p)` | `Character[]` | Alive men whose `bossId` is `p`. |
| `WANT_LINE`, `WANT_SHORT` | records | Text for each want. |
| `wantFor(c)` | want kind | Rule: associate with ambition > 0.6 → made; vice > 0.55 and greed > 0.45 → gamble; ambition > 0.55 and caution < 0.5 → independent; sociability > 0.55 → lieutenant; greed > 0.55 → rich; else respect. |
| `knows(p, id, tag)` / `learnAbout(p, id, tag)` | `boolean` / `void` | Read and write the player's insight tags. |
| `crewTick(w)` | `void` | The weekly pass described above. Adds minor `rumour` and `trouble` facts, may `createDebt` between crewmen, may open an `invest` or favour encounter. Uses rng. |
| `openSunday(w, p)` | `string[]` | Shows the week's tells once and records their insight tags. |
| `crewChoose(w, p, e, code)` | `string[]` | Dispatcher for `kind: 'crew'` encounters: `situ.sitChoose75` → `goals.goalChoose` → `goals.joinChoose` → `powers2.agendaChoose` → `situations.sitChoose` → `pulse.pulseChoose` → its own kinds (`invest`, `money`, `intro`, `recommend`, `goodword`). Marks the encounter done unless `data.hold` is set or a line matches `/haven’t got|can’t afford|can’t cover|not enough/i`. Moves money, adds favours and debts. |
| `lapsedAsks(w)` | `void` | For each lapsed `crew` encounter not yet counted: `rep.ignored++`, `rep.broken++`, the asker's trust -0.07 and respect -0.06, a proud man's grudge +0.08. |
| `Reputation`, `reputationOf(w, p)`, `repLines(w, p)` | | Earner, word, feared, loyal scores from facts and `rep`, and the lines people say about the player. |

**Tick hooks.** Weekly `lapsedAsks` then `crewTick`, at the start of `engine.weekly` (engine.ts:94 to 95). `crewChoose` on player action (encounters.ts:501). `openSunday` from `ui/sunday.ts`.

**Depends on / used by.** Imports `powers2` (`agendaChoose`), `goals`, `situ` (`sitChoose75`), `situations` (`sitChoose`), `pulse` (`pulseChoose`), `core`, `encounters` (`addEnc`, `addFavour`), `voice` (`arch`, `pick`). Imported by `encounters` (`crewChoose`, via a mid-file import at line 978), `engine`, `dialogue` (`WANT_LINE`, `wantFor`, `knows`, `learnAbout`, `repLines`), `pulse` (`wantFor`), `web` (`crewOf`), `ui/views_a.ts`, `ui/views_b.ts`, `ui/sunday.ts`, tests `v75.test.ts`, `sit_trace.ts`.

**Invariants and rules.** Money between player and crew moves both sides (`p.cash -= x; c.cash += x`) or through `createDebt`; refusals for lack of cash leave the encounter open. One crew pairing event at most every 18 days, never the same pair within 70 days. A favour request (8% a week, at most every 12 days) or an `invest` proposal is only made when no `crew` encounter is open.

**Save compatibility notes.** `want`, `nick`, `insight`, `rep`, `w.sunday` are all optional and created on demand.

**Known issues / gaps.**
- Dispatcher order makes `goals.joinChoose` unreachable (see goals.ts).
- `lapsedAsks` applies to every lapsed `crew` encounter, including V75 sit-down requests (whose `from` is the first party) and goal questions, so those are penalised here as well as in their own modules.
- `tells.sort(() => rng.next() - 0.5)` uses an inconsistent comparator; it is deterministic in one JavaScript engine but the result depends on the sort algorithm.
- The independent man's move to the player's boss sets `bossId` directly, bypassing `rank.ts` (`leaveCrew`, `repairHierarchy`).
- `r.broken += 0` appears twice as a no-op.

## revenge.ts

**Purpose.** The player's response to a man who has wronged him. `settleOptions` lists what is open (words first: go to his superior or to your own boss, quietly undercut a same-rank rival, shame him with a fact you know, then beat, smash, rob, torch or kill by a chosen method, ask permission to touch a made man, or drop it), with warnings from `violence.warningFor`. `settleDo` carries it out; the web layer then calls `disputes.playerActed` so the dispute record reflects it.

**State owned.** No `World` field of its own. Writes `Character.cooldown` keys on the player: `under:<id>` (21 days) and `sup:<id>` (30 days). Pushes `w.pending` entries of kind `dispute`. Directly writes other characters' `known` map (shame), `standing`, `rels`, `heat`, business cash (via `bizMove`).

**Public API.**

| export | returns | description |
|---|---|---|
| `SettleOpt` | type | `{ code, label, hint?, danger? }`. |
| `superiorOf(w, p, x)` | `Character \| undefined` | `x`'s live boss, unless it is the player. |
| `settleOptions(w, p, x, kill = false)` | `SettleOpt[]` | The menu. With `kill`, the methods from `violence.killMethods` the player can afford, with odds. Read only. |
| `settleDo(w, p, x, code)` | `{ minutes; lines; done }` | Executes. `beat`/`torch` via `actions.perform` (player actor, immediate), `beat` adds `violence.aftermath`. `hit:<method>` does its own roll (`ok`, `seen`), murder or attempt fact, `core.handleDeath`, `afterKilling`, `tension +3`, and `aftermath` if seen (or if "the people who matter can add", 40%, 8% for a professional). `smash`, `rob`, `shame` (up to 8 people in his family or district learn the fact and lose respect and trust for him), `undercut`, `sup`/`mine` (a pending `dispute` handled by `consequences`), `perm` (`politics.askPermission`), `drop` (grudge x0.4). Uses rng. |

**Tick hooks.** None. UI: `settleOptions` from `ui/views_b.ts:693`, `settleDo` from web.ts:481.

**Depends on / used by.** Imports `econ` (`bizMove`), `actions` (`perform`, `tension`), `core`, `politics` (`askPermission`, `isMade`, `sanctioned`), `violence` (`aftermath`, `warningFor`, `killMethods`), `consequences` (`afterKilling`). Used by `web.ts` and `ui/views_b.ts`.

**Invariants and rules.** Shame only uses a fact the player knows with the actor's name (`p.known[f.id].knowsActor`), so the knowledge rule holds. Killing a made man without sanction is priced through `aftermath`.

**Save compatibility notes.** Nothing persistent beyond the cooldown keys and pending entries.

**Known issues / gaps.**
- `p.cooldown['sup:<id>']` is written but never read. `settleOptions` only hides "go to his superior" while a pending `dispute` exists (2 to 4 days), although the text says it is "a card you only play once".
- Contract and professional kills (`p.cash -= m.cost`) take money out of the world without a ledger entry or `books.expenses`; `rob` adds cash with `p.cash += take` rather than `core.earn`, so it never appears in the player's books.
- `shame` writes `y.known[f.id]` directly instead of calling `core.learn`.
- `torch` does not call `aftermath`; `smash` and `rob` have no violence aftermath either.

## consequences.ts

**Purpose.** Delayed consequences. It owns the processing of `w.pending`: each due item is removed and dispatched by kind. It also schedules the fallout of every killing (police heat in 1 to 3 weeks; blackmail by the client of a contract; the truth coming out after a false accusation), handles a superior taking up someone's complaint, and runs the weekly purge in which a violent, ambitious senior man has a subordinate in his own family killed.

**State owned.** `World.pending` processing (`Pending`, [types.ts:426](../../src/types.ts)). Producers and consumers:

| kind | produced by | handled by |
|---|---|---|
| `intent` | actions.ts:402 (NPC retaliation), disputes.ts:133 (`planReply`), encounters.ts:533 (`note: 'raidop'`) | `disputes.intentDue` (with `perform` passed in) |
| `hunt` | violence.ts:74 | `violence.huntDue` |
| `dispute` | revenge.ts:180, disputes.ts:110 | `disputeStep` here (re-queues itself while the go-between is jailed, up to 3 tries, or once on a first stall) |
| `reveal` | core.ts:206 (30% of hidden-actor facts), jobs.ts:359 | inline: everyone hurt by the fact learns who did it |
| `heat` | `afterKilling` | inline: heat on the killer; a report fact for the player |
| `blackmail` | `clientParts` (player killer with a client, 55%) | inline: `jobs.mkJob` a "handle" job against the client's worst enemy |
| `truth` | `clientParts` (false accusation, 70%) | inline: the victim's family turns on the accuser, an `exposed` fact, standing loss for the player if involved |
| `seat` | no producer in current code | `seatDecision` (kept for pending entries in older saves) |
| `plan` | none | none |

Also writes `Character.cash` (brokered compensation), `rels`, `Family.tension`, `Family.capBonus` and `seatNo` (seat decisions), and `heat`.

**Public API.**

| export | returns | description |
|---|---|---|
| `KillOpts` | type | `{ client?: Id; false?: boolean; accuser?: Id }`. |
| `afterKilling(w, killer, victim, f, o = {})` | `void` | Pushes `heat` (7 to 21 days, +0.25 to 0.45) and the client parts. Uses rng. |
| `afterClient(w, killer, victim, o)` | `void` | Client parts only, using the latest murder fact on the victim (called by `jobs.ts` after a contract). |
| `pendingTick(w)` | `void` | Takes every due item out of `w.pending` first, then dispatches each; handlers may push new items. |
| `purge(w)` | `void` | For each NPC capo, underboss or boss with violence >= 0.65 and ambition >= 0.6, 1.2% a week: the lower-ranked family member he holds the biggest grudge against (>= 0.3, not the player) is killed by one of his men (or himself). Hidden-actor `murder` fact broadcast to the victim's friends; `afterKilling` on the killer with a 50% false accusation by the senior man. |

`disputeStep` (internal): the go-between's success is `0.3 + trust*0.3 + standing/400 + (genuine ? 0.2 : 0) - counterpart grudge*0.3 - min(0.25, tension*0.05) + (respect - 0.4)*0.2`; success pays $150 to $500 compensation (capped at the offender's cash), settles the dispute with 60-day terms and eases tension; middling gets a shrug; failure raises grudges and tension. Every outcome is a `report` fact tagged with the dispute (`story`).

**Tick hooks.** Daily `pendingTick` (engine.ts:57). Weekly `purge` (engine.ts:210).

**Depends on / used by.** Imports `violence` (`huntDue`), `core`, `jobs` (`mkJob`), `disputes` (`intentDue`, `noteDispute`, `settleDispute`), `actions` (`perform`), `career` (`capOf`, `seats`). Imported by `engine`, `actions` (`afterKilling`), `revenge` (`afterKilling`), `jobs` (`afterClient`, `afterKilling`).

**Invariants and rules.** Nothing happens on the day of the act. Compensation moves cash both ways. `purge` never targets the player. Items are processed in array order (insertion order).

**Save compatibility notes.** `w.pending` is ensured by `ensureShape`. `seatDecision` must stay for older saves that still contain `seat` items.

**Known issues / gaps.**
- `Pending.kind` includes `plan`, which is never produced or handled.
- `seat` is no longer produced (seat requests are handled in `career.ts`), so `seatDecision` only runs for old saves.
- In `purge`, the fact's actor is the senior man while the heat goes to the subordinate who did it; intentional but easy to misread.
- `disputeStep` adjusts the player's text with regex replacements to name an NPC; brittle if the wording changes.

## disputes.ts

**Purpose.** Quarrels between families that outlive the incident. Each day it scans new facts for cross-family beatings, vandalism, robberies and poaching and opens one `Dispute` per pair of men (or marks a settled one `violated` when its terms are broken). On each dispute's own clock the offender presses, pays off or backs out; the injured side takes it to his boss (a pending `dispute`) or plans a reply (a pending `intent`); long disputes raise family tension. It also implements the player's moves on disputes: investigate an older claim, call a sit-down (an encounter), make amends, and record how anything the player did to the other man changes the quarrel.

**State owned.** `World.disputes: Dispute[]` ([types.ts:224](../../src/types.ts)) and `World.disputeScan` (the time of the last scan). Dispute fields: `kind` (`territory`, `violence`, `theft`), `a` (injured), `b` (offender), `biz`, `fact`, `claim`, `status`, `history` (cap 14), `terms`, `created`, `next`, `older`, `found`, `ignored`, `seen`, `handled`. Also writes `Business.protection.hold` (a shop holding back its envelope), `Character.cash` on payoffs, `rels`, `Family.tension`, and pending `dispute`/`intent` items.

**Public API.**

| export | returns | description |
|---|---|---|
| `disputesOf(w, id)` / `openFor(w, id)` | `Dispute[]` | All, or open/violated, disputes involving a man. |
| `disputeScan(w)` | `void` | Merges duplicate open disputes per pair; scans facts newer than `w.disputeScan`; checks settled terms; opens new disputes (25% get an `older` claim); drops disputes untouched for 60 days; prunes closed ones (settled with terms ended more than 30 days ago, or quiet for 45 days). Uses rng. |
| `disputeTick(w)` | `void` | Expires terms; for each due open dispute (next in 2 to 5 days) runs the offender's and the injured side's moves for NPCs; raises tension on long disputes; marks the player's own `seen`. Uses rng. |
| `intentDue(w, q, perform)` | `void` | Carries out or abandons an intention (see "How an NPC decides"); also handles `note: 'raidop'` (wreck the player's racket). `perform` is a parameter so this module doesn't import `actions`. |
| `settleDispute(w, aId, bId, text, terms?)` | `void` | Settles the open dispute between the two, with terms. |
| `investigate(w, p, d)` | `{ minutes; lines }` | Reveals `d.older` or its absence; sets `found`. |
| `callSitdown(w, p, d)` | `string[]` | Opens a `sitdown` encounter (3 days) with hold, pay $400, share a cut, or walk. |
| `sitdownChoose(w, p, e, code)` | `string[]` | Resolves it: terms for 90 or 120 days, money moved, respect and grudge changes. |
| `ignoreDispute(d, w)` | `void` | Sets `ignored` and logs it. |
| `noteDispute(w, aId, bId, text)` | `string \| undefined` | Appends to the open dispute between two men and returns its id (used as `Fact.story`). |
| `mineAgainst(w, p, x)` / `againstMe(w, p, x)` | `Dispute[]` | Open disputes the player answers for against `x`, and those where `x` was wronged by the player. |
| `touchDispute(w, p, x, text?)` | `void` | Marks them handled and seen. |
| `amends(w, p, x, how)` | `void` | `own`, `pay`, `start`, `defy`: settles or reschedules. |
| `playerActed(w, p, x, how)` | `void` | Applies the effect of a revenge or conversation move on `mineAgainst` disputes. |

**Tick hooks.** Daily `disputeScan` then `disputeTick` (engine.ts:70 to 71). `intentDue` via `consequences.pendingTick`. Player actions: `web.ts` (ignore, look, sit, `playerActed` after `settleDo`), `club.ts`, `dialogue.ts`, `meetings.ts`, `encounters.ts` (`sitdownChoose`).

**Depends on / used by.** Imports `encounters` (`addEnc`), `core`. Imported by `consequences`, `engine`, `encounters`, `dialogue`, `club`, `meetings`, `web`, `ui/views_c.ts`. `core.handleDeath` also writes `Dispute.status` and `history` directly; `situ.syncLinks` mirrors every dispute older than 2 days as a `dispute` situation; `retain.ts` keeps facts of open disputes alive.

**Invariants and rules.** One open quarrel per pair of men (enforced by `mergePairs` and the scan). Only cross-family incidents open disputes. Payoffs move cash both ways and never below zero. History is bounded at 14 entries and identical consecutive lines are not repeated.

**Save compatibility notes.** `w.disputes` is ensured by `ensureShape`; `disputeScan` defaults to `now - DAY`. All flags are optional.

**Known issues / gaps.**
- The terms check is too broad ([disputes.ts:51](../../src/disputes.ts)). A settled dispute matches any new fact whose actor belongs to the barred family when `d.terms.biz === f.business`, and for disputes settled without a business (for example violence disputes brokered by `disputeStep`) both sides are `undefined`. Any later cross-family beating by anyone in that family then marks the unrelated dispute `violated` and `continue`s, so the new incident gets no dispute of its own. Confirmed with a scratch script.
- Line 117 is a statement with an empty body (`!d.ignored === false`); dead code.
- `disputeScan` iterates every fact in the world each day to find new ones; cost grows with `w.facts`.
- The tension rule `(now - created) % (7*DAY) < 5*DAY` interacts with the 2 to 5 day clock rather than running weekly.

## violence.ts

**Purpose.** What it costs the player to put hands on a man, depending on rank, family and permission. It supplies the warning text shown before acting, the aftermath applied after a beating or a killing by the player (standing loss, family-wide trust and respect changes, grudges, threats, hunts, and war-level tension for an unsanctioned killing of an underboss or boss), family hunts, and the kill methods with their odds.

**State owned.** `Family.hunt` (`{ target, since, sev, why }`; `engine.weekly` expires it). Writes `w.threats` entries via `danger.threatOf` (level, truce, hidden, last), pending `hunt` items, the player's `standing` and `heat`, other characters' `rels`, and `Family.tension` (set to at least 9 both ways).

**Public API.**

| export | returns | description |
|---|---|---|
| `warningFor(w, p, x, mode: 'beat' \| 'hit')` | `string` | The price, stated plainly. Pure. |
| `startHunt(w, famId, p, sev, why, spare?)` | `void` | Sets `fam.hunt`; up to 3 of the family's most violent free men get grudge >= 0.85, trust 0, respect <= 0.05 and a threat at level 1 or 2 with staggered `last`; a `report` fact for the player (`story: 'hunt:<famId>'`). |
| `huntDue(w, q)` | `void` | Pending `hunt`: 60% chance to `startHunt`. |
| `aftermath(w, p, x, mode)` | `string[]` | Applies the consequences (only if the act actually happened) and returns lines. Hunts are immediate or delayed 3 to 20 days. |
| `KillMethod`, `killMethods(w, p, x)` | `KillMethod[]` | Seven methods (open, street, ambush, contract $1,500, professional `4000 + weight*2500`, accident, poison) with `ok` lowered by the target's rank, bodyguards and caution and raised by the player's muscle, and `seen` raised by how crowded the district is. |

**Tick hooks.** None directly; `huntDue` runs through `consequences.pendingTick`. Everything else is on player action through `revenge.ts`.

**Depends on / used by.** Imports `core`, `career` (`LADDER`, `members`), `politics` (`isMade`, `sanctioned`), `danger` (`threatOf`). Used by `revenge` and `consequences`.

**Invariants and rules.** Every route to a hunt or a threat goes through `danger.threatOf`, so the player still faces the full ladder before a lethal attempt. Aftermath applies only to the player as actor.

**Save compatibility notes.** `Family.hunt` is optional.

**Known issues / gaps.** Line 117 is an empty loop ("all other houses watch"); `void DAY` at the end. Aftermath is not applied for torching, smashing or robbing.

## danger.ts

**Purpose.** The player can die, but only at the end of a ladder: word on the street, a message, being watched, an attempt he survives, and only then attempts that can kill. Each rung arrives as a `threat` encounter offering six ways out (go to your boss, ask for a sit-down, pay, strike first, go to ground for a week, do nothing), each with a cost.

**State owned.** `World.threats: Record<Id, Threat>` keyed by the enemy's id ([types.ts:602](../../src/types.ts)): `level` 0 to 4, `since`, `last`, `warned`, `truce`, `hidden`, `lethal`. Also the player's `hurtUntil`, `cash`, `heat`, the enemy's `cash` and `hurtUntil`, `rels`, and (on a lethal attempt) the player's death.

**Public API.**

| export | returns | description |
|---|---|---|
| `threatOf(w, enemy)` | `Threat` | Gets or creates the enemy's record. |
| `LADDER_WORDS` | `string[]` | UI words for each level. |
| `dangerLevel(w)` | `{ level; who? }` | The highest live, untruced threat. |
| `menace(w, enemy, p)` | `void` | One step up the ladder for that enemy (called when an approved NPC hit targets the player). |
| `threatChoose(w, p, e, code)` | `string[]` | The player's answer: `boss` (truce 30 days, level -2, if the boss agrees), `sitdown` (costs $150 that leaves the world; truce 20 days; hotheads, cold and bitter men often refuse), `pay` (300 x level to the enemy; truce 25 days on success), `strike` (beat him; `lethal +1`), `hide` (8 days of `hidden`; the encounter handler advances 8 days), `shrug`. |
| `dangerTick(w)` | `void` | Daily: deletes threats from dead enemies; decays a level when grudge < 0.3 and 7 days have passed; steps active threats (30% when grudge >= 0.3 and no truce); starts new threats from NPCs with grudge >= 0.7 and violence >= 0.55 outside the player's family (4%), or grudge >= 0.5 and violence >= 0.3 when their family is hunting the player (12%). |

The internal `step` respects truce, jail and `hidden` (85% skip), waits `GAP` days between rungs (4, 4, 5, 6, 7), and at level 3 or more makes an attempt. The first attempt (from level 3) cannot kill; once `level >= 4` and `warned >= 3`, the kill chance is `clamp(0.42 + lethal*0.1 - bodyguards*0.07 - (trusted boss, 40% ? 0.1 : 0) - (hidden ? 0.15 : 0), 0.12, 0.7)`. A lethal attempt calls `core.handleDeath` on the player.

**Tick hooks.** Daily `dangerTick` (engine.ts:60). `threatChoose` from encounters.ts:982. `menace` from `actions.perform`.

**Depends on / used by.** Imports `encounters` (`addEnc`), `core`, `actions` (`tension`), `voice` (`arch`, `pick`). Used by `engine`, `encounters`, `actions`, `politics` and `violence` (`threatOf`, mutating the record directly), `ui/views_a.ts` and `ui/stories.ts` (`dangerLevel`, `LADDER_WORDS`).

**Invariants and rules.** No lethal attempt without at least one survived attempt and three warnings. Rumour text and attempt narration are chosen with `voice.pick` (a hash of a seed string), not `w.rng`.

**Save compatibility notes.** `w.threats` is ensured by `ensureShape`; records are deleted when the enemy dies.

**Known issues / gaps.** `threatChoose` does not set the encounter's status itself (left to the encounter handler). The `sitdown` cost leaves the world unrecorded.

## situations.ts

**Purpose.** The pre-V75 situation system, still live for two kinds near the player. `money`: a man in the player's crew or family, or the owner of a shop the player protects, is in real trouble (a business in distress, a personal problem, short of cash); he tries alone first and, after a patience that depends on his pride, asks the player for a loan, or goes to a richer friend. `ambition`: a crewman with a strong want asks the player about his future. It also answers "how's business?" in conversation and implements the player's help.

**State owned.** `Situation` records with no `key` in `World.situations` (kinds `money`, `ambition`; fields `who, biz, rival, since, weeks, stage, cause, knows, told, helped, asked, resolvedAt, how`). Also `Business.distress` (help and leaning on a rival shop write it directly), `Character.problem.sev`, cash, debts, favours, and the player's cooldown `sitask:<id>` (3 days).

**Public API.**

| export | returns | description |
|---|---|---|
| `openSits(w)` / `sitOf(w, who)` | `Situation[]` / `Situation \| undefined` | Open situations of any kind; the first whose `who` is the man. |
| `situationTick(w)` | `void` | Weekly emergence and progress (see Purpose); calls `encounters.makeLoan`; caps the list at 60. |
| `sitChoose(w, p, e, code)` | `string[] \| undefined` | Answers the `sit_ambition` encounter (`back`, `pay` $300, `wait`). |
| `askAbout(w, p, c)` | `string[]` | He tells the cause if he trusts the player (>= 0.4), is already asking, or is incautious; sets `told`/`knows`. |
| `helpWith(w, p, c, how)` | `string[]` | `cover` $600 (a favour), `lend` $400 at 5%, `leave`, `rival` (raise the rival shop's distress, the rival owner's grudge). |

**Tick hooks.** Weekly `situationTick` (engine.ts:158), just before `situ.sitWeek`. `sitChoose` through `crewlife.crewChoose`. `askAbout`/`helpWith`/`sitOf` from `club.ts` and `dialogue.ts`.

**Depends on / used by.** Imports `core`, `econ` (`bizMove`), `encounters` (`addEnc`, `addFavour`, `makeLoan`). Used by `engine`, `crewlife`, `club`, `dialogue`, `tests/v75.test.ts`.

**Invariants and rules.** Only people near the player; never the boss; one open situation per man; a man is left alone for 4 weeks after his last one resolved. Help money goes into the business via `bizMove(..., 'aid')` or into his pocket.

**Save compatibility notes.** Older situations may lack `kind`; they are treated as `money` (only `kind === 'ambition'` branches).

**Known issues / gaps.**
- The cap `if (list.length > 60) list.splice(0, list.length - 60)` ([situations.ts:83](../../src/situations.ts)) applies to the whole shared array, including open V75 situations and `pulse.ts` ones, and drops the oldest regardless of stage. `situ.spawn` keeps up to 60 closed situations plus up to 30 open non-mirrors plus mirrors, so once the list fills this cap removes open matters. In a 40-week run of seed 3, 5 open situations disappeared this way (the first by week 20). A player question pointing at a removed situation then reads "It has been settled without you."
- `weeks` is incremented here and again in `situ.sitWeek` for every open situation, so `money` and `ambition` situations age two weeks per week (observed: `weeks = 4` after 1.1 weeks). Patience and "asks after 3 weeks" thresholds are reached twice as fast as written.
- `sitOf` does not filter by kind or `key`, so in conversation it can return a V75 or pulse situation where the man is `who` (for example an `intel` witness or a skim accused). `askAbout` then shows `s.cause` directly, bypassing the V75 rule that knowledge comes from facts, and `helpWith` can "help" with it. `club.ts:253` only filters out `ambition`.
- `back` on an ambition request records a favour owed to the player and resets `want.since`, but creates no promise memo, so nothing later checks whether the player kept his word.
- New emergence is suppressed for a man who is `who` of any open situation, including V75 ones.

## situ.ts

**Purpose.** The V75 situation framework: one shared record for any ongoing matter between people with a cause, a state, a history and a way out (see "Situations lifecycle"). It defines six stepped kinds (skim, intel, tribute, debt, partner, grudge), mirrors open disputes and crew grievances, runs NPC-chaired sit-downs with per-attendee utilities, decides when to ask the player to chair, and spreads word of matters through people who know them.

**State owned.** `Situation` records with a `key` in `World.situations` (all V75 fields: `kind`, `parties`, `orgs`, `phase`, `sev`, `next`, `key`, `hist`, `k`, `claims`, `truth`, `amt`, `link`, `cons`, `out`, `meet`, `ask`, `m`), `World.sitcool`, `World.sitpace`. Through kit outcomes and steps it writes `Character.books.arrears`, `kickRate`, `want`, `backer`, `standing`, `hurtUntil`, `cash`, `rels`; `Debt` fields (`nextDue`, `missed`, `weeklyPayment`, `weeklyRate`, `balance`); `Business.damaged`, `stakes`, ownership and protection arrears (via `econ`); `Fact.story` on the triggering skim fact; the player's `cooldown.sit75`. Module state: exported mutable `SIT = { on, cap: { open: 30, closed: 60, hist: 8, claims: 3, cons: 5 } }` and the `KITS` registry.

**Public API.**

| export | returns | description |
|---|---|---|
| `SIT` | object | Switch and caps. |
| `isOpen(s)` | `boolean` | `stage !== 'resolved'`. |
| `sitsFor(w, id)` | `Situation[]` | Open situations where the man is `who` or a party. |
| `spawn(w, kind, key, who, init)` | `Situation \| undefined` | Creates a situation if allowed (see "Situations lifecycle"); trims closed ones to 60. |
| `know(w, s, id, l, via)` | `void` | Raises a man's knowledge level on the situation. |
| `tell(w, s, text, o?)` | `Fact` | Adds a fact tagged `sit:<id>`, records history, updates `k` and pacing. |
| `claim(w, s, by, text, honest)` | `void` | Records what someone said (cap 3). |
| `closeSit(w, s, out, cons?, coolWeeks = 8)` | `void` | Resolves and sets the cool-off. |
| `commonSuper(w, a, b)` | `Character \| undefined` | The lowest man both answer to (chains of up to 6). |
| `kitOf(s)` / `attendees(s)` | `Kit \| undefined` / `Id[]` | The kind's sit-down kit; parties plus `meet.parts`. |
| `stanceOf(w, s, id)` | `{ want; flex }` | A man's preferred option and flexibility. |
| `chairPick(w, s, chair)` | `string` | What the chair would decide. Uses rng. |
| `Verdict`, `hold(w, s, chair, code)` | `Verdict` | Holds the sit-down: applies, adjusts relationships, records `meet`, tells a `sitdown` fact. |
| `describeStance(w, s, id)` / `titleOf(w, s)` | `string` | UI text. |
| `sitChoose75(w, p, e, code)` | `string[] \| undefined` | The player as chair: `listen` (stances, encounter held open), `pass` (his superior or the senior party decides), or `p:<option>`. |
| `skimNoticed(w, boss, c, fl, factId)` | `boolean` | Called by `books.ts`: opens or reinforces a skim matter (NPC boss and NPC man only). Returns true if a situation now owns what happens next. |
| `promotedOver(w, winner, was)` | `void` | Called by `career.ts`: the most aggrieved ambitious rival of the old rank starts a grudge matter. |
| `sitDay(w)` / `sitWeek(w)` | `void` | Daily clock and weekly scans (see "Situations lifecycle"). |
| `sitIssues(w)` | `string[]` | Consistency checks (duplicate open keys, missing parties, no clock, closed with a clock, unbounded records, bad knowledge, mirrors out of sync). Used by `consistency.audit`. |

Kinds in brief:

| kind | source | phases | sit-down options |
|---|---|---|---|
| skim | `skimNoticed` | noticed → explain (lie or own up; boss may believe) → doubt (a subordinate witness or a rival accuser; may spawn intel) → inquiry → confront (cert < 30 drops it) | repay, punish (`books.discipline`), overlook, expel (`rank.leaveCrew`) |
| intel | skim doubt | found → squeeze (blackmail; pays or beats the witness) or sitting (fades after 8 weeks) | none |
| tribute | `tributeScan` | late (owner's claim; collector reads `econ.evidence`) → time / press (smashing by violent collectors) → appeal | extend, waive, share (15% stake), enforce, takeover (`transferBusiness`) |
| debt | `debtScan`, `negotiateDebt` | missed → pressed (after 2 rounds or 3 missed: common superior chairs, or they settle between themselves) | extend, restructure, writedown, share (`econ.seizeShare`), enforce |
| partner | `partnerScan` | complaint → response → backing | buyout (shortfall becomes a debt), sellout, dissolve, stay |
| grudge | `promotedOver` | sulk (finds allies) → airing (swallows it or goes to the boss) | placate, dismiss, reprimand (an ambitious man refused may begin an `independence` goal) |
| dispute, crew | `syncLinks` mirrors | follow their source | none |

**Tick hooks.** Daily `sitDay` (engine.ts:54). Weekly `sitWeek` (engine.ts:159). `skimNoticed` from `books.ts`; `promotedOver` from `career.ts`; `sitChoose75` through `crewlife.crewChoose`.

**Depends on / used by.** Imports `books` (`discipline`, `influence`), `core`, `econ` (`addStake`, `clearArrears`, `evidence`, `giveTime`, `seizeShare`, `transferBusiness`), `rank` (`LADDER`, `leaveCrew`), `goals` (`begin`, `goalsOf`, `priceOf`), `encounters` (`addEnc`). Imported by `engine`, `books`, `career`, `crewlife`, `consistency`, `sitmoves`, `ui/stories.ts`, tests `v75.test.ts`, `sit_trace.ts`, `sit_measure.ts`.

**Invariants and rules.**
- One open situation per key; a closed key stays closed for its cool-off unless a mirror's source reopens.
- `truth` is never shown; NPC decisions use it only where the NPC would plausibly know (the accused knows if he is guilty; the boss acts on `cert`, built from claims and inquiries).
- Every development visible to anyone is a fact with explicit witnesses; the player learns only through facts.
- Money in kit outcomes moves both ways or through `createDebt`/`payDebt`/`addStake`/`transferBusiness`; `placate` gives the chair's cash to the rival.
- Bounded records (see "Situations lifecycle").

**Save compatibility notes.** V75 was schema 6: older situations keep their old fields, and new ones start as the world runs. `w.situations`, `w.sitcool` and `w.sitpace` are ensured by `ensureShape` ([world.ts:305](../../src/world.ts)); `pace()` also creates `sitpace`. Situations without `kind` are skipped by `sitDay`.

**Known issues / gaps.**
- Open situations can be deleted by the cap in `situations.ts` (see that section).
- `w.sitcool` is never pruned (108 keys after 40 weeks of seed 3, growing); keys like `debt:<id>` and `dispute:<id>` are unique per instance.
- `sitpace.wk` is initialised and never used.
- `closeSit` always sets `how: 'alone'`, so `how` does not distinguish outcomes for V75 situations (`out` does).
- The `asking` timeout hands the matter to the player's own superior (`chainUp(w, P(w))[0]`), who may have no connection to the parties.
- `s.m['sup:<id>']` is a support weight in `weightOf`, while `sitmoves` stores the player's support cooldown under `s.m['sup:<playerId>']`; if the player were ever an attendee whose weight is computed, his cooldown timestamp would be read as a weight. Latent only.

## sitmoves.ts

**Purpose.** The player's side of V75 situations. It decides which matters he can see (only those he is in or has learned a fact about), what he can do about one (ask around, offer to mediate, speak up for someone, vouch for an accused man, ask for terms on his own debt), and how word reaches him: a whisper at the club from men present, or one item a week from friends in his family, filtered by trust, rank and the source's own position, and always a fact the source himself knows.

**State owned.** No `World` field of its own. Writes `Situation.m` keys (`inq:<playerId>` 5 days, `sup:<playerId>` 14 days, `vouch:<playerId>` 21 days, `sup:<who>` support weight +0.35, `cert`, `vouched`, `tp`), `Situation.k` and `knows`, `w.sitpace.stats`/`weekVis`/`lastVisible`, the player's `known` (via `core.learn`), relationships and standing.

**Public API.**

| export | returns | description |
|---|---|---|
| `Move` | type | `{ code, label, hint, who? }`. |
| `knownFacts(w, p, s)` | `Fact[]` | The player's facts tagged with the situation, newest first. |
| `isParty(s, id)` | `boolean` | `who` or a party. |
| `visibleTo(w, p, s)` | `boolean` | Has a kind and key, and the player is a party or knows a fact. |
| `movesFor(w, p, s)` | `Move[]` | `inquire`; `mediate` (a kit exists, not a party, at least two other attendees; a soldier whom all of them respect >= 0.3, or capo and above); `support` (up to 3 attendees he trusts and who trust him); `vouch` (skim, accused he trusts); `negotiate` (his own debt). |
| `negotiateDebt(w, p, debtId)` | `string[]` | Opens or reuses a `debt` situation with the player as debtor and holds a sit-down chaired by the creditor on the best option the creditor can live with. |
| `doMove(w, p, sid, code, who?)` | `{ lines; minutes }` | Validates against `movesFor`, then executes. `inquire` learns the newest unknown `sit:` fact from the most trusting source; `mediate` holds the sit-down with the player in the chair (the outcome is `chairPick`'s); `support` adds weight and costs respect with the others; `vouch` lowers `cert` and, if the man was guilty, the skim kit later costs the player standing and the boss's trust. |
| `sceneLines(w, p, here)` / `personTexture(w, p, c)` | `string[]` | Behaviour visible in a room or on a man (only stepped kinds with sev >= 0.3; causes only if the player knows). |
| `rankMult(p)` | `number` | `1 + 0.25*rankIndex + standing/250`: higher rank hears more. |
| `whisper(w, p, src, mode)` | `{ f; s } \| undefined` | The newest fact the source knows about a live (or recently closed) matter the player isn't in and hasn't heard, subject to discretion rules (his own business only at trust >= 0.5; matters two ranks up only at trust >= 0.45; intel only from sociable, trusting sources; friends need trust >= 0.3). |
| `clubTalk(w, p, here)` | `string[]` | Up to 2 whispers per club visit. Uses rng. |
| `friendsTell(w)` | `void` | Weekly: at most one whisper from a trusting family member. Uses rng. |

**Tick hooks.** Weekly `friendsTell` (engine.ts:160, after `sitWeek`). `clubTalk` and `sceneLines` from `places.ts`; `doMove` from web.ts:627; `movesFor`, `visibleTo`, `isParty`, `knownFacts` from `ui/stories.ts`; `personTexture` from `ui/views_a.ts`.

**Depends on / used by.** Imports `core` (`clamp`, `learn`, `rel`), `rank` (`LADDER`), `situ` (both named imports and `import * as situ` for `spawn`). Used by `engine`, `places`, `web`, `ui/stories.ts`, `ui/views_a.ts`, tests `v75.test.ts`, `sit_trace.ts`.

**Invariants and rules.** Nothing is invented: every whisper is a fact the source knows; the player's knowledge changes only through `core.learn`. Moves are rechecked against `movesFor` at execution.

**Save compatibility notes.** Nothing of its own; uses `Situation.m`.

**Known issues / gaps.**
- The header says nothing here reads a situation's hidden `truth`, but `doMove('vouch')` reads it to set the claim's `honest` flag (simulation-only, so no leak to the player).
- `clubTalk` and `friendsTell` use `w.sitpace!` without creating it; safe in practice because `sitWeek` runs first and any situation with a key implies `sitpace` exists, but it would throw on a world without one.
- `inquire` calls `core.learn` with `from: 'told'`, which is not one of the documented `Knowledge.from` values (`witness`, `self`, `public`, or a character id).
- The `continue` at the end of the respect loop in `inquire` is a no-op.

## How this group connects to the rest

- `engine.think` → `actions.chooseAction` / `perform` → `core.addFact` → `core.learn` (grudges, `struggling`), `core.suspect`, `w.pending` `reveal`.
- `actions.perform` → `econ.bizMove` / `econ.setCollector` (business cash, protection) and `core.createDebt` / `payDebt` (debts and the ledger via `ledger.post`).
- `actions.perform` (NPC retaliate) → `w.pending` `intent` → `consequences.pendingTick` → `disputes.intentDue` → `actions.perform` (approved) or `danger.menace` (if the player is the target of a hit).
- Facts → `disputes.disputeScan` → `Dispute` → `situ.syncLinks` mirror; `disputeTick` → pending `dispute` (`consequences.disputeStep`) or `intent`.
- Killings (`actions`, `revenge`, `jobs`, `purge`) → `consequences.afterKilling` → `heat`, `blackmail` (→ `jobs.mkJob`), `truth` (→ `exposed` fact).
- Player violence (`revenge.settleDo`) → `violence.aftermath` → `danger.threatOf`, `Family.hunt`, standing; → `disputes.playerActed`.
- `books.ts` (a boss notices a gap) → `situ.skimNoticed`; `situ` skim punish → `books.discipline`; `situ` weights use `books.influence`.
- `career.ts` (a man is made) → `situ.promotedOver`; `situ` grudge refusal → `goals.begin('independence')`.
- `goals.agencyWeek` → `econ.transferBusiness` / `addStake` / `bizMove`, `core.createDebt` / `payDebt`, `orders.recruitProspect`, `rank.leaveCrew`; reads `career.readiness`. `core.handleDeath` → `goals.goalsOnDeath`.
- `crewlife.crewChoose` is the router for every `crew` encounter (situ, goals, powers2, situations, pulse); `encounters.ts` calls it, `threatChoose` and `sitdownChoose`.
- `consistency.audit` / `reconcile` → `goals.agencyIssues`, `situ.sitIssues`.
- `retain.ts` → gossip caps used by `actions.share`; keeps facts of open disputes.
- UI: `ui/stories.ts` (situations, disputes, hunts, danger), `ui/views_*` (grudge words, settle menu, wants, reputation), `club.ts` / `dialogue.ts` (situations, disputes), `places.ts` (club talk).

## Replacing this system

A drop-in replacement must provide the surface other modules actually import:

- **actions**: `chooseAction(w, c)` and `perform(w, a)` with the `Action` shape from `types.ts` and the `{ minutes, lines }` return (engine, web, cli, jobs, orders, books, revenge, consequences all call `perform`, including for `collect`, `shakedown` and `retaliate` with `approach` and `approved`); `generate(w, c, kind)` for the player's menu; `share`, `confide`, `tension`, `describe`, `grudgeWord`.
- **consequences**: `pendingTick`, `purge`, `afterKilling`, `afterClient`, and handling of every `Pending.kind` still present in saves (including `seat`).
- **disputes**: the scan and tick, `intentDue` (called with `perform` injected), and the player/UI functions (`callSitdown`, `sitdownChoose`, `investigate`, `ignoreDispute`, `noteDispute`, `settleDispute`, `mineAgainst`, `againstMe`, `touchDispute`, `amends`, `playerActed`, `disputesOf`).
- **goals**: `agencyWeek`, `goalsOnDeath`, `goalChoose`, `joinChoose`, `agencyIssues`, and `begin`, `goalsOf`, `priceOf` for `situ`.
- **situ / situations / sitmoves**: `sitDay`, `sitWeek`, `situationTick`, `friendsTell`, `skimNoticed`, `promotedOver`, `sitChoose75`, `sitChoose`, `sitIssues`, `isOpen`, `titleOf`, the player moves (`movesFor`, `doMove`, `visibleTo`, `isParty`, `knownFacts`, `personTexture`, `sceneLines`, `clubTalk`), and conversation helpers (`sitOf`, `askAbout`, `helpWith`).
- **danger / violence / revenge**: `dangerTick`, `menace`, `threatOf`, `threatChoose`, `dangerLevel`, `LADDER_WORDS`; `huntDue`; `settleOptions`, `settleDo`.
- **crewlife / ambition**: `crewTick`, `lapsedAsks`, `crewChoose` (as the `crew` encounter router), `openSunday`, `wantFor`, `WANT_LINE`, `WANT_SHORT`, `knows`, `learnAbout`, `repLines`, `crewOf`; `ambitionTick`, `ambitionInit`, `progress`, `bandOf`, `AMBS`, `ambProgress`, `AMBITIONS`.

World fields it must keep, with their shapes, because saves and other modules read them: `pending`, `disputes`, `disputeScan`, `threats`, `situations` (shared with `pulse.ts`), `sitcool`, `sitpace`, `agency`, `goals`, `sunday`; `Family.hunt` and `Family.tension`; on `Character`: `cooldown` (shared bag; key formats are read only here), `want`, `nick`, `insight`, `rep`, `ambition`, `backer`, `rels`, `known`, `struggling`; on `Business`: `lastApproach`, `informPrev`, `protection.hold`. It must answer `think` and the daily (`sitDay`, `pendingTick`, `dangerTick`, `ambitionTick`, `disputeScan`, `disputeTick`) and weekly (`lapsedAsks`, `crewTick`, `situationTick`, `sitWeek`, `friendsTell`, `agencyWeek`, `purge`) calls in the engine's fixed order, since later calls read what earlier ones wrote the same day.

What makes it hard:
- **Circular imports.** `core` ↔ `goals` (`goalsOnDeath`); `actions` ↔ `danger` (`menace` / `tension`); `actions` ↔ `consequences` (`afterKilling` / `perform`, which is why `intentDue` takes `perform` as a parameter); `consequences` ↔ `jobs`; `encounters` ↔ `crewlife` and `encounters` ↔ `danger` (mid-file imports at encounters.ts:976 to 978); `goals` → `encounters` → `crewlife` → `goals`; `goals` → `career` → `situ` → `goals`; `situ` ↔ `books`; `violence` → `danger` → `actions` → `consequences` → `violence`. They work only because no module uses another's exports at load time.
- **Shared mutable records.** `w.situations` has three writers with different conventions (and one cap that deletes the others' records); `w.pending` has producers in eight modules (core, jobs, encounters, revenge, violence, disputes, actions, and consequences itself); `Character.cooldown` mixes timestamps and a counter (`restless`) from many modules; `Character.want` has six writers; `Threat` records are mutated directly by `politics` and `violence`; `core.handleDeath` writes `Dispute` status and history; `Business.distress` is written by `situations.helpWith`.
- **Implicit contracts.** `perform`'s `approved` flag decides whether an NPC acts now or forms an intention; the `crewChoose` dispatch order decides which system answers an encounter; `Fact.story` values (`sit:<id>`, dispute ids, `seat:<rank>`, `hunt:<famId>`) tie facts to records and are read by the UI and by `retain.ts`.
- **Hidden state outside `World`.** `actions.aliveCache`, `goals.spentOut`, and the mutable `AGENCY` and `SIT` configs (tests change them).
- **Save compatibility.** Old situations without `key` or `kind`, `seat` pendings and dispute flags must keep loading; new fields must stay optional.
