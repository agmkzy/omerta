# Gate 3: final gameplay quality pass

*Branch `conversation-rebuild`. Not pushed, not deployed. The new screen is still behind its switch (`?talk=new`); the old screen is untouched. Gate 4 not begun.*

## 1. Summary of implemented changes

All of this is presentation and use of mechanics the game already has. Nothing new is simulated.

- **Work comes up between the men it concerns.** A man who gave the player work says so when it ends:
  - done: "I hear ‘Paulie has a bag that needs to move’ got done. Tell me about it.";
  - failed: "‘Danny Bianchi has been flush’? What happened there?";
  - offered and ignored: "I put work your way. You never came.", "I don't offer twice."

  Reporting finished work (the old engine's reward for it) is the first item under Business when there is something to report.
- **Advancement is answered from the family's actual road** (`path.ts`): money passed up, jobs finished, the family's hard work, reputation, made men who'd back you and one to speak for you, the proof. The most important gaps come first, with the real figures the career page already shows ("$0 of $3,000 passed up", "2 of 3"). Asked again, he says whether anything has changed since last time, and which way.
- **Confront has approaches after the first answer,** and they depend on who the man is to the player:
  - denied: tell him how you know, press him, take his word;
  - admitted: give him a chance to make it right (he owes you), warn him, leave it;
  - defied: press, back down, or settle it another way (the existing "take action against him" screen).

  Pressing a man under you frightens him; pressing a peer costs liking; pressing the man above you costs his respect and earns a grudge. The man above cannot be put in your debt. A promise not kept to the player can be held to (a few more days) or let go.
- **Help when money comes up.** When a man's money comes up and he is short (the old engine's own test: under $300, or his shop in the red), the gift or loan the game already supports is offered right there.
- **Relationships show in behaviour,** not numbers. The header now says what kind of relationship it is:
  - "He knows you well, and keeps his own counsel.";
  - "He likes you. He doesn't trust you yet.";
  - "He trusts you. It isn't friendship.";
  - "He respects you. He doesn't much like you.";
  - "He's wary of you."

  When a man holds back about his own life, the narration says why, in the same terms ("He knows you by now. He keeps that to himself all the same.").
- **Continuity instead of repetition.**
  - The same question with nothing changed gets "Same as I told you last week." / "Nothing's changed since yesterday.", not the old engine's identical words.
  - An evening doesn't return to a subject the player has just asked about.
- **Smaller fixes:**
  - "Other business…" lists only what isn't already on screen;
  - the old engine's quoted labels and capitalised titles read naturally;
  - the accusation is said as what it was.

## 2. Files modified

| File | What changed |
|---|---|
| `src/conv/visit.ts` | Job news and report (`jobNews`, `unreported`); advancement (`doAdvance`); confrontation approaches (`answerAccusation`, `doConfrontMove`, `standingOf`, `doHoldWord`); help on money subjects (`offerHelp`); relationship words and cues (`relationOf`, `guardedCue`); repeated answers; "Other…"; per-screen cache; visits recorded as meetings |
| `src/conv/doors.ts` | `met`: the record that two men have met, through the layer's one door to the world |
| `src/conv/render.ts` | Lines for the above |
| `src/web.ts` | "Settle it another way" opens the existing screen |
| `src/tests/conversation/visit.test.ts` | 9 new tests (section 9) |
| `docs/gate3/QUALITY_PASS.md`, `RUN4_QUALITY.md`, `TEST_C_CONFRONT.md` | This report and its playthroughs |

## 3. Bugs identified and corrected

1. **Louie's trust in Run 2b (the reported discrepancy), with the state transitions:**

   | Day | Trust | Cause |
   |---|---|---|
   | 6.8 | 0.500 → 0.470 | The weekly fade between men who haven't met in 14 days (`core.feelingsWeek`). Henry had met Louie on days 2 and 3, but the new screen never recorded a meeting (`Rel.lastMet` stayed "never"). **A bug.** Every man seen only through the new screen slowly lost trust in the player. |
   | 12.4 | 0.470 → 0.420 | Work Louie had offered expired unanswered (`jobs.daily`: ignoring your captain's work costs trust and reputation). **Correct**, and now visible: he says "I don't offer twice." |
   | 13.8 | 0.420 → 0.395 | The weekly fade again, the same bug. |

   Fixed: a visit records the meeting, through a door. Tested: "a visit is a meeting…".
2. **Advancement said "you've come on" when the player had gone backwards** ("trusted" to "unproven" read as progress). It now compares the measure itself and says which way. The old flow's single repeated line ("Nobody puts a name forward on what you've passed up so far") is replaced by the actual gaps.
3. **The old engine's identical answers repeated word for word.** Now: "Same as I told you {ago}." This applies only to what the player asked; a man raising his own matter says it again.
4. **An evening went back to a subject the player had just asked about,** and got "Nothing's changed".
5. **Job outcomes were invisible in conversation;** the report was buried in "Other business".
6. **Confrontation:**
   - there was no follow-up layer;
   - an accusation about something done to the player used the player's own name ("Dante. I know that was you.");
   - the player could put his own captain in his debt;
   - the favour's description was spliced into the old engine's sentence and read garbled.
7. **"Other business…" repeated the top four;** old labels had plain quotes and capitalised titles ("About Protection at…").
8. **The slight rule counted a man who owned up and was let off.** Found in Test C, corrected after the run.

## 4. Before and after

- **Captain, asked about advancement for the second time.**
  - *Before:* “You’re not there. People call you trusted.” → “More than this. Nobody puts a name forward on what you’ve passed up so far.” (the same, every time)
  - *After:* “You’ve come on since 2 weeks ago: the work, for one.” → “The money isn’t there yet: $0 of $3,000 passed up in total. Nobody puts a name forward short of it.” → “You need made men who’ll stand up for you: 2 of 3.”
- **The man who gave you work, after it.**
  - *Before:* “He nods you to a chair.”
  - *After:* “I hear ‘Paulie has a bag that needs to move’ got done. Tell me about it.” → [Tell him how the job went] → Trust ▲ Respect ▲ Standing ▲
- **Asking for work, again.**
  - *Before:* “Nothing now. Don’t look for work. It finds you.” (weekly)
  - *After:* “Nothing’s changed since last week.”
- **An accusation he admits.**
  - *Before:* he answered and the screen returned to the headings.
  - *After:*
    - from a man under you: [Give him a chance to make it right / Warn him / Leave it there];
    - from your captain: [Ask him to leave yours alone / Leave it there];
    - from either, the next visit: “He’s cooler than he was. He hasn’t forgotten the last time.” (for a warning, not for one let off)
- **A familiar man who doesn't confide.**
  - *Before:* “You’ve been to see him often.” / “Oh, the usual things.”
  - *After:* “He knows you well, and keeps his own counsel.” / “Same as I told you last week.” (He knows you by now. He keeps that to himself all the same.)

## 5. Gameplay transcripts

- **`RUN4_QUALITY.md`:** a new ordinary game, 30 days, in the browser (Tests A, B, D, E).
- **`TEST_C_CONFRONT.md`:** confrontation with a man under the player and with his captain (developer setup, declared).
- **Earlier runs, for comparison:** `RUN3_ORDINARY_FINAL.md`, `RUN2_DISPUTES.md` (commitments; going over a captain's head), `RUN1_ORDINARY.md`.

## 6. Job and relationship continuity (Test B)

All from Run 4, in the browser, with the jobs carried out on their own screens:
- **Failed:** Tony Santoro's con went wrong. Back with Tony: “‘Danny Bianchi has been flush’? What happened there?”
- **Done:** Paulie Testa's bag was delivered. Back with Paulie: “I hear … got done. Tell me about it.” Reporting it raised his trust and respect and Dante's reputation.
- **Ignored, then done:** Sonny Vitale's earlier offer lapsed. Next time: “I put work your way. You never came.” He offered another job, which was done: “You did what I asked. No noise. I noticed.”
- **Ignored, from the captain:** Richie DeSantis, after an offer expired: “I don’t offer twice.” This is the same mechanism that lowered Louie's trust in Run 2b, now said aloud.

## 7. Contextual confrontation (Test C)

`TEST_C_CONFRONT.md`:
- **Sonny, a man under the player:**
  - envelope questioned;
  - Dante checks it himself ("it checks out", trust ▲);
  - Dante says what he saw; Sonny admits;
  - warned ("It doesn't happen again"; he holds your eye, then nods);
  - fear rises from nothing to 0.11;
  - two days later: "He nods, and waits. The last time is still in the room."
- **Richie, the player's captain:**
  - admits;
  - only "Ask him to leave yours alone" or "Leave it there" are offered;
  - "I'll think about it.";
  - cooler the next visit.
- **Not reached in the browser:** the denial and pressure paths, because both men admitted. These are covered by automated tests.

## 8. Advancement (Test D)

Run 4, Richie DeSantis, asked three times:
- **Day 2:** trusted; money $0 of $3,000; 2 of 3 men behind him.
- **Day 16:** reputation had fallen (ignored work); this showed the direction defect, since fixed.
- **Day 31, after three jobs:** “You’ve come on since 2 weeks ago: the work, for one.” The money is still the blocker, because Dante never handed up his Sunday envelope, and the captain says so.

A player reading this knows what to do next: pass money up, and find a third man to stand up for him.

## 9. Test results

**On the final tree:**
- **Typecheck:** clean.
- **Full suite** (`npm run test:all`, 311 s): **446 passed, 0 failed, 14 skipped.** The 14 are the opt-in long runs, which run only with `SLOW=1`.

**New in this pass, 9 tests:**
- a visit is a meeting (the Louie defect);
- advancement from the actual conditions, saying "same", "better" and "worse" correctly;
- work recognised when done, failed or ignored, said once, with the report first;
- the same question with nothing changed is acknowledged, not repeated;
- a confrontation stays on its subject, an approach made isn't offered again, and pressing a superior costs his respect;
- an accusation said as what it was, and no debt from the man above;
- a man who owned up and was let off isn't slighted;
- "Other business…" doesn't repeat the top list;
- a figure goes with its own choice.

**Covered by the existing suites, all passing:**
- determinism (`determinism.test.ts`);
- save/load of genuine old saves, including schema 2 (`oldsave.test.ts`), and a visit's memory across a save;
- the old interface (the `dialogue` suite, unchanged);
- no private knowledge in choices: Confront offers only what the player knows; news names a man only if the speaker knows him; no internal terms on screen;
- the architecture rule that the conversation layer changes the world only through its doors (which caught this pass's first attempt at recording meetings);
- worlds without the layer unchanged.

**Performance:**
- **120 simulated days:** 9.6 s without the layer, 11.6 s with it (unchanged).
- **A visit in a 30-day world:** about 2 ms to open, 5 ms for "What's new?", 2 ms back to the headings.
- **In a 120-day world:** about 22 ms per visit.

**Save growth:**
- **Visit memory:** 2.9 KB after the scripted month (was 2.1 KB). The difference is the remembered answers and job acknowledgements, bounded at 24 per man.
- **The conversation records:** 46 KB in total.

## 10. Remaining weaknesses

- **Ordinary evenings are still the most repetitive thing in the game.** Six of Mario's ten evenings had nothing fresh on his mind and were the Yankees, the fights, the neighbourhood. "Nobody said anything that mattered." It is honest, but it is the same evening.
- **A guarded man stays guarded for a month.** Mario took until day 28 to say what he wants. That is his temperament and the compatibility rule. It reads as a character now ("keeps his own counsel"), but it is slow.
- **The old engine's encounters repeat daily until answered.** Richie's "Ralphie is inside" came three times in two days when the routine wouldn't pay. Only the player's own repeated questions are softened.
- **The old engine's job phrasing:**
  - a summons to coffee is taken with “I’ll take care of it” / “Good. Don’t make a mess of it.”;
  - job titles read awkwardly in speech (“‘Ride shotgun for Vitale's Meats’s delivery’ got done”).
- **Protection negotiations still offer the old engine's long lists** (with "Other ways to put it…").
- **Test C needed a developer setup.** An associate has no subordinates in his first month.

## 11. Decision quality (Run 4, assessed critically)

- **Meaningful choices.** Yes, where the world put something at stake: which work to take and how to do it, a wedding envelope, a man in jail ($300 or "not your business", which cost trust and respect), Mario's ambition ("put in a word" left him owing a favour). Personal evenings rarely offered a decision.
- **Character identity.** Clearer than before. Mario (keeps his own counsel, follows Richie gladly), Sonny (curt, "He pays, I work"), Tony and Paulie (businesslike), and Richie (warm, demanding, "I don't offer twice") behave differently, for reasons the screen now names.
- **Continuity.** Strong for work, refusals, slights, advancement and requests. Weak for small talk.
- **Repetition.** Roughly a third of visits were functionally the same: the evenings, the boss's "nothing now", the repeated encounter. Most of it is now acknowledged as repetition rather than repeated word for word, which is better, but it is not variety.
- **Agency.** Good. Every intention in the run took one or two selections, and the jobs one more screen.
- **Clarity.** Much better for work and advancement: the player knows why a man is pleased or cold, and what stands between him and being made. Still thin for why a friendship isn't warming.
- **Gameplay integration.** Conversations now connect to jobs (offered, done, failed, ignored), money (gifts, loans, envelopes, favours), organisation (advancement, a captain's work) and rackets (protection). The weakest link is personal talk, which rarely leads anywhere.

## Recommendation

**Gate 3 is ready for final sign-off as an interface and as a conversation system. I would sign it off now.**

Its remaining weaknesses are content, not structure:
- the ordinary evening;
- the old engine's own phrasing;
- the pace at which a guarded man opens up.

None of them would be fixed by more interface.

**What is clearly better than before this pass:**
- Work, refusals, slights, advancement and requests now carry from one conversation to the next, in the men's own words.
- A captain tells you what stands between you and being made, and whether you've moved.
- A confrontation goes somewhere, and costs differently depending on whom you confront.
- Louie's unexplained loss of trust turned out to be a real bug, affecting every relationship seen through the new screen. It is fixed.

**What still feels repetitive or shallow,** plainly:
- Evenings with a crew man who has nothing going on are the same evening: about a third of all visits in a month.
- The boss's "nothing now" is now acknowledged as repetition, but it is still nothing.
- The old engine's encounters come back daily until answered.
- Personal conversation rarely leads to a decision.

These are the next piece of work after Gate 3: more for men to talk about, drawn from what the world already records about them (their past jobs, their families, the week's events in their own district). They belong in the subject engine (`talk.ts`), not in this interface.
