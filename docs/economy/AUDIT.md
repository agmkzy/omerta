# The economy: audit before the expansion (27 October 2026)

Phase 0 of the Economic World Expansion brief. The guiding rule, from the owner: *the businesses create circumstances; the people create
gameplay.* Nothing here is a plan to add knobs; it is what exists, and what to deepen.

## What exists

**Criminal enterprises: one record for everyone (`w.ops`, `rackets.ts`).** Since Stage 4, the player's operations and NPCs' hustles
are the same `Op` records under the same weekly pass (`enterpriseWeek`): 14 kinds (`OPS`), each with a cost, a base take, a skill, a
risk and heat, a rank requirement and sometimes districts. Per op: owner, runner (operator) and his cut, district, level (grown),
run of bad weeks, cause of the last week, capital tied up, a lull, the precinct's pad, skimmed money, a tip-off date.
- Weekly take = base × the doer's aptitude × level × luck × crowding (other ops of the kind in the district) × the family directive,
  less outside the family's ground. Bad weeks (12%), bookmaking's losing weeks (18%), raids (risk + heat, scaled by caution,
  directive and the pad) that fine the owner and may jail the doer.
- The runner skims if tempted (problem, schemer/bitter) and not loyal; the player is tipped off by a man who knows, past $150 skimmed
  (Stage 5D), and can count the books and rule (`countOp`, `opRule`: make him repay, warn, take it off him).
- NPC owners start enterprises themselves (`startEnterprises`, weighted by what suits them), grow them (`npcTend`, asking the player
  to invest when he is their superior), and close them after three bad weeks.
- Street loans are real loans (`shylockWeek`, through `asks.lend`); a heavy loser on a book or a numbers bank runs up a real marker
  (`marker`, a debt).
- A rival family's capo may squeeze a player's op when tension is high (an encounter).
- **The book, run (`book.ts`, Phase 1.4):** for the player's bookmaking only: the big bet, a winner the drawer can't cover, a rival
  book on his ground, the precinct's envelope. Chosen by a weekly roll (22% / 10% / 8%), one at a time.
- **Hijacking** is an op of its own kind (`hijack`), resolved two days later; and **the truck score** (`score.ts`) is played.
- Running another man's op for a cut is an ask (`asks.run`); the owner weighs trust, aptitude, his current runner and the cut.

**Stolen cars and goods: counters, and a second chop shop.** A man's `cars` and `goods` are bare numbers. Cars come from boosting
(a job with three approaches, `jobs.ts`), goods from burglary; they are sold to a garage at a flat $550 a car or pawned at 40%, or
cars go to a **venture** (`w.ventures`, `deeds.chop_start`): a chop shop in a garage, partner or strong-armed host, two cars a week
at $1,000, raided at random. The `chop` op kind (a car-stealing outfit) is a different, abstract thing. Crew who come back from jobs
with cars or goods hand them over at the same flat prices (`orders.ts`).

**Legitimate businesses: the richest part (`econ.ts`).** 28 kinds (restaurants, bars, a garage, a candy store, a pawnshop…), each
with an owner, an optional manager (`setManager`), other people's stakes (`Stake`: share, since, how), an ownership history
(`owners`), cash moved only through `bizMove` (every movement a transaction), weekly accounts struck (`acct`), investment, distress,
damage, protection with arrears and a true reason for late payment, and performance from management quality, demand, rivals,
investment and district trouble (`perf`). Buying, selling, a piece of a place, stakes paid weekly, transfer, succession on the owner's
death, seizure of a share for an unpaid debt, are all built (`asks.buy/sell`, `sellTo`, `addStake`, `transferBusiness`,
`succeedOwner`, `seizeShare`). Its income reaches the owner's books as `business`.

**Money and the hierarchy (`books.ts`, `ledger.ts`).** Every dollar earned is recorded by source; each week a man declares and kicks
up a share; his superior sees some sources better than others (`VIS`: protection 1, numbers 0.5, stolen cars 0.15…), and may warn,
demand, punish. Living costs by rank. The captain asking for a bigger share exists as an ask (`asks.rate`) and a weekly skim check.

**Work.** Jobs come through people (`bossOffer`, `tipFrom`, `oppFrom`), gigs (muscle, shipment, escort, courier, inspector), errands
for the crew (`orders.ts`, with each man's behaviour, honesty and report), schemes the player starts himself (boost, burgle, scam),
the score. Muscle is a played moment; the others resolve by approach.

**Integration already there.** Facts and knowledge (an op's raid, a marker, a skim tip-off are facts others know); relationships
(feel/bear); the family directive; heat; places (`city.ts`, Little Italy built properly, the other six as maps); conversation acts for
business (`conv/acts/business.ts`); saves at SCHEMA 7 with migrations in `world.ts`/`engine.ts`.

## 1. Preserve
- The single enterprise record and weekly pass; NPCs starting, growing and closing enterprises by the same rules as the player.
- The runner's skim, the tip-off, the count and the ruling.
- Street loans as real debts; markers as real debts.
- The book's four decisions (as situations), the precinct's pad.
- Everything in `econ.ts`: managers, stakes, ownership history, accounts, buying/selling, succession, seizure.
- The books: sources, visibility, declared vs real, kick-ups, the rate ask.

## 2. Improve
- **Rackets are a number with a runner.** Numbers, fencing, the book and the chop shop have no people around them besides the
  runner: no runners for the numbers, no spots, no buyers, no thieves, no regulars. Rivals are a crowding factor, not men.
- **The book's decisions come from a weekly dice roll**, not from the gamblers (brief: "from simulated activity").
- **Captains' interest** in a growing racket is the generic weekly kick-up; nothing reacts to an enterprise doing well.
- **Ownership of an op** has no history, no partners, and never changes hands except by closing (death closes it).
- **The Business screen** lists rackets as cards with numbers; no people, no history, no sense of a place.
- **Legitimate places** have managers and stakes but no staff or regulars, and nothing ties a restaurant to its use as a meeting place.

## 3. Introduce
- Named people around each of the four pilot rackets (runners, spots, buyers, thieves, regulars), drawn from the existing characters.
- Cars as identifiable assets (make, model, year ≤ 1970, condition, value, whose it was, who stole it, where it went).
- Specific lots of goods only when their identity matters (a robbery's goods, a buyer's want, goods that are evidence).
- Rival operations as identifiable men's ops competing for the same spots, runners and buyers.
- Op ownership history, partners (stakes) and transfers (sale, reassignment, death, prison, seizure).
- Circumstance-driven developments (no weekly prompts): from the people and the numbers, with cooldowns, surfaced as facts,
  encounters, asks and matters the rest of the game already reads.
- Legitimate versus criminal money: what a man can show against what he spends; consequence kept light this phase.

## 4. Consolidate
- **Ventures (`w.ventures`) and the `chop` op are two chop shops.** Fold the venture into the op: a chop shop is an op housed in a
  garage (`Op.base`), with the host's share as a stake. Open ventures in old saves migrate to ops on load; the type stays readable.
- **`cars` / `goods` counters and the flat $550 / 40%** become the way loose stolen property is held; when it reaches an operation it
  becomes the operation's (cars become records).

## 5. Risks
- **Save size** (a known problem around day 60): car records and people links must be bounded and pruned.
- **Determinism**: every new draw through `w.rng`, in a fixed order; no iteration over unordered maps without sorting.
- **The ledger**: money moves through `earn`/`post`/`bizMove` so `audit()` stays true.
- **Balance**: the pilot changes where racket money comes from, not how much; measure against the current climber runs.
- **Noise**: developments must stay rare and caused; a quiet, profitable racket for months is a valid outcome.
