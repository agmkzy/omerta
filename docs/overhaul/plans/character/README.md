# Character: one object for every character

**Status:** design agreed in discussion on 2 November 2026. Nothing is built. The rules tables in [Still to decide](#still-to-decide) must be agreed before the code that uses them is written.

## Purpose

One character object that can represent any character in the game, the player included. It is built up from the [character lab](../../../../lab/character/README.md) (attributes, skills, temperament, checks, social actions, fights), extended with inventory, condition, relationships and knowledge, and written so that it can later be slotted into the game.

It does not replace the game's `Character` (`src/types.ts`) yet, and it is not modelled on it. Where the game already has a concept that this needs, such as knowledge or relationships, the design follows the game's meaning so the two can be joined later.

## Where it lives and how it is built

- **Folder:** `src/character/`, self-contained. Nothing in it imports from the rest of the game; an architecture test fails if anything does.
- **Types:** its own tsconfig with the lab's stricter settings (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax` and the rest). The game's looser settings still accept it.
- **Tests:** written first, with Vitest and `node:assert`, each tagged with one kind (`unit`, `property`, `statistical`). Its own Vitest config holds coverage at 100%.
- **Modules:** small, each owning one rule. A rule is written once and everything else uses it.
- **Determinism:** dice are always passed in and seeded. No `Math.random`, no wall-clock time.

## Shape

A character is plain data: a record that can be saved and loaded as it is. A handle wraps it to give a fluent interface:

```ts
const sam = character(samData);
const rico = character(ricoData);

sam.skills.brawling;            // training, the attribute used, the bonus and its parts
sam.data;                       // the plain record
```

**An action returns a check before any dice are rolled.** The check can be given more modifiers, asked for its odds and explanation, then rolled:

```ts
const check = sam.social.intimidate(rico)
  .with({ value: -3, reason: 'Rico saw the money himself' });

check.odds();                   // the chance of each outcome
check.explain();                // every modifier, with its reason
const { result, actor, target } = check.roll(dice);
```

**Characters never change in place.** A result carries new versions of the characters it changed; `sam` and `rico` above are as they were. When this is slotted into the game, results are written back to the world through one function, so nothing else edits characters directly.

**The player and NPCs are the same type.** There is no player flag in the character. Every character has an id, which relationships and knowledge refer to.

## What a character holds

| Part | What it is |
| --- | --- |
| Identity | Id, name, background |
| Attributes | The six [attributes](#attributes), 1 to 20 |
| Skills | Training in each [skill](#skills) (untrained, trained or expert) and the proficiency bonus (2 to 6) |
| Temperament | One stored set of [traits](#temperament), each 0 to 1 |
| Condition | Current hit points and temporary effects (for example hurt, shaken, drunk). An effect lasts until something clears it. |
| Inventory | Items, each of which can carry situational modifiers |
| Relationships | How this character feels about each other character, one-way |
| Knowledge | This character's own version of each event they know about |

A skill's status is its training plus any temporary effects, so its bonus lists every part:

```ts
sam.skills.brawling;
// { training: 'trained', bonus: 2,
//   modifiers: [Strength 14 +2, Trained +2, Hurt −2] }
```

### Relationships

One-way: how Rico feels about Sam can differ from how Sam feels about Rico. Each relationship holds everything the game's `Rel` holds: trust, respect, affection, grudge, fear, familiarity (how well they know each other), when they last met, and the reasons behind the grudge and the regard.

```ts
rico.towards(sam);   // { trust: 0.4, respect: 0.7, affection: 0.2, grudge: 0.1, fear: 0.6, ... }
```

### Knowledge

Follows the game's model (`Fact` and `Knowledge` in `src/types.ts`, `addFact` and `learn` in `src/core.ts`):

- **An event is recorded once,** in a list shared by everyone: what kind of event, who did it, who it was done to, any business or amount, when, where, the event that caused it, and whether who did it is hidden.
- **Each character holds their own version** of the events they know about: when they learned it; where it came from (they did it, they witnessed it, it was public, or who told them); whether they know who did it; how they came by it (seen, told by a witness, heard second-hand); who they believe did it when they don't know, which can be wrong; and whether they heard it exaggerated.

So the character holds versions, not the events themselves, and the handle needs access to the shared list of events.

### Temperament of the player

The player's temperament starts neutral (0.5 for every trait) and moves with what the player does, as the game's `conduct` record does now.

## Checks and modifiers

- **The roll decides the response** in social checks, as decided in the lab ([Social actions](../../../../lab/character/README.md#social-actions)). What the target knows, what is at stake for them, their relationship with the actor and their temperament are all modifiers on the roll. A certain outcome is the same as a modifier large enough to make the check impossible, so social checks have no automatic success.
- **The character works out its own modifiers** from rules tables: temperament (as the lab does now), knowledge and relationships, items, and temporary effects. Every modifier carries its reason, so an explanation always says where each number came from.
- **Situational modifiers** can still be added to any check with `.with(...)`.

## Fights

- One against one: `sam.fight(rico)`. Groups are called squads: `squad(sam, joe).fight(squad(rico))`. ("Crew" already means a captain's men in the game.)
- **Fights have named kinds.** A sparring match starts at full health and nothing lasts afterwards. A real fight starts from each character's current condition, and the damage stays.

## Words

Where a lab word and a game word mean the same thing, the game's word is used. Each was decided separately.

### Attributes

The game has none, so the lab's six are kept: Strength, Agility, Constitution, Intelligence, Wisdom, Charisma.

### Skills

| Skill | Attribute | Covers | Against the game |
| --- | --- | --- | --- |
| Brawling | Strength | Unarmed and improvised-weapon fighting | The game's `muscle` is closer to Strength; not the same meaning |
| Intimidation | Charisma (or Strength) | Coercing someone through threats | The game uses `nerve` for putting pressure on someone; that use belongs here |
| Firearms | Agility | Using guns accurately under pressure | — |
| Reflexes | Agility | Reaction speed: dodging, grabbing, acting first | — |
| Driving | Agility | Driving under pressure: pursuits and evasion | Same word and meaning as the game's `driving` |
| Stealth | Agility | Moving unseen and unheard | — |
| Larceny | Agility | Lockpicking, safecracking, pickpocketing, hot-wiring | — |
| Toughness | Constitution | Withstanding injury, pain and exhaustion | — |
| Carousing | Constitution | Tolerance for alcohol and late nights | — |
| Bookkeeping | Intelligence | Financial records, and spotting errors or fraud in them | Part of the game's `brains`; see [Bookkeeping](#bookkeeping) |
| Planning | Intelligence | Preparing a job or a move; see [Planning](#planning) | Replaces the lab's Scheming |
| Mechanics | Intelligence | Repairing and operating engines, machines and electrics | — |
| Streetwise | Wisdom | Local knowledge: rumours, contacts, finding people | — |
| Insight | Wisdom | Reading people's intentions and detecting lies | — |
| Notice | Wisdom | Perception: spotting details, surveillance and danger | — |
| Nerve | Wisdom (or Constitution) | Staying composed under threat or interrogation | Same word as the game's `nerve`, for its composure use |
| Persuasion | Charisma | Negotiation and convincing others | The game's `charm` covers both this and Deception |
| Deception | Charisma | Lying convincingly | See Persuasion |

### Temperament

One stored set of traits, each 0 to 1. The game has two layers (stored traits, and a temperament worked out from them in `src/temper.ts`); this keeps one.

| Trait | Low | High | Against the game |
| --- | --- | --- | --- |
| Greed | content | greedy | Same |
| Violence | gentle | violent | Same |
| Ambition | unambitious | ambitious | Same |
| Caution | reckless | cautious | Same |
| Sociability | solitary | sociable | Same |
| Vice | abstemious | indulgent | Same |
| Courage | timid | brave | Same |
| Pride | humble | proud | Same as the game's worked-out `pride` |
| Volatility | calm | volatile | The game's word for the lab's "temper" (losing control when provoked) |
| Agreeable | stubborn | agreeable | Added from the game: looking for a deal, meeting someone halfway |
| Empathy | detached | compassionate | Added from the game: being moved by another's circumstances. Related to Cruelty, but not its opposite |
| Loyalty | disloyal | loyal | Lab only |
| Honesty | dishonest | honest | Lab only |
| Cruelty | kind | cruel | Lab only |

## Planning

A roll made before a job or a move. Its result becomes modifiers on the checks that follow.

- One character plans, rolling Planning (Intelligence) against a DC the job sets: for example 10 for a simple job, 15 for a tricky one, 20 for a hard one.
- The result applies to every skill check made by anyone following the plan during that job:

| Outcome | Effect on the job's checks |
| --- | --- |
| Critical success | +2, and advantage on one check of the planner's choosing |
| Success | +2 |
| Partial success | +1 |
| Failure | No change |
| Critical failure | −2: the plan is wrong, and following it makes things worse |

- There is one plan per job, and a job cannot be replanned.
- The planner does not know exactly how good the plan is: a critical failure looks like a failure to them, so they follow a bad plan without knowing.
- The modifier is named in each check's explanation, for example "A good plan +2".
- Fight rolls are not affected, for now.

```ts
const plan = sam.planning.plan(burglary).roll(dice);
squad(sam, joe).following(plan).larceny.check(15);   // includes "A good plan +2"
```

## Bookkeeping

Where it would be used once this is slotted into the game, which now uses `brains` for these:

- **Hiding a skim:** reporting less than was earned to a superior (`src/books.ts`), as an opposed check of the skimmer's Bookkeeping against the superior's.
- **Spotting a skim:** the same check from the other side.
- **Running a business, a loan book or a numbers game well:** in place of `brains` in a business's management quality (`src/econ.ts`).

The rules for these are not set.

## Still to decide

1. **Temporary effects:** which effects there are, what each does to which skills, and what clears them.
2. **Knowledge and relationships:** the rules table that turns what a character knows, and how they feel about someone, into modifiers.
3. **Items:** the first items and their effects. Whether cash is an item or a separate value.
4. **Fight kinds:** what each named kind does beyond sparring and a real fight, and whether there are others.
5. **Planning:** whether another character can help (giving the planner advantage), and whether Wisdom can be used instead of Intelligence.
6. **Access to events:** whether the handle is given the shared list of events when it is made (`character(data, events)`) or each action is.
