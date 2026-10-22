# Foundation work: progress log

One entry per step of the world-foundation work (order and reasons in [SIMULATION_ASSESSMENT.md](SIMULATION_ASSESSMENT.md) and [BASELINE.md](BASELINE.md)).

Every step is measured the same way. The same four worlds (seeds 3, 7, 11, 19) run for two years through `src/tests/tools/longrun.ts`, the player idle, and are compared with the unchanged game measured by the same harness. The original baseline reports are in [baseline/](baseline); the same unchanged game rerun with the harness's newer measures is in [baseline/rerun/](baseline/rerun), and that is what the "Before" columns below use.

---

## Step 1: events carry their consequences, for reputation and grudges

*October 2026, uncommitted.*

### What changed

- **One door for grudges, with the reason kept.**
  - Every change to what one man holds against another now goes through `core.bear` / `bearAtLeast` / `ease`. That includes 187 places in 33 modules that changed grudges directly.
  - The relationship keeps **why**: the event behind the grudge when there is one, or a plain reason where nothing was recorded as an event ("Louie Costa would not put his name forward").
  - The reason kept is the one that did most to raise the grudge recently. A slight doesn't overwrite a beating, and the reason goes when the grudge does.
  - Amounts at every site are unchanged: the grudge balance is exactly as before. Only the reason is new.
- **One door for reputation, the same for everyone.** Every change to anyone's standing now goes through `core.repute`. That covers 110 places, nearly all of which previously rewarded or punished only the player.
- **Deeds earn reputation where they're recorded.** A table (`core.DEED`) says what each kind of act does to the name of the man who did it and of the man it was done to. It applies once, when the event is recorded, to NPCs and the player alike. Examples:
  - bringing a shop under protection;
  - taking a beating;
  - a shopkeeper refusing you;
  - a light envelope;
  - a default;
  - being found out as an informant.

  A hidden hand earns nothing until it's revealed, and then it does.
- **Rising in rank is reputed in the rank door** (`rank.ts applyRank`): +6 up, −6 down, +2 for being taken into the life. It used to apply only to NPC promotions through one route.
- **Respect follows deeds both ways.** A man who hears of a deed thinks a little more or less of the men in it. Before, respect between NPCs could only grow.
- **Revenge names its cause.** When a man hits back over a grudge, the beating, burning or killing records the event his grudge is about as its cause. This is what creates chains.

### What was deleted

- **Five double counts,** where an event now earns or costs reputation and the old code also did it by hand:
  - protection gained through a family handout;
  - being disciplined (the old −6 was a penalty only the player paid);
  - killing your own boss (again a penalty only the player paid);
  - losing a shop you held yourself;
  - the separate +6 for an NPC's promotion.
- **Player-only conditions on things NPCs do too:** four honest weeks running now earn reputation for anyone, and repeated short weeks cost it for anyone.
- **A dead line** in blackjack that clamped reputation without changing it.

### Guarding it

- **An architecture test:** no source line outside `core.ts` (and world creation) may set a grudge or a standing directly.
- **The full suite passes:** 288 tests, 13 opt-in long runs skipped.
- **A regression test re-labelled:** it builds a 60-day world but was labelled a quick unit test, so it timed out under load. It is now labelled a scenario test.

### Results: two years, four worlds

| Measure | Before | After |
|---|---|---|
| Grudges that carry a recorded reason | 0% | 99–100% |
| …that name the event behind them | 0% | 85–90% |
| Chains of cause two links deep | 0 | 108–190 per world |
| …three or more links | 0 | 61–104 per world |
| Lasting events with a recorded cause | 2–4% | 4–6% |
| Reputation spread among men in the life (sd) at 2 years | 6–8 | 12–17 |
| Lowest / highest reputation at 2 years | 11–28 / 55–62 | 0–9 / 69–74 |
| Men in the life with reputation ≥ 45 | 26–33 | 59–73 |
| Times a man's respect for another fell, per week (year 2) | 3–9 | 20–163 |
| Promotions in two years | 39–50 | 49–51 |
| Friends / enemies at the end | about the same | about the same |
| Consistency and ledger problems | 0 | 0 |
| Save size at 2 years | 4.9–5.0 MB | 5.1–5.7 MB |

**What it looks like in a life.** Before, the harness could only see that a grudge came after some event. Now the world says why:
- "turns against Sonny Cassano (because: Sonny Cassano beat up Dom Mancini)"
- "turns against Paulie Sorrento (because: Paulie Sorrento's people roughed up Sonny Cassano to make the point)"

Reputation now describes men:
- **At the bottom:**
  - Sonny Cassano, an associate refused by shopkeepers 174 times in a year;
  - Tommy Ferrara, with 12 light envelopes and 15 missed debt payments;
  - Ralphie Palumbo, with 3 defaults.
- **At the top:** the men who rose.

### What it revealed, for later steps

- **Bosses' reputation stays at about 40.** Bosses rarely act in person, so they earn nothing from deeds. A boss's name should rise and fall with his family's fortunes and his rulings. That belongs to the organisation's life cycle (step 2).
- **The protection-demand storm now costs men their names.** One refusal is −0.3, and some men are refused over a hundred times. That's an honest consequence of the storm, not a reason to soften the table. The storm itself is for the work-flow step.
- **More men now pass the reputation gate for promotion (45),** so promotions rose slightly. The organisation still inverts (capos to the ceiling, associates drained), as expected: that's step 2's job.
- **Save size grew 1–14%,** because grudges keep their reasons and the events they point to are kept as long as something cites them.

---

## Step 2: the organisation's life cycle

*October 2026, uncommitted, on top of step 1.*

How men enter, rise through and leave a family. Within the owner's constraints: formal demotion stays extremely rare, and nothing aims at a number of promotions. Change comes from recruitment, promotion, death, departure and succession, by rules.

### What changed

- **Seats follow the family's structure, not fixed numbers** (`career.capOf`).
  - **Captains:** one to about every five soldiers and associates, the shape the families start with.
  - **Soldiers:** about three to a captain.
  - **Underboss:** one.
  - **Extra seats:** at most one above the structure, which the boss may open for a strong record.
  - This replaces fixed seats plus up to three extras (more for the player's path). That's what let every family end with six captains and almost nobody under them.
- **Every way of opening an extra seat uses one door** (`career.openSeatFor`):
  - a strong record noticed;
  - a family at war;
  - the player asking his boss;
  - the player raising one of his own men;
  - the player, as boss, opening the books.

  When the family can't carry another seat, the answer is no.
- **Empty underboss chairs are filled.** The boss names the captain he trusts and rates most. Before, promotion never filled an underboss seat, so every one lost to death or succession stayed empty.
- **A new underboss's crew passes to another captain** for everyone. That was player-only before.
- **New blood comes from the street, for a reason, as the family needs and can feed it** (`people.newBlood`). This is when a family is short of men at the bottom: about four associates to every five made men.
  - **First,** a civilian with ambition who already knows one of its men, or who needs money, starts hanging around. The event is recorded ("…has started hanging around Marty Bellini's crew").
  - **Failing that,** a young relative of someone in its neighbourhoods comes of age ("…Teddy Costa's nephew, is old enough now…"). He's kin by name, as the game reads kin.
  - **Only while the family has work to feed another man:** a baseline of ten, plus two per district it holds, plus one per business it owns or protects. A family that wins shops takes on men; one that loses them stops.
  - Before, the only men ever willing to come in were the nine created with the world. They drifted away within a year.
- **Ambition and promotion are one story.**
  - A backed man waits for his seat as long as his temperament allows: months for a careful, even man, weeks for a hungry, hot one. It used to be a fixed five weeks.
  - The waiting doesn't count while a seat is actually open.
  - If he gives up, he holds it against the boss who kept him waiting, with the reason recorded. That feeds the discontent the existing churn reads: defection and breakaways.
- **A boss's name follows his family's fortunes.** Half of each week's change in the family's standing passes to its boss, NPC or player. Bosses rarely act in person, so before this their reputation never moved.

### What was deleted

- **The fixed seat table** (`CAP`) and the ways it could be exceeded without limit.
- **The player-only condition** on a new underboss passing his crew on.

### Tests

- **The full suite passes:** 289 tests, 13 opt-in long runs skipped.
- **Two existing tests depended on incidental numbers rather than their rule, and now check the rule:**
  - **The treasury test** inferred "support for a jailed man came from the fund" from the fund growing less than $400 that week. Larger families pay more dues, so it now checks the payment itself.
  - **The memory test** required three memories in twenty days, but the game's rule (each kind of memory at most once a fortnight) guarantees two. It now asks for two.

### Results: two years, four worlds

| Measure | Before | After |
|---|---|---|
| Men in the life at the end (associates / soldiers / captains / underbosses / bosses) | 6–14 / 32–40 / 29–30 / 3–5 / 5 | 45–65 / 47–55 / 24–30 / 5 / 5 |
| Men in the life, start → end | 87 → 76–87 | 87 → 128–160 |
| Taken into the life from the street | 5–8 | 58–77 |
| Left the life alive (retired, put out) | 2–7 | 2–9 |
| Formal demotions | 0 | 0 (one jailed boss was replaced and became a captain, an older rule) |
| Underboss seats filled at the end | 3–5 of 5 | 5 of 5 |
| Promotions | 39–50 | 55–63 |
| …of men still pushing for it when it came | 12–25 | 26–36 |
| Plans to rise that succeeded | 9–20 | 23–29 |
| Bosses' reputation at the end | 40 (never moved) | 46–49 |
| Spread of reputation in the life (sd) | 6–8 | 9–12 |
| Friends / enemies | about the same | about the same |
| Consistency and ledger problems | 0 | 0 |
| Save size at 2 years | 4.9–5.0 MB | 6.2–7.6 MB |

**The organisation keeps its shape.** Before, every world ended with as many captains as soldiers and a handful of associates. Now, in seed 3, it ended with 51 associates, 47 soldiers and 26 captains, and underboss seats are refilled within weeks. In seed 7, Tommy Zito was named underboss, then took the chair when Richie Brancato died, and Sammy Rizzo was named underboss in his place.

### What it revealed, for later steps

- **Families grow,** by half to four-fifths over two years, because their rackets grow, which is mostly the protection-demand storm winning shops. The growth is slowing in most worlds but not all (seed 11 is still growing at two years). A four-year run should confirm it levels off. If it doesn't, the cause is the demand storm, which belongs to the work-flow step, not this one.
- **Save size is up about 40%,** with more men in the world. Worth watching on longer runs.
- **Many ambitious men are still refused:** "his superior would not back him" ended about 50–60 plans per world. That's reasonable (not every man is ready), but how a boss judges readiness is still the old NPC formula, separate from the player's road. One rulebook for readiness remains open; it's the part of "same rules for everyone" this step didn't take on.
- **Relationships are unchanged,** as expected: that's the next foundation step.
