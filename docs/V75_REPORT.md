# V75 — Emergent Gameplay: technical report

V76 (Dynamic Criminal Organisations) and the Final Presentation Overhaul have **not** been started.

## 1. What was implemented

Separate systems now feed one shared record of "something going on between people", and that record develops over days and weeks through what the people in it decide. The player may be in it, may be asked to settle it, may hear of it by rumour, or may never know. Nothing is scripted: each situation starts from a condition the simulation already holds.

New files: `src/situ.ts` (the engine: lifecycle, sit-downs, six arcs, mirrors, word-of-mouth, pacing, audit), `src/sitmoves.ts` (the player's side), `src/tests/v75.test.ts`, `src/tests/sit_measure.ts`, `src/tests/sit_trace.ts`, this report.

### The shared situation record (`Situation`, in `w.situations`)
Cause; kind; parties with roles; organisations; business; phase; severity; next-step time; dedupe key; bounded history (8); who knows what and how (`k`: *suspects* or *knows*, via, when); claims (3, each marked honest or not — the marking is never shown to anyone); the private `truth` of the matter; consequences (5); outcome; a record of any sit-down held (chair, participants, each man's position); and a link to the older record it mirrors. The older money / ambition / turf / org situations keep their own fields and loops; they are untouched.

### Arcs (each starts from world state, none from a timer)
| Arc | Starts from | Stages | Ends |
|---|---|---|---|
| **Skimming** | the books detect a shortfall (`books.ts` hands it over instead of an immediate reaction; falls back to the old reaction if the situation cannot start) | noticed → explanation (may be a lie) → doubt (a subordinate who saw it goes to the boss, sits on it, or a rival voices suspicion) → inquiry → confrontation | make-it-right, punishment, overlooked, dropped, believed, or cut loose |
| **Late tribute** | a shop with arrears and ≥2 late weeks, both men NPCs | late → time → pressure (possibly violent) → appeal → sit-down with the man above | more time, wipe it, take a share, enforce, take the shop |
| **Debt trouble** | a debt with ≥2 missed payments | missed → pressed → sit-down (or the two sort it out if nobody is above) | extend, restructure, write down, take a stake, enforce |
| **Partnership breakdown** | a stake-holder in a weak or resented business | complaint → response → backing → sit-down | buy-out, sell-out, dissolve, stay |
| **Promotion resentment** | a promotion (`career.promote`) where a rival of the same rank held a grudge | sulking → finds allies → airs it to the boss | placated, dismissed, reprimanded — or he starts looking for his own way (V74 independence goal) |
| **Discovered information** | a subordinate who saw his superior skimming | found → squeeze (he asks for money) or sit on it → pay or refuse and hit back | paid off, beaten, faded, moot |
| **Disputes and crew grievances** | the existing records | mirrored 1:1 | follow the source (see §3) |

### Multi-party sit-downs
One engine for all arcs. Each attendee has a position (the outcome he prefers given his interests, knowledge and relationships) and a flexibility (ambition, caution and temperament). The man in the chair weighs each man's position by his standing and by anyone who spoke up for him, with a penalty for forcing an outcome a man cannot live with; a chair who is himself a party (the boss whose money it is) decides mostly for himself; the more certain the case against a man, the less his own preference counts. Everyone present is then affected: acceptance or opposition changes trust and respect towards the chair and grudges between participants, consequences are recorded and every participant knows what was decided.

### The player
* **Stories tab** gets a new "Matter" kind. A matter shows up only if the player is a party or has been told (facts he knows). He sees what he knows, nothing else.
* **Moves** (`src/sitmoves.ts`), each gated by rank, trust or knowledge: *Ask around* (a friend who knows tells him what he knows, including what he claims; asking is noticed), *Offer to settle it* (soldier+ with both sides' respect, or capo+; a man who doesn't respect him refuses to sit), *Speak up for X* (weighs with the chair, costs with the other side), *Vouch for the accused* (if he was lying, it comes back on you), *Ask for terms* on a debt he owes (the creditor answers from his own interests).
* **Being asked to decide**: when the man who would chair a matter is the player (his crew, rank), he gets a sit-down question with a deadline. Options include "Hear them out first", which shows each side's position without closing the question, or "tell them to sort it out", which sends it to someone else. Unanswered, it lapses and is settled without him.
* **Word gets around**: a man who knows and likes talking passes it on; trouble in the player's own crew reaches him quickly, trouble in his family sometimes. Ordinary rumour already spreads the same facts.
* **Texture**: the person page shows what someone has on his mind (only if the player knows); the social club shows men with something between them sitting at opposite ends of the room, or keeping to themselves.

### Pacing and information discipline
* At most 5 serious matters open at once; none within 3 days of the last; nothing touching the player within 7 days of the last thing that reached him. 30 open / 60 closed, history 8, claims 3, consequences 5.
* `truth` is never written to a fact. Facts record only what happened and what people said. A guilty man's lie is a claim; the audit and tests check no fact contains a verdict and no one knows a fact without a record of how.

## 2. Files and systems changed
New: above. Changed (small):
* `types.ts` — `Situation` extended, `SitKind`, `World.sitcool`, `World.sitpace`.
* `world.ts` — `ensureShape` defaults for the two new fields.
* `engine.ts` — `SCHEMA` 5 → 6 (no repair needed), daily `sitDay`, weekly `sitWeek`.
* `books.ts` — a boss's notice of a shortfall goes through `skimNoticed` (falls back to the old `react`); `discipline` exported.
* `career.ts` — `promotedOver` called from `promote`.
* `situations.ts` — the old loop leaves V75 situations alone (they are identified by their key).
* `crewlife.ts` — the sit-down answer handler first in the chain; it can keep the question open ("hear them out").
* `consistency.ts` — `sitIssues` in `audit()`.
* `ui/stories.ts`, `web.ts` (`mv:` action), `ui/views_a.ts` (person texture), `places.ts` (club scene).
* **Bug fix outside V75's scope, found by the audit:** `pulse.ts` — the ambient "a family takes a rival's shop" code could choose the shop's own owner as the new collector, so he collected from himself ("owner is also its protector"). It now excludes the owner. Found on two of nine long runs; it did not appear with V75 off on the one seed tried, but is independent of V75 (V74's extra ownership churn made it likelier).

## 3. Architectural decisions
* **One door for facts**: situations speak only through `addFact` with `story: 'sit:<id>'`, so Stories, rumour, the club overhear and knowledge all use the existing machinery. No second knowledge system.
* **One source of truth for existing records**: disputes and crew grievances stay where they are; their situations are mirrors that follow their source (open ⇔ open, reopen on a genuine new cause such as a violation, never a second record). The audit reports any contradiction (with a short sync tolerance).
* **Real effects only through existing doors**: money via `bizMove`, debts via `createDebt`/`payDebt`, ownership via `transferBusiness`/`addStake`/`seizeShare`, rank and crew via `leaveCrew`. Ledger checks stay clean.
* **Quiet by default**: most steps do nothing visible; many situations end quietly; severity and pacing gate how many surface.

## 4. Gameplay behaviour
A boss notices a gap, hears an excuse (sometimes a lie), a man under the accused or a rival adds doubt, an inquiry happens, then it ends by repayment, punishment, being overlooked, or fading. A shop that stops paying is visited, leaned on, given time, or its patron is asked; the sit-down can give time, share or the shop. Loans go bad and are restructured. A promotion leaves a rival sulking; he finds allies, goes to the boss, and is bought off, put down — or starts looking for another way. A man who knows what his superior is doing may try to sell his silence. The player sees the parts he is told about and can ask around, speak up, vouch, offer to settle, or be asked to decide.

## 5. Automated test results
`v75.test.ts fast` — **28/28 pass** (final code). `v75.test.ts compat` passes; save/load round trips mid-run pass for seeds 3 and 12 (`roundtrip:<seed>`). Regression on the final code: `v74.test.ts fast` 28/28 + compat, `v73.test.ts fast` 34/34 + compat, `v72.test.ts fast` 20/20 + growth, `storage.test.ts` 5/5, legacy `src/test.ts` (determinism, round trip) pass; bot-played `stress.ts` seeds 1–3 × 240 days: 0 audit violations. The suite covers the ten required areas plus the player's moves:
1. persistence (byte-identical continuation after save/load),
2. multi-stage progress with varied endings, and quiet endings,
3. NPCs settle without the player, an unanswered question lapses and is settled,
4. the player's choice changes the outcome and what follows,
5. participants' state is consistent after a sit-down,
6. information discipline (nobody knows a fact without a record of how; no verdicts in facts; the player knows nothing until told),
7. no duplicates, no resurrection without a new cause, mirrors never contradict their source (18 checks over 180 days),
8. legacy situations, disputes, grievances and encounters still run beside the new ones,
9. bounded growth over 400 days,
10. quiet periods.

Bugs the tests and runs found while building (all fixed): the old situation loop closing mirrored disputes early; a re-broken dispute leaving a contradicting mirror (now reopens the same record); debt settlements all coming out identical; mirror cooling-off blocking a needed mirror; legacy situations flagged by the new audit; and the two owner-is-protector paths in `pulse.ts` (plus a guard in `setCollector`).

## 6. Long-run results (final code)
Each run: 360 days, a fresh world, full `audit()` every 15 days.

| Seed | open at end / peak | total kept | facts | save | quiet weeks (player) | audit |
|---|---|---|---|---|---|---|
| 1 | 8 / 19 | 60 | 859 | 2.8 MB | 50 / 51 | clean |
| 2 | 14 / 18 | 64 | 767 | 2.3 MB | 48 / 51 | clean |
| 3 | 18 / 21 | 61 | 1206 | 3.0 MB | 44 / 51 | clean |
| 4 | 18 / 24 | 67 | 1029 | 3.0 MB | 49 / 51 | clean |

Situations started per seed per year (seeds 1–4): disputes mirrored 121/113/146/145 (existing records, not new events), tribute 17/19/24/28, debt 14/8/10/8, partnership 6/6/7/9, skim 12/1/7/2, promotion resentment 3/1/3/3, discovered information 1/0/0/0. Multi-party sit-downs held: 28/15/31/30. Outcomes seen: tribute — more time 10/10/16/16, paid 2/2/2/5, shop changed hands or the arrangement changed 3/5/6/5; debt — caught up 11/8/6/3, paid 1/0/2/1, enforced 2/0/1/2, restructured 0/0/0/1; skim — made it right 7/1/5/0, believed 2/0/2/2, overlooked 2/0/0/0, dropped 1/0/0/0; partnership — bought out 4/3/6/9, patience 2/2/1/0; resentment — placated 3/1/3/2; discovered information — beaten after refusing 1. Mirrored disputes reopened on a real new cause: 36/28/52/47. Word-of-mouth passes: 14/8/16/10; crew word reaching the player: 1/0/0/2.

540-day run (seed 9, an earlier build; skim weighting was tuned afterwards): max open 20, 15 skim, 45 tribute, 27 debt, 7 partnership, 4 resentment, 49 sit-downs; quiet 37/77 weeks, busy (≥3 matters reaching the player in a week) 12/77; save 3.9 MB; audit clean.

Bot-played stress runs (an associate who plays all game, 240 days; seeds 1, 2, 3): 0 audit violations on the final code.

Baseline for cost (seed 3, 360 days): with V75 off facts 1097, save 2.6 MB; on (final code): facts 1206 (+10 %), save 3.0 MB (+14 %).

## 7. Detailed traces
Seven traces produced by `src/tests/sit_trace.ts` on the final code (fixtures set up the starting condition; everything after is the engine). "[false - hidden from everyone]" is the test harness showing a lie that no character can see.

```
=== TRACE 1: a skimming matter that unravels (seed 2) ===
  Stevie DeSantis (boss) and Sal Fiore (soldier, actually skimming). Rocco Zito works under Sal Fiore.
  cause: Stevie DeSantis has noticed Sal Fiore’s numbers don’t add up
  parties: boss=Stevie DeSantis, accused=Sal Fiore
  who knew what: Stevie DeSantis (knows, witness); Sal Fiore (knows, self); Rocco Zito (knows, saw it)
  claims: Sal Fiore: "Sal Fiore told Stevie DeSantis it was a slow few weeks." [false - hidden from everyone]
  history: 
    day 16: Stevie DeSantis noticed Sal Fiore's numbers don't add up. About $280 has gone missing.
    day 26: Sal Fiore told Stevie DeSantis it was a slow few weeks.
    day 33: Stevie DeSantis had someone look into Sal Fiore’s numbers.
    day 36: Stevie DeSantis settled it. Sal Fiore makes up the difference and passes up a little more.
  outcome: repay; consequences: Sal made it up
  persistent: Sal Fiore trust in boss 0.76→0.68, grudge 0.00→0.00, cash 2234→2234, still in the family: true
  does the player know? no - nobody told him

=== TRACE 2: an innocent man under suspicion (seed 4) ===
  Carmine Russo (boss) and Mario Bruno (soldier, honest, trade is just slow). Stevie Bruno works under Mario Bruno.
  cause: Carmine Russo has noticed Mario Bruno’s numbers don’t add up
  parties: boss=Carmine Russo, accused=Mario Bruno
  who knew what: Carmine Russo (knows, witness); Mario Bruno (knows, self)
  claims: Mario Bruno: "Mario Bruno told Carmine Russo it was a slow few weeks." [true]
  history: 
    day 16: Carmine Russo noticed Mario Bruno's numbers don't add up. About $280 has gone missing.
    day 25: Mario Bruno told Carmine Russo it was a slow few weeks.
  outcome: understood; consequences: Carmine accepted Mario’s word
  persistent: Mario Bruno trust in boss 0.85→0.87, grudge 0.00→0.00, cash 3441→3441, still in the family: true
  does the player know? no - nobody told him

=== TRACE 3: the same matter, another boss and another roll (seed 6) ===
  Eddie Pellegrino (boss) and Dom Bianchi (soldier, actually skimming). Nicky Pellegrino works under Dom Bianchi.
  cause: Eddie Pellegrino has noticed Dom Bianchi’s numbers don’t add up
  parties: boss=Eddie Pellegrino, accused=Dom Bianchi
  who knew what: Eddie Pellegrino (knows, witness); Dom Bianchi (knows, self); Nicky Pellegrino (knows, saw it)
  claims: Dom Bianchi: "Dom Bianchi told Eddie Pellegrino it was a bad run at the tables." [false - hidden from everyone]
  history: 
    day 16: Eddie Pellegrino noticed Dom Bianchi's numbers don't add up. About $280 has gone missing.
    day 25: Dom Bianchi told Eddie Pellegrino it was a bad run at the tables.
    day 32: Eddie Pellegrino had someone look into Dom Bianchi’s numbers.
    day 35: Eddie Pellegrino decided there was nothing to it.
  outcome: dropped; consequences: -
  persistent: Dom Bianchi trust in boss 0.90→0.90, grudge 0.00→0.00, cash 2381→2381, still in the family: true
  does the player know? no - nobody told him

=== TRACE 4: a shop that cannot pay ===
  Lou Ferrara owns Ferrara's Barber Shop; Mario Esposito collects for the family; Charlie Cassano sits above.
  cause: Ferrara's Barber Shop is behind on what it owes Mario Esposito
  parties: collector=Mario Esposito, owner=Lou Ferrara
  who knew what: Lou Ferrara (knows, witness); Mario Esposito (knows, witness); Paulie DeSantis (knows, was told)
  claims: Lou Ferrara: "Lou Ferrara told Mario Esposito the place has been dead and he can’t find it." [true]
  history: 
    day 16: Lou Ferrara told Mario Esposito the place has been dead and he can’t find it.
    day 20: Mario Esposito’s men smashed up Ferrara's Barber Shop to make a point.
    day 23: Paulie DeSantis told Mario Esposito to give Lou Ferrara more time.
  outcome: extended; consequences: he has until it is paid
  persistent: Lou Ferrara's grudge against Mario Esposito 0.00→0.70; arrears now 175; stakes []; owner now Lou Ferrara

=== TRACE 5: a loan that has gone bad ===
  Stevie Lombardi lent Sal Fiore 600; Sal Fiore has missed three payments.
  cause: Sal Fiore is behind on what he owes Stevie Lombardi
  parties: creditor=Stevie Lombardi, debtor=Sal Fiore
  who knew what: Sal Fiore (knows, witness); Stevie Lombardi (knows, witness); Mario Corrente (knows, witness)
  claims: Sal Fiore: "Sal Fiore told Stevie Lombardi he’ll have it soon." [true]
  history: 
    day 16: Sal Fiore told Stevie Lombardi he’ll have it soon.
    day 22: Stevie Lombardi let Sal Fiore know he wants his money.
    day 22: Mario Corrente cut what Sal Fiore pays each week and what it costs him.
  outcome: restructured; consequences: -
  persistent: debt balance 600, weekly 30, status active

=== TRACE 6: the player is asked to decide (Rocco Corrente resents Marty Palumbo; the player runs the crew) ===
  question to the player: They want you to settle it: Rocco Corrente: passed over
  options: Give him something to keep him sweet — Rocco Corrente can live with it. Marty Palumbo won’t. / Tell him his time will come — Marty Palumbo can live with it. Rocco Corrente won’t. / Tell him to know his place — Marty Palumbo can live with it. Rocco Corrente won’t. / Hear them out first — See where each of them stands. / Tell them to sort it out themselves — They will. You may not like how.
  player chooses "placate": Tony Marino gave Rocco Corrente $200 and his backing. Marty did not like it.
  cause: Rocco Corrente was passed over when Marty Palumbo was made
  parties: boss=Tony Marino, rival=Rocco Corrente, winner=Marty Palumbo
  who knew what: Rocco Corrente (knows, witness); Tony Marino (knows, witness); Marty Palumbo (knows, witness)
  claims: -
  history: 
    day 22: Rocco Corrente went to Tony Marino and said he deserved better than he got.
    day 22: Tony Marino gave Rocco Corrente $200 and his backing.
  outcome: placated; consequences: Rocco was bought off
  persistent: Rocco Corrente cash 11957→12157, trust in the player 0.10→0.22, backer=the player
  question to the player: They want you to settle it: Rocco Corrente: passed over
  options: Give him something to keep him sweet — Rocco Corrente can live with it. Marty Palumbo won’t. / Tell him his time will come — Marty Palumbo can live with it. Rocco Corrente won’t. / Tell him to know his place — Marty Palumbo can live with it. Rocco Corrente won’t. / Hear them out first — See where each of them stands. / Tell them to sort it out themselves — They will. You may not like how.
  player chooses "reprimand": Tony Marino told Rocco Corrente to know his place. Rocco did not like it.
  cause: Rocco Corrente was passed over when Marty Palumbo was made
  parties: boss=Tony Marino, rival=Rocco Corrente, winner=Marty Palumbo
  who knew what: Rocco Corrente (knows, witness); Tony Marino (knows, witness); Marty Palumbo (knows, witness)
  claims: -
  history: 
    day 22: Rocco Corrente went to Tony Marino and said he deserved better than he got.
    day 22: Tony Marino told Rocco Corrente to know his place.
  outcome: reprimanded; consequences: Rocco was put in his place; Rocco is looking for a way out; Rocco did not accept it
  persistent: Rocco Corrente cash 11957→11957, trust in the player 0.10→0.00, backer=-

=== TRACE 7: the player gets involved on his own initiative ===
  matter: Stevie DeSantis and Sal Fiore: the numbers
  before he hears of it, moves open to him: Ask around / Offer to settle it
  asks around: Mario Corrente tells you: “Stevie DeSantis noticed Sal Fiore's numbers don't add up. About $280 has gone missing.” That is what he says. Whether it is so is another matter.
  offers to settle: Tony Marino decided to let it go. Everyone at the table can live with it.
  cause: Stevie DeSantis has noticed Sal Fiore’s numbers don’t add up
  parties: boss=Stevie DeSantis, accused=Sal Fiore
  who knew what: Stevie DeSantis (knows, sat down); Sal Fiore (knows, self); Mario Corrente (knows, saw); Tony Marino (knows, witness)
  claims: -
  history: 
    day 16: Stevie DeSantis noticed Sal Fiore's numbers don't add up. About $280 has gone missing.
    day 20: Tony Marino decided to let it go.
  outcome: overlook; consequences: the money was never recovered
```

## 8. Save compatibility
Schema 6. A V74 save (schema 5, no situation fields) loads, gets empty pacing defaults, new situations start as the world runs, audit is clean after 90 days, and re-saving round-trips byte-identically. Two mid-run saves (seeds 3 and 12, with 10 and 4 open situations) reload and continue to the same state as the uninterrupted run (compared key-order-insensitively; a pre-existing key-order difference in the `coup` field of a reloaded world is the only difference in raw bytes).

## 9. Known limitations and honest findings
* **The player rarely sees any of it.** A passive associate with no crew hears of 0–4 matters a year; typically 44–50 of 51 weeks are quiet. That is intentional pacing, but it means most of what the simulation now does happens off-screen. The Stories, club and person-page texture only show what the player has learned.
* Skim endings concentrate in "make it right", "believed", "overlooked" and "dropped"; punishment and being cut loose are rare (2 of 40 in a controlled spread, none in the four year-long runs). The boss usually takes a compromise that the accused can live with.
* Mirrored disputes dominate the situation counts (115–175 a year); they are not new events, only unified bookkeeping.
* **Not implemented as separate moves**: "request a meeting", "propose a business arrangement" and "raise a dispute" have no new button. Raising a dispute and buying into a business already exist from earlier versions (people, disputes, V73 stakes); the new moves cover asking, mediating, supporting, challenging an accusation (vouching) and negotiating a debt.
* Rank experience: associates get mostly local gossip and "ask around"; soldiers and capos can mediate and are asked to decide matters in their own crew; higher-level negotiation and succession politics are not newly modelled.
* The owner-is-protector bug fixed in `pulse.ts` was found by the audit; it is an old defect, not a V75 regression. One earlier occurrence on seed 3 could not be reproduced after later changes (the run was clean on both the baseline and the final code), so I cannot say that occurrence had the same cause.
* Save size and fact count rise (+14 % / +10 % on the one baseline measured, seed 3).
* Tests take several minutes because every long scenario builds worlds; the cost is in the fixtures, not the game.

## 10. Deviations from the spec
No deliberate deviations other than the unimplemented separate buttons above and the unrelated `pulse.ts` fix.

## 11. Subsequent versions
V76 (Dynamic Criminal Organisations) and the Final Presentation Overhaul are untouched. Awaiting your explicit approval before starting V76.
