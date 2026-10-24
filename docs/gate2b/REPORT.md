# Gate 2b: autonomous social behaviour and subjective beliefs

*Branch `conversation-rebuild`. Transcripts: `docs/gate2b/SCENARIO_G.md` (the 30-day repeated-interaction scenario, three runs) and `docs/gate2b/CHAINS.md` (what four worlds did by themselves over 180 days). Regenerate with `npx tsx src/conv/gate2b.ts`. Tests: `src/tests/conversation/autonomy.test.ts`, plus the Gate 1 and 2a suites. The old conversation system is untouched. The player interface and the cut-over have not been started.*

**How the layer is switched on.** It runs in a world that has `World.social` (call `social(w)` to switch it on). A world or save without it behaves exactly as before; the full existing suite confirms this. It is opt-in until the cut-over (Gate 4) makes it the default.

## 1. Implementation, by priority

### 1. One model of decision
- **The hook.** `asks.ts` now has a `DECIDERS` registry. In a world running the layer:
  - the answer to an ask is the conversation layer's decision, from the asked man's own perception, using the same `respond` functions the player meets;
  - for `protect`, the asker's next move is also the layer's decision.
- **Execution is unchanged.** The asks still carry everything out: `finish`, counters, stalls, refusals, `onNo`, `seekHelp`.
- **Kinds covered** (`conv/deciders.ts`):
  - `protect`: the answer (`onProtectionDemand`, the Gate 1 function) and the collector's next move (`onPressDemand`, which reads his restraints);
  - `layoff` and `warn`: `onLayoff`, an order if the asker is over him, otherwise a warning;
  - `help`: `onHelp`;
  - `borrow`: `onLoanRequest`.
- **Test:** a shopkeeper answers an NPC collector with exactly the decision he would give the player.

### 2. Pursuits, not automatic fulfilment (`conv/pursuits.ts`)
Gate 2a's step "an NPC always raises it in 1–3 days" is gone. There are four kinds of pursuit, bounded at three per man and 120 in the world.

**Stopping trouble** (a refused demand, or hostility he knows the source of):
- He ranks his routes:
  - his protector (through the world's `help` ask, which leads to `warn`);
  - a man in the life he knows (the player included);
  - the man's own captain, if he believes he knows who that is;
  - asking around who the man answers to;
  - paying;
  - putting up with it.
- Routes are ranked by his prediction of each man's answer. The prediction is `modelOf`: the other man's temperament as he has seen it, blurred by unfamiliarity, and the other's knowledge only as far as he shares it. That model can be wrong.
- He waits within his patience, does not re-ask anyone who refused him, and changes plan when new information opens a better route. The trace records the plan change and its cause.
- He gives up when nothing is left, and that becomes a fact his circle hears.

**Keeping his word** (an NPC obligor): each day `onKeepWord` decides from the cost to him, his regard for the promisee and the time left. The options are:
- act;
- delay;
- renegotiate: the promisee decides by `onRenegotiate` to release, extend or hold;
- abandon: an agreeable man withdraws and says so; another lets it lapse.

**Following up** (a man waiting on someone's promise):
- He asks for news when his patience runs out or the deadline nears. The obligor answers by `onProgressAsked`: the truth, "not yet", or a lie.
- He judges by what he comes to believe.
- **Verification:** told "it's done" and seeing the trouble go on, he checks with the man it was supposedly done with.

**Finding out who did it:** he asks around. People withhold, or know nothing. A man covering for the culprit may name someone he has a grudge against. A man who only suspects passes his suspicion on as hearsay.

### 3. NPC-to-NPC requests by the player's rules
- **Same functions.** NPC requests are answered by the same functions the player's are: `onIntervention`, `onOrderRequest`, `onLayoff`, `onHelp`.
- **Requests climb the hierarchy:**
  - a man below captain takes a matter to his own captain first, who decides for himself whether to take it further;
  - a captain goes to the other man's captain;
  - a man who can order the offender does so himself.

  This produces chains of three or more linked requests. One natural chain ran from a civilian up to the family's boss.
- **Outcomes are learnt when the ask closes.** A new close-hook in `situ.ts` tells a request how its ask ended. The world clears settled asks between other men soon after, and Gate 2a's polling had been racing that.

### 4. Subjective beliefs (`conv/minds.ts`)
- **Claims and beliefs.** Claims are recorded with what they rest on (seen, own, heard). A man's belief combines his own evidence (facts he knows; what was done to him; whether the man ever came to him) with the claims he heard, each weighed by trust, familiarity, caution and basis.
- **Contradiction.** Two accounts he takes seriously leave him uncertain, and he reserves judgement.
- **Revision.** A change of belief is recorded. A wrong blame is let go with its reason and the right one taken up, and pursuits are re-planned.
- **Judgement follows belief, not truth.** For every obligation, each person it was owed to judges the obligor by what he believes happened: kept (scaled by the credit he believes in), broken, withdrawn, never heard, or lied to (broken after being told it was done).

  Regard moves by the difference from what he had already acted on, so finding out later moves it again. A lie believed earns trust; found out, it costs more than an honest failure.
- **The same applies to liabilities and orders.** A liability falls when the man who laid it believes the matter turned ugly. A superior acts on a broken order only once he believes it.

### 5. Organisational responsibility
- **Orders propagate.** When a man accepts an order, it is passed to his own men as orders of their own.
- **Each man judges his own order at the moment it is tested** (`conv/obey.ts`): when he could lean on the shop, settle a grudge, or carry out a plan he made before. He weighs fear of and regard for the man over him, his caution, his grudge, his need and his temper. This is read by the NPC action scorer, by planned revenge (`disputes.intentDue`) and by the collector's ask moves.
- **Resentment.** Being reined in because the shopkeeper went over his head is resented, the more so the prouder he is. This is the believable competing motive the Gate 2a world lacked.
- **Discovery.** A superior who comes to believe an order was broken decides (`onDisobedience`) to discipline (`books.discipline` through a door), rebuke, or let it go.

### 6. Obligation and condition semantics (`conv/obligations.ts`)
- **Conditions.** `paid`, `knows`, `notKnows` (with exceptions), `all` and `any` are added, evaluated recursively with the existing ones.
- **Release and withdrawal.** Release is by the promisee: no break. Withdrawal is by the obligor before the deadline, and is judged less harshly than a break.
- **Conflicts.** These are detected when the second obligation is made: bound to leave a man alone and bound to lean on him, or bound to keep quiet and bound to tell. Each records the other, and a conflict raises the cost the obligor weighs when deciding.

### 7. One door for money
- **The door.** `core.transfer(w, from, to, amount, flow, note)` moves cash, is clamped to what he has, conserves money, and posts the ledger for the player's circle.
- **Where it is used.** Every person-to-person movement in `asks.ts` (loans, start-up money, restitution, favours called in, amends) and in the conversation layer uses it. `borrow.yes` now also appears on the ledger.
- **Guarded by a scan.**

### 8. Extended runs, determinism, persistence, size
Covered by the tests in §3 and the measurements in §2.

### Files

**New:**
- `conv/minds.ts`
- `conv/pursuits.ts`
- `conv/obey.ts`
- `conv/deciders.ts`
- `conv/annals.ts`
- `conv/emergence.ts`
- `conv/scenarioG.ts`
- `conv/gate2b.ts`

**Changed in the world:**
- `asks.ts`: deciders, `transfer`, and exports for stance and attempts;
- `situ.ts`: the close-hook;
- `core.ts`: `transfer`;
- `engine.ts`: imports to register the layer;
- `actions.ts` and `disputes.ts`: they read `obey.free`.

## 2. Representative autonomous chains (`docs/gate2b/CHAINS.md`)

Four seeds, 180 days, nothing scripted:

| Seed | Pursuits | Through 2+ people | Chains of 3+ requests | Orders agreed (not meant) | Obligations broken (with consequences) | Belief revisions (changed a plan) | Lies | Layer records |
|---|---|---|---|---|---|---|---|---|
| 3 | 24 | 5 | 8 | 17 (10) | 3 (3) | 85 (13) | 0 | 151 KB |
| 7 | 47 | 8 | 2 | 13 (8) | 1 (0) | 46 (13) | 0 | 131 KB |
| 11 | 35 | 6 | 0 | 19 (9) | 6 (6) | 41 (11) | 0 | 115 KB |
| 19 | 57 | 12 | 1 | 16 (13) | 9 (7) | 25 (6) | 12 | 121 KB |

All four worlds audit clean, and the business ledgers are consistent. The document prints each chain with every decision's top terms and its runner-up. The chains include:

**A chain up the hierarchy.** A shopkeeper asks a soldier he knows; the soldier keeps his word the next day and takes it to his own captain; the captain takes it to the offender's captain, who orders his man.

**An order agreed and not meant.**
1. Mario Testa tells his boss he'll leave Maria Testa alone. His decision: violate 0.60 (grudge +0.48, cost of breaking an order −0.35, volatility +0.30) against obey 0.47.
2. He goes back.
3. His boss, once he knows, decides to discipline him (discipline 0.77: an order is an order +0.35, volatility +0.30).

**A plan changed by what he learnt.** Jimmy DeSantis exhausts the men he knows, asks Artie Silvestri who Ralphie answers to, is told Charlie Cassano, and changes plan ("askAround → chair (Charlie Cassano), because he now believes Ralphie Palumbo answers to Charlie Cassano"). He waits, runs out of patience, and gives up.

**Lies, and promises weighed day by day,** shown in the document as they occurred.

**Scenario G (`docs/gate2b/SCENARIO_G.md`).** Thirty days, five people, three runs. The only thing set going is one demand on day 1.

| Run | Refused requests re-offered without a change | Routine visits that made something up | Shopkeeper came to Henry | Lies told / found out |
|---|---|---|---|---|
| acquainted | 0 | 0 of 24 | yes | 0 / 0 |
| stranger | 0 | 0 of 28 | **no**: he tried the men he knew, learnt who the man answers to, changed plan, and gave up | 0 / 0 |
| liar | 0 | 0 of 26 | yes | 1 / 0: believed, because the trouble stopped and nothing made him check |

## 3. Test results

- **Typecheck:** clean.
- **Conversation suite:** 67 tests (Gate 1: 17, corrections: 9, Gate 2a integration: 21, Gate 2b: 20), plus one opt-in year-long run.
- **Gate 2b tests** cover:
  - unification, and that an untouched world is unchanged;
  - keep-word decisions;
  - pursuits starting, never re-asking a refuser, and changing plan on new information;
  - relationships changing who is approached;
  - contradiction and uncertainty, settled by a third account;
  - misinformation and revision moving the grudge;
  - judgement following belief (a lie believed, then found out, costing more);
  - orders propagating;
  - obedience responding to circumstance;
  - release, withdrawal and conflicts;
  - `paid`, `knows`, `notKnows`, `all` and `any`;
  - the money scan and transfer;
  - 120-day runs on four seeds (audits, bounds, the 150 KB budget, emergence floors);
  - determinism, including a save and load mid-run;
  - three Scenario G checks.
- **The year-long run (`SLOW=1`):** seed 3, 365 days, 205 KB (budget 250), audits clean, 57 s.
- **Full suite (`npm run test:all`):** 409 passed, 14 skipped (the opt-in slow runs, including the new year-long run), 51 files, 282 s. Typecheck clean.
- **Removed:** Gate 2a's two staged-breach tests (a hand-set grudge, a forced intention), as Gate 2b instructs. Breach is now tested as it emerges in the long runs.

## 4. Architectural limitations

1. **Unification is partial.** These ask kinds still decide by their own weighing even in a social world: `collect`, `lend`, `recruit`, `favour`, `amends`, `rate`, `jobpay`, `buy`, `sell`, `run`, `time` and `permit`. Every kind except `protect` also chooses the asker's next move with its own model (`npcMove`).

   More importantly, **an NPC's daily choice of what to do** (`actions.chooseAction`: work, socialise, lend, collect, shake down, gamble, retaliate) is still the original utility scorer. It now reads obligations, but it is a second model. Porting it into pursuits is the largest piece of unification left.
2. **Belief uncertainty is rare in natural runs.** Across four seeds and 180 days no man ended up holding two trusted contradictory accounts (it is tested directly). Lies appeared in one seed of four. People asked about a crime mostly withhold or know nothing, which is believable silence; most contradiction arises through verification.
3. **Most agreed orders are not meant at the moment of agreeing** (55–80%). The decisions show why: these are the men who were leaning on the shopkeeper, with grudges of 0.4–0.8. Whether the share is right is a calibration question for a person to judge. Breach still needs an opportunity, and broken orders run at 1–9 per world per 180 days.
4. **The visit composer is the Scenario G harness's own,** not a general component: openings from state, options with relevance-based memory. Building it generally is Gate 3.
5. **Spec behaviours not yet implemented:**
   - overpromising has no consequence of its own;
   - recurring (instalment) obligations;
   - a police route in pursuits;
   - harassment by repeated unwanted visits (§11.4);
   - parity for meetings and mediation (§11.5).
6. **Records are kept bounded by rings.** Requests are capped at 100, so the request counts in CHAINS.md are the cap, not the total. Closed obligations are kept 180 days.
7. **Cost.** In a world without the layer, nothing of it runs. With it, 120 days takes about 9–10 s per seed. The Gate 2b tests add about a minute to the parallel suite.
8. **Gate 2a's FERRARA.md is a historical record.** It was not regenerated, because its staged section is no longer how the system behaves.

## 5. Assessment against Gate 2b's criteria

| Criterion | Met? |
|---|---|
| NPC decisions unified on the perception model, with asks executing | **Partly.** Answers to five ask kinds and the protect collector's moves are unified. Other kinds, and the daily action scorer, are not (limitation 1) |
| Pursuits replace automatic fulfilment: act, investigate, delegate, delay, renegotiate, abandon | **Yes.** Delegation is through the hierarchy: a soldier takes it to his captain |
| NPC-to-NPC conversations and requests by the player's rules | **Yes**, with traces and chains of 3+ linked requests |
| Beliefs decide: contradiction, misinformation, trust, verification, revision; consequences follow belief | **Yes** in mechanism and tests. Uncertainty is rare in natural runs (limitation 2) |
| Orders propagate; subordinates comply, resist or act independently | **Yes.** Discipline follows a believed breach |
| Release, withdrawal, conflicts, missing conditions | **Yes.** Recurring obligations not built |
| Central money transfer | **Yes** for the asks and the layer. Not yet the rest of the codebase (191 inline cash edits, mostly income and spending) |
| Extended runs, Scenario G, determinism, persistence, save size | **Yes**: 120 and 180 days on four seeds, 365 days opt-in, and save/load identity |
| No forced betrayals | **Yes.** Every breach in the transcripts is a man's own decision from his own grudge or circumstances |

**Verdict.** Gate 2b's core is in place and works: people pursue things, ask each other by the same rules the player faces, believe what they have reason to believe, and judge one another by it. Orders run down the hierarchy and are kept or broken by each man's own judgement. Two things should be settled before Gate 3:
1. how far to take unification (porting the daily action scorer);
2. a person's review of the calibration: how often men agree to orders they don't mean, how quickly victims give up, and how silent witnesses are.

I recommend sign-off on that basis, with unification of the daily scorer as the first task of Gate 3's preparation, or as a short Gate 2c if you prefer it finished first.
