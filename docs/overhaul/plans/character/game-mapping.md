# Character: mapping the game

Where each field of the game's `Character` (`src/types.ts`) lands when the overhaul replaces the game's systems, which game
systems read and change it, and what has to change in the game at the swap. This is the plan's [Mapping the game's
records](README.md#before-the-swap), and it sizes "the rest of the game's characters" on the same list.

**The swap is a clean break** (decided 3 November 2026): no character or save from before it comes across, so nothing here
is converted. This maps which record holds each thing after the swap, and what the game's systems must do differently to
use it.

Written 3 November 2026, at commit 1ff4f86. **Where a field lands is proposed, not decided.** Each proposal follows the
plan's principles (one record per thing, knowledge with a source, every change through one function), and anything marked
"decide" needs the owner.

## How it was measured

The counts come from the TypeScript compiler's own reference search over the game (`src/`, without `src/tests/` and
`src/overhaul/`), not from searching the text. So `cash` on a character is not mixed up with `cash` on a business.
"References" counts every place the field is read or changed; "changed by" lists the files that assign the field itself,
most first. Two limits:

- A change inside a field is counted under the inner type, not the field. Changing a relationship's trust is a change to
  `Rel.trust`, not to `rels`. Those are listed under [Changes inside relationships, knowledge and
  traits](#changes-inside-relationships-knowledge-and-traits).
- A change through a computed key, such as `r[feeling] += x` in `core.ts`, is not attributed to any one field, so
  `core.ts` changes feelings more often than its counts show.

## In short

The game's `Character` has 54 fields, used in 155 of the game's files. Proposed:

| Where it lands | Fields | |
| --- | --- | --- |
| **The cast, as it is** | `id`, `name`, `traits`, `rels`, `known`, `cash` | Same meaning; each needs every change routed through the cast |
| **The cast, in its own shape** | `skills`, `bg`, `hurtUntil`, `conduct`, `struggling`, `denied` | The overhaul holds the same thing differently: attributes and eighteen skills, hit points, conduct steps, facts |
| **The cast, to add** | `alive`, `diedAt`, `nick`, `look` | Character state the overhaul does not hold yet |
| **Other records, keyed by the character's id** | 31 fields | Organisation, books, police, commitments, standing, goals, decisions, daily life, conversation, the player's own interface |
| **To decide** | `insight`, `intro`, `cars`, `goods`, `problem` | See [Decisions](#decisions) |
| **Nowhere** | `isPlayer`, `hustle` | The cast has no player flag; `hustle` is only read to bring old saves across, which no longer happens |

The cast should hold what the character rules use (rolls, condition, inventory, relationships, knowledge, temperament), and
no more. Rank, family, books and the rest stay in the game's own records, keyed by id, which is how the game already treats
businesses and debts. Where a character rule needs one of them, it is passed in (plan: [Inputs](README.md#inputs)): the
learning tables, for example, read family as closeness to a victim.

## Every field

### Identity and presentation

| Field | What it is | Used (references, files) | Changed by | Lands in | Work at the swap |
| --- | --- | --- | --- | --- | --- |
| `id` | The character's id | 7453, 142 | `world.ts` | Cast: `id` | None |
| `name` | Full name | 3668, 127 | `conv/gate1.ts`, `world.ts` | Cast: `name` | None |
| `nick` | A nickname given by the crew | 7, 3 | `crewlife.ts` | Cast, to add: optional `nick` | Carry it across |
| `look` | Portrait choices | 7, 4 | `web.ts` | Cast, to add: optional `look`, kept opaque | Carry it across; the portrait code reads it as now |
| `bg` | The player's background (`hustler`, `wheelman`…) | 6, 2 | `background.ts` | Cast: `background` | Character creation offers the overhaul's backgrounds; decide which |
| `isPlayer` | Marks the player | 532, 72 | `world.ts` | Nowhere: the cast has no player flag; `w.playerId` already says who it is | Replace every read with `id === w.playerId` |

### Abilities and temperament

| Field | What it is | Used (references, files) | Changed by | Lands in | Work at the swap |
| --- | --- | --- | --- | --- | --- |
| `traits` | Seven traits, 0 to 1 | 346, 66 | `world.ts` | Cast: starting traits plus conduct; the overhaul has the same seven and seven more | Replace each direct trait change with conduct, or remove it |
| `skills` | Five skills (`muscle`, `driving`, `charm`, `nerve`, `brains`) | 47, 23 | `background.ts`, `world.ts`, `engine.ts` | Cast: six attributes and eighteen skills | The world generator makes characters by the overhaul's rules, fit for their rank; decide how |
| `conduct` | The player's counts of threats, force, lies and so on (`temper.ts`) | 5, 2 | `temper.ts`, `conv/minds.ts` | Cast: conduct steps, for every character | Map each count to a conduct row; some have no row yet |

### Condition and life

| Field | What it is | Used (references, files) | Changed by | Lands in | Work at the swap |
| --- | --- | --- | --- | --- | --- |
| `hurtUntil` | Hurt until a time | 87, 42 | `danger.ts`, `asks.ts`, `situ.ts`, `authority.ts` and 11 more | Cast: hit points | Each place that hurts someone gives damage instead of a time; healing over time is on the Before the swap list |
| `alive` | Alive or dead | 912, 105 | `life.ts`, `world.ts`, `core.ts` | Cast, to add: death, which makes a character unavailable for everything | Add it to the cast before the swap |
| `diedAt` | When they died | 6, 4 | `life.ts`, `core.ts` | Cast, to add, with `alive` | As above |
| `wake` | Hour they get up | 9, 5 | `world.ts`, `life.ts` | Daily life (`life.ts`), keyed by id | None; whether sleeping counts as resting is a decision |
| `sleep` | Hour they go to bed | 6, 4 | `life.ts`, `world.ts` | Daily life, as `wake` | As `wake` |
| `district` | Where they are now | 413, 85 | `jobs.ts`, `orders.ts`, `gigs.ts`, `world.ts` and 3 more | Daily life, keyed by id | None; callers use it to decide who is there |
| `problem` | A personal problem (gambling, debt, drink…) and how bad | 153, 29 | `world.ts`, `people.ts`, `career.ts` | Its own record, keyed by id | Decide whether a problem becomes an effect on rolls |

### Relationships and knowledge

| Field | What it is | Used (references, files) | Changed by | Lands in | Work at the swap |
| --- | --- | --- | --- | --- | --- |
| `rels` | How they feel about each other character | 229, 67 | `world.ts` | Cast: `relationships` (`known` becomes familiarity, `why` the grudge's reason, `bond` the regard's reason) | Route every change through the cast; see below |
| `known` | Their version of each fact | 258, 63 | `politics.ts`, `world.ts` | Cast: `knowledge` (`from` becomes source and teller, `how` seen, told or heard, `big` exaggerated) | Route every change through `record` and `tell` |
| `struggling` | Businesses they know are struggling, and since when | 6, 3 | `world.ts` | Cast: a fact of its own kind, known like any other | Record it as a fact |
| `insight` | What the player has worked out about people | 16, 9 | `deeds.ts`, `powers2.ts`, `crewlife.ts` | Cast: knowledge inferred, which has no provenance yet (invariant A names inference) | Design inferred knowledge |
| `denied` | Matters they lied to the player about | 5, 4 | `matters.ts`, `deeds.ts`, `conv/visit.ts` | Cast: `lie` facts, which record their claim | Read the lie facts instead |
| `intro` | Who the player has been introduced to, and when | 20, 11 | `deeds.ts`, `life.ts`, `background.ts`, `world.ts` and 4 more | Cast: a relationship, begun by meeting | Decide whether an introduction is a meeting |
| `notes` | The player's own contact book | 14, 5 | `notebook.ts`, `deeds.ts` | The player's interface state, not the character | Move it out of the character |
| `talk` | What the player has discussed with them | 22, 12 | `deeds.ts`, `conv/acts/family.ts`, `conv/acts/org.ts`, `conv/acts/personal.ts` and 2 more | Conversation (`conv/`), keyed by id | Move it out of the character |

### Money and goods

| Field | What it is | Used (references, files) | Changed by | Lands in | Work at the swap |
| --- | --- | --- | --- | --- | --- |
| `cash` | Cash in hand | 699, 71 | `powers2.ts`, `jobs.ts`, `situ.ts`, `encounters.ts` and 38 more | Cast: `inventory.cash`, changed only by recorded transfers | Every direct change becomes a transfer; see below |
| `wage` | Weekly wage | 16, 8 | `rank.ts`, `world.ts`, `orgs.ts`, `career.ts` and 1 more | Organisation, keyed by id | None |
| `weekIncome` | This week's income | 8, 5 | `books.ts`, `orders.ts`, `world.ts`, `actions.ts` and 1 more | The books (`books.ts`), keyed by id | None |
| `lifetimeKick` | Everything passed up, ever | 37, 16 | `world.ts`, `books.ts` | The books | None |
| `lifetimeGross` | Everything the player has taken in | 7, 4 | `pulse.ts`, `books.ts`, `core.ts` | The books | None |
| `books` | Weekly accounts, skimming, arrears | 338, 45 | `world.ts`, `engine.ts` | The books | None; skimming is on the Before the swap list |
| `kickRate` | Share of earnings passed up | 82, 19 | `books.ts`, `pulse.ts`, `goals.ts`, `meetings.ts` and 12 more | Organisation | None |
| `cars` | Stolen cars on hand | 38, 7 | `jobs.ts`, `orders.ts`, `background.ts`, `world.ts` and 1 more | Cast items, or the game's goods, to decide | Decide |
| `goods` | Value of stolen goods on hand | 34, 10 | `jobs.ts`, `orders.ts`, `background.ts`, `world.ts` and 3 more | As `cars` | Decide |
| `hustle` | A line of work from before Stage 4, read only to bring old saves across | 2, 1 | none | Nowhere: old saves do not come across | Remove it |

### Organisation and career

| Field | What it is | Used (references, files) | Changed by | Lands in | Work at the swap |
| --- | --- | --- | --- | --- | --- |
| `familyId` | Which crime family they belong to | 1269, 110 | `orgs.ts`, `authority.ts`, `career.ts`, `rank.ts` and 3 more | Organisation, keyed by id; the learning tables read it as closeness | Pass family into learning (Before the swap: Families) |
| `rank` | Civilian to boss | 902, 115 | `rank.ts`, `conv/authority.ts`, `world.ts` | Organisation | None |
| `bossId` | Their superior | 736, 106 | `orgs.ts`, `path.ts`, `career.ts`, `rank.ts` and 11 more | Organisation | None |
| `sponsor` | Who vouched for them when made | 7, 4 | `path.ts`, `career.ts` | Organisation | None |
| `backer` | A captain recommending them | 46, 20 | `politics.ts`, `goals.ts`, `orders.ts`, `deeds.ts` and 6 more | Organisation | None |
| `prospect` | A hanger-on who might be taken on | 26, 13 | `people.ts`, `authority.ts`, `orders.ts`, `world.ts` | Organisation | None |
| `career` | Work done, offices held | 37, 19 | `succession.ts`, `standing.ts`, `path.ts`, `orgs.ts` and 5 more | Organisation | None |
| `job` | A day job (bartender, driver…) | 34, 8 | `orders.ts`, `background.ts` | Organisation or the economy, keyed by id | None |
| `spoke` | Who would speak for the player | 6, 1 | `path.ts` | The player's road to rank (`path.ts`) | Move it out of the character |

### Standing, goals and commitments

| Field | What it is | Used (references, files) | Changed by | Lands in | Work at the swap |
| --- | --- | --- | --- | --- | --- |
| `standing` | Reputation, 0 to 100 | 90, 43 | `world.ts`, `core.ts`, `engine.ts` | Standing (`standing.ts`), keyed by id | None for now; later read from facts |
| `standingWhy` | Recent changes in standing | 2, 1 | `core.ts` | Standing | None |
| `rep` | The player's record of keeping their word | 18, 7 | `crewlife.ts`, `book.ts`, `powers2.ts` | Commitments, keyed by id | It is what should drive loyalty (Before the swap) |
| `memos` | Promises, threats, agreements, questions, favours | 26, 14 | `world.ts`, `memos.ts`, `engine.ts` | Commitments, keyed by id | Move them out of the character |
| `want` | What they are privately after | 62, 18 | `pulse.ts`, `crewlife.ts`, `powers2.ts`, `path.ts` and 2 more | Goals (`goals.ts`), keyed by id | None |
| `ambition` | What the player is working towards | 4, 4 | `web.ts` | Goals | None |
| `cooldown` | When they may next retaliate, and the like | 205, 45 | `world.ts` | Decisions (`actions.ts`), keyed by id | None |

### Police and prison

| Field | What it is | Used (references, files) | Changed by | Lands in | Work at the swap |
| --- | --- | --- | --- | --- | --- |
| `heat` | Police attention | 179, 41 | `path.ts`, `enterprise.ts`, `actions.ts`, `rackets.ts` and 24 more | The police, keyed by id | None |
| `jailedUntil` | In prison until a time | 190, 61 | `politics.ts`, `path.ts`, `rackets.ts`, `orders.ts` and 5 more | The police; the cast must also treat someone in prison as unavailable | Make availability read it |
| `inside` | The player's time inside | 10, 3 | `inside.ts` | The police | None |
| `informant` | Working for the police | 23, 5 | `politics.ts`, `matters.ts` | The police | None |

## Changes inside relationships, knowledge and traits

**Relationships.** The game changes feelings through `core.ts` (`feel`, `feelOn`, `bear`), except in these places:

| Change | Where | What it is |
| --- | --- | --- |
| A relationship begun at its own values | `orders.ts`, `people.ts`, `places.ts` | First contact sets trust, respect and affection to 0.25 to 0.4, where the overhaul starts every new relationship at 0.5 |
| Values set outright | `conv/gate1.ts` | A scripted conversation scene setting trust and familiarity |
| Familiarity set outright | `enterprise.ts`, `background.ts` | Setting up the player's start and their businesses |
| `lastMet` set | 19 files, 35 places | Meeting happens in the game wherever two people spend time together: meetings, work, jobs, orders |

**Knowledge.** The game records what someone learns through `core.ts` (`learn`, `addFact`) and `rumour.ts`, except:

| Change | Where | What it is |
| --- | --- | --- |
| Told, with no change in feelings | `revenge.ts`, `deeds.ts` (`toldDirect`) | Someone is told a fact directly, bypassing `learn` |
| Knowledge of something that is not a fact | `encounters.ts` | `known['leave:<id>']`: being told someone plans to leave, stored as knowledge with no fact behind it |

**Traits.** The game sets traits when it makes a character (`world.ts`), and also changes them directly afterwards:

| Trait | Changed afterwards by |
| --- | --- |
| Ambition | `meetings.ts`, `powers2.ts`, `path.ts`, `people.ts`, `situations.ts` |
| Greed | `path.ts`, `crewlife.ts` |
| Courage | `people.ts`, `crewlife.ts` |
| Violence | `people.ts` |
| Sociability | `life.ts` |

In the overhaul, traits move only by conduct, slowly. Each of these becomes a conduct row, an existing one or a new one, or
is removed.

## What the swap changes in the game

The largest pieces of work, by size:

1. **Cash moves only by transfers.** 42 files change a character's cash directly, in 254 places. The game's ledger
   (`ledger.post`) records only movements inside the player's circle, and its checks (`ledgerCheck`, `audit`) cover
   businesses and debts, not characters' cash. So nothing now proves that a character's cash adds up, which the overhaul's
   cast does. Every one of those changes becomes a transfer with a reason and a time.
2. **No player flag.** `isPlayer` is read in 532 places in 72 files. Each becomes `id === w.playerId`, or better, stops
   asking: a rule that treats the player differently is a deliberate difference, and the plan keeps those few and named.
3. **Feelings and knowledge only through the cast.** Every change above that bypasses `core.ts` goes through the cast's
   operations instead: a fact recorded, a telling, a roll, a fight.
4. **Meeting.** The game marks two people as having met in 35 places, most of them with no roll or fact (a meeting, a
   shift at work). The cast makes people meet only through a roll, a fight, a fact, a telling or drinking together, so it
   needs a plain way to record that two people spent time together. This is new, and is listed under [Decisions](#decisions).
5. **Hurt as hit points.** 15 files hurt someone by setting `hurtUntil` to a time. Each gives damage instead, and healing
   over time (on the plan's Before the swap list) replaces the end time.
6. **Trait changes as conduct,** as listed above.
7. **Organisation, books, police, commitments and the rest** move off the character into their own records, keyed by id.
   This is mostly mechanical (`c.rank` becomes a lookup), but `familyId`, `rank` and `bossId` are read in over 100 files
   each.

Two records share names with the overhaul's and mean different things:

- **Jobs.** The game's `Job` (`w.jobs`) is a task given to one person by a boss or a tip, with pay and an expiry. The
  overhaul's job is a group of characters doing something together, with a plan. A game job with a crew becomes an overhaul
  job for the planning; the game's job record keeps the offer, the pay and the outcome.
- **Facts.** The game's fact also holds its text, what people say when they do not know who did it, where it happened, and
  whether it is minor or has spread by gossip. The overhaul's fact holds none of these. Minor facts are on the plan's
  Before the swap list; the text and the place stay in the game's own view of a fact, keyed by its id, or are added to the
  overhaul's fact. That is decided with retention.

## Decisions

Proposals that need the owner, to take one at a time:

| Decision | Proposal |
| --- | --- |
| **Making characters by rank.** The game's world generator rolls five skills, better for higher ranks (0.2 to 0.85, against 0.1 to 0.6 for civilians), and one gift | The generator rolls overhaul characters with a background suited to their role and a proficiency bonus by rank: 2 for civilians and associates, rising to 4 for a boss |
| **Skills growing with use.** In the game every job adds 0.025 to the skills it needs (`people.ts` `grow`); the overhaul's training never changes | To decide: training that rises with practice, or none |
| **Which courage to keep.** The game has the `courage` trait and the `nerve` skill | Keep both, as the overhaul does: courage decides what someone does after failing a nerve check, Nerve decides whether they fail it |
| **Backgrounds at character creation.** The game offers six (`hustler`, `connected`, `business`, `union`, `bookmaker`, `wheelman`), each with two skills and starting cash; the overhaul has eight | The creation screen offers the overhaul's backgrounds, or the overhaul takes the game's six as its own |
| **Starting relationships.** The game begins some at 0.25 to 0.4, the overhaul at 0.5 | Let the caller give a first relationship its values when it has a reason (a boss meeting a new man is wary), and keep 0.5 otherwise |
| **Spending time together.** The game marks meeting in 35 places with no roll | Add a plain operation for it: people who spent time together meet, at a time, with nothing else changing |
| **Inferred knowledge.** `insight` is what the player has worked out about people | A fourth provenance, inferred, next to seen, told and heard, as invariant A already names |
| **Introductions.** `intro` is who the player has been introduced to | An introduction is a meeting, by the operation above, so `intro` goes |
| **Stolen goods.** `cars` and `goods` are counts and values | Stolen cars become items, since a car is a thing with a history (`w.cars` already tracks them); stolen goods stay a value in the economy |
| **Personal problems.** `problem`: gambling, debt, drink and so on, with how bad it is | Its own record, keyed by id; a problem that should change rolls (drink) does it through an effect |
| **Sleeping.** The game's characters keep hours (`wake`, `sleep`) | Someone asleep is resting, so unavailable, which is also what attacking someone asleep needs |
| **Who counts as there.** The overhaul has no places; the game has `district` | The caller decides who is there, as now, from the game's districts |

## What this does not cover

- **The game's other records** (businesses, debts, families, favours, situations), except where a character field points
  at them. Each needs the same mapping when its system moves; this one is only the character.
- **Each read.** Reads of a field that stays where it is need no change, and are only counted.
- **Behaviour.** This maps where things are stored, not whether the game behaves the same afterwards. That is the shadow run.
