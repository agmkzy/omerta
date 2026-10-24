# Gate 3: final refinement

*Branch `conversation-rebuild`. Not pushed, not deployed. The new screen is still behind the switch (`?talk=new`); the old screen is untouched.*

## 1. Summary

The interface is unchanged: Business / Personal / Confront, direct answers when a man comes with something, approaches by name. What changed is what the conversations under it draw on, and what they remember.

- **Personal talk comes from his life.** "What's new?" and an evening out now draw on the man's own circumstances, worked out by the game's existing subject engine (`talk.ts`):
  - his troubles, his shop or racket;
  - what he wants;
  - the men he can't stand or admires, his family;
  - what he thinks of his boss;
  - who is leaning on him.

  He brings up what weighs on him, rotates through what is on his mind rather than repeating it, and doesn't say the same thing again unless it has changed. If his circumstances don't support anything, the evening is an ordinary evening.
- **Relationships develop through contact.** A man talks about his own life according to how well he knows the player, how much he likes him, and his own nature, as well as how far he trusts him. Secrets and favours still need trust. What the player learns goes into the notes the game already keeps on him.
- **Greetings remember:**
  - the last evening ("You recovered?");
  - a confidence ("About the other night. What I said stays between us, right?");
  - a refusal he gave ("If this is about the other thing…");
  - a slight ("He's cooler than he was. He hasn't forgotten the last time.");
  - going over his head ("Mario tells me you came to see him. About the thing I said no to.").
- **Repeated delays are remembered,** across every promise on the same matter. Each "not yet" after the first costs some trust and is answered differently. A repeated promise after broken ones is met with "You said that before." He stops asking when he says he will, and comes back only when something new happens.
- **Confront has subjects of its own** from the conversation layer's records:
  - **a man's word to the player,** past its time and not done as the player believes. He answers truthfully or lies, from his own nature.
  - **an act the player knows he did** to the player or the player's people. He admits, denies or defies. A denial is a lie on record that the old engine can later put to him.

  Nothing can be put to a man that the player doesn't know.
- **Escalation.** A matter your captain refused can be taken to the man above him, and the captain thinks less of you for it and says so.
- **Consistency and wording fixes:**
  - one answer when you report back (no thanks for something that then turns out to have failed);
  - no "It isn't true." label: a lie is marked with what the player knows ("You haven't been to see Louie.");
  - narration is no longer shown as his speech;
  - full names at the start of narration become "He";
  - subject titles are said ("About his trouble with Lou Santoro");
  - no long or "$0" hints;
  - nothing offered that the player can't pay for;
  - no "how do you find working for him?" right after he said he has no use for the man;
  - no news told back to the man it happened to.
- **Usability:**
  - the first-week guide describes the new screen;
  - leaving a man who came with something is an answer ("Not now"), not a silent lapse;
  - walking out on a refusal counts as being refused;
  - each figure field belongs to its own choice.

## 2. Files modified

| File | What changed |
|---|---|
| `src/conv/visit.ts` | Personal subjects from his life (`onHisMind`, `heRaises`, `candourOf`); memory-aware greetings; delays across a matter (`delaysOn`); merged report-and-outcome; Confront subjects (`hisWordToMe`, `knownAgainstMine`, `doHisWord`, `doAccuse`); escalation (`overHead`); "Not now"; walking out on a refusal; wording of bridged lines (`speakable`, speaker attribution, `unaffordable`, `soured`) |
| `src/conv/render.ts` | Lines for the new moments: greetings that remember (evening, confidence, slight, refusal, over his head), delays, a repeated promise, being put off, escalation, Confront (his word, an accusation and its three answers) |
| `src/talk.ts` | One optional hook (`withCandour`): while the new screen asks a man about his own life, his candour can stand in for trust. Unset, as on the old screen, it is trust alone, unchanged. |
| `src/ui/talk2.ts`, `src/web.ts` | A figure field per choice |
| `src/ui/views_a.ts` | First-week guide text for the new screen |
| `src/tests/conversation/visit.test.ts` | 10 new tests (section 7) |
| `docs/gate3/RUN1_ORDINARY.md`, `RUN2_DISPUTES.md`, `RUN3_ORDINARY_FINAL.md` | Browser playthroughs |

## 3. Root causes of the weaknesses

- **Marty's "nothing ever happens".** The new screen's "What's new?" and evening out never consulted the subjects the game already works out for every man (`talk.ts`). They only knew the street's news and the conversation layer's matters. A man with nothing in either had nothing to say.
- **A month of friendship never opened anyone up.** Those subjects open at trust 0.4, and an evening in the new layer raises trust only between compatible men (+0.03). Four evenings with Marty moved his trust from 0.11 to 0.14. Talking about one's own life is now gated by familiarity, liking and temperament as well as trust. Secrets and favours are not.
- **Repeated greetings.** Each greeting has three or four lines. Once all had been heard lately, the renderer fell back to the man's favourite every time. It now falls back to the one heard longest ago. Greetings that remember what last passed between them carry most of the continuity, so the greeting pools themselves did not need to grow.
- **Jimmy's follow-ups.** Delays were counted per promise, and a new promise reset them. A broken promise didn't colour the next one.
- **Day 7 in the earlier playthrough.** The lines were sequential, not alternatives. Henry said "I took it to Louie" (Jimmy: "I won't forget it…"), then in the same visit passed on that the other side had refused (Jimmy: "So I'm on my own."). These were two choices for one fact. They are now one answer ("I took it to Louie. Their side won't rein Richie in. I'm sorry."), with one consequence.
- **Old-engine wording on the new screen.** The bridge passed the old engine's text through untouched:
  - its "is this a reply?" test was used to decide who was speaking, which put the christening's narration in the host's mouth;
  - its door titles were used as choices;
  - its option lists were not checked against the player's money.

## 4. Before and after

- **Marty, asked what's new.**
  - *Before:* “Me? Nothing ever happens to me.” (three times in a month)
  - *After:* he gets onto what is on his mind: Paulie (“I’ve no use for Paulie.”), then his captain (“I’ve no use for Lou.”). Or Richie, on another day: “If I hear something with your name on it, you’ll hear it from me.” … “I’d like to be somebody they ask before they decide.”
- **Jimmy, put off three times.**
  - *Before:* “Well? Did you talk to them?” / “A few days.” He nods, but he’s counting. (each time the same)
  - *After:* “You said a few days. That was 4 days ago.” → “I’ve asked you before. More than once.” → “Then don’t tell me a few days.” A new promise: “You said that before.” A week later: “Every time I ask, it’s a few more days.” → “Then I’ll stop asking you.” (and he does)
- **Louie, after Henry went to Mario.**
  - *Before:* “He nods you to a chair.”
  - *After:* “Mario tells me you came to see him. About the thing I said no to.”
- **The christening.**
  - *Before:* the room, the priest and Nate Corrente's kiss all appeared under SAMMY.
  - *After:* they are narration.
- **The lie.**
  - *Before:* “I took it to Louie.” — *It isn’t true.*
  - *After:* “I took it to Louie.” — *You haven’t been to see Louie.*
- **A gift you can't afford.**
  - *Before:* “Give it to him: $500” offered with $310 in your pocket, then “You haven’t got it.”
  - *After:* not offered.

## 5. The 30-day repeated-character transcripts

- **`RUN3_ORDINARY_FINAL.md`** is on the final build. Richie Amato, sociable, is seen eleven times. Charles ends knowing what Richie wants, that his racket is thin, and that he'll pass on what he hears. Richie trusts him with a job. Their temperaments don't match, so warmth (trust, affection) barely moves.
- **`RUN1_ORDINARY.md`** is on the build before the last four fixes. Marty Ferrara, ambitious and unsociable, is seen eleven times, and is ordered killed by Daniel's own captain on day 14 (the world's doing). Marty tells Daniel he can't stand Paulie, then that he can't stand Lou.

## 6. Ordinary-game playthroughs

`RUN3_ORDINARY_FINAL.md` and `RUN1_ORDINARY.md`. Both are new games with random seeds, 30 days, in the running game, using the new screen for everything:
- crew (evenings, a bag run, a delivery, an order to kill);
- business (tips bought, protection put to five shops, with counter-offers, refusals and negotiations);
- organisation (asking about advancement; the answer moves from "unproven" to "trusted");
- personal (as above);
- what came to the player unprompted (a tip for sale, christenings, a wedding, a man in jail, a brother in trouble, Sunday dinner with the player's mother).

The disputes are in `RUN2_DISPUTES.md`:
- **Test D:** repeated delays.
- **Test B:** a disagreement taken over the captain's head.

## 7. Regression results

**On the final tree:**
- **Typecheck:** clean.
- **Full suite** (`npm run test:all`, 290 s): **437 passed, 0 failed, 14 skipped.** The 14 are the opt-in long runs tagged `slow`, which run only with `SLOW=1`; this is the documented intentional skip.

**What the suite covers, by requirement:**
- **Determinism:** `determinism.test.ts`, and the conversation layer's same-seed runs.
- **Save/load compatibility:** `saves/oldsave.test.ts` loads genuine old saves, including schema 2. "Told it was done, he does not ask again; the visit remembers across a save" round-trips a visit's memory.
- **No private information in choices:**
  - news names a man only if the speaker knows him;
  - Confront offers only what the player knows (`a visit, over time`);
  - nothing on any screen uses the machinery's words.
- **Worlds without the layer unchanged:** the conversation integration tests run worlds without `World.social` and compare.
- **The old interface:** the dialogue suite (`src/tests/dialogue`, old screen and engine) passes unchanged. `talk.ts`'s one hook is inactive unless the new screen sets it.
- **New in this pass, 10 tests:**
  - evenings turn on different things in his life, not the same one twice unchanged;
  - delays remembered and increasingly costly;
  - one answer for report and outcome;
  - Confront on his word, answered for himself and on record;
  - Confront only on what the player knows;
  - going over a captain's head, its cost, and the captain's next greeting;
  - "Not now";
  - a slight remembered in the next greeting;
  - nothing unaffordable, and titles said;
  - no "how do you find working for him" after "I've no use for him".

**Performance:**
- **120 simulated days:** 9.7 s without the conversation layer, 11.6 s with it (as before this pass).
- **A visit screen in a 30-day world:** about 2 ms to open, 5 ms for "What's new?", 2 ms back to the headings. That is up from 0.6 ms before the headings, because every screen now also asks the old engine what is between the two men. A cache within each screen cut the first measurement (60 ms) to this. It is well below anything a player would notice.

**Save growth:**
- **The conversation records:** 46 KB after the scripted month in the dispute scenario.
- **Visit memory (`talks`):** 2.1 KB of that. It is bounded at 24 topics and 12 lines heard per man.
- **Seed 19 at 180 days:** the same caps on every collection as before. Nothing new grows without bound.

## 8. Remaining limitations

**Content, not structure:**
- **Ordinary evenings with men who have nothing fresh on their mind** are still the old topics (the fights, the Yankees), about four in ten.
- **Warmth comes slowly or not at all between ill-matched men.** That is the world's own rule (compatibility), and I have left it.
- **The old engine's own repeated lines:**
  - the boss's "Nothing now. Don't look for work. It finds you." every week;
  - "Nobody puts a name forward on what you've passed up so far." every time;
  - a guarded answer asked twice is the same line twice.

**Presentation, partly addressed:**
- **"Other business…" can list ten or more things** for a boss. It is the full plausible list, as the brief asks, but long.
- **Some old-engine subject titles still read as titles** (with "About" in front).
- **Old-engine requests are raised with their title as a choice** if you step away and come back ("About what he asked: …").

**Not done:**
- **Confronting a superior** uses the same subjects as anyone else. There is no different register of what may be said to the man above you.
- **"Confront" has no approach layer of its own** (persuade, pressure) after the first answer. It returns to the heading.
- **Family (a mother's Sunday dinner)** is still its own screen, outside the conversation screen.

**Recorded in the runs:**
- Days 10–12 of Run 1 passed without the routine (a script artefact).
- Run 2b shows a fall in Louie's trust whose cause the transcript does not show.

## 9. Recommendation

**Gate 3 is ready for your sign-off playtest. I recommend signing it off once you have played it yourself, with the content limitations above recorded as follow-up work, not Gate 3 blockers.**

**Why:** the brief's ten criteria, as the runs show them.
1. **Three or fewer intentions:** yes, in every visit.
2. **Relevant subjects without large menus:** yes, at most four, with the rest one step away. "Other business…" for a boss is long.
3. **Contextual conversations progress:** yes. Disputes, refusals, approaches and the old engine's negotiations all continue from what was said.
4. **Responses reflect world state and reasoning:** yes. Every reply in the conversation layer is a decision with a trace. The old engine's replies are its own.
5. **Previous interactions matter:** yes. Shown by greetings, delays, refusals, confidences, going over a man's head, and what the player has learned.
6. **All plausible actions accessible:** yes, through "Other…". Nothing the player can't afford or doesn't know is offered.
7. **No internal concepts shown:** yes. "It isn't true." is gone.
8. **Simple despite the simulation:** yes.
9. **Ordinary intentions in few selections:** usually two, one when he comes to you.
10. **Characters, not management:** for matters, commitments and the world's own events, yes. A month with a crew man now leaves the player knowing him: what he wants, who he can't stand, whether he'll pass things on. What is still thin is ordinary small talk when nothing is going on, and the warmth of the relationship itself, which the world's compatibility rule keeps low for ill-matched men.

**What would change my view:** if, playing it, you find the evenings with crew men still feel interchangeable. Then the next step is more for men to talk about (their past, their families, what they did that week), not more interface. That is content work for the existing subject engine (`talk.ts`), and I'd suggest it as its own piece of work after sign-off, not inside Gate 3.
