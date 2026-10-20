# V73 — Economic Foundations: technical report

Scope: V73 only. V74–V76 are untouched. Everything below was measured on this machine; numbers are from the runs named, not estimates.

## 1. What I found before changing anything

| Finding | Where |
|---|---|
| A business's cash was changed by hand from ~30 places in 15 files, with nothing recording it. | actions, blackjack, core, dialogue, encounters, engine, gigs, jobs, orders, path, people, powers2, revenge, situations |
| "Late" protection was a dice roll that **reached back and took the money from the collector** (`col.cash = max(0, col.cash − back)`), unrelated to whether the shop could pay. Money was destroyed or created depending on the collector's balance. | people.ts |
| Shaking a shop down credited the collector up to `shop + owner` cash but only removed money from the shop. **Money created.** | orders.ts |
| Helping a man in trouble put the same money into both his pocket and his business, in three places. **Money duplicated.** | situations.ts ×2, encounters.ts |
| A man "fighting with a friend" had 15% silently cut from what he *declared* (not what he earned), so his boss saw a discrepancy. A false accusation manufactured by the simulation. | books.ts |
| Whether a man mentioned income his boss could not see was a coin tossed every week. | books.ts |
| Being short (cash) was treated identically to skimming: three short weeks → beating, loss of shop, or doubled debt, whatever the cause. | books.ts |
| Auditing a man's books showed you his *true* gross including sources you could not see. | books.ts `auditMember` |
| Ownership never changed. The only thing that moved was the protection collector. Stakes lived on the player, not the business. | types, powers2, books |
| `dialogue.ts` had the arguments of `isSuperior` swapped: "Discuss earnings" was not offered for your own boss, and a deep subordinate got text written for a boss. | dialogue.ts |
| **V70 negotiation, reconciled.** The audit said NPCs cannot negotiate tribute; V70 said they can. Both are partly right. What exists and still works: a crewman asks *the player* for a lower share (`pulse.ts`, life event `rate`: agree −5%, meet −2%, refuse) and the player can ease/raise by ruling or at a sitdown. What did not exist: NPC↔NPC talks, any NPC response to a reasoned request, and the player asking his own boss. I kept all of the former unchanged and added the latter (§4). | pulse.ts, meetings.ts, books.ts |

## 2. What was built

### 2.1 One record of business money (`src/econ.ts`, new)
* `bizMove(w, b, delta, kind, who?)` is the only way a business's cash changes. `Business.cash` is now `readonly` in the type, so **a stray `b.cash += …` no longer compiles**. (The compiler found one I had missed, in `actions.ts`.)
* Every movement is a `Txn {t, k, b, d, bal, who?}`: revenue, expense, protection, extort, draw, inject, invest, theft, damage, fine, stake, gamble, aid, debt, settle. `bal` is the balance after it.
* `ledgerCheck(w)` replays the record: each balance must equal the previous balance plus the movement, and the last must equal the real cash. A hand-edited balance is detected (tested).
* Once a week `strikeAccounts()` sums the week's transactions into `Business.acct` (8 weeks kept) and drops the transactions that are now summarised. Revenue, profit, "what he drew" and "what the collector got" are all read from these; none is kept separately. Same-kind movements on the same day merge (a casino takes hundreds of bets a day) and the merge survives save/load (§6, a real bug caught here).
* Protection: `payProtection()` is the only weekly path. A shop pays what it can; the rest becomes `protection.owed` (real money) with `late` counting missed weeks and `why` recording the true reason: `unable` (till empty) or `delayed` (could have paid, did not — nerves, a grudge, a quarrel over who to pay, greed; never because the till was empty). The collector is credited only for what was actually handed over; nothing is taken back afterwards. The 7 ad-hoc places that took protection money (visit, lean, shake, half-now-half-Friday, give-a-week, waive, …) now call `takeFromBiz`/`giveTime`/`clearArrears`.
* `setCollector()` is the single door for changing who collects; arrears travel with it when a boss takes a shop from his own man, and are dropped when a rival family takes it.

### 2.2 Tribute: telling the causes apart (`src/books.ts`)
Every week of every man's books now carries a hidden `tone` — what really happened — which only the simulation knows:

| tone | meaning |
|---|---|
| `paid` / `downturn` | paid in full (downturn: in a weak week) |
| `unable` | could not pay: not enough cash |
| `delayed` | could pay and put it off a week (rare, driven by money trouble) |
| `underreported` | deliberate: a skim decision, or concealing income his boss cannot see (now a decision lasting 2–6 weeks, like skimming already was) |
| `withheld` | deliberate non-payment (refusing or stalling) |
| `jailed` | away |

What changes because of it: the boss judges by **what he can see** (the man's visible income against his last two months). A man who is short while his visible income has collapsed, or who is laid up, is *understood*: smaller trust penalty, no punishment, and after three such weeks a trusting NPC boss gives room (arrears halved, share eased 2 points, a minor fact). A man short with steady visible income is still punished exactly as before. A trusting boss waits five short weeks instead of three. The 15% friction haircut is gone (friction now only adds pressure to the man's own decision to skim). A player who audits sees only sources he could see, and is told when takings are down — evidence, not the answer.

Information discipline: `tone` and `protection.why` are never printed. The player learns the difference only from `evidence()` — what a visitor sees (empty shop, wrecked, money in the till, just done up, trouble in the street) — and from what the owner chooses to say: a man who is truly short says so; one who is sitting on the money may claim he is short (tested: the same owner gives both answers across runs while the evidence line says "He is not short").

### 2.3 Persistent ownership (`econ.ts`, `types.ts`)
`Business` now has `managerId`, `stakes[]`, `owners[]` (history), `invest`, `acct`. `transferBusiness()` changes the real `ownerId` and cache, keeps the history, books and the protection obligation, drops a stake the new owner held, and drops protection if the new owner is the collector. Wired to: owner death (the manager inherits; otherwise it closes as before), and debt default (`seizeShare`: the lender takes a 15% interest in the debtor's business, which pays the debt down). Owners who are jailed 14+ days get a manager; occasionally a comfortable owner steps back (capped at ¼ of businesses). The player's "back a struggling business" stake moved from a list on the player onto the business and is paid through the same weekly run (previously a separate payout).

### 2.4 Performance (`perf()`)
One multiplier on revenue, each part centred on 1 so the economy's level does not move: who runs it (brains/caution/vice; halved if jailed), neighbourhood demand, competition (relative to rivals when first measured), investment (owners with ambition reinvest; decays), trouble in the district (read from the shared facts), and an open dispute over the shop. The mean multiplier across businesses is asserted to be within ±4% of 1. `b.expense` is still fixed — I did not add dynamic costs (limitation).

### 2.5 Rate talks
`askRate()`: score from the boss's trust and greed, the man's record, a visible slump, a family levy and the boss's own cash; agree (−3 points), meet (−1.5), or refuse (costs trust). The player gets "Ask for a smaller share" with his boss (4-week cooldown). NPCs raise it with NPC bosses now and then (≈1.2%/man-week for steady payers). Floor is 10 points below the rank's base rate.

## 3. Save compatibility
`SCHEMA` 3 → 4. Migration, tested on a hand-built V72 save: the player's old `path.stakes` move onto the businesses (share, date kept) and the field is deleted; `protection.late` (weeks) becomes `owed` (fee × weeks, cap 8×) with `why: unable`; `txns`/`acct`/`rivals0` appear lazily. A loaded save re-saves byte-identically and continues byte-identically (tested at 60+30 days, seeds 5 and 7; and 120+30 with the regression suite's own player name).

## 4. Other defects fixed on the way
* Import-cycle crash: top-level `void <imported binding>` in `politics.ts`, `life.ts`, `encounters.ts` threw `Cannot access 'money' before initialization` in the stress harness after the new import edge. Removed. (Same class as V72's `rank.ts` bug.)
* `disputes.ts`: a settled agreement could be marked "violated" while one of its two men was dead (stress seed 3, found by the audit). Fixed by requiring both to be alive.

## 5. Test results (actual)
| Check | Result |
|---|---|
| `tsc --noEmit` | clean |
| `v73.test.ts fast` | **34 / 34 pass** |
| `v73.test.ts compat` (V72 save → V73) | pass |
| `v73.test.ts stable:{1,2,3}` (180 days each) | record mismatches **0**, audit issues **0** in all three |
| `v73.test.ts roundtrip:5` (60 + 30 days) | byte-identical |
| `test.ts` (8 seeds × 180 d, determinism, save round trip) | all passed (re-run after final edits: see end of file) |
| `v72.test.ts fast`, `storage.test.ts` | pass (one assertion updated from `schema == 3` to `SCHEMA`) |
| `stress.ts` seeds 3, 4, 5 × 180 d (a bot plays the player) | audit violations 0, 0, 0 |
| UI (Playwright, built bundle) | business screen renders, no page errors |

What the 34 cover: the type-level guard and a source scan for direct cash edits; chaining over 28 days and detection of a hand edit; a struck week equals its transactions; weeks close where the next opens; one revenue entry per business per week; unable→owed→repaid; collector credited exactly; delayed + evidence; slump evidence; shake takes once and clears arrears; collector change keeps/drops arrears; **honest downturn never accused (3 seeds)**; collapsed trade not punished; steady-income shortfall *is* punished; deliberate underreporting recorded and noticed; delayed payments carried and not punished; tribute conservation across a whole `settleWeek` (cash before = after); player never auto-charged; rate talk determinism, floor and record sensitivity; transfers (record, owner mapping, accounts untouched, draws go to the new owner, collector-as-owner); inheritance vs closing; manager on jailing; debt share pays the debt down; the player's stake is paid exactly once; operator quality; competition; performance mean ≈ 1; determinism; merge-after-load.

### Before / after
Honest bad patch (24 seeds; a soldier with a violent boss, income down 70% for 10 weeks, 4 of them with no cash). Same scenario run against the V72 source tree and V73:

| | V72 | V73 |
|---|---|---|
| men punished (beaten / shop taken / debt doubled) | **24 / 24** | **0 / 24** |
| same scenario but income stays steady and cash is gone | 24 / 24 | 24 / 24 (unchanged, intended) |

Economy level, 180 days, seeds 1/2/3 (before → after): business cash at d180 38,634→41,533, 49,145→49,057, 42,505→42,394; character cash 1.36M→1.39M, 1.29M→1.21M, 1.32M→1.32M; businesses closed 0→0 in all. Late-envelope facts rose (28→54, 19→39, 32→78) because every missed week is now a missed week rather than a random event; men behind at d180: 1/2/2 → 0/1/3.

Tribute weeks by cause over 180 days (688 / 638 / 704 man-weeks): underreported 44 / 75 / 62; unable 1 / 1 / 5; withheld 0 / 1 / 0; delayed 0 / 1 / 0; jailed 5 / 6 / 3. "Honest inability" is genuinely rare in the organic world; I tested it by construction, not by waiting for it.

Storage: economy record at day 180 = txns 42 KB + accounts 35 KB (bounded: both stop growing after eight weeks) ≈ 77 KB plus ~10 KB of `tone` fields. Whole save, seed 1: 1,521 KB at d180 (V72 measured 1,336 KB for the same seed; the worlds diverge after the first changed random draw, so the difference is not purely economy). Growth after day 60 is 3–4 KB/day, as in V72.

## 6. A defect my own tests caught
The same-day merge cache was held in memory only, so a save loaded mid-day started a new entry where a continuous run merged into the old one. One character of drift in a 1.4 MB save; `test.ts`'s round-trip assertion failed. The cache is now rebuilt from the record on first use after load, and a test pins it.

## 7. Known limitations (honest)
* The transaction record covers **business** money. Personal income (jobs, rackets, hustles) is still per-man `books.gross`; the player-circle `ledger` is unchanged and still limited to the circle. They do not conflict (tribute is derived from `gross`; protection reaches `gross` only through `earn()` in the one payment path) but I did not unify them into one store.
* The world is not a closed economy: wages and living costs are faucets and sinks that pre-date this phase, and character cash grows ~3× in 180 days. I verified conservation of *transfers* (tribute, shakes, aid, debts, shares), not of the total.
* Ownership changes are rare in an unattended world (0 organic transfers in 180 days × 3 seeds; owners seldom die and few defaults own businesses). The mechanism is tested directly, but NPCs do not yet buy, sell or give up businesses; that needs V74's agency.
* `Venture` (chop shop in someone's back bay) is still its own record, not a stake.
* Operating cost is fixed per business; only revenue responds to management, competition, investment and trouble.
* "Downturn" labels ~16–20% of paid weeks (weaker than the last two months). It is a label, not a verdict.
* Not verified: the new dialogue option and the shop conversation were exercised by calling the dialogue engine directly and by loading the UI, not by clicking through them.

## 8. Behavioural changes the player can notice
* Late shops now owe a real amount (shown on the shop and in "Shops behind"); paying it clears it; "Give him time" keeps the debt but stops the nagging.
* Asking an owner why he is late can get a lie; the shop visit tells you what you can see.
* A bad month no longer gets your men beaten when their takings visibly collapsed.
* "Ask for a smaller share" with your boss; "Discuss earnings" now appears for him.
* Business screen shows who runs it, who else has a share, who owned it before, and what people say.
