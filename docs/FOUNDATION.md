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

---

## Stage 4: the criminal economy and work

*Approved October 2026.* Design and reasoning in [STAGE4_ECONOMY.md](STAGE4_ECONOMY.md).

**Order of increments:**
1. loans;
2. one enterprise record;
3. protection by crew ground;
4. work down the hierarchy;
5. one career rulebook;
6. money circulation;
7. the player names his figures.

Player access to the economy is built into each increment where it belongs, and is an acceptance criterion for the stage.

### Audit: can the player actually take part? (read-only, before any change)

| What a player might want to do | Underneath | How a player finds it today |
|---|---|---|
| **Buy a business** | NPCs only. Every way a business changes hands is an NPC plan, a takeover over arrears, a buyout between partners, or inheritance. | **Impossible.** No route exists. |
| **Sell a business** | NPCs only | Impossible |
| **Buy a stake** | One fixed offer: $2,000 for a quarter of a business in trouble | Hidden among rank powers ("Back a struggling business"), and only for shops already losing money |
| **Offer to invest in a shop** | A fixed $500 loan offer | One conversation option, only when he talks about his business |
| **Start a racket** | Works, through the player-only operations system | **Discoverable:** the Rackets tab, at associate level for most kinds (made men's kinds need rank). The income is abstract. |
| **Partnership** | A chop shop with a garage owner (fixed $2,000), or moving goods through a pawnbroker | Conversation options with those two kinds of owner only |
| **Borrow / lend** | Real debts, but each of about 17 routes sets its own amount and rate | Scattered conversation options and chance encounters; no amount of his own choosing |
| **Name a protection figure** | The negotiation accepts any amount | The code fixes it at 7–8% of income; no amount control exists anywhere in the interface |
| **Delegate management** | Operations can have a runner; businesses have a manager field | A runner can be named for the player's own operations; nothing for businesses |
| **Run another man's operation** | No such arrangement | Impossible |

**Conclusion:** the simulation supports more than the player can reach. Buying and selling businesses, choosing figures and running another man's operation have no player route at all. Stakes and partnerships exist only as fixed, narrow offers. Each Stage 4 increment adds the player's way in through the same rules and records NPCs use, and the eight player flows listed in the approval are tested as gameplay.

### Increment 1: loans

- **A loan now keeps its terms apart.**
  - **The principal** still owed (`owed`).
  - **Arrears:** interest charged and not yet paid.
  - **The weekly rate.**
  - **The weekly payment** both sides agreed.
- **Interest doesn't compound into the principal any more.**
  - Lending $1,000 at 5% a week charges $50 each week.
  - A payment clears arrears first, then principal.
  - A man who pays only the interest still owes $1,000.
  - Missed weeks pile up as arrears, in a straight line, not a balloon.
- **Renegotiating is its own act** (`core.restructure`): a new rate or a new payment. **Forgiving part of a debt** is another (`core.writeDown`). Both are recorded on the debt.
- **One way to lend.** Every NPC loan now goes through the same lend negotiation the player uses (`asks` "lend"). The lender names a rate from his greed and temperament; the borrower can refuse it as too dear. Situations, people in crisis and crew members all use it.
- **Save compatibility.** Old saves load: a debt without the new fields reads its whole balance as principal.

### Increment 2: one enterprise record

- **One record for every enterprise,** the player's and every NPC's (`w.ops`, `rackets.ts`).
  - NPC "hustles" and the player's "operations" were two systems with different rules. The hustle system is deleted (`hustle.ts`).
  - Old saves convert an NPC's hustle into an enterprise when they load.
- **Same rules for everyone.** An NPC starts an enterprise with the player's starting rules (`canStart`): money to start it, rank for the made men's kinds, the right district.
  - He chooses by what it would pay a man like him, how crowded the trade is where he lives, the heat it brings and how careful he is.
  - He closes it after a run of bad weeks, and may expand a good one.
- **Enterprises produce real things.**
  - A loan book makes real loans, through the lend negotiation.
  - A betting book's heavy losers run up real markers: debts with a man's name on them.
  - Police raids fine the owner and may take the man running it.
- **Two new kinds for NPCs who used to have abstract hustles:** a car-stealing outfit (`chop`) and a fencing operation (`fencing`), with the player's sheets.
- **Less noise from gambling.** A loss is recorded only when it matters: a large stake, a man left nearly broke, or the player.

### Found and fixed along the way

- **Saves grew to 10–11 MB.**
  - **Cause:** raids and defaults were "permanent" facts. Gossip carried them to everyone and they were never dropped. That was right when raids were rare. Once every enterprise faced the police, a fine on a numbers spot was known to half the city for ever.
  - **Fix:** a raid with a fine, or a default, under $1,000 is now local news. It travels a little and fades unless something still refers to it (`retain.tierOf`). The federal sweep and large defaults stay permanent.
  - **Result:** saves are back to 7.7–8.8 MB, slightly smaller than step 3.
- **A betting book gave credit to a man who had already stiffed it.** The casino never did. A book now follows the casino's rule.
- **Two dialogue tests relied on accidents of a 60-day world.** One assumed the idle player had done nothing worth noticing; in the new history, his superior has him beaten for ignoring a summons. The other assumed he held no grudge against his boss. Both now test their rule directly.

### Results: two years, four worlds (after increments 1 and 2)

"Before" is the unchanged game (`baseline/rerun/`) and "Step 3" is commit `24c2beb`.

| Measure | Before | Step 3 | After |
|---|---|---|---|
| Active debts at the end (count / balance) | 35–56 / $25,576–$157,299 | — | 75–109 / $17,537–$32,807 |
| Worst debt as a multiple of what was lent | — (seed 7's book went from $34k to $157k in six months) | — | 1.97–3.15× |
| Loans ever made / defaulted | not measured | — | 627–729 / 56–73 |
| Men with an enterprise of their own / weekly net | 54–66 / $46,284–$58,101 (abstract) | — | 88–108 / $33,157–$36,672 (real records) |
| Enterprises running at the end | — | — | 122–154 |
| Gambling losses recorded | 1,527–4,237 | — | 15–40 |
| Protection deals / refusals | 29–40 / 548–1,113 | — | 28–38 / 687–1,187 |
| Promotions | 39–50 | 41–56 | 37–49 |
| Consistency and ledger problems | 0 | 0 | 0 |
| Save size at 2 years | 4.9–5.0 MB | 8.2–9.3 MB | 7.7–8.8 MB |

- **The enterprise mix:**
  - car theft 46–59 and fencing 16–33 (the entry trades, which need no rank);
  - numbers 10–13, vending 8–13, bookmaking 6–10;
  - the made men's trades in single figures;
  - loan books 1–3.
- **Defaults come from three places:** private loans, casino markers and book markers, each at about 20–30% default. Business loans never default. Markers go, by design, to poor men with a strong vice, so many defaults are a believable consequence and not a fault. I haven't tuned it.

### Open, for the owner

- **Loan books are rare (1–3 per world).** They cost $1,200 to start and pay modestly, so few men choose them. Lending still happens all the time person to person; a loan book only makes a business of it. Increment 6, money circulation, is where it belongs if it should be commoner.
- **Protection refusals were still 20–40 per deal.** That was increment 3's job, below.

### Increment 3: protection by crew ground and purpose

The daily scan in which every associate and soldier considered every open shop in the city is deleted. No cap was added; an approach now needs a reason.

- **A crew's ground** (`econ.crewGround`). A crew is a captain and the men under him; its ground is the districts of its family where its men already collect. A crew that collects nowhere yet starts where its captain lives. It is read from the protection records, not a new territory system.
- **A man grows his own book there.** An unprotected shop outside his crew's ground isn't his business.
- **A shop remembers whom it turned away** (`Business.refused`, set at the first refusal in a negotiation, cleared by a deal).
  - The man doesn't go back unless something has changed (`econ.changedSince`): he stands higher than he did, he has a different captain, or the shop has had trouble since.
  - A violent, volatile man may go back anyway, and then he goes back hard.
  - A shopkeeper who has already sent a man away, with nothing changed, is a little firmer the second time. That holds for the player as well.
- **Another family's shop is a decision with a reason:** its man is dead or inside, a grudge against him, or bad blood between the families. The reason is part of the choice. A shop of his own family's is never a daily choice.
- **Captains sending men to a shop** belongs to increment 4, where one assignment mechanic serves NPC captains and the player alike.

**Tests** (`economy/protection.test.ts`):
- a man's choices stay in his crew's ground and never touch his own family's shops;
- another family's shop is left alone until he has a grudge against its man;
- a refused man doesn't go back until his standing rises.

**One test had relied on chance.** A matters test assumed that ten days in, someone would be leaning on a shop the player hadn't heard about. With fewer demands, sometimes nobody is, so the test now has a soldier make one.

### Results: two years, four worlds (after increment 3)

| Measure | Increments 1–2 | After increment 3 |
|---|---|---|
| Protection deals (two years) | 28–38 | 29–42 |
| Refusals | 687–1,187 | 340–454 |
| Refusals per deal | 20–40 | 10–13 |
| Shops taken from another man | 76–109 | 63–86 |
| Shops smashed or vandalised | 207–282 | 120–232 |
| Beatings | 435–574 | 398–535 |
| Shops paying protection at the end | — | 54–62 |
| Promotions | 37–49 | 35–49 |
| Consistency and ledger problems | 0 | 0 |
| Save size at 2 years | 7.7–8.8 MB | 7.5–8.9 MB |

- **Refusals halved, with the same number of deals.** Less violence followed: fewer smashed shops, fewer shops taken from another man, fewer beatings. Nothing was capped.
- **Still 10–13 refusals per deal.** A first approach to a shop that won't pay is still the commonest way a book grows, and refusing is still what most shopkeepers do first. Increment 4 adds the other purpose, a captain sending a man, and with it the record of who was sent where.

### Increment 4: work down the hierarchy

**One way for a superior to give a man work** (`work.ts`), for an NPC captain sending a soldier, the player's boss sending the player, and the player sending his own crew.

- **What a superior needs done is read from his affairs** (`work.needsOf`), most pressing first:
  - money owed him that has stopped coming;
  - shops on his book that are behind;
  - one of his men inside;
  - a man who hurt him or one of his men, that he knows of;
  - an unpaid shop in his crew's ground (the captain's instruction that increment 3 left for this one);
  - a shop of his that has had trouble.

  No need, no job. Nothing is made up to keep men busy.
- **He gives it to one of his men** (`work.pickMan`, `work.giveWork`): someone free, suited to the work and trusted with it.
  - The player is one of his superior's men like any other. He gets the work as an offer he can take or turn down.
  - An NPC may refuse a superior he holds something against or doesn't rate, or rough work that isn't in him. A refusal is recorded, and his superior holds it against him, with the reason.
- **The work runs through the order model** (`orders.ts`), as the player's orders always did. A man may do it well, botch it, skim, gamble the money away, show mercy, start a fight, or come back with a story that isn't true. Money collected goes to the man who sent him, less the man's cut.
- **The superior weighs the report** (`work.judge`). A careful man checks, and he can see money owed him that didn't arrive. A lie found out is:
  - a grudge with its reason;
  - a fall in trust;
  - a disciplinary event the world hears of;
  - money taken back.

  An honest report is taken as it comes. (The player questions his own men himself, as before.)
- **Delegated management** (`work.delegate`). A captain or above puts one of his men in charge of his enterprises. Now and then he counts the take, more often if he's careful or the take has fallen. A runner found skimming is fired, made to pay it back, or warned, by the owner's temperament, and it's on the record.
- **Whose business it is.** Work NPCs give each other uses the same records but never appears in the player's lists (`jobs.playerSide`).

**What was deleted or replaced:**
- **The boss's player-only lists.** `bossOffer` had its own debts and shops; it now offers the boss's real needs, or a private matter of his own.
- **`bossErrand`'s random envelopes, messages and tails:** work made up to fill time.
- **`pulse.ts`'s "rights" offer,** which handed the player protection over shops without asking their owners.
- **The boss's slot in the random daily offers.** A superior's work now comes through the same weekly hand-out as everyone's, or when the player asks.

**Found and fixed along the way:**
- **Money collected on a shake was also charged to the man who gave the order.** It went unnoticed because only the player gave orders.
- **Collections repeated weekly.** A superior kept sending a man every week to a debtor with nothing. After sending someone, he now waits three weeks.
- **A quiet word was counted as a failure.** For the man sent, it's done once said; the answer is the other man's to give.
- **Two enterprise labels read "the a car-stealing outfit".**

**Tests** (`hierarchy/work.test.ts`, and one in `architecture.test.ts`):
- needs come from a superior's affairs;
- a captain gives work, which is carried out and reported;
- the player is offered what his boss really needs;
- a man who hates his captain often refuses, on the record;
- a careful superior catches lies;
- enterprises are delegated and a short count is found out;
- the player's orders come from the same list;
- orders and a superior's routine work have one door.

**Two years, four worlds:**
- **Work handed down by NPC superiors:** 800–1,000 pieces per world.
- **Refusals:** 17–79.
- **Lies caught:** 36–52.
- **Enterprises delegated:** 16–36.
- **Promotions:** 33–55.
- **Consistency and ledger problems:** 0.
- **Saves:** 8.1–8.8 MB.
- **Most of what comes to nothing is collection from men with nothing to pay,** whose debts then run on to default. That's believable, and the repeat visits are fixed.

### Increment 5: one career rulebook

This closes the inconsistency left open since step 2. The player's road (`path.ts`) and the NPC rule of thumb (`career.npcReadiness`) were two different rulebooks. One asked $15,000 passed up and 20 jobs to be made; the other asked $1,500 and nothing else. Now **one road for every man** (`path.pathInfo`), read by the player's screens and by the family deciding on an NPC (`career.readiness`).

- **Not negotiable:**
  - what he has passed up;
  - a senior man who will speak for him;
  - before he is made, a test the family sets him once the rest is done. The player chooses how to go about it; another man goes about it his best way, at the same odds (`path.npcTrial`).
- **Weighed together** (three-quarters is enough, so a man strong in most and short in one is still in the running):
  - the breadth of his backing (three made men for a soldier; the boss and the underboss for a captain);
  - the work he has done for the family, his own and what his men finished on his orders;
  - a name worth having;
  - for the underboss's chair, the family's hard work.
- **The numbers come from what men in this world actually do.** Over two years an associate passes up about $2,000 (the best $10,000), a soldier about $8,000, a captain about $11,000, and a superior hands a man below him a piece of work every few months.

| Rank | Passed up | Work | Name |
|---|---|---|---|
| Soldier | $3,000 | 2 | 30 |
| Captain | $10,000 | 3 | 40 |
| Underboss | $20,000 | 6 (and 1 hard job) | 50 |

- **A seat is the family's.** It's open, or the boss opens one for a record he has been hearing about for weeks (`career.noticeTick`). That's now true for the player too: his finished road no longer opens a seat on the spot.
- **The chair beside the boss** goes to a captain whose road is done:
  - into an empty chair;
  - or in place of the man in it, if the boss rates him well above that man. The man moved aside holds it against him.

  The same rule applies to the player. If the chair stands empty a season and nobody's road is done, the boss names the captain he rates most: an empty seat the structure needs, not a reward for waiting.
- **The record** (`Character.career`) is kept where every job ends (`work.noteWork`): his own work, his men's work for him, rough work, hard work, and the test passed.

**Deleted:**
- the NPC formula and its "old family / new family" weighting;
- `familyHit`, which invented a name and a reason ("has been taking what isn't his on your ground") so the player could tick off a kill. The family's hard work is now real work: a man who hurt one of ours, dealt with because a superior asked (`work.needsOf` 'handle').

**First attempt, measured and corrected.** Taking the player's road as it stood, every goal a hard gate, cut promotions from 33–55 to 6–15 per world, and captains fell from 13 to 7–11. The organisation's life cycle from step 2 would have stopped. The reasons, counted man by man:
- two senior men's trust at 0.5 (trust in a boss averages 0.45 since step 3);
- job counts that superiors rarely hand out below captain;
- a kill for every captain.

The gates are now only what can't be negotiated, the rest is weighed, and proof is the same test for everyone.

**Tests** (`hierarchy/promotion.test.ts`):
- the player and an NPC are measured on the same things;
- a man isn't made because time has passed;
- a man whose road is done is made when there's a seat, and not before passing his test;
- finished work is on the right records.

The climb-to-boss tests now let the player wait for a seat.

**Two years, four worlds:**
- **Promotions:** 29–35 (associate → soldier 16–25, soldier → captain 8–12, a few to the top). Before: 33–55.
- **Captains:** 13 → 18–21 as families grow.
- **Consistency and ledger problems:** 0.

### Increment 6: money with a purpose

**Audit of where money comes in and goes out:**
- **In:** business takings, enterprises, protection, loans repaid, wages.
- **Out:** living costs and lifestyle, which are charged to everyone each week and are money spent into the wider city.
- **Through the families:** dues into the family fund; support for men inside out of it.

Three things were wrong:
1. **The family fund was spent on almost nothing.** Only men inside were supported, and a greedy boss helped himself.
2. **The player paid no dues** where every other made man did.
3. **Instead, the player paid random weekly "obligations"** (a wedding, a wake, a lawyer, bail) that came from nothing in the world. That's the invented expense the brief rules out.

**Changes:**
- **The family lawyer** (`matters.ts`, in the existing arrest matter). While a made man is held, the fund pays a lawyer by rank ($400 for a soldier up to $2,500 for a boss), and the lawyer earns it: the time is cut in half. An early release the family paid for isn't treated as suspicious, the way an unexplained quick release is. An associate isn't the family's yet, and a fund that can't cover it can't.
- **A trusted man's outside debt** (`orgs.treasuryWeek`). A made man going under to someone outside the family isn't left to it. If the boss trusts him, the fund clears the debt before it defaults, and the man owes the boss a favour for it (`addFavour`), which is called in later. Money is only moved.
- **Dues are the same for every made man, the player included.** His dues appear in his week.
- **The random player-only obligations are deleted.**

**Tests** (`organisations/structure.test.ts`):
- the fund clears a trusted man's outside debt and he owes the boss, with money conserved;
- an arrested made man gets the lawyer and his time is cut, while an associate doesn't;
- the player pays dues.

**One test now looks at everyone in town.** A test about ordinary men's conversation subjects had only looked at the first 80 people in the list, all men of the families. With fewer shops under pressure it found too few kinds of subject.

**Two years, four worlds:**
- **Lawyers paid for:** 9–15 per world.
- **Outside debts cleared:** 3–13.
- **Defaults:** 25–54 (increments 1–2: 46–82).
- **Promotions:** 29–42.
- **Consistency and ledger problems:** 0.
- **Saves:** 7.0–7.7 MB.

**Open: family funds still build up,** to $30,000–55,000 a family at two years. The fund now spends on real needs, but those needs are fewer than the dues coming in. I haven't invented spending. A boss putting fund money behind his captains' enterprises, or into a war, would be the natural next use, and belongs with the leadership decisions of later work.

### Increment 7: the player's way into the economy

The audit at the start of Stage 4 found the simulation could do much more than the player could reach. Each gap, and how it's closed through the same rules NPCs use:

| What the player wants to do | How it now works | Where |
|---|---|---|
| **Buy a business** | Find it (the Family tab lists the town's shops and places; a shop's page sends you to its owner), introduce yourself, ask whether he'd sell. He asks what you have in mind; you name a price. He answers from the rules every sale follows (`econ.sellerFloor`): what the place is worth, what trouble he's in (a business in the red, missed debts, jail, an empty pocket), his greed and pride, and what he thinks of you. He accepts, refuses with his reason ("That's not what the place is worth"), or names the least he'd take. The sale is `econ.sellTo`, the same one NPC buyers use. | `asks` 'buy' |
| **Buy a piece of one** | The same, for a quarter of it: money down for a share of what it makes every week. | `asks` 'buy' with a share |
| **Sell your business, or a piece** | Offer it to a man with money when you talk business. He weighs what it's worth to a man like him, whether he has the money and how many places he has, then accepts, refuses or counters. **NPCs also make offers for the player's places** through their own business plans (`goals.ts`): he's put the offer, and can accept, refuse or ask more. | `asks` 'sell'; `goals.ts` |
| **Name a figure** | Wherever a negotiation is about money, the conversation shows a field to name your own figure, and for a loan the weekly rate too. The other man answers that figure from his own position. One figure a day: he has heard your number. | `asks.nameFigure`; `dialogue.ts` 'nm:'; `ui/talkview.ts` |
| **Protection at a fee you choose** | The shopkeeper weighs your figure against what his business can carry, who protects him already, what has happened on his street and whether he has sent you away before. An agreed fee is the arrangement. | `asks` 'protect' |
| **Lend on your own terms** | Amount and weekly rate. The man takes it if he needs it and the price of the money is fair to him. The debt carries the terms. | `asks` 'lend' |
| **Borrow** | You name the amount; he decides what he can spare. | `asks` 'borrow' |
| **Run another man's enterprise** | Offer to run it for a cut of the take, which you name. The owner weighs what he thinks of you, what you're good at and whether he has a man on it already. A runner is paid his agreed cut each good week; NPC captains who delegate pay their men 15%. | `asks` 'run'; `rackets.ts` |
| **Delegate the running of your place** | Your business's page: put one of your men in charge, hire a manager in as NPC owners do, or run it yourself. A manager's brains and care decide how well it's run. | `econ.setManager` |
| **Start an enterprise** | Already open from associate level on the Rackets tab (increment 2); the same starting rules as NPCs. No captain has to give it to you as a job. | `rackets.canStart` |

**Consolidated along the way:**
- **Five fixed-sum loan routes** in conversations wrote debts directly and skipped the negotiation. Two became the lend negotiation; one unreachable follow-up was deleted. ("Offer him $500" and "lend him $300" now go through the negotiation; you name the amount.) Responses to a man who came asking for a specific sum remain as they were: his request set the terms.
- **Deals have their own voice.** The conversation's speech had treated a purchase like someone asking for a loan ("I haven't got it to spare"). Buying, selling and running an enterprise are now their own kind of exchange, with reasons that fit and replies that fit ("Then name your price").
- **When the player is asked and counters,** the counter goes the right way: more, when an NPC is offering him money for his business.

**Tests** (`economy/player.test.ts`). The eight approved player flows, as gameplay through the real conversation and screens:
1. an associate finds a business from its page and asks the owner;
2. a low offer is refused or countered, and a better one named;
3. he owns it, the money went to the seller, and it's on the record;
4. and 5. he starts a racket himself, earns from it and owes his share upstairs;
6. he names a protection figure and the man answers that figure;
7. he lends at an amount and rate he names, and the debt carries them;
8. he decides who runs his place.

The menus snapshot test was updated for three loan hints that now say the player names the figure.

**Checked in the browser** (a new game in the dev build):
- An associate with $1,250 found Moretti's Laundromat on the Family tab, walked over and introduced himself, and offered to buy a piece.
- Freddie asked what he had in mind. The player named $900 for a quarter, and Freddie "thinks it over, then nods". Cash went from $1,250 to $350, and the history reads "You bought 25% of Moretti's Laundromat from Freddie Moretti for $900."
- An earlier attempt at the whole of a tavern for $1,000 was refused.

### Stage 4: final validation

**Two years, four worlds, with all seven increments** (seeds 3, 7, 11, 19; "Before" is the unchanged game in `baseline/rerun/`):

| Measure | Before | Stage 4 |
|---|---|---|
| Worst debt as a multiple of what was lent | seed 7's loan book: $34k → $157k in six months | 2.1–3.1× |
| Loans made / defaulted | not measured | 648–798 / 41–65 |
| Enterprises running at the end | abstract hustles (54–66 men) | 105–139 real enterprises |
| Protection refusals | 548–1,113 | 418–536 |
| Work handed down by NPC superiors | none | 637–883 pieces; 14–45 refused; 18–32 lies caught |
| Enterprises delegated to a runner | none | 15–20 |
| Lawyers paid for by a family fund / outside debts it cleared | none | 8–13 / 3–13 |
| Promotions | 39–50 | 29–37 |
| Men in the life (associate / soldier / captain) at two years | about 30 / 35 / 13 | 34–50 / 31–44 / 14–21 |
| Gambling losses recorded | 1,527–4,237 | about 15–40 |
| Consistency and ledger problems | 0 | 0 |
| Save size at two years | 4.9–5.0 MB | 7.2–9.1 MB |

**What the checks covered:**
- **Economic stability.** Debts no longer balloon. Average cash at two years is about $3,500–4,400 for associates, $7,900–9,100 for soldiers and $13,000–21,000 for captains: growing, not exploding. Family funds hold $30,000–55,000 each (open item, increment 6).
- **NPC autonomy.** NPCs start, grow, delegate and close enterprises; lend through negotiation; lean on shops in their crews' ground; hand out and refuse work; catch lies; get lawyers; buy businesses (from each other and from the player); and rise by the shared road.
- **Organisation.** Captains grow with the families (13 → 14–21). Promotions keep flowing and go to men whose road is done.
- **Repetition.** Gambling-loss noise is gone. Protection refusals are down by half. Repeat collections from the same broke debtor are fixed.
- **Save size and persistence.** 7.2–9.1 MB at two years, within IndexedDB's comfort, but still the open question it was at step 3. Every new field is optional. Old saves load (the `compat` tests and the schema-2 fixture pass), and NPC hustles are migrated into enterprises.
- **The player's economic interactions.** Tested as gameplay in `economy/player.test.ts`, and checked in the browser.
- **Obsolete systems removed:**
  - `hustle.ts`;
  - the daily citywide shakedown scan;
  - `bossErrand`'s random errands;
  - the "rights" grant;
  - `familyHit`;
  - the NPC career formula;
  - the player's random obligations;
  - three fixed-sum loan routes.

**The test suite:** 317 pass. The 13 opt-in long tests (180-day runs, save round trips, save growth, ledger stability, succession, the full conversation audit) were run with `SLOW=1`: all pass. The conversation audit found one old fault, "I’ll look into it myself" leaving no record of what was found, which is fixed: what you find is kept with what you know about the man.

**Open items carried forward:**
- **Family funds build up.** A boss putting the fund behind his captains' enterprises, or into a war, belongs with leadership decisions.
- **Loan books stay rare** (1–3 per world).
- **Save size** is 7–9 MB at two years. Trimming faded acquaintances is the next lever.
- **Some loans the player makes on request keep their fixed sums.** Where a man comes asking for a particular amount, the player answers his request; it isn't yet a negotiation.

## Stage 5: the social simulation

### Audit of the existing social architecture (before any change)

Much of what Stage 5 asks for already exists from V89 and V90. The work is to make it one system, fill the gaps, and remove the parallel paths.

**Authoritative, and kept:**

| What | Where | What it does |
|---|---|---|
| Knowledge | `core.addFact`/`learn`, `Character.known` | Every event is a fact. A man knows only what he witnessed or was told, with its source (witness, himself, the street, or a named man) and whether he knows who did it. |
| Rumour | `rumour.ts`, `actions.share` | A man's version of a fact, shaped by who told him. Gossip travels by trust and sociability; serious news travels further. |
| Forgetting | `retain.ts` | Routine facts fade; bystanders forget; whatever something still points at is kept. |
| Relationships | `core` (steps 1–3) | Trust, respect, affection, fear and grudge, each with its doors. Grudges carry their reason; familiarity and bonds grow from experience. |
| Temperament | `temper.ts` | Why two men answer the same thing differently; how one man sees another. |
| Negotiation | `asks.ts`, `exchange.ts`, `react.ts` | One framework for NPCs and the player: terms, moves, stance, answers with reasons, counters, the point in hand, and his words. |
| Matters | `situ.ts` (the record), `matters.ts` (kinds) | Anything unresolved between people, who knows of it, its history and how it ends. The player sees only what he has been told (`sitmoves.ts`). |
| What a man has on his mind | `talk.ts` | His shop, his racket, his wants, his family, his boss, his troubles. |
| The conversation | `dialogue.ts` | The hub (what he brings up, what is between you, the everyday questions, proposals), subjects in hand, the used-option rule, no repeated lines. |
| NPC plans | `goals.ts` | Wealth, business, recruiting, advancement, debt, independence. |
| Work and money | Stage 4 | `work.ts`, `asks` buy/sell/run/lend/protect, `orgs.treasuryWeek`. |
| Family disputes | `disputes.ts` | Quarrels between families: grievances, sit-downs, terms kept and broken. |

**Duplicates and obsolete parts:**

| What | Why | What happens to it |
|---|---|---|
| The club's conversation scenes (`club.ts` script engine) | Retired as small talk in V90 (sitting down with a man at the club opens the ordinary conversation); kept only to finish a scene in an old save. Its reasons a man "wants a word" are computed separately from the hub's. | Deleted. An old save's scene is closed on load. The club keeps its identity (owner, hours, who is in, who wants a word), and "wants a word" reads the same source as the conversation. |
| `situations.ts`'s "money trouble" | A man in trouble near the player only ever asks the player. | Replaced by the shared intention to ask for help: he goes to whoever he trusts and can help, player or not. |
| `situations.ts`'s "ambition" | Duplicates the NPC advancement plan, which already asks a man's superior, the player included. | Deleted. |
| Encounters as a separate way to reach the player | NPC requests reach him either as matters put to him or as separate encounter scenes. | NPC-initiated approaches go through one door: he comes to you with something real, and you answer him in the conversation. |
| The hub's arrangement | The everyday questions and "put something to him" are close to, but not, the five consistent groups the brief asks for. | Rebuilt as on your mind, then the five groups, then leave. |

**Gaps:**
- **No single place where an NPC decides to go and see someone.** Plans, matters, daily actions and Stage 4's work each start interactions on their own terms.
- **Missing reasons to go and see someone:**
  - a debtor asking for more time;
  - a man reporting something up to his superior;
  - a man in trouble asking for help (beyond the player);
  - a man repairing a relationship;
  - a superior confronting misconduct he has heard of.
- **News doesn't climb the hierarchy deliberately.** A shopkeeper's protection demand reaches the collector, but the collector doesn't tell his captain.
- **NPCs never open a conversation the way the brief describes** ("Got a minute?"), with the player choosing how to receive him.
- **Stage 4's records** (assignments, deals, the family fund) aren't yet among the conversation's contextual shortcuts.

### Plan
1. **5A, intentions** (`intent.ts`). One weekly-and-daily mechanism through which a man decides whom to go and see and why. Each intention comes from real state, chooses a partner by relationship, authority, access, benefit and risk, and acts through the existing doors (asks, matters, gossip, favours, the order model).
2. **5B, knowledge.** Reporting up the hierarchy. Each claim keeps what kind of knowing it is (seen, told, rumour, suspected, out of date). Denials and claims are remembered for later confrontation. Routine talk stays bounded.
3. **5C, the conversation.** On your mind, then the five groups with natural, context-dependent openings and replies, then leave. Negotiation controls in place (Stage 4). NPC-initiated conversations. The club's engine deleted.
4. **5D, situations.** Stage 4's work and deals as matters, with the player's history readable from the records.

### Increment 5A: social intentions

**One place where a man decides to go and see someone** (`intent.ts`). Each NPC weighs his intentions once a week, on his own day, and acts on the one that matters most to him, if any matters enough. Every intention comes from something true in his world, chooses its man by what is between them, and acts through the existing doors:

| Intention | When | Whom | What happens |
|---|---|---|---|
| **More time** | He can't make his payments | The man he owes | A new negotiation (`asks` 'time'): he names an easier weekly payment, and the lender weighs what he thinks of him, whether he can see the money really isn't there, and his own greed and need. Agreed terms change the debt. |
| **Someone to speak for him** | Two or more payments behind | A man the creditor trusts, whom he trusts | That man speaks for him if he thinks well enough of him, and the creditor gives a week. When it's the player, he's asked in person (the existing scene). |
| **Help** | His business is going under, or his pockets are empty | The man he trusts most who could help | The borrow negotiation. When it's the player, the existing scene, where what he says the money is for may not be what it's for. |
| **Reporting up** | He knows of something done to the family's men or shops that his superior doesn't | His superior | The superior learns it from him, with his knowledge of who did it (`core.learn`). |
| **Amends** | A man he values holds something against him | That man | The amends negotiation. |
| **Taking a man to task** | One of his own men hurt a shop under the family's protection | His man | Trust falls, it's recorded, and a proud man resents it. |
| **Asking for work** | Short of money | His superior | Work only if something needs doing (`work.needsOf`). |

**Removed and consolidated:**
- **`situations.ts`'s player-only loan request** and its NPC-to-NPC copy are replaced by the "help" intention. It keeps only its record of who is in trouble, which the conversation reads.
- **Its "ambition" story is removed.** It duplicated the NPC advancement plan.
- **The random encounter generators for a debtor's plea and a loan request are removed.** Those approaches now come from the men's own intentions. The scenes remain as the player's way of being asked.
- **The cap on closed matters is kept whenever one closes** (`situ.bound`), not only when a new one starts. More activity had shown up the gap.

**Tests** (`social/intentions.test.ts`), each from a real circumstance:
- the debtor asks his lender;
- the man in trouble goes to the player when the player is the one he trusts, and to a friend otherwise;
- news climbs to the captain with its source;
- a captain takes his man to task;
- a man asking for work gets it only when something needs doing;
- an intermediary buys a debtor a week.

**Two years, four worlds** (per world):

| Intention | Count |
|---|---|
| More time | 61–133 |
| Someone to speak for him | 7–17 |
| Help | 30–69 |
| Reports up | 1,900–2,850 |
| Amends | 40–76 |
| Taking a man to task | 54–77 |
| Asking for work | 310–566 |

- **Defaults fall** to 31–46 (from 41–65).
- **Promotions:** 30–39.
- **Consistency and ledger problems:** 0.
- **Saves:** 7.3–8.9 MB.
- **None went to the player.** The harness player does nothing, so nobody trusts him enough to come to him. The tests cover that path.

### Increment 5B: knowledge and social memory

**Most of this was already there,** and was kept: facts and per-man knowledge with their source; rumour versions (a man may hold back a name he means to protect, pin a thing on a man he hates, or make a sum bigger); retention; grudges with their reasons; remembered refusals (`Business.refused`); denials to the player (`Character.denied`); remembered negotiations (`sitcool`, the point in hand); broken words; favours.

**Added:**
- **How a man knows a thing** (`rumour.knowing`): seen, told by a man who was there, rumour, suspected (he believes a name he never saw), or **stale**.
- **Stale** is read from the world as it is now (`rumour.stale`), never stored: a missed payment since made up, a refusal since turned into an arrangement, an arrest since released, a raided enterprise running again, a struggling shop back on its feet.
- **It changes behaviour, not only words:**
  - a man passing news to the player says how he knows it ("I saw it myself", "I had it from a man who was there", "Word is");
  - stale news is told as possibly settled;
  - a man doesn't report stale news up to his superior.
- **News climbs the hierarchy deliberately** (5A, reporting up). A shopkeeper's refusal reaches the collector, the collector tells his captain, and the player knows nothing of it unless someone tells him.

**Misinformation never touches what happened.** A wrong name lives on the believer's claim (`Claim.blame`) and in the grudges it causes, while the fact keeps its true actor. A test proves it.

**Save size:** no new stored records. Staleness is computed when read, and reports add one knowledge entry, which fades like any other.

**Tests** (`social/knowledge.test.ts`):
- the refusal-to-captain chain, with the player left out;
- the five kinds of knowing, including a believed name that leaves the truth unchanged;
- a missed payment going stale once paid;
- a witness telling the player he saw it.

### Increment 5C: the conversation

The conversation engine (`dialogue.ts`) was already the one engine for the player. Matters, negotiations, his reasons, the point in hand, the used-option rule and the no-repeated-lines rule all sit on the same records NPCs use. This increment reorganises what the player sees and how a conversation moves.

**The opening screen, in order:**
1. **What he brings up himself.** If he has come to you with something, he asks for a minute in his own manner ("A word." / "Got a minute? There's something I want to discuss." / "We need to talk. Now."). You choose how to take it:
   - **"Sure. What's going on?"** His matter becomes the subject.
   - **"Depends what it's about."** He tells you, and you still choose.
   - **"Can it wait?"** It waits, and he notices he had to.
   - **"Not right now."** He takes it as it sounds: trust and respect fall a little.
2. **On your mind.** What is real and pending between you, most pressing first, three at most and one row to the rest:
   - his requests;
   - your negotiations with him (Stage 4's purchases, loans, protection and runs included);
   - money owed either way;
   - the arrangement at his shop;
   - work he has offered you;
   - a lie of his you have since found out;
   - a word you broke;
   - a favour he owes you.

   It reads the records, so a debt paid is gone from it.
3. **Other subjects: five ways in, the same five with everyone, in the same order, each only when there is something in it.** The words fit who he is to you, and he answers before you go on.

| Way in | Said to a stranger / a friend / a superior / your own man / a shopkeeper | His answer, by temperament |
|---|---|---|
| Business | "Mind if I talk business with you?" / "Got something I wanna run by you." / "I wanted to discuss some business." / "We need to go over some business." / "I'd like to talk about your business." | "Sure. What've you got in mind?" / "Depends what kind of business." / "What is it?" |
| Socialize | "How are things?" / "How've you been keeping?" / "How are things with you?" | "Can't complain. You?" / "Could be better." (a man in trouble) / "Fine. Why?" |
| Ask about | "I wanted to ask you something." / "Can I ask you something?" / "Could I ask you something?" | "Ask away." / "Depends what you're asking." |
| Organization (only with a man in the life) | "Let's talk about the family." / "I wanted to talk about where I stand." / "Let's talk about the crew." / with another family, "Let's talk about how things stand between our people." | "What about it?" / "Sure. What do you need?" |
| Settle matters | "There's something we need to straighten out." / "We need to clear something up." / "There's something I need to raise with you." | "Go on. What is it?" / "What now?" |

4. **Leaving,** said to suit him: "I'll let you get on." / "That's all for now." / "I'll catch you later."

**How a conversation moves:**
- **Inside a way in:** only what belongs to it, every line something the player really means to say and do, and "Actually, something else".
- **Between subjects:** the player can go from how he is to a loan to his shop without leaving. Negotiations keep their point in hand across subjects, as they did.
- **The four everyday questions** are where they belong:
  - "How are you keeping?" under Socialize;
  - "How's business?" under Business;
  - "Heard anything?" and "What do you make of…?" under Ask About.

**The social club.** Its own conversation engine (scripted scenes, the player's scene topics and scene greetings, about 170 lines) is deleted. Sitting down with a man at the club is the conversation, opened there. The club keeps its identity: owner, hours, who is in, and who wants a word and why. A scene left open in an old save is closed when it loads.

**The encounter screen** (a request from Today) offers "Go and see him", so the request can be taken up in conversation with everything else between them.

**Tests:**
- `social/conversation.test.ts`:
  - the openings by relationship;
  - opening a way in, his answer, only what belongs to it, and moving between ways;
  - "On your mind" holding a debt until it's paid;
  - the approach and the four ways to take it, each with its consequence.
- **Rewritten for the new layout, testing the same rules:**
  - the menus test (the opening screen is short and ordered);
  - the first playtest (the everyday questions in their places);
  - the NPC-initiated playtest and regression (he asks for a minute first);
  - the used-option test.
  
  The playtest helper now chooses as a player does: if a line isn't on screen, it opens the way in that holds it.
- `saves/save-load.test.ts`: an old save with a club scene in progress loads cleanly.

**Checked in the browser.** With the player's own captain, the ways in read "I wanted to discuss some business", "How are things with you?", "Could I ask you something?", "I wanted to talk about where I stand", with "I'll let you get on" to leave and no "straighten out", because nothing stands between them. "Where I stand" was answered "What about it?" and offered "Where do I stand with you?", "Would you put in a word for me?", "Is there anything you need done?" and "I'm ready for more". At phone width there is no sideways scroll.
