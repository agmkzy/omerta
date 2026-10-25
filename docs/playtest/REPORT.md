# OMERTÀ: comprehensive player-experience playtest

**Build:** `main` at dcd3718 (the deployed build: Gate 4 conversation, UI rebuild, portrait rework). Dev server, Chrome-based browser pane.

**Four playthroughs, each a new game in its own browser origin:**

| | Origin | Approach | Background | Screen | Length |
|---|---|---|---|---|---|
| **A** | `a.localhost` | Cooperative operator | Small Businessman | Desktop 1440×900 | Day 0 to day 16 |
| **B** | `b.localhost` | Aggressive criminal | Connected Family | **Phone 375×812** | Day 0 to day 11 |
| **C** | `c.localhost` | Ambitious climber | Bookmaker | Desktop | Day 0 to day 93 |
| **D** | `d.localhost` | Passive observer | Street Hustler | Desktop | Day 0 to day 84 (12 weeks of waiting) |

**Method:**
- Decisions were made from what the screen showed.
- A small page helper listed the visible buttons and choices with their labels, and clicked them. It read the screen, never the game state.
- Source code was read only *after* observing a behaviour, to find its cause. Those findings are marked **(code)**.
- Full chronological notes are in `docs/playtest/diaries/`; screenshots are in `docs/playtest/screens/`.
- Nothing in the game was changed.

---

## A. Executive assessment

1. **Is it enjoyable to play?** In patches. The first evening is intriguing, and some scenes are excellent:
   - the christening;
   - Vincent's "They had you for 35 days. What did they want, and what did you give them?";
   - Teddy waiting for "the or else";
   - small talk "about the weather, the Mets, the price of everything".

   But the experience keeps breaking. A man asks you for help against yourself. Your captain thinks you refused a job you finished. A month disappears in one click. Every debtor and every soldier says the same sentence. After the first few hours the main loop is waiting and repeating, not choosing.
2. **Does the world feel coherent?** Locally, often; globally, not reliably.
   - **What works:** chains of cause and effect exist and can be traced. A shopkeeper goes to his protector. A beaten man goes to his captain, who settles it. Heat brings arrests, arrests mean missed envelopes, and missed envelopes bring punishment and a lost backer.
   - **What breaks it:**
     - the same events are told inconsistently from screen to screen;
     - jobs are offered that were already taken;
     - the player is confused with other men;
     - time passes in leaps the player can't see.
3. **Do the NPCs feel like individuals?** In first lines, sometimes: a nervous man's "Fine. Fine. Everything's fine with him", Teddy's watchfulness. In substance, rarely.
   - Debtors share one script ("$500, last I counted. I'm paying, aren't I?" / "There's nothing to take. Do what you have to.").
   - Four soldiers refused my request for backing with identical words.
   - Two captains in different games made the same request in the same words ("I know you know a lawyer, and a clerk who knows a judge").
   - Personality changes the greeting and the odds, but seldom what a man says or wants.
4. **Do conversations feel meaningful?** Some single exchanges do. The system as a whole doesn't yet:
   - every negotiation after the first argument says "you're repeating yourself" ("Keep up", "Again? We just did this", "Short memory?");
   - lines are reused across situations (a protection pitch used to tell a man to stop collecting);
   - a captain recites spreadsheet figures ("$0 of $3,000… 1 of 3");
   - a man can be informed on with nothing said, for repeatable trust;
   - commitments the player makes are often recorded nowhere he can see.
5. **Do decisions produce understandable consequences?** Consequences exist and are often sensible. They're poorly *communicated*:
   - $248 left my pocket to settle a beating with no prompt or notice;
   - a 33-day jail term was summed up as "Something has come up";
   - standing moves up and down with no reason given;
   - a reprimand happened "off-screen".

   The player has to dig through the Journal to learn why anything happened.
6. **Does the game provide compelling progression?** No.
   - The ambitious playthrough C was still an associate after 93 days.
   - Accepting work from your captain in conversation doesn't count towards being made **(code)**.
   - The backing requirement is opaque ("a few weeks of that") and was withdrawn without explanation.
   - Promotion money can be bought with gifts.
   - A legal day job pays about 10× a racket with no limit.
   - Hidden "ambitions" pay bonuses for things the player didn't choose.
7. **Greatest strengths:**
   - a real, autonomous world underneath: protection churn, Commission rulings, raids, arrests, levies, captains who notice neglect;
   - knowledge as a mechanic;
   - consequence chains that can be traced;
   - moments of genuinely good period writing;
   - the rebuilt interface, which held up on desktop and phone.
8. **Greatest weaknesses:**
   - the conversation system's coherence: repeated lines, wrong templates, self-reference, false "you said that already";
   - consequences the player is never told about;
   - a progression path that is broken and opaque;
   - interchangeable NPC voices;
   - several exploits that cheapen money and trust.

**The ultimate question.** Today OMERTÀ presents a collection of interconnected mechanics that *simulate* a criminal underworld. The simulation underneath is more alive than the experience on top suggests. The player rarely feels it as a believable, reactive world, because what reaches him is either repetitive, contradictory, or reported too late and too quietly. It is closer than it looks: most of the damage is in a small number of systematic faults, not in the underlying design.

---

## B. Playtest diary (condensed; full diaries in `docs/playtest/diaries/`)

### Playthrough A: Lawrence Oliveri, cooperative (desktop)
- **Day 0, 08:00. My captain, Rocco Neri, at the barber shop.**
  - He "likes" me on day 0 and offers a job: bring Lombardi's Jewellers under the family.
  - The obvious follow-up option makes me say "You had something for me?", and Rocco answers "We just went over that. Short memory?"
  - Asking what it takes to rise gets "$0 of $3,000 passed up… 1 of 3."
  - Asking him to "put in a word" is granted instantly ("I like you").
  - "There's something you ought to know about a man" lists five men, including his own boss. Choosing a name with nothing to say earns Trust ▲ and Respect ▲, repeatable for every man in the list.
  - His "What's new?" news is that Ralphie has already taken on Lombardi's Jewellers, the shop he just asked me to bring in. The follow-ups treat this open deal as an unsolved crime ("Doesn't sound like Ralphie. Somebody's stirring.").
  - Buying him a drink at 8 a.m. jumps to "the evening at the club" and closes the visit before I've answered the job.
- **Day 0, evening. Louie Valenti at the club.**
  - He refuses to back me, in sensible terms.
  - He listens to my first argument for a loan. Every argument after it gets "Keep up" or "Again? We just did this", and then the options cycle forever.
  - As the victim of the billiard-hall affair, asked "What are you going to do about it?", he answers "If it were mine…". It is his.
  - He suggests I could talk to Teddy, but no option lets me, and the story page says "It is between Louie and Teddy."
- **Day 1, 00:04–03:56. Mickey Rizzo (I own a tenth of his shop), at his home in the middle of the night.**
  - The stake appears nowhere on his page.
  - My protection pitch is sensibly refused.
  - His news is "Lawrence wants money off me… Can you do anything?" I'm Lawrence. I promise to make "him" stop, and the promise is recorded nowhere I can see.
- **Days 2–6.**
  - "Next event" waits a full day each time and says "Nothing stirs" while new offers arrive.
  - Mickey follows up on my promise ("is anything happening?"). There's no way to admit it was me, and "Something else…" discards his question for good.
- **Day 6, Sunday.**
  - The christening is excellent.
  - Sonny's inspector problem is solved with a word.
  - Louie's tip is refused at half price, and the V85 haggling bug didn't appear.
  - A "Friday night" delivery is done on Sunday afternoon.
  - Envelope in person: "That's what I wanted to see."
- **Day 6, evening. Teddy Sorrento.**
  - A good scene, and I promise to tell Louie to back off.
  - Louie's options run out after two lines, leaving only threats, violence (against a made man of my own family, with no men of my own) or a lie ("Rocco is behind this"). The lie "goes round", and Rocco never reacts to it.
- **Days 7–14, a full week.**
  - Mickey's protector Danny warns me off, in the identical line I had used on Louie ("Mickey is with me. Leave it alone.").
  - Mickey asks "Lawrence's people haven't been back. Was that you?"
  - Rocco asks me to spring Dom Sorrento ("I know you know a lawyer…"), and offers "Mickey Rizzo's having trouble with Lawrence Oliveri. I want to bring it to the family." I would be reporting myself to my captain.
  - Calling in the favour Rocco owed me, minutes after earning it, is refused sensibly. A follow-up then offers to threaten my own captain.
- **Days 14–15.**
  - The driving job can be worked back to back with no limit: $480 in 24 hours, the same sentence four times.
  - Teddy greets me cheerfully and complains in the same breath. Under Confront my apology becomes a negotiation ("What's the catch?") that I settle for $150.

### Playthrough B: Albert Notaro, aggressive (phone)
- **Day 0.**
  - Rackets says protection "isn't open: no shop worth leaning on", while Burglary lists three unprotected shops and the guide sends me to protection.
  - Smash-and-grab burglary: "$950 in goods".
  - Bobby Russo offers $35 a week before I name a figure. Threatening him gets the same $35.
  - He then borrows $550 at 260% a year from the man who just threatened him, Trust ▲, and at once repays $450 of it.
  - I beat him up. Heat: "Hot".
- **Days 1–3.**
  - An "ambition" I never chose pays out for the extortion.
  - "Marty Sorrento took you to task", off-screen.
  - "Stevie Palumbo (Corrente) took Russo's Meats from you (Corrente)", with no reason given.
  - Marty's "coffee at the club" summons turns into a "Corrente family meeting" with the boss alone. It reads out raw log lines ("You now collects $35 a week…") and the boss never mentions the beating (screenshot B-01).
  - Marty then asks how his own coffee went, and praises my obedience.
- **Day 3.**
  - Telling a rival associate on his own ground to "keep off our ground" is sensible.
  - Beating him "with nothing specific you can point to" is allowed.
- **Days 3–10, a full week.**
  - "−$268" with no explanation. The Journal shows his captain "brokered an end to it; $248 paid", with my money and on terms agreed for me.
  - Nobody needs a loan, in this game as in A.

### Playthrough C: Pasquale Castiglione, ambitious (desktop)
- **Day 0.**
  - I start a book.
  - My captain's first job is the same template as in A, and so is the "We did that one" contradiction.
  - I accept it, but the job appears nowhere. I pressure the shop myself and it pays $80 a week.
  - The captain then says "I had something for you. You didn't want it, I suppose", and my page shows "0 of 2 jobs finished". **(code)** A job taken in conversation can't be completed or shown; only jobs taken from World's offer list work.
  - My debtor Tony "hasn't met" me, though the background says I've dunned him for years, and he speaks Bobby's exact lines.
- **Week 1.**
  - Jobs from World work and count.
  - I'm offered a job **by myself** and paid by myself ("Pasquale pays you $360 plus a bonus"), and it counts towards being made.
  - Hidden ambitions pay out three times.
  - A $1,000 "personal" gift counts as money passed up, and the captain explains the mechanic aloud.
- **Week 2.**
  - Truck hits on Santangelo-protected businesses; heat "Burning".
  - A summons from my captain says he "isn't available". Raised in conversation, the same summons becomes a "job" I "take care of".
- **Days 13–46.** One click of "Next event" jumps 33 days. I was arrested, and World says "Something has come up." Then an excellent debriefing scene with my captain.
- **Days 46–93.**
  - Rich autonomy shows in the Journal: a Commission ruling, cross-family takeovers, raids, the boss beating one of his captains.
  - Arrested again. Missed envelopes ($1,007 and $1,158 "light"), share raised twice, backer withdrawn.
  - Garbled lines: "Artie Rizzo got a lesson from Artie Rizzo took Frankie Marino to task…".
  - Day 93: still an associate, "0 of 3, and nobody to speak for you."

### Playthrough D: Saverio Parisi, passive (desktop)
- Twelve weeks of "A full week". About one item a week reaches World:
  - −$20 every week, unexplained;
  - standing drifting with no reasons;
  - my captain twice "raised your share for ignoring him", a good consequence;
  - the same wedding invitation twice.
- After 3 months, Stories says "Nothing is running." 10 of 13 known facts are about protection being asked, refused or taken, and all families are "calm".
- From the passive chair the world is static and monotone. That's partly by design, since knowledge requires presence, but nothing else reaches the player either.

---

## C. Conversation coverage

**Legend:** ✔ exercised and recorded · ◐ partly (the branch opened; not every sub-branch) · ✘ not reached, with the reason.

| NPC (role, relationship) | Playthrough | Business | Personal | Confront | Notes |
|---|---|---|---|---|---|
| Rocco Neri (my captain, friendly) | A | ✔ all 4 top + all 10 of Other business, incl. rate haggle (respect, sweeten shown, drop), borrow ◐ (not executed), tribute ✘ (cost), recommend ✔, pick_concern ✔ ×5, job offer ✔ (take/pass/back) | ✔ trouble (listen ✔, straighten ✘), news ✔ + all 5 follow-ups, spend ✔, Something else personal ✔ all 8 | not offered | envelope ✔; Dom favour ✔; favour call-in ✔ (refused); "report myself" intervene ✔ (accept decision) |
| Louie Valenti (soldier, stranger then acquaintance) | A | work ✔, rk_back ✔ + back_what ✔, promo ✔, loan:500 ✔ (all 4 args), pick_concern ✘ | pick_incident ✔ + all 3 follow-ups, tk:boss ✔; Something else personal listed ✔, items ✘ (seen with Rocco) | ✘ not offered | "Leave Teddy alone" demand ✔ (ask, asking, persuade, senior-lie, drop); pressure/force ✘ (would harm a made man of my own family) |
| Mickey Rizzo (civilian shop owner; I hold a stake) | A | suggest ✔ → whopays ✔, Name own figure ✘, notthere ✘, pressure ✘, force ✘; buy_ask ✘, stake_ask ✘; tk:shop ✔ + col ✔ | how ✔, old_times ✔, tk:hurting ✔, news ✔ → the self-reference help request ✔; help_gift ✘, help_loan ✘ | not offered | his follow-ups ("is anything happening?", "was that you?") ✔ |
| Teddy Sorrento (civilian, threatened by Louie) | A | listed ✔ (incl. "Who does Lawrence answer to?"); loan ✘, buy ✘ | tk:pressed ✔ → heard ✔ → promise (warn) ✔; "mine" ✘ | ✔ word_make → own up → no catch → sweeten ✔ | broken-promise follow-up ✔ |
| Danny Bellini (protector, hostile) | A | n/a (approach screen) | | | warning answered "yes" ✔; no/stall ✘ |
| Bobby Russo (civilian shop, extorted, then debtor) | B | suggest ✔ → pressure ✔; offer_loan ✔ (plain terms); debt: manage ✘, now ✔, lean ✔, others ✘; week/ease/forgive ✘ | ✘ | ✘ | settle → beat ✔ |
| Charlie Palumbo (rival associate, stranger) | B | ✘ | ✘ | rv_warn ✔ → drop ✔; rv_ease ✘ | settle → beat ✔ |
| Marty Sorrento (my captain, aggressive game) | B | b_need ✔, report ✔ | ✘ | ✘ | summons → family meeting ✔ (say nothing ✘, back the boss ✔) |
| Vincent Ricci (my captain, ambitious game) | C | b_need ✔, job take ✔ ×2, promo ✔ ×3, recommend ✔, envelope ✔, b_extra2 ✔, tribute ✔, loan:500 ✔ (rep, take, repeat), favour call-in ✘ | ✘ (covered with Rocco) | listed, ✘ | Mario favour ✔; $500 for his brother → lend ✔ (give/no/think ✘); Marie dinner ✔ |
| Nicky Mancini (civilian, job target) | C | protect demand ✔ | ✘ | ✘ | |
| Tony Lucchese (my debtor) | C | debt: manage ✔, now ✔, lean ✔, others ✔, end ✔; week/ease/forgive ✘ | ✘ | ✘ | |
| Lenny Greco, Patsy Mancini, Benny Bellini, Mickey Esposito, Paulie Caruso (soldiers) | C | rk_back ✔ + back_what ✔ (×4); Lenny's opening ✔ | ✘ | ✘ | |
| Approaches / encounters (World) | A, B, C | christening ($100) ✔; inspector (word) ✔, (pay) ✔; Louie's tip (haggle) ✔; truck hits ✔ ×2; burglaries ✔ ×3; ride shotgun ✔ ×3 incl. self-job; muscle ✔; scam ✔; arrest debrief (detail) ✔; summons ✔ ×2; family meeting ✔ | | | other answers of each encounter ✘ (each chosen once) |

**Not tested, and why:**
- **Keeping a promise** to completion. My one promise in A became unkeepable through dialogue (the "leave him alone" talk dead-ended). In the time available no other promise arose whose fulfilment could be shown. Breaking one, and making amends, ✔.
- **Whacking someone.** Irreversible, and not needed to judge the conversation system; the settle screen's options were recorded.
- **The made-man induction, Make your bones, any rank above associate.** Never reached in 93 days (see progression).
- **Crew management.** No playthrough recruited men ("Take on a man" lists were empty or not pursued). The crew screens were checked during the UI rebuild only.
- **Dating, marriage, children; blackjack; the Commission and boss powers.** Not reached or not pursued.
- **Every branch of every opening.** Not claimed. Coverage is complete only for Rocco's Business › Other business and Personal › Something else personal lists, and for Louie's loan negotiation.

---

## D. Issues and inconsistencies

Severity: **Critical** (breaks the game's logic or its main loop), **High** (regularly damages play or belief), **Medium**, **Low**. "Repro" uses the playthrough letters above.

### Critical
1. **NPCs ask the player for help against the player.**
   - **Repro:** A. Pitch protection to Mickey Rizzo, then ask him "What's new?"
   - **Actual:**
     - "Lawrence wants money off me. I won't pay him. Can you do anything?"
     - later, "Lawrence's people haven't been back. Was that you?"
     - and to my captain the option "Mickey Rizzo's having trouble with Lawrence Oliveri. I want to bring it to the family."
   - **Expected:** a victim never asks his aggressor to intercede.
   - **Why it matters:** it destroys belief in the world in one line. Screenshots A-01, A-02.
   - **(code)** `src/conv/pursuits.ts`, the intercessor route: the chosen intercessor isn't checked against the man applying the pressure.
2. **Work taken from your captain in conversation can't be completed or seen.**
   - **Repro:** C. Captain › "Is there anything you need done?" › take it › do it.
   - **Actual:**
     - the job is shown nowhere;
     - doing it (the shop pays) doesn't resolve it;
     - the captain later says "You didn't want it, I suppose";
     - "Get the work done" stays at 0.
   - **Expected:** an accepted job is tracked, completed by doing it, reported, and counted.
   - **Why it matters:** it breaks the core progression loop.
   - **(code)** jobs resolve only through the old job screen, reached only from World's list of offers. `doProtect` sets up the protection but never resolves the job.
3. **Weeks pass invisibly.**
   - **Repro:** C. Commit crimes until heat is "Burning", then press "Next event".
   - **Actual:** the date jumps 33 days, and World says "Something has come up." The only record of the jail term is "The law picked up you. His friends have started saying he's a good man."
   - **Expected:** an arrest scene: charge, time inside, what it cost, who visited.
   - **Why it matters:** the player loses a month and his standing without understanding why.
4. **The same contradiction opens every captain's first job offer.**
   - **Repro:** A and C. Ask for work, then choose "About what he asked".
   - **Actual:** the player says "You had something for me?" and the captain answers "We just went over that. Short memory?" or "We did that one. Try another."
   - **Why it matters:** the very first decision in the game makes the player look forgetful.

### High
5. **Every argument after the first in a negotiation is treated as a repeat.** "I already told you. Keep up." / "Again? We just did this." / "He has nothing more to say on it." The options then ping-pong forever (A, the loan from Louie).
6. **Informing on men with nothing to say raises trust, once per man.** It works even about the captain's own superior: 5 × Trust ▲ Respect ▲ on day 0 (A).
7. **Commitments the player makes in conversation are recorded nowhere he can see.**
   - The promise to Mickey is in neither *Your word* nor Stories.
   - The favour from "put in a word" is listed under "Agreed terms" while "Favours" says "you owe nobody".
   - An accepted job is invisible (see 2).
8. **Interchangeable NPC voices.**
   - All debtors share one script.
   - Four soldiers gave an identical refusal.
   - Two captains in different games made the same request ("I know you know a lawyer…").
   - Danny uses the player's own line ("Mickey is with me. Leave it alone.").
   - The envelope scene is identical across captains.
9. **Templates used out of context.**
   - Crime-incident follow-ups ("Who have you heard it was?", "Somebody's stirring") on an open protection deal.
   - A protection pitch ("Everybody pays. You're not special.") used to tell a man to stop collecting.
   - An apology answered with "What's the catch?" and settled by sweetening.
   - A victim asked "What are you going to do about it?" answers as an onlooker ("If it were mine…").
10. **NPCs speak internal numbers and explain the systems.**
    - "$0 of $3,000 passed up… Who would speak for you? 1 of 3."
    - "Declare it straight, hand it over in person, and be generous to the man above you."
    - "A favour like a thousand dollars pressed into my hand with no reason given is an investment."
    - "(standing +1)" in narration; "reputation 40 of 75" on the player's page.
11. **Consequences happen to the player without telling him.**
    - $248 paid and terms agreed in B ("Rocco Silvestri brokered an end to it"), with no prompt and no World notice.
    - "Marty took you to task" off-screen.
    - "Stevie Palumbo took Russo's Meats from you", with no reason.
    - Standing ▲/▼ every week with no reason; −$20 a week, unexplained.
12. **Rackets, conversation and guide disagree about protection.** Rackets says "No shop worth leaning on right now" on day 0, while Burglary lists unprotected shops, conversation lets you pitch any owner, and the guide sends you there "under Rackets › Shops you could lean on", a menu that doesn't exist.
13. **Self-jobs.** "Ride shotgun for Mancini's Pharmacy's delivery — From you", then "Pasquale pays you $360", and it counts as a finished job (C).
14. **Legal work is an unlimited money tap.** Back-to-back 6-hour shifts at any hour, $480 in 24 hours, the same sentence each time (A). Compare $332 for week one of criminal play.
15. **Loans are nonsensical.**
    - A just-threatened shopkeeper takes 260% APR from his extorter with Trust ▲, then repays $450 of the $550 moments later (B).
    - My captain borrowed from me and lent to me in the same week (C).
    - "Everyone around here has a lender already" in every game, so nobody ever needs a loan.
16. **The UI shows what the character can't know.**
    - The full org charts of rival families, including associates' places in the succession.
    - Every shop's protector city-wide.
    - "Falco: on a war footing", which never reached the player by any other way.
17. **Facts concatenated into nonsense.** "Artie Rizzo got a lesson from Artie Rizzo took Frankie Marino to task over what happened: Frankie Marino, delivered with fists." (C)
18. **The summons system.**
    - Coffee with your captain becomes a "family meeting" with the boss that reads out log lines (B-01).
    - A summons is answered by "He isn't available right now" (C).
    - In conversation a summons becomes a "job" you "take care of" (C).

### Medium
19. **Hidden ambitions pay out unasked.** "Get a shop paying you…", "Put $2,500 in your pocket", "Earn your boss's trust", even after choosing another (B, C).
20. **Promotion can be bought, and backing is opaque.** Personal gifts count as money "passed up". Backing is granted instantly by one captain and refused verbatim by four soldiers. Its condition ("a few weeks of that") isn't tracked, and it was withdrawn silently.
21. **Options that shouldn't be there.**
    - "I'm ready for more" rewarded on day 0.
    - "Could we look at the number? I've been carrying a lot" on day 0.
    - "You need to straighten yourself out" to your captain.
    - "Send the boys in" with no men.
    - Threatening your own captain.
    - "Have him taught a lesson" against a made man of your own family.
22. **Reasonable options missing.**
    - Taking up Louie's suggestion to talk to Teddy.
    - Admitting to Mickey that it was me.
    - Any talk of the stake I hold in Mickey's shop.
    - Any compromise in the "leave him alone" talk.
    - Answering "How did it go?" after a summons.
23. **Time and place don't match.**
    - A drink at 8 a.m. jumps to the evening.
    - A "Friday night" delivery is done on Sunday.
    - The inspector is "at lunch" at 10 a.m.
    - A dinner "Saturday" happens mid-conversation.
    - A man who "has come to find you" is at his own home at 4 a.m.
    - Visiting a nervous civilian at 3 a.m. draws no reaction.
24. **Navigation can lose an approach.** Choosing "Something else…" on a man's question discards it with no way back, and leaving then drops him from "Looking for you" (A).
25. **"Next event" says "Nothing stirs" while offers arrive,** and doesn't stop for them (A).
26. **Background facts are contradicted.** "You haven't met" my debtor of years (C). My stake isn't shown on the owner's page.
27. **The guide pushes extortion,** including to a cooperative player right after he agreed to back off (A).
28. **Refusals pile up as urgent items.** "A smaller share — He turned you down" and "Protection… He turned you down" sit in World's "Needs you" with a red badge.

### Low
29. **Grammar and wording.**
    - Lowercased names: "louie valenti wants sorrento's billiard hall…"
    - "You… was"; "You now collects"; "Not yet. trusted"; "The law picked up you".
    - "christened the hall"; "About leave Teddy alone"; "$550, if he needs it" said to his face.
    - Quote styles mixed; "Open 11:00 to 2:00".
30. **Two date systems:** "Day 70 09:00" and "Mon 2 Mar".
31. **The intro line** still says "Rackets says how to earn" (no such section).
32. **The rail says "Reputation: Trusted" on day 0;** it flips to "Unproven" over the first night.
33. **Choices 10 and up** can't be reached with the number keys.
34. **The money summary leaves out stake income** ("$0 in" while a share pays $32). This is in the new `ui/money.ts`.

---

## E. Gameplay assessment (scores out of 10)

| | Score | Evidence |
|---|---|---|
| **Conversation quality** | **4** | Strong individual lines (Teddy, Vincent's debriefing, the small talk, "For nothing. Nothing is a good reason."). Undermined systematically by false "you said that" replies, out-of-context templates, numbers in men's mouths, self-reference and dead-end loops (issues 4–10). |
| **NPC intelligence and consistency** | **4** | Men remember: Rocco's unanswered job twice, Mickey following up, Teddy's broken promise, Vincent "slightly insulted that there are terms". But they forget the obvious (a captain thinks a done job was refused) and confuse the player with other men. Choices often contradict circumstance: lending from a man you owe, borrowing from an extorter. |
| **NPC autonomy** | **6** | The best part of the game underneath. Shopkeepers go to protectors, victims to their captains, captains settle and punish neglect; there are Commission rulings, raids, takeovers and levies. Held back by monotony (mostly protection churn), and by how little of it reaches the player. |
| **World coherence** | **4** | Causal chains are real and traceable in the Journal, but stale jobs, contradictory reports, self-jobs, the leak of rival org charts, and wars mentioned only on the family page break it. |
| **Player agency** | **4** | Many options, but results are often decided without the player: $248 paid, terms agreed, a month in jail. Hooks come with no way to act on them, and negotiations dead-end. Violence is unconstrained and mostly free of consequence. |
| **Progression** | **2** | 93 days of ambitious play without being made. The core job loop is broken through conversation; backing is opaque; money can be bought; hidden ambitions confuse the goal. |
| **Gameplay variety** | **4** | Week one offers burglary, trucks, inspectors, scams, christenings and debts. Within a few weeks it is the same offers, encounter templates and protection events recurring (the same wedding twice; the same lawyer favour in two games). |
| **Immersion** | **5** | The 1970 texture is real and often lovely (the christening, Marie, the Herald). Mechanical text, numbers, log-style lines and time mismatches keep breaking the spell. |
| **Interface usability** | **6** | The new conversation screen is readable and stable on desktop and phone; numbered choices and the context box help. But consequences don't surface where the player looks: World is quiet while things happen, and the Journal holds the truth. Accepted work and promises are invisible, there are a few navigation traps, and the UI leaks knowledge. |
| **Overall enjoyment** | **4** | Curiosity and some excellent moments in the first hours; then confusion, repetition and a stalled climb. |

---

## F. Prioritised recommendations (ten)

1. **Fix the self-reference bug at its source** (Bug). A victim's intercessor, an "ask the family" option, an offered job's giver or a story's "who": none of these may be the player when the player is the other party. Add one invariant test that no request, job or option names the player as the man he is to act against or for.
2. **Make accepted work a first-class record** (Bug + refinement). A job taken anywhere (conversation or World) is listed on World under "Your work". It completes when its objective is met, however the player met it (for protection, when the shop agrees), and is reported to its giver from that row. Count it once. Remove self-offered jobs.
3. **Repair the conversation's repeat and template logic** (Bug + refinement).
   - Repeat detection should key on the argument made, not the negotiation, so a new argument always gets a real answer.
   - The "About what he asked" opener must not trigger "already said".
   - Each template should declare the situations it fits (crime vs deal, victim vs bystander, apology vs offer) and only be used there.
4. **Tell the player what happened, where he looks** (Refinement). Anything that changes his money, standing, freedom or obligations appears on World with a reason. That covers arrests (a scene, not a jump), settlements paid on his behalf (ideally asked first), reprimands, shares raised, standing changes, and weekly costs. "Next event" should stop for these. The Journal remains the archive, not the only source.
5. **Surface every commitment in one place** (Refinement). *Your word* reads both the memo records and the conversation layer's obligations and favours. Promises, favours (from "put in a word" too) and accepted jobs show with due dates, and kept or broken outcomes are recorded.
6. **Give men distinct voices and reasons** (Refinement). Route debtor, backing, envelope and favour lines through the voice sheet by character type and situation, at minimum three variants per meaning. Ground generic claims ("my favourite earner", "you know a lawyer") in actual facts, or don't say them.
7. **Rebuild the path to being made as something the player can read** (Design).
   - Backers' conditions should be concrete and tracked ("hand your envelope in person three Sundays running", "finish a job for him").
   - Gifts shouldn't count as money passed up.
   - Remove hidden ambitions, or show them as the guide's suggestions.
   - Give a progress view that says what changed this week and why.
8. **Close the exploits that cheapen money and trust** (Bug). Cap shifts per day with diminishing returns; informing should require something to tell; loans need a need on the borrower's side and no immediate recall; no lending and borrowing both ways with the same man; promotion can't be bought outright.
9. **Hide what the character doesn't know** (Bug). Rival family charts should show only men the player knows of, and shop protectors only where known. Family relations ("on a war footing") should come through news before the family page shows them.
10. **Reconcile the systems that disagree** (Refinement).
    - Protection availability: Rackets, conversation, guide.
    - Time and place in scenes: a drink at 8 a.m., Friday-night jobs, a man who came to find you.
    - Summons: they should open a real scene with the summoner, at his place.
    - Refusals: not shown as "Needs you" items.
    - Stakes: shown on the owner's page and in the money summary.

**Not recommended now:** new systems. The underlying simulation already produces enough material. What's missing is coherence in what reaches the player.

---

## Limitations of this playtest
- **Breadth over depth.** Four playthroughs, about 220 game-days in all, with the longest at 93 days. No playthrough reached soldier rank, so made-man play, crew management at scale, boss powers and the Commission weren't experienced.
- **Coverage.** Exhaustive only for the listed menus of two NPCs. Other menus were sampled (section C). No alternative branches were replayed from saves; each NPC's alternatives were explored within one visit where the game allowed it.
- **One log lost.** The batch in C covering days 46–93 lost its log to a tool timeout. Those weeks were reconstructed from the in-game Journal, not observed turn by turn.
- **Automation.** A page helper clicked buttons and read text for speed. Every decision was made from on-screen text, and longer runs ("take the first approach on every job") were used only to advance the ambitious playthrough.
- **Sample size.** Some findings are seed-dependent. The systematic ones (4, 5, 8, 10) were confirmed in two or more games.
