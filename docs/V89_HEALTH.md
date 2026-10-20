# V89 world health: 180 days with nobody playing

## In plain English

We let the game run by itself for six months of game time, three times over (three different starting worlds: seeds 3, 7 and 11),
with the player doing nothing at all. We did the same with the live V88 game, then compared the two. Every 30 days we checked who
was alive, jailed, promoted or killed; where the money was; who protected which shops; how much violence there was; how the
new V89 "matters" and negotiations were going; and how big and slow the save was getting.

**The good news.** Nothing breaks. The books balance at every check: no money appears or disappears without a record, and the
consistency audit is clean in every run. The families do not wipe each other out. Deaths, murders and arrests stay rare and
steady, with no snowball. NPCs keep forming and finishing their own plans at the same rate as in V88. The V89 matters (rivalries,
revenge, arrests, ambition) keep starting and ending in different ways for the whole six months. The old V88 loop where refused
shops got smashed again and again is gone: vandalism fell from 120 to about 20–50 incidents per six months.

**The problems we found in V89, and what was done:**

1. **Negotiations jammed.** The city can have at most 45 negotiations open at once. In V89 that limit was full from about day 20
   until the end. About 80% of negotiations ended with nobody agreeing anything. The cause was NPC loan sharks offering loans
   that shopkeepers almost always refused. Worse, a shopkeeper who already paid for protection called in his protector over a
   loan offer, and the protector then warned the lender off. Those warnings took up the slots, so new business, including
   protection, couldn't start. As a side effect, half as many loans were being made as in V88.
   **Fixed by tuning:** the limit now has room (about 15–20 open), about 40% of negotiations end in agreement, and loans are back
   to V88 levels.
2. **Three times the beatings of V88** (about 30 a month against 10–12). The biggest cause: every time a shopkeeper said "no"
   inside one protection negotiation, the collector's grudge went up again. Three no's and he went back and beat the
   shopkeeper. Warnings between men of different families also often ended in someone being "roughed up".
   **Partly fixed by tuning:** about 18 a month now, flat over the six months. That is still about 1.6 times V88. The rest is
   ordinary grudge-driven revenge between families, decided in files I was not allowed to change.
3. **Bad blood between the families only ever goes up.** This was already true in V88, but V89 made it rise five times as fast.
   The game's own thresholds treat 3 as "trouble" and 9 as "hits are fair game", and by day 180 the average pair of families
   stood at 49. **Halved by tuning (to about 20)**, but it still only rises. It needs a slow cooling-off, which is outside the
   files I could touch.
4. **Saves are bigger and the game is a little slower.** By day 180 V89 saves were 2.6 MB against 2.0 MB for V88; after
   tuning they are 2.3 MB. Every move in a negotiation is written down as a piece of news, about 2,300 extra a run. Half of all
   stored relationships are between men who have not met for two months and feel nothing about each other. One simulated day
   takes about 25% longer than in V88 (about 175 ms against 140 ms by day 180 on this machine).

**Problems that are not new in V89 (V88 has them too):**

5. **Money keeps growing.** The total money in the city roughly triples in six months. Wages, day jobs and rackets bring money
   in, and almost nothing takes it out. It isn't piling up in a few hands: the richest 5% hold a falling share. But a $1,500
   start and $40 drinks will feel smaller and smaller as the game goes on.
6. **A player who does nothing sinks quickly.** Standing falls from 40 to about 0 by day 60–90, the boss's trust from 0.5 to
   about 0.1 within the first month or two, and the player's cash drains to around $0–250 by day 180. That a do-nothing player
   loses ground is right. How fast he loses the boss in the first month may be harsher than you want.
7. **The underworld is very safe.** Over six months: 0–3 deaths, 1 informant who is never found out, about 13 promotions. Every
   shop is protected by day 30, so after that the only protection drama is one family poaching from another.

---

## How it was measured

`playtest/health.ts` runs the real simulation with no player input (`advance(w, w.now + DAY)` once a day) and samples every 30
days. It changes nothing except the passage of time; wall-clock time is read only in the harness, for speed.

```
npx tsx playtest/health.ts                         # seeds 3 7 11, 180 days, this checkout
npx tsx playtest/health.ts 3 19 --days 90          # other seeds / length
HEALTH_SRC=<other checkout>/src LABEL=v88 npx tsx playtest/health.ts    # compare another version
HEALTH_JSON=out.json ...                           # also write every sample as JSON
```

Each sample shows: population by family and rank, jailed and informants, deaths (by cause) and promotions in the window; total
money (`moneyTotal`), cash held by men, shops and family treasuries, the top-5% share of cash, debts, and shops open, distressed
and protected by family, with gains, losses and poaching; facts recorded by kind (beatings, vandalism, murders, arrests,
refusals, rumours...); tension between every pair of families; the `w.sitpace.stats` counters (`start.*`, `out.*`, rivalry and
revenge moves) and open matters by kind against their caps; negotiations opened and ended by kind and outcome; NPC goals
(active, started, done, failed, dropped); the player's cash, standing, heat and boss trust and respect; the number of Herald
issues and items; ms per simulated day; save size; and the `audit()`/`ledgerCheck()` results.

V88 was measured from a temporary worktree of branch `v88-fixes` (removed afterwards); the same harness works unchanged on it.

Notes on the numbers:
- "Money in the world" is not supposed to be constant. Wages, revenue and racket income enter from outside the city's books.
  The checks that matter are `audit()` and `ledgerCheck()`, and both were clean at every sample of every run.
- The ms-per-day figures in the tables were taken while other test runs shared the machine, so they are noisy. A clean
  back-to-back run of seed 3 gave V88 110 → 140 ms/day and tuned V89 113 → 176 ms/day from day 30 to day 180.
- A "fact" is anything recorded as having happened. "Rumour" facts are mostly the small steps of negotiations (he leaned on
  him, he offered less, he went to his protector).

## Tables (averages of seeds 3, 7, 11)

"v89" is branch v89 as it was; "v89-tuned" is with the changes below.


**Day 30** (average of seeds 3, 7, 11)

| | v88 | v89 | v89-tuned |
|---|---:|---:|---:|
| Men in the families (alive, excl. player) | 85 | 85 | 85 |
| Dead (cumulative) | 0 | 0 | 0 |
| In jail now | 1 | 1 | 1 |
| Informants | 0 | 0 | 0 |
| Money in the world ($k) | 495 | 543 | 519 |
|   held by men ($k) | 463 | 510 | 486 |
|   family treasuries ($k) | 6 | 8 | 6 |
| Top 5% share of cash (%) | 25.9 | 24.6 | 24.9 |
| Active debts | 54 | 27 | 53 |
| Shops open | 46 | 45 | 45 |
| Shops protected | 44 | 42 | 44 |
| Family tension, highest pair | 8 | 18.9 | 12.1 |
| Family tension, average pair | 1.7 | 9.6 | 4.4 |
| Open negotiations (cap 45) | 0 | 45 | 21 |
| Other open matters | 6 | 11 | 14 |
| NPC goals active | 89 | 86 | 92 |
| Player boss trust | 0.2 | 0.28 | 0.18 |
| Player standing | 25.3 | 34.3 | 29.3 |
| Player cash ($) | 1,300 | 1,287 | 1,247 |
| ms per simulated day (last 30 days) | 162 | 172 | 506 |
| Save size (KB) | 1,163 | 1,386 | 1,327 |

**Day 90** (average of seeds 3, 7, 11)

| | v88 | v89 | v89-tuned |
|---|---:|---:|---:|
| Men in the families (alive, excl. player) | 88 | 87 | 89 |
| Dead (cumulative) | 0 | 1 | 0 |
| In jail now | 0 | 1 | 0 |
| Informants | 1 | 1 | 1 |
| Money in the world ($k) | 919 | 1,032 | 958 |
|   held by men ($k) | 846 | 950 | 885 |
|   family treasuries ($k) | 28 | 33 | 29 |
| Top 5% share of cash (%) | 21.2 | 20.2 | 20.5 |
| Active debts | 57 | 33 | 61 |
| Shops open | 46 | 46 | 46 |
| Shops protected | 46 | 44 | 46 |
| Family tension, highest pair | 17.7 | 36.7 | 25 |
| Family tension, average pair | 4.8 | 25.4 | 10.8 |
| Open negotiations (cap 45) | 0 | 45 | 20 |
| Other open matters | 10 | 24 | 21 |
| NPC goals active | 93 | 101 | 88 |
| Player boss trust | 0.05 | 0.1 | 0.05 |
| Player standing | 2.7 | 12.2 | 0.3 |
| Player cash ($) | 763 | 703 | 787 |
| ms per simulated day (last 30 days) | 193 | 262 | 470 |
| Save size (KB) | 1,641 | 2,097 | 1,840 |

**Day 180** (average of seeds 3, 7, 11)

| | v88 | v89 | v89-tuned |
|---|---:|---:|---:|
| Men in the families (alive, excl. player) | 89 | 86 | 88 |
| Dead (cumulative) | 0 | 3 | 1 |
| In jail now | 2 | 3 | 1 |
| Informants | 1 | 1 | 1 |
| Money in the world ($k) | 1,342 | 1,571 | 1,426 |
|   held by men ($k) | 1,231 | 1,444 | 1,308 |
|   family treasuries ($k) | 72 | 80 | 74 |
| Top 5% share of cash (%) | 20.7 | 18 | 18.2 |
| Active debts | 60 | 32 | 62 |
| Shops open | 48 | 48 | 46 |
| Shops protected | 48 | 45 | 46 |
| Family tension, highest pair | 33.2 | 67.3 | 46.4 |
| Family tension, average pair | 9.1 | 48.7 | 20 |
| Open negotiations (cap 45) | 0 | 45 | 14 |
| Other open matters | 15 | 31 | 29 |
| NPC goals active | 100 | 96 | 98 |
| Player boss trust | 0.07 | 0.08 | 0.1 |
| Player standing | 0.3 | 0 | 0 |
| Player cash ($) | 260 | 7 | 173 |
| ms per simulated day (last 30 days) | 246 | 327 | 765 |
| Save size (KB) | 2,022 | 2,623 | 2,307 |

**Totals over 180 days** (average per seed)

| | v88 | v89 | v89-tuned |
|---|---:|---:|---:|
| Deaths | 0 | 3 | 1 |
| Promotions | 10 | 14 | 13 |
| Murders | 0 | 3 | 1 |
| Beatings | 61 | 178 | 112 |
| Vandalism | 120 | 22 | 52 |
| Robberies | 8 | 8 | 10 |
| Arrests | 17 | 20 | 19 |
| Shops poached | 65 | 22 | 20 |
| Protection refusals (facts) | 374 | 169 | 229 |
| Protection agreed (new) | 19 | 18 | 18 |
| Negotiations opened | 0 | 971 | 696 |
|   ended agreed / gave in | 0 | 99 | 265 |
|   ended dropped / moot / faded | 0 | 756 | 261 |
| Rivalries started | 0 | 43 | 42 |
| Revenge matters started | 0 | 27 | 23 |
| Arrest matters started | 0 | 20 | 19 |
| Climbs started | 0 | 11 | 11 |
| NPC goals done / failed / dropped | 133 | 126 | 133 |
|   of which done | 56 | 43 | 56 |
| Facts recorded (all kinds) | 4,843 | 6,843 | 6,588 |
|   "rumour" facts | 23 | 2,611 | 2,295 |
|   gambling losses | 3,183 | 3,099 | 3,039 |

**Beatings per 30 days** (average of seeds)

| window | v88 | v89 | v89-tuned |
|---|---:|---:|---:|
| day 0-30 | 1 | 31 | 16 |
| day 30-60 | 11 | 33 | 18 |
| day 60-90 | 11 | 27 | 18 |
| day 90-120 | 12 | 29 | 17 |
| day 120-150 | 14 | 30 | 21 |
| day 150-180 | 12 | 27 | 21 |

## Problems, ranked by severity

| # | Severity | Problem | Evidence (180 days, average of 3 seeds) | Status |
|---|---|---|---|---|
| 1 | High (V89) | Negotiation cap permanently full | 45/45 open at every sample from day 30 to 180; 971 opened, 99 agreed, 756 dropped or moot. Open asks at day 60 (seed 3): 22 `lend`, 20 `warn`, 1 `protect` | **Fixed** (tuned: 14–21 open, 696 opened, 265 agreed) |
| 2 | High (V89) | Loans collapsed | Active debts 27–33 against V88's 54–60. `ASKS.lend.lean` ended in −0.3, so after the stance terms almost every offer was refused unless the shop was failing | **Fixed** (53–62 active) |
| 3 | High (V89) | Beatings three times V88 | 178 beatings against 61; about 30 every month, from the first month. Seed 3, days 0–90: 46–56 mobster-on-shopkeeper beatings (V88: 16), nearly all against owners who had refused protection; 32 "roughed up to make the point" from warnings | **Mostly fixed** (112, about 18 a month, flat). Rest: see "Needs fixing elsewhere" 2 |
| 4 | High (both, worse in V89) | Family tension never falls | Average pair at day 180: V88 9, V89 49, tuned 20; highest pair 33 / 67 / 46. The only decrease anywhere is the Commission halving one pair. Thresholds read elsewhere: ≥3 (meetings), ≥9 (`politics.ts` sanction) | **Slowed** by tuning; needs decay elsewhere |
| 5 | Medium (V89) | Save size and speed | Save at day 180: V88 2,022 KB, V89 2,623 KB, tuned 2,307 KB. Growth days 90–180: V88 4.2 KB/day, tuned 5.2 KB/day. 2,300–2,600 "rumour" facts a run against 23 in V88. Seed 3, day 120: 3,080 of 6,194 stored relationships are between men who have not met for 60+ days and hold no grudge. Speed: 140 → 176 ms/day at day 180 (+25%) | Improved by tuning; rest elsewhere |
| 6 | Medium (both) | Money inflation | Total money 3x in 180 days in both versions (V88 $0.5M → $1.34M; tuned V89 $0.52M → $1.43M). Seed 3 over 60 days: civilians +$237k, hustling soldiers +$159k, capos +$69k. Weekly hustle net about $36k and wages about $28k come in from outside; almost nothing goes out. Top-5% share *falls* (26% → 18–21%), so this is inflation, not concentration | Not tuned (outside allowed files) |
| 7 | Medium (both) | Idle player sinks fast | Boss trust at day 30: 0.18–0.28 (starts at 0.5); standing 25–34 at day 30, about 0 by day 90; cash about $1,250 at day 30, $7–260 by day 180. Same in V88 | Not tuned; design question |
| 8 | Low (both) | World very safe, no turnover | Deaths 0–3, murders 0–3, informants 1 (never exposed), promotions 10–14 per 180 days. 44–46 of 45–48 shops protected from day 30 on | Report only |
| 9 | Low (V89) | "Gave in" loans | After the lend fix, about half the agreed loans are "gave in" (accepted out of fear: the lender frightens him more than he likes him), and each leaves the borrower with a +0.12 grudge | Watch; could tune `finish()`'s coerced test |

Things that are healthy: `audit()` and `ledgerCheck()` came back clean at every sample of all nine runs. Population is stable
(85–89 family men). There is no violence snowball: beatings per 30 days are flat in every version. The NPC goal turnover
(about 130 goals ended per run, 56 of them done in V88 and tuned V89) is unchanged. All four V89 matter kinds start and end
throughout (rivalries 42, revenge 23, arrests 19, climbs 11 per run, with endings including ruled on, made peace, kept apart,
came to blows, avenged, let go, rose). Vandalism is down from V88's 120 to 52 and poaching from 65 to 20.

## What was tuned (all in `src/asks.ts`)

| Change | Before → after | Why |
|---|---|---|
| `answer()`: a shop owner who "already pays someone" sends for his protector **only when he is being asked for protection** (`backed` now requires `s.ak === 'protect'`) | any ask touching a protected shop → protection asks only | A loan offer brought in the protector, who opened a warning against the lender: the main source of the jam |
| `ASKS.lend.lean` constant | −0.3 → +0.4 | V88 accepted roughly half of NPC loan offers; V89 accepted almost none |
| `ASKS.warn.lean` constant | +0.05 → +0.4 | Almost every warning was refused, and refusals led to beatings |
| Tension from a cross-family warning (`seekHelp`) | 1 → 0.5 | Tension growth |
| Tension from a cross-family "roughed up" (`ASKS.warn.force`) | 2 → 1 | Tension growth |
| `ASKS.protect.onNo`: only the **first** refusal in a negotiation is a `protection_refused` fact; later ones are told as the same story going on (`rumour`, minor) | every no → `protection_refused` | Each such fact adds +0.2 to the collector's grudge (`core.ts` GRUDGE table), so three no's made him beat the shopkeeper. This matches the comment already there ("the first one is news") |

Two of these (the `backed` condition and the fact kind in `onNo`) change a condition rather than a number. Both are one line,
inside the answer/refusal code of `asks.ts`, and both follow what the surrounding comments say was intended. Revert them if
you want constants only; on their own, the constant changes do not clear the jam or the shopkeeper beatings.

No save-format change: no new fields, nothing removed, no schema bump. One test was made robust to world drift:
`v89.test.ts` "what you already know opens a man up" now picks a protection matter the player hasn't already heard of. Its
premise is "a wary man with nothing to go on says nothing", and after tuning, the first matter it found at day 10 was one the
player had heard about.

Verified: `npm run typecheck`; `v89` (23/23), `v75`, `v74`, `v76` all pass (fast).

## Needs fixing elsewhere (files outside this task)

1. **Tension decay** (`actions.ts tension()`, `orgs.ts`/`politics.ts` weekly): nothing ever lowers tension except the
   Commission. Suggest a weekly decay (for example ×0.9, or −1 a week to a floor of 0), or a cap near the highest threshold
   anything reads (about 10–15). Without it, every pair of families is past the "hits are fair game" line (≥9) within weeks.
2. **Retaliation threshold** (`actions.ts` `case 'retaliate'`, grudge ≥ 0.45): cross-family revenge beatings are still about
   twice V88 (29 against 15 in 90 days, seed 3). V89 has more ways to build grudges (refusals, coerced deals, wrong names in
   rumours, help refused). Raising the threshold to about 0.5, or a longer `ret:beat` cooldown, would bring it back.
   (Rumours with wrong names had no measurable effect on beatings: zeroing their grudge left seed 3 unchanged.)
3. **NPC negotiators use moves their kind doesn't allow** (`asks.ts npcMove`, outside the lean/answer constants I was given):
   `K.moves` restricts only the player, so an NPC offering a *loan* will "lean on" the shopkeeper. Filtering `npcMove`'s
   options by `K.moves` would remove the remaining fear-driven loan refusals and "gave in" loans.
4. **Negotiation steps as facts** (`situ.ts tell()`, defaults to kind `rumour`): every lean, offer and counter-offer is a fact
   that people learn. That is 2,300 facts per run (V88: 23), and every copy of one in someone's `known` adds to the save. Most
   of these could be history entries on the matter (`s.hist`) rather than facts, or be learned only by the two parties.
5. **Stale relationships** (`core.ts` / `retain.ts sweep`): half of all stored relationships are untouched neutral pairs.
   Dropping ones that sit at the defaults (no grudge, not met for 60+ days) in the weekly sweep would cut about a fifth of
   the save. `peek()` already reads a missing pair as the defaults.
6. **Money sinks** (`econ.ts`, `hustle.ts`, wages): money triples in 180 days in V88 and V89 alike. Candidates: living costs
   for NPCs that scale with cash, bigger family/organisation spending, losses on rackets. A balance decision for the owner.
7. **Idle-player decay** (`books.ts` short weeks −2 standing, `encounters.ts` ignored requests): the boss's trust halves in the
   first month for a player who simply doesn't turn up. Fine if intended; worth a look for the first week or two of a new game.
8. **Informants are never exposed** in 180 days (1 informant per run, `exposed` never set). The `politics.ts`/`matters.ts`
   exposure path may need a nudge if informants are meant to be found out.
