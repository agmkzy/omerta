# Gate 4: Unified Conversation Migration and Legacy Removal

Branch `conversation-rebuild`, local commits only (nothing pushed or deployed).

| Commit | Stage |
|---|---|
| 85d1f8f | A: personal talk and what a man knows |
| 6729e85 | B: money and business |
| 5b00326 | C: the family |
| 6b47788 | D: having things out, his asks, what is on his mind |
| 5fe612f | the old engine's effects recorded for every parity case |
| 7894a85 | E: the old engine removed; one conversation everywhere |
| 7a1048f | fixes found playing the scenarios after removal |

## 1. Result

The player now talks to everyone through one conversation: Business / Personal / Confront, then a subject, then an approach, then the world action. The old dialogue engine and its screen are deleted, and the feature switch is gone.

| Removed | Lines |
|---|---|
| `src/dialogue.ts` | 2,846 |
| `src/flows.ts` | 370 |
| `src/ui/talkview.ts` | 184 |

`src/talk.ts` (626) and `src/threads.ts` (375) are moved, not deleted. They are now `conv/subjects/life.ts` and `conv/subjects/between.ts`, with every effect routed through doors.

Status of the requirements:

- **No category depends on the old engine.** Every row of the Gate 4 inventory (`docs/gate4/INVENTORY.md`) is migrated.
- **Parity.** Each interaction's effects match what the old engine did: 182 cases, each on 3 worlds at 3 levels of trust, 1,638 runs. The old engine's results were recorded before deletion and the tests hold the layer to that record (§4). One difference is deliberate and named.
- **Saves.** Old saves load; the layer's record is added on load (§6).
- **Tests.** Full suite: 625 passed, 0 failed (14 opt-in long runs skipped). Long-run suite: 638 passed; the exhaustive conversation audit, its one failure, passes after a test-setup fix (§7).
- **Browser scenarios.** A–G were played on a pre-migration save after the removal. Transcripts are in §8.

## 2. Architecture

```
web.ts / ui/talk2.ts  ──►  conv/visit.ts      (the visit: headings, subjects, his opening, his asks)
                              │
                              ▼
                           conv/run.ts        (every exchange: repeats, social caps, conduct, story
                              │                records, recall, the ▲▼ card, patience, his break-in)
                              ▼
                     conv/acts/*  (Acts)      offers(c): what can be said now (the old engine's own conditions)
                     conv/subjects/*          run(c, code): his decision → doors → his words
                              │
              decisions ──────┼────── effects
       conv/decide.ts          │        conv/doors.ts  ──►  deeds.ts, asks, jobs, econ, books,
   (weigh / chance / settled:  │        (the only path       encounters, situations, matters,
    a Decision record kept     │         to world writes)    disputes, meetings, core
    with every line he says)   │
                               ▼
                       conv/kit.ts (Visit, Thread, Offer, Act; his lines with their decision trace)
```

**Decisions.** Each decision is built in the layer's decision record (`conv/decide.ts`):
- `chance` builds the odds term by term from the world's own rule and rolls the world's dice once. Where an old rule read the roll from the top (`roll > k`), the decision does the same, so the same seed gives the same answer.
- `weigh` takes the best of several candidates.
- `settled` covers the moves the rules leave no choice about. A reason is recorded for those too.
- The developer view (`?debug=1`) shows every line with the decision behind it.

**Effects.** Every effect goes through `conv/doors.ts`. `deeds.ts` holds the world actions the old engine did inline: fees, debts, memos, insight, introductions, jobs promised. The architecture test (now covering `conv/acts` and `conv/subjects` too) proves there are no direct writes from the conversation layer.

**Words.** His words are separate from both: the voice sheet, `render`, and the acts' own lines.

**What was not carried over.** The old engine's menu machinery (`options`/`optionsRaw`/`hub`/`gather`/`groupRows`/`focused`/`sayRaw`) has no successor. An Act's `offers` is its own availability rule, ported from the old preconditions and hide rules. The visit arranges what Acts offer:
- under the three headings;
- with what he raises himself first;
- then what is between them;
- then what is on his mind;
- then, by who he is to the player, what a man would naturally put to him;
- then the rest.

## 3. Files

**Added**

| File | What it holds |
|---|---|
| `src/conv/run.ts` | the per-exchange rules, ported from the old `say`/`sayOne`/`govern` |
| `src/conv/decide.ts` | the decision records |
| `src/conv/kit.ts` | shared types and line helpers |
| `src/conv/acts/personal.ts` | personal interactions |
| `src/conv/acts/info.ts` | information and incidents |
| `src/conv/acts/business.ts` | business and money |
| `src/conv/acts/org.ts` | the family |
| `src/conv/acts/confront.ts` | confrontation, amends, encounters |
| `src/conv/acts/subjects.ts` | subjects on his mind |
| `src/conv/acts/common.ts`, `words.ts`, `index.ts` | shared helpers and the registry |
| `src/deeds.ts` | world actions |
| `src/acquaint.ts`, `src/memos.ts` | `introduced` and `memoTick`/`brokenWord`, moved out of the old engine |
| `src/tests/conversation/parity.ts`, `parity.test.ts`, `gate4-parity.json` | the parity harness and the recorded effects |

**Moved**

- `src/talk.ts` → `src/conv/subjects/life.ts`
- `src/threads.ts` → `src/conv/subjects/between.ts`

**Removed**

- `src/dialogue.ts`
- `src/flows.ts`
- `src/ui/talkview.ts`

Also removed: the old routes in `web.ts` (`say`, `sayamt`, `talkmode`, `raiseMatter`/`goSee`/`arrive`), and the switch (`newTalk`/`setNewTalk`, `?talk=`, the "use the old ones" links).

**Modified**

- **`conv/visit.ts`**
  - The bridge to the old engine is removed: `oldRows`/`oldGroups`/`doOld`/`oldSubject`/`atRoot`/`layered`/`speakable`.
  - It now runs Acts.
  - New opening rules: shut out today; a promise falling due; a good turn remembered; a broken word; what shows on him.
  - New rules for all paths: no repeated lines in a visit; no small talk with a man gone cold; nothing offered twice in a visit; nothing offered that the player can't pay for.
- **`conv/doors.ts`**: about 90 new doors.
- **`conv/deciders.ts`**: the go-to-someone rule restored (§5).
- **`conv/pursuits.ts`, `conv/minds.ts`**: save/load determinism fix.
- **`conv/social.ts`**: retention of settled promises.
- **`world.ts`**: every world gets the layer's record.
- **`web.ts`, `ui/*`**: every entry point opens the visit.
- **`playtest/pt.ts`**: drives the visit.
- **Tests**: 15 test files rewritten onto the one conversation.

## 4. Parity

**Method.** Each interaction was run on two copies of one world: the old engine (`dialogue.say` at the old node) and the layer (`run.perform`). Everything either changed was then compared. That covers:
- each man's cash, heat, standing, backer, want, problem, intro, denials, insight and books;
- every relationship field (trust, affection, respect, grudge, fear, known, lastMet);
- what each man knows (and whether he knows who did it), memos, cooldowns, and conversation memory (`talk`);
- facts, debts, favours, jobs, grievances, situations, encounters;
- family tension, business protection and cash, disputes, ventures;
- `nextId` and the state of the dice.

Each case ran on 3 worlds × 3 levels of trust. Cases left to chance were required to come out both ways at least once.

**Proof the harness is strict.** Changing a single trust gain by 0.001 fails it.

**After deletion.** Before the old engine was deleted, its effects for every run were fingerprinted (`gate4-parity.json`, 1,638 runs). The layer matched every one at that commit, and the tests now hold it to that record.

**Coverage.** 182 cases, all passing:

- **Stage A (49 cases)**
  - how he is keeping, and its follow-ups;
  - help, as a gift or a loan;
  - welcome back, congratulations, reminiscing;
  - what he wants, how he gets on with the others, another man, the leadership, what people say about you, what is between you;
  - asking around, introductions;
  - a rival family's man: drink, mood, favour, gossip and trade;
  - an event in hand and all twelve of its questions;
  - owning up and denying; pressing and dropping;
  - "I'll find out who", "I'll speak to them", a sit-down;
  - who he suspects, telling, clearing a man's name, offering to handle it, mediation.
- **Stage B (53 cases)**
  - how business is (three kinds of man), earnings, a smaller share;
  - partnerships;
  - fee cut and raise, and the haggle's five answers;
  - protection, borrowing, buying, a stake, selling, offering a loan, running his racket;
  - all six answers about a protected shop;
  - all eight debt answers, and money down for time;
  - the envelope, extras, tribute;
  - calling in a favour;
  - a matter opened, moved, answered and given a figure;
  - his trouble: asking, covering, lending, the rival, leaving him to it.
- **Stage C (36 cases)**
  - work, what the boss needs, a bigger piece;
  - work he offers: taken, passed, raised;
  - report, asking why, refusing;
  - where you stand, a word put in;
  - backing, and its four terms;
  - a concern about a man;
  - your own man: what is wrong, cash, duties, a light envelope, looking into it, thin ice and its five answers;
  - orders and push-back;
  - recruiting.
- **Stage D (44 cases)**
  - demanding an explanation, a lie put to him;
  - clearing the air (six ways);
  - a broken word;
  - outstanding memos; what was found out;
  - warning a rival off, and easing it;
  - his asks: answered, put off, refused;
  - the subjects on his mind: trouble, shop, wants, opinion, boss, earnings, debts either way, places hurting.

**Named exceptions** (allowed by name in the harness, not by loosening it):

- **The ledger is compared apart.** Money the old engine moved by hand is now posted:
  - gifts and tributes as `gift`, so the week's kick-up account is unchanged;
  - an evening and a drink as `spend`;
  - a chop-shop stake as `stake`;
  - a man making up his arrears as `repay`.
- **Empty relationship records.** The old engine created an empty relationship record at default values for every man it listed in its menus. The layer reads without writing. A default record and none are the same footing.
- **The wording of a story record's text.** The player's words are now what he says, not the old menu label.
- **"A matter: pressure".** This is the one deliberate behaviour difference; see §5. Where the result differs from the record, the test checks that the shopkeeper went to his protector.

## 5. Behavioural differences (intended)

1. **One conversation.** The old screen and the switch are gone. Every entry point opens the visit: people, the club, socialising, story links, matter pages, a job whose matter opened.
2. **The evening and "What's new?" are each one interaction.**
   - The evening keeps Gate 3's rules, adds the old drink's $40 and its passing on of news, and drops the old drink's flat trust bonus.
   - "What's new?" runs in this order: his trouble or what is weighing on him, then the old "Heard anything?" (once a day, as open as he is with the player), then Gate 3's district news.
3. **The layer decides NPC behaviour in every game.** Every world has the conversation layer's record from creation, and old saves get it on load. Gate 2b made the layer's decisions govern NPC asks and daily choices in worlds that have that record. Before Gate 4, a game only gained it once the player first used the new screen; now every game has it from day one.
4. **A lost chain, restored.** Under the layer's decision model, a pressed shopkeeper would never go to the man he pays. That broke a chain the old game had:
   - he goes to his protector;
   - the protector warns the player off;
   - the warning reaches the player as a request;
   - the families' tension rises.

   The rule is restored inside the layer's decision (`conv/deciders.ts`):
   - a man refusing because another man looks after him, when pressed, goes to that man;
   - any demand refused for the third time goes to someone.
5. **Settled records kept for less time.** Settled promises between two other men are kept 30 days; the player's own are still kept 180. The agreement behind a promise is kept while the promise is, or 30 days. This keeps the layer's records within the 150 KB save budget now that the layer runs from day one: seed 7 at day 120 went from 192 KB to 142 KB.
6. **Visible improvements from the unification.** These are rules the old engine applied only to its own lines; they now hold everywhere:
   - nothing said in a visit is offered again in it;
   - nothing the player can't pay for is offered;
   - long lines are never repeated in a visit;
   - a man gone cold is offered no small talk;
   - an evening can't be paid for twice;
   - taking his loan figure gets an answer;
   - choices one level down sit under "Something else", "What do you make of…?" and the like, instead of in the old five menus.
7. **Answers to his ask.** "Can it wait?" and "Not right now." are now offered beside the ask's own answers. In the old engine they came on a separate screen before the request.

## 6. Save compatibility

- `World.social` is created in `ensureShape`, so new worlds have it and old saves get it on load. Nothing else in a save changes shape, and no schema bump is needed.
- `oldsave.test.ts` (genuine saves back to schema 2) passes, as does the backgrounds test ("pre-V87 saves load as they were").
- **Bug found and fixed: a loaded save didn't continue identically.** The determinism test showed it once the layer ran in every world. Pursuits and beliefs set fields to `undefined` and reassigned them later, so a played world and its reloaded copy ordered their keys differently. The fields are now deleted instead. A save loaded at day 120 now continues byte for byte with the world it came from.
- **In the browser.** The Gate 3 test save on `play.localhost`, made before the migration, loaded and played four weeks. Saving and reloading mid-game kept every change: a protection fee, a grudge, cash.

## 7. Regression results

- `npm run typecheck`: clean.
- `npm run test:all`: 625 passed, 0 failed (14 opt-in long runs skipped).
- `SLOW=1 npm run test:slow`: 638 passed and 1 failed (the audit, fixed below and rerun on its own). The passes include:
  - 120 days on four seeds: audit clean, ledger clean, layer records within budget;
  - the emergence floors;
  - 180-day sanity runs on several seeds;
  - the long-run observer.
- **The exhaustive audit.** It tries every choice on every screen from 60 staged circumstances, on two worlds. It passes: 6,302 screens, 26,702 choices made, 277 distinct actions exercised, and no problems found.

  Its first run after removal found two kinds of problem, both fixed:
  - **Choices that led nowhere.** "Thin ice" answers and spent envelopes were offered again after use. Fixed in 7a1048f: nothing said in a visit is offered again, and nothing the player can't pay for is offered.
  - **A scenario the test could not set up.** "A man who wants to rise" could not be staged on seed 7, because the world's own men already filled the ceiling for that kind of situation. The audit now takes one of those men as he is. This was a test-setup fix, not a game change.
- **Determinism.** The same seed gives the same history across processes, and a loaded save continues identically. Both pass.

**Old-engine tests replaced.** Each became the same rule on the one conversation. None was deleted:

| Area | What changed |
|---|---|
| menus | the opening screen's shape; everything V76 offered still exists (now as Acts); everything a man allows is reachable; real sentences; event questions; saves round-trip |
| conversation | arrival is a greeting; news by standing; holding back; the Commission; one record per quarrel; no farming |
| acceptance | temperament; persistence across days and saves; breaking it |
| crawler | random walks with the rules checked every step |
| regressions | the V90 defects |
| playtests | the ten played conversations |
| social | the three headings; threads; following page links |
| economy/player | buying, protection and lending by a named figure |
| matters | subjects and matters |

Four asks-weighing tests in `matters` rig the old engine's negotiation state, which the layer's decision doesn't read. They now run on a world without the layer's record and check the asks kinds' own counters and reasons, which the layer uses when it counters.

## 8. Scenarios after removal (in the browser, pre-migration save, `play.localhost:5173`)

**F. Loading a pre-migration save.** It loaded with no console errors and gained the layer's record. All later scenarios were played in it.

**B. Protection.** Opened from the matter page ("Go and see Georgie"); the visit opens on the matter.

> **Georgie:** "Ha! I thought you were dead. Sit down."
> **You:** I've thought about your figure.
> **Georgie:** "You've seen enough. You know what I can do."
> *[Then show me your books · Name your own figure · "All right. $50 a week." · lean on him · "Forget it."]*
> **You:** "All right. $50 a week."
> **Georgie:** "Good. Then we understand each other." *He agrees to $50 a week.* — Trust ▲ · Standing ▲

The world record: Conti's Diner protection `{ collector: player, fee: 50 }`. A week later it was paying, and the player's ambition "Get a shop paying you every week" was met (+$150, standing +2).

**E. An NPC comes to the player.** Lou Bellini: "Lou has something to sell."

> **Lou:** "I know something you'd want to know. $150, and it's about a place where money is lying around…"
> *[Pay $150 · Offer half ($80) · No thanks · Can it wait? · Not right now.]*
> **You:** Offer half ($80). **Lou:** *He shakes his head.* "$110. There's real money at the end of it."
> **You:** Pay his $110. *He gives you a place and a time.* — Trust ▲ · −$110

Cash went from $515 to $405, and the encounter is done. Later, Richie DeSantis came with "$500 for my cousin". Lending it on terms created a debt of $500 at $60 a week, and his second request was offered next.

**D. A confrontation with an approach.** With Richie DeSantis, under Confront, about "Richie DeSantis had Sonny Vitale beaten" (Sonny is the player's man).

> **You:** I want to hear it from you.
> **Richie:** *He laughs without humour.* "Who are you to ask me?" — Trust ▼ · Warmth ▼ · Respect ▼ · Goodwill ▼▼

The record: Richie's grudge is 0.15, with the reason "called him on it", and a threat memo was written. The next visit opens with "He nods, and waits. The last time is still in the room."

**A. Managing one of your own men.** Sonny Vitale.

> **You:** Your envelope's been light. What's going on? **Sonny:** "Nothing I can point to. Some weeks are thin."
> **You:** I'll look into it myself. *Nobody has a bad word for him. It checks out: the corner is busy and the slips are thick.* — Trust ▲ (two hours pass; the note is kept)
> **You (Business):** Find yourself something extra. **Sonny:** "I know a couple of things." *It will show in his books from now on.*

The record: side income $176 a week, now visible to the player; heat +0.1.

**C. Advancement, before and after.** Richie is the player's capo.

> *Before:* "Same as when you asked me 2 days ago. Nothing's moved." / "The money isn't there yet: $0 of $3,000 passed up in total." / "You need made men who'll stand up for you: 2 of 3."
> *After the confrontation and two unpaid envelopes:* "Worse than 2 weeks ago, not better: the men who would back you." / "$0 of $3,000…" / "Who would speak for you? 1 of 3. That's the part that matters."

**G. 30 days of ordinary play** (days 33–61). Weeks passed; the wedding (with a $100 envelope), Sunday and the loan were handled through the conversation. There were no console errors. The consequences that followed:
- a shop paying weekly, completing an ambition;
- "Richie counted it twice. You were $115 light" (standing −6);
- "Richie raised your share for ignoring him".

The save at day 61 was 1.95 MB, of which the layer's record was 90 KB.

**Problems found playing, now fixed (7a1048f):**
- a demand already made stayed on the Confront heading;
- a $300 envelope was offered with $246 in the player's pocket.

## 9. Limitations

- **NPC answers come from the layer's model in every game.** That was Gate 2b's design for worlds running the layer; Gate 4 makes every world one. I restored the lost chain I could see (the protector rule). Other outcomes differ from the old asks engine in when men counter or agree, because the layer's model doesn't read the old negotiation state the asks engine used. `src/tests/matters` lists the cases.
- **An old-engine bug kept on purpose.** After a fee cut, "Just remember it when I ask" promises a favour that is never recorded: the old engine never kept the haggle for it. I kept that behaviour so the parity record holds. Fixing it is one line in `acts/business.ts` (`deal`), and needs your approval because it changes balance.
- **Two debt conversations.** The debt answers (`d_*`) and the debt subject (`tk:debt`) both exist, as in the old engine. The `d_*` answers are offered only while the debt subject is cooling off, as before. A later pass could make them one.
- **Encounter wording.** "It's under World." reads oddly. It is the encounter's own text, unchanged by Gate 4.
- **Retention changed.** Settled promises between two other men are kept for 30 days instead of 180 (§5.5). Nothing I could find reads them after they are settled.
- **Fewer choices on screen at once.** The new screen shows at most four subjects under a heading, plus "Other…". Some old one-level menus are now one step down.

## 10. Recommendation

Gate 4 is complete:
- no category depends on the old engine;
- every interaction's effects match the old engine's record, with one named exception;
- old saves load and continue identically;
- the suites pass;
- the scenarios play.

I recommend approving it.

Before merging to `main`, decide whether the change to NPC decision-making in every game (§5.3 and §9) is acceptable as it stands. If not, the next step is to compare the layer's model against the asks engine across a long simulation and restore further rules the way the protector rule was restored. Nothing has been pushed or deployed.
