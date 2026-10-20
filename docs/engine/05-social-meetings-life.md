# Social spaces, meetings, private life and orders

In game terms this group covers the places and occasions where the player deals with people face to face rather than through the autonomous sim: the family's social club (who is in the room, who wants a word, short conversations that settle debts, quarrels and envelopes), formal meetings (crew meetings, being called in over the money, family meetings, sit-downs, dinners, the made-man ceremony), the player's private life (mother and sibling, dating, marriage, children, christenings) and the orders the player gives his own men (sending them on jobs, the story they bring back, day jobs, recruiting hangers-on). In code terms it is five modules that mostly sit between the UI (`web.ts`, `src/ui/*`) and the core systems: they read debts, jobs, disputes, situations, books and facts, and write back through `core`, `jobs`, `disputes`, `career`, `encounters` and `ledger`. Only three entry points are called directly by `engine.ts` (`summonsTick`, `lifeDaily`, `christeningDue`, all daily); crew jobs reach `orders.ts` through `jobs.daily`, and `ensureClubs` runs weekly through `orgs.orgWeek` as well as on load. Two kinds of multi-step conversation live here and they are persisted differently: a **club scene** is stored in `World.scene` and resumes after a reload; a **meeting** is held only in UI state (`S.view.m`) and is lost on reload (see [meetings.ts](#meetingsts)).

> **Tracked bugs:** the "Known issues" notes below were checked against the source, and the confirmed ones are filed as GitHub issues: [`area: social`](https://github.com/agmkzy/omerta/issues?q=is%3Aissue+milestone%3A%22V85+baseline+review%22+label%3A%22area%3A+social%22).

## Modules

| File | Lines | Responsibility |
|---|---|---|
| [clubdata.ts](../../src/clubdata.ts) | 93 | The club as a place: one per family, owner, hours, per-visitor memory, and a pure, hash-based "who is in the room" function. Defines the `Club`, `ClubMem`, `Scene` and `Here` types. |
| [club.ts](../../src/club.ts) | 317 | Club conversations: why a man has something to say (`topicsFor`), who approaches the player (`waiting`), and the resumable scene state machine (`startScene` / `sceneNode` / `sceneAct` / `closeScene`). |
| [meetings.ts](../../src/meetings.ts) | 943 | Agenda-driven meetings (crew, accounts, family, sit-down, social, induction), grievance generation and rulings, NPC-initiated summons (`summonsTick`). |
| [life.ts](../../src/life.ts) | 450 | The player's kin and partner: initial family, warmth decay, Sunday dinners, illness, dating ladder, wedding, children, christening, and the encounters these raise. |
| [orders.ts](../../src/orders.ts) | 539 | Orders to crew: the order menu, how a man actually behaves on a job and what he reports, questioning reports, errand resolution, boss errands, recruiting prospects, day jobs. |

---

## clubdata.ts

**Purpose.** Models the social club as a location that belongs to a family. It creates and repairs one club per family, knows the opening hours and the weekday, keeps a small memory per visitor, and computes who is present at any moment. Presence is a pure function of the clock and each man's circumstances (a string hash of `id + 3-hour slot`, never `w.rng`), so every screen that asks within the same slot gets the same answer and asking consumes no randomness. It contains no dialogue; [club.ts](../../src/club.ts) drives the scenes.

**State owned.**
- `World.clubs?: Record<familyId, Club>` ([types.ts:479](../../src/types.ts)). Created and repaired by `ensureClubs`.
- `Club` ([clubdata.ts:10](../../src/clubdata.ts)): `id` (`'club:' + familyId`), `name`, `district`, `familyId`, `ownerId`, `hostId?`, `open: [number, number]`, `mem: Record<Id, ClubMem>`, `visit?`.
  - `ownerId` is written here (picked and re-picked by `ensureClubs`).
  - `hostId` is declared here but written only by [orgs.ts:217](../../src/orgs.ts), [orgs.ts:472](../../src/orgs.ts) and [orgs.ts:493](../../src/orgs.ts) (the club is the organisation leader's seat).
  - `mem` entries are created lazily by `memOf`; their fields are written by [club.ts](../../src/club.ts).
  - `visit` is declared ("so a reload can't roll the dice again") but never read or written anywhere.
- `ClubMem` ([clubdata.ts:9](../../src/clubdata.ts)): `last` (time of last conversation, default `-1e9`), `seen: Record<topicKey, "sig|time">`, `note?: { text, until }`, `said?`.
- `Scene` ([clubdata.ts:17](../../src/clubdata.ts)) is the type of `World.scene`, but the logic is in club.ts (documented there).

**Public API.**

| Export | Signature | Description / side effects |
|---|---|---|
| `CLUB_HOURS` | `[number, number] = [11, 26]` | Default opening hours, 11:00 to 02:00 (hours past midnight are expressed as 24+). |
| `ClubMem`, `Club`, `Scene`, `Here` | interfaces | `Here = { c: Character; role: 'owner' \| 'regular' \| 'boss'; doing: string }`. |
| `ensureClubs` | `(w: World): void` | For each family without a club, picks an owner (`pickOwner`: the capo with most direct reports, else the underboss, else any made man; never the player) and creates the club with a name from a fixed list of six, indexed by iteration order. For existing clubs, re-picks the owner if he is dead, has left the family or is the player. Mutates `w.clubs`. No rng. A family with no eligible owner gets no club. |
| `clubOf` | `(w, famId: Id \| null \| undefined): Club \| undefined` | Lookup by family id. |
| `clubOpen` | `(w, cl: Club): boolean` | Compares the current hour (00:00 to 03:59 mapped to 24 to 27.99) with `cl.open`. |
| `weekday` | `(w): number` | `floor(now / DAY) % 7`; 0 is Monday, 6 is Sunday (the clock starts on a Monday). |
| `clubPresent` | `(w, cl: Club): Here[]` | Who is in the club now; empty when closed. Pure. Sorted owner first, then by rank. |
| `memOf` | `(cl: Club, id: Id): ClubMem` | Returns the visitor memory, creating `{ last: -1e9, seen: {} }` on first use (mutates `cl.mem`). |

Internal: `pickOwner`, `hourNow`, `away(w, c)` (jailed, hurt, on an active job, or asleep according to `c.wake`/`c.sleep`).

Presence rules in `clubPresent` ([clubdata.ts:60](../../src/clubdata.ts)): only living, non-civilian, non-player members of the club's family who are not jailed or hurt are considered. Base probability by rank: associate 0.14, soldier 0.2, capo 0.26, underboss 0.12, boss 0.05. Boss and underboss go to 0.85 on Thursday and Sunday evenings. Modifiers: day job on a weekday daytime x0.2, a hustle in daytime x0.6, a gambling problem in the evening +0.3, owner's own man +0.15, capos and underbosses at least 0.4 / 0.6 when the player is the club's `hostId`, the player's own men 0.9 on Sunday 12:00 to 20:00 when `w.sunday` is set (envelope day), and x0.75 if the man's district is more than 20 minutes away. The roll is `hash(id + ':' + slot) % 1000 / 1000 < pr` with `slot = floor(now / 180)`.

**Tick hooks.** None in `engine.ts`. `ensureClubs` runs from `ensureShape` ([world.ts:290](../../src/world.ts)) on world creation and on every load, from `orgWeek` ([orgs.ts:470](../../src/orgs.ts), weekly via [engine.ts:155](../../src/engine.ts)), and from the org changes in [orgs.ts](../../src/orgs.ts) (leaving/expulsion at line 262, `defect` at 288, `foundOrg` at 317). `clubPresent` is called on demand by the UI and by `places.ts`.

**Depends on / used by.**
- Imports: `core.travelTime` (distance modifier), `voice.hash` (deterministic presence roll), `types`.
- Imported by: [club.ts](../../src/club.ts) (types, `clubOf`, `clubOpen`, `clubPresent`, `memOf`, `weekday`), [world.ts](../../src/world.ts) (`ensureClubs`), [orgs.ts](../../src/orgs.ts) (`ensureClubs`, `clubOf`), [places.ts](../../src/places.ts) (`clubOf`, `clubPresent`: the club as a visitable place), [web.ts](../../src/web.ts) (`clubOf`), [ui/views_a.ts](../../src/ui/views_a.ts), [engine.ts:240](../../src/engine.ts) (imports `ensureClubs` but does not call it), tests `v72`, `v76`.

**Invariants and rules.**
- At most one club per family, keyed by family id; `Club.id` is `'club:' + familyId` and orgs.ts uses it as `Family.hq`.
- The owner is alive, in the family and never the player (re-checked on every `ensureClubs`).
- `clubPresent` must stay free of `w.rng` and of writes, because it is called from render paths and must return the same answer for every caller within a 3-hour slot.
- Civilians, the player, the jailed and the hurt are never present.

**Save compatibility.** `World.clubs` is optional and is (re)built on load by `ensureShape` → `ensureClubs`, so pre-club saves gain clubs at load time (names then follow family iteration order). `hostId` is filled for older saves by `ensureOrgs` (`cl.hostId ??= f.bossId`, [orgs.ts:493](../../src/orgs.ts)). `mem` entries are created lazily. `visit` is optional and unused. The `pre-v85-club.save` and `v84-day35-mid.save` fixtures both carry `clubs`.

**Known issues / gaps.**
- `Club.visit` is dead: declared with a comment about reload safety but never read or written.
- The owner is effectively always present while the club is open: jailed and hurt men are filtered out before the owner branch, so the owner check `!away(w, c) || c.jailedUntil <= w.now` is always true, even when he is asleep or on a job ([clubdata.ts:71](../../src/clubdata.ts)).
- The day-job modifier (`c.job && !evening && dow < 5`) never applies: `Character.job` is only ever set for the player ([orders.ts:447](../../src/orders.ts)), and the player is excluded from presence.
- Club names repeat if there are more than six families, and the name a family gets depends on iteration order and on whether earlier families had an eligible owner.
- `engine.ts` has an unused `ensureClubs` import.

---

## club.ts

**Purpose.** Turns the club into short conversations. A man has something to say only when the world gives him a reason (an open encounter, a quarrel, money owed in either direction, a job offer, arrears, a situation, a sponsorship ask, his crew's arrears), and the player has a few things he can raise himself (ask for work, ask what he has heard, buy a drink, ask about business). Each conversation is a small scene that changes real state and then ends. The scene is kept in `World.scene`, so a save taken mid-conversation reloads into the same node.

**State owned.**
- `World.scene?: Scene | null` ([types.ts:480](../../src/types.ts)): the conversation in progress. Created by `startScene`, advanced by `sceneAct`, cleared by `closeScene` (or by `sceneNode`/`sceneAct` if the NPC or club record has gone).
- Visitor memory via `memOf` ([clubdata.ts:93](../../src/clubdata.ts)): `ClubMem.last` (set on start and end), `ClubMem.seen[topicKey] = "<sig>|<time>"` (set by `markSeen`), `ClubMem.note = { text, until: now + 10 days }` (a remark appended to the next greeting, then deleted), `ClubMem.said` (last topic; written, never read).
- Generic bags: `p.cooldown['clubwork']` (3 days after a successful "ask for work" from the boss, 2 days otherwise); `p.insight[c.id]` gains `'problem'` (tab "why" node) or `'hint'` (drink); `c.problem.revealed = true` (tab "why" node).
- Writes into other systems' fields directly: `c.books.arrears` / `c.books.missed`, `Debt.nextDue` / `Debt.missed`, `p.cash` / `c.cash`, relationship values via `rel()`, `c.want.kind = 'independent'`, `Problem.sev`.

### The scene state machine

`Scene` ([clubdata.ts:17](../../src/clubdata.ts)):

| Field | Meaning |
|---|---|
| `npc: Id` | The man being spoken to. |
| `topic: string` | Current topic key: `chat`, `enc`, `tab`, `trouble`, `quarrel`, `creditor`, `debtor`, `sponsor`, `report`, `work`, `ask_work`, `biz`, `heard`, `drink`. |
| `node: string` | Node within the topic: `open` by default; `why` (tab), `help` (trouble). |
| `data: Record<string, string \| number>` | Scratch: `greet` (greeting shown above the first node of an NPC-initiated topic), `g0` (cached greeting for `chat`), `enc` (encounter id, set by [web.ts:420](../../src/web.ts)), `job` (job id found by `ask_work`), `me: 1` (topic reached from the player's own menu), `L_ask` (biz/trouble flag), and once-cache keys `L_<key>_<topic>_<node>` holding newline-joined lines. |
| `log: string[]` | Transcript: every node's shown lines plus the responses, appended on each action. |
| `mins: number` | Minutes accumulated by the choices so far. |
| `t: number` | Start time (written, never read). |
| `ended?: boolean` | Set when a choice ends the conversation. |

Lifecycle:
1. **Start.** The UI (`cscene`, [web.ts:415](../../src/web.ts)) refuses if a scene already exists, picks the man's highest-priority `'him'` topic or `'chat'`, and calls `startScene`. The greeting is computed once and cached in `data.greet` / `data.g0`. `web.ts` saves immediately.
2. **Render.** `sceneNode` ([club.ts:275](../../src/club.ts)) calls the internal `script()` to build the current node's lines and options. It is called from `clubView` on every draw.
3. **Act.** `sceneAct(code)` ([club.ts:285](../../src/club.ts)) rebuilds the node, finds the option, runs it, appends the shown lines and the response to `log`, adds `res.mins ?? 5` to `mins`, then:
   - `next: 'goto:<topic>'` (from `chat`): switches topic, resets `node = 'open'` and `data = { me: 1 }`, and marks that topic as seen.
   - `next: '<node>'`: moves to another node in the same topic.
   - `end: true`: sets `ended`, marks the topic seen, updates `ClubMem.last` / `said` / `note`, and adds a minor `favour` fact "X sat down with Y at the club", witnessed by both.
   `web.ts` saves after every action ([web.ts:423](../../src/web.ts)).
4. **Close.** `closeScene` ([club.ts:312](../../src/club.ts)) nulls `w.scene` and returns `clamp(mins, 5, 120)`; the UI then calls `pass(minutes)`, which advances the clock and saves.

Two properties matter to anyone changing this:
- **Effects shown once.** Several nodes have effects that happen when the node is first displayed, not when an option is chosen (revealing a problem, teaching a fact, charging for a drink, asking the boss for work). They are wrapped in `once(key, fn)`, which stores the produced lines in `data['L_' + key + '_' + topic + '_' + node]`; later renders, a re-render inside `sceneAct`, and a reload all read the cache rather than rerunning the effect. Because `web.ts` saves after `startScene` but before the first render, a reload before the next action replays the effect from the saved RNG state and produces the same result.
- **The clock is frozen during a scene.** `w.now` does not move until `closeScene` hands its minutes to `pass()`. All choices are evaluated at the scene's start time.

The save/load round-trip is covered by the `v72` test "mid-scene save/load resumes the same scene" ([tests/v72.test.ts:228](../../src/tests/v72.test.ts)).

### Topics

`topicsFor(w, p, cl, c)` ([club.ts:32](../../src/club.ts)) returns topics de-duplicated by `(key, by)`. A `'him'` topic is suppressed for 3 days after it was seen with the same signature (`seenRecently`); the signature embeds the relevant state (debt balance, arrears, dispute history length, a time bucket), so a change of state brings the topic back.

| Key | By | Offered when | Prio | What the options do |
|---|---|---|---|---|
| `enc` | him | An open `Enc` from him | 9 | Delegates to `encounters.choose`; its minutes are capped at 40. |
| `quarrel` | him | An open or violated dispute between them, either way round | 8 | His grievance against you: `disputes.amends` (own / pay $200 / defy) or `callSitdown`. Yours against him: `playerActed` (warn / drop), `callSitdown`, `ignoreDispute`. |
| `creditor` | him | You owe him and it is due within a day or missed | 8 | `payDebt` in full or half (resets `nextDue`/`missed`), or ask for 4 days (respect and trust down). |
| `work` | him | He has an offered `via: 'boss'` job for you (`offerFrom`) | 8 | `jobs.takeJob`, `jobs.declineJob`, or leave it open. |
| `tab` | him | Your man; arrears > 20, or a light ledger statement with missed weeks | 7 | `why` node reveals his problem; cover (up to $400, adds a favour, posts a `gift`), lean, carry, forgive. |
| `trouble` | him | Your man; an untold non-ambition situation at least 2 weeks old; trust >= 0.35 | 6 | `situations.askAbout`, then `helpWith` (cover $600, lend $400, lean on a rival, leave). |
| `report` | him | His own men (he is made and answers to you) owe more than $100 | 6 | Cover up to $600, tell him to collect, tell him to be patient. |
| `sponsor` | him | Your associate, you are made, trust >= 0.35, wants to be made or has 3+ career deeds, and `career.recommendable` | 5 | `career.recommend`, not yet, or refuse (`c.want.kind = 'independent'`). |
| `debtor` | him | He owes you and has missed (not your crew) | 5 | Take a payment (`payDebt`), give a week, lean on him. |
| `debtor` | me | See known issues: fires in the wrong direction | 3 | |
| `creditor` | me | Unreachable (see known issues) | 3 | |
| `sponsor` | me | Your associate is recommendable | 2 | `career.recommend`. |
| `biz` | me | Your man, or he has a situation or a hustle | 2 | Short statement from `ledger.statement`; may lead into `trouble`. |
| `ask_work` | me | He is your boss, or he outranks you and is capo or above | 2 | Your boss: `jobs.forceBossOffer` (cooldown `clubwork`); if a new job appears the scene switches to `work`. |
| `heard` | me | Always (2-day bucket) | 1 | Teaches the most recent relevant non-minor fact he knows that you do not. |
| `drink` | me | Always (daily bucket) | 1 | $20, affection +0.04, trust +0.02; may hint at a hidden problem. |
| `chat` | (default) | He has nothing pressing | | Shows the top four `'me'` topics plus "Sit with him a while" (60 minutes, affection +0.01). |

`waiting(w, p, cl, here)` ([club.ts:71](../../src/club.ts)) takes each present man's top `'him'` topic and returns the highest-priority ones, capped by the player's rank (associate 1, soldier 2, capo and above 3), ties broken by `hash(id + 3-hour slot)`.

`greet()` ([club.ts:79](../../src/club.ts)) varies by recency (under 5 hours), grudge, relative rank and respect, and appends and deletes any pending `ClubMem.note`.

**Public API.**

| Export | Signature | Description / side effects |
|---|---|---|
| `Topic` | interface `{ key, sig, label, cue, by: 'him' \| 'me', prio }` | |
| `offerFrom` | `(w, c, p): Job \| undefined` | The offered `via: 'boss'` job from `c` to `p`. Read-only. |
| `topicsFor` | `(w, p, cl, c): Topic[]` | Read-only apart from `statement()` and `recommendable()` reads. |
| `waiting` | `(w, p, cl, here: Here[]): { c, t }[]` | Read-only, no rng. |
| `sceneOf` | `(w): Scene \| null` | Accessor; not used outside this file. |
| `startScene` | `(w, p, id, topic): void` | Creates `w.scene`, caches the greeting, sets `ClubMem.last`. No-op without a club or with a dead NPC. |
| `sceneNode` | `(w, p): { c, lines, opts, ended, log, title } \| null` | Renders the current node. May run once-guarded effects (cash, facts, jobs, rng). Clears `w.scene` if the NPC record or club is missing. |
| `sceneAct` | `(w, p, code): void` | Applies a choice (see lifecycle). May move money, change debts, relationships, disputes, jobs, favours; adds a minor fact on end. |
| `closeScene` | `(w): number` | Clears the scene, returns minutes in [5, 120]. |
| re-exports | `clubOf, clubOpen, clubPresent, weekday` | From clubdata.ts, for the UI. |

**Tick hooks.** None. Player actions only: `cscene` / `cact` / `cend` in [web.ts:415-424](../../src/web.ts); rendering in [ui/clubview.ts](../../src/ui/clubview.ts); [ui/views_a.ts:103](../../src/ui/views_a.ts) shows an "In the middle of a conversation" banner while `w.scene` is set, and uses `waiting` for the attention count.

**Depends on / used by.**
- Imports: `disputes` (`amends`, `callSitdown`, `ignoreDispute`, `mineAgainst`, `againstMe`, `playerActed`: quarrel topic), `core` (`addFact`, `clamp`, `learn`, `money`, `payDebt`, `rel`), `career` (`recommend`, `recommendable`), `clubdata`, `encounters` (`addFavour`, `choose`: enc topic and covered envelopes), `jobs` (`forceBossOffer`, `takeJob`, `declineJob`), `ledger` (`post`, `statement`), `reports.relevance` (what is worth repeating), `situations` (`askAbout`, `helpWith`, `sitOf`), `voice.hash`.
- Imported by: [web.ts](../../src/web.ts) (`closeScene`, `sceneAct`, `startScene`, `topicsFor`), [ui/clubview.ts](../../src/ui/clubview.ts) (`clubOf`, `clubOpen`, `clubPresent`, `sceneNode`, `topicsFor`, `waiting`), [ui/views_a.ts](../../src/ui/views_a.ts) (`waiting`), `tests/v72.test.ts`.

**Invariants and rules.**
- One scene at a time; `web.ts` will not start a second while `w.scene` is set.
- Effects that run on display must go through `once()` so redraws and reloads do not repeat them.
- `Scene.data` values must be strings or numbers so the scene serialises with the world.
- Scene minutes are clamped to 5 to 120 and charged only at close.
- Determinism: presence and `waiting` use hashes; the only rng use is inside called systems (`forceBossOffer`, encounter and situation handlers).

**Save compatibility.** `World.scene` is optional; `undefined` and `null` both mean "no scene". There is no migration. A save with a scene whose club has disappeared is cleaned up on the next `sceneNode`/`sceneAct`. Neither old-save fixture contains a scene.

**Known issues / gaps.**
- **Debt topics reversed or dead** ([club.ts:59-61](../../src/club.ts)). `debtsOf(w, a, b)` returns debts where `a` is creditor and `b` debtor. The `'me'` topic "Bring up what he owes you" uses `debtsOf(w, c.id, p.id)`, i.e. debts the *player* owes *him*; choosing it opens the `debtor` handler, which finds no debt in that direction and says "He owes you nothing." The following line ("Settle what you owe him") requires `debtsOf(w, c.id, p.id)[0] === undefined` and then searches for exactly that debt, so it can never add anything. A player owed money by a man who has not yet missed a payment has no way to raise it here.
- **Hard-coded surname.** One greeting is `"Marino."` regardless of the player's name ([club.ts:87](../../src/club.ts)); "Tony Marino" is only the default name.
- **Money leaving the world.** "Cover it" on `tab` and on `report` deduct `p.cash` and post a ledger `gift` to the man, but no character's cash is credited; the arrears owed to the player (tab) or to the capo (report) are reduced instead. The $20 drink is a pure sink. The $200 quarrel payment moves cash without a ledger entry.
- **Knowledge.** `heard` calls `learn(..., knowsActor = true)` and shows `fact.text`, regardless of whether the speaker himself knows who the actor was (`c.known[f].knowsActor`).
- **Effects on display.** The drink is paid for, and the boss is asked for work, when the node is first drawn rather than when an option is chosen. This is intentional (see `once`) but surprising.
- `ClubMem.said` and `Scene.t` are written and never read. `sceneOf` is unused outside the file. Unused `Debt` type import.
- `sceneNode` checks that the NPC record exists, not that he is alive. If the player leaves mid-scene (the tab bar stays available), the scene persists; if the club then closes, `clubView` shows the shutters before the scene and it cannot be closed until the club reopens. Its minutes are charged whenever it is finally closed.

---

## meetings.ts

**Purpose.** Meetings are short queues of agenda items built from the world as it actually is: real complaints between crew members, real numbers from the books, recent facts, open disputes. Each item offers a few choices whose effects are written back (rulings move money and grudges, the accounts meeting changes arrears, the floor of a family meeting can create a job). The module also generates grievances, runs the made-man induction ceremony, and once a day may create a summons job asking the player to attend a meeting.

**State owned.**
- `World.grievances: Grievance[]` ([types.ts:399](../../src/types.ts), [types.ts:502](../../src/types.ts)). Created by `gatherGrievances` (also by [dialogue.ts:2150](../../src/dialogue.ts) and [dialogue.ts:2203](../../src/dialogue.ts)); `status` and `postponed` updated by `ruleGrievance`; `claim` updated by `lookInto`. Never pruned.
- `World.expect` ([types.ts:506](../../src/types.ts)): set by the crew meeting's "how you want to be told things" item; read by [hustle.ts:69](../../src/hustle.ts) and [reports.ts:18](../../src/reports.ts).
- `World.goals.done['g:expect']`: once-flag so the `expect` item is raised only once (`w.goals` is the UI progress bag, not NPC goals).
- Summons jobs (`Job.kind = 'summons'`, `Job.meeting`, `Job.extra.g`) created by `summonsTick` through `jobs.mkJob`.
- Cooldowns on the player: `p.cooldown.griev` (12 days after any new grievance), `'summons:levy'` (28), `'summons:family'` (21), `'summons:accounts'` (28), `'summons:coffee'` (30), `'summons:request'` (6).
- Writes into other systems: `p.standing`, `p.books.arrears` / `missed`, `p.books.flags[...]` and `boss.books.flags[p.id]`, `boss.memos` (a promise memo), `c.kickRate`, `c.heat`, `c.traits.ambition`, `c.hustle.lull`, `Family.tension`, cash of the parties, relationships, `Job.due` / `status`.
- **Not World state:** the `Meeting` and `Item` objects. The induction stashes its score as an untyped `(m as any).shown`.

### The meeting state machine

```ts
interface Meeting { kind: MeetingKind; title: string; attendees: Id[]; items: Item[]; idx: number; minutes: number; summary: string[]; jobId?: Id }
interface Item { id: string; kind: 'info' | 'earnings' | 'jobs' | 'grievance' | 'proposal' | 'accounts' | 'floor' | 'incident' | 'request' | 'sitdown' | 'induction' | 'concern' | 'expect'; title: string; text: string[]; opts: Opt[]; data: Record<string, any>; done?: boolean }
```
`MeetingKind = 'crew' | 'accounts' | 'family' | 'sitdown' | 'social' | 'induction'` ([types.ts:363](../../src/types.ts)).

Lifecycle:
1. **Open.** An `open*` function checks preconditions and returns either a `Meeting` or a refusal string (the `Meeting | string` convention is used by `web.ts`, `dialogue.ts` and `bot.ts`). Opening consumes `w.rng` and may already change the world (dinner cost, new grievances, refusal facts, heat from an interruption). It ends with `prime()`.
2. **Prime.** `prime()` ([meetings.ts:417](../../src/meetings.ts)) fills the current item's options via `optsFor()` and lazily writes the `earnings` and `jobs` text from the books and active jobs.
3. **Choose.** `choose(w, p, m, code)` ([meetings.ts:523](../../src/meetings.ts)) applies the choice to `current(m)` and returns lines. Investigation codes on a grievance (`q_from`, `q_about`, `look`) keep the item open and refresh its options; every other code calls `finishItem()`, which marks the item done, adds 25 minutes, increments `idx` and primes the next item. Induction meetings go to `inductionChoose`.
4. **Close.** When `current(m)` is undefined the UI shows "Meeting over"; "Leave" or "Leave early" calls `closeMeeting()` ([meetings.ts:796](../../src/meetings.ts)), which returns `{ minutes, lines }`; the UI then calls `pass(minutes)`.

Time: `minutes` starts at 60 (crew, accounts), 90 (sit-down), 120 (family, induction) or 150 (social), plus 25 per settled item and 60 per `look`. The clock is frozen while the meeting runs and advanced by `pass()` at close. There is no cap.

**Persistence.** Unlike a club scene, a meeting is held in UI state only: `S.view = { t: 'meeting', m, lines }` ([ui/state.ts:32](../../src/ui/state.ts)). `save()` serialises only `S.w`, and `continue` / load always reset the view to Today. Consequences:
- A reload mid-meeting loses the meeting. The `mopt` handler ([web.ts:731](../../src/web.ts)) does not save, so the world changes made by choices since the last save are also lost; the reload rolls back to the state saved before the meeting (or, for a sit-down opened from a conversation, the save taken when it opened, [web.ts:685-688](../../src/web.ts)).
- A summons job is not marked done when the meeting opens (except a sit-down, [web.ts:727](../../src/web.ts)), so after a reload it can be attended again and a new meeting is generated from the current RNG state.
- The tab bar is rendered on the meeting view, and switching tabs abandons the meeting without `closeMeeting`: no minutes are charged, the summons stays open, the induction walk-out penalty is skipped and the end-of-meeting knowledge sharing does not happen. Choices already made stay in memory and are saved by the next action.

A replacement that wants meetings to survive a reload would need a `World` field, a serialisable item model (no closures; the current model is already plain data apart from `any` in `data`) and a migration default.

### Openers

| Function | Preconditions (refusal string otherwise) | Items | rng / side effects at open |
|---|---|---|---|
| `openCrewMeeting(w, p, focus?: Grievance)` | Has subordinates (`books.subordinates`); at least half available (alive, not jailed or hurt, awake) | `earnings`; up to 2 `grievance` (one existing open + `gatherGrievances`, or `focus`); `jobs` if attendees have active jobs; `proposal` (55% if anyone has ambition > 0.4: boost / burgle / scam a shop not under the player's family); up to 2 `concern` (rival interference from an open dispute, struggling, earner wanting room, heat); `expect` once | rng throughout; may create grievances; `maybeInterrupt` (12% when 3+ items) truncates the agenda and adds +0.04 heat to everyone present |
| `openAccountsMeeting(w, p, job)` | `job.giver` alive and available | One `accounts` item; `amt = max(job.extra.amt, p.books.arrears)`, `kind = job.extra.kind ?? 'short'` | none |
| `openFamilyMeeting(w, p, job?)` | Player in a family with a living boss | `info` (up to 4 recent facts of kinds levy, arrest, promotion, murder, poach, protection_started, beating, discipline involving the family; tension lines for tension >= 3; the levy); `floor` | Player learns every listed fact from the boss |
| `openSitdown(w, p, g)` | Both parties alive and available; if either is outside the player's family, an acceptance roll `clamp(0.3 + influence/100*0.6 + respect*0.3 - ambition*0.2, 0.1, 0.95)` | One `sitdown` item; 1 to 2 made men of the player's family as witnesses | rng; refusal costs respect and adds a minor `sitdown` fact |
| `openGathering(w, p, guestIds, what = 'dinner' \| 'celebration')` | At least 2 available guests; cash for $70 a head (dinner) | `info` (the evening, with gossip lines); `incident` (60% if two guests have grudge >= 0.3); `request` (50% if a guest with trust > 0.3 has under $200) | Cost deducted; pairwise trust and affection +0.03 and `lastMet`; 50% pairwise `actions.share`; 15% `jobs.tipFrom` per guest |
| `openInduction(w, p, job)` | Boss and sponsor (`career.sponsorOf`, else the boss) alive; both available unless `to === 'boss'` | Scripted `induction` items: 5 for soldier, 4 for capo, underboss and boss; up to 4 capos/underbosses as witnesses | none |

### Choices

| Item kind | Codes | Effects |
|---|---|---|
| `info` | `ok` | Advances. |
| `earnings` | `praise`, `press:<id>`, `warn`, `next` | Praise: top earner trust/affection up, ambitious others gain grudge against him. Press: `books.rule(..., 'demand')`, respect -0.03. Warn: everyone's trust -0.01. |
| `jobs` | `hurry`, `next` | Pulls attendees' job due dates forward a day (not before now + 60 minutes), trust -0.01 each. |
| `grievance` / `sitdown` | `q_from`, `q_about`, `look`, `r_from`, `r_about`, `r_split`, `r_post`, `r_dismiss` | See rulings below. Sit-downs offer no `look` or `r_post`. |
| `proposal` | `approve`, `wait`, `refuse` | Approve creates an active `via: 'scheme'` job for the man (`orders` set by his violence, due in 1 to 3 days); it is resolved later by `orders.runCrewJob`. |
| `accounts` | `pay`, `promise`, `deny`, `blame:<id>`, `time` | Pay moves `amt` to the boss and clears arrears; promise sets arrears and pushes a promise memo on the boss (due in 7 days); deny or blame succeed on a roll against the boss's caution, failure doubles arrears or adds them and costs trust and standing. Always adds a minor `discipline` fact. |
| `floor` | `quiet`, `support`, `concern:<id>`, `propose:<factId>` | Support: boss trust/respect up. Concern: on an influence roll, `books.react` disciplines the man and he gains a grudge. Propose (a known wrong by another family against yours): on a roll, creates a `handle` job from the boss, $400, standing +2. |
| `concern` | by type: `lend`/`ease`/`no`; `trust`/`hold`; `lie`/`carry`; `back`/`handle`/`wait` | Struggling: $200 and a favour, or `kickRate -0.05`. Earner: `kickRate -0.03`, others' ambition +0.01. Heat: heat -0.25 and `hustle.lull` 7 days. Rival: `disputes.callSitdown`, or let him handle it (`dispute.next = now + DAY`). |
| `expect` | `strict`, `balanced`, `loose`, `next` | Writes `w.expect`; sets `g:expect`. |
| `incident` | `step_in`, `ignore` | Influence roll halves their grudges (standing +1) or fails; ignoring adds grudges and a minor `gathering` fact. |
| `request` | `lend`, `no` | Lend $300 and `createDebt` at 5% a week. |

Rulings (`ruleGrievance`, [meetings.ts:134](../../src/meetings.ts)); `g.valid` is the hidden truth:
- `r_from` (for the complainant): status `ruled`; the accused pays the claim up to his cash; standing +1 if valid, otherwise -2 and grudges against the complainant and the player. Cross-family: tension +1 when the claim is false. Adds a `ruling` fact.
- `r_about` (for the accused): mirror image; adds a `ruling` fact; no tension change.
- `r_split`: half the claim; both trusts -0.02; mutual grudges halved; cross-family tension -1 and `orgs.noteDeal`.
- `r_post`: `postponed++`; on the second postponement the complainant's grudge rises ("may take it into his own hands"). Status stays `open`.
- `r_dismiss`: status `dropped`; complainant trust -0.1, grudge +0.15.
- Any `ruled` outcome calls `disputes.settleDispute` for the same pair.
- Witnesses (sit-downs): respect +0.05 for a fair ruling (`r_from` when valid, `r_about` when false, `r_split`), -0.03 for a dismissal, -0.05 otherwise, and each learns the player's most recent `ruling` fact.
- Investigation: `q_from` gives a reading that is right with probability `0.6 + caution*0.2` (clamped 0.6 to 0.85); `q_about` may produce an admission (`0.2 + trust*0.4` when valid); `look` is right 85% of the time and recomputes a skim claim from the books (+60 minutes).

`gatherGrievances(w, members, max = 2)` ([meetings.ts:62](../../src/meetings.ts)) draws, in random order: (1) a wrong done to a member by another member, which he knows about with the actor (`k.knowsActor`), within 45 days; (2) a missed debt between members; (3) envy or grudge (30% chance each), which becomes a `skim` claim (valid only if the books show more than $40 concealed) or a `respect` claim (valid on a coin flip). Duplicates are suppressed if the same pair has an open grievance or one created in the last 60 days, or the same cause fact.

`closeMeeting` ([meetings.ts:796](../../src/meetings.ts)): an induction left with `jobId` still set counts as walking out (`career.turnedDown`, job `declined`); any other `jobId` job becomes `done`; crew and social meetings run `actions.share` both ways with every attendee (trust +0.02, `lastMet`); it reports the number of unresolved items and adds a minor `gathering` fact witnessed by the attendees.

`summonsTick(w)` ([meetings.ts:827](../../src/meetings.ts)): returns at once if any summons is already offered. Otherwise, in order, the first that fires creates one summons and returns: a family meeting while the family's levy still has more than 27 days to run, i.e. just after it starts (cooldown 28 days); a family meeting at 1/40 a day (21); an accounts meeting at 1/45 a day if the player has any books history (28); a "coffee" or rival-complaint meeting at 1/60 a day (30, opens a family meeting); and at 8% a day (6), if the player has men, a sit-down summons from a crew member over a new or twice-postponed grievance. Ignored summons are penalised by `jobs.daily` ([jobs.ts:825-838](../../src/jobs.ts)).

The induction (`openInduction` [meetings.ts:870](../../src/meetings.ts), `inductionChoose` [meetings.ts:909](../../src/meetings.ts)): `to` comes from `job.extra.to` (default `soldier`). Each answer adds to `shown` (`sure` +2, `humble` +1, others 0). `out` (hesitate, turn it down, drop the card) calls `career.turnedDown`, declines the job and empties the agenda. Finishing the last item calls `career.inductPlayer(w, p, to, shown)`, or for `to === 'boss'` adds `shown` to standing and records the career line; the job becomes `done` and `jobId` is cleared.

**Public API.**

| Export | Signature | Notes |
|---|---|---|
| `Opt`, `Item`, `Meeting` | interfaces | `Meeting` is imported as a type by [ui/state.ts](../../src/ui/state.ts) and [dialogue.ts](../../src/dialogue.ts). |
| `available` | `(w, c): boolean` | Alive, not jailed, not hurt, awake (`core.isAwake`). Also used by [ui/views_b.ts](../../src/ui/views_b.ts). |
| `current` | `(m): Item \| undefined` | `m.items[m.idx]`. |
| `gatherGrievances` | `(w, members, max = 2): Grievance[]` | Pushes to `w.grievances`, sets `p.cooldown.griev`; rng. `max` is clamped to 1. |
| `openCrewMeeting` | `(w, p, focus?): Meeting \| string` | See table. |
| `openAccountsMeeting` | `(w, p, job): Meeting \| string` | |
| `openFamilyMeeting` | `(w, p, job?): Meeting \| string` | Teaches facts. |
| `openSitdown` | `(w, p, g): Meeting \| string` | |
| `openGathering` | `(w, p, guestIds, what?): Meeting \| string` | Deducts cost. |
| `choose` | `(w, p, m, code): string[]` | Mutates the meeting and the world. |
| `closeMeeting` | `(w, p, m): { minutes, lines }` | Job status, knowledge sharing, fact. |
| `summonsTick` | `(w): void` | Daily; rng; creates jobs. |
| `openInduction` | `(w, p, job): Meeting \| string` | |
| `inductionChoose` | `(w, p, m, code, job?): string[]` | Called through `choose`. |

Internal helpers worth knowing: `pickN` (rng sample), `noisy` (rng-noisy truth), `mkItem` (uses a module-level counter `nextItem`), `grievanceItem`, `grievanceOpts`, `ruleGrievance`, `tension`, `lookInto`, `maybeInterrupt`, `prime`, `optsFor`, `finishItem`.

**Tick hooks.** `summonsTick` from the daily event ([engine.ts:55](../../src/engine.ts)). Everything else runs on player actions: [web.ts](../../src/web.ts) `meet` (699, crew or family; if the men are asleep it advances the clock to 14:00 and retries), `ghost` (722, dinner), `attend` (723, opens the meeting a summons names), `mopt` (731), `mdone` (738); [dialogue.ts](../../src/dialogue.ts) opens sit-downs from the `sitdown` and `suspect` conversation branches and returns them as `Res.meeting`; [bot.ts](../../src/bot.ts) drives meetings automatically for the stress harness.

**Depends on / used by.**
- Imports: `orgs.noteDeal` (record a cross-family settlement), `career` (`inductPlayer`, `sponsorOf`, `turnedDown`), `books` (`effectiveRate`, `influence`, `react`, `rule`, `subordinates`; `RULINGS` imported but unused), `core` (`addFact`, `clamp`, `recordCareer`, `createDebt`, `famName`, `isAwake`, `learn`, `money`, `rel`, `shortTime`), `jobs` (`mkJob`, `tipFrom`, `traitWords`), `actions.share` (gossip at dinners and meetings), `hustle.HUSTLES` (labels), `disputes` (`callSitdown`, `settleDispute`), `encounters.addFavour`.
- Imported by: [engine.ts](../../src/engine.ts) (`summonsTick`), [web.ts](../../src/web.ts), [dialogue.ts](../../src/dialogue.ts) (`openSitdown`, `Meeting`), [bot.ts](../../src/bot.ts), [ui/state.ts](../../src/ui/state.ts) (type), [ui/views_b.ts](../../src/ui/views_b.ts) (`available`, `current`), tests `v76`, `v78`, `v76_trace_probe`.
- Other creators of summons the meeting code must handle: [career.ts:390](../../src/career.ts) and [path.ts:324](../../src/path.ts) (induction, with `extra.to`), [books.ts:369](../../src/books.ts) (accounts, with `extra.amt` and `extra.kind`).

**Invariants and rules.**
- At most one offered summons at a time.
- At most one new grievance per `gatherGrievances` call, then a 12-day pause; no duplicate open grievance for the same pair or cause. `consistency.audit` flags open grievances between dead men.
- A ruling on a pair also settles their open dispute (one matter, one outcome).
- Payments in rulings are capped at the payer's cash; lending options check the player's cash; the accounts "pay" option is only offered when cash covers it.
- `gatherGrievances` respects knowledge: a member only complains about a wrong whose actor he knows.
- Determinism: all randomness through `w.rng`; the order of `Object.values(w.chars)` and the `sort(() => w.rng.next() - 0.5)` used for sit-down witnesses are deterministic for a given engine.

**Save compatibility.** No saved meeting state. `w.grievances` is a required array, guaranteed by `ensureShape`. `w.expect` and `w.goals` are optional with defaults supplied where read. Summons use optional `Job.meeting` and `Job.extra`. No migrations.

**Known issues / gaps.**
- **Meetings are not persisted and can be abandoned** (see Persistence above).
- **Knowledge leak in family meetings** ([meetings.ts:328-337](../../src/meetings.ts)). The news is drawn from all facts, not from what the boss knows, the full `f.text` is shown (not `textHidden`) and the player learns each fact with `knowsActor = true`. Facts with hidden actors (for example a beating or murder) reveal their actor.
- **Witnesses learn the wrong ruling.** Only `r_from` and `r_about` add a `ruling` fact; after `r_split` or `r_dismiss` the witnesses "learn" whatever ruling the player made most recently, which may be an unrelated case, or nothing.
- **Accounts summons from `summonsTick` has no `extra`** ([meetings.ts:849](../../src/meetings.ts)), so the meeting is always the "short" accusation with `amt = p.books.arrears`, which can be $0 ("About $0 is missing from your end"), even when the brief says it may be good news.
- The "coffee at the club" summons opens a full family meeting.
- `gatherGrievances` ignores its `max` argument above 1. `ruleGrievance`'s `mediated` parameter is unused. `optsFor('info')` replaces the item's own option labels ("Listen", "Carry on") with "Go on".
- The module-level `nextItem` counter is process-global, so item ids differ between sessions. Harmless today because ids are neither saved nor looked up, but it is the one non-world mutable global here.
- Money moved without ledger records: the accounts payment, the $200 concern loan, ruling payments; the dinner cost is a sink.
- `r_about` in a cross-family case never changes tension, unlike `r_from` and `r_split`.
- `w.grievances` grows without pruning (slowly, because of the 12-day cooldown).

---

## life.ts

**Purpose.** The part of the player's life that is not the job: a mother who wants Sundays, a sibling, a partner, children. It creates the initial kin at world creation, decays warmth when the player stays away, raises encounters (Sunday dinner, illness, partner trouble, a proposal moment, introductions, a birth, a christening), resolves the player's answers to them, and offers direct actions (visit, dates, asking someone out, going steady, proposing, the wedding, trying for a child, breaking it off). Nothing here is a score; it competes with work for the player's time and money.

**State owned.**
- `World.life?: Life` ([types.ts:642](../../src/types.ts), [types.ts:520](../../src/types.ts)): `kin: Kin[]`, `partner?: Partner`, `pool?: { t, list: { id, where, job }[] }` (this week's dating pool cache), `met: Id[]`, `lastSunday: number`, `ex?: Id`.
- `Kin` ([types.ts:623](../../src/types.ts)): `id`, `role` (mother, father, sister, brother, son, daughter), `warmth` 0..1, `lastSeen`, `sick?`.
- `Partner` ([types.ts:630](../../src/types.ts)): `id`, `stage` (seeing, steady, engaged, married, split), `warmth`, `dates`, `since`, `lastSeen`, `note?`, `due?`, `tried?`, `asked?`.
- Characters: kin, introduced women, dating-pool fillers and children are created as civilians in `w.chars` through `world.spawnCivilian`.
- `World.events`: a `christening` `LifeEvent` for the player's child ([life.ts:422](../../src/life.ts)); `christeningDue` pushes the marker string `'asked'` into `LifeEvent.invited` (used as a flag bag) and the answer sets `done`.
- Encounters via `encounters.addEnc`: `kind: 'kin'` (`data.what`: `sunday`, `ill`, `birth`, `christening` with `data.ev`), `kind: 'partner'` (`data.pr`: 1 trouble, 2 proposal), `kind: 'meet'` (`data.g`).
- Generic bags on the player: `p.intro[g.id]` (asking out counts as an introduction), `p.cooldown['askout:<id>']` (20 days after a refusal).
- Also writes `p.cash`, `p.standing`, `p.heat`, relationships, and adds facts (`event` for the wedding, birth, mother's death).

**Public API.**

| Export | Signature | Description / side effects |
|---|---|---|
| `lifeInit` | `(w, p): void` | Spawns a mother and a sibling with the player's surname, sets mutual trust 0.7 / affection 0.8, creates `w.life`. Uses rng and `pick`. |
| `warmthWord` | `(v: number): string` | devoted / close / friendly / cooling / distant. |
| `kinWord` | `(k: Kin): string` | "Your mother" etc. |
| `kinOf` | `(w, id): Kin \| undefined` | |
| `isPartner` | `(w, id): boolean` | Current partner who has not split. |
| `stageWord` | `Record<Partner['stage'], string>` | Display words. |
| `lifeDaily` | `(w): void` | Daily: see below. rng. |
| `lifeChoose` | `(w, p, e: Enc, code): { lines, minutes }` | Resolves `meet`, `partner` and `kin` encounters. Moves cash (some without checks), warmth, standing, respect; may kill the mother; teaches a fact. |
| `seePartner` | `(w, p): string[]` | $60 evening; warmth +0.07 (+0.03 if heat > 0.45); heat -0.05. Used by the `date` action. |
| `visitKin` | `(w, p, k): string[]` | warmth +0.06, `lastSeen`. |
| `isFemale` | `(c): boolean` | First name in `world.FEMALE`. |
| `jobOf` | `(c): string` | Hash-picked occupation for display. |
| `datingPool` | `(w, p): NonNullable<Life['pool']>` | Returns the cached pool if under 7 days old; otherwise picks up to 3 single female civilians (2 from the player's district first) and spawns new civilians to fill gaps. rng. |
| `askOut` | `(w, p, g): { lines, minutes, ok }` | $20; chance `clamp(0.3 + standing/300 + sociability*0.1 + charm*0.25 + (cash > 800 ? 0.07 : 0) - (heat > 0.5 ? 0.1 : 0) + (trust > 0.3 ? 0.1 : 0), 0.15, 0.85)`. Success makes her a `seeing` partner; refusal sets a 20-day cooldown and removes her from the pool. |
| `DatePlan`, `DATES` | interface, const | walk $15 (+0.04), dinner $90 (+0.08), dance $50 (+0.07), big $300 (+0.13). |
| `datePlan` | `(w, p, code): string[]` | Pays the cost; only a walk is allowed within a day of the last date; warmth gain halved under heat. |
| `askSteady` | `(w, p): { lines, ok }` | Needs `seeing`, 3+ dates, warmth >= 0.5; succeeds with `clamp(warmth + 0.1, 0.4, 0.95)`. |
| `askMarry` | `(w, p): { lines, ok }` | Needs `steady`, 8+ dates, warmth >= 0.7, $400; sets `engaged`, standing +1. |
| `wedding` | `(w, p): string[]` | Needs `engaged` and $1,500; `married`, standing +3, respect +0.03 for up to 12 family members with trust > 0.25, and an `event` fact broadcast to them. |
| `tryForBaby` | `(w, p): string[]` | Needs `married`, no pregnancy, 20 days since the last try, warmth >= 0.4; chance `clamp(0.2 + warmth*0.25, 0.2, 0.45)`; sets `due = now + 270 days`. |
| `christeningDue` | `(w, p): void` | For each of the player's undone christenings within 3 days, raises one `kin` encounter (grand $900 / modest $250 / just the priest). |
| `breakOff` | `(w, p): string[]` | Ends a relationship short of marriage (`split`, `ex`). |

Internal: `introduce` (a family friend with trust > 0.3 sets the player up; spawns the woman), `partnerTrouble`, `proposal`, `sunday`, `birth` (spawns the child as a civilian with `kin` entry, warmth +0.1, standing +1, a non-minor `event` fact, a christening event 30 days later and a `birth` encounter), `learnIntro`.

`lifeDaily` ([life.ts:45](../../src/life.ts)), in order:
- Kin unseen for more than 10 days lose 0.006 warmth a day.
- Partner unseen for more than 6 days loses 0.012 a day; below 0.3 warmth, 20% a day of a trouble encounter; birth when `due` has passed; a proposal encounter at 30% a day once `steady` with 14+ dates and warmth > 0.75.
- Single (or split): after day 25, 2.5% a day of an introduction.
- Every 14+ days, a Sunday dinner encounter from `kin[0]`.
- After day 40, 0.4% a day that `kin[0]` falls ill (a `kin` encounter), once only while `Kin.sick` is set.
Trouble and proposal encounters are not raised while another `partner` encounter is open, introductions not while a `meet` encounter is open, and Sunday dinners not while a `kin` encounter is open. Illness, birth and christening encounters are not gated on open encounters.

**Tick hooks.** `lifeDaily` and `christeningDue` from the daily event ([engine.ts:66-67](../../src/engine.ts)). `lifeInit` from `createWorld` ([world.ts:281](../../src/world.ts)). `lifeChoose` from `encounters.choose` when the player answers a `meet`, `partner` or `kin` encounter ([encounters.ts:538](../../src/encounters.ts)). The rest are player actions in [web.ts:550-560](../../src/web.ts) (`date`, `dateplan`, `askout`, `steady`, `marryask`, `wed`, `baby`, `breakoff`, `visit`) and `lsub:love` ([web.ts:411](../../src/web.ts)), plus render calls in [ui/views_a.ts](../../src/ui/views_a.ts) and [ui/views_b.ts](../../src/ui/views_b.ts) (`datingPool` is called while rendering the love view, [ui/views_b.ts:756](../../src/ui/views_b.ts)).

**Depends on / used by.**
- Imports: `core` (`addFact`, `clamp`, `learn`, `rel`; `money` imported but unused), `encounters.addEnc`, `world` (`FEMALE`, `spawnCivilian`), `voice.pick` (`arch` imported but unused), `types`.
- Imported by: [engine.ts](../../src/engine.ts), [world.ts](../../src/world.ts), [encounters.ts](../../src/encounters.ts) (import placed at the bottom of the file, line 979), [web.ts](../../src/web.ts), [ui/views_a.ts](../../src/ui/views_a.ts), [ui/views_b.ts](../../src/ui/views_b.ts).
- Direct readers of `w.life` elsewhere: `dialogue.introduced` ([dialogue.ts:114](../../src/dialogue.ts), kin and partner count as people you know) and the weekly snapshot's child count ([engine.ts:96](../../src/engine.ts)). `w.events` is shared with `encounters.eventTick` (NPC weddings, christenings, funerals) and [ui/brief.ts](../../src/ui/brief.ts).
- Circular imports: life ↔ encounters, life ↔ world.

**Invariants and rules.**
- Warmth values are clamped to 0..1.
- `kin[0]` is treated as the mother (Sunday dinners, illness); `lifeInit` guarantees that order.
- Text variation uses `voice.pick(list, seed)` (hash-based), so it does not consume rng; probabilistic outcomes use `w.rng`.
- The recurring encounters (Sunday, partner trouble, proposal, introduction) are de-duplicated against open encounters of the same kind; the one-off ones (illness, birth, christening) are not.

**Save compatibility.** `World.life` is optional and is created only by `lifeInit` at world creation. There is no `ensure*` or migration: a save without `life` simply has no private life (`lifeDaily` returns, the UI says "Nothing here yet"). Both old-save fixtures contain `life`. Optional `Partner` fields (`note`, `due`, `tried`, `asked`) and `Life.pool` / `ex` default to absent. `Kin.sick` is deleted on recovery.

**Known issues / gaps.**
- **Hard-coded text.** The partner-trouble lines include "I made dinner, Tony." whatever the player's name ([life.ts:107](../../src/life.ts)); the illness encounter always says "Your sister calls you" and "Ma", even when the sibling is a brother ([life.ts:73](../../src/life.ts)).
- **Contraction artefacts** of the same kind as the loan grammar bug listed in CLAUDE.md: "whatever it’s you do" ([life.ts:106](../../src/life.ts)) and "who you’re on the nights" ([life.ts:109](../../src/life.ts)).
- **Cash can go negative.** `lifeChoose` deducts $70 (accepting an introduction), $400 (proposing from the encounter), $800 and $300 (illness) without checking cash. `askMarry` and the christening do check.
- **Knowledge leak.** The Sunday dinner gossip picks any non-minor fact in the mother's district that the player does not know, without checking that the mother knows it, shows `f.text` and teaches it with `knowsActor = true` ([life.ts:243-246](../../src/life.ts)).
- **Ignored encounters cost nothing on lapse.** `encounters.lapse` has no branch for `kin`, `partner` or `meet`. An ignored illness leaves `Kin.sick` set permanently (so it never recurs and the mother never dies of it); an ignored christening leaves its `LifeEvent` undone. This mirrors the CLAUDE.md note that ignored promises are penalised less than failed ones.
- **Inert, ever-growing civilians.** Introductions, dating-pool fillers and children are permanent `w.chars` entries and are never scheduled to `think`. Each introduction spawns a new woman whether or not the player accepts.
- **Render-time mutation.** `datingPool` runs while rendering the love view; when the cache has expired it consumes rng and spawns characters during a render, after `pass()` has already saved.
- `lifeChoose` for `meet` overwrites `L.partner` without splitting an existing partner (the introduction stays open for 8 days, during which the player may have asked someone out).
- The mother's death on refusing the illness encounter sets `alive = false` and `diedAt` directly instead of calling `core.handleDeath`.
- Dead fields and conditions: `Life.met` is never written, so the name filter in `introduce` does nothing; `Partner.note` is written ("knows") and never read; `Partner.asked` is never used; the condition `w.now - (ex's diedAt ?? 0) > 0` in `lifeDaily` is always true.
- **Integration gap.** Kin warmth and partner stage change little else in the world: standing and respect bumps at engagement, wedding, birth and christening, the "introduced" check and the briefing's child count. The proposal hint ("It changes how people see you, and what they can do to you") has no downstream reader; no threat, leverage or NPC behaviour uses the player's family.

---

## orders.ts

**Purpose.** The player's men are not function calls. When a man is sent on a job (by an explicit order, a delegated boss job or an approved scheme), `runCrewJob` decides how he actually behaves (clean, bungle, skim, gamble, unavailable, distracted, confront, mercy) and records the story he tells, which may be a lie that `questionReport` can expose. The module also resolves the non-violent errands (watch, deliver, message, guard, find, shake, fix) for whoever does them, builds the order menu, generates the errands a boss hands out, recruits prospects into a crew (used by the player and by NPC goals), and runs the player's day jobs.

**State owned.**
- `Job.rep?: Report` ([types.ts:347](../../src/types.ts), [types.ts:391](../../src/types.ts)): `{ text, truth: Behaviour, lie, found?, amt?, by }`. Written by `runCrewJob`; `found` set by `questionReport`. Read by [ui/views_a.ts:61](../../src/ui/views_a.ts) and [ui/views_b.ts:263](../../src/ui/views_b.ts).
- `Character.job?: DayJob` ([types.ts:140](../../src/types.ts), [types.ts:355](../../src/types.ts)): `{ kind, biz?, boss, since, noticed, shifts }`. Created by `takeDayJob`, removed by `quitDayJob` or when the employer dies, updated by `workShift`.
- `Character.prospect` ([types.ts:144](../../src/types.ts)): set at world generation ([world.ts:237](../../src/world.ts)), cleared by `recruitProspect`.
- `Character.backer` ([types.ts:129](../../src/types.ts)): set by `workShift` once the employer has noticed the player (also set by flows, encounters and crewlife).
- Crew-job fields: `Job.status` on failure paths, `Job.due` (postponed while the man is jailed or hurt; set by `giveOrder`), `Job.orders`; jobs created by `orderMenu` options and `bossErrand`.
- Writes into other systems: `p.cash` / `m.cash` (cuts, skims, fencing), `m.cars` / `m.goods` reset to 0, `Venture.stock` (stolen cars to the player's chop shop), `p.books.gross.odd` and `p.weekIncome` (shift pay), `Business.damaged` / `guardedUntil` (guard), `t.cooldown.suspects` (a watched man who noticed), `doer.district` (watch, message), `t.jailedUntil` (fix), `Problem.revealed`, relationships, skills (`people.grow`), career records.

**Public API.**

| Export | Signature | Description / side effects |
|---|---|---|
| `reliability` | `(w, m): number` | `clamp(0.5 + trust*0.3 + (1 - vice)*0.15 + caution*0.1 - problem.sev*0.35, 0.15, 0.95)`, trust towards the player. Read-only; shown in the crew list. |
| `behaviour` | `(w, j, m): Behaviour` | Weighted rng draw: clean `1.4*reliability`; bungle `(1 - aptitude)*0.3`; skim and gamble (money jobs only) from greed, vice and a gambling/debt/house problem, reduced by trust; unavailable 0.07; distracted from problem severity; confront (collect/lean/handle/shake) from violence, halved under quiet orders; mercy (collect/shake) from low violence and affection for the target. |
| `runCrewJob` | `(w, j): void` | Resolves a delegated job. Dead man: failed. Jailed or hurt: `due` postponed. Otherwise picks an approach (hard orders take the last, otherwise the first; violent or cautious men may override; with no orders, aptitude picks), applies the behaviour, calls `jobs.resolve` on the success paths (which pays through `jobs.paid` and sets the status via `conclude`), takes the man's cut back out of the player's cash when he skims or gambles, beats a civilian target on `confront` (`actions.perform`), fences cars ($550 each, or stock to the player's chop shop) and goods (40%), stores `j.rep`, adds a minor `report` fact witnessed by the player, trust +0.01 for an honest report. rng. |
| `questionReport` | `(w, j): string[]` | Honest report: marked `found`. Lie: exposed with `clamp(0.2 + trust*0.3 + respect*0.2 + caution*0.1, 0.1, 0.9)`; exposure costs trust 0.03, may reveal his problem and the amount lost. rng. |
| `ErrandResult` | interface `{ lines, minutes, ok, money? }` | |
| `resolveErrand` | `(w, j, doer, code): ErrandResult \| undefined` | Called by `jobs.resolve` for `ERRAND_KINDS`. `watch` (caught: grudge, `suspects` cooldown; otherwise reports contacts, problem, business takings, reveals his problem and one hidden fact he is the actor of); `deliver` and `message` (return `j.pay`); `guard` (clears damage, `guardedUntil` 7 days); `find`; `shake` (style soft/firm/hard, `econ.takeFromBiz` and `clearArrears` on success); `fix` (jail reduced to 2 days on success). Returns `undefined` for other kinds. rng. |
| `ERRAND_KINDS` | `JobKind[]` | `watch, deliver, message, guard, find, shake, fix`. |
| `OrderOpt` | interface `{ group, label, hint?, make(doer): Job }` | `make` creates an offered `via: 'order'` job. |
| `orderMenu` | `(w, p): OrderOpt[]` | Options: collect from missed debtors (3), shake late protection payers you collect from (3), lean on unprotected or rival-protected shops (3, nearest first), boost cars, burgle (3), scam (4), watch (up to 4: men you hold a grudge against or rival soldiers), get a jailed family member out ($400), guard your own shops (2). Read-only until `make` is called. |
| `giveOrder` | `(w, p, m, o, style: 'quiet' \| 'hard'): Job \| string` | Refuses if the man is busy (`jobs.activityOf`); creates the job, `jobs.assign` makes it active, then `due` is reset to 1 to 2 days. On an assignment error the new job is removed again. |
| `Prospect` | interface `{ c, note, vouch }` | |
| `prospects` | `(w, p): Prospect[]` | Living civilian prospects who own no business, the player's district first, top 6. |
| `RECRUIT_COST` | `150` | |
| `recruitProspect` | `(w, p, c): string[]` | The recruiter (player or NPC) pays $150 to the recruit, who becomes an associate under him (`rank.applyRank` with `familyId`/`bossId`), trust 0.45, a minor `promotion` fact, recruiter standing +0.5. |
| `DayJobOpt` | interface | `kind: 'bartender' \| 'driver' \| 'doorman' \| 'runner'`. |
| `dayJobOptions` | `(w, p): DayJobOpt[]` | Bar and casino work at the family's protected bars/casinos (2), driving for capos/underbosses with trust >= 0.3 (2), driving for the boss at trust >= 0.45. |
| `takeDayJob` | `(w, p, o): void` | Sets `p.job`. |
| `quitDayJob` | `(p): void` | Deletes `p.job`. |
| `workShift` | `(w, p): { minutes, lines }` | 360 minutes; pays $90 to $150 (+$30 driving for the boss) into cash, `books.gross.odd` and `weekIncome`; `noticed` +0.07 or +0.02; trust/respect up on a good shift; moves the player; 45% to overhear a fact the employer knows (respecting his `knowsActor`); when `noticed >= 0.6`, every fourth shift, a made employer becomes the player's `backer` (standing +3). rng. |
| `bossErrand` | `(w, p, boss): boolean` | Creates one boss job at random among deliver ($60), message ($40), find, watch, guard and fix; returns false when the chosen kind has no valid target. Voiced by the boss's archetype. rng. |

Internal: `MONEY_KINDS`, `story()` (the man's account in his own voice, honest or a lie, via `voice.excuse` / `admit`), `money$` (local formatter), `orderJob()`, `PAY`.

**Tick hooks.**
- `runCrewJob`: daily, through `jobs.daily` → `autoResolve` for every active job with `due <= now` not assigned to the player ([jobs.ts:772](../../src/jobs.ts), [jobs.ts:843](../../src/jobs.ts)).
- `bossErrand`: through `jobs.bossOffer` ([jobs.ts:204](../../src/jobs.ts)), which runs from `jobs.newOffer` in `jobs.daily`, from `forceBossOffer` (club "ask for work", [club.ts:239](../../src/club.ts)) and from the `bossjob` move in `jobs.performMove` ([jobs.ts:1063](../../src/jobs.ts)).
- `resolveErrand`: inside `jobs.resolve` ([jobs.ts:505](../../src/jobs.ts)), both for jobs the player runs himself and for crew jobs via `runCrewJob`.
- `recruitProspect`: weekly via `goals.agencyWeek` for NPC recruiters ([goals.ts:480](../../src/goals.ts)), from the player's recruit conversation ([flows.ts:304](../../src/flows.ts)), the "wants to run with you" encounter ([goals.ts:738](../../src/goals.ts)) and the `hire` action ([web.ts:572](../../src/web.ts)).
- `prospects`: `ambition.ambProgress` ([ambition.ts:133](../../src/ambition.ts)) and the recruit view.
- Player actions: `giveOrder` ([web.ts:656](../../src/web.ts)), `questionReport` (`qrep`, [web.ts:795](../../src/web.ts)), `workShift` / `takeDayJob` / `quitDayJob` (`shift`, `takejob`, `quitjob`, [web.ts:566-571](../../src/web.ts)). `orderMenu` from [ui/views_b.ts](../../src/ui/views_b.ts), [ui/views_c.ts](../../src/ui/views_c.ts), `web.ts` and `stress.ts`; `dayJobOptions` and `reliability` from `ui/views_b.ts`.

**Depends on / used by.**
- Imports: `rank.applyRank` (recruitment), `core` (`addFact`, `clamp`, `learn`, `money`, `ownerBiz`, `recordCareer`, `rel`, `shortTime`, `travelTime`; `witnessesAt` unused), `people` (`aptitude`, `grow`, `lateOf`, `PROBLEM_LABEL`), `econ` (`clearArrears`, `owedOf`, `takeFromBiz`: shakedowns), `voice` (`arch`, `admit`, `excuse`, `pick`), `jobs` (`activityOf`, `approaches`, `assign`, `mkJob`, `resolve`), `actions.perform` (a confrontation becomes a beating), `types`.
- Imported by: [jobs.ts](../../src/jobs.ts) (`ERRAND_KINDS`, `bossErrand`, `resolveErrand`, `runCrewJob`: a direct import cycle), [goals.ts](../../src/goals.ts), [flows.ts](../../src/flows.ts), [ambition.ts](../../src/ambition.ts), [stress.ts](../../src/stress.ts), [web.ts](../../src/web.ts), [ui/views_b.ts](../../src/ui/views_b.ts), [ui/views_c.ts](../../src/ui/views_c.ts), [ui/state.ts](../../src/ui/state.ts) (types), `tests/v72.test.ts`.

**Invariants and rules.**
- A man never has two active non-summons jobs (`activityOf` / `assign`; checked by `consistency.audit`).
- Reports are generated at resolution and never rewritten; `found` only moves from unset to true.
- The man's cut taken back from the player is capped at the player's cash.
- `workShift` respects knowledge: it passes the employer's own `knowsActor` to `learn`.
- All randomness through `w.rng`; story text through hash-based `pick`.

**Save compatibility.** `Job.rep`, `Character.job`, `Character.prospect` and `Character.backer` are optional; absent means none. No migrations or repair functions. `Report.found` and `Report.amt` are optional.

**Known issues / gaps.**
- **The $400 for getting a man out is never charged.** The `fix` order says "$400" and sets `pay: 400`, but `resolveErrand` only checks that a non-player doer has that much cash; nothing deducts it, and no money is returned, so `jobs.resolve` pays nothing either ([orders.ts:310-324](../../src/orders.ts)).
- **Dead clause in the order menu.** The "lean on" filter contains `(p.known[x.id] || true)`, which is always true. `p.known` is keyed by fact id, so it would not work with a business id anyway. This is not a leak: businesses are public, and the sibling Burgle/Scams lists have no such check. The real bug in the same function is the watch list's operator precedence, which lets dead rival soldiers through.
- **Operator precedence in the watch list** ([orders.ts:369](../../src/orders.ts)): the `|| (rival soldier)` branch bypasses the alive and not-self checks, so dead rival soldiers can be offered (the errand then reports "There’s nobody to watch").
- **Double skill growth** on the success path: `jobs.resolve` → `conclude` grows the skill (0.02 / 0.008) and `runCrewJob` grows it again (0.025 / 0.01).
- **Money created or moved without ledger records**: shift pay and fenced cars/goods are created from nothing; skim and gamble cuts move player cash to the man. None of these call `ledger.post`.
- `reliability`, `behaviour` and `runCrewJob` assume the job belongs to the player's crew (`PL(w)` is the beneficiary). Any non-player active job is resolved this way.
- `recruitProspect`'s first parameter is named `p` but NPC goals pass an NPC recruiter, so it is an NPC API as well; its "You’re nobody yet" check runs after the cash check.
- `bossErrand` can return false without creating a job, and `jobs.bossOffer` still returns true; the club's "ask for work" then finds no job but sets its 3-day cooldown anyway.
- The `runner` day job has a pay rate but is never offered. `money$` duplicates `core.money`. `giveOrder` draws `due` twice (once in `assign`, once to override it).

---

## How this group connects to the rest

- `meetings.summonsTick` → `jobs.mkJob` (summons) → Today list → `web.ts attend` → `open*Meeting` → `closeMeeting` sets the job `done`; ignored boss summons expire in `jobs.daily`, costing standing, and two in a month bring a beating or a higher kick-up rate ([jobs.ts:825-838](../../src/jobs.ts)).
- `career.ts` and `path.ts` → induction summons (`extra.to`) → `openInduction` → `career.inductPlayer` / `career.turnedDown`. `books.ts` → accounts summons (`extra.amt`, `extra.kind`) → `openAccountsMeeting`.
- Grievances: `gatherGrievances` and `dialogue.ts` create them; rulings call `disputes.settleDispute`; crew concerns call `disputes.callSitdown`; `jobs.staleReason` expires a sit-down summons whose grievance is no longer open.
- Rulings add `ruling` facts (permanent under `retain.ts`) that witnesses learn → respect changes and later gossip; dinners and crew meetings propagate knowledge through `actions.share`.
- Club topics read jobs (`offerFrom`), debts, disputes, situations, `ledger.statement` and encounters, and write through `core.payDebt`, `jobs.takeJob` / `declineJob`, `disputes.*`, `situations.helpWith`, `career.recommend`, `encounters.addFavour` and `ledger.post`.
- Club "ask for work" → `jobs.forceBossOffer` → sometimes `orders.bossErrand`.
- `clubdata.clubPresent` → `places.ts` (the club as a place) and reads `Club.hostId`, which `orgs.ts` maintains; `ensureClubs` is called from `ensureShape` and `orgs.ts`.
- `life.ts` raises encounters via `encounters.addEnc`; `encounters.choose` routes `meet` / `partner` / `kin` answers back to `lifeChoose`; `encounters.eventTick` adds NPC weddings, christenings and funerals to the same `w.events` list that `birth` uses.
- Crew jobs: `jobs.daily` → `orders.runCrewJob` → `jobs.resolve` → `orders.resolveErrand` or the job-kind switch → `jobs.paid` → `core.earn`; the report surfaces in the Today list and can be questioned.
- `orders.recruitProspect` → `rank.applyRank`; used by NPC goals (`goals.ts`) and the player's recruit flow (`flows.ts`), so NPC and player recruitment share one code path.
- `orders.workShift` → `p.backer` → `career.sponsorOf` uses the backer as sponsor → induction.
- The crew meeting's `expect` item → `w.expect` → `hustle.ts` (whether men ask before investing) and `reports.ts`.
- `dialogue.introduced` reads `w.life` (kin and partner count as introduced).

## Replacing this system

What a drop-in replacement must provide, module by module:

- **Club (club.ts + clubdata.ts).**
  - Exports in use elsewhere: `ensureClubs` (world.ts, orgs.ts); `clubOf` (web.ts, orgs.ts, places.ts, UI, tests); `clubOpen` and `clubPresent` (places.ts, UI); `topicsFor`, `waiting`, `startScene`, `sceneNode`, `sceneAct`, `closeScene` (web.ts, UI).
  - World fields: `w.clubs` keyed by family id, with `Club.id` (orgs.ts uses it as `Family.hq`), `name`, `district`, `ownerId`, `open` (shown by the UI) and `hostId` (written by orgs.ts); `w.scene` with at least `npc` (read directly by [ui/views_a.ts:103](../../src/ui/views_a.ts)) and `data.enc` (written directly by [web.ts:420](../../src/web.ts)).
  - Ticks: none, but `ensureClubs` must be safe to call repeatedly (load, weekly, org changes).
  - What makes it hard: `clubPresent` must stay pure because it is called while rendering; orgs.ts and web.ts reach into the club and scene objects directly; the `Scene` type lives in clubdata.ts while its logic is in club.ts; display-time effects depend on the `once()` cache keys stored in `Scene.data`.

- **Meetings.**
  - Exports: `summonsTick` (daily); `openCrewMeeting`, `openAccountsMeeting`, `openFamilyMeeting`, `openSitdown`, `openGathering`, `openInduction`, `choose`, `current`, `closeMeeting` (web.ts, bot.ts, dialogue.ts); the `Meeting` type (UI state, `dialogue.Res.meeting`); `available` (UI).
  - Conventions: every opener returns `Meeting | string`; `choose` returns display lines and mutates the meeting in place; `closeMeeting` returns the minutes to pass.
  - World fields: `w.grievances` (also written by dialogue.ts and read by jobs.ts, consistency.ts, web.ts and bot.ts); `w.expect` (read by hustle.ts and reports.ts); summons jobs with `Job.meeting` and `Job.extra` (`g`, `amt`, `kind`, `to`), which are also created by career.ts, path.ts and books.ts and special-cased throughout jobs.ts.
  - What makes it hard: `web.ts attend` hard-codes the mapping from `Job.meeting` to opener; the meeting lives in UI state, so making it resumable means a new World field and a migration default; the induction depends on `career.inductPlayer` / `turnedDown` semantics.

- **Life.**
  - Exports: `lifeInit` (world.ts), `lifeDaily` and `christeningDue` (engine daily), `lifeChoose` (encounters.ts), and the UI functions and constants (`seePartner`, `visitKin`, `datingPool`, `askOut`, `datePlan`, `DATES`, `askSteady`, `askMarry`, `wedding`, `tryForBaby`, `breakOff`, `kinOf`, `isPartner`, `kinWord`, `stageWord`, `warmthWord`).
  - World fields: `w.life` (read directly by dialogue.ts and the engine's weekly snapshot), `w.events` (shared with encounters.ts and ui/brief.ts), and the encounter kinds `meet`, `partner` and `kin`, which `encounters.choose` routes by name.
  - What makes it hard: circular imports with encounters.ts and world.ts; kin and partners are ordinary `Character` records in `w.chars`, so other systems can see (and in principle act on) them.

- **Orders.**
  - Exports: `runCrewJob`, `resolveErrand`, `bossErrand`, `ERRAND_KINDS` (jobs.ts); `recruitProspect`, `RECRUIT_COST` (goals.ts, flows.ts, web.ts); `prospects` (ambition.ts, UI); `orderMenu`, `giveOrder`, `OrderOpt` (UI, web.ts, stress.ts); `questionReport`, `reliability`, `dayJobOptions`, `takeDayJob`, `quitDayJob`, `workShift`, `DayJobOpt`.
  - World fields: `Job.rep` (read by the UI), `Character.job`, `Character.prospect` (set by world.ts), `Character.backer`.
  - What makes it hard: the direct import cycle with jobs.ts, and the split of responsibility in which `runCrewJob` relies on `jobs.resolve` → `conclude` to set the job status and pay out on the success path, then adjusts the money afterwards; the implicit assumption that every delegated job belongs to the player.
