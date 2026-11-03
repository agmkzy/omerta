# Schedules: one answer to where everyone is

**Status:** proposed 3 November 2026, for the owner's review. Not built. Nothing here is decided except what is listed under
[Already decided](#already-decided). Every real choice is marked **Choice** with a recommendation, and all of them are
collected under [Choices](#choices) to take one at a time.

**Read with:** the [character design](../character/README.md) (the cast), its [glossary](../character/glossary.md) (every word
used here keeps its meaning there; new words are under [Words](#words)), the [mapping of the game's
schedules](../character/game-schedules.md), whose nine questions this answers, and the [mapping of the game's character
fields](../character/game-mapping.md).

## In short

- **One function.** `whereabouts(cast, id, t)` says where a character is and what they are doing at minute `t`. Everything
  that asks "who is here?", "can he be seen?", "who saw it?", "who spent time together?" or "where can I find him?" is built
  on it, in the simulation and on the screens alike. Nothing else decides where anyone is, and nothing writes a location.
- **Two stored things, one worked-out thing.** Each character holds their **arrangements** (home, waking hours, work, and
  the places they go in their free time, their **haunts**), changed only with a recorded cause, and their **stints** (spans
  of time recorded because something was chosen or imposed: an action under way, an appointment, custody, a rest). Their
  **routine**, the timetable of an ordinary day, is worked out from the arrangements, the places' opening hours and the
  clock. So nothing is saved minute by minute, and the answer is the same however often it is asked.
- **Precedence:** dead, then a stint, then on the way back from one, then the routine (asleep, then work, then a haunt, then
  home). At most one stint covers any minute of a character's time, so there is never a second answer.
- **The past is fixed.** Nothing can be booked, cut short or rearranged before the cast's clock, so where someone was
  yesterday never changes, which is what alibis and witnesses need.
- **Chance without dice.** Which haunt someone goes to on a given evening is a stable draw from the world's seed, the
  character, the day and the part of the day. Asking costs no randomness and gives the same answer every time.
- **Witnesses are whoever is there.** A fact happens at a place; those present and available see it, and for a quiet one,
  those who notice it (the ambush rule: the actor's Stealth roll against each one's passive Notice).
- **It lives in the cast.** Places on the cast record, arrangements and stints on each character's record. The code goes in
  `src/overhaul/schedules/`, as pure rules the cast uses.

## Why

The [mapping](../character/game-schedules.md) found four answers to "where is he now?". There are at least six, and they
disagree (see [Corrections to the mapping](#corrections-to-the-mapping)):

| Answer | Where | What it decides |
| --- | --- | --- |
| His district | `c.district` | Witnesses, travel, who drinks at the crew's bar: wherever he last did something |
| His routine | `city.ts` `routine` | Screens, encounter scenes: Little Italy only |
| The club | `clubdata.ts` `clubPresent` | Screens, the club scene: chance by rank, per three hours |
| The older rooms | `places.ts` `present` | Screens: a 30% chance per four hours for men of the player's family, ignoring sleep |
| Whether he is busy | `jobs.ts` `activityOf` | Who can be given work, who goes to see whom (`intent.ts`), screens |
| Whether he can be seen | `meetings.ts` `available` | Meetings, someone sending for the player |

Measured on the game at this commit (seeds 3, 7 and 11, 30 days each, no player actions; the script ran outside the
repository):

| Measure | Result |
| --- | --- |
| Facts recorded at the minute of the daily tick (9:00) or the weekly tick (Sunday 20:00) | 540 of 743 (73%) |
| Facts whose actor was asleep by his own hours at that minute | 336 of 743 (45%) |
| Witnessings by someone asleep by his own hours | 218 of 860 (25%) |
| Characters whose district had changed after 30 days | 191 of 487 (39%) |

So most of what happens in the world happens at two minutes of the day and week, nearly half of it done by men who are
asleep, and four in ten characters have, as far as the simulation knows, moved house within a month. The design principle "one world" needs
one answer, and the overhaul's rule that witnesses must be available would refuse a quarter of the game's witnesses as they
are chosen now.

## Already decided

Treated as constraints, not reopened here:

- The overhaul replaces the game's systems in one sweep after a shadow run, as a clean break: no game character or save comes
  across.
- The overhaul's code imports nothing from the game, the lab or any package. Seeded randomness only, no wall clock, time in
  minutes. The same seed and the same actions give the same history.
- One character type for the player and everyone else, with no player flag. Any difference for the player is deliberate and
  named.
- Rank is detached from attributes, skills, training and the proficiency bonus, and follows what a character does.
- Someone asleep by their own hours is unavailable, as someone resting is; so are the dead and those in prison. Sleep does not
  heal by the 8-hour resting rule; healing over time is its own future rule.
- `cast.together(people, { now })`: people who spent time together meet, and nothing else changes. Having met is what lets
  two characters deal with each other.
- Witnesses to a fact must be available. Characters know only what they witnessed or were told, with provenance.

## The design

### One function

```ts
interface Whereabouts {
  readonly activity: Activity;   // what they are doing (table below)
  readonly place?: PlaceId;      // where they are; none on the way, or when dead
  readonly toward?: PlaceId;     // where they are going, while on the way
  readonly from: number;         // since when this has been so
  readonly until: number;        // until when it is expected to stay so
  readonly stint?: StintId;      // the stint it comes from, if any
}
```

`whereabouts` is total (it answers for every character at every minute) and single-valued. It is worked out, in this
order:

| Order | When | Activity | Place | Available |
| --- | --- | --- | --- | --- |
| 1 | They are dead | dead | none | No |
| 2 | A stint covers the minute | on the way, then the stint's activity: doing something, resting, in custody, in hospital | The stint's place | By kind (see [Stints](#stints)) |
| 3 | A stint has just ended and they are not yet back where their routine has them | on the way | none | Yes, but present nowhere |
| 4 | Their hours say they are asleep | asleep | Home | No |
| 5 | A work shift covers the minute | working | Their workplace | Yes |
| 6 | A haunt was drawn for this part of the day and covers the minute | out | The haunt | Yes |
| 7 | Otherwise | at home | Home | Yes |

**Available** is still "able to take part", now: alive, conscious, not resting, not asleep, not in custody. **Present** is
being at a place. Anything done in person (a roll between two people, a telling, paying, giving, a fight, witnessing,
spending time together) needs everyone in it to be both available and present at the same place.

### What is stored and what is worked out

| Thing | Stored or worked out | Where | Changed by |
| --- | --- | --- | --- |
| Places, districts, opening hours | Stored | The cast record | Opening or closing a place, with a time |
| Travel time between districts | A rules table, in code | `schedules/places.ts` | A code change |
| Home, hours, work, haunts | Stored, each version with the time it began | The character's record | `arrange`, with a cause |
| The routine (the timetable of a day) | Worked out | Nowhere | Follows from the above |
| Stints | Stored | The character's record | `book`, `cut`, with a cause where imposed |
| Whereabouts, presence, availability | Worked out | Nowhere | Follows from the above |
| The world's seed for stable draws | Stored | The cast record | Set when the cast is made |
| The cast's clock (the latest time any change was made at) | Stored | The cast record | Every change given a `now` |

**Choice C1, where places live.** Recommended: on the cast record, so a cast is one record of everyone and everywhere they can
be, and `whereabouts` needs nothing passed alongside it (a separate city record could be passed with the wrong cast, giving a
second answer). The alternative is a separate city record passed with the cast.

**Choice C2, where stints live.** Recommended: on each character's record. A stint is one person's time, so it belongs to them
(one record per thing); availability can then be read from the character's own record, as `assertAvailable` reads it now;
and a booking copies only that character's short list, while the cast shares every unchanged character. The alternative is
one list on the cast, which every booking would copy whole.

### Places

A **place** is somewhere a character can be: a home, a shop, a bar, a café, a restaurant, a club, a church, the racetrack, the
street of a district, the prison, a hospital.

| Field | Meaning |
| --- | --- |
| `id`, `name`, `kind` | Its id, its name, and its kind from a fixed list |
| `district` | One of the game's seven districts |
| `hours` | When it is open to customers, by weekday, as minute ranges that may pass midnight. Homes, streets, the prison and hospitals are always open |
| `access` | Public (anyone may be there) or private (a home, a club's back room): who goes to a private place is decided by arrangements and stints, which the game sets from its own records such as family membership |
| `opened`, `closed` | When it opened and closed, so it is open or not at any past time |

- **Opening hours** keep the game's trade table (`city.ts` `HOURS`, `SUNDAY_OPEN`): bars from mid-afternoon until 3 in the
  morning, ordinary shops nine to seven and shut on Sundays, and so on. The routine never puts a customer in a closed place.
  Stints are not bound by opening hours, since a break-in is at a closed shop by design (Choice C13).
- **Travel** is by district: 10 minutes within one, 35 between two, as in the game (`core.ts` `travelTime`). It is a table so
  that it can be refined (Staten Island is further than Little Italy from the Bronx). **Choice C12:** keep the game's two
  numbers until the shadow run agrees, then refine.
- **Homes:** one place for each household. Who lives there is worked out (everyone whose home it is), not stored a second
  time.
- **Businesses:** at the swap, each of the game's businesses is a place. The game keeps the business's economic record
  (cash, revenue, owner, protection), keyed by the same id, as it keeps rank keyed by a character's id.
- **The street** of each district is a public place, always open, for anything that happens outdoors.

### Arrangements

What a character's ordinary life is made of. Stored on the character record as a list of versions, each with the time it
began, so the routine at any past minute is worked out from the version then in force.

| Part | What it holds |
| --- | --- |
| **Home** | A home place |
| **Hours** | When they wake and when they go to sleep, as minutes of the day; going to sleep may pass midnight |
| **Work** | Optional: a workplace and its shifts (weekdays, from, until) |
| **Haunts** | Places they go in their free time: each with its weekdays, its window (from, until) and a chance (0 to 1) of going in a part of the day it fits |

The first version is made with the character. A new one is made by `cast.arrange(id, change, { now, cause })`: taking a
job, moving house, being barred from a bar, starting to hold court at the club. The cause is a fact or a job, so every
change of routine has a recorded reason (invariant D).

**What sets someone's hours** is the character and their life, never rank. When a character is made, a rule (starting values,
to tune with the shadow run) sets them:

| Source | Effect on hours |
| --- | --- |
| Default | Awake 7:00 to 23:00 |
| Work | Awake at least an hour before the earliest shift, asleep no earlier than 30 minutes after the latest |
| Haunts | Asleep no earlier than the end of the latest window they keep (a club open until 2 in the morning) |
| Vice high | Asleep an hour later |
| Sociability high | Asleep an hour later |
| Caution high | Awake half an hour earlier |
| A child in the household | Awake by 7:30 |
| Length | Between 6 and 9 hours asleep; waking moves to fit |

So a member of a crime family who spends his evenings at the club keeps late hours because of what he does, as rank follows
what a character does. A porter on a 4 a.m. shift is up at 3. The rule reads no rank; it cannot, since the overhaul has none.

**Haunts** are chosen when a character is made, from their temperament, background and what is near their home: a café for
the sociable, a bar for a drinker, church on Sunday mornings for the gentler and more compassionate, the track on Saturday
afternoons for a gambler, the family club for its members (passed in by the game). **Choice C4:** stored, as recommended,
so a deliberate change (barred from a bar) has a cause; the alternative, worked out from current traits each time as the
game's routine is, changes everyone's habits silently as traits drift. Haunts following drifting traits is left for a later
weekly rule that records its changes.

### The routine

A character's **day** runs from their waking to their next waking, so a night out past midnight is part of the day it began
in. The timetable of a day is worked out in three steps:

1. **Asleep** from going to sleep until waking, at home.
2. **Work:** on a work day, each shift at the workplace.
3. **Free time:** the rest of the waking day, split into four **parts of the day** (morning to 12:00, afternoon to 18:00,
   evening to 22:00, late until sleep; starting values). For each part, the haunts that fit it (right weekday, window
   overlapping, place open) are candidates. One stable draw for the character, the day and the part picks one by its
   chance, or none with what is left over (chances adding to more than 1 are scaled down). The haunt fills the part where
   its window and opening hours allow; the rest of the part is at home. A second draw delays arrival by 0 to 45 minutes, so
   regulars do not all walk in on the hour (starting value).

Between two consecutive pieces at different places, the later one begins with the travel time spent on the way. The
timetable is the game's routine (`city.ts`) made general: every district, every character, with work and haunts instead of
rules written for one district.

**Chance, kept stable.** A **stable draw** is a number from 0 to 1 worked out by hashing the world's seed with the keys
(character, day, part of the day). It is pure: the same keys give the same number, before or after anything else happens,
and reading it consumes nothing. The game's `witnessesAt` draws from the shared random stream, so merely asking who is there
changes later dice; the club and the older rooms already hash, per three or four hours. This keeps the hashing and makes it
the only way.

### Stints

A **stint** is a span of one character's time, recorded because something was chosen or imposed, which overrides their
routine.

| Field | Meaning |
| --- | --- |
| `id` | From the cast's counter, as facts and jobs are |
| `kind` | One of the kinds below |
| `doing` | What they are doing, in words the caller gives ("collecting a debt"), as a job's kind is |
| `place` | Where |
| `from`, `until` | When it starts (they leave) and when it ends |
| `endedAt` | Set when it is cut short; equal to `from` when it is called off before it starts |
| `occasion` | Optional: shared by stints booked together for one purpose (a crew's gathering), one per person |
| `cause` | The fact, job or stint that led to it; required for kinds imposed on someone |
| `bookedAt` | When it was booked |

| Kind | Sleep | Available | Imposed |
| --- | --- | --- | --- |
| Activity (an action, a visit, an appointment, a shift called in for, waiting) | Kept awake | Yes, at the place | No |
| Rest | Resting instead | No | No |
| Custody (held by the police, or in prison) | Unavailable either way | No (decided) | Yes |
| Hospital | By their hours | To be set with the healing rule | Yes |

- **Travel is part of the stint.** They leave at `from` and arrive after the travel time from where they were just before; it
  is worked out, not stored, so it always agrees with what came before. A booking that would leave any of their stints with
  no time at its place is refused.
- **Booking:** `cast.book(id, stint, { now })`. Refused if it starts before the cast's clock, or overlaps another of their
  stints that has not been cut short.
- **Imposed kinds cut short what they overlap:** an arrest at `now` books custody, ends any stint under way at `now`, and
  calls off any later one it covers, each with the arrest as its cause. So "he missed the sit-down because he was arrested"
  is on record, and the game can act on it.
- **Cutting short:** `cast.cut(stint, { now, cause })`, at or after the clock.
- **A stint overrides sleep,** except a rest: a night job keeps someone up. Making up lost sleep is left for the clock rules.
- **Opening hours do not bind a stint** (Choice C13).
- **Not a job.** The overhaul's job is people doing something together with a plan, open until ended; the game's job is a
  task with pay and an expiry. Neither is a span of time somewhere. Doing the job is one or more stints whose cause is the
  job. Being "on a job" for days (the game's `activityOf`) is a commitment, not a whereabouts.

**Choice C3, rest as a stint.** Recommended: a rest becomes a stint of kind rest, at the place where it is taken, replacing
the condition's single stored `rest` (migrated as a rest at home). One record for a span of time spent somewhere; the resting
rule (8 hours restores full health) is unchanged until the healing rule replaces it. The alternative keeps `condition.rest`
and has `whereabouts` read it as a special case.

### Chosen actions and the clock

There must never be a moment with two answers, so everything that moves anyone goes through stints:

1. **Decisions.** An NPC decides at waking, when a stint ends, and at each boundary of their routine. A decision either
   follows the routine, booking nothing, or books a stint from `now`. **Choice C5:** this cadence, recommended, so the routine
   is what fills a day and decisions are departures from it; the alternative keeps the game's (a decision every 15 to 90
   minutes while awake, `engine.ts` `think`), with the routine filling only the gaps. The game's `work` and `wait` actions
   become the routine; what `work` paid (errands, a shop's takings) is credited from time spent at work.
2. **Resolving on arrival.** The action happens when they arrive, not when they decide. The game queues an event at the
   arrival time, and resolves it against the world as it then is: is the person they went to see there and available? who
   is present to see it? A man not there is a man not found. Facts are dated when they happen.
3. **The player** books a stint for every action that costs time, from where they are; waiting is a stint where they are.
   The game advances the clock to the arrival, then resolves the action. This is a deliberate difference only in who
   chooses: the player's choices cover all the time they spend, so their routine applies only to time nothing they chose
   covers, which in play is none. Their arrangements still give them a home and hours that others can know.
4. **Appointments** (a sit-down, the crew's gathering, Sunday envelopes) are stints booked ahead. When their time comes, the
   game resolves them with whoever is there.
5. **Imposed** spans (custody, hospital) cut short what they overlap, with their cause.
6. **The past is fixed.** Every change to the cast is given `now`, and none can be made before the cast's clock: no stint
   booked or cut, no arrangement changed, no fact recorded, in the past. **Choice C11:** one clock for the whole cast,
   recommended (invariant I in one rule), which makes the existing transfer, fact and job orderings one rule; the
   alternative applies the clock to schedules only.
7. **Nothing else moves anyone.** No code writes a location; there is none to write.

### Who is present, answered cheaply

The game has 165 characters at the start (seed 3), 45 businesses and seven districts, and asks "who is here?" many times a
minute of game time (32 callers of `witnessesAt`, every screen of a place). The design is sized for 1,000 characters and
300 places:

- **A day's timetable is worked out once** per character and day, and remembered against the character's record and the
  places. The cast shares unchanged character records between versions, so the memory survives changes to anyone else.
- **Stints are few and in order** on each record, found by binary search.
- **Occupancy:** the first question about a minute builds one index of everyone's place at that minute, in one pass,
  remembered against the cast record and the minute. Every further question at that minute (who is at the bar, the club, the
  street) is a lookup.
- **Looking ahead** (`nextAt`: when will he next be at the bar) walks timetable pieces, not minutes. **First free time**
  (`firstFree`: the earliest time all of several people are awake, available and not booked, for a given length, optionally
  with a place open) merges their free intervals.
- **No randomness is consumed by reading.** Asking is free of side effects, unlike `witnessesAt`.

The memory is a cache: tests check that every cached answer equals the uncached one. Benchmarks report the cost once built,
as the character design does for rolls.

### Witnesses and noticing

A fact happens at a place (the fact's `where`, now a place id). The cast works out its witnesses; the caller no longer names
them.

- **Present and available:** everyone at the place at that minute who is available, other than whoever did it and whoever it
  was done to. Someone asleep at home while it is burgled is not a witness; someone unconscious on the floor is not either.
- **Whoever did it must be present** at the place, and so must whoever it was done to for kinds done in person (a beating, a
  threat, a lie, a loan handed over), but not for others (a shop robbed while its owner is at home). A table by fact kind.
- **Loud and quiet.** Each fact kind is loud (a beating, a fight, a shooting, a fire, a raid, an arrest: everyone present and
  available sees it) or quiet (a theft, a scam, a quiet threat, a conversation: those present notice it only by passive
  Notice, 10 plus their Notice bonus, against one Stealth roll by whoever did it, the ambush rule; drunk is −2 to Notice).
  Kinds with no place (a shortfall found in the books, a ruling) have no witnesses beyond those named. **Choice C8:** the
  table of loud and quiet kinds, and whether noticing also decides, witness by witness, who saw the doer (now the fact
  decides for everyone, with `hiddenActor`).
- **No cap.** **Choice C7:** recommended, no limit on witnesses; the game keeps at most 3 and then drops some by further dice.
  A crowded bar now has many witnesses and a quiet street few. This changes how fast knowledge spreads, so the shadow run
  compares it.
- **Fights and social rolls** take the place instead of a witness list. Witnesses of a lie told in front of others are those
  present who notice; what they believe is still the character design's open point.

This changes the character design's [Inputs](../character/README.md#inputs): witnesses are no longer an input. The place is,
and with positions there is now something that decides who saw what.

### Spending time together

| Situation | Do they meet? |
| --- | --- |
| A shared occasion: the stints of a crew's gathering, a shift with someone, a visit | Yes, once, when it begins, for those present (`together`) |
| Being in the same roll, fight, telling or drink | Yes, as built |
| Merely being at the same place by routine (two regulars at a café) | Not at the time; see regulars |

**Regulars.** Once a week, two characters who were both present and available at the same public place for at least 2
hours on at least 3 different days that week meet once (`together`, dated the last time they were there together). So
regulars come to know each other's faces over a few weeks, slowly enough that having met still means something.
**Choice C6:** this rule and its numbers, recommended; the alternatives are no effect from co-presence, or familiarity only
between those who have already met.

`together` also checks that everyone named is present at the same place at `now`, which follows from "spent time
together".

### Work

Every character may have work: a shop owner in their shop, a bartender behind a bar, a porter on the loading floor, a driver
for a captain. For an NPC, work is part of the routine; they go. The player's day job is the same arrangement, but whether
the player turns up is the player's choice, so a shift is a stint they book. Either way, an employer sees who turned up from
whereabouts during the shift, so a man who went to collect a debt in his working hours missed his shift, for NPCs as for the
player. The game's rules for the job (one shift a day, five a week, let go after a week without one) stay in the game.

A driver or a bodyguard is where the man they work for is. **Choice C14, escorts:** a stint whose place follows another
character's whereabouts, one level only (no one follows a follower), to build after the first steps; the player's job
driving a captain needs it at the swap.

### What a viewer can know of someone's whereabouts

`whereabouts` is the truth, for the simulation and tests. A screen shows what the player could know, by the overhaul's viewer
rule:

- **Present with them:** they see where the other is and what they are visibly doing.
- **Otherwise, what to expect:** their home and work if they have met; their haunts and hours if familiar enough (familiarity
  0.3 or more, a starting value); a stint only if they know of it through a fact (they arranged the appointment, they know
  of the arrest). Never a stint they do not know of.

`seenBy(viewer, other, t)` gives that. **Choice C10:** these thresholds, recommended; the alternative, as now, shows everyone's
whereabouts to the player.

### Where it lives and how it is built

- **In the cast,** as above. The cast record gains places, the seed and the clock; each character record gains its
  arrangements and stints. The cast's format goes from 8 to 9 with a migration: a format-8 cast becomes a **placeless** cast
  (no places, no arrangements), which behaves as the overhaul does now: nobody is present anywhere and facts have no place.
  Once a cast has places, every character must have a home, and the audit refuses otherwise.
- **Code** in `src/overhaul/schedules/`, tests in `tests/overhaul/schedules/`: pure rules over plain records (clock, draws,
  places, arrangements, routine, stints, whereabouts, presence, noticing, regulars, what a viewer sees). The cast
  (`src/overhaul/character/cast.ts`) uses them and adds the handles. `schedules/` imports only leaf modules of `character/`
  (time, ids, skills for Notice and Stealth, temperament for hours), never `cast.ts`, `records.ts` or `save.ts`, so there is
  no cycle; an architecture test enforces it.

```ts
const now = everyone.at(t);
now.whereabouts('sam');            // { activity: 'out', place: 'cafe-grand-st', from, until }
now.present('cafe-grand-st');      // ['rico', 'sam']
now.available('rico');             // { available: false, why: 'asleep', until }
now.seenBy('sam', 'rico');         // what Sam can know of where Rico is

const next = everyone.book('sam', { kind: 'activity', doing: 'collecting a debt', place: 'bar-mott-st', from: t, until: t + 90, cause: { fact: 'f12' } }, { now: t });
next.character('sam').nextAt('bar-mott-st', { from: t, within: DAY });
next.firstFree(['sam', 'rico'], { from: t, minutes: 60, place: 'club-mulberry' });
const { fact, cast } = next.record({ kind: 'beating', actor: 'sam', victim: 'joe', where: 'bar-mott-st' }, { now: t + 40, roller });
```

## The nine questions

| # | Question | Recommendation | Why |
| --- | --- | --- | --- |
| 1 | One answer to "where is he now?" | Yes: `whereabouts`, over one record, read by everything; district-as-location, the routine, the club, the older rooms, the location part of `activityOf` and `witnessesAt` all go | Six answers disagree now; "one world" needs one |
| 2 | Home and whereabouts | Yes: home is an arrangement, whereabouts are worked out; the district a character lives in is their home's | A job across town moves no one for good; 39% of characters "moved" in a month |
| 3 | What sets someone's hours | Their work, haunts, temperament and household, set when made and changed only with a cause; never rank | Hours follow what someone does, as rank does |
| 4 | Planned or chosen | Both: the routine is the default, and chosen or imposed stints override it; actions resolve on arrival | The routine gives every minute an answer; stints keep choices and their effects in one place |
| 5 | Chance | Predictable routine with stable draws per character, day and part of the day, from the world's seed | Same between looks, deterministic, and reading costs no randomness |
| 6 | Being together | Shared occasions meet when they begin; co-presence only through the weekly regulars rule | Familiarity growing for everyone in every bar every hour would make having met mean nothing |
| 7 | Witnesses | Whoever is present and available; quiet facts by passive Notice against Stealth; no cap | Who saw it follows from who was there, by the rule fights already use |
| 8 | Work | Yes: work is an arrangement anyone may have; NPCs keep it by routine, the player by choice | The same record for everyone, and employers can see who turned up |
| 9 | Where it lives | Both stored and worked out: arrangements and stints stored, the routine worked out; in the cast; code in `src/overhaul/schedules/` | One record, nothing saved per minute, and availability readable from a character's own record |

### Questions the mapping missed

| # | Question | Recommendation |
| --- | --- | --- |
| 10 | **When do the daily and weekly ticks' events happen?** 73% of facts happen at 9:00 or Sunday 20:00, when many of those in them are asleep | Each system decides at the tick what will happen, then books it into the people's day with `firstFree`; facts are dated when it happens |
| 11 | **What can a viewer know of where someone is?** The screens show the truth to the player now | `seenBy`, by the viewer rule ([above](#what-a-viewer-can-know-of-someones-whereabouts)) |
| 12 | **Can someone asleep be woken?** The game lets the player knock at 3 a.m. | Yes, as a recorded act at their home that ends their sleep for the visit, with its cost in feelings, so asleep stays unavailable until woken (Choice C15). Attacking someone asleep stays on the character design's list |
| 13 | **Where is someone on the way?** | Present nowhere, so nothing in person can happen to them (Choice C9; the alternative puts them in the street, where they could witness or be stopped) |
| 14 | **Is being on a job being somewhere?** | No: a commitment and a whereabouts are different records; doing the job is stints |
| 15 | **Does the past stay fixed?** Alibis need it | Yes: nothing changes before the cast's clock |
| 16 | **Does a night's sleep clear Drunk and Shaken?** Only a full rest does now | Decide with the healing rule; until then sleep clears nothing, which leaves someone drunk until they rest (Choice C16) |
| 17 | **Can people in prison deal with each other?** | Custody is unavailable (decided); whether inmates count as present together is for later, with prison as a place |
| 18 | **How long are past whereabouts kept?** | Stints and arrangement versions are kept for a window (14 days, a starting value), long enough for the regulars rule and recent alibis; older events keep their place and witnesses on their facts |

## Choices

| # | Choice | Recommended | Alternative |
| --- | --- | --- | --- |
| C1 | Where places live | On the cast record | A separate city record passed alongside |
| C2 | Where stints live | On each character's record | One list on the cast |
| C3 | Rest | A stint of kind rest | Keep `condition.rest` |
| C4 | Haunts | Stored, changed with a cause | Worked out from current traits each time |
| C5 | NPC decision cadence | At waking, at stint ends and at routine boundaries | Every 15 to 90 minutes, as now |
| C6 | Co-presence | Weekly regulars rule (2 hours on 3 days) | No effect; or only for those already met |
| C7 | Witness cap | None | Keep at most 3 |
| C8 | Loud and quiet kinds; noticing the doer | Kind table; doer stays fact-level for now | Noticing decides who saw the doer |
| C9 | On the way | Present nowhere | In the street of the district |
| C10 | What a viewer knows | Home and work once met; haunts and hours at familiarity 0.3 | Everyone's whereabouts shown, as now |
| C11 | The clock | One clock for the whole cast | For schedules only |
| C12 | Travel | The game's 10 and 35 minutes, refined after the shadow run | A full table now |
| C13 | Opening hours and stints | The routine respects them; stints do not | Stints refused at closed places |
| C14 | Escorts | Follow one character, one level, built after the core | None until the swap |
| C15 | Waking someone | A recorded act with a cost | Refused |
| C16 | Sleep and effects | Decide with healing; nothing until then | Sleep clears Drunk now |

Starting values to tune once built: the default hours and the hours table, the parts of the day, the arrival delay, the
regulars thresholds, the viewer's familiarity threshold, the retention window.

## Changes to the character design

What this plan changes in what is built, to be written into the character design once decided:

- **Inputs:** witnesses are worked out from the fact's place; the call names the place, not the witnesses.
- **Available:** alive, conscious, not resting, not asleep by their hours unless a stint keeps them up, not in custody.
- **`together`:** everyone named must also be present at the same place.
- **Facts:** `where` is a place id; whoever did it, and an in-person victim, must be present.
- **Fights, social rolls, drinking:** take the place; drinking's company must be present.
- **Rest:** a stint (C3). The healing rule is still to come.
- **Death** (on the mapping's "to add" list) is needed by `whereabouts`; built here if not before.

## What it replaces in the game

At the swap, in one sweep with everything else:

| Game | What it does now | Becomes | Work at the swap |
| --- | --- | --- | --- |
| `c.district` (413 references in 85 files; written in 17 places in 6 files) | Home and last place at once | Home (arrangements) and whereabouts | Remove the 17 writes; each read says whether it means where he lives or where he is |
| `core.ts` `isAwake`, `nextWake`, `nextAwake` | Hours | Availability, `nextWake` | Replace the calls |
| `core.ts` `witnessesAt` (32 callers in 9 files) | Dice by district, from the shared stream | Witnesses worked out from the fact's place | Each caller names where it happens; the follow-up `filter(() => rng.chance(…))` calls go |
| `core.ts` `travelTime` | Travel | The travel table | Replace |
| `city.ts` `routine`, `whoIsAt`, `nextAt`, `regulars`, `spots`, `openAt`, `HOURS` | Little Italy's routine | Timetable, presence, `nextAt`, places | Delete; screens read the cast |
| `clubdata.ts` `clubPresent`, `away` | The club's reckoning | Presence at the club; the club as a haunt | Delete; the club scene reads presence |
| `places.ts` `present`, `PLACES`, `isOpen` | The older rooms | Places in the cast | Delete |
| `where.ts` `whereIs` | Where the player is told someone is | `seenBy` | Becomes presentation only |
| `meetings.ts` `available`, `notNowWhy` | Whether someone can be seen | Availability with its reason and until when | `notNowWhy` words the reason |
| `jobs.ts` `activityOf` | "Busy" | An open commitment (the game's) plus availability | Split the two |
| `engine.ts` `think` | Decide, act at once, next turn in 15 to 90 minutes | Decide, book a stint, resolve on arrival | Rewrite |
| `actions.ts` `perform` (`go`) | Moves the actor's district and resolves at once | Resolve on arrival, at the place | Rewrite |
| Daily tick (9:00) and weekly tick (Sunday 20:00) systems | Act at one minute | Book into people's days | Each system that records a physical event |
| `orders.ts` `workShift`, `dayJobWeek` | The player's shift, at any hour, employer unseen | Work arrangement and shift stint | Rewrite; employer must be present |
| `enterprise.ts` `meetWeek`, Sunday envelopes | Counted present once a week | Occasions for those available | Rewrite |
| 35 `lastMet` writes in 19 files | Meeting | `together`, occasions | Replace |
| `web.ts` `talkTo`, `conv/visit.ts` `begin` | A visit, timed by `whereIs` | A stint to where they are; waking someone (C15) | Rewrite |
| `encounters.ts` (placed encounters), `intent.ts` `free` | Read the routine, or ignore sleep | Whereabouts and availability | Replace |
| `ui/streetmap.ts`, `ui/views_a.ts`, `ui/views_b.ts`, `ui/clubview.ts` | Read the four answers | `seenBy` and presence | Replace |
| `world.ts` hours by rank, `life.ts` a child's hours | Hours | The hours rule | Replace |

What stays in the game: the business records (keyed by place id), family membership (which decides who has the club as a
haunt), the rules for what an NPC chooses to do (`actions.ts` scoring), and the day job's terms.

## Build plan

Test first, as the character overhaul was built: each step's tests are written before its code, with Vitest and
`node:assert`, each test tagged with exactly one kind (`unit`, `property`, `statistical`, `architecture`), scripted rollers
where dice are rolled, and coverage held at 100% (`npm run overhaul:cov`; the config already counts all of
`src/overhaul/**`). After each step, `overhaul:typecheck`, `overhaul:test` and `overhaul:cov` pass, and the open points are
written down, as the character plan's revisit list does.

0. **Folder and boundaries.** `src/overhaul/schedules/`, `tests/overhaul/schedules/`, this plan's status line.
   Tests: architecture (the boundary test covers the new folder; `schedules/` imports no `cast.ts`, `records.ts` or
   `save.ts`). Proves: the overhaul stays apart from the game.
1. **The clock.** Weekday (day 0 a Monday, as in the game), minute of the day, a week, minute ranges that pass midnight.
   Tests: unit; property (a range passing midnight is the same as its two halves). Proves: one clock, one convention (I).
2. **Stable draws.** `draw(seed, ...keys)` in [0, 1). Tests: unit (fixed values); property (same keys, same number;
   reading changes nothing); statistical (uniform; two characters' draws uncorrelated). Proves: determinism; chance without
   side effects.
3. **Places.** The record and its checks, opening hours by trade and weekday, opened and closed, districts and the travel
   table. Tests: unit; property (`openAt` agrees with the hours over every minute of a week). Proves: one record per place
   (G).
4. **Arrangements and their history.** Home, hours, work, haunts; versions with the time each began; the checks (work and
   haunt windows within waking hours, 6 to 9 hours asleep). Tests: unit; property (the version in force at `t` is the last
   begun at or before it). Proves: past routines stay as they were (I); changes have causes (D).
5. **Awake and asleep.** From hours, across midnight; `nextWake`. Tests: unit; property (exactly one of awake or asleep;
   `nextWake` equals a minute-by-minute search). Proves: the decided sleep rule's basis.
6. **The routine.** A day's timetable from arrangements, places and draws. Tests: unit (one per rule); property (the pieces
   cover the day exactly, never overlap, allow the travel between places, and never put a customer in a closed place);
   statistical (a haunt with chance 0.6 is kept on about 60% of matching days; regulars' choices are independent).
   Proves: every minute has a routine answer.
7. **Making arrangements.** Hours and haunts for a new character from work, haunts, temperament, background and household.
   Tests: unit (each row of the hours table); statistical (the spread of hours over generated characters); architecture
   (the rule's input has no rank). Proves: hours follow what someone does, not rank.
8. **Stints.** The record; booking, cutting short, calling off; no overlap; nothing before the clock; imposed kinds cut
   short what they overlap, with their cause; travel worked out; occasions. Tests: unit; property (random sequences of
   bookings never leave two stints over one minute; a refused booking changes nothing). Proves: never two answers (G, I, D).
9. **Whereabouts.** The one function, in its order. Tests: unit (each row of the order); property (an answer for every
   character at every minute; later accepted changes never change an answer before the clock; a covering stint always
   wins). Proves: one world.
10. **Into the cast.** Format 9: places, seed and clock on the cast; arrangements and stints on characters; save, load and
    the migration from format 8 to a placeless cast; `at`, `book`, `cut`, `arrange`, `place`. Tests: unit; property (save
    and load give the same cast); a format-9 fixture. Proves: the save format's rules; one record.
11. **Availability.** Dead, unconscious, resting, asleep, in custody, each with its reason and until when;
    `assertAvailable` reads it, so recording, telling, paying, giving, drinking, fights, social rolls, planning and
    `together` all refuse someone asleep or in custody. Death, if not yet built. Tests: unit (each reason and each
    refusal); property (asleep means every in-person change is refused); the existing suites. Proves: the decided rule.
12. **Rest as a stint** (if C3). The migration from `condition.rest`; the resting rule unchanged. Tests: unit; migration
    fixture. Proves: one record for a span of time.
13. **Presence.** `present`, the occupancy index, `nextAt`, `firstFree`. Tests: unit; property (presence equals asking
    `whereabouts` of everyone; cached equals uncached; `nextAt` equals a minute-by-minute search; `firstFree` is free for
    everyone and is the earliest); a benchmark, reported. Proves: every reader gets the same answer, cheaply.
14. **Facts at places, and witnesses.** `where` as a place; whoever did it, and an in-person victim, present; witnesses
    worked out; the loud and quiet table; noticing by Stealth and Notice; fights and social rolls take the place; the
    witness list as an input goes. Tests: unit; property (witnesses are always present and available; nobody absent learns
    anything as a witness); statistical (the share who notice a quiet fact matches the Notice odds). Proves: knowledge has
    provenance (A); one world.
15. **Together, occasions and regulars.** `together` checks presence; occasions meet when they begin; the weekly regulars
    rule. Tests: unit; property (only pairs who were present together long enough meet); statistical (how fast regulars
    meet in a generated neighbourhood). Proves: having met has a cause.
16. **What a viewer sees.** `seenBy`. Tests: unit; property (changing a stint the viewer does not know of never changes what
    they see). Proves: no private state leaks (A).
17. **Retention.** Stints and arrangement versions older than the window are pruned. Tests: property (pruning never changes
    an answer inside the window); unit (asking outside it is refused). Proves: the record stays bounded.
18. **A reference run.** A generated city of 300 characters with places and arrangements, and a simple seeded chooser
    booking stints, for 60 days. Tests: statistical (time at home, work and haunts by kind of character; witnesses per
    fact; how fast people meet; no two answers ever; record size). Proves: the measures the shadow run compares.

## Risks

- **Balance.** Witnesses from real presence and no cap, decisions at routine boundaries, and facts spread through the day
  all change how fast knowledge, grudges and retaliation move. The shadow run is where this is settled, not here.
- **The ticks.** Moving every physical event off 9:00 and Sunday 20:00 touches most daily and weekly systems, and they will
  be found to depend on that minute in ways nobody wrote down.
- **Reachability.** NPCs who are asleep, away or at work are harder to find. Screens must say when someone can be found
  (`nextAt`), or the player waits blind.
- **Midnight and the week's edge.** The game's hours pass 24 (`sleep: 26`) and its clock starts on a Monday. Property tests
  over every minute of a week are the guard.
- **Hidden state in caches.** A cache that outlives a change gives a second answer. Cached and uncached answers are compared
  in tests, and caches are keyed by records that never change.
- **Correlated draws.** A poor hash could send every gambler to the track on the same Saturdays. The statistical test of
  independence is the guard.
- **Leaks to the screen.** Showing the truth where `seenBy` should be used shows private state. An architecture test after
  the swap can keep the screens off `whereabouts`.
- **Save size.** Stints accumulate; retention bounds them. The game's save-size failure around day 60 is a warning.
- **A second answer creeping back.** At the swap, any game code that works out a location its own way breaks the design. A
  source scan can forbid writing a location and reading `district` as one.

## The shadow run

Compared over many seeds, between the game's systems and the overhaul's:

| Measure | Why |
| --- | --- |
| Facts per day by kind, and their spread over the hours | Activity should be similar in amount and no longer bunched at two minutes |
| Witnesses per fact, and the share with none | How fast knowledge spreads |
| Witnessings by anyone unavailable | Must be none in the overhaul |
| Grudges, fear and retaliation over 60 days | The knock-on effect of witnesses |
| New relationships and familiarity per week | The regulars rule and occasions against the game's 35 places that mark meeting |
| Time at home, at work, at haunts and in stints, by kind of character | Routines look like lives |
| Share of the player's attempts to see someone that find them away or asleep | Reachability |
| Income from work | The routine replaces the `work` action |
| Two answers for anyone at any minute | Must be none |
| Time per simulated day; record size at 60 and 120 days | Performance and the save-size risk |

## Corrections to the mapping

Found while checking the [mapping](../character/game-schedules.md) against the source:

- **Hours are set by belonging to a crime family, not by being made.** Anyone in a family, associates included, is up from
  10 in the morning to 2 at night (`world.ts`: `made` is any rank but civilian); the player, an associate, is up from 9 to 2,
  not 9 to 10.
- **Six answers, not four.** `places.ts` `present` is a fifth reckoning (a 30% chance per four-hour stretch, for men of the
  player's family at the barber's and the bar), and it ignores sleep: `whereIs` reaches it for men of the player's family
  who do not live in Little Italy, so a man asleep by his own hours can be shown at the bar in the small hours. `jobs.ts` `activityOf` is a
  sixth (locked up, laid up, on a job, keeping his head down), read by `intent.ts`, `work.ts`, `stress.ts`, job assignment
  and screens.
- **The club's day-job reduction never applies.** Only the player has a day job (`orders.ts`, `background.ts`), and
  `clubPresent` skips the player.
- **The club's owner is always counted present while it is open,** even asleep or on a job: `!away(w, c) || c.jailedUntil
  <= w.now` is always true, because men in prison were skipped the line before (`clubdata.ts`).
- **The club does not ask `isAwake`;** it has its own sleep arithmetic in `away`.
- **`whereIs` does reach the simulation:** it sets how long the player's visit takes (`web.ts` `talkTo`) and how a visit
  opens (`conv/visit.ts`). And a visit does not move the player's district, so after going to see someone across town the
  player is still, for witnesses, where they were.
- **NPC actions resolve when chosen.** `perform` moves the actor's district and records its facts at once, then adds travel
  and duration; the man visited is checked only for prison, not sleep; and `chooseAction` ignores an active job, so a man
  "on a job" for days keeps choosing other actions.
- **Most facts happen at two minutes:** 73% at the daily tick (9:00) or the weekly tick (Sunday 20:00), and 45% have an
  actor asleep by his own hours (members of a family wake at 10). `intent.ts` `free` checks prison, injury and jobs but not
  sleep.
- **`witnessesAt` draws from the shared random stream,** so asking who is there changes later dice.
- **The crew's weekly gathering** (`meetWeek`) counts men in prison and does not ask who is awake; it does not mark
  meeting.
- **The player's shift** has no time of day, and the employer it changes feelings in need not be present or awake.

## Words

New words, to be added to the [glossary](../character/glossary.md) once decided.

### Words that mean two things

| Word | Here | In the game |
| --- | --- | --- |
| **Schedule** | A character's routine and stints together | `core.ts` `schedule`: putting an event on the engine's queue |
| **Meeting / meet** | Meet: become acquainted or more familiar (the character glossary) | A meeting: a sit-down or a crew's gathering (`meetings.ts`). Say "gathering" or "appointment" here |
| **Regulars** | Characters who share a public place often enough to meet | `city.ts` `regulars`: men the player knows who are coming to a place in the next day |
| **Available** | Alive, conscious, awake, not resting, not in custody | `meetings.ts` `available`: alive, not in prison, not hurt, awake |
| **District** | The part of the city a place is in | A character's field, meaning both where he lives and where he last worked |
| **Work** | An arrangement: a workplace and its shifts | The NPC action `work` (four hours), and the player's day job `c.job` |
| **Activity** | What someone is doing at a minute | `jobs.ts` `activityOf`: why someone is busy |

### New terms

- **Whereabouts** — where a character is and what they are doing at a minute, worked out by one function.
- **Activity** — what someone is doing: asleep, at home, working, out (at a haunt), on the way, doing something (a stint),
  resting, in custody, in hospital, dead.
- **Present** — at a place at a minute. **Occupancy** — everyone present at each place at one minute.
- **Place** — somewhere a character can be, with a kind, a district, opening hours and when it opened and closed.
- **Opening hours** — when a place is open to customers, by weekday.
- **Street** — a district's public outdoor place.
- **Home / household** — the home place a character lives at; everyone whose home it is.
- **Arrangements** — a character's home, hours, work and haunts, stored as versions each with the time it began.
- **Hours** — when a character wakes and goes to sleep.
- **Haunt** — a place someone goes in their free time, with its weekdays, its window and its chance.
- **Routine** — the timetable of a character's ordinary day, worked out from their arrangements, the places and the clock.
- **Day (of a character)** — from their waking to their next waking.
- **Part of the day** — morning, afternoon, evening or late: the pieces of free time a haunt is drawn for.
- **Stable draw** — a number from 0 to 1 worked out from the world's seed and keys, the same every time it is asked.
- **Stint** — a span of one character's time, chosen or imposed, that overrides their routine. **Booking** a stint records
  it; **cutting short** ends it early; **calling off** ends it before it starts.
- **Imposed** — a stint put on someone (custody, hospital), which cuts short what it overlaps.
- **Custody** — being held by the police or in prison: a stint that makes someone unavailable.
- **Occasion** — stints booked together for one purpose, one for each person, sharing an id.
- **On the way** — travelling to a place: present nowhere.
- **Cast's clock** — the latest time any change to the cast was made at; nothing can be changed before it.
- **Witness** (revised) — someone present and available when a fact happened who saw it: everyone for a loud fact, those who
  notice for a quiet one.
- **Loud / quiet** — whether a kind of fact is seen by everyone present or only by those who notice it.
- **Noticing** — passive Notice against the actor's Stealth roll, as for an ambush.
- **Seen whereabouts** — what a viewer can know of where someone is.
- **Next at / first free** — when someone is next at a place; the earliest time several people are all free.
- **Placeless cast** — a cast with no places, as the overhaul is before this plan: nobody is present anywhere.
