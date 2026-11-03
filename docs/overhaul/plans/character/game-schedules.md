# Character: mapping the game's schedules

How the game decides, today, when each character acts, where they are at a given hour, who is with them, and who sees what.
It is mapped before character schedules are designed, as the [game mapping](game-mapping.md) was for the character's
fields. Nothing here is decided. It ends with the questions the design has to answer.

**Corrected by the schedules design:** checked against the source, the game has six answers, not four, and hours follow
belonging to a crime family, not being made; see its [corrections to this mapping](../schedules/README.md#corrections-to-the-mapping).

Written 3 November 2026, at commit d080184, from reading `src/core.ts`, `src/engine.ts`, `src/city.ts`, `src/where.ts`,
`src/places.ts`, `src/clubdata.ts`, `src/meetings.ts`, `src/enterprise.ts` and `src/orders.ts`, and from the compiler's
references to `wake`, `sleep` and `district`.

## In short

The game has **no single answer to "where is he now?"** It has four, each written for a different purpose, which do not
consult each other:

| Answer | Where | Used by | How it decides |
| --- | --- | --- | --- |
| **His district** | `c.district` | The simulation: who witnesses things, travel times, who drinks at the crew's bar | One field, set to wherever he last went to do something |
| **His routine** | `city.ts` `routine` | Screens and the conversation's scene only | A pure function of the man and the clock, for one district (Little Italy) |
| **The club's reckoning** | `clubdata.ts` `clubPresent` | Screens, `whereIs`, the club scene | A chance by rank and hour, fixed for each three-hour stretch |
| **Whether he can be seen** | `meetings.ts` `available` | Meetings, someone sending for the player | Alive, not in prison, not hurt, awake |

`where.ts` `whereIs` combines the last three for the player's screens: the club first, then the routine, then the older
places of the other districts, then his shop, then home. The simulation does not use it. So a man the player is told is at
the café can at the same moment be picked, by his district, as a witness to a robbery elsewhere. That is the design
principle "one world" broken, and it is what schedules would fix.

## When characters act

- **The player** acts when the player chooses. Time moves only by what their actions cost.
- **Everyone else** acts in a loop (`engine.ts` `think`). When his turn comes, a man who is asleep is put off until he
  wakes (plus up to 90 minutes), and one in prison until he is released. Otherwise he chooses an action
  (`actions.ts` `chooseAction`, the utility scoring by traits), it takes its minutes, and his next turn is 15 to 90 minutes
  after it ends.
- **Weekly events** run for everyone at once: the economy, kick-ups, debts, the crew's meeting, the papers.

So an NPC's day is a string of chosen actions while awake. Nothing says where he spends the time between them.

## Waking hours

- Every character has a waking hour and a sleeping hour (`wake`, `sleep`; past 24 means after midnight).
- **They are set by rank when the world is made** (`world.ts`): a made man is up from 10 in the morning to 2 at night,
  everyone else from 7 in the morning to 10 at night. The player is up at 9. A child of the player's is up from 7 to 8
  at night. They never change.
- `core.ts` `isAwake` and `nextWake` read them; the NPC loop, witnesses, meetings, the club and routines all ask whether
  someone is awake.

## Where someone is

**District** (`c.district`). The only location the simulation uses. It is set in 17 places in 6 files (`jobs.ts`,
`gigs.ts`, `orders.ts`, `actions.ts`, `books.ts`, `encounters.ts`) to wherever the man went to do something: the
business he robbed, the man he collected from. It never goes back. So it means both where he lives and where he last
worked, and after a job across town he is, as far as the simulation knows, still there.

**Routine** (`city.ts`). For men who live in Little Italy, where they are at any hour follows their life, read from their
traits and the clock:

| When | Where |
| --- | --- |
| Asleep | Home |
| Sunday morning | Church, for a gentler man (low violence, high empathy) |
| Saturday afternoon | The racetrack, for a gambler (vice 0.55 or more) |
| Working hours | His own shop, if he has one and it is open |
| A civilian otherwise | Home, or the bar in the evening if he drinks |
| A man in the life, by day | The café or the barber's, by how sociable he is |
| A man in the life, in the evening | The bar if he drinks, the café until it closes, then home |

Places keep hours by their trade (a bar from the afternoon until late, shops nine to seven and shut on Sundays). The
routine is described in its own comment as changing nothing in the simulation: only screens read it. The other districts
use older fixed places (`places.ts`).

**The club** (`clubdata.ts`). Who is in a family's club is its own reckoning, by a chance for each man, fixed for each
three-hour stretch so it is the same between looks. The chance is by rank (from 5% for a boss to 26% for a capo), raised
for the boss and underboss on Wednesday and Sunday evenings, for a gambler in the evening, and for men whose captain owns
the club; lowered for a man with a day job, and for one who lives far away. Anyone asleep, hurt, in prison or out on a job
is away.

## Who is together

- **The crew's weekly meeting** (`enterprise.ts` `meetWeek`): if the player has chosen a place, their crew and the
  regulars there are counted as there once a week. Each man's affection for the player rises a little, and one thing a
  regular knows reaches the player.
- **Sunday envelopes:** the player's men come on Sunday.
- **Day jobs** (`orders.ts`): only the player has one: one shift a day, five a week, at a bar, a door, or driving for a
  captain. NPCs have no working day except a shop owner's routine.
- **Meeting** (`lastMet`) is marked in 35 places when people deal with each other, as the game mapping found. Being at the
  same café or club is not counted as meeting.

## Who sees what

`core.ts` `witnessesAt` picks the witnesses to most things that happen (32 callers, in `asks.ts`, `matters.ts`,
`revenge.ts`, `jobs.ts`, `gigs.ts`, `actions.ts`, `people.ts`, `command.ts` and `engine.ts`): each awake man whose district
is the same, outside prison, with a 25% chance, up to a limit. Often the caller then keeps only some of them, by another
chance. It does not read routines or the club. So who sees a robbery is decided by dice among everyone whose last job was in
that district, not by who was in the street.

## What the overhaul needs from it

The overhaul leaves "who is there" to the caller (the design's Inputs). Everything below depends on that answer being
right and consistent:

| Need | Why |
| --- | --- |
| **Who is there** at a moment | Witnesses to a fact, who can be talked to, who joins a fight, who sees a lie told in front of others |
| **Who is available** | Asleep, resting, in prison or dead: now one rule (`assertAvailable`), which schedules would feed |
| **Who spends time together** | `together`, so men on the same shift, the same crew or the same café grow familiar |
| **Where someone can be found, and when** | Finding a man, waiting for him, and catching him alone or asleep for an ambush |

## Questions for the design

To take one at a time, as the game mapping's decisions were:

1. **One answer to "where is he now?"** Should there be a single schedule, for every character and every district, that
   the simulation and the screens both read, replacing district-as-location, the routine, the club's reckoning and
   `witnessesAt`'s dice?
2. **Home and whereabouts.** Should a character have a home (where they live) apart from where they are, so a job across
   town does not move them there for good?
3. **What sets someone's hours.** The game sets them by rank. Should they come from the character (temperament,
   background, work, family), as rank was detached from abilities?
4. **Planned or chosen.** Is a character's day a routine read from who they are and the clock, with chosen actions
   interrupting it, or only the actions they choose, with somewhere to be between them?
5. **Chance.** The club uses chance, fixed for each three-hour stretch. Should presence be predictable from someone's
   routine, or partly chance, and if chance, how is it kept stable?
6. **Being together.** Should people in the same place at the same time meet (`together`) automatically, so regulars at a
   café grow familiar, or only when something happens between them?
7. **Witnesses.** Should witnesses be whoever the schedule puts there, with a chance of noticing (by Notice, say), instead
   of dice by district?
8. **Work.** Should characters other than the player have working days (a shift at a bar, a captain's driver), as the
   player's day job is?
9. **Where it lives.** A schedule can be worked out from the character and the clock, needing nothing saved, as the
   routine is; or kept as a record. Which, and is it part of the cast or the game?
