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

## Phase 1: The mid-game holds up

**Purpose:** make hours five to fifty as good as the first hour. This phase does the most for how the game feels.

### 1.1 Simpler time controls (S)
- The bar becomes **Morning**, **Evening**, **Sunday**, **Next week**.
  - Morning and Evening always mean the next one, and say so ("Evening · tomorrow").
  - Sunday shows its date and the envelope.
  - **Next week** stops early when someone comes to the player or something serious reaches him (replacing "Next event").
- Anything set for an hour (a summons, a meeting, "after 10") carries its own **Go at 10:00** on its card (replacing "An hour").
- Afternoon and "two days" go. The time engine is unchanged.
- **Done when:** every timed thing (summons, meetings, shop hours, night gigs, the induction) can be reached from the four buttons or
  its own card, and the browser playthrough never needs a finer step.

### 1.2 Locations overhaul (L; was V90: places, family HQs and fronts)
- **Real places in real districts.** Each of the seven districts gets its own places with hours and regulars: each family's club
  (its headquarters), bars, barbers, a diner, the docks, the church, card games and after-hours clubs, and the track. The three
  generic rooms go.
- **Businesses as places.** Every business can be seen, listed by district, and walked into. It shows who owns it, who it pays,
  and how it's doing, as far as the player knows (knowledge rules apply). **Fronts:** legitimate businesses used for cover and
  laundering.
- **Routines with reasons.** Where a man is follows his life: shop or work by day, his family's club in the evening, the bar if he
  drinks, the track if he gambles, church on Sunday, home late.
  - Full routines for men in the life and shop owners.
  - A simple one for civilians the player has met.
  - Unknown civilians are anonymous regulars.
  - Routines are a pure function of the man and the clock: deterministic, stable between looks, no new saved state.
- **Being there is the action.** Arriving shows who is in and what is going on, and offers what can be done there: talk, wait for
  someone, listen in, lean on the owner, case it. Approaches happen at a place.
- **Territory you can feel.** Each district shows whose ground it is. Another family's ground means being seen and noticed.
- **A list by district,** phone-friendly. A drawn map comes later (Phase 6).
- **Builds on:** places.ts, where.ts, clubdata.ts, the business records, travel times, districts.
- **Risk:** where everyone is changes, so who meets whom changes, and many test expectations will move. Do it in two steps: places
  and routines alongside the old rooms, then retire the old rooms.
- **Done when:** a player can find any man by knowing his habits; every business is visitable; approaches name where they happen;
  the long-run scorecard is no worse than baseline.

### 1.3 Scores you play (L)
- One engine for criminal jobs as a short played sequence:
  1. **The tip,** with a source that matters (an insider, or a setup).
  2. **Preparation,** optional and each step costing time or money: case it, get an insider, choose who comes, arrange the buyer,
     find out whose it is.
  3. **The moment:** three or four ways in, odds told as the player would judge them ("He'll fold", "It could go wrong"), opened
     or closed by preparation.
  4. **Something sideways, sometimes:** a patrol car, a hero, a partner who freezes. Abort, push or improvise.
  5. **After:** the fence, the split, what witnesses tell the police, the owner's protectors, the captain's end.
- **Scores:** truck hijack, warehouse, card-game stick-up, fixed race, insurance arson, bank messenger, plus today's burglary and
  scams moved onto the engine.
- **Builds on:** jobs.ts (approaches, resolve), gigs.ts, orders.ts, the ledger, facts and witnesses, heat, regard, fences and goods,
  crossdeal.ts.
- **Done when:** each score has at least three meaningfully different ways to play it; preparation changes the odds the player
  sees; every outcome leaves records the world reads later (a witness, a grudge, heat, money); a playtester can describe two
  different runs of the same score.

### 1.4 Rackets as businesses you run (L)
- Each racket gets staff, weekly decisions, problems, competitors and police attention:
  - **The book:** lay off or hold big bets; a winner you can't pay.
  - **Loans:** how hard to collect; whom to trust.
  - **Numbers:** a runner skimming; a big hit.
  - **Fencing:** what to take, and from whom.
  - **Protection:** who pays, who won't, who another family is courting.
- A screen for the player's businesses and rackets: what each earns, who works it, what's wrong, what needs a decision this week.
- **Builds on:** rackets.ts, econ.ts, books.ts, debts, protection, crew records.
- **Done when:** a soldier's week has at least one racket decision with consequences; problems arise from causes (a man's vice, a
  competitor, the police) rather than dice; money still balances in every audit.

### 1.5 Gambling, in period (M)
- **The track:**
  - Aqueduct and Belmont, and Yonkers Raceway's harness racing;
  - fixed races as a score, with jockeys and drivers leaned on and bookies laying off;
  - gamblers found on Saturday.
- **Underground casinos:** card games, after-hours clubs and a floating dice game, extending blackjack.ts and the gambling clubs.
- **The family's Las Vegas interest** (the skim) as a background asset, heard about and later touched.
- No dog track: greyhound racing was not legal in New York in 1970.

### 1.6 A soldier's season and the road to captain (L)
- Associates ask to run with a made man; his captain hands him a shop or a man; crew management that matters (their earnings,
  loyalty, trouble).
- The road to captain measured with the climber, as the road to soldier was. Vacancies, rivals for the seat, and the boss's choice.
- Captains pass down their own needs instead of "nothing now" (work.ts needsOf, extended upward).
- **Done when:** the climber, once made, gains a crew and a racket within a season, and reaches captain in a believable span in
  most worlds; a made man's weeks differ from an associate's.

### 1.7 Who the player is, and when it ends (M)
- **Backgrounds** that change how play starts and how men treat him (character creation exists; carry it through).
- **A reputation for what kind of man he is** (fair, cruel, greedy, loyal), separate from standing, read by NPC decisions.
- **His own dreams,** as NPCs have theirs.
- **Death and long sentences:** a clear end and an account of the life, before Phase 4's full endings.

### 1.8 Stopgaps and tuning (S–M)
- **Jail balance** until the police faction replaces heat-meter arrests: arrest odds, sentence lengths, how clearly heat is shown.
- **Variety:** more kinds of tip and gig, fewer repeats.
- **Pacing:** agree the target rhythm of quiet and busy weeks, then tune across many worlds rather than one.

**Phase 1 overall:** XL. Order: time controls → locations → scores and rackets together → gambling → the soldier's season →
identity → tuning.

---

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

### 3.3 The police faction (XL)
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

- **Prison as a playable episode (XL):**
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

| Order | Phase | Depends on | Size |
|---|---|---|---|
| 1 | 0: Finish and harden | — | M |
| 2 | 1.1 Time controls | 0 | S |
| 3 | 1.2 Locations | 1.1 | L |
| 4 | 1.3 Scores and 1.4 Rackets | 1.2 (places to case and run) | L + L |
| 5 | 1.5–1.8 Gambling, soldier's season, identity, tuning | 1.3–1.4 | L |
| 6 | 2: Stories visible | 1 | M–L |
| 7 | 3.1–3.2 Feuds, authority, violence | 1, 2 | L + L |
| 8 | 3.3–3.4 Police faction, Feds | 3.1–3.2 | XL + L |
| 9 | 3.5–3.8 Rackets, politics, underworld, neighbourhood | 3.3 | L–XL |
| 10 | 3b: Playing at the top | 3 | XL |
| 11 | 4: A Life | 3 | XL+ |
| 12 | 5: Big moments | 3, 4 as they land | L |
| — | 6: Presentation | alongside | M each |

Phases 0–2 make the existing game good past hour five. Phase 3 makes the world self-sustaining. Phases 3b and 4 make it a life.
Phase 5 makes it memorable.
