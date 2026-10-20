# V74 — NPC Agency & Autonomy: technical report

Published as Version 75 of the artifact (V74). V75, V76 and the Final Presentation Overhaul have **not** been started.

## 1. What was implemented

NPCs now hold **persistent, bounded, goal-directed plans** that they work on over weeks, through the same systems the player uses.

New file `src/goals.ts` (the whole feature). Six goal categories, each a multi-stage plan:

| Category | Stages (each a separate weekly-reviewed step) | What it really does |
|---|---|---|
| Business acquisition / expansion | scout → save → approach → sound him out → negotiate → (finance) → close | Buys a business outright, or buys a part-stake. Pays the seller from his own cash; ownership changes via V73 `transferBusiness` / `addStake`. Partner or lender can cover a shortfall (partner gets a stake; lender gets a real `Debt`). |
| Recruitment | spot → approach → decide | Rank-gated (soldier and up), crew-size capped, costs real money, uses the existing `recruitProspect` → `applyRank`. Two recruiters can compete for one man. |
| Promotion / advancement | build → (ask for backing / gift / build crew / undermine rival) | Only works on the inputs the existing `readiness()`/`careerTick` read (sponsor, standing, crew). **Never grants a rank.** |
| Debt recovery | recover → pay extra / ask time / renegotiate / sell a stake / lean on the creditor / stall | Chooses by personality and distress; extension/renegotiation are NPC↔NPC (or an ask to the player). |
| Wealth accumulation | build → invest in own place / lend at interest / pursue his debtors | Investment goes through `bizMove` (inject + invest); loans create real `Debt`s; collection goes through `payDebt`. |
| Independence | income → outside ties → better terms (→ walk away) | Builds ties (relationship changes), asks the boss for a lower `kickRate` (floored), can finally leave the crew via `leaveCrew`. |

Goal record (persistent, in `w.agency.goals`): id, NPC, category, target, motive, priority, stage, needed resources, resources at start, next planned action, obstacle, progress, start/review/deadline times, tries, counterpart, financing, abandoned-target list. Ended goals go to a bounded ring (60) with outcome and reason.

Behaviour rules:
- **Choice of goal** weights circumstance and personality (`traits`, the old private `want`, cash, debts, rank, trust in boss), with noise; a second concurrent goal only if it nearly matches the first. Max **2 per man**, 40 % weekly chance to consider, cool-offs after done/failed/dropped (3/8/5 weeks, 20 weeks for the same kind after failing).
- **Personality shapes method**: greedy lowballs and prefers loans; cautious asks for more savings first, pays debts down; reckless reaches further beyond resources; proud + violent men refuse to pay more or share a purchase; violent+brave debtors may lean on creditors.
- **Failure is real**: rejections, price disputes, no way in, lost savings, jail > 30 days, creditor refusal, ran out of time, a rival recruiter gets the man, target sold to someone else, death.
- **Pacing**: decisions are 0.3–6 weeks apart per goal; almost everything is invisible. The player is asked only when plausible (they are the creditor asked for time, the superior asked for financing, the sponsor asked for backing, a keen prospect asks to run with them), max one open question, ≥ 12 days apart; ignoring it = refusal, and the NPC carries on.
- **Economy**: all value movement is a transfer between existing holders (character cash, business till through `bizMove`, `Debt`s through `createDebt`/`payDebt`). Investments in an NPC's own place leave the books like any other business expense (counted separately so the audit can tell it from a leak).

## 2. Files and systems changed

New: `src/goals.ts`, `src/tests/v74.test.ts`, `src/tests/agency_measure.ts`, `V74_REPORT.md`.
Changed (small, explained):
- `types.ts` — `Goal`, `GoalEnd`, `Agency`, `World.agency`.
- `world.ts` — `ensureShape` creates an empty agency (shared by new worlds and loads).
- `engine.ts` — `SCHEMA` 4 → 5 (no data repair needed), weekly hook `agencyWeek(w)` after `careerTick`.
- `core.ts` — `handleDeath` calls `goalsOnDeath` so a dead man's plans end at once.
- `crewlife.ts` — two encounter handlers (`goalChoose`, `joinChoose`) ahead of the existing chain; uses the existing `crew` encounter screen, no new UI.
- `consistency.ts` — `agencyIssues` added to `audit()`.
- `tests/v73.test.ts` — schema assertion now uses `SCHEMA`; `stress.ts` prints agency ask counts; `package.json` — `test:v74`.
Nothing in V72/V73 logic was altered: ownership, tribute, protection, ranks and hierarchy are reached only through their existing functions.

## 3. Architectural decisions
- One source of truth: a goal only stores *intent* (target ids, stage, plan). Ownership, cash, debts, ranks, relationships live where they always did; a goal never keeps a copy.
- Promotion stays with `readiness()/careerTick`; an ambition cannot grant rank.
- No new currency, timers or progress bars exposed; goals are not shown to the player (information discipline) — they are visible only through consequences (a sale, a stake, a recruit, an ask).
- Determinism: all randomness from `w.rng` in a fixed order (goals sorted by review time, then id).
- Storage: agency ≈ 38 KB at 360 days; ended ring capped; cool-off map pruned; goals hold no fact ids.

## 4. Gameplay behaviour added
Men now buy shops from owners in trouble, buy into places, take on recruits, ask superiors for backing and bring gifts, undermine rivals (sometimes get caught → grudge), chase debtors, lend at interest, ask creditors for time, sell stakes to cover debts, build outside contacts, ask for better terms or walk away from their boss. The player occasionally gets: "X needs more time", "X wants backing" (financing a purchase for a stake), "X wants to run with you" (when made, with room).

## 5. Automated test results
- `v74.test.ts fast` — **28/28 pass** (goal structure, migration, purchase pays and conserves money, can't-afford, can't-buy player/casino, refusal handling, partner financing and refund, reprioritisation on lost savings/jail, death, recruit authority and competition, no auto-promotion, backing, debt extension/repay, personality divergence, independence floor, investment through ledger, player ask accept/refuse/lapse, ask spacing, bounded ring/cap, audit detects corruption, 60-day determinism with zero money leaks, save/load mid-plan identical continuation).
- `v74.test.ts compat` — passes.
- Regression: `v73 fast` + `compat`, `v72 fast`, `storage`, `v72 growth` — all pass. Legacy `src/test.ts` (8 seeds × 180 days, determinism, round trip) — passes. Bot-played `stress.ts` seeds 1, 2 × 240 days — audit violations 0.
- A bug found by the bot run (a goal outliving a man killed mid-week) is fixed and covered by `goalsOnDeath`.

## 6. Long-duration results (4 seeds × 360 days, unattended, final code; each seed ran the money audit on every goal step)

Counts per seed (seeds 1/2/3/4):

| Measure | Counts |
|---|---|
| Goals started: business | 196 / 188 / 211 / 233 |
| started: advance (promotions pursued) | 75 / 71 / 70 / 80 |
| started: independence | 21 / 25 / 36 / 30 |
| started: wealth | 29 / 30 / 30 / 30 |
| started: debt | 10 / 11 / 9 / 24 |
| started: recruit | 8 / 10 / 7 / 9 |
| **Completed** (business / advance / independence / wealth / debt / recruit) | 48,17,13,13,9,5 / 37,15,17,17,10,7 / 42,15,23,20,9,5 / 55,11,15,17,21,7 |
| **Failed** (business / advance / independence / wealth) | 71,1,2,2 / 69,1,2,2 / 60,0,2,1 / 61,0,1,0 |
| **Abandoned** (business / wealth / recruit / advance) | 49,3,3,1 / 53,7,3,1 / 77,3,2,1 / 85,6,2,4 |
| **Business acquisitions (full)** | 20 / 14 / 23 / 17 |
| **Part-stakes bought** | 28 / 23 / 19 / 38 |
| **Investments** (financing, stake sales, loans-for-purchase) / own-place improvements | 5,5 / 4,3 / 7,14 / 3,1 |
| **Recruitment attempts → recruits** | 8→5 / 10→7 / 8→5 / 12→7 |
| **Promotions pursued → goals achieved** | 75→17 / 71→15 / 70→15 / 80→11 |
| NPC↔NPC interactions: offers / sounding-out / financing / intros / ask-backing / ask-time / terms | 320,246,5,14,2,6,18 / 247,209,4,5,0,6,24 / 288,224,10,13,2,2,29 / 349,254,5,20,0,30,31 |
| Offers refused | 265 / 206 / 238 / 292 |
| Debt extensions granted / renegotiations | 3,8 / 0,17 / 6,19 / 0,17 |
| **Money leaked by any goal step** | **0 in all seeds** |

(Remaining counters — gifts, ties, undermining attempts, lending — are in the test output; undermining 110–245/yr, 29–51 "caught".)

Economy and bounds at day 360 (seeds 1–4): total NPC cash 1.16M/1.05M/0.97M/1.09M (agency off, seed 1: 1.24M, same envelope; seed 1 with agency: 1.16M); Gini 0.27–0.42 (off, seed 1: 0.26; seed 1 with agency: 0.27); businesses 49–53, owners 45–49, largest holder 2–3 businesses; distressed ≤ 1; stakes 18–41. Peak goals 109–142 (cap 2 × ~100 men), ended ring 60, open encounters ≤ 8. 720-day run (seed 4): cash plateaus at ≈1.2M after day 540, business/ownership counts stable, audit and ledger clean.
Player-facing asks in the bot-played runs: 0 (an associate with no debtors and no crew is rarely a plausible party); all ask paths are covered by unit and UI tests.

## 7. Save compatibility
Schema 5. A V73 save (schema 4) loads, gets an empty agency, NPCs form goals as the world runs, audit/ledger stay clean, and re-saving round-trips byte-identically. Mid-plan saves (≥ 3 plans in flight; seeds 11, 3, 8, 70–150 days) reload and then continue **byte-identically** to the uninterrupted run.

## 8. UI interaction check (phone viewport, Playwright)
A save with a pending ask loaded via Continue; "Joey needs more time" appears on Today, opens, "Give him two weeks" applies the extension and shows the reply; no page errors.

## 9. Known limitations / honest findings
- **Storage cost**: with agency on, the save and fact count are ~35 % higher at 720 days (3.8 MB vs 2.8 MB, seed 4; facts 1181 vs 874). The goal records themselves are small (≈ 38 KB); the rest is downstream: more ownership changes cause more protection/struggling/gambling activity and facts, and `known` per NPC grows with them. Growth continues at a rate of the same order as before and is still governed by the V72 sweep; it is not zero.
- Most business plans fail (≈ 60–85 per seed per year ended failed + dropped vs ≈ 50 done). Owners are mostly unwilling; this is intended but the churn is high and could be tuned.
- Undermining rivals and gifts to the boss are frequent (hundreds per year); they are cheap transfers/relationship nudges, not fact-generating (the "caught" rumour fact was removed to save storage).
- Promotions: ~15 achieved per seed per year from ~72 pursued; the career system's own pacing remains the limit.
- Players below made rank, or without debtors/crew, rarely see asks; they see consequences (new owners, new stakes, new men in crews).
- NPC goals are not viewable in the UI (by design).
- No one reaches boss by goal (advancement toward boss is left to the existing coup/succession systems); no player-founded families or faction wars (out of scope).
- Prospects supply limits recruitment to ~5–7 per year per world.

## 10. Deviations from the spec
None intended. Interpretation: "recruit an associate" and "associate asks to join" use the existing prospect pool; "owner seeks backing" is implemented as buyer-seeks-backing and debtor-sells-stake.

## 11. Subsequent versions
V75 (emergent situations), V76 (dynamic organisations) and the Final Presentation Overhaul are untouched. Awaiting your explicit approval before starting V75.
