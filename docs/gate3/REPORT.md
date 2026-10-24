# OMERTÀ: Gate 2b completion and Gate 3 conversation interface

*Branch `conversation-rebuild`, commit `df99966`. Not pushed, not deployed. The new conversation screen is behind a switch (`?talk=new`, or the link on the Today page). The old screen (`dialogue.ts`, `ui/talkview.ts`) is untouched and stays the default until Gate 4.*

**Contents**
1. Summary
2. Gate 2b: what was corrected, and why
3. Gate 3: the conversation screen
4. How it was played
5. Tests and performance
6. Limitations
7. Critical assessment

Appendices:
- A. Browser playthroughs (honest run and liar run)
- B. A month with the same people
- C. Confronting your own man, and an intention off the first list

---

## 1. Summary

- **Gate 2b is finished.** NPCs now decide through one decision model:
  - asks, orders, pursuits and daily actions in a social world all go through it;
  - decisions are separated from carrying them out.

  The faults found in Gate 2b were traced to their causes and fixed. Each has a regression test.
- **Gate 3 is playable in the real game.** A visit opens on what the man raises himself, answered directly. Otherwise there are three headings: **Business**, **Personal**, **Confront**. Under each are the subjects this man and this moment allow, from both engines. Refusals lead to named **approaches** that say real arguments. A subject keeps the talk until it has run its course. Memory carries across visits.
- **A serious fault was found by playing, and fixed.** In an ordinary game, the first version of the new screen offered almost nothing. It only knew the slice of the game the conversation layer models. It now reaches everything the old screen could do.
- **Tests:**
  - typecheck clean;
  - full suite 426 passed, 1 failed (a rule restated to the new brief, now passing), 14 skipped.
- **Gate 3 is not declared complete.** Ordinary personal talk with men who have nothing going on is still thin (section 7).

## 2. Gate 2b: what was corrected, and why

### One decision model

In a world with the conversation layer, every NPC choice goes through one registry of deciders (`asks.DECIDERS`, with a general fallback for any kind of request):
- answering a request, and pressing one;
- obeying an order (`obey.breakWish`, weighed at the moment of opportunity);
- daily actions (`daily.ts`, hooked into `actions.chooseAction`);
- whether a dispute is worth acting on (`disputes.intentDue`, through `obey.free`).

Each decider returns a decision. Carrying it out is a separate step, through the world's doors (`core.transfer` for money, `situ.closeSit` hooks for outcomes).

**The one documented exception:** `generate()` and `K.lean` still supply valuations as inputs. They no longer decide anything themselves.

Worlds without the layer behave exactly as before.

### Repeated follow-ups

- **Before:** a man who had been told his matter was done kept asking whether it was done.
- **Cause:**
  - a promise was not treated as settled until a week after its deadline;
  - the "deadline is near" reason fired every day.
- **Fix:** a promise is settled by its type:
  - **action:** settled when the deed is done;
  - **effort:** settled when the effort is made;
  - **result:** watched until the deadline;
  - **restraint:** watched for its whole term.

  A man asks again only with a reason: a revision of what he believes, or trouble returning. Being told it was done, and believing it, closes the question.
- **After:** four seeds × 120 days, zero follow-ups asked after a promise was settled as done.

### Who did what (the Seed 3 Angelo Palumbo / Lou Palumbo / Hank Moretti chain)

- **Before:** Angelo was blamed for "never touching" a man he had in fact refused.
- **Cause:** a refusal is recorded with the refuser as its actor. Code that read "the actor" as "the offender" got the wrong man.
- **Fix:** `offender()` and `injured()` helpers, used throughout:
  - the deciders;
  - obligation violations;
  - pursuits;
  - the daily tick;
  - the "who answers for this" logic (`captaincyOf`).
- **Regression tests:** chain identity, and the "never touched him" refusal (`autonomy.test.ts`).

### Organisational obedience

- **Before:** 55–80% of agreements to orders were insincere.
- **Method:** I read the traces instead of forcing a target. A first rework overshot to 0%.
- **Retuned weights:**
  - a smaller reputation term;
  - **need** added as a reason to defy;
  - grudge weighted 0.55;
  - the cost of defiance set to 0.15 plus 0.3 × the chance of discovery.
- **Inputs to obeying:** fear, loyalty, rank gap, whether he has been disciplined, whether he has complained, the chance of discovery, need.
- **After:** four seeds × 120 days, 16 orders agreed, of which 0–1 were not meant. Each refusal has a reason in its trace.

### Promise timing

- **Before:** most promises were acted on exactly 3 days before the deadline.
- **Fix:** the moment to act now comes from the man's own circumstances, deterministically.
- **After:** actions are spread from 6 days before the deadline to the last day.

### Pursuits

- **Before:** a man with trouble asked his contacts one after another, breadth first.
- **Now:**
  - routes are chosen by temperament: going to a protector, to the chair, asking around, an intercessor, paying, retaliating, waiting, enduring;
  - repeated failures discourage a route;
  - he remembers who turned him down;
  - he predicts how a man will answer before asking;
  - asking around is valued by what it could unlock, and capped at three people;
  - at most the two best intercessors are tried.
- **After:** routes varied across seeds (wait, protector, endure, ask around).

### A world fix found on the way

- **The fault:** vandalism at a business was recorded in the vandal's home district instead of the business's.
- **Where it showed:** a captain answered "Tell me something I don't know" even when shown evidence.
- **Fix:** a fact at a business now takes the business's district (`core.addFact`).
- **A consequence:** a shopkeeper whose own street is now visibly under pressure gives in sooner. One test relied on the old behaviour; see section 5.

## 3. Gate 3: the conversation screen

### What was wrong with the first version

In an ordinary game, the first version offered:
- "What's new?";
- "Let me buy you a drink";
- under "Something else…", "I need $500".

Everything else lived only in the old engine (`dialogue.ts`):
- work and jobs;
- the boss's requests and the Sunday envelope;
- debts, shop arrangements and rackets;
- standing and promotion;
- crew management;
- stakes, fencing and sit-downs.

The scenario playthroughs hid this, because the scenario is exactly the slice the new engine models. The owner's report ("entirely broken") was right.

### What it is now

```
INTENTION  →  SUBJECT  →  APPROACH
Business      Jimmy’s trouble with Richie     Persuade · Appeal to your word · Negotiate · Accept his decision
Personal      What’s new? · A drink · …
Confront      Your envelope’s been light …
```

- **A visit opens on the man.** If he has something of his own, he raises it himself, and the screen is his question with its answers:
  - a request;
  - work for you;
  - news of what he did for you;
  - a broken promise.

  Otherwise there is a greeting, then **Business / Personal / Confront** (only those with something under them), then **Leave**. Leave is always on the screen.
- **Under a heading:** the four most relevant subjects, then "Other business…" (or its equivalent), then "Something else" (back to the headings), then Leave.
- **A subject keeps the talk.** His reply comes with its answers. When the subject has run its course, the talk stays under the heading it was raised from.
- **Approaches** are chosen by name and said in words. The engine decides whether they work. At most four show; "Other ways to put it…" has the rest.
- **The developer view** (`?debug=1`) shows, under each of his lines, the decision behind it: the options he weighed and the terms of each. The player never sees these.

### How the headings map to what exists

The headings are presentation only, in `conv/visit.ts`. No new simulation. Each subject is an intention one of the two engines already carries out:

| Heading | From the conversation layer (`conv/*`) | From the old engine (`dialogue.ts`, through `say`) |
|---|---|---|
| Business | Taking a promised matter to your captain; telling a man how it went; protection put to a shop; who a man answers to; a fixed loan (only where the old engine has none) | What he brings up and what is between you: jobs, his requests, the envelope, debts, a shop's arrangement, matters under way. The natural proposal for who he is (work from your boss, orders to your man). Under "Other…": its business, organisation and settle groups |
| Personal | What's new; an evening out; telling him of trouble that bears on him; asking who did something | What is on his mind; how he is; his view of others; what people say of you; gifts, congratulations |
| Confront | Nothing of its own yet: a man's grievance against the player comes to the player directly | Light envelopes, thin ice, a late fee and leaning on it, demands, challenges, a lie you can prove, bad blood |

How the old engine's subjects are handled:
- **Each is classified once, by code.** Its doors (his debt, his shop, your crew man, the bad blood, what is outstanding) are opened, so each thing behind a door becomes a subject in its own right.
- **Choosing one runs `dialogue.say`,** so its consequences are exactly the old engine's.
- **Meetings** go to the meeting screen.
- **A figure the player names** has its field on the new screen.
- **Links from other pages** open the visit on that subject.

### How subjects are chosen

Subjects come from the world and from what the player knows, never from a fixed list per character:
- what is pending between them, in either engine;
- what the player's role makes natural with this man;
- what the player knows that bears on him.

Subjects are suppressed where they would be redundant or false:
- trouble a man has already brought to the player is not offered back to him as news;
- you never tell a man news he already has;
- a matter he refused, where nothing has changed, drops under "Other…" with a note ("He said no 3 days ago. Nothing has changed since.").

A heading with nothing under it is not shown.

### How context persists

- **Within a visit:**
  - the subject in hand;
  - the heading the talk is under;
  - arguments made, which are not offered again;
  - pressure applied;
  - offers and counter-offers.
- **Across visits** (saved in `World.social.talks`):
  - what each subject came to, with a signature of the circumstances, so a refusal is remembered until something changes;
  - lines he has said recently, which are not repeated;
  - the last evening out.
- **Greetings read that memory:**
  - a man you haven't seen in two weeks says so;
  - the visit after an evening out says "You recovered?";
  - a man who refused you last time greets you guardedly.
- **Acquaintance is a fact of the world,** not a choice of greeting. A man you have been to see is never a stranger again (the "Marty Bellini forgets acquaintance" fault).

### NPC initiative

- A man comes to the player only for a reason of his own. That reason is a request recorded by his pursuit or his decision: help, progress on a promise, a confrontation, a report back.
- The Today page lists who is "Looking for you", in the world's words.
- Answered once, a request is not asked again. Ignored, it lapses after a week.
- The old engine's own encounters (an offer, a request) are raised by the man himself when the player goes to see him.

### Interface independence

- `conv/visit.ts` hands the screen structured state: the lines said, the choices, and who he is to the player.
- `ui/talk2.ts` draws that state and decides nothing.
- Another screen could draw the same visit without touching the engine. The tests drive the engine directly.

## 4. How it was played

### In the real game (browser, dev server)

- **Test A, captain.** Louie → Business → "Jimmy DeSantis's having trouble with Richie Valenti. I want to bring it to the family."
  - Louie: "Jimmy? He's not one of ours. Why should we get involved?"
  - Henry chooses **Persuade** and says: "Richie's been leaning on Jimmy for money, at DeSantis's Bakery. That's our ground."
  - Louie: "All right. I'll have a word with Johnny. But if this turns ugly, it's on you."
  - The screen stays on Business.
- **Test D, NPC initiative.** In an ordinary game, "Artie Silvestri wants a word" appeared on the Today page by itself.
  - Going to see him, Artie raises it: "$180, and it's about a place where money is lying around."
  - The choices are the answers: Pay $180 / Offer half / No thanks.
  - Offering half: "I don't need your money that badly. Another time, then." Then the headings.
- **Boss, ordinary game.** Business → "Is there anything you need done?" → Rocco: "Nothing now. Don't look for work. It finds you."
- **Honest and liar runs** (Appendix A, recorded before the headings; the engine behind them is unchanged):
  - Henry promises Jimmy and takes it to Louie. Louie refuses, is persuaded by evidence, takes it to the other captain, who refuses. Louie comes back once to say so. Jimmy is told, and later asks whether the quiet was Henry's doing.
  - In the liar run, Henry says he went when he didn't. Jimmy believes him and judges the promise kept. He never finds out, because nothing he sees contradicts it. The path by which he would find out is real and tested.

### Through the same engine, scripted

- **Tests C, D, F: a month with Marty, Jimmy and Louie** (Appendix B). The player's choices follow a fixed rule so the run repeats.
  - 16 things said and 11 headings opened, over about 18 visits.
  - **Most ordinary intentions take two selections:** a heading, then the subject.
  - **A man's own matter takes one.**
  - **Repetition:** 10 of 35 lines repeated verbatim across the month. They were short greetings, Jimmy's "Well? Did you talk to them?" asked again in a later week, and Marty's "Nothing ever happens to me."
- **Test B, confronting your own man** (Appendix C). Confront appears because his envelope has been light. "Your envelope's been light. What's going on?" → "Nothing I can point to. Some weeks are thin." He is then offered "I'll look into it myself" and "You're on thin ice".
- **Test E, an intention off the first list** (Appendix C). At a barber shop: Business → Other business… → "Offer to buy a piece of it" → a negotiation, answered from his own reasons ("I haven't heard anything about you. That's the problem.").

## 5. Tests and performance

**Typecheck:** clean.

**Full suite** (`npm run test:all`, 357 s): 426 passed, 1 failed, 14 skipped. The one failure was the old rule that a screen has at most five choices. It is restated to the new brief (at most four things to say and three headings, beside the ways back and out) and now passes. After the last edits, the dialogue, conversation and save tests were run again: 170 passed, 4 skipped.

**New and changed tests:**
- `visit.test.ts`, 16 tests:
  - a man you know is never a stranger again;
  - a screen holds at most four things to say and uses no internal terms;
  - a choice not on the screen does nothing;
  - a man in trouble confides it, and a promise is made in plain words;
  - a refusal is answered, an argument is not offered twice, and the player tells only what he knows;
  - a man comes only for a reason, and doesn't ask the same thing twice;
  - a report comes once;
  - told it was done, he doesn't ask again, across a save;
  - "Something else" is real;
  - news names a man only if the speaker knows him;
  - at most three headings, none empty;
  - Business with your boss offers work;
  - "Other business" reaches borrowing;
  - Confront appears only when there is something to have out;
  - a man who came with something is answered directly;
  - an approach is said as its argument, and a settled matter stays under its heading.
- `autonomy.test.ts`: the Seed 3 chain identity, and the "never touched him" refusal.
- `matters.test.ts`, "a superior who hears his man brought trouble wants a word": this now uses the first shopkeeper who holds out. Since the district fix, the seed-5 shop's owner gives in on the spot, which closes the matter before anyone above hears of it. The rule tested is unchanged.

**Regression properties covered by the suite:**
- determinism;
- save/load, including old saves;
- beliefs;
- no private leakage;
- no invalid options;
- no duplicate follow-ups;
- no incorrect references;
- money conservation;
- hierarchy routing;
- worlds without the layer unchanged;
- save growth;
- no forced events.

**Performance:**
- 120 days take 10.3 s without the layer and 11.9 s with it.
- A visit costs about 0.6 ms.

**Save size:**
- the conversation records average about 52 KB per seed over 120 days;
- 115–162 KB over 180 days;
- 205 KB for a year of seed 3 (budget 250 KB).

## 6. Limitations

### Incomplete

- **Personal talk with crew men is thin.** "What's new?" is often "Nothing", and the evening accounts draw on a small set of topics.
- **Confront has no subjects of its own from the conversation layer.** A player who believes a man lied about a promise can raise it only through the old engine's records.
- **The old engine's lines read a little differently:**
  - full names in narration ("Louie Costa waves a hand");
  - some long hints;
  - some subject labels are titles rather than speech ("Louie asks about Paulie").
- **Approaches** are named for the conversation layer's disputes and protection. The old engine's negotiations keep their own wording, which is already speech.
- **When a captain refuses,** there is no route to take the matter higher.
- **An effort promise** has no fulfilment path on the screen beyond raising the matter with the captain.
- **"It isn't true."** is shown under a lie the player can tell. This is a deliberate choice to keep the player informed; it may be better left unsaid.
- **Only one figure field per screen** is supported.
- **The first-week guide on the Today page** still describes the old conversation screen.

### Bugs found and fixed while playing

- The screen had no access to the rest of the game.
- Jimmy was offered news of his own bakery.
- "The other night" was said a week and a visit later.
- The old engine's subjects leaked its navigation rows ("I wanted to discuss some business").
- Protection was suggested right after promising help.
- An argument was re-offered after it had been made.
- A man reporting back came every day.
- Leaving by the header didn't answer an approach, so he kept "looking".
- "I know you tried before" was said to a man who never tried.
- "Not yet" was offered as an answer to "Was that you?".
- A refusal was remembered per promise rather than per matter.

## 7. Critical assessment

Against the ten acceptance criteria:

1. **Three or fewer intentions to begin:** yes.
2. **Relevant subjects without large menus:** yes, four at most, the rest one step away.
3. **Contextual conversations progress naturally:** yes for disputes, requests and old-engine matters. Ordinary chat is short.
4. **Responses reflect world state and character reasoning:** yes. Every reply is a decision with a trace.
5. **Previous interactions influence later ones:** yes for matters, refusals and promises. Partly for social visits (greetings).
6. **All plausible supported actions are accessible:** yes, through "Other…".
7. **No internal concepts shown:** yes, except the "It isn't true." note.
8. **Simple despite the simulation:** yes.
9. **Ordinary intentions with minimal navigation:** yes, usually two selections.
10. **Feels like characters, not management:** for matters, yes. For repeated social visits to a man with nothing going on, not yet. Marty over a month reads as pleasant and uneventful rather than as a relationship developing.

**Verdict.** The structure is right. The simulation's depth is now reachable, and what people come to you with arrives directly. The weakest part is the substance of ordinary personal talk, and that is the next thing to improve.

I would not call Gate 3 complete until a month with a crew man reads as a relationship.

---

## Appendix A. Browser playthroughs: an honest run and a liar run

*Recorded from the running game (`npm run dev`, the in-app browser), not from a harness. The game was started with `?scenario=dispute`, a developer start on the Scenario G premise:*
- *Henry Tedesco has been into Jimmy DeSantis's bakery a few evenings before the month begins, so they know each other.*
- *On the first morning, Richie Valenti, a soldier in another crew, asks Jimmy for money.*

*Nothing else is set. Who refuses whom, who comes to Henry, what the captains do, and whether anyone goes back to the shop are all the world's own decisions.*

*Henry's choices were made by a short script so that the run could be repeated; everything shown is the screen as the player sees it. Each block is one visit:*
- *the header (name, rank or shop, where, and what he is to Henry);*
- *what he says (under his name);*
- *what Henry says (in quotes);*
- *what Henry could say next.*

*Two runs differ in one thing: whether Henry keeps his word.*

### Run 1: Henry keeps his word

```
### Day 0. Angelo Rizzo, a man in Henry’s crew
Angelo Rizzo
CORRENTE The Barber Shop
You know each other.
ANGELO
“You’re here.”
“What’s new?”
ANGELO
“Same as ever.” He leaves it there.
“Let me buy you a drink.”
You spent the evening at the club with Angelo. He talked about the Yankees, and what has happened to them. He was polite, and a little tired. Another evening; it counts for something.

### Day 3. Henry calls on Jimmy DeSantis
Jimmy DeSantis
CIVILIAN DeSantis's Bakery
You know each other.
JIMMY
“Back again.”
“What’s new?”
JIMMY
“Richie wants money off me. I won’t pay him. Can you do anything?”
“I’ll talk to Louie about it.”
JIMMY
“That’s something. Tell him what they’ve been doing.”
“Let me buy you a drink.”
Something else…
Leave

### Day 3. Louie Costa, Henry’s captain
Louie Costa
CORRENTE home in The Bronx
He likes you.
LOUIE
He’s glad to see you, and doesn’t hide it.
“Jimmy DeSantis’s having trouble with Richie Valenti. I want to bring it to the family.”
LOUIE
“Jimmy? He’s not one of ours. Why should we get involved?”
“I gave Jimmy my word I’d raise it.”
LOUIE
“Tell me something I don’t know. Show me Richie’s people on our streets and we’ll talk.”
“Richie’s been leaning on Jimmy for money, at DeSantis's Bakery. That’s our ground.”
LOUIE
“All right. I’ll have a word with Johnny. But if this turns ugly, it’s on you.”
“What’s new?”
“Let me buy you a drink.”
Something else…
Leave

### Day 6. Someone came looking: Louie Costa sent word he has something to tell you.
Louie Costa
CORRENTE home in Bensonhurst
He likes you.
Louie Costa has come to find you.
LOUIE
“I took it to Johnny. He won’t rein Richie in.”
“Thanks for trying.”
LOUIE
“Don’t mention it.”
“What’s new?”
“Let me buy you a drink.”
Something else…
Leave

### Day 7. Henry looks in on Jimmy
Jimmy DeSantis
CIVILIAN DeSantis's Bakery
You’ve been to see him once before.
JIMMY
“Well? Did you talk to them?”
“I took it to Louie.”
JIMMY
“I won’t forget it. Anything you need here, you ask.”
“I took it to Louie. Their side won’t rein Richie in. I’m sorry.”
JIMMY
He takes it in. “So I’m on my own.”
“What’s new?”
“Let me buy you a drink.”
Something else…
Leave

### Day 9. Angelo Rizzo again
Angelo Rizzo
CORRENTE The Barber Shop
You’ve been to see him once before.
ANGELO
He nods you to a chair.
“What’s new?”
ANGELO
“Nothing.” He doesn’t seem inclined to say more.
“Let me buy you a drink.”
Something else…
Leave

### Day 11. Louie Costa again
Louie Costa
CORRENTE The Barber Shop
You’ve been to see him a few times.
LOUIE
He nods you to a chair.
“What’s new?”
LOUIE
“Somebody smashed up Greco's Caffè 6 days ago.”
“Let me buy you a drink.”
Something else…
Leave

### Day 13. Someone came looking: Jimmy DeSantis came by looking for you. He wants a word.
Jimmy DeSantis
CIVILIAN DeSantis's Bakery
You’ve been to see him a few times.
Jimmy DeSantis has come to find you.
JIMMY
“Richie’s back. I know you tried before. Is there anything else you can do?”
“I’ll do what I can.”
JIMMY
“I suppose that’s all anyone can do.”
“What’s new?”
“Let me buy you a drink.”
Something else…
Leave

### Day 13. Henry calls on Jimmy again
Jimmy DeSantis
CIVILIAN DeSantis's Bakery
You’ve been to see him a few times.
JIMMY
“Well? Did you talk to them?”
“Not yet. Give me a few days.”
JIMMY
“All right. A few days.”
“What’s new?”
“Let me buy you a drink.”
Something else…
Leave

### Day 17. Angelo Rizzo, weeks on
Angelo Rizzo
CORRENTE home in Bensonhurst
You’ve been to see him a few times.
ANGELO
“Sit down.”
“Let me buy you a drink.”
You spent the evening at the club with Angelo. He talked about the price of everything. Nobody said anything that mattered. Another evening; it counts for something.

### Day 20. Someone came looking: Jimmy DeSantis has been asking for you.
Jimmy DeSantis
CIVILIAN DeSantis's Bakery
You’ve been to see him a few times.
Jimmy DeSantis has come to find you.
JIMMY
“Well? Did you talk to them?”
“Not yet. Give me a few days.”
JIMMY
“A few days.” He nods, but he’s counting.
“What’s new?”
“Let me buy you a drink.”
Something else…
Leave

### Day 27. Someone came looking: Jimmy DeSantis has been asking for you.
Jimmy DeSantis
CIVILIAN DeSantis's Bakery
You’ve been to see him often.
Jimmy DeSantis has come to find you.
JIMMY
“Richie’s people haven’t been back. Was that you?”
“That wasn’t me. But I’m glad they’ve stopped.”
JIMMY
“Huh.” He thinks about that. “Well. Somebody did.”
“What’s new?”
“Let me buy you a drink.”
Something else…
Leave
```

### Run 2: Henry promises, never goes, and says he did

```
### Day 0. Henry calls on Jimmy DeSantis, and promises
Jimmy DeSantis
CIVILIAN DeSantis's Bakery
You know each other.
JIMMY
“Sit down.”
“What’s new?”
JIMMY
“Richie wants money off me. I won’t pay him. Can you do anything?”
“I’ll talk to Louie about it.”
JIMMY
“That’s something. Tell him what they’ve been doing.”
“Let me buy you a drink.”
Something else…
Leave

### Day 6. Someone came looking: Jimmy DeSantis has been asking for you.
Jimmy DeSantis
CIVILIAN DeSantis's Bakery
You’ve been to see him once before.
Jimmy DeSantis has come to find you.
JIMMY
“Well? Did you talk to them?”
“I took it to Louie.”                         ← the lie (on screen the choice is marked “It isn’t true.”)
JIMMY
“I won’t forget it. Anything you need here, you ask.”
“What’s new?”
“Let me buy you a drink.”
Something else…
Leave

### Day 13. Someone came looking: Jimmy DeSantis came by looking for you. He wants a word.
Jimmy DeSantis
CIVILIAN DeSantis's Bakery
You’ve been to see him a few times.
Jimmy DeSantis has come to find you.
JIMMY
“Richie’s back. I know you tried before. Is there anything else you can do?”
“I’ll talk to Louie about it.”
“I’ll do what I can.”
“I’ll make sure he leaves you alone.”
“I can’t get involved in this.”
Leave
```

*At the end of the month, in Jimmy's own records:*
- *he believes the promise was done, and judges it kept;*
- *his trust in Henry has gone up (0.16).*

*He never found out. Henry's promise was to raise the matter with Louie, and Richie coming back doesn't contradict that. Jimmy keeps the deed he was promised apart from the dispute itself, so he had no reason to check with Louie.*

*The path by which he would find out is real and tested (`autonomy.test.ts`, "a broken promise believed kept earns trust; found out, it costs more"). It is triggered when what he was told and what he sees disagree.*

### What the engine offers that these runs didn't use

From the same scenario, driven headlessly through the same engine the screen draws. These are the "Something else…" lists:

```
at the captain:  “I need $500. I’ll pay the usual.” | “Who does Richie answer to?” | “You hear what happened at DeSantis's Bakery?” | “What’s new?” | “Let me buy you a drink.” | Never mind | Leave
at a shop:       “$55 a week, and nothing happens to the place.” | “Who does Richie answer to?” | “You hear what happened at DeSantis's Bakery?” | “What’s new?” | “Let me buy you a drink.” | Never mind | Leave
at a crew man:   “I need $500. I’ll pay the usual.” | “Who does Richie answer to?” | “You hear what happened at DeSantis's Bakery?” | “What’s new?” | “Let me buy you a drink.” | Never mind | Leave
  MARTY: “There he is! Sit, sit.”
  YOU: “Who does Richie answer to?”
  MARTY: “I couldn’t tell you. Nobody’s saying.”
```

## Appendix B. A month with the same people (Tests C, D, F)

*Seed 3, the `?scenario=dispute` premise. Driven through `conv/visit.ts`, the engine the new screen draws; the player’s choices follow a fixed rule so the run repeats. "→" is opening a heading; ">" is what Henry says; [ ] is the screen’s choices after each step. "(nothing like … on offer)" marks where the script’s rule found nothing matching: the screen had moved on (usually because the man raised his own matter).*

```

### Day 0. Marty Bellini
(You know each other.)
MARTY: “There he is! Sit, sit.”
    [Business | Personal | Leave]
  → Personal
    [How do you find working for Louie? | “What’s new?” | “Let me buy you a drink.” | Something else personal… | Something else | Leave]
> “What’s new?”
MARTY: “Me? Nothing ever happens to me.”
    [How do you find working for Louie? | “Let me buy you a drink.” | Something else personal… | Something else | Leave]

### Day 1. Jimmy DeSantis
(You know each other.)
JIMMY: “Sit down.”
    [Business | Personal | Leave]
  → Personal
    [Anyone been bothering you? | “What’s new?” | “Let me buy you a drink.” | Something else personal… | Something else | Leave]
> “What’s new?”
JIMMY: “Richie wants money off me. I won’t pay him. Can you do anything?”
    [“I’ll talk to Louie about it.” | “I’ll do what I can.” | “I’ll make sure he leaves you alone.” | “I can’t get involved in this.” | Leave]
> “I’ll talk to Louie about it.”
JIMMY: “That’s something. Tell him what they’ve been doing.”
    [What do you know about the recent trouble? | “Let me buy you a drink.” | Something else personal… | Something else | Leave]

### Day 1. Louie Costa
(He likes you.)
LOUIE: He’s glad to see you, and doesn’t hide it.
    [Business | Personal | Leave]
  → Business
    [“Jimmy DeSantis’s having trouble with Richie Valenti. I want to bring it to the family.” | Is there anything you need done? | What would it take to be moved up? | Other business… | Something else | Leave]
> “Jimmy DeSantis’s having trouble with Richie Valenti. I want to bring it to the family.”
LOUIE: “Jimmy? He’s not one of ours. Why should we get involved?”
    [Persuade — Tell him what you know of it. | Appeal to your word — You promised Jimmy. | Negotiate — Make it worth his while. | Accept his decision | Leave]
> “Richie’s been leaning on Jimmy for money, at DeSantis's Bakery. That’s our ground.”
LOUIE: “All right. I’ll have a word with Johnny. But if this turns ugly, it’s on you.”
    [Is there anything you need done? | What would it take to be moved up? | Other business… | Something else | Leave]
    (nothing like /^Appeal/ on offer)
    (nothing like /^Accept/ on offer)

### Day 4. Marty Bellini
(You’ve been to see him once before.)
MARTY: He nods you to a chair.
    [Business | Personal | Leave]
  → Personal
    [How do you find working for Louie? | “What’s new?” | “Let me buy you a drink.” | “You hear what happened at DeSantis's Bakery?” | Something else personal… | Something else | Leave]
> “Let me buy you a drink.”
  (You spent the evening at the club with Marty. He talked about what has been going on around him, and what he thinks of it. The hours went quickly. You leave on better terms than you came.)

### Day 6. Someone came looking: Louie Costa sent word he has something to tell you.
(He likes you.)
  (Louie Costa has come to find you.)
LOUIE: “I took it to Johnny. He won’t rein Richie in.”
    [“Thanks for trying.” | Business | Personal | Leave]
> “Thanks for trying.”
LOUIE: “Don’t mention it.”
    [Business | Personal | Leave]
    (nothing like /“What’s new\?”/ on offer)

### Day 8. Someone came looking: Jimmy DeSantis has been asking for you.
(You’ve been to see him once before.)
  (Jimmy DeSantis has come to find you.)
JIMMY: “Well? Did you talk to them?”
    [“I took it to Louie.” | Something else… | Leave]
> “I took it to Louie.”
JIMMY: “I won’t forget it. Anything you need here, you ask.”
    [Business | Personal | Leave]
    (nothing like /“What’s new\?”/ on offer)

### Day 8. Marty Bellini
(You’ve been to see him a few times.)
MARTY: “My head still hurts from the other night. Sit down.”
    [Business | Personal | Leave]
  → Personal
    [What do you want out of all this? | “What’s new?” | “Let me buy you a drink.” | “You hear what happened at DeSantis's Bakery?” | Something else personal… | Something else | Leave]
> “What’s new?”
MARTY: “Nothing.” He doesn’t seem inclined to say more.
    [What do you want out of all this? | “Let me buy you a drink.” | “You hear what happened at DeSantis's Bakery?” | Something else personal… | Something else | Leave]

### Day 9. Louie Costa
(You’ve been to see him a few times.)
LOUIE: He nods you to a chair.
LOUIE: “Paulie Santoro is inside. I know you know a lawyer, and a clerk who knows a judge. I won’t forget it.”
    [Make a call, put up $300 — A man who gets out remembers who got him out. | It’s not your business | Talk about something else | Leave]
    (nothing like u:business on offer)
    (nothing like /anything you need done/ on offer)
    (nothing like home on offer)
    (nothing like u:personal on offer)
    (nothing like /What’s new/ on offer)

### Day 12. Marty Bellini
(You’ve been to see him a few times.)
MARTY: “Sit down.”
    [Business | Personal | Leave]
  → Personal
    [What do you want out of all this? | What do you know about what happened at Sorrento's Pawn? — Sorrento's Pawn was robbed of $172 | “What’s new?” | “Let me buy you a drink.” | Something else personal… | Something else | Leave]
> “Let me buy you a drink.”
  (You spent the evening at the club with Marty. He talked about the price of everything. It was easy. He laughed more than you expected. He likes you better for it.)

### Day 14. Someone came looking: Jimmy DeSantis came by looking for you. He wants a word.
(You’ve been to see him a few times.)
  (Jimmy DeSantis has come to find you.)
JIMMY: “Richie’s back. I know you tried before. Is there anything else you can do?”
    [“I’ll talk to Louie about it.” | “I’ll do what I can.” | “I’ll make sure he leaves you alone.” | “I can’t get involved in this.” | Leave]
> “I’ll talk to Louie about it.”
JIMMY: “That’s something. Tell him what they’ve been doing.”
    [Business | Personal | Leave]
    (nothing like /“What’s new\?”/ on offer)

### Day 15. Jimmy DeSantis
(You’ve been to see him a few times.)
JIMMY: “Well? Did you talk to them?”
    [“Not yet. Give me a few days.” | “I took it to Louie.” — It isn’t true. | “I couldn’t get anywhere with it. I’m sorry.” | Something else… | Leave]
    (nothing like u:business on offer)
    (nothing like /friends|a week/ on offer)

### Day 16. Marty Bellini
(You’ve been to see him a few times.)
MARTY: “Good night, the other night.”
    [Business | Personal | Leave]
  → Personal
    [What do you want out of all this? | What do you know about what happened at Sorrento's Pawn? — Sorrento's Pawn was robbed of $172 | “What’s new?” | “Let me buy you a drink.” | Something else personal… | Something else | Leave]
> “What’s new?”
MARTY: “Same as ever.” He leaves it there.
    [What do you want out of all this? | What do you know about what happened at Sorrento's Pawn? — Sorrento's Pawn was robbed of $172 | “Let me buy you a drink.” | “You hear what happened at DeSantis's Bakery?” | Something else personal… | Something else | Leave]

### Day 18. Marty Bellini
(You’ve been to see him often.)
MARTY: “There he is! Sit, sit.”
    [Business | Personal | Leave]
  → Business
    [I’d be grateful if you’d back me | Is there anything I can do for you? | Other business… | Something else | Leave]
  → Other business…
    [I’d be grateful if you’d back me | Is there anything I can do for you? | “I need $500. I’ll pay the usual.” | “Who does Richie answer to?” | How’s business? | Offer to run his fencing operation | There’s something you ought to know about a man | What would it take to be moved up? | Something else | Leave]
    (nothing like /borrow/ on offer)

### Day 20. Marty Bellini
(You’ve been to see him often.)
MARTY: “There he is! Sit, sit.”
    [Business | Personal | Leave]
  → Personal
    [What do you want out of all this? | What do you know about what happened at Sorrento's Pawn? — Sorrento's Pawn was robbed of $172 | “What’s new?” | “Let me buy you a drink.” | Something else personal… | Something else | Leave]
> “Let me buy you a drink.”
  (You spent the evening at the club with Marty. He talked about the Yankees, and what has happened to them. He ordered another round without being asked. You leave on better terms than you came.)

### Day 21. Someone came looking: Jimmy DeSantis has been asking for you.
(You’ve been to see him a few times.)
  (Jimmy DeSantis has come to find you.)
JIMMY: “Well? Did you talk to them?”
    [“Not yet. Give me a few days.” | “I took it to Louie.” — It isn’t true. | “I couldn’t get anywhere with it. I’m sorry.” | Something else… | Leave]
> “Not yet. Give me a few days.”
JIMMY: “A few days.” He nods, but he’s counting.
    [Business | Personal | Leave]
    (nothing like /“What’s new\?”/ on offer)

### Day 23. Louie Costa
(You’ve been to see him a few times.)
LOUIE: “Sit down.”
LOUIE: “Sonny Russo is inside. I know you know a lawyer, and a clerk who knows a judge. I won’t forget it.”
    [Make a call, put up $300 — A man who gets out remembers who got him out. | It’s not your business | Talk about something else | Leave]
    (nothing like u:business on offer)
    (nothing like /anything you need done/ on offer)
    (nothing like home on offer)
    (nothing like u:personal on offer)
    (nothing like /What’s new/ on offer)

### Day 24. Marty Bellini
(You’ve been to see him often.)
MARTY: “I’m still feeling the other night.”
    [Business | Personal | Leave]
  → Personal
    [What do you want out of all this? | What do you know about what happened at Sorrento's Pawn? — Sorrento's Pawn was robbed of $172 | “What’s new?” | “Let me buy you a drink.” | Something else personal… | Something else | Leave]
> “What’s new?”
MARTY: “Me? Nothing ever happens to me.”
    [What do you want out of all this? | What do you know about what happened at Sorrento's Pawn? — Sorrento's Pawn was robbed of $172 | “Let me buy you a drink.” | Something else personal… | Something else | Leave]

### Day 28. Someone came looking: Jimmy DeSantis has been asking for you.
(You’ve been to see him often.)
  (Jimmy DeSantis has come to find you.)
JIMMY: “Richie’s people haven’t been back. Was that you?”
    [“That wasn’t me. But I’m glad they’ve stopped.” | “I had a word.” — It isn’t true. | Something else… | Leave]
> “That wasn’t me. But I’m glad they’ve stopped.”
JIMMY: “Huh.” He thinks about that. “Well. Somebody did.”
    [Business | Personal | Leave]
    (nothing like /“What’s new\?”/ on offer)

### Day 28. Marty Bellini
(You’ve been to see him often.)
MARTY: “There he is! Sit, sit.”
MARTY: “My grandson is being christened the club's back room, and I want everyone I like in the room. You’re on that list.”
    [Go, with a $250 envelope — People see the thickness of it. | Go, with $100 — The right amount. | Go, with $40 — Somebody will notice. Maybe not out loud. | Send regrets — A man who doesn’t turn up is noticed. | Talk about something else | Leave]
    (nothing like u:personal on offer)
    (nothing like /drink|sit a minute|keeping/ on offer)

---
Selections that said something: 16; headings opened: 11. NPC lines: 35, repeated verbatim: 10 (He nods you to a chair. / “Sit down.” / “That’s something. Tell him what they’ve been doing.” / “Well? Did you talk to them?” / “There he is! Sit, sit.” / “Me? Nothing ever happens to me.”).
```

## Appendix C. Confronting your own man (Test B), and an intention off the first list (Test E)

*Seed 3, an ordinary game (no scenario), day 3. For Test B, one associate is made the player’s man, with two missed envelopes and falling payments.*

```
### Test B: his own man, whose envelope has been light
(You know each other.)
STEVIE: “Sit down.”
    [Business | Personal | Confront | Leave]
  → Confront
    [Your envelope’s been light. What’s going on? | You’re on thin ice. I’m telling you as a courtesy | Something else | Leave]
> Your envelope’s been light. What’s going on?
STEVIE: Stevie Silvestri spreads his hands. “Nothing I can point to. Some weeks are thin.”
    [I’ll look into it myself | You’re on thin ice. I’m telling you as a courtesy | Something else | Leave]

### Test E: something not on the first list, through Other business
(You haven’t met., Ferrara's Barber Shop)
LOU: He looks you over. “Do I know you?”
    [Business | Personal | Leave]
  → Business
    [A man with a place like yours could use some friends | Other business… | Something else | Leave]
  → Other business…
    [A man with a place like yours could use some friends | “I need $500. I’ll pay the usual.” | How’s business? | Ask whether he would sell the place | Offer to buy a piece of it | Something else | Leave]
> Offer to buy a piece of it
  (You ask Lou whether he would sell a quarter of Ferrara's Barber Shop.)
LOU: “A piece? What did you have in mind?”
    [$450 for 25% of Ferrara's Barber Shop | Name your own figure — Put a number to him. He answers it from what he has and what it is worth to him. | Never mind. Forget I said anything | Talk about something else | Leave]
  (choosing: $450 for 25% of Ferrara's Barber Shop)
> $450 for 25% of Ferrara's Barber Shop
LOU: “I can’t do it. Not at that. How do I know it’s straight?”
    [Ask around. I keep my word | Name your own figure — Put a number to him. He answers it from what he has and what it is worth to him. | I’m with Louie Costa | I’d think hard before saying no to me — Lean on him. Fear works. So does resentment, later. | Other ways to put it… | Talk about something else | Leave]
  (choosing: Ask around. I keep my word)
> Ask around. I keep my word
LOU: “I haven’t heard anything about you. That’s the problem.”
    [Call it $500 | Name your own figure — Put a number to him. He answers it from what he has and what it is worth to him. | Be sensible. This is good for both of us | I’d think hard before saying no to me — Lean on him. Fear works. So does resentment, later. | Other ways to put it… | Talk about something else | Leave]
```
