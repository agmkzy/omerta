# OMERTÀ: scope for improving the RPG (high level)

*The working list after the compelling-RPG stage (docs/rpg/REPORT.md). It folds in the October roadmap: V90 places, family HQs
and fronts; V91 The Living Ecosystem; V92 A Life. Phases 0–2 make the existing game good past hour five; 3–5 make it deep; 6
runs alongside. Every change keeps determinism and save compatibility, adds an experience test, and is judged by the governing
test: the number of meaningful things that can happen because of what everyone does.*

## Phase 0: Finish and harden what's live
- Deploy the pending wording fixes. Do a long live-site playthrough (60+ days) in the browser.
- Investigate and fix the save-size failure around day 60.
- Close the V85 playtest leftovers:
  - haggling with no reason accepts too easily;
  - ignored promises are penalised less than broken ones;
  - routine jobs push trust up too fast;
  - completed promises still show in memos;
  - a captain gives a generic reply to a beating.
- Make the test suite reliable under load or on an idle machine.

## Phase 1: The mid-game holds up
- **Simpler time controls.** The bar becomes four choices: **Morning**, **Evening**, **Sunday**, **Next week**.
  - Morning and Evening always mean the next one, and say so ("Evening · tomorrow").
  - Sunday shows its date and the envelope.
  - Next week stops early when someone comes to the player or something serious reaches him (replacing "Next event").
  - Anything with a set hour (a summons, a meeting, "after 10") carries its own "Go at 10:00" on its card (replacing "An hour").
  - Afternoon and "two days" go. The time engine itself is unchanged.
- **Locations overhaul (was V90: places, family HQs, fronts).** It goes with the time change: "where do I go this morning or
  tonight" becomes the day's main decision.
  - **Real places in real districts.** Each of the seven districts has its own places with hours and regulars: each family's club
    (its headquarters), bars, barbers, a diner, the docks, the church, card games and after-hours clubs, and the track. Today's
    three generic rooms go.
  - **Businesses as places.** Every business in the world can be seen, listed by district, and walked into. It shows who owns it,
    who it pays and how it is doing, as far as the player knows. Fronts: legitimate businesses used for cover and laundering.
  - **Routines with reasons.** Where a man is follows his life: his shop or work by day, his family's club in the evening, the bar
    if he drinks, the track if he gambles, church on Sunday, home late.
    - Full routines for every man in the life (all families) and every shop owner.
    - A simple one for any other civilian the player has met or who is part of a story.
    - Unknown civilians are anonymous regulars.
    - Routines stay a pure function of the man and the clock: deterministic, no new saved state.
  - **Being there is the action.** Arriving shows who is in and what is going on, and offers what can be done there: talk, wait for
    someone, listen in, lean on the owner, case it for a job. Approaches happen at a place.
  - **Territory you can feel.** Each district shows whose ground it is. Going onto another family's ground means being seen,
    noticed, and taking risk.
  - **A list, not a map,** organised by district and usable on a phone. A drawn map comes later (Phase 6).
- **Gambling, in period.**
  - **The track:** Aqueduct and Belmont, and Yonkers Raceway's harness racing. Fixed races, jockeys and drivers leaned on, bookies
    laying off, gamblers found on Saturday.
  - **Underground casinos:** card games, after-hours clubs and a floating dice game, extending today's blackjack and gambling clubs.
  - **The family's Las Vegas interest** (the skim) as an asset the player hears about and may one day touch.
  - Greyhound racing was not legal in New York in 1970, so there is no dog track.
- **Jail balance as a stopgap:** arrest odds, sentence lengths, how clearly heat is shown. A careful player should rarely be inside.
  Replaced by the police faction in Phase 3.
- **A soldier's season:** associates ask to run with you; your captain hands you a shop or a man; crew management that matters.
- **The road to captain,** measured and tuned like the road to soldier.
- **Captains with work to give:** they pass down their own needs instead of "nothing now".
- **Variety of tips and gigs;** fewer repeats.
- **Pacing:** decide the target rhythm of quiet and busy weeks and tune to it across many worlds.

## Phase 2: Make the stories visible
- A monthly Herald page of what happened in the player's corner of the city, about people he knows.
- A story view: every thread he is part of or has heard of, how it started, where it stands.
- Men with arcs (a gambler sinking, a loyal man souring, a shopkeeper standing up), told through scenes and talk.
- Late consequences: old slights, favours and skims that resurface months later.

## Phase 3: The Living Ecosystem (V91)
- **Family feuds as real conflicts.** Today family tension is only a number, and no boss ever decides on war.
  - Bosses decide, by temperament, strength and grievance: let it go, demand compensation, take it to the Commission, or retaliate.
  - Feuds run in phases: provocation, retaliation, open war (hits, hijacked trucks, taken places, men in hiding, mattresses),
    peace talks, and a truce that holds or breaks.
  - Wars cost both sides: earnings, men, police attention.
  - The Commission rules on what actually happened, with sides and favours. Its rulings are obeyed or defied, with consequences.
  - The player is drawn in by rank: a soldier fights, a captain decides for his crew, a boss decides for the family.
- **Bosses with real authority** inside the family: stop feuds, call sit-downs, order compensation, punish disobedience. Weak bosses
  lose respect.
- **Violence forces change:** settlement, injury, flight, arrest or a killing, instead of endless retaliation.
- **Whackings:** real motives, permission for made men, crises after unauthorised killings, failed attempts, permanent
  consequences. About 1–2 mob deaths per 60 days city-wide, emergent rather than a quota.
- **The police as a faction,** on the same organisation model as the families:
  - Commissioner, Chief of Detectives, precinct captains per district, lieutenants, detectives and patrolmen, each a full character;
  - investigations that persist, surveillance of places, charges, trials and sentences, replacing heat-meter arrests.
- **Corruption** (1970, the Serpico / Knapp year):
  - cops on the pad, paid from family treasuries through the ledger;
  - grass-eaters vs meat-eaters;
  - what bribes buy (warnings, lost files, lighter charges);
  - honest cops who build cases from bribe attempts, and a commission that can expose the pad.
- **The police chief's press briefing** after a major killing: what the police actually know (sometimes the wrong man), with
  consequences: witnesses, raids, suspects lying low.
- **Informants** from arrest pressure (charges, sentence, loyalty, whether the family looks after his family). Nobody automatically
  knows who talked. The player can be approached too.
- **Organisational change:** vacancies, contested succession, leaders running things from inside, families growing, shrinking or
  splitting; ambition that sometimes succeeds.
- **Men who adapt:** repeated failure changes tactics; reputation changes how people respond.
- **Information as currency:** sell, hold, trade or plant what you know; rumours spread and distort.

## Phase 4: A Life (V92)
- **Prison as a playable episode:**
  - a real population (every family, gangs, hidden informants), its own hierarchy and economy, guards as characters;
  - outside goes on without you: rackets decay, someone acts for you, you only know what visitors tell you;
  - detectives visit with offers; sentences change with lawyers and cooperation; prison friendships and enemies follow you out;
  - NPC leaders run crews from inside.
- **Personal dreams** that drive decisions (a Long Island house, the kids' college, a restaurant of his own, getting out). Not
  everyone wants to be boss.
- **People and private life:**
  - wives and goomahs as people with agency; marriage and divorce;
  - children who grow up and may follow you or refuse;
  - parents; friends outside the life (a childhood friend who became a detective);
  - ageing that changes how men operate; health and lasting injuries.
- **Secrets as real facts** (affairs, hidden money, gambling debts, police cooperation), discovered and used as leverage.
- **Money and possessions:**
  - houses, cars, dress and lifestyle as real money sinks and status signals; living above your station is noticed by the boss
    and the IRS;
  - hidden cash vs laundering through fronts;
  - weapons as traceable items, and a trade in them.
- **The wider underworld:**
  - drugs: the old guard's taboo against huge money, dealt in secret against the boss's rule;
  - street gangs as lighter organisations: buyers, deniable muscle, recruits, with their own motives.
- **Conflicting loyalties** from intersecting relationships, surfaced as real choices.
- **Endings:** retire, take the chair, turn witness, go legitimate, be killed, prison. Then an epilogue from the world's memory
  (the funeral, who came, the Herald's obituary), the city after you, and a next-generation run.

## Phase 5: Big moments
Set pieces built on knowledge and relationships:
- sit-downs and the Commission;
- the hit;
- the arrest and interrogation;
- weddings, christenings and funerals where business is done;
- the press briefing;
- a fixed race.

## Phase 6: Presentation and feel
- A drawn district map of the city over the locations list.
- Portraits that show rank through dress and change over time.
- Seasons, feasts and weather.
- A relationship web as the player knows it.
- Onboarding past the first week; phone layout polish.
