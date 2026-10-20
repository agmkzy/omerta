# V89: The Living Underworld — Phase 1 audit and Phase 2 design

Investigation only; no game behaviour has changed. Evidence comes from the source on branch `v89`, a full replay of the V85 playtest
(262 commands, seed 3) with boss trust and standing traced after every command, and 35-day autonomous runs measured by script.

## 1. Summary

OMERTÀ does not lack activity. In 35 days of seed 3 the world records 644 events, news travels person to person (a beating or a
smashed shop reaches 15–19 people, three quarters of them second-hand), 104 NPC goals are in play, and a well-built model for
developing situations exists. What it lacks is the layer that turns activity into **developing, personal, discoverable matters**:

- Things that happen are recorded as **finished sentences** and then forgotten as situations; almost nothing stays *open*.
- Player and NPC actions are **one-shot rolls followed by lock-outs** (a refused protection offer bars the shop for 14 days).
- The one model built for evolving matters (V75 *situations*) is **narrow and rationed**: about two real ones a month.
- Conversations are a **filtered global menu**, not a reading of what is on this man's mind.
- **Stories** is a screen assembled on demand from five different records; it has no memory of its own.
- Trust and standing inflate from **flat, repeatable rewards for routine jobs**, not (as assumed in V85) from conversation.

The fix is architectural: one shared record for every unresolved matter, which actions open and advance, which NPCs act on, which
knowledge reaches people through, which conversations are built from, and which Stories present. Most of the pieces exist.

## 2. How the systems connect today

| Area | Where | What it is | Shares state with |
|---|---|---|---|
| Events / world history | `core.addFact` | An event with actor, victim, business, and a **fixed text** | everything reads facts |
| Knowledge | `c.known[factId] = {t, from, knowsActor}` (`core.learn`) | Who knows what, from whom, whether they know who did it | dialogue, situations, stories, grudges |
| Gossip | `actions.share` (NPC socialising) | Copies one or two known facts to the listener; `retain.gossipCap` limits spread by tier | knowledge only |
| Relationships | `c.rels[id] = {trust, respect, affection, grudge, lastMet}` | Per pair, decays when not met for 14 days | read widely; changed by flat amounts in ~40 places |
| Matters (8 models) | `disputes`, `situ` (V75), `situations` (old), `encounters`, `goals` (V74), `consequences`, `revenge`, `pulse` | Separate records, separate lifecycles | partly: `situ` mirrors disputes and crew problems |
| Conversation | `dialogue.options` (~500 lines), `dialogue.say` (~1,500 lines), `flows.ts`, `club.ts` | One list of action codes, filtered by rules, regrouped, re-voiced | reads facts, rels, favours, situations (bolted on) |
| Memory | `memory.recall` | At most one remark a day from existing records | read-only; does not change decisions |
| Stories | `ui/stories.ts` | Built on each render from debts, crew problems, disputes, seats, danger, situations | nothing; it is a view |
| NPC agency | `actions.generate/perform` (utility AI), `goals.ts` | Each NPC scores options by traits; goals add multi-week plans | shared action rules with the player (good) |

The best design decisions already in the code: **player and NPCs use the same action rules** (`perform`), **knowledge is a mechanic**
(no omniscience), and V75 situations already separate **truth, claims and per-person knowledge**. V89 should build on these, not
replace them.

## 3. Traced chains

### 3.1 A shop refuses protection (`actions.ts` case `shakedown`, `jobs.ts` move `protect`)
1. One roll: collector violence and approach vs owner courage; −0.3 if the shop already pays someone.
2. Success: collector set, fee fixed, owner gains grudge, fact `protection_started`.
3. Refusal: fact `protection_refused`; a violent collector smashes the shop (fact `vandalism`, heat), otherwise owner grudge +0.05.
4. **Then nothing stays open.** The shop gets a 14-day cooldown (`shake:<biz>`), for the player and NPCs alike. The owner has no
   stance, no plan, no memory beyond a grudge number. No situation is created. Nobody he knows reacts unless they happen to gossip
   about the fact, and hearing it changes nothing they do.

Measured (seed 3, 35 days): **98 refusals across 80 shops, 33 followed by vandalism, 17 successes.** This loop is also why the
Herald fills with "hit by vandals".

### 3.2 Information
- Spread works: vandalism reaches 18.5 people on average, 79% second-hand; arrests 8; beatings 15.6.
- **58% of all events are gambling losses**, which crowd gossip and conversation.
- Text is fixed at creation, so a retelling cannot reflect the teller, his certainty, his source or his feelings.
- Beliefs and suspicions exist only inside V75 situations (claims; a hidden truth) and in `suspect()` guesses at culprits.
- An idle player learns 20 of 644 events in 35 days, which is right; the problem is that talking surfaces the wrong ones.

### 3.3 Trust and standing (V85 playtest replay)
| Source | Boss trust | Standing |
|---|---|---|
| Completing jobs | **+0.28** | **+22** |
| Waiting (time passing) | +0.10 | +8 |
| Going to talk to someone | +0.10 | 0 |
| Choices within conversations | +0.015 | +0.5 |
The replay reproduces the recorded run exactly (day 35: boss trust 0.995, standing 70.5, cash $1,079).
Boss trust reached 1.0 on **day 13**. `jobs.conclude` gives every completed job +0.08 trust and +0.05 respect, and boss jobs +4
standing, with no diminishing returns, and prints "(standing +4)" to the player. Separately, "Stand him a drink ($40)" gives
+0.06 trust and affection every time, uncapped.

### 3.4 Situations (V75) and Stories
In 35 days: 17 situations, 11 of them mirrors of ordinary disputes; one skim, one tribute, three money matters. Causes: narrow
triggers (six kinds), a cap of 30 open, one serious matter per three days, cooling-off periods. Stories never stores anything;
it recomputes a list per render, so a Story cannot have its own developments or remember what the player learned when.

### 3.5 NPC goals
104 active, 9 finished after 35 days; 66 are "business" plans. Interactions with others are mostly refused offers. Goals rarely
conclude and so rarely become visible.

### 3.6 Conversation
`options()` builds every possible action code, then rules hide some ("small talk only if it could lead somewhere", "drink after
three talks today"), regroup the rest ("Other business"), and re-voice the labels. Situation options are appended when the man is in
one. Within a conversation, used options grey out (V77–V79, tested). Between conversations there is no record of what was
discussed beyond cooldowns and the once-a-day recall line.

### 3.7 Kinship
Family ties exist only for the player (`w.life.kin`). NPCs have no relatives in the model; the Connected Family brother is the
player's brother on the player's side only, so in conversation he greets the player by surname like a colleague.

## 4. Root causes (structural, not missing content)
1. **No single record for an unresolved matter.** Eight models, none of them the backbone; Stories a derived view.
2. **One-shot actions with lock-outs** instead of actions that open or advance a matter.
3. **The evolving-matter model is narrow and rationed**, and common events (refusals, beatings, arrests, missed payments,
   humiliations) never create one.
4. **Conversation is menu-first**: subjects are not derived from the speaker's concerns, knowledge and relationship.
5. **Information is text-first**: facts are sentences, so tellings cannot vary, and noise dominates what is told.
6. **Memory is decorative**, not behavioural.
7. **The relationship economy is flat and repeatable** (jobs, waiting, drinks), so trust saturates and stops meaning anything.
8. **NPC plans rarely resolve**, so NPC agency is mostly invisible.
9. **Personal ties are player-only.**

## 5. Phase 2 design: one world, seen from different chairs

### 5.1 Matters (extend V75 `Situation` into the backbone)
One record for anything unresolved between people: cause (real facts), participants with **stance** (what each wants, how firmly,
why), **per-person knowledge and belief** (already `s.k` and claims), stage, history, **scheduled next step** (event-driven, no
per-tick scans), and resolution or abandonment with lasting traces. New kinds, seeded by events that today end immediately:
protection approaches, debts in trouble, humiliations and beatings, arrests (who talked?), betrayals of a promise, rivalries
for a seat, personal ambitions. Existing records (debts, disputes, protection) stay authoritative; matters link to them, as V75
already does for disputes. Bounded: per-kind caps, cooling, closed matters pruned.

### 5.2 Actions advance matters instead of ending them
The protection roll becomes the first step of a protection matter: the owner takes a stance (fear, anger, resolve, greed) from his
traits, his books and who he knows; the shop is not locked out; the player's next visit offers what the matter supports (lower
terms, a show of influence, leverage he has learned, pressure, walking away), and repeated pressure moves the owner's stance in
either direction. The owner acts too, through the same shared actions: tells kin or friends (knowledge), asks another family for
protection, goes to the police (heat), gives in, closes. NPC collectors use the same matter, so NPC shakedowns stop looping.

### 5.3 Conversations from "what's on his mind"
Each NPC's concerns are computed when he is approached, from matters he knows, his problems, goals, grudges, debts, kin and news
he is sitting on, ranked by salience and filtered by what he would say to *you* (trust, fear, interest, secrecy). The conversation
opens from the top concern; subjects come from the list; each subject supports follow-ups (ask, press, offer, challenge, promise).
A compact, bounded per-pair **conversation memory** (subjects raised, offers made, outcomes, promises) persists and changes what he
does next time. The generic menu remains only as a fallback.

### 5.4 Information as claims
Knowledge entries gain a kind of belief (saw, told, heard, suspects) and the teller's angle; the sentence is written at the moment
of telling from structured facts, the teller's voice and certainty, and the source ("Paulie says…"). Distortion is controlled and
causal (omits the name if he holds it back, inflates an amount if he is a braggart, blames his rival if he has a grudge), recorded
as a claim, never as truth. Gossip prefers what matters to the listener; routine noise (single card losses) stops dominating.

### 5.5 Relationships that change behaviour, at a believable pace
Rewards scale with what a deed meant and diminish with repetition from the same source; no passive gains for waiting; no purchasable
trust. Decisions read several factors (trust, fear, interest, grudge, loyalty), so a friend can refuse an unreasonable ask and an
enemy can cooperate when it pays.

### 5.6 Stories = the player's view of matters
A Story is a matter the player knows about, showing only what he knows and when he learned it, with the actions the matter supports.
Matters can run for weeks unseen; the player may only discover one through its consequences.

### 5.7 NPC agency through the same machinery
NPC goals and NPC-side matter steps use the shared action rules; goals gain resolution paths so plans finish, fail or are dropped
visibly. NPCs approach the player (and each other) when a matter or goal gives them a reason.

## 6. Implementation plan
1. Measurement harness kept as tests (spread, matters started and resolved, trust sources, repeated rewards, performance).
2. Matters backbone: extend `situ.ts`; protection, debt, humiliation and arrest matters first.
3. Reward economy fix (`jobs.conclude`, drinks, waiting).
4. Conversation: concerns, subjects, follow-ups, conversation memory; restructure `dialogue.ts` into topic modules with the V77–V79
   tests as the guard.
5. Information as claims; telling-time text.
6. Stories rebuilt on matters.
7. NPC goal resolution and NPC-initiated approaches.
8. Long-run and interactive playtests (scripted player personas through the playtest harness), with transcripts for review.

**Locked files.** This work needs changes in `src/actions.ts` (protection, sharing), `src/core.ts` (knowledge entries, `learn`),
`src/engine.ts` (scheduling matter steps), `src/types.ts` (optional new fields) and possibly `src/world.ts`. All additions would
be optional fields with safe defaults; old saves keep loading.
