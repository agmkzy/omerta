# OMERTÀ: scope for improving the RPG (short list)

*The detailed version, with purposes, foundations, acceptance and sizes, is docs/rpg/SCOPE_OVERVIEW.md. This is the list at a
glance. It folds in the October roadmap (V90 places, V91 The Living Ecosystem, V92 A Life).*

## How we work
1. **The soldier's experience comes first:** a meaningful crew and authority system before widening locations or criminal activity.
2. **Conversational depth is a permanent workstream:** NPC reasoning, initiative and developing dialogue are objectives in every
   phase.
3. **Vertical slices:** one convincing example end to end before breadth (one investigation before a police faction, one racket
   before all of them, one score before a score engine, one district before seven).
4. **Player enjoyment is a release criterion:** working, passing tests and making the simulation busier is not enough. A slice that
   isn't enjoyable is reworked or cut, not widened.
5. **Keep the game playable:** stable increments, tested and deployed; no months-long rebuild.
6. **Keep testing actual gameplay:** long playthroughs every stage expose repetition, shallow decisions and broken progression.
7. **Keep systems interconnected:** every new mechanic influences existing characters, relationships, opportunities or
   consequences.

## Phase 0: Finish and harden
- Pending fixes live; a long live playthrough.
- The day-60 save problem.
- The V85 leftovers.
- A reliable test suite.

## Phase 1: The made man's life
1. **Time controls:** Morning, Evening, Sunday, Next week. Timed things carry their own "Go at" button.
2. **Crew and authority (the centrepiece):**
   - men come to be taken on; the captain hands him men and shops;
   - he gives them work they each do their own way, takes their envelopes, settles their quarrels, answers upstairs for them, and
     disciplines them;
   - their loyalty moves; the best want to be made;
   - mostly through conversation.
3. **The road to captain;** captains pass work down.
4. **One racket, the book,** run as a business with weekly decisions. Widened only once enjoyed.
5. **One score, the truck hijack,** played as tip → preparation → the moment → something sideways → after. Widened only once
   enjoyed.
6. **Breadth:**
   - more scores and rackets on the proven patterns;
   - gambling in period: the track, card and dice games, the Las Vegas skim;
   - locations: one district built properly, then all seven, with businesses as places.
7. **Who the player is:** background, the kind of man he is, his dreams. A clear end on death or a long sentence.
8. **Stopgaps and tuning:** jail balance, variety, pacing.

## Phase 2: Stories visible
- A monthly Herald page and a story view.
- Men with arcs.
- Consequences that come back months later.

## Phase 2b: UI redesign (after Phase 2; owner, 26 October)
The game has outgrown its screens: crew, the book, trucks and places arrive as cards under "Needs you" and "Opportunities", with
no pages of their own.
- **Audit first:** every screen against what the game now does, and what the player needs to see and decide in each.
- **Then the design:**
  - home pages for the crew, the book and rackets, and the street (Little Italy as a place, not a list);
  - a calmer "Needs you" that separates what demands an answer from what is merely on offer;
  - the time bar and the day's shape around the new controls;
  - the Herald and the stories as the way the world reaches the player.
- **Built on the existing component kit** (ui/kit.ts), phone first, keeping every save working.

## Phase 3: The Living Ecosystem
- **Feuds and authority:**
  - family feuds with causes, phases and endings;
  - bosses' authority;
  - violence that forces change;
  - whackings;
  - organisational change.
- **Law and pressure:**
  - **the police:** one convincing investigation first, then the faction with corruption, the press briefing and informants;
  - the Feds and RICO;
  - politics and the courts.
- **The wider world:**
  - the big rackets: unions, carting, the Fish Market, JFK cargo, contracts;
  - the wider underworld;
  - information as currency;
  - the neighbourhood.

## Phase 3b: Playing at the top
- Captain, underboss, boss.
- Becoming boss opens a new phase.

## Phase 4: A Life
- **Prison,** as one stretch inside first, then the full prison.
- **The man himself:** dreams, family and private life, ageing and health, secrets.
- **Money:** possessions and lifestyle, hidden money, weapons.
- **The wider trade:** drugs, street gangs.
- **Conflicting loyalties.**
- **Endings,** with an epilogue and a next generation.

## Phase 5: Big moments
- Sit-downs and the Commission.
- The hit.
- Interrogation.
- Weddings and funerals.
- The press briefing.
- A fixed race.

## Phase 6: Presentation (alongside)
- Map, portraits, seasons.
- Relationship web.
- Help, save slots, story export.
- The city's people in their 1970 mix.

## Release criteria (every stage)
1. **It works:** suite, build, saves.
2. **It integrates:** another system reads it and behaves differently.
3. **It is enjoyable:** a written browser playtest shows a decision the player cared about, an outcome worth retelling, or a moment
   he'd seek out again, and no new chore or dead stretch.
4. **The scorecard is no worse:** your five questions, over long runs.

Your verdict on playing it is the final gate.
