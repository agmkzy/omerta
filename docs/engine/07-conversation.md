# Conversation, negotiation and voice

In game terms this group is everything that happens when the player sits down with someone: the greeting, the small talk, what a man will and will not tell you, the questions that follow from his answers, haggling over fees, loans and backing, threats and apologies, and the way each man sounds while he does it. In code terms it is a per-conversation state machine (`Convo`, owned by the UI view and never saved) driven by two pure-ish functions in [dialogue.ts](../../src/dialogue.ts): `options()` builds the menu from world state, and `say()` applies one choice, mutates the world through other modules' functions (relationships, knowledge, debts, favours, memos, jobs, grievances, money), and returns the lines to show and how many minutes it cost. [flows.ts](../../src/flows.ts) handles the multi-step negotiations, [negotiate.ts](../../src/negotiate.ts) computes the economic positions behind counteroffers, and [voice.ts](../../src/voice.ts) / [voicesheet.ts](../../src/voicesheet.ts) turn a character's traits and relationship into wording. The only engine tick in the group is `memoTick` (daily), which settles promises that fell due.

> **Tracked bugs:** the "Known issues" notes below were checked against the source, and the confirmed ones are filed as GitHub issues: [`area: conversation`](https://github.com/agmkzy/omerta/issues?q=is%3Aissue+milestone%3A%22V85+baseline+review%22+label%3A%22area%3A+conversation%22).

## Modules

| file | lines | responsibility |
|---|---|---|
| [dialogue.ts](../../src/dialogue.ts) | 2358 | Conversation model, menu building (`options`), choice handling (`say`/`sayRaw`), arrival scene, used-option and topic memory, first-person rewriting, daily promise settlement (`memoTick`). |
| [flows.ts](../../src/flows.ts) | 379 | Short negotiations about standing and pressure: making good a broken word, backing, promotion, threats to crew, rival gossip and warnings, recruitment, resisted orders, sit-down lead-in. |
| [negotiate.ts](../../src/negotiate.ts) | 26 | Pure functions giving what a shop can bear, what a lender will lend and at what rate, and a good-faith payment. |
| [voice.ts](../../src/voice.ts) | 388 | Archetype classification (`arch`), stable hashing, and long-form speech generators used mainly by jobs and orders (motives, pitches, excuses, admissions). |
| [voicesheet.ts](../../src/voicesheet.ts) | 994 | Line banks per situation, archetype and tone (`say`), relationship tone/register (`toneOf`, `regOf`), and the player's own wording for option labels (`speak`). |
| [memory.ts](../../src/memory.ts) | 65 | Documented with the memory group. Summarised here only because `say()` calls `recall()`. |

## dialogue.ts

**Purpose.** Defines the conversation data types and the two entry points the UI uses: `options()` (what the player may say now) and `say()` (what happens when he says it). Everything a man discloses is drawn from his own knowledge (`Character.known`), everything the player is offered is phrased only from what the player knows, and every action goes through the authoritative records of other systems. It also opens conversations (`arrive`), rewrites NPC speech into the first person (`speechFor`), remembers what has been discussed across conversations (`Character.talk`), and settles promises daily (`memoTick`).

### Conversation model

- `Convo` ([dialogue.ts:40](../../src/dialogue.ts)): `{ id, node, ctx, used?, spoken?, named? }`. `id` is the NPC. `node` is one of `root`, the legacy submenus (`personal`, `business`, `family`, `disputes`, `orders`, `memos`, `amends`, `shop`, `crew`, `debt`, `myboss`, `rival`), the pickers (`pick_member`, `pick_concern`, `pick_incident`), `incident`, `subject` or `follow`. `ctx` carries `fact` (the incident under discussion), `subject` (a third man), `asked` (legacy per-node "already asked" list), `denied`, `sub` (`learn`/`act` sub-list inside an incident), `follow` (answer-driven next options), `deal` (an open negotiation) and an untyped `more` array for the "Other business" drill-down. `used` holds used-option keys, `spoken` the lines he has said (last 60), `named` whether his full name has been used yet.
- The `Convo` lives in the UI view (`{ t: 'talk', convo }` in [ui/state.ts](../../src/ui/state.ts)). `web.ts` saves only `serialize(S.w)`, so a conversation is transient: a reload or leaving ends it. What must persist goes on the characters (`talk`, `denied`, `memos`, `cooldown`).
- `ctx` is mutated in place by `sayRaw` and `flow`; `used`/`spoken` are copied. Tests that branch a conversation deep-copy it (`JSON.parse(JSON.stringify(c))` in v78).
- `DOpt` ([dialogue.ts:26](../../src/dialogue.ts)): `code`, `label`, `hint?`, `story?: 'go'|'end'`, `group?`, `big?`, `nav?`, `done?`. `FollowOpt` is the subset `code/label/hint/big`. `Deal` records `kind` (`fee`, `fee_cut`, `loan`, `ext`, `back`, `ears`, `recruit`, `word`) with `ask/offer/rate/old/biz/debt`.
- Codes are strings `base` or `base:arg` (`inc:<factId>`, `about:<charId>`, `enc:<encId>:<optCode>`, `fl:<sub>[:<arg>]`, `deal:<what>`). `isNavCode` ([dialogue.ts:50](../../src/dialogue.ts)) treats `root`, `deal:*`, `n:*`, anything starting `more` or `sub`, the three pickers and `drop` as navigation: never used up, never rewarded.

### Option layout (`options` and `flatRoot`)

`options()` ([dialogue.ts:338](../../src/dialogue.ts)) calls `flatRoot` when at `root` with an introduced man, otherwise `optionsRaw` + `markStories`. It then rewrites each label with `voicesheet.speak`, marks `done` for used keys (and `chat` already used today), and drops later rows whose label duplicates an earlier one.

`flatRoot` ([dialogue.ts:369](../../src/dialogue.ts)) collects every leaf of every legacy node (via `optionsRaw` with a substituted node), hides redundant ones (`hide`), assigns each to one of five `INTENTS` categories ([dialogue.ts:354](../../src/dialogue.ts), mapping in `intentList` calls at lines 357-361), and lays out:

1. **Between you** (UI heading "On the table"): open requests from `w.enc` (`enc:` rows), a contextual incident row (`inc:`) only for a matter both men know of, `word_make` if `brokenWord()` finds an unmade amends, `confront:` if he lied (`t.denied`) and the player has since learned the truth, then anything `markStories` flagged `go`/`end` and the envelope. At most 4 (more if there are several request rows).
2. **Talk** ("You could say"): up to 3-4 of `how`, `op`, `chat`, `work`, `earn`, `old_times`, `ask_want`, `pick_member`.
3. `more:all` door ("I wanted to talk to you about something") to **Other business**: category list (`more:<intent>`), then that category's rows with `more:up` / `more:back`.

`chat` ("What's been going on?") is always added; `recruit_offer` is added for a civilian prospect when the player is associate or above; `sit_*` rows come from `situations.sitOf`.

### What happens on a choice (`say`)

`say(w, p, t, c, code)` ([dialogue.ts:833](../../src/dialogue.ts)) wraps `sayRaw` with the cross-cutting rules, in this order:

1. **Used guard** (836): a non-nav code whose `usedKey` is in `c.used` returns "You've already been over that.", 0 minutes, no state change.
2. **Topic memory** (838-848): if the base code has a `POLICY` entry ([dialogue.ts:137](../../src/dialogue.ts)) and `t.talk[topic]` was written within the policy window with the same signature, he says `already`/`nochange`/`round_enough` (2 minutes, marks used). Once he has been asked four times within the window he also loses 0.01 trust and brushes you off (not for `old_times` or `drink`).
3. Looks up the chosen `DOpt` (for its `story` flag) and snapshots trust/affection/respect/grudge, cash, standing, heat.
4. **Social farming counters** (852-861) for `how`, `old_times`, `drink`, `op`: per-day and per-week counts in `p.cooldown['soc:'+id]` / `['socw:'+id]`; past 2 a day or 6 a week the exchange is "dull".
5. `sayRaw` (914) runs the handler. It calls `disputes.touchDispute` on every call, resolves navigation codes, then offers the code to `flows.flow()` before its own `switch`.
6. Every line goes through `speechFor` (first person, first names), `lighten` (full name once per conversation), and loses any `Name: ` speaker prefix.
7. Writes `t.talk[topic] = { d, sig, n: 1 }` for policy topics unless `skipMemory` (a dodge), evicting the oldest entry beyond 18.
8. Dull exchanges keep only 20% of their relationship change and add a line saying so; social codes cannot raise trust above 0.6 or affection above 0.8.
9. A result left on a legacy node is moved back to `root` (887).
10. Prepends a `memory.recall()` line for non-nav, non-incident, non-dull replies (890).
11. Appends the `⟡` effect line: arrows for trust, warmth, respect, goodwill (inverse grudge), exact cash change, and arrows for standing and heat.
12. If the option carried a `story` flag, records a minor `favour` fact with a story key from `storyKeyFor` (by node) and logs to the dispute for `amends`/`disputes` nodes.
13. Appends the used key, then drops any line over 30 characters already in `c.spoken` (if nothing is left he says `already`), and appends to `spoken` (capped at 60).

**State owned.**
- `Character.talk?: Record<string, { d; sig; n }>` ([types.ts:126](../../src/types.ts)): main writer. Policy topics (`how`, `op`, `earn`, `ask_want`, `ask_crew`, `ask_rep`, `ask_history`, `ask_around`, `about:<id>`, `leaders`, `old_times`, `drink`), plus one-off stamps written by `arrive` (`prm:<memoId>`, `said:<factId>`) and by flows.ts (`word:<factId>`, `rk_back_no`, `thin`, `rv_ears`, `rv_warn`, `recruit`, `ord:<code>`). Read by [ui/views_a.ts:218](../../src/ui/views_a.ts).
- `Character.denied?: Record<factId, day>` ([types.ts:127](../../src/types.ts)): sole writer; bounded to 10.
- `Character.memos` ([types.ts:137](../../src/types.ts), `Memo` at [types.ts:414](../../src/types.ts)): main writer of NPC memos about the player (`promise`, `agreement`, `threat`, `question`, `favour`); `memoTick` closes and trims them. career.ts and meetings.ts also push memos; core.ts and consistency.ts also close them.
- `Character.intro?` (player's introductions): written by `intro` / `intro_via`.
- `Character.want?`: created lazily by `ask_want` if absent.
- `Character.problem.revealed`, `Character.books.side` / `sideKnown` (`op`, and the dead `assign_hustle` case), `Character.heat` (`rv_favour` on the player; the dead `assign_*` cases), `Character.cooldown.restraint` (only in the dead `cr_thin` case; see flows.ts Known issues).
- `p.cooldown` keys (generic bag, never pruned): `chat:<id>` (day), `soc:<id>` (day*10+count), `socw:<id>` (week*100+count), `rep:<id>`, `intro:<id>`, `rate:ask`, `cut:<bizId>`, `borrow:<id>`; reads `sitask:<id>` written elsewhere.
- Direct writes to other systems' records: `Business.protection` (fee changes), `Business.distress`, `Business.lastApproach`, `w.ventures` (chop shop), `w.grievances` (push/splice around sit-downs), `Job.status`/`Job.reported`, `Debt.missed/nextDue/weeklyPayment/balance`, `Family.tension` (dead `rv_warn` case), `Character.cash` on both sides.

**Public API.**

| export | signature | description and side effects |
|---|---|---|
| `DOpt`, `FollowOpt`, `Deal`, `Convo`, `Said` | types | See Conversation model. `Said = { lines, minutes, convo: Convo \| null, meeting?: Meeting \| string, skipMemory? }`; `convo: null` ends the conversation; a `Meeting` opens the meeting view, a string is a refusal line. |
| `isNavCode` | `(code: string) => boolean` | Navigation test (see above). Pure. |
| `usedKey` | `(c: Convo, code: string) => string` | `"<factId>\|code"` for incident-scoped codes in `MATTER`, `"\|code"` otherwise. Pure. |
| `startConvo` | `(id: Id): Convo` | Empty conversation at `root`. Pure. |
| `involvedIn` | `(w, t, f: Fact): boolean` | Actor, victim, owner of the business, or knows it as witness/self. Pure. |
| `incidentsOf` | `(w, t): { f: Fact; known: boolean }[]` | Up to 4 non-minor, non-routine, unresolved facts he knows from the last 40 days, his own first. Pure. |
| `introduced` | `(w, p, t): boolean` | Whether the player may talk business: `p.intro`, boss/crew/backer/sponsor, kin, an encounter from him, a protection, debt or job link. Pure. |
| `introducers` | `(w, p, t): Character[]` | Up to two of boss/backer/sponsor who could vouch. Pure. |
| `speechFor` | `(w, p, t, line: string): string` | Inside quotes: his own name becomes I/me/my (with verb agreement), other introduced men become first names unless ambiguous. Pure. |
| `arrive` | `(w, p, t, r: { lines: string[] }, wh: { kind; name; line }, prevMet: number) => { lines; convo }` | Opening scene: venue and time band, a `scene` and `greet`/`greet_again` bank line, a one-off promise reminder (stamps `talk['prm:'+id]`) and broken-word reproach (stamps `talk['said:'+id]`), the socialise result lines, and the lead line of any open request from him. Volunteers no facts. Writes `t.talk`, advances voicesheet rotation. |
| `asksOf` | `(w, t) => Enc[]` | Open, unexpired encounters from him with options (the same records as the Today tab). Pure. |
| `openness` | `(w, t, p) => 'open' \| 'partial' \| 'general' \| 'brush' \| 'hostile'` | Disclosure tier for `chat`: grudge >= 0.3 hostile; else score from trust/affection adjusted by sociability, a careful senior, rank and archetype; thresholds 0.55/0.38/0.2. Pure. |
| `told` | `(w, t, f, knows: boolean): string` | A fact in his mouth: uses `textHidden` when he does not know the actor, rephrases protection, poach, refusal, robbery and beating texts, else `core.flavour`. Pure. (Not the same function as `voice.told`.) |
| `holdsBack` | `(w, t, p, f, what: 'who' \| 'cost' \| 'witness'): string \| undefined` | The line a proud, cold, bitter, hothead or schemer gives instead of answering, by trust and shame; `undefined` means he answers. Pure. |
| `options` | `(w, p, t, c): DOpt[]` | Current menu. Not strictly read-only: `rel()` calls in `flatRoot`/`markStories` create missing relationship records with defaults. |
| `INTENTS` | `string[]` | The five "Other business" categories. |
| `say` | `(w, p, t, c, code): Said` | Applies a choice (pipeline above). Mutates the world, uses `w.rng`, may add facts, move money, create debts, jobs, favours, memos, grievances and meetings. Does not advance time itself; the caller does. |
| `memoTick` | `(w: World): void` | Daily. For every memo past `due` and not done: decides whether it was kept (promise with `ref`: the job is `done`; promise without `ref`: `p.books.arrears === 0`; question with `ref`: both men know the actor; any other memo with a `due`: not kept), marks it done, and if not kept costs 0.1 trust, 0.06 respect, 1 standing (player) and adds a minor `ruling` fact "X didn't keep his word to Y." witnessed by the NPC. Trims a man's memos to the last 24 open ones when he has more than 24. |

**Internal helpers worth knowing.** `POLICY`/`topicKey` (cross-conversation topic memory), `lighten` (name once), `takeOn` (his view of a matter, by grudge, trust, family and archetype, chosen by a hash of the fact id), `connected`/`thenLine` (a second linked fact and how it relates, claiming cause only when `Fact.cause` says so), `grudgeTarget`, `isSuperior` (walks `bossId` up to six levels), `markStories` (story flags by node), `storyKeyFor`, `softLean` (protection approach via `econ.setCollector`), `promotionLines` (unreachable, see below).

**Option codes by area** (handler lines in `sayRaw`):

| area | codes |
|---|---|
| Opening / personal | `how` (941), `f_hurt`/`f_biz`/`f_help` (989-1016), `help_gift` ($200), `help_loan` ($300 at 5%), `welcome`, `congrats`, `old_times` (1045, passes on news via `actions.share` and moves to `incident`), `drink` ($40), `chat` (1942, once a day, tiered by `openness`) |
| Business | `op` (1070), `earn` (1099), `rate_ask` (1116, `books.askRate`), `partner_chop` ($2,000, venture), `partner_fence`, `terms_cut`, `terms_raise` (1162), `suggest` (1193), `borrow` (1199), `offer_loan` (1226), `deal:*` (1247) |
| Family / standing | `about:<id>` (1313), `leaders`, `concern:<id>` (1334, `books.react`), `recommend`, `ask_want`/`f_want`, `ask_crew`, `ask_history`, `ask_rep`/`f_rep_who`, `ask_around`, `intro`, `intro_via:<id>` |
| Incidents | `inc:<id>` (1459, may lie and record `t.denied`), `who` (2092), `how_much`, `witness`, `source`, `view`, `tell_more`, `involve`, `can_do` (via `sub:act`), `p_how`/`p_claim`/`p_owner`/`why`, `press`, `drop`, `own`, `lie`, `find` (question memo), `speak` (job + promise memo), `sitdown` (grievance + `meetings.openSitdown`), `confront:<id>` |
| Grudges / subject | `suspect`, `tell:<id>`, `exon:<id>`, `handle` (job + promise memo), `mediate`/`mediate2`, `demand:<id>` |
| Amends | `a_own`/`a_start`/`a_pay`/`a_defy` (1516, `disputes.amends`), `a_ask`, `a_gift` ($60) |
| Shop the player collects from | `sh_why`/`sh_how` (with `econ.evidence`), `sh_ears`, `sh_back`, `sh_time`, `sh_lean` |
| Crew man | `cr_ask`, `cr_cash`/`cr_duties` (`people.helpMan`), `cr_drop`, `cr_look` (120 minutes), `cr_money`, `assign_*` and `cr_thin` (flows.ts) |
| Debts | `d_remind`, `d_time`, `d_half`, `d_favour`, `d_forgive`, `d_pay`, `d_all`, `d_ask` (with `ext` counter) |
| Own boss | `b_envelope` (`books.handOver`), `b_extra` ($250), `b_extra2` ($1,000 + favour), `b_stand` (`path.pathInfo`), `b_need`, `b_tribute` ($300), `b_more` |
| Orders / memos | `work`, `report`, `challenge:<job>`, `refuse:<job>`, `memo:<id>`, `answer:<id>` |
| Requests and situations | `enc:<id>:<opt>` (`encounters.choose`), `sit_ask`, `sit_cover`/`sit_lend`/`sit_leave`/`sit_rival` (`situations`) |

**Tick hooks.** `memoTick` is called from the `daily` branch of `advance()` ([engine.ts:56](../../src/engine.ts)). Everything else runs on player action: `web.ts` calls `arrive` after a socialise action ([web.ts:203](../../src/web.ts), [web.ts:222](../../src/web.ts)), `say` on each choice ([web.ts:684](../../src/web.ts)), then `pass(res.minutes, …)` which calls `advance()`. The world therefore runs between lines of a conversation, including daily and weekly ticks.

**Depends on / used by.**
- Imports: `core` (rel, learn, addFact, createDebt, payDebt, earn, money, ownerBiz, isResolved, factText/flavour, shortTime), `actions` (share, confide), `books` (react, envelopeDue, handOver, kickWindow, envelopeText, askRate), `jobs` (standingWord, mkJob, oppFrom, tipFrom, bossOffer, traitWords), `meetings` (openSitdown), `people` (helpMan, lateOf, PROBLEM_LABEL), `econ` (bizMove, clearArrears, evidence, giveTime, owedOf, setCollector, takeFromBiz), `encounters` (addFavour, choose), `voice` (arch), `voicesheet` (say, speak, surname), `memory` (recall), `flows` (flow, sitdownTalk, brokenWord), `negotiate` (feePosition, loanPosition, goodFaith, r5), `crewlife` (WANT_LINE, wantFor, knows, learnAbout, repLines), `hustle` (hustleLine), `path` (pathInfo), `disputes` (amends, playerActed, touchDispute), `career` (readiness), `situations` (askAbout, helpWith, sitOf), `powers2` (historyLines). `WANT_LINE` is imported but unused.
- Imported by: [engine.ts](../../src/engine.ts) (memoTick), [web.ts](../../src/web.ts) (say, startConvo, introduced, arrive, isNavCode), [ui/views_b.ts](../../src/ui/views_b.ts) (options, rendered by `talkView`), [ui/state.ts](../../src/ui/state.ts) (types), [flows.ts](../../src/flows.ts) (types only), tests v77/v78/v79, [playtest/pt.ts](../../playtest/pt.ts). No runtime import cycle.

**Invariants & rules.**
- Determinism: no `Math.random` or `Date`. Randomness is `w.rng` (chance/pick); wording variation that must be stable uses a hash of the fact id (`takeOn`, `told`) or voicesheet's per-NPC counter. Because handlers draw from `w.rng`, the rest of the world's history depends on which conversation choices were made, as intended.
- Knowledge: what he says comes from `t.known`; labels that name a matter only appear when `p.known` has it; `learn()` records the teller as `from`. A man not involved says he only knows what went round. A superior's `chat` never discloses his own deeds.
- Used options: once per conversation (incident questions once per incident); a forced repeat changes nothing.
- No repeated lines within a conversation (lines over 30 characters).
- Duplicate records: `sitdown`/`mediate` reuse an open grievance and remove a new one if the other man refuses; v79 checks memos, grievances and debts for duplicates.
- Bounds: `talk` 18 (on policy writes), `denied` 10, `spoken` 60, `memos` trimmed to 24 open when over 24.
- Money: transfers between characters are direct `cash` arithmetic; only `createDebt`, `payDebt`, `handOver`, `bizMove` and `takeFromBiz` post to the ledger or business transaction log (see Known issues).

**Save compatibility notes.** No new required fields. `talk`, `denied`, `intro`, `want` are optional and created with `??=`; `memos` is repaired by `c.memos ??= []` in `deserialize` ([engine.ts:280](../../src/engine.ts)); the v3 migration derives `intro` for old saves from `rels`. `Convo` is never saved. v77 ("the old save still round-trips after conversations"), v78 ("the save still round-trips after browsing") and v79 ("what is said persists through save and reload") cover this. `p.cooldown` keys accumulate per NPC and are never pruned, so they grow with the number of men the player talks to.

**Known issues / gaps.**
- **Knowledge upgrades are lost.** `core.learn()` returns early if the character already has a record for the fact, and nothing in the repository upgrades `knowsActor` from false to true. So `who` speaks the name but records nothing when the player already had a partial record (which is the only time `who` is offered), `press`, `tell` and `answer` likewise record nothing if the listener already knew the fact without the actor, and a `find` promise can only be kept if the player already knew the culprit when he made it (`answer` needs `p.known[ref].knowsActor`; `memoTick` needs both men to know the actor).
- **Completed promises still listed** (CLAUDE.md bug). Promise memos created by `speak`/`handle` reference a job id. They stay open after the job is done until the player selects them (`memo:`) or `memoTick` reaches the due date; `consistency.reconcile` only closes memos whose `ref` is a fact. Agreement, threat and favour memos have no `due` and never close; they are only dropped once a man has more than 24, and then only the oldest open ones.
- **Ignored promises** cost a flat 0.1 trust, 0.06 respect and 1 standing in `memoTick`, whatever the promise was; any heavier penalty for a failed job comes from jobs.ts (CLAUDE.md integration gap).
- **Story records appear not to fire.** `storyKeyFor` keys off `c.node`, but since V78 almost every action is chosen from the flattened root, so the node is `root` and no story fact or dispute log line is written for those actions.
- **Dead code.** The `sayRaw` cases `promo`, `rk_back`, `rk_back_ask`, `cr_thin`, `rv_ears`, `rv_warn`, `assign_low`, `assign_hustle` are shadowed by `flow()`; `promotionLines` is only reached from the dead `promo` case; `inHisVoice` returns its input; the second `ask_rep` check in `hide` is unreachable.
- **Hard-coded player surname.** `confront` and `press` say "Marino" ([dialogue.ts:975](../../src/dialogue.ts), [dialogue.ts:2035](../../src/dialogue.ts)); the player's name is configurable in `createWorld`.
- **Numbers and record text shown.** `report` prints "(standing +N)"; memo rows use the memo text as label and `due Day N HH:MM` as hint (the flat layout hides non-big hints, but the hint matches the v79 database-wording pattern); `demand`, `tell`, `a_*` and `answer` hints quote raw fact text; `about:` narrates "X trusts Y completely".
- **A promise that can never be kept.** `f_want` (asking a warm man whether you can help with what he wants) pushes a `question` memo with a 30-day `due` and no `ref`. `memoTick` has no "kept" rule for a question without `ref`, so when it falls due it always counts as a broken word: trust and respect lost, a standing point lost, and a broken-word fact that then drives the reproach and amends prompts.
- **Ledger bypass.** `help_gift`, `b_extra`, `b_extra2`, `b_tribute`, `a_pay`, `partner_chop`, `demand`, the player's side of `sh_back` (the business side is recorded by `bizMove`) and others move cash directly without `ledger.post`; payments to the player's boss are inside the ledger's circle, so the money page will not show them. `drink`, `a_gift` and `rv_drink` take cash out of the world with no counterparty. `d_favour` and `d_forgive` write off debt balance directly; `d_favour` on a balance of exactly 300 leaves an active debt at 0, which `audit()` flags until a later `payDebt` closes it.
- **Grammar from third-person labels.** `PROBLEM_LABEL` values ("in debt to someone dangerous", "resentful", "a woman who costs him") are spliced into first-person speech in `cr_ask`, `cr_drop` and the flows plead/hear branches. The CLAUDE.md "It's the car is finished" bug itself is in [encounters.ts:63](../../src/encounters.ts), not here.
- **Fragile coupling.** `brokenWord` (flows.ts) and `memory.recall` find broken promises by fact kind `ruling` plus a regex on the English text "keep his word" written by `memoTick`.
- **Shared `talk` cap.** Topic memory and one-off stamps share the 18-entry cap; evicting a `word:`, `said:` or `prm:` stamp re-opens that prompt (the amends offer, the arrival reproach).
- The used-option reply "You've already been over that." is generic rather than in his voice. The daily social counter packs the count into one decimal digit with no cap (the weekly one is capped at 99); POLICY repeats make the overflow hard to reach in practice.
- Other CLAUDE.md items that touch this module: the flat weekly-envelope prompt is the `b_envelope` label plus `books.envelopeText`; the presumptuous recall line is a voicesheet `recall_*` bank selected by memory.ts.

## flows.ts

**Purpose.** Short, multi-step negotiations where the NPC answers from his own position and the player chooses how to respond: making good a broken word, asking for backing, asking about promotion, telling a crew man he is on thin ice, trading gossip with or warning off a man of another family, recruiting a prospect, and orders that meet resistance. Each step returns a `Said` with `follow` options (`fl:<sub>` codes) and writes its result through existing records: favours, memos, facts, relationships, family tension, `p.backer`.

**State owned.**
- `Character.talk` stamps (via `stamp`/`recent`): `word:<factId>` (amends made, read by `brokenWord`), `rk_back_no` (5 days), `thin` (6), `rv_ears` (3), `rv_warn` (7), `recruit` (5), `ord:<code>` (1).
- `Character.memos` via `memoOnce` (no duplicate open memo with the same text): agreements, threats, favours.
- `Character.backer` (the player's), `w.favours` via `addFavour`, `Family.tension` (both directions), facts of kind `threat` (minor).
- `t.problem.revealed`, `t.books.side`/`sideKnown`, `t.heat`, `t.cooldown.restraint` (no effect, see below), `p.cooldown['sd:'+id]` (in `sitdownTalk`).
- `c.ctx.follow` and `c.ctx.deal` on the conversation.

**Public API.**

| export | signature | description and side effects |
|---|---|---|
| `Stance` | `'over' \| 'under' \| 'peer' \| 'rival' \| 'outside'` | Who has the say. |
| `stanceOf` | `(w, p, t): Stance` | Civilian: outside; other family: rival; player above in chain or rank: over; below: under; else peer. Pure. (Unrelated to `situ.stanceOf`.) |
| `FLOW_BASE` | `Set<string>` | Base codes this module claims: `word_make`, `rk_back`, `rk_back_ask`, `promo`, `cr_thin`, `rv_ears`, `rv_warn`, `recruit_offer`, `assign_low`, `assign_hustle`, `fl`. |
| `flow` | `(w, p, t, c, code): Said \| null` | Handles a claimed code, otherwise `null` so `sayRaw` continues. Mutates the world as listed; uses `w.rng` for wording (`pick`) and outcomes. |
| `sitdownTalk` | `(w, p, t, other): string[]` | What he says as a sit-down is arranged, by archetype, noting a recent previous one. Writes `p.cooldown['sd:'+t.id]`. |
| `brokenWord` | `(w, p, t) => Fact \| undefined` | The most recent broken-word `ruling` fact (under 30 days) against the player for this man that has no `word:` stamp yet. Pure. |

Flow outlines:
- `word_make` → `fl:word_pay` ($150, trust/respect up, grudge down) or `fl:word_explain` (helps only if trust >= 0.4); both stamp `word:<factId>`.
- `rk_back` → if he owes you a favour (and respect >= 0.3): `fl:back_call` (settles that favour) or `fl:back_take`; if trust < 0.5 or respect < 0.35: refusal and `fl:back_what` (agreement memo saying what he wants to see); otherwise `fl:back_take` (favour size 2 from him to you, i.e. you owe him) or `fl:back_press` (rng by respect, trust and standing: smaller favour, or refusal and a stamp).
- `promo` → answer by `career.readiness`, with `fl:promo_earn/sponsor/seat/talk` follow-ups for each gap. Advisory only: it changes nothing.
- `cr_thin` → submit, plead or defy by archetype, courage, stance and grudge; follow-ups `th_ease`, `th_hear` (reveals the problem), `th_hold`, `th_back`, `th_push` (may make an enemy; adds a `threat` fact).
- `rv_ears` → gives a rumour without the actor, or at trust < 0.4 asks for a trade (`fl:rv_trade`, `fl:rv_pass`).
- `rv_warn` → tension +0.15, +0.4 or +0.6 by the other man's temperament and rank, `threat` fact, `fl:rv_ease` (tension -0.2).
- `recruit_offer` → greedy prospects ask double `RECRUIT_COST`; `fl:rc_std`, `fl:rc_more`, `fl:rc_wait`; acceptance via `orders.recruitProspect`.
- `assign_low` / `assign_hustle` → may resist when the player is over him; `fl:ord_insist:<code>` or `fl:ord_ok`; `doOrder` applies the order.

**Tick hooks.** None. Reached only through `dialogue.say` → `sayRaw` → `flow`.

**Depends on / used by.** Imports types from dialogue, `career.readiness`, `core` (addFact, clamp, learn, money, rel), `encounters.addFavour`, `orders` (recruitProspect, RECRUIT_COST), `voice.arch`, `jobs.standingWord`, `people.PROBLEM_LABEL`. Imported only by [dialogue.ts](../../src/dialogue.ts).

**Invariants & rules.** Every flow re-checks its precondition at each step (`brokenWord`, owed favour, cash), so a stale follow-up does nothing. `memoOnce` and the used-option rule stop duplicate memos and favours (v79 "backing ... never twice"). Repeat attempts inside the stamp window get a "nothing's changed" reply and no effect.

**Save compatibility notes.** No new fields; uses `talk`, `memos`, `favours`, `backer`, `cooldown`, all existing.

**Known issues / gaps.**
- `cr_thin` sets `t.cooldown.restraint = max(restraint, w.now)`, but [actions.ts:145](../../src/actions.ts) only treats restraint as active when it is greater than `w.now`, so it has no effect on his behaviour.
- `fl:rv_trade` passes the player's fact to the rival with `knowsActor: true` without checking that the player knows the actor, so a rival can learn (and form grudges from) a culprit the player does not know.
- Hard-coded text: "Talk is cheap, Marino." ([flows.ts:58](../../src/flows.ts)) uses a fixed surname, and the proud `rk_back` line "You got Nicky out when you didn't have to." ([flows.ts:94](../../src/flows.ts)) refers to an event that need not exist.
- The plead branch splices `PROBLEM_LABEL` or a hustle cause clause after "It's" ("It's a runner skipped town with the slips"), the same kind of grammar fault as the CLAUDE.md loan-text bug.
- Rival flows are player-initiated only; nothing here lets a rival organisation approach the player (CLAUDE.md integration gap).

## negotiate.ts

**Purpose.** Derives each side's position in a negotiation from the books, so counteroffers have a stated economic reason. Three pure functions and a rounding helper; no state, no randomness.

**State owned.** None.

**Public API.**

| export | signature | description |
|---|---|---|
| `r5` | `(n: number) => number` | Round to the nearest 5. |
| `feePosition` | `(b: Business): { cap: number; strained: boolean }` | `strained` if `b.distress > 0` or protection is late. `cap = max(10, r5(40% of (income - expense) - (strained ? 10 : 0)))`. |
| `loanPosition` | `(w, lender, borrower, ask) => { can; rate; refuse?: 'cash' \| 'trust' }` | `can = r5(min(ask, 45% of lender cash))`; rate 4% at trust >= 0.7, 5% at >= 0.5, else 6%; refuses on trust < 0.35, or if `can < 150`. |
| `goodFaith` | `(balance, weekly) => number` | `max(25, r5(min(25% of balance, weekly)))`. |

**Tick hooks.** None.

**Depends on / used by.** Imports `core.rel`. Used by dialogue.ts: `f_biz`, `terms_cut`, `terms_raise`, `deal:` (fee), `borrow`, `d_ask`.

**Invariants & rules.** Pure and deterministic. `loanPosition` reads `rel(lender, borrower.id)`, which creates a default relationship record if none exists.

**Save compatibility notes.** None.

**Known issues / gaps.** The header says nobody rolls a die, but the caller does in places: pressing a fee (`deal:hold`) succeeds by `rng.chance` on respect and courage. `borrow` rounds an offer of 850 or more up to the full 1,000, which can exceed the 45% cap by up to 150. `offer_loan` computes need inline (`expense * 1.5 - cash`) rather than here. No test exercises these functions directly.

## voice.ts

**Purpose.** Classifies every character into one of eight archetypes from his traits and rank, and provides stable choice helpers and long-form speech generators. The archetype is never stored: it is recomputed from `traits` each time, so it costs nothing in the save and old saves need no change. The generators (motives, pitches, excuses, confessions, a boss's reasons) are used mainly by jobs.ts and orders.ts rather than by the conversation screen.

**State owned.** None.

**Public API.**

| export | signature | description |
|---|---|---|
| `Arch` | type | `proud`, `bitter`, `schemer`, `earnest`, `hothead`, `cold`, `jovial`, `frightened`. |
| `arch` | `(c: Character): Arch` | First match wins: courage < 0.4, or caution > 0.72 with violence < 0.3, gives frightened; violence > 0.72 with caution < 0.5 gives hothead; ambition > 0.72 with caution > 0.45 gives schemer; violence > 0.6 with sociability < 0.45 gives cold; sociability > 0.72 gives jovial; greed > 0.66 with sociability < 0.55 gives bitter; ambition > 0.55 or made rank gives proud; otherwise earnest. Pure. |
| `ARCH_WORD` | `Record<Arch, string>` | Display adjective for the UI. |
| `hash` | `(s: string) => number` | FNV-1a 32-bit. |
| `pick` | `<T>(xs: T[], seed: string) => T` | Stable choice by hash. |
| `fp` | `(text, who) => string` | Rewrites narration into `who`'s first person. |
| `told` | `(w, f, teller, knowsActor = true) => string` | Short first-person account by fact kind. |
| `ago` | `(w, f) => string` | "this morning", "yesterday", "N days ago", "last week", "N weeks ago". |
| `injury` | `(w, f, teller, knowsActor) => string` | The victim's account, with district places. |
| `Motive`, `Why` | types | Motive and `{ motive, surface, deep, hidden? }`. |
| `whyOf` | `(w, speaker, target, f, p) => Why` | The reason behind a request, by archetype. Consumes one `w.rng` draw for schemers. |
| `pitch` | `(w, speaker, target, f, knowsActor, pay) => string` | Opening of a request for help. |
| `dodge` | `(a: Arch, seed) => string` | Evasive answer to "why?". |
| `excuse` | `(a: Arch, kind, seed) => string` | Excuse for coming up short, by problem kind. |
| `admit` | `(a: Arch, kind, seed) => string` | The truth when he finally says it. |
| `bossWhy` | `(w, boss, x, subject, claimTrue, rival) => Why` | A boss's stated reason for an order against `x`. |

**Tick hooks.** None.

**Depends on / used by.** Imports types only. Used by voicesheet, memory, dialogue, flows, encounters, danger, crewlife, news, clubdata, career, life, jobs (`whyOf`, `pitch`, `dodge`, `injury`, `bossWhy`), orders (`excuse`, `admit`), rackets, places, club, politics, [ui/common.ts](../../src/ui/common.ts), [ui/views_a.ts](../../src/ui/views_a.ts), [ui/views_b.ts](../../src/ui/views_b.ts), v77 and [playtest/pt.ts](../../playtest/pt.ts).

**Invariants & rules.** Everything except `whyOf` is deterministic without the RNG. Changing `arch` thresholds reclassifies every existing character in every save, which changes not only wording but archetype-gated behaviour across the codebase (`holdsBack`, `openness`, `takeOn`, flows reactions, `involve` thresholds, and other modules' uses).

**Save compatibility notes.** Nothing stored.

**Known issues / gaps.** `fp`, `told` and `ago` are exported but used only inside this file; `told` shares a name with `dialogue.told` but has a different signature and purpose. `AMBITION_SURFACE` is built and discarded (`void`); `bossWhy` computes `arch` and ignores it.

## voicesheet.ts

**Purpose.** Gives each man a consistent voice and the player a register. `say` picks one line for a situation ("intent") from a bank, preferring lines written for his archetype and his current tone toward the player, and rotates so he does not repeat himself. `toneOf` and `regOf` read the relationship without creating records. `speak` rewrites option labels into what the player would actually say to this man, leaving the action, cost and hint untouched.

**State owned.** `p.cooldown['say:'+npcId]`: a per-NPC counter incremented on every `say` call and used for rotation. It is saved and never pruned (one key per man spoken to), despite the file header saying nothing here is saved.

**Public API.**

| export | signature | description |
|---|---|---|
| `Tone` | type | `warm`, `easy`, `guarded`, `cold`, `hostile`, `deferential`. |
| `Reg` | type | `up`, `down`, `wary`, `easy`, `level`. |
| `rk`, `first`, `surname` | `(c: Character) => number \| string` | Rank index, first name, surname (or full name). |
| `toneOf` | `(w, t, p): Tone` | His tone to the player: grudge >= 0.35 hostile; player outranks a non-civilian and trust < 0.65 deferential; trust or affection >= 0.65 warm; trust >= 0.4 or affection >= 0.45 easy; trust < 0.2 and affection < 0.3 cold; else guarded. Read-only. |
| `regOf` | `(w, p, t): Reg` | The player's register: grudge either way >= 0.25 wary; his own man down; his boss or a superior up; trust or affection >= 0.5 easy; else level. Read-only. |
| `say` | `(w, t, p, intent, vars = {}) => string` | Filters `BANK[intent]` by archetype and tone, keeps the most specific matches (archetype scores 2, tone 1), picks `(hash(t.id + intent) + counter) % pool.length`, fills `{N}` (his name) and caller variables. Returns `''` for an unknown intent or empty pool. Increments the counter. |
| `hasBank` | `(intent) => boolean` | Whether a bank exists (unused outside this file). |
| `BANKS` | `Record<string, E[]>` | The banks, exported for tests. Each entry is `{ a?: Arch[]; t?: Tone[]; s: string }`. |
| `speak` | `(w, p, t, code, label) => string` | Label rewrite: `OVERRIDE['code\|label']` first, a special case for asking your own man about earnings, then `SPEAK[code]` by register with `_` fallback. `$1` is the regex capture from the old label (an amount or name); if the regex does not match, the label is returned unchanged. |

Bank intents in use: introductions and vouching, `how_fine`, loans (`loan_first`, `loan_again`, `loan_yes`, `loan_counter`, `loan_cash`, `loan_trust`), rate (`rate_agree`, `rate_counter`, `rate_no_*`, used by books.ts), `recommend_*`, `concern_ok`, `work_*`, `drink`, `old_quiet`, `crew_nothing`, `want_dodge`, `gift_thanks`, `welcome_back`, `congrats`, `leave`, `recall_*` (memory.ts), `lead`/`lead2` (actions.share), `scene`, `greet`, `greet_again`, `biz_good`/`biz_quiet`, `chat_*`, `already`, `nochange`, `round_enough`, `fee_*`, `ext_counter`, `earn_*`, `rep_open`, `gossip`, `inc_deny`, `inc_admit`. Placeholders are limited to `N`, `V`, `X`, `Y`, `S`, `what`, `What` (asserted by v77).

**Tick hooks.** None.

**Depends on / used by.** Imports `voice` (arch, hash, Arch). Used by dialogue (say, speak, surname), actions (say), books (say), memory (say, rk, surname), v77.

**Invariants & rules.** Deterministic (hash plus a saved counter; no RNG). `toneOf`/`regOf` must never create relationship records (v77 checks). Busy banks need at least two lines per archetype and no line may be shared between archetypes within a bank (v77). No machinery words (v77 bans "simulation", "NPC", "database", "flag" and others).

**Save compatibility notes.** Only the `say:` counter in `cooldown`; a missing key starts at 0.

**Known issues / gaps.** The `loan_no` bank is never used. The rotation counter is shared by all intents for one man, so rotation within one intent depends on what else he has said. `fill` silently substitutes `''` for a missing variable. The `OVERRIDE` entry for "Steer it somewhere else" matches no label in the code.

## memory.ts (cross-reference)

`recall(w, p, t): Memory | undefined` ([memory.ts:21](../../src/memory.ts)) is documented with the memory group. `say()` prepends its line to a reply ([dialogue.ts:890](../../src/dialogue.ts)) for non-navigation choices outside the incident node, unless the exchange is dull. It is limited to once a day per man (`p.cooldown['recall:'+id]`), each kind once a fortnight (`recallk:` keys), and fires only when a record exists (a harm he knows you did, a broken-word `ruling` fact, an unsettled favour, sponsorship, completed jobs, rank or standing). Its lines are voicesheet `recall_*` banks.

## Spec rules and where they are enforced

The owner's binding spec is [SPEC_conversation_overhaul.txt](../SPEC_conversation_overhaul.txt). Tests are in [src/tests](../../src/tests); names below are the `ok(...)` titles.

| spec rule | enforced in | checked by | gaps |
|---|---|---|---|
| Used options grey out and pay nothing until a new conversation (§5) | `usedKey`/`MATTER` and `done` marking in `options()` ([dialogue.ts:338](../../src/dialogue.ts)); used guard at the top of `say()` ([dialogue.ts:836](../../src/dialogue.ts)); used key appended at [dialogue.ts:906](../../src/dialogue.ts); `chat` once a day; disabled buttons in `talkView` ([ui/views_b.ts:389](../../src/ui/views_b.ts)) | v79 "a used option is greyed out for the rest of the conversation, and a new conversation starts clean"; v79 crawl forces a used option at each step and fails on any state change, and fails if a used option is offered again not greyed; v79 "backing ... never twice" | The guard reply is generic, not in his voice. `deal:` codes are navigation, so they rely on `ctx.follow` being cleared rather than on the used rule. |
| Subjects already discussed are acknowledged across conversations ("Nothing's changed since you asked me yesterday", §4-5) | `POLICY` windows and signatures plus `Character.talk` ([dialogue.ts:137](../../src/dialogue.ts), [dialogue.ts:838](../../src/dialogue.ts)); flows `stamp`/`recent`; `already`/`nochange` banks | v79 "what is said persists through save and reload" | `talk` cap of 18 is shared with one-off stamps (see dialogue Known issues). |
| No repeated lines (§5, §16) | `Convo.spoken` filter in `say()` ([dialogue.ts:909](../../src/dialogue.ts)); voicesheet rotation counter; duplicate-label filter in `options()` | v79 crawl ("line repeated in one conversation", "duplicate options"); v77 "a man given the same situation twenty times never says the same line twice in a row", "the busiest situations give each temperament at least two lines", "no two temperaments share an identical line" | Lines of 30 characters or fewer are exempt. |
| Repeated friendly talk cannot be farmed (§5, §10) | `soc:`/`socw:` counters, 20% dampening and the 0.6 trust / 0.8 affection caps in `say()` ([dialogue.ts:852](../../src/dialogue.ts), [dialogue.ts:873](../../src/dialogue.ts)) | v78 "friendly talk cannot be farmed" | Boss gifts (`b_tribute`, `b_extra`) are not capped. |
| No database language or internal numbers (§8) | `speak()` labels; `pick_incident` topic labels that never name a record or time; `told()`/`speechFor()`/`lighten()`; relationship changes shown as arrows, not values, in the `⟡` line ([dialogue.ts:891](../../src/dialogue.ts)) | v79 crawl `DEV` pattern on every label, hint and line; v77 "nothing player-facing mentions the machinery"; v77 and v78 "every row is a real sentence" | `report` prints "(standing +N)"; memo hints carry `Day N HH:MM`; several hints quote raw fact text; memo labels are memo text. |
| He speaks in the first person and does not repeat his own name (§9) | `speechFor`, `lighten`, speaker-label stripping in `say()` | v79 crawl "names himself aloud" | |
| Rank changes authority and choices (§3, §12) | `flatRoot.hide` (`leaders`, `promo`, `pick_concern` only to a superior; `work`/`earn` adjusted for boss and crew); crew-only `cr_*`, `assign_*`, `ask_want`, `ask_crew`; boss-only `b_*`; `openness` penalty for a superior and a careful senior; superior's `chat` avoids his own deeds; `involve` refuses Commission talk to a low-trust junior; `isSuperior` in `demand` and `concern`; `rk_back` only for an associate; `recruit_offer` needs associate or above; `stanceOf` in flows (`cr_thin`, `assign_*`, `rv_warn`); `regOf`/`toneOf` wording | v77 "the speaker is addressed differently by rank"; v78 "the Commission is discussed by trust and rank"; v79 "a man of lower rank cannot be threatened without consequence, a rival warned off costs tension, and a recruit costs once" | No test asserts the superior-only rows in `hide` or the boss/crew gating. |
| NPCs disclose only what they plausibly know (§3, §7) | `incidentsOf`, `involvedIn` (non-involved men give hearsay), `share()` tiers (partial drops the actor), `holdsBack`, `who` only if he knows the actor, `witness` only names known witnesses, `source` names the real teller, `connected`, `told()` uses `textHidden`; player-side labels gated on `p.known` (contextual `inc:` row, `pick_incident`); `arrive` volunteers nothing | v78 "the incident door only names what YOU know", "the incident picker does not print what the player has not learned", "arriving is a greeting, not a briefing", the "What's been going on?" tiers test, "a man in the middle holds back the name", "a trusted man tells what an untrusted one withholds", "no dead ends ... only a man it happened to is asked what can be done"; v79 crawl "he told you something he does not know himself"; v77 memory tests | `fl:rv_trade` leaks an actor the player does not know (player to NPC direction, unchecked by the crawler). `who` does not record the name it speaks (learn upgrade issue). |
| Counteroffers need a stated reason grounded in finances or motives (§13) | negotiate.ts (`feePosition`, `loanPosition`, `goodFaith`); `terms_raise` counter capped at what the place can carry and `fee_cant` when strained; `borrow` refusal by trust or cash and counter at what he can lend; `offer_loan` lends only what the business needs; `d_ask` scored on trust, respect and missed payments; recruit asks double only for greedy men and says why; `rk_back` states its terms; `books.askRate` | v77 "rate answers carry the real numbers whatever the man says" | No direct test of fee, loan or extension counters. The haggling bug in CLAUDE.md is in encounters.ts. |
| Avoid duplicate disputes, promises or obligations (§13) | `sitdown`/`mediate` reuse an open grievance and remove a refused new one; `memoOnce`; used rule on `fl:` codes | v78 "a quarrel keeps one record"; v79 crawl duplicate memo, grievance and debt checks; v79 backing test | |
| Options follow from the answer; no dead ends (§2D, §6) | `ctx.follow` / `follow` node; incident node with `sub:learn` and `sub:act` and a fallback to the main three; `chat`/`old_times`/`op` move into the incident they raised | v77 "a conversation that passes on news carries on from it"; v78 "follow-ups exist for a subject he raised"; v79 crawl "dead end" | |
| Fewer, intent-based choices without losing capability (§6) | `flatRoot` layers and `INTENTS` | v78 "the opening screen is short", "nothing that was reachable in V76 has been removed" (`v78_root_reach.json`), "Other business opens to categories"; v77 "every option keeps the same action and hint as V76" (`v77_codes.json`) | |
| Deterministic, no runtime AI (§15) | `w.rng`, hashes, saved counters | v79 "crawl is deterministic"; v78 "what is told is deterministic from the record" | |

## Adding a new conversation option

1. **Choose a code.** Use `base` or `base:arg`. Do not start it with `more`, `sub`, `n:` or `deal:`, and do not use `root`, `drop` or the picker names: `isNavCode` would treat it as navigation, so it would never be used up and its effects could be repeated. If the answer depends on which incident is being discussed, add the base to `MATTER` so it is used up per incident.
2. **Offer it.** For a plain action, add it in `optionsRaw` ([dialogue.ts:501](../../src/dialogue.ts)) under the legacy node it belongs to; `flatRoot` flattens every legacy node's leaves into the opening screen automatically. For a reply that only makes sense after a particular answer, push a `FollowOpt` onto `c.ctx.follow` in the previous handler and return `stay('follow', …)`. For a multi-step negotiation, put it in flows.ts: add the base to `FLOW_BASE`, handle it in `flow()`, use `fl:<sub>` codes for the follow-ups and return through `said()`.
3. **Gate it on the world.** Condition it on records, not flags: `p.known` for anything its label names (never print a matter the player has not learned), `t.known` for anything he will say, `rel()` values, rank via `stanceOf`/`RKN`/`isSuperior`, money in hand.
4. **Place it.** Add the base code to the right `intentList(i, […])` call ([dialogue.ts:357](../../src/dialogue.ts)) so it lands in the right "Other business" category. Optionally add a default hint to `AUTO`, put it in `TALK` if it belongs among the ordinary ways to talk, or add it to a `markStories` set if it moves a running matter on. Remember the opening screen limits that v78 enforces (at most 4 matters, 4 talk rows, 10 rows).
5. **Handle it.** Add a `case` in `sayRaw` (or a branch in `flow`). Change relationships with `tweak()`/`rel()`, and change the world only through the owning module's functions: `addFact`, `learn`, `createDebt`/`payDebt`, `addFavour`, `mkJob`, `openSitdown`, `bizMove`. If the player promises something, push a memo with a `due` (and a `ref` that `memoTick` can check). If money changes hands inside the player's circle, consider `ledger.post` (the existing handlers mostly do not). Return `stay(node, minutes)`; `convo: null` ends the conversation; `skipMemory: true` marks a dodge so the topic is not recorded as discussed.
6. **Write his lines.** Use `vsay(w, t, p, '<intent>')` with a new bank in voicesheet.ts `BANK`. Give each archetype at least two lines if the situation is common, or add a general `ANY` line; use only the placeholders v77 allows; keep internal numbers and machinery words out (the v79 `DEV` pattern and the v77 banned list).
7. **Write the player's words.** Add a `SPEAK` entry keyed by the base code, with registers `up`/`down`/`easy`/`wary`/`level`/`_`, and a `re` capture if the label carries an amount or a name.
8. **Decide repeat behaviour.** By default it is once per conversation. If it should be remembered across conversations, add a `POLICY` entry with a window in days and a signature of what counts as "changed". If it is friendly talk that should not be farmable, add it to the `social` list in `say()`.
9. **Persistence.** Prefer existing records. Any new `Character` or `World` field must be optional with a safe default, bounded, and accompanied by a migration and an old-save fixture if the schema changes (see CLAUDE.md).
10. **Test.** Run `npx vitest run v77 v78 v79` (or `make test`). Adding an option to a legacy node (`personal`, `business`, `crew` and so on) changes that node's option list, so v77's "every option keeps the same action and hint as V76" snapshot (`src/tests/v77_codes.json`) will fail until it is deliberately updated. The v78 reachability snapshot only fails if something is removed. The v79 crawler will exercise the new code at three trust levels: it must always reply, never dead-end, show no database wording, grey out after use and change nothing when forced again.

## How this group connects to the rest

- `engine.advance` daily → `memoTick` → minor `ruling` fact "didn't keep his word" → `flows.brokenWord` (the `word_make` amends offer and arrival reproach) and `memory.recall` (`recall_broken` line).
- `say` (`chat`, `old_times`, `drink`) → `actions.share` → `core.learn` → player knowledge with the teller as source → the conversation moves to the incident node for follow-up questions.
- `inc:`, `who`, `tell_more`, `about:`, `b_envelope`, `rv_ears` → `core.learn` → `p.known`, which gates later options and other systems (jobs, disputes).
- `speak`, `handle` → `jobs.mkJob` plus a promise memo → `memoTick` checks the job's status at the due date.
- `sitdown`, `mediate` → a grievance in `w.grievances` → `meetings.openSitdown` → `web.ts` opens the meeting view.
- `enc:` rows → `encounters.choose`: the same requests as the Today tab.
- `work`, `b_need`, `b_more`, `b_envelope`, `partner_fence` → `jobs.bossOffer` / `tipFrom` / `oppFrom` → new jobs in the inbox.
- `b_envelope` → `books.handOver` (ledger `kickup`); `rate_ask` → `books.askRate`; `concern:` → `books.react`.
- `terms_*`, `suggest`, `sh_*` → `Business.protection`, `econ.setCollector`, `giveTime`, `takeFromBiz`, `clearArrears`, `bizMove`.
- `d_*` → debts mutated directly or through `payDebt`; `help_loan`, `borrow`, `offer_loan` → `createDebt`, which the weekly debt cycle then collects.
- `a_*` → `disputes.amends`; every `sayRaw` call → `disputes.touchDispute` (marks the dispute handled and seen).
- `rk_back` (flows) → `p.backer` → `career.ts` uses the backer as sponsor in `readiness`.
- `rv_warn` (flows) → `Family.tension` → politics and war systems.
- `recruit_offer` (flows) → `orders.recruitProspect`; `cr_cash`/`cr_duties` → `people.helpMan`; `sit_*` → `situations`.
- `voice.arch` is read by many simulation modules; `voicesheet.say` is used by actions.ts, books.ts and memory.ts for their own lines.

## Replacing this system

A drop-in replacement must provide:

- **For the engine:** `memoTick(w)` on the daily tick, with the same kept/broken semantics and the same broken-word fact (kind `ruling`, actor the promiser, victim the NPC, text containing "keep his word"), because flows.ts and memory.ts find it by that regex.
- **For web.ts:** `startConvo(id)`, `arrive(w, p, t, r, wh, prevMet)`, `say(w, p, t, c, code)` returning `Said { lines, minutes, convo | null, meeting? }`, `introduced(w, p, t)` and `isNavCode(code)`. web.ts advances time by `minutes` and treats a nav code with no lines as "keep the previous lines".
- **For the UI:** `options(w, p, t, c)` returning `DOpt` with `code`, `label`, `hint`, `story`, `group`, `big`, `nav`, `done`; `talkView` renames the groups `Between you` and `Talk` and relies on `group` being set to choose the flat layout. The `Convo` type is stored in the view union in ui/state.ts.
- **For other modules:** voicesheet's `say` with the bank intents they use (`lead`, `lead2`, `rate_*`, `recall_*`), `rk`/`surname`, and voice.ts's whole export list (`arch` and `pick` are used in more than fifteen modules).
- **For the tests and tools:** v77, v78 and v79 import `options`, `say`, `startConvo`, `arrive`, `holdsBack`, `incidentsOf`, `involvedIn`, `isNavCode`, `INTENTS`, `Convo`, `BANKS`, `speak`, `toneOf`, `regOf`, and compare option codes and hints with `v77_codes.json` and `v78_root_reach.json`. [playtest/pt.ts](../../playtest/pt.ts) drives `arrive`, `options`, `say`, `startConvo` and `introduced`.
- **World fields to keep:** `Character.memos` (shape `Memo`; also written by career.ts and meetings.ts and closed by core.ts and consistency.ts), `Character.talk` (read by ui/views_a.ts), `Character.denied`, `Character.intro`, `Character.backer`, `Character.want`, `Character.problem.revealed`, `Character.books.side`/`sideKnown`, and the `p.cooldown` keys listed above, including voicesheet's `say:` and memory's `recall:`/`recallk:` counters.

What makes it hard:

- `sayRaw` is one 1,400-line switch that calls directly into the mutation functions of about twenty modules and writes their records in place (debts, protection fees, grievances, jobs, cash), so the behaviour is spread across those modules' assumptions.
- The flows/dialogue split is by `FLOW_BASE`: codes in that set shadow `sayRaw` cases of the same name, so it is not obvious from reading `sayRaw` which branch runs.
- Option codes are a de facto API. They appear in tests' JSON snapshots, in `INTENTS` mappings, `AUTO` hints, `SPEAK` labels, `POLICY`, `MATTER` and `markStories` sets, and in `isNavCode`'s prefix rules.
- `Convo.ctx` is mutated in place, and the UI keeps it between calls, so a replacement must either keep that aliasing or copy deliberately.
- Persistent conversational state is scattered: `talk` (shared by dialogue and flows), `memos` (shared with three other modules), and many `p.cooldown` keys from dialogue, flows, voicesheet and memory.
- Conversation choices consume `w.rng`, so any change to which draws are made changes later world history for the same seed and actions, and with it the deterministic tests that replay a seed.
