# OMERTÀ: full scope overview

*A detailed companion to docs/rpg/SCOPE.md. For each phase: what it is for, what it contains, what it builds on in today's code,
what it depends on, how we will know it is done, and its size and risk. Sizes are relative: S (days), M (one to two weeks),
L (several weeks), XL (a month or more).*

## The aim

OMERTÀ's end state, in your words: *a Mafia life simulator built around an emergent criminal career, where autonomous characters and
their relationships generate unique stories through the player's decisions and the evolving world.*

- **Setting:** New York, 1970.
- **The player:** one participant, not the centre.
- **No prescribed arc:** becoming boss opens a new phase rather than ending the game.

**The governing test** for every item below: *does it increase the number of meaningful things that can happen because of what
everyone does?* A state variable changing is not integration. A downstream system must read it and behave differently.

**The five pillars:**
1. A living autonomous society with recognisable causal chains.
2. An emergent criminal career.
3. Relationships that matter.
4. Authored choices with simulated consequences.
5. A different story every playthrough.

## How we work (owner's direction, 26 October 2026)

1. **The soldier's experience comes first.** A meaningful crew and authority system is delivered before weeks are spent widening
   locations or criminal activity. Breadth waits until the made man's life is worth living.
2. **Conversational depth is a permanent workstream,** not a phase that ends. NPC reasoning (why he says what he says), initiative
   (what he raises and seeks out unprompted) and dialogue that develops over a relationship are explicit objectives in every phase.
3. **Major systems are built as vertical slices.** One convincing example, end to end, before breadth: one police investigation
   before a police faction; one compelling racket before every racket; one score before a score engine for everything; one district
   of real places before seven. Breadth only follows a slice that works.
4. **Player enjoyment is a release criterion.** A feature is not finished because it works, passes its tests and makes the
   simulation busier. It is finished when playing it is enjoyable: it creates a decision the player cares about, an outcome worth
   retelling, or a moment he would seek out again. A slice that isn't enjoyable is reworked or cut, not widened. (How this is
   judged: see "Release criteria" under *Throughout*.)
5. **Keep the game playable.** Develop, test and deploy stable increments; never disappear into a months-long rebuild. Every
   stage ends with a working, deployed game.
6. **Keep testing actual gameplay.** A technically complete feature isn't necessarily an enjoyable one. Long-running playthroughs
   (the climber over 150+ days, browser playthroughs over weeks of game time) are run every stage to expose repetition, shallow
   decisions and broken progression.
7. **Keep systems interconnected.** Every new mechanic must influence existing characters, relationships, opportunities or
   consequences. A mechanic nothing else reads is not added.

## Where the game stands (26 October 2026)

**Live and working:**
- The deterministic simulation: three families plus civilians, utility AI by personality.
- The ledger.
- Knowledge as a mechanic.
- The rebuilt conversation engine.
- The coherence repair.
- **This stage's additions:**
  - a walkable road to being made (made men's work, backing, seats opening, the ceremony);
  - errands as decisions;
  - loyalty tested (a rival captain courting, a rival family's job);
  - the world noticing the player;
  - no blame for what lapses in jail;
  - conversation fixes found by play.

**Known weaknesses:**
- **The mid-game sags:**
  - jail eats a third to a half of a reckless player's time;
  - a made soldier gets the same kinds of work and talk as before;
  - captains often have nothing to give.
- **Places are not real:** three generic rooms, and businesses you can't walk into.
- **Families never fight unless the player starts it.** Family tension is a number, and the Commission's rulings ignore what
  actually happened.
- **Jobs are one choice and one roll.**
- **Stories exist but are hard to see.**

---

## Phase 0: Finish and harden what is live

**Purpose:** a clean base before anything new.

**Contents:**
- **Deploy pending work:** three small wording fixes are on the branch.
- **A long live-site playthrough** of 60+ days in the browser, to find what tests and the dev build miss.
- **The save-size failure around day 60.** First reported in the V85 playtest, never examined. Measure save growth over 180 days,
  find what grows without bound (facts, memos, ledger entries, pending items), and add pruning or compaction with a migration.
- **V85 playtest leftovers:**
  - haggling with no stated reason accepts too easily (encounters.ts `tipReply`);
  - ignored promises are penalised less than broken ones;
  - routine jobs push trust up too fast (the boss reaches about 0.99 trust by day 35);
  - completed promises still listed in memos;
  - a captain gives a generic reply to a beating.
- **A reliable test suite.** Full runs currently time out when the machine is idle or under parallel load. Settle on a chunked runner
  with sensible worker limits, so every deploy gets one clean full run.

**Builds on:** the existing tests, the climber tool, the browser helpers.

**Done when:** pending fixes are live; the live playthrough report is written and its issues fixed; a 180-day save loads and stays
under a stated size; the V85 list is closed; the suite passes in one command, unattended.

**Size and risk:** M. Low risk, though save compaction must be migration-safe.

---

## Phase 1: The made man's life

**Purpose:** make hours five to fifty as good as the first hour, starting with what it is to be a soldier with men under him.
Each part is a vertical slice that must be enjoyable before anything is widened.

### 1.1 Simpler time controls (S)
- The bar becomes **Morning**, **Evening**, **Sunday**, **Next week**.
  - Morning and Evening always mean the next one, and say so ("Evening · tomorrow").
  - Sunday shows its date and the envelope.
  - **Next week** stops early when someone comes to the player or something serious reaches him (replacing "Next event").
- Anything set for an hour (a summons, a meeting, "after 10") carries its own **Go at 10:00** on its card.
- Afternoon and "two days" go. The time engine is unchanged.
- Small and independent, so it goes first. It makes every later playtest quicker.

### 1.2 Crew and authority: the soldier's season (L, the centrepiece)
A made man has men, and his word means something to them. This is delivered, playtested and enjoyed before 1.4 onwards.
- **Getting a crew.**
  - Associates come to him to be taken on, for their own reasons: ambition, money, a debt, a cousin's word.
  - His captain hands him a man or a shop.
  - He can recruit, and turn men away.
  - Every man has a history the player can learn.
- **Running them.**
  - He gives them work (orders.ts): pickups, collections, a message, a watch. Each man does it his own way (behaviour by
    temperament: clean, skim, bungle, overdo it).
  - He is paid their envelopes, and decides what to pass up.
- **Authority, felt both ways.**
  - His men bring him their quarrels, debts, troubles and requests; he settles them, and how he settles them is remembered.
  - He answers upstairs for what they do: a man who beats the wrong shopkeeper is his problem with his captain.
  - Discipline: warn, fine, cut his share, have him roughed up, put him out. Each has consequences for loyalty and for what the
    crew thinks of him.
- **Loyalty that moves.**
  - Men grow loyal or resentful from how they're treated and paid.
  - A man may be courted by another crew, skim, talk to the police (later), or go over his head.
  - The best of them want to be made, and need him to put them forward.
- **Conversation is the medium.** Most of this happens in talk with his men, in their voices, with reasons. It is not a management
  screen. A small crew page shows only what he knows: who, what they earn him, what's wrong.
- **Builds on:** orders.ts (behaviour, workShift), crewlife.ts, career.ts and path.ts (sponsoring and proposing), recruitment in
  conv/acts, books.ts (envelopes), loyalty.ts, imposed.ts.
- **Done when:**
  - the climber, once made, has a crew within a season;
  - in a browser playthrough, a made man's weeks are visibly different from an associate's: men come to him, he decides, it
    matters;
  - at least three crew stories happen unprompted in 60 days (a skimmer caught, a quarrel settled, a man courted away);
  - a playtester enjoys running the crew and can retell what happened with one of his men.

### 1.3 The road to captain (M)
- Measured with the climber, as the road to soldier was: vacancies, rivals for the seat, the boss's choice, and the crew's
  record as the case for him.
- Captains pass down their own needs instead of "nothing now" (work.ts needsOf, extended upward).

### 1.4 One compelling racket (M; the vertical slice before 1.6)
- **One racket first: the book** (bookmaking). The player runs it with his crew:
  - taking bets through his men and their spots;
  - laying off or holding a big bet;
  - a winner he can't pay;
  - a runner skimming;
  - a rival book on his ground;
  - the cop who wants his envelope (a stopgap until Phase 3).
- **Weekly decisions with consequences,** problems from causes (a man's vice, a competitor, a lucky streak) rather than dice. The
  money balances in every audit.
- **Builds on:** rackets.ts, econ.ts, books.ts, the bookie hustle and its talk lines.
- **Done when:** a playtester wants to check on his book each week, and money, men and danger all flow through it.
  Then and only then: loans, numbers, fencing and protection on the same pattern (1.6).

### 1.5 One score you play (M; the vertical slice before 1.6)
- **One score first: the truck hijack,** played as a short sequence:
  1. **The tip,** whose source matters.
  2. **Preparation,** optional: case the route, get the driver in on it, choose who comes (his own crew from 1.2), arrange the
     fence, find out whose load it is.
  3. **The moment:** three or four ways in, odds told as the player would judge them, opened or closed by preparation.
  4. **Something sideways, sometimes:** abort, push or improvise.
  5. **After:** the fence, the split with his men, witnesses, the owner's protectors, the captain's end.
- **Builds on:** jobs.ts, gigs.ts, the ledger, facts and witnesses, heat, goods and fences.
- **Done when:** two playthroughs of the same hijack play out differently because of choices; a playtester describes it as a
  moment, not a menu. Then the engine is widened (1.6).

### 1.6 Breadth, once the slices are good (L)
- **More scores** on the proven engine: warehouse, card-game stick-up, fixed race, insurance arson, bank messenger; burglary and
  scams moved onto it.
- **More rackets** on the proven pattern: loans, numbers, fencing, protection.
- **Gambling in period:**
  - the track (Aqueduct, Belmont, Yonkers Raceway's harness racing, fixed races);
  - underground card and dice games;
  - the family's Las Vegas skim as a background asset;
  - no dog track (greyhound racing was not legal in New York in 1970).
- **Locations overhaul (was V90), as a slice first:**
  - one district (Little Italy) built properly: real places with hours and regulars, every business visitable, routines with
    reasons, being there as the action, approaches at a place, whose ground it is;
  - then the other six, once it plays well;
  - routines are a pure function of the man and the clock (no new saved state); a list by district, not a map;
  - risk: who meets whom changes, so do it alongside the old rooms before retiring them.

### 1.7 Who the player is, and when it ends (M)
- **Backgrounds** that change how play starts and how men treat him.
- **A reputation for what kind of man he is** (fair, cruel, greedy, loyal), read by his crew above all.
- **His own dreams.**
- **Death and long sentences:** a clear end and an account of the life.

### 1.8 Stopgaps and tuning (S–M)
- **Jail balance** until the police replace heat-meter arrests.
- **Variety:** more kinds of tip and gig, fewer repeats.
- **Pacing:** agree the target rhythm, then tune across many worlds.

**Phase 1 overall:** XL. Order: time controls → crew and authority (playtested to enjoyment) → road to captain → one racket and one
score (each playtested) → breadth → identity → tuning.

## Phase 2: Make the stories visible (M–L)

**Purpose:** the world already generates stories; the player should be able to see and follow them.

- **A monthly Herald page:** what happened in the player's corner of the city, about people he knows, in the street's version.
- **A story view:** every thread he is part of or has heard of, how it started, who is involved, where it stands.
- **Men with arcs:** a gambler sinking, a loyal man souring after being passed over, a shopkeeper finally standing up. These come
  from existing problems, ambitions and grudges, and are told through scenes and talk.
- **Late consequences:** slights, favours and skims that come back months later (the humiliated man is now a captain; the
  shopkeeper you helped testifies for you; a skim surfaces in an audit).
- **Builds on:** the Herald, the journal, facts and stories, memory.ts, pursuits, situations.
- **Done when:** the scorecard improves on "memorable NPCs" and "delayed consequences"; a playtester can retell three stories from a
  run without prompting.

---

## Phase 3: The Living Ecosystem (V91)

**Purpose:** a world that resolves conflict as well as creating it, with the institutions that pressed on the real families.

### 3.1 Family feuds as real conflicts (L)
- Bosses decide, by temperament, strength and grievance: let it go, demand compensation, go to the Commission, or retaliate.
- Feuds run in phases: provocation → retaliation → open war (hits, hijacked trucks, taken places, men in hiding) → peace talks →
  a truce that holds or breaks.
- Wars cost both sides: earnings, men, police attention.
- The Commission rules on what actually happened, with sides and favours. Its rulings are obeyed or defied.
- The player is drawn in by rank.
- **Builds on:** family tension, politics.ts commissionTick, sit-downs in meetings.ts, violence.ts, orgs.ts.

### 3.2 Authority, violence and change (L)
- Bosses with real authority inside the family: stop feuds, call sit-downs, order compensation, punish disobedience.
- Violence forces change: settlement, injury, flight, arrest or a killing.
- **Whackings:** motives, permission, crises after unauthorised killings, failed attempts. About 1–2 mob deaths per 60 days
  city-wide, emergent.
- **Organisational change:** vacancies, contested succession, leaders running things from inside, families growing, shrinking or
  splitting.
- Men who adapt their tactics.

### 3.3 The police: one investigation first, then the faction (L, then XL)
- **The slice: one convincing investigation.**
  - A detective with a temperament takes one serious crime the player or his crew committed.
  - He works it from what can actually be known: witnesses, a car seen, a man with a grudge, a pawned watch.
  - He leans on the weakest man for an informant, and visits the player.
  - It ends in an arrest, a trial, a deal, or a case that goes cold, each with consequences.
  - The player can fight it: alibis, a lawyer, a witness persuaded, a bribe that may backfire.
  - **Done when:** a playtester feels hunted, makes choices about it, and can retell the case.
- **Then the faction,** on the slice's proven pattern:
  - **Ranks:** Commissioner, Chief of Detectives, precinct captains per district, lieutenants, detectives and patrolmen. Each a full
    character.
  - **Policing:** persistent investigations, surveillance of places, charges, trials and sentences. This replaces heat-meter arrests
    and retires the Phase 1 stopgap.
  - **Corruption:**
    - the pad, paid through the ledger;
    - grass-eaters vs meat-eaters;
    - what bribes buy;
    - honest cops building cases;
    - a Knapp-style commission (1970: Serpico).
  - **The chief's press briefing** after a major killing: only what the police know, and with consequences.
  - **Informants** from arrest pressure. Nobody automatically knows who talked; the player can be approached.

### 3.4 The Feds and RICO (L)
- The FBI as its own institution (the Organized Crime Control Act, October 1970):
  - long cases, wiretaps and bugs in clubs and cars;
  - informants cultivated over years;
  - pressure on families as organisations.

### 3.5 The rackets that made the money (L)
- Unions and labour (the docks, construction, Teamsters trucking), garbage carting, the Fulton Fish Market, the garment district,
  JFK cargo, concrete and city contracts.
- These are where families cooperate and compete, built on the Phase 1.4 racket engine.

### 3.6 Politics and the courts (M)
- Judges, district attorneys, councilmen, ward bosses, elections. A fixed case, a zoning favour, a contract.

### 3.7 The wider underworld (L)
- The Irish Westies in Hell's Kitchen, Harlem's numbers bankers and the heroin trade, Jewish and Puerto Rican organisations,
  Chinatown's tongs.
- Each on the organisation model, with territory and alliances.

### 3.8 Information and the neighbourhood (M)
- **Information as currency:** sell, hold, trade or plant what you know; rumours spread and distort.
- **The neighbourhood as a public:** the feast of San Gennaro, the priest, charity, the neighbour who sees things, a street that
  protects you or gives you up; the Italian-American Civil Rights League (1970).

**Phase 3 overall:** XL+. Feuds and authority first; the police faction next (it replaces the jail stopgap and feeds informants);
then the Feds, rackets, politics, the underworld.

**Done when:** in long runs, feuds start from causes, escalate and end in different ways; the police arrest people for things they
can prove; informants appear under pressure; deaths fall in the agreed band; and the scorecard improves on "the world changing
without the player".

---

## Phase 3b: Playing at the top (XL)

**Purpose:** becoming boss opens a new phase.

- **Captain:** run a crew, assign work (orders.ts), settle quarrels, answer upstairs, recruit and propose men.
- **Underboss:** the family's day-to-day, its disputes and money.
- **Boss:** family policy, the Commission seat, war and peace, the treasury, the pad, choosing captains and a successor; plots
  against him.

**Depends on:** Phase 3's feuds, authority, police and rackets. A boss with nothing to decide is not a phase.

---

## Phase 4: A Life (V92)

**Purpose:** give money somewhere to go and risk something to lose.

- **Prison as a playable episode (XL; slice first: one stretch inside, a few weeks with a cellmate, a guard, a visitor and a
  crew outside that may hold or fall apart, before the full population and economy):**
  - a real population, its own hierarchy and economy, guards as characters;
  - outside goes on without you, and you know only what visitors tell you;
  - detectives with offers; sentences that change; prison bonds that follow you out;
  - NPC leaders running crews from inside.
- **Personal dreams** that drive decisions. Not everyone wants to be boss.
- **Private life:** wives and goomahs with agency, marriage and divorce, children growing up, parents, friends outside the life,
  ageing that changes how men operate, health and injuries.
- **Secrets as real facts,** discovered and used as leverage.
- **Money and possessions:** houses, cars, dress and lifestyle as money sinks and status signals, noticed by the boss and the
  IRS; hidden cash vs laundering; weapons as traceable items.
- **The wider trade:** drugs (taboo against money); street gangs as buyers, muscle and recruits.
- **Conflicting loyalties** from intersecting relationships, as real choices.
- **Endings:** retire, take the chair, turn witness, go legitimate, be killed, prison. Then an epilogue from the world's memory and
  a next-generation run.

**Builds on:** life.ts (partner, wedding, christening), Character.problem and want, the ledger, Phase 3's police and informants.
Suggested order: ageing, health and family → houses, lifestyle and hidden money → cars and weapons → gangs → drugs → prison →
endings.

**Size:** XL+.

---

## Phase 5: Big moments (L)

Set-piece scenes built on knowledge and relationships, where what the player knows and who he has on side decides the outcome:
- sit-downs and the Commission;
- the hit (choose the place, who comes, what goes wrong);
- the arrest and interrogation (the questions use what the police actually know);
- weddings, christenings and funerals where business is done;
- the press briefing;
- a fixed race.

The made-man ceremony is the model.

---

## Phase 6: Presentation and feel (runs alongside)

- A drawn district map over the locations list.
- Portraits that show rank through dress and change over time (already requested).
- Seasons, feasts and weather (Christmas envelopes, summer feasts, a blizzard closing the docks).
- A relationship web as the player knows it.
- Onboarding past the first week; in-game help for the world's terms.
- Multiple save slots; exporting a story to share.
- The city's ordinary people in their 1970 mix, and women beyond wives.
- Phone layout polish. Sound, if ever.

---

## Permanent workstream: conversational depth

Not a phase: an objective in every phase, reviewed at every release.
- **NPC reasoning.**
  - Every answer has a reason the man could give, grounded in what he knows, wants and fears.
  - Counteroffers say why.
  - Refusals name what would change his mind.
- **Initiative.**
  - Men raise things unprompted: news that bears on the player, a favour they need, a worry, a proposal, a warning.
  - They seek the player out for their own reasons, and say what they came for.
- **Developing dialogue.**
  - What men say changes with the relationship and history: from guarded to open, from formal to familiar, from friendly to cold.
  - Old events are remembered in their words.
  - No line twice; no question answered before it is asked.
- **Every new system speaks.** Crew, rackets, scores, police, feuds and family life each arrive with their talk: what men say about
  them, ask about them, and bring to the player.
- **How it is checked:**
  - the walker and repetition checks extended to each system;
  - a conversation playtest at every release, read as a player reads it, with the jarring lines fixed before shipping.

## Release criteria

A stage ships when:
1. **It works:** the full suite passes, the build is clean, and saves are compatible.
2. **It integrates:** what it changes is read by another system that behaves differently. A variable changing is not integration.
3. **It is enjoyable.** A browser playtest of the stage, written up, answers yes to at least one, with an example from play:
   - did it create a decision the player cared about?
   - an outcome worth retelling?
   - a moment he would seek out again?
   
   It also answers no to: did it add a chore, a dead stretch, or a screen to click through?
4. **The scorecard is no worse,** and improved where the stage aims to improve it.

A stage that works but isn't enjoyable is reworked or cut, not widened. Your verdict on playing it is the final gate.

## Throughout: how we know it got better

- **The scorecard.** Each phase is accepted against your five questions, measured with the long-run harness
  (src/tests/tools/longrun.ts, docs/baseline/) and player-driven playtests, compared to the previous baseline:
  1. memorable NPCs;
  2. unexpected developments;
  3. delayed consequences;
  4. the world changing without the player;
  5. dead stretches.
- **Tools.**
  - The climber, extended for each new road: the soldier's season, captain, boss.
  - Browser playthroughs after each stage.
- **Writing at scale:** voice sheets in all eight voices, the walker and repetition checks for every new system, no line shown twice.
- **A performance budget:** save size, simulation speed and phone performance over multi-year runs.
- **Determinism and save compatibility:** a migration and a fixture whenever the schema changes; no `Math.random`, no wall clock.
- **One door per mechanic:** new systems write through existing doors (ledger, facts, regard, favours). No parallel copies.

## Suggested order and dependencies

| Order | Stage | Depends on | Size |
|---|---|---|---|
| 1 | 0: Finish and harden | — | M |
| 2 | 1.1 Time controls | 0 | S |
| 3 | **1.2 Crew and authority** (playtested to enjoyment) | 1.1 | L |
| 4 | 1.3 Road to captain | 1.2 | M |
| 5 | 1.4 One racket (the book) · 1.5 One score (truck hijack) | 1.2 | M + M |
| 6 | 1.6 Breadth: scores, rackets, gambling, locations (one district, then all) | 1.4, 1.5 enjoyed | L |
| 7 | 1.7–1.8 Identity, stopgaps, tuning | 1 | M |
| 8 | 2: Stories visible | 1 | M–L |
| 9 | 3.1–3.2 Feuds, authority, violence | 1, 2 | L + L |
| 10 | 3.3 One investigation, then the police faction; 3.4 the Feds | 3.1–3.2 | L → XL |
| 11 | 3.5–3.8 Rackets, politics, underworld, neighbourhood | 3.3 | L–XL |
| 12 | 3b: Playing at the top | 3 | XL |
| 13 | 4: A Life (playable prison as its own slice first) | 3 | XL+ |
| 14 | 5: Big moments | 3, 4 as they land | L |
| — | Conversational depth | every stage | permanent |
| — | 6: Presentation | alongside | M each |

Phases 0–2 make the existing game good past hour five, with the made man's crew at its heart. Phase 3 makes the world
self-sustaining. Phases 3b and 4 make it a life. Phase 5 makes it memorable.
