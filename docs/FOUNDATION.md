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

---

## Step 3: relationships that develop from experience

*October 2026, uncommitted, on top of steps 1 and 2 (commit `62548ae`).*

Friendships, rivalries, loyalty, resentment, respect and fear should all follow from what men live through, who they are and where they stand, through one implementation, with no targets for how many friends or enemies there should be.

### What changed

- **One door for regard** (`core.feel` / `feelOn` / `feelAtLeast` / `feelTo`). Every change to trust, affection, respect or fear goes through it: about 560 direct changes in some 35 modules. The same rules apply to everyone:
  - **A gain shrinks as the feeling nears its limit.** Before, that was true only of what NPCs felt about the player.
  - **Trust and liking grow with familiarity:** you can't come to trust a man you barely know, however well he treats you.
  - **Losses aren't damped.**
  - **What a man's regard rests on is kept** (`bond`), as a grudge keeps its reason.
  - The player's regard (`core.regard`) is now a thin layer over the same door. It keeps one rule of its own: the same gesture repeated with the same man in a week counts for less.
- **Familiarity** (`Rel.known`), separate from trust.
  - **It grows with** time together and with being on either side of the same event.
  - **It fades slowly** when men stop seeing each other.
  - **At the start,** men in a chain of command know each other better than neighbours do.
  - A man can know another well and still distrust him.
- **Time together depends on how two men get on** (`core.compat`).
  - **Who they are:** the agreeable and the sociable get on with most people; two proud men chafe; a hot man and a cool one rub.
  - **Where they stand:** wanting the same seat, an old grudge, or different families get in the way.
  - **The effect:** natural friends grow close; men who can't stand each other grow sore, and the grudge records why ("…rubs him the wrong way").
  - The player's crew friendships and fallings-out, which used to be dice rolls, now follow the same judgement.
- **Respect is a man's name as another knows it.** Between men who know each other, respect settles towards the other's reputation (earned by deeds since step 1), with a little extra for the man above. Drinking together no longer buys respect.
- **Violence splits by courage.** A brave man who is beaten bears a grudge; a timid one is afraid. Men who hear of violence learn to be wary of the man who did it, the more so the less brave they are.
- **Favours create a bond:** what the man who owes it thinks of the man who did it rests on the favour.
- **One weekly pass for all feelings** (`core.feelingsWeek`), even-handed:
  - a grudge cools, more slowly for a proud man;
  - fear fades;
  - liking and trust drift back between men who don't see each other;
  - familiarity fades slowly.

### Found and fixed along the way

- **Underbosses killed one after another.** A coup started whenever an underboss was ambitious and thought little of his boss: nothing about grudges, trust or grievance. That was harmless while respect only ever grew. Once respect followed reputation, nearly every ambitious underboss qualified, and with step 2 refilling the seat, one boss killed five underbosses in two years. A coup now also needs real discontent: grudges, lack of trust, ambition with nowhere to go, an unsettled house (`orgs.discontent`, which defection already reads). A man the boss has just raised, with nothing against him, doesn't plot.
- **Save and load was not exact.** A loaded world kept the save's version number, and a live world didn't have one. So anything the world first created after a load landed in a different place, and the two worlds stopped saving identically (found when a coup happened on day 38 of a test). A new world now records its version from the start, the same place a loaded one has it. The version constant moved to `types.ts`.

### What was deleted

- `temper.frighten` and `temper.fearWeek`: a second door and a second weekly pass for fear.
- The old weekly drift in the engine loop, which faded grudges every week but trust and liking only between men who'd stopped meeting.
- Respect from drinking together.
- The dice rolls deciding the player's crew friendships and fallings-out.
- A dead line in the dialogue code that clamped respect to itself.

### Tests

- **A new architecture test:** nothing outside `core.ts` may set trust, affection, respect or fear directly. A negotiation's own stance is exempt; it isn't a relationship.
- **The full suite passes:** 290 tests, 13 opt-in long runs skipped.
- **Three existing tests depended on incidentals and now check their rule:**
  - **Captains at the boss's club:** compared two different spans of days, and now compares the same evenings with and without the seat.
  - **A menu hint:** varies with how hot things are between families, which is world state like the rank hints the test already allowed.
  - **The Sunday envelope:** now steps back to the main menu when the boss opens with something of his own.
- **One test expected exactly −0.06.** The door now reports exactly the change asked for, where the limit didn't cut it short.

### Results: two years, four worlds

"Before" is the unchanged game (`baseline/rerun/`) and "Step 2" is commit `62548ae`, both measured with the same harness.

| Measure | Before | Step 2 | After |
|---|---|---|---|
| Friend pairs at the end | 1,469–1,906 | 1,563–2,110 | 783–1,001 |
| …first-quarter friend pairs | about 1,200–1,500 | about 1,200–1,500 | about 100 |
| Friendships formed / lapsed over two years | 2,120–2,727 / 202–854 | — | 1,210–1,577 / 194–544 |
| Friendships resting on something recorded | 0% | 0% | 100% |
| How well friends / enemies / everyone get on (compatibility) | not measurable | not measurable | 0.20–0.22 / −0.48 to −0.64 / 0.02–0.05 |
| Enemies at the end (grudge ≥ .4) | 18–33 | 24–45 | 55–91 |
| Grudges carrying a reason / naming an event | 0% / 0% | 98–100% / 83–89% | 98–100% / 64–76% |
| Former friends who turned on each other | 42–62 | 43–73 | 7–26 |
| Times a man became afraid of another | 3–10 | 2–7 | 76–177 |
| Trust in one's own boss / men holding a grudge against him | 0.90–0.97 / 0–1 | 0.62–0.66 / 0 | 0.40–0.45 / 11–20 |
| How well men know each other (average) | not measured | not measured | 0.25–0.30 |
| Times a man's respect for another fell, per week at the end | 3–9 | — | 122–177 |
| Deaths | 1–4 | 2–4 | 2–6 |
| Beatings | 184–378 | 207–320 | 293–543 |
| Promotions | 39–50 | 55–63 | 41–56 |
| Consistency and ledger problems | 0 | 0 | 0 |
| Save size at 2 years | 4.9–5.0 MB | 6.2–7.6 MB | 8.2–9.3 MB |

### Do the relationships make sense?

Judged against what the men experienced, yes. Some examples:

- **Friends get on and enemies don't.** Across all four worlds, friends score about +0.2 on compatibility, enemies about −0.5 to −0.6, everyone together about 0. Who becomes friends or enemies follows from who they are.
- **Friendship takes time.** About a hundred friendships after three months, instead of over a thousand. Each friendship rests on something recorded: mostly time spent together ("counts Mario DeLuca a friend (it rests on: time spent with Mario DeLuca)"), sometimes a favour.
- **Friends can fall out, for a reason.** "Vincent Leone caught Carmine Vitale talking him down to get ahead", and from then on he holds it against a man he had counted a friend.
- **Fear follows violence:**
  - "has become afraid of Tommy Cassano" comes after Cassano's people roughed him up twice in two days;
  - "afraid of Richie Lombardi" comes after Lombardi's people smashed up the candy store.
- **Loyalty is earned and can be lost.** Trust in one's own boss no longer sits at 0.9–1.0 by default (the saturation flagged in the V85 playtest). It averages about 0.4, and 11–20 men per world resent their boss, each with a recorded reason.
- **Killings come at the end of something.** In seed 3, both killings closed feuds that had gone beating for beating four or five times, with the whole chain on record ("Gino Orsini beat up Mario Giordano ⇐ Mario Giordano beat up Gino Orsini ⇐ …").

### What it revealed, for the owner and for later steps

- **More enmity means more violence.** About a third of grudges now come from temperament clashes rather than a single event. Enemies roughly triple, beatings rise 40–70% over the baseline, and deaths go from 1–4 to 2–6 over two years. Each act has a recorded cause, and killings stay within the benchmark of one to two mob deaths per sixty days set for the consequence work. But it's a real shift in the world's temperature. **Owner's decision:** is a third of grudges from personality clashes believable, or should men who chafe more often just keep apart? That's a weight in `compat` and in how strongly chafing turns into a grudge. It would be a judgement about plausibility, not a target.
- **Save size is up another 20–25%,** to 8–9 MB at two years, because each acquaintance now carries familiarity and a bond. A four-year game could reach about 18 MB. Trimming what's stored (shorter bond records, dropping faded acquaintances) is worth doing before the conversation rebuild.
- **Most friendships rest on time together, and favours rarely become the bond.** A favour's bond is recorded at a modest weight, so time spent usually outweighs it. When the conversation rebuild reads bonds, favours may deserve more weight.
- **Promotions fall back towards the baseline** (41–56). Bosses now trust their men more slowly, and promotion needs a boss's trust. That's the expected consequence of earned trust. It also makes the **outstanding promotion-rule inconsistency** more pressing: how a boss judges readiness is still the old NPC formula, separate from the player's road. It remains open for the next step.
- **The protection-demand storm is untouched,** as instructed. It still dominates many men's histories (Marty Leone was turned away by sixteen shops in three days), and family growth still rests on it.
