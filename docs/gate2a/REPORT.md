# Gate 2a: integration, results and assessment

*Branch `conversation-rebuild`. Transcripts: `docs/gate2a/FERRARA.md` (regenerate with `npx tsx src/conv/gate2a.ts`). Tests: `src/tests/conversation/` (`corrections`, `integration`, `breach`, plus Gate 1's). The old conversation system is untouched. Nothing is deployed. Gate 2b and the player interface have not been started.*

## 1. The two mandatory corrections

### Particulars come from perception, or are not said

**How it works:**
- Every bank line now names its particulars as slots: business kind, when, how long, item bought, names.
- Each slot is filled by the decision from the speaker's own perception (`perception.particulars`):
  - `shopNoun` and `ownShopNoun` come from the shop's kind;
  - `protectedSince` comes from his arrangement's record;
  - `lastAt` comes from facts he knows;
  - `smallBuy` comes from what the shop sells.
- **New rule in the renderer:** a line naming a slot the speaker could not fill is never used. Other variants are tried, then the next, more general key. For example, Gino says "I paid your man $200. Ask him." when he has no record of when.

**What was removed:** bakery, loaf, cannoli, window, glass, Fridays, Tuesday, "for years", "a long time", "on the first", "across the street", and hard-coded names (Lou, Nate, Gino).

**Regressions (`corrections.test.ts`, plus Gate 1's two former limitations, now passing):**
- A scan finds no bank line containing a particular in its own words (`render.PARTICULARS`).
- Slot eligibility is enforced.
- Duration comes only from the record.
- The shop noun matches the shop's real kind. This caught a Gate 1 fixture that had renamed a bakery "Ferrara's Grocery".
- "When he last saw them" comes only from a fact he knows.
- The 200-visit generalisation run reports zero particulars outside slots.

### The speaker's role is part of the meaning

**How it works:**
- `Meaning.role` is one of victim, witness, hearsay, actor or none. It comes from `perception.roleIn(fact)`.
- `roleIn` checks "it was done to him, or his place" before how he learnt of it, because the world records a victim as a witness.
- The renderer tries `key.role` before the bare key, so each role gets its own words.

**What a man can honestly claim (`types.CLAIMABLE`):**
- A witness who says he saw nothing is lying (`honest: false`).
- A victim keeping quiet says so plainly ("I don't want any more trouble").
- A man who only heard says so ("I didn't see it myself").
- Claims carry a basis, and belief weighs it: seen or own above heard.

**Regressions:** five role tests, and the generalisation run reports zero role mismatches.

## 2. What was built: the conversation layer on the world's systems

| Spec record | Implementation | Existing door it uses |
|---|---|---|
| **Actions** (§3.2) | `conv/doors.ts`: `inform`, `raise`, `order`, `demand`, `force`, `withdraw`, `agree`, `pay`, `favour`, `regard`, `grudge`, `happened` | `core.learn`, `asks.layoffFor`, `asks.openAsk` + `move`, `asks.agreeAsk` (new: a yes decided elsewhere, carried out by the kind's own `yes`), cash + `ledger.post`, `encounters.addFavour`, `core.feel`, `core.bear`, `core.addFact` |
| **Requests** (§6.1) | `conv/social.ts` `Request`. Rides on the world's ask where one exists (`sit`, and `rode` once the world sweeps the ask) | `asks.ts` situations |
| **Agreements** (§6.3) | `Agreement`: parties, terms, witnesses, the obligations it made | (the layer's own record) |
| **Obligations, four types** (§6.3–6.5) | `conv/obligations.ts`: one set of rules for the world store and the Gate 1 harness. Also parent chains (delegation), `delegatedTo`, liabilities, credit, orders, void | Checked against `w.facts` and the asks |
| **Conditions** (§3.3) | `noHostility` (the man and his men), `demandWithdrawn` (the world's ask closed), `actionDone`, `effort`, `notDisclosedBy` | `w.facts`, `w.situations` |
| **Authority** (§6.2) | `conv/authority.ts`: `may`, `chairFor`, `reach`, `superiors`. Routes requests: a man who cannot order the offender takes it to the man who can | The hierarchy (`bossId`, ranks), `econ.crewGround` |
| **Relationships** | Keep and break effects: the beneficiary's trust (by credit), broken-word facts, liabilities, a superior's grudge for a broken order | `core.feel`, `core.bear`, `core.addFact` |
| **Economy** | `door.pay` (cash and ledger, refused if short); favours | `ledger.post`, `encounters.addFavour` |
| **World tick** | `conv/tick.ts` `socialDay`, called daily from `engine.ts`, does five things (listed below). A hostile fact settles period obligations at once (`core.factHooks`). Nothing runs for a world without `World.social` | `engine.advance` |
| **Persistence** | `World.social?` is optional. Saves from before it load unchanged. Bounded retention: closed records 180 days, rings of 200/400 | `serialize`/`deserialize` |

What `socialDay` does each day:
1. It watches the asks requests ride on.
2. NPCs carry out the action obligations they took on.
3. NPC-to-NPC requests are answered: an order request is decided by `respond.onOrderRequest`.
4. A man who decided to break an order acts on it.
5. Obligations are settled, and the effects of keeping or breaking them are applied.

**Downstream systems that now read the records:**
- **NPC action scoring (`actions.generate`):** a man bound to leave someone alone, and meaning it, does not consider shaking down or retaliating against him.
- **Planned revenge (`disputes.intentDue`):** a man who has since agreed to leave the target alone, and means it, calls off what he had planned. The first Ferrara runs showed this gap: Richie agreed, meant it, and beat Jimmy anyway from a plan made the week before.

## 3. The Ferrara dispute, end to end (`docs/gate2a/FERRARA.md`)

**Setup.** Seed 3, real people under their own names. Henry's captain is Louie Costa. Richie Valenti is a soldier in Johnny Lucchese's crew, and Jimmy DeSantis keeps a bakery on Louie's ground.

**§1, kept:**
1. Richie leans on Jimmy through the world's own `protect` ask. Jimmy refuses. Richie presses it with force, and the bakery is smashed.
2. Jimmy comes to Henry: "Richie's people were in yesterday", from the fact he knows. He tells Henry what happened (`inform`).
3. Henry promises a result. This is recorded as O1, and the trace notes it is beyond his power.
4. Louie refuses ("not one of ours") until Henry tells him what Richie's people did on his ground. Louie now knows it, his decision changes, and he agrees with a liability on Henry (O2, action, serving O1).
5. On day 5 Louie takes it to Johnny, offstage. That keeps O2.
6. Johnny decides to order Richie. The order is the world's own `layoff` ask, and Richie's answer is the ask's.
7. Richie agrees. His own decision (`onOrder`) is to keep it, and he lets his demand drop. That creates O3, a restraint and an order, serving O2.
8. Thirty clean days later O3 is kept, and O1 is kept with credit shared by delegation.
9. Jimmy's first word when Henry returns: "Richie's people haven't been back. Was that you?" Jimmy now owes Henry a favour.

**§2, broken:**
- **The one staged input,** disclosed in the transcript: Sal Gallo is given a grudge against Jimmy.
- **What follows is the world's:**
  1. Sal refuses his captain.
  2. He beats Jimmy on day 12.
  3. O1 breaks at that moment, not at day 31.
  4. The liability falls on Henry: Louie thinks less of him.
  5. Jimmy: "They were back. You said you'd make sure."

**§3–6, the variants from spec §11.2, with no new code:**
- An action promise is kept by raising it, though the captain says no.
- An effort promise is kept by a failed attempt.
- A result is kept with no credit: the other captain wouldn't act, and the man stayed away anyway.
- An action promise is broken by Henry never getting to it.

**Audits.** The world audit and the business ledgers are clean after every run.

## 4. Test results

- **Typecheck:** clean.
- **Conversation tests (`npx vitest run src/tests/conversation`):** 50 tests. They cover Gate 1 (17), the corrections (9), integration (21) and breach (3).
- **Integration tests** cover:
  - the door scan (nothing in `src/conv` writes a world record except `doors.ts`; every catalogue action calls an existing door, with `raise` the one exemption because it is the request itself);
  - the six §6.5 rule groups on world records (action, effort, result over a period, result by a date, restraint, void versus broken);
  - authority routing;
  - Ferrara creation, delegation and fulfilment against real records;
  - audits;
  - NPC behaviour reading a restraint;
  - an untouched world gets no records;
  - payment conserving money and appearing on the ledger;
  - a save made mid-dispute, which continues identically;
  - word-for-word determinism.
- **Full suite (`npm run test:all`):** 392 passed, 13 skipped (the opt-in slow runs), 51 files. Under parallel load the heavier Ferrara scenarios had pushed two existing timing checks (a portrait benchmark, a 10 s menu crawl) over their limits; the Ferrara tests were trimmed to reuse one chain run, and the suite passes clean.

## 5. Architectural conflicts discovered

1. **Asks fuse decision and effect.** Each ask kind both decides (`lean`/`answer`) and acts (`yes`). The new model separates them. In Gate 2a:
   - player-facing decisions are `respond.ts`'s, and their effects go through the kind's own `yes` (via the new `agreeAsk`);
   - NPC-to-NPC asks (Lou answering his captain) are still decided by the ask's `lean`.

   Two decision models now coexist. Gate 2b must decide whether ask leans are ported into perception-based decisions or kept as the NPC-to-NPC engine.
2. **No single money-transfer door.** Cash moves inline across the world: `favour.yes`, `layoff.yes` restitution, `borrow.yes`. The ledger is posted inconsistently; for example, `borrow.yes` lends to the player without posting. `doors.pay` does both. I recommend a `core.transfer` door before more economy is routed through conversation.
3. **World mechanics write to the old conversation system's records.** `borrow.yes` pushes a memo (`t.memos`). The cut-over (Gate 4) has to replace these writes, not only the screens.
4. **Victims are recorded as witnesses.** `core.learn` gives the victim source `'witness'`. The new layer derives the role, but recording `'victim'` at the source would be cleaner.
5. **Requests with no ask kind.** Henry asking his captain to intervene has no ask kind, so it exists only as a `Request` record, decided in the visit. If NPCs are to ask captains for things on their own (Gate 2b), it needs a kind or the asks need a general request.
6. **An order binds only the man, not his people.** `noHostility` counts Lou's men (the spec does), but the NPC scorer only restrains Lou himself. In §2 one of Sal's men (Dom Mancini) also hit the shop. The model has to decide whether an order to a soldier covers his crew, through his own orders to them.

## 6. Remaining limitations

1. **Calibration: in this world nobody breaks an order, and nobody comes back.** Across 61 unstaged runs (seeds 1–12, §7):
   - 32 men were ordered and agreed, and all 32 meant it;
   - all 61 result promises were kept: after pressing a demand with force once, no soldier returned to the same shop within 45 days (cooldowns and restraint).

   Breaking an order only wins for a man with a grudge against the shopkeeper or a rift with his captain, and the world doesn't create those from this situation. A refusal adds 0.05 grudge; going to the police adds none. So breach appears only when staged (§2) or tested directly (`breach.test.ts`). This is a world-tuning question for Gate 2b, and I haven't tuned it to make a demonstration happen.
2. **NPC obligors always carry out their action obligations,** one to three days after taking them on. There is no deliberation, forgetting or reprioritising yet. That is Gate 2b (pursuits).
3. **Credit is applied as it is, not as the beneficiary perceives it.** Belief revision is Gate 2b.
4. **The overpromise is recorded but has no consequence of its own.** Spec §6.2 says others who know he lacked the power think less of him; that isn't implemented.
5. **Conditions not built:** `paid`, `knows`, `notKnows`, and `all`/`any`. Recurring (instalment) obligations aren't built either. A result promise currently tracks `noHostility` only; the spec pairs it with `demandWithdrawn`, which exists as a separate condition and isn't combined.
6. **No release or withdrawal of an obligation,** and no conflict detection between one man's obligations (§6.4).
7. **Performance.** A 45-day chain takes about 3 s, because it runs the whole world. The Ferrara transcript takes about 3 minutes to generate (it includes the 61-run table), and the integration tests are among the slower scenario tests.
8. **The save budget test (§12.2) is Gate 2b.** Retention is implemented but not yet measured against the budget.
9. **The Gate 1 fixtures** (`gate1.ts`, `gen.ts`) still set scenes by hand. They are excluded from the door scan as proof-of-concept fixtures. Everything in Gate 2a goes through doors.

## 7. Assessment

| Gate 2a criterion (spec §15, and the instruction) | Met? |
|---|---|
| Correction 1 (particulars from perception), with regression tests | **Yes** |
| Correction 2 (role in Meaning, affecting words and claims), with regression tests | **Yes** |
| Every action calls an existing door (scan) | **Yes**, with `raise` the declared exemption |
| Ledger and economy audits pass | **Yes**, after every Ferrara run and in the full suite |
| Obligation time rules (§6.5) pass unit tests | **Yes**, except recurring instalments, which are not built |
| Ferrara chain run headless against real records, end to end: creation, delegation, fulfilment, breach | **Yes**. Breach occurs naturally only when the man has a reason (limitation 1), which needed one disclosed staged grudge |
| Connected to actions, agreements, obligations, conditions, requests, authority, relationships, economy | **Yes**, at the depth this chain needs. Gaps are in limitations 4–6 |
| Meaningful actions through existing mechanics, not fixture edits | **Yes**. The one exception is the disclosed staged grudge in §2 and its test |
| Old conversation system untouched | **Yes** |

**Verdict.** I believe Gate 2a passes its acceptance tests. The new interaction model now runs on the world's own records and mechanics, and two existing systems read its obligations. The most important finding isn't a defect in the new layer: the world, as tuned, never gives a man a reason to break his word in this situation. So the consequences of breaking it, which the layer handles correctly, are rarely seen in play. That belongs in Gate 2b's scope alongside pursuits and beliefs.
