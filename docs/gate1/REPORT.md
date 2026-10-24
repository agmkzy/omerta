# Gate 1, third pass: results and assessment

*Branch `conversation-rebuild`. Transcripts: `docs/gate1/TRANSCRIPTS.md` (regenerate with `npx tsx src/conv/gate1.ts`). Tests: `src/tests/conversation/gate1.test.ts`. The old conversation system is untouched; nothing is deployed. Gate 2 has not been started.*

## What this pass adds

| Demonstration | Where | What it shows |
|---|---|---|
| Deception | §7 | A man with a reason lies. The listener judges the claim without the truth. Only another man's word exposes it, and there are consequences. |
| Four promise types | §8 | Eight runs, each created in conversation and settled by world events, including the two edge cases asked for. |
| Generalisation | §9 | 200 visits over 4 seeds, real temperaments, two levels of regard, five kinds of request, with fallbacks and failures measured. |
| Tests | `gate1.test.ts` | 15 passing, plus 2 marked as expected failures that record known limitations. |

## Deception (§7)

1. **A reason to lie.** The same collection job goes to six different men under three circumstances. With no debts, all six hand over the full $200. After one missed payment, all six still do, but the margin narrows. When a man has missed two payments and has $30 to his name, all six skim. Personality moves the margin: low-greed, high-empathy Mario sits at +0.06, Hank at +0.28. Circumstance decides the outcome. Nobody is scripted to lie.
2. **A false claim.** Mario says Gino “only had $100”. The claim is recorded as dishonest, but only the simulation knows that.
3. **Interpretation without the truth.** Henry's belief in the account is 0.65, computed from his trust in Mario alone. A test confirms the belief is identical whether or not the claim is true.
4. **Exposure.** Gino, asked about his debt, says he paid $200. Henry now holds two accounts that cannot both be true. The confrontation row appears only because of that contradiction; for an honest man it never appears (tested).
5. **Consequences.** Confronted, Mario decides for himself whether to admit, deny or defy, from evidence weight, fear, conscience and pride. He admits. The $100 comes back, and Henry's trust in him falls through `core.feel` with the reason attached.

## Promises (§8)

Nate asks for help. Henry's four answers are four kinds of promise, worded as a man would say them. The type is never named on screen (tested).

| Promise | World events | Outcome |
|---|---|---|
| Action: “I'll speak to my captain.” | Henry raises it; Rizzo refuses | **Kept.** He did what he said. |
| Action | Lou stops on his own; Henry never raised it | **Broken** at the deadline, despite the good outcome. Nate thought it was Henry's doing; Henry admits it wasn't. |
| Effort: “I'll do what I can.” | Henry raises it, expecting a 0.26 chance; Rizzo refuses | **Kept** by a failed attempt. |
| Effort | Henry mentions it to a shopkeeper with no say | **Broken.** It was only a gesture. |
| Result: “I'll make sure he leaves you alone.” | Clean to day 10; window smashed on day 12 | **Broken on day 12**, not day 30. Nate reproaches him. |
| Result | 30 clean days | **Kept** only at the end of the period. |
| Restraint: “I won't tell a soul you came to me.” | It reaches Lou another way | **Kept.** Only Henry's conduct counts. |
| Restraint | Henry tells Lou | **Broken** immediately. |

## Generalisation (§9)

- **Setup.** Seeds 3, 7, 11 and 19, each run 20 days so the world has its own history. Characters keep their real temperament, manner, money and knowledge, with no overrides.
- **Two passes.** Every visit is played twice: with each man's real regard for Henry (mostly a stranger, since Henry has done nothing yet), and as if he knew and trusted Henry.
- **Nothing added.** No lines were added to the library for this run.

| Request | As it stands | Knows and trusts him |
|---|---|---|
| Protection (24) | refuse 19, accept 3, counter 2 | refuse 17, accept 4, counter 3 |
| Loan (20) | refuse 20 | accept 10, counter 8 (4 taken), refuse 2 |
| Who did it (36) | withhold 24, unknown 12 | knows 14, rumour 10, unknown 12 |
| News (8) | told 8 | told 8 |
| Intervention (12) | refuse 12 | refuse 12 |

**Where the lines came from (334 NPC lines):**

- **87%** from a bank written for that request and reason.
- **13%** from a general bank for the reason. Fallbacks occurred in loan refusals only: "doesn't know you", "risk", "can't spare", "word not enough".
- **0%** fell back further to the bare act.
- **0** missing banks, and **0** unfilled slots.
- 23% of lines were in the speaker's own manner (archetype lines).

## Test results

- **Gate 1 tests:** `npx vitest run src/tests/conversation`, 15 passed and 2 expected failures. The tests cover choice validation (unit); the perception boundary, belief independent of truth, and interpretation from the listener's own state (unit); within-visit memory, from condition to cut-off (scenario); three deception tests (scenario); four promise-type tests and words-not-types (scenario and unit); determinism of the whole transcript build; and generalisation with no holes, no gaps, and regard changing decisions (scenario).
- **Expected failures:** the two known limitations below are recorded with `test.fails`. They will alert when fixed.
- **Full suite:** `npm run test:all`, 48 files passed (2 skipped), 357 tests passed, 13 skipped (the opt-in slow runs). Typecheck clean.

## Remaining limitations (found by this pass, not fixed)

1. **Fixture particulars leak into wording: 45 of 334 generalisation lines (13%).**
   - “A bakery's not much of an envelope” is said about a newsstand.
   - “Have been for years” is said about a protector of unknown duration.
   - “I was across the street” is a basis the knowledge record doesn't hold.
   - “He looks at the window” appears in an afraid acceptance.

   Henry's own rows carry the same problem: “Who did the window at…”, “Just a loaf”, “They were back on Tuesday”. The fix is architectural (slots from perception: business kind, damage kind, duration, how he knows), not more lines.
2. **The meaning has no place for the speaker's role in the matter.** The world records a victim as a witness of his own shop's damage, so four victims got a bystander's line: “I didn't see anything”, “I was across the street”. Meaning needs a role field (victim, witness, hearsay).
3. **Rank and authority are absent from some decisions.** Henry can ask his own boss for a loan, and the boss answers like any lender. The suggested-action plausibility filter (spec §17) doesn't exist yet. The generalisation run had to exclude shops Henry's own family protects by hand.
4. **Some decisions are threshold-like.** Deception is decided by circumstance, and personality only moves the margin. Interventions were refused 24 of 24 times, even by a trusting captain, because the cost of crossing another captain dominates without new information (as designed, but there is no variety). The withhold line has one variant, heard from 21 different men.
5. **Promise tracking is a Gate 1 stand-in.**
   - Acts are logged by the harness (`obs.did`), not emitted by the engine.
   - “Lou stops by himself” is the absence of facts, not an event.
   - Nate's “seen Lou stop” is passed in, not derived from his perception.
   - Promise records live in the harness, not in the world or the save.
6. **Money moved in the transcripts bypasses the ledger.** The cash adjustments are fixture edits. Gate 2a must route them through `ledger.ts`.
7. **Deliberately small.** The claim store, the belief formula and the obligation checks are minimal. Contradiction detection compares values on an exact subject key only.

## Assessment

| Acceptance criterion | Met? |
|---|---|
| Deception: reason, false claim, interpretation without truth, exposure by evidence, consequences | **Yes** |
| Four promise types created in conversation, tracked, and fulfilled or broken by world events | **Yes**, with the stand-ins in limitation 5 |
| A failed effort that keeps an effort promise | **Yes** |
| A good outcome that breaks an action promise | **Yes** |
| Generalisation on unscripted combinations, with transcripts and generic-wording fallbacks identified | **Yes**. Decisions vary with circumstance and regard, there are no holes, and fallbacks are confined to reason banks. |
| Library not expanded to pass. New acts got one default line each; nothing was added for §9. | **Yes** |
| Choice validation, knowledge boundaries and within-visit memory preserved | **Yes**, all tested |
| Old system untouched | **Yes** |

**Verdict.** The architecture generalises: the decision layer, the perception boundary and the fallback chain held up on people and situations nobody wrote for. The wording layer does not yet generalise cleanly. About one line in eight still carries an assumption from the worked examples, and the meaning lacks the speaker's role. I recommend sign-off with two conditions for Gate 2a: perception-filled slots for the particulars, and a role in Meaning. Both are structural changes, not additions to the library.
