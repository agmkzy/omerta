# V90 acceptance audit — conversations

Branch `v90`, uncommitted. Nothing has been committed, merged or published.

## How this was tested (and what each kind of evidence can and can't show)

| Method | What it is | What it proves | What it can't |
|---|---|---|---|
| **Real interface play** | The built game in the browser at desktop size (1280×860) and phone size (375×812). A new character (Domenico Sorrentino), choices made by clicking, about two in-game days across several sessions: his boss, the Rackets tab, a protection negotiation with a shopkeeper (Nate Bruno) carried across three visits, a request from Richie Cassano, letting time pass | What a player actually sees and clicks; layout; navigation; continuity across visits | Breadth: a session reaches only a handful of men and situations |
| **Exhaustive explorer** (`src/tests/dialogue/audit.test.ts`, opt-in) | 55 staged circumstances × 2 worlds. On each, every option on every screen is tried breadth-first, each on its own copy of the world, then every follow-up, up to a budget; then a return visit 5 days later | Every reachable branch from those circumstances. Automatic checks: no reply, null outcome, contradiction, dead end, a promise with no record, database wording. Every distinct reply is collected for reading | Circumstances not staged; meaning (the automatic checks are lenient, which is why the replies were also read) |
| **Rule crawler** (`crawler.test.ts`) | 320 long conversations with randomly drawn temperaments, relationships and matters, with rules checked every turn | The rules hold across combinations nobody chose | Specific wording quality |
| **Scripted playtests** (`playtest.test.ts`, written to `docs/V90_PLAYTESTS.md`) | 11 scripted scenarios through the real conversation code, transcribed as the player sees them | The specific situations the brief asks for | Anything outside the scripts |
| **Controlled temperament experiment** (`agency/temperament.test.ts`, opt-in) | 320 shopkeepers and 406 made men from 8 worlds, grouped by the temperament they actually have, put through identical circumstances | Whether temperament changes *decisions*, not only words | Profiles that are rare in the population (marked "too few") |
| **World census** | 8 worlds × 120 days, V89 (`935c8a4`) against V90, about 40 measures | Whether the world stayed alive | Causes (each shift was traced in code separately) |
| **Acceptance and regression tests** (`acceptance.test.ts`, `regressions.test.ts`) | Player temperament, privacy, persistence across days and saves, adversarial play, and one test for each defect fixed | That fixed things stay fixed | — |

Everything below says which of these it rests on. Code inspection alone is never counted as tested; where something was only inspected, it says so.

---

## A. Actual player experience

*Evidence: real interface play, plus reading all 11 playtest transcripts and the collected replies from the explorer.*

**What works.**
- The hub is readable at a glance. A typical man shows four or five headed groups:
  - **He brings it up:** his request, or work he's offering.
  - **On his mind:** something he would talk about.
  - **Between you:** at most three open matters, plus "Other things between you (n)".
  - **Talk:** four fixed questions.
  - **Propose:** one or two things that fit who he is, plus "Something else in mind…".
- On a first visit a player can see why they came and what he wants. Subjects are written as things you would say ("I want to talk to you about Vitale's Pawn. About keeping it in one piece."), not as database labels.
- A negotiation is now a conversation about a point:
  - He gives a reason ("Where do you think I get that kind of money?").
  - Your answers test that reason ("You're doing plenty of business" → "Then show me your books").
  - What he says next follows from what was just said.
  - The best live example was Nate Bruno across three visits. "Like I told you, I can't afford it." → "You're doing plenty of business" → "Business is… all right. Some weeks." → books refused → "…Maybe I can find something." → he names $50. On a later visit he opens with "You've seen enough. You know what I can do." → accepted: "Good. Then we understand each other."
  - That exchange reads like a scene, and nothing in it was scripted for Nate.
- Pacing is good. Every turn costs minutes, patience runs down visibly, and pushing a proud man ends the conversation for the day ("I told you once today. Out.").
- On the phone layout, conversation rows stack cleanly and nothing scrolls sideways.

**What is weaker (critical, not promotional).**
- **Small talk is thin.**
  - "How are you keeping?" / "Heard anything?" / "What do you make of…?" are reliable but short, and a few lines repeat across men of the same temperament (e.g. "Nothing. Nothing's going on," says Jimmy, too quickly).
  - Between matters, a conversation can feel like a menu being emptied rather than talk that goes somewhere.
  - Small talk mostly opens a subject when he *has* one (his trouble, his kin, his racket, a man leaning on him). Most men, most days, have one or none.
- **The point-in-hand model only covers negotiations.**
  - Asks, protection, loans, favours, amends, warnings and recruiting all use it.
  - The older menus (crew management, debts, the boss's Sunday envelope, shop dealings) are coherent and spoken, but they are still one move and one answer.
- **Some options are rarely seen.** Some of the best writing sits behind circumstances the player meets rarely: a frightened man stalling, a proud man who could pay, kin out for revenge. Section B lists them.
- **The two routes to protection don't feel like one.**
  - The **Rackets tab** still offers protection as a button ("Do it myself"), separate from proposing it in conversation.
  - Both now lead to the same negotiation, and the Stories view sends you to "Go and see" the man.
  - It still feels like two systems that meet in the middle.
- **Repetition is controlled but not absent.** Used options grey out and a line is not repeated within a conversation. Across many visits to the same man, his openings do recur.

---

## B. Coverage

*Evidence: the exhaustive explorer, compared with an inventory of every conversation action defined in the source.*

| | Count |
|---|---|
| Conversation actions found in the source (all menus, his subjects, matter options, negotiation moves, replies to his point, his requests, flow follow-ups) | **243** |
| Actions actually exercised by the explorer | **216** (89%) |
| Distinct conversation states explored | 5,244 |
| Transitions taken | 27,664 |
| Conversations played to their end | 194 |
| Distinct action codes exercised | 276 (an action can appear under several codes, one per matter or request) |
| Exercised and failed an automatic check | 1, `cr_look`, judged correct on reading (section C) |
| Rule-crawler conversations (random temperaments and matters) | 320 |
| Scripted playtest scenarios | 11 |

### By category

| Category | Exercised |
|---|---|
| Point-in-hand replies (answering his stated reason) | **16 / 16** |
| His requests (yes / counter / stall / no) | **4 / 4** |
| His own subjects (his trouble, his kin, his racket, what he wants, a man leaning on him…) | 34 / 35 |
| Matters he is in (feuds, arrests, revenge, ambition) | 19 / 22 |
| Negotiation moves | 8 / 9 |
| V90 hub and subjects | 17 / 20 |
| Flow follow-ups (standing, threats, backing, recruitment) | 15 / 17 |
| Older menus: the first screen, personal, family, disputes, incidents, subject, rival, debt, his boss, pickers | 67 / 72 (fully: personal, family, disputes, subject, rival, debt, his boss, pickers) |
| Older menus: business, amends, crew, orders, memos | 24 / 31 |
| Older menus: shop dealings | 2 / 6 |
| Older follow-ups | 10 / 11 |

### Unexercised, and why

| Action | Where | Why it wasn't reached |
|---|---|---|
| `rule` | a feud between two of your men | Offered only from the Stories view, not in conversation (by design) |
| `upstairs`, `leash` | your own feud, taken to the man above; a revenge, taken to the avenger's boss | Staged, but the explorer's budget ran out on the higher-ranked man's longer hub before reaching them. Inspected only |
| `senior` | bringing your boss into a negotiation | Needs a boss who will lend his name at that moment. Inspected only |
| `heard` | "I heard he came round", to a man who hasn't told you he's being leaned on | Needs low trust *and* the player having heard; the stage gave trust 0.7 |
| `th_hear`, `th_hold` | answering a threat made to you | Need a live threat against the player. Inspected only |
| `earn`, `offer_loan`, `partner_chop` | business talk | Need a partnership or a business in a particular state |
| `sh_back`, `sh_lean`, `sh_time`, `sh_why` | shop dealings (late envelopes) | The late-envelope stage resolved through the new negotiation first |
| `cr_money` | your own man's earnings | Needs a crew member with a recorded shortfall in the books |
| `report`, `answer` | reporting a finished order; answering a memo question | Need an order completed off-screen, or a question memo |
| `find`, `p_owner`, `a_start`, `f_hurt` | incident follow-ups | Exercised in an earlier run (audit 7) but not reached within budget in the final one |
| `ask_history`, `intro_via`, `rk_back_ask`, `word_make`, `sit_rival` | rarer older options | Need history, a go-between, or a rival business |

None of these is known to be broken. "Inspected only" means I read the code that handles them and nothing more.

Two kinds are **not reachable in conversation by design**:
- `rule`: settling a feud between two of your own men. It is offered from the Stories view, without anyone in front of you.
- `sit_rival`: it applies only to the man's rival business when his shop is in trouble.

These are counted as unexercised rather than excluded. **No action was found to be obsolete**: every one in the inventory is still offered somewhere.

---

## C. Defects

*Evidence: each was reproduced, either in the real interface (UI), by the explorer (E), by the crawler (C) or in a scripted playtest (P), before being fixed.*

### Critical (the player is misled about what is happening, or the game state goes wrong)
None was found in V90's conversation code. In the scripted playtests, two of my own staged requests gave the game data it never produces: an invented encounter type, and a loan with no amount. Once corrected, they turned up three real defects, listed below (16–18).

### Major (incoherent exchange; a player would notice and lose trust in the dialogue)
1. **(UI)** On day one, his own boss showed "What he did to you". The record of who owns what was being treated as a grievance.
2. **(UI, E)** Refusals did not fit what was asked or who was asking:
   - a boss turning down his own associate said "Get out of here";
   - an apology was refused like a business deal;
   - a man apologised to sent for his protector.
3. **(UI)** Asking the boss for work: "He thinks, then names something. He'll send word." He never said what the work was.
4. **(UI)** After he named his figure, "Then what can you manage?" was still offered, asking for the figure he had just given. Once he had been caught out, you could call him on it again.
5. **(UI)** The conversation did not hold its place across visits: he didn't restate the point he had left the matter on, and the time of day in the opening was wrong.
6. **(UI)** Your answers to his requests were commands ("Agree", "Refuse", "Buy time"), not things you would say, and naming your own figure didn't say the figure.
7. **(P)** Work an NPC had offered you was not raised when you saw him. It sat in a list.
8. **(E)** A man you had already put terms to, or a man in your own crew, was treated as a stranger.
9. **(E)** Recruiting: an uninterested man still said the eager line ("I've been waiting for somebody to ask").
10. **(P)** Your opening line on a matter was printed as his reply.

### Moderate (wrong words; the exchange still makes sense)
11. **(UI)** He spoke of himself in the third person ("Nate beat Nate up"). The rule that shortens a repeated name produced "He's smile goes".
12. **(E)** Every relative with the same surname was a "brother", including women, and was called "he".
13. **(E)** Questions such as "What do you make of the others?" got no spoken reply before the list.
14. **(E)** Old memo records appeared in "between you" as raw entries.
15. **(E)** Two men described their friends or brothers in identical words.
16. **(P)** A man asking for a loan: "It's I have a way to turn it over…". This is the V85 known bug ("It's the car is finished…"), and it now surfaces inside conversations.
17. **(P)** Asked what the money was really for, a man with a grievance said "It's resentful." Others said "It's in debt to someone dangerous."
18. **(P)** After "What's it really for?" his request dropped out of focus, and you were back at the hub with his request no longer in front of you.
19. **(E)** "I'll look after you myself", said to a man someone else is leaning on, was offered even when he wouldn't hear another offer from you so soon. Picking it got only "Not now. Too many people want something from me this week." That made it a null option.

### Minor
20. Interface leftovers: "inbox" text in jobs, meetings and the voice sheet, and story tags shown in conversation rows.
21. Straight quotes mixed with typographic quotes in some lines.

### Found and judged not to be defects
- **`cr_look` flagged by the explorer as "promise left no record".** "I'll look into it myself" is done on the spot: you ask round and learn his trouble at once. There is nothing left to promise, so no record is correct.
- **No shopkeeper stalls on a stranger's protection demand** (0% across 320 in the experiment). A man stalls only when he is afraid of you (fear above 0.35 and resolve below 0.6). Staged with a frightened shopkeeper, he does stall (section B). This is a design threshold, not a fault.

---

## D. Fixes

The brief asked for root causes, not patched lines. Each fix below changed the rule that produced the defect, and each has a regression test in `src/tests/dialogue/regressions.test.ts` (or `acceptance.test.ts`) written as the rule, not the example.

| # | Broken | Why | Changed | Verified |
|---|---|---|---|---|
| 1 | Ownership shown as a grievance | Every fact between two men was a possible "incident" | A `TROUBLE` set of fact kinds that can be grievances; records (ownership, terms, levies, favours) are `BORING` (`dialogue.ts`) | Regression test; the boss on day one in the UI |
| 2 | Refusals unfit for the ask | One pool of refusal words for every ask | Every ask has a class (demand / request / offer / claim, `exchange.ts`). His words are composed from the class, the rank between you and his mood (`react.ts`). Calling for help is only for demands | Regression tests (apology, above-rank refusal); crawler rule on every turn |
| 3 | Work never named | The job text went to an inbox, not into his mouth | `jobSaid(j)` speaks the job; used by "anything you need done", the envelope and his job door | Regression test; checked in the UI |
| 4 | Answers that ask what he has just said | Replies were offered by claim alone, blind to the state of the exchange | `replies()` filters by what has already happened (`exchange.ts`) | Regression test; crawler rule; Nate Bruno in the UI |
| 5 | Lost place across visits | The point in hand was not kept with the matter; the opening used the wrong clock | `s.m.beat / claim / caught` are kept with the matter and restated on return; `arrive` uses the time after travel | Persistence test across days and a save/reload; the UI over three visits |
| 6 | Commands for answers | Labels were button names | Spoken labels with the real figure (`asks.ts askPlayer`) | Audit wording check; UI |
| 7 | Offered work not raised | Jobs offered by NPCs were outside the conversation's subjects | A job door in "He brings it up", with take/pass answered to his face | Regression test |
| 8 | Strangers who weren't | `introduced()` only knew formal introductions | Includes men you've put terms to and your own crewmates | Regression test |
| 9 | Eager line from the uninterested | Preamble chosen before the decision | Preamble only when interested (`flows.ts`) | Regression test |
| 10 | Your line as his | The subject opener returned one list | `openSubject` returns your line separately (`Said.q`) | Regression test |
| 11 | Third person, "He's smile" | Name substitution by text replacement without grammar | A clause-aware rule: his own name becomes "I" at the start of a clause and "me" as the object; a possessive becomes "His" | Regression test |
| 12 | Sisters as brothers | Kin role taken from the surname alone | A female first-name list; sister role; she/her in kin talk | Regression test over the whole world |
| 16 | "It's I have a way…" | Loan reasons were fragments pasted after "It's" | Every reason is a whole sentence in his mouth (`encounters.ts`) | Regression test over every problem kind |
| 17 | "It's resentful" | The third-person problem label was reused as his admission | A first-person admission for each kind of trouble | Same test |
| 19 | An option that could only be refused | The option didn't know about the cooling-off period that stops an offer being repeated | `mayAsk()` (`asks.ts`) says whether an ask can be put now; the option is offered only then (`talk.ts`) | Regression test; explorer rerun shows no null outcome |
| 18 | Request lost after a question | Answering any request reset the subject | An unanswered request stays the subject (`dialogue.ts`, the `enc` case) | Same test; playtests 8 and 10 regenerated |

**World-health correction.** The first version of temperament-driven feuds cut rival strikes by 76% and halved grudge escalation. Three weights were restored to V89's (the friendliness/fear baseline in `freshStance`, the slight weight and the peace weight), keeping only the steering by caution. Section F has the result.

---

## E. Temperament results

*Evidence: the controlled experiment. Men taken from 8 real worlds by the temperament they actually have, put through identical circumstances.*

### A protection demand (the same fee relative to his takings), three ways (320 shopkeepers)

| Profile | n | First answer: counter / no | After pressure: counter / no | After reasoning: counter / no |
|---|---|---|---|---|
| proud and courageous | 11 | 0% / 100% | 0% / 100% | 0% / 100% |
| proud and cowardly | 19 | 11% / 89% | 21% / 79% | 16% / 84% |
| agreeable and ruthless | 40 | 25% / 75% | 23% / 78% | 28% / 73% |
| courageous and cautious | 41 | 2% / 98% | 7% / 93% | 7% / 93% |
| volatile and empathetic | 8 | 13% / 88% | 25% / 75% | 38% / 63% |
| meek (cautious, timid) | 17 | 29% / 71% | **47%** / 53% | 29% / 71% |
| everyone | 320 | 19% / 81% | 26% / 74% | 24% / 76% |

How to read it:
- A proud, brave man never bends. A meek man bends under pressure (47% name a figure).
- An agreeable man looks for terms from the start.
- A volatile but empathetic man is moved by reasoning, not by threats (38% against 25%).
- Nobody says yes outright to a stranger at this fee. That is the design: a shopkeeper doesn't pay a man he doesn't know.

Their words differ by temperament as well as their decisions. Under the same pressure:
- a proud man: "You think that scares me? I've been threatened by better. No.";
- a cowardly one: "Please. Don't do this. The answer's the same.";
- an agreeable one: "Look, I want this to work. I can do $35 a week."

### Men in the life, on their own (406 made men)

The same grudge, the same feud and the same offer of peace for every man:

| Profile | n | In a feud: strike / slight / ally | Accepts peace | Would talk if arrested |
|---|---|---|---|---|
| hot (volatile, brave) | 110 | **23%** / 61% / 16% | 79% | 0.02 |
| volatile and empathetic | 45 | 19% / 67% / 13% | 84% | 0.04 |
| proud and courageous | 100 | 14% / 70% / 16% | 64% | 0.02 |
| courageous and cautious | 95 | 14% / 45% / **41%** | 95% | 0.02 |
| cautious and ambitious | 61 | 10% / 47% / 43% | 87% | 0.03 |
| proud and cowardly | 27 | 3% / **87%** / 10% | 67% | 0.07 |
| meek | 10 | 3% / 40% / **58%** | 80% | **0.12** |
| sociable and manipulative | 18 | 16% / 68% / 17% | **56%** | 0.03 |

How to read it:
- Hot men strike; the meek find allies.
- The proud but cowardly man slights (87%): he wants to wound, not fight.
- Cautious men accept peace far more readily than proud or manipulative ones (95% against 56–64%).
- The meek are four to six times as likely to talk to the police.

**Two measures are not reported.**
- "Urge to hurt the man he hates" came out at 0.01–0.02 for everyone. This was the score of his best act of revenge on one particular day, and it doesn't measure what it claims to.
- "Would talk if arrested" sits at the floor (0.02) for most profiles, because boss trust is near its maximum in these worlds. That is an existing saturation problem (CLAUDE.md: "boss trust ~0.99 by day 35"), not a temperament result.

**Beyond the experiment**, temperament is read by:
- negotiations (resolve, anger and fear under each approach);
- feuds (`rivalChoice`);
- revenge (who among the kin answers, and whether he goes after the man or has a word);
- accepting peace;
- talking when arrested;
- his choice of words.

This was tested by the experiment and by the crawler, which draws random temperaments. It was also confirmed by code inspection: `temper()` is read in `asks.ts`, `matters.ts`, `react.ts` and `exchange.ts`.

**The player's own temperament** (acceptance tests, tested):
- It is not chosen. It grows from what the player does, read in context: force against a man who wronged you first reads as pride, not temper.
- It never removes a choice: two players with opposite records get the same options at the same moment.
- What nobody saw stays private until it travels. Fear, respect and trust stay separate.

---

## F. World health

*Evidence: 8 worlds × 120 days each, V89 (`935c8a4`) against V90 on the same seeds.*

| Measure (totals across 8 worlds) | V89 | V90 | Reading |
|---|---|---|---|
| Beatings | 283 | 264 | −7% |
| Vandalism | 367 | 371 | same |
| Robberies | 45 | 44 | same |
| Murders | 5 | 4 | small numbers |
| Arrests | 99 | 90 | −9% |
| Informants | 6 | 8 | small numbers |
| Protection started | 144 | 149 | +3% |
| Protection refused | 586 | 570 | same |
| Asks agreed / gave in | 1051 / 693 | 1065 / 773 | more give in under pressure (the meek) |
| Disputes | 173 | 172 | same |
| Feuds | 141 | 140 | same |
| Feud acts: strike | 199 | **106** | **−47%** |
| Feud acts: slight | 476 | 372 | −22% |
| Feud acts: undermine | 197 | 124 | −37% |
| Feud acts: ally / peace / nothing | 75 / 54 / 231 | 81 / 42 / 262 | more do nothing |
| Grudges ≥ 0.3 / ≥ 0.6 | 404 / 88 | 395 / **60** | deep grudges −32% |
| Revenge started | 11 | 7 | small numbers |
| Kin "have a word" | 13 | 8 | small numbers |
| Promotions | 88 | 79 | −10% |
| Climbing storylines | 65 | 58 | −11% |
| Sit-downs | 30 | 23 | small numbers |
| Poaching | 103 | 117 | +14% |
| Rumours | 2280 | 1987 | −13% |
| Family tension (sum) | 908 | 819 | −10% |
| Money in the world | $8.65m | $8.72m | +1% |

**What this means.** The world is as busy as before: the same number of feuds, disputes, protection rackets and vandalism, and the same money. Feuds are **less violent**:
- Rival strikes fell by almost half and deep grudges by a third.
- The cause, traced in code, is that each man in a feud now chooses by his temperament. Cautious men (a large share of the population) look for allies or wait rather than strike, where V89 gave everyone the same odds.
- I restored V89's weights wherever restoring them did not undo temperament. The remaining drop is temperament doing what it should, but it does make the world calmer.
- It was not "fixed" by adding violence, which the brief forbade. If you want feuds hotter, the lever is the share of hot-tempered men, not the decision rule.

**Revenge by kin.** Revenge storylines fell from 11 to 7, which is small numbers. A controlled test (the same beatings applied to the same men in both versions) shows kin respond as often as in V89: 70 of 70 either way, V90 45 revenge plus 25 words against V89 38 plus 32. The drop in the census comes from fewer beatings outside storylines, not from kin caring less.

---

## G. Representative transcripts

All complete transcripts are in `docs/V90_PLAYTESTS.md`, generated by the real conversation code, alongside the exchanges from browser play.

- **A natural everyday conversation:** playtest 1 (Jimmy Giordano, a nervous shopkeeper). Short and polite. It also shows the thinness of small talk with a man who has nothing on his mind.
- **A sustained negotiation:** Nate Bruno in the browser, across three visits (quoted in A), and playtest 3 (Frankie Vitale): offer → "Where do you think I get that kind of money?" → "You're doing plenty of business" → "You see customers. You don't see what I owe my suppliers." → "Then show me your books" → "Since when do I have to show you anything?" → "Then I'll take it you can pay" → "Take it how you like. It won't make the money appear."
- **A failed negotiation:** playtest 3 continues: a threat → "Who do you think you're talking to?" Frankie has people, and he means to use them. "That's enough. Get out."
- **A successful compromise:** Nate Bruno settles at $50 ("Good. Then we understand each other."). In playtest 2, Lou Ferrara counters at $25 "That's what the place can carry", and accepting it is offered as "All right. $25 a week".
- **An NPC-initiated request:** playtest 8 (Teddy Lucchese). He opens with his own loan request, and it is the subject at once. Asked what it's really for, he admits the truth in his own words, and his request stays in front of you.
- **Several matters:** playtest 2 (Lou Ferrara): protection, a favour he owes, money he owes and bad blood, three shown plus "Other things between you (1)".
- **An interruption:** playtest 10 (Mario Neri). Mid-subject, he breaks in with a loan request of his own; you answer it, then go back to protection where you left it.
- **A revisited conversation:** playtest 6 (Frankie Vitale, four days on): "Like I said. I haven't got it." The same answers to his point are still offered.
- **A temperament-driven conflict:** playtest 5, the same demand to the same man with three temperaments:
  - meek: "I don't know who you're with" → under threat, "I can do $35 a week";
  - proud: "Get out of here. Why should I listen to you?";
  - agreeable: looks for terms.
  - Playtest 9 (Mario Neri, proud and volatile): pushed to wrecking his place, he throws you out and won't talk again that day.
- **Previously failed, now works:**
  - The boss asked for work used to answer "He thinks, then names something." Now he says, for example, "I need somebody to spend a week at The Gilded Lily. It's yours if you want it."
  - A loan request used to read "It's I have a way to turn it over". Now: "I have a way to turn it over. I just need the stake. $550, and I'll make it right."

---

## H. Outstanding limitations

1. **Coverage is 89%, not total.** Section B lists every unexercised action and why. None is known to be broken, but those not reached have only been inspected.
2. **Feuds are calmer than in V89** (strikes −47%). This is deliberate, and it is a balance change you should decide on.
3. **Talking to the police is at its floor** because boss trust saturates. That is the existing integration gap from the V85 playtest. Defer it to the informant work in the roadmap.
4. **The older menus are coherent but single-move.** Crew, debts, the Sunday envelope and shop dealings don't use the point-in-hand model; negotiations do.
5. **Small talk is thin** for men with nothing on their mind.
6. **Two routes to protection** (the Rackets button and conversation) meet in one negotiation but still feel separate.
7. **Real interface play covered about two in-game days with one character.** Most breadth comes from the explorer and crawler, which use the same code but not the same screen.
8. **Long-run play with the new conversation system** (35+ days, as in the V85 playtest) has not been done. The census runs the world for 120 days, but without a player talking.
9. **Measures dropped as unreliable:** the revenge "urge" in the experiment.

## The five questions

**1. Is the conversation interface genuinely easier to use?** *Yes, tested in the browser on desktop and phone.*
- The hub groups say what each thing is (his business, yours, talk, proposals), the subject in hand is always named, and there is always a way out.
- "Something else in mind…" and "Other things between you (n)" keep it uncluttered.
- The remaining confusion is the second route to protection through the Rackets tab.

**2. Is the dialogue consistently logical?** *Mostly, tested.*
- Within negotiations, yes: the crawler checks the rules on every turn of 320 random conversations, and the explorer read every reply.
- Every incoherence found (section C, 1–19) was fixed at its rule.
- Outside negotiations the exchanges are coherent but shallow.

**3. Does every available option work?** *Every exercised option works; 27 of 243 were not reached.*
- Of the 216 exercised, one was flagged and judged correct on reading (`cr_look`).
- No null outcomes remain in what was exercised. The one "Nothing comes of it." found came from my own staging, not the game.

**4. Do NPCs feel like distinct people?** *Yes in decisions as well as words, tested by controlled comparison (section E).*
- Proud men never bend and the meek do. Hot men strike and the cautious find allies. Cautious men make peace.
- Feuds became calmer as a result.

**5. Does it make OMERTÀ a better RPG?** *Yes, partly tested and partly judgement.*
- **Tested:** a conversation now reveals the world. He tells you who is leaning on him, who owes him, who his brother is and what he wants, but only what he knows. Each disclosure opens something you can act on.
- **Tested:** what you say has consequences that last. His point is remembered across visits and saves, grudges and conduct are recorded, and a man you push will not talk to you that day.
- **Judgement:** the weakest part is the everyday: men with nothing on their mind have little to say.
