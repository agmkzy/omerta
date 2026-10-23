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
