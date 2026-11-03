# Character: one object for every character

**Status:** design agreed in discussion on 2 November 2026. Nothing is built. What waits for slotting it into the game is under [Later](#later).

## Purpose

One character object that can represent any character in the game, the player included. It is built up from the [character lab](../../../../lab/character/README.md) (attributes, skills, temperament, checks, social actions, fights), extended with inventory, condition, relationships and knowledge, and written so that it can later be slotted into the game.

It does not replace the game's `Character` (`src/types.ts`) yet, and it is not modelled on it. Where the game already has a concept that this needs, such as knowledge or relationships, the design follows the game's meaning so the two can be joined later.

## Where it lives and how it is built

- **Folders, kept separate from the game:** the overhaul's code goes in `src/overhaul/` and its tests in `tests/overhaul/`, so this plan's code is `src/overhaul/character/` with its tests in `tests/overhaul/character/`. Nothing in `src/overhaul/` imports from the rest of `src/`, and nothing in the game imports from `src/overhaul/` until it is slotted in; an architecture test fails if either happens.
- **Its own configuration:** a tsconfig, a Vitest config and npm scripts (`overhaul:test`, `overhaul:typecheck`, `overhaul:cov`), as the lab has. The game's Vitest config finds tests only in `src/tests/`, so it does not run these. Its coverage counts all of `src/`, so it must exclude `src/overhaul/**`; that is the only change to the game's own configuration.
- **Types:** the lab's stricter settings (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax` and the rest). The game's typecheck also covers `src/`, and its looser settings still accept the code.
- **Tests:** written first, with Vitest and `node:assert`, each tagged with one kind (`unit`, `property`, `statistical`). Coverage is held at 100%.
- **Modules:** small, each owning one rule. A rule is written once and everything else uses it, and every rules table below is data in one place.
- **Determinism:** dice are always passed in and seeded. No `Math.random`, no wall-clock time.

## Shape

**A cast holds everyone.** One plain record holds every character and every event, so relationships and knowledge can refer to anyone by id. It can be saved and loaded as it is. Handles for characters come from it and give a fluent interface:

```ts
const everyone = cast({ characters, events });
const sam = everyone.character('sam');
const rico = everyone.character('rico');

sam.skills.brawling;            // training, the attribute used, the bonus and its parts
sam.inventory.cash;             // 120
rico.towards(sam);              // how Rico feels about Sam
sam.data;                       // the plain record
```

**An action returns a check before any dice are rolled.** The check works out its own modifiers, can be given more, can be asked for its odds and explanation, then rolled:

```ts
const check = sam.social.intimidate(rico)
  .with({ value: -3, reason: 'Rico has the police outside' });

check.odds();                   // the chance of each outcome
check.explain();                // every modifier, with its reason
const outcome = check.roll(dice);
outcome.result;                 // what happened
outcome.cast;                   // a new cast, with Sam, Rico and any new events updated
```

**Nothing changes in place.** A roll returns a new cast; `everyone`, `sam` and `rico` above are as they were. When this is slotted into the game, a new cast is written back to the world through one function, so nothing else edits characters directly.

**The player and NPCs are the same type.** There is no player flag in the character. Every character has an id.

## What a character holds

| Part | What it is |
| --- | --- |
| Identity | Id, name, background |
| Attributes | The six [attributes](#attributes), 1 to 20 |
| Skills | Training in each [skill](#skills) (untrained, trained or expert) and the proficiency bonus (2 to 6) |
| Temperament | One stored set of [traits](#temperament), each 0 to 1 |
| Condition | Current hit points and [temporary effects](#condition-and-temporary-effects) |
| Inventory | Cash, as a number, and [items](#inventory) |
| Relationships | How this character feels about each other character, one-way: see [Relationships](#relationships) |
| Knowledge | This character's own version of each event they know about: see [Knowledge](#knowledge) |

A skill's status is its training plus any temporary effects, so its bonus lists every part:

```ts
sam.skills.brawling;
// { training: 'trained', bonus: 2,
//   modifiers: [Strength 14 +2, Trained +2, Hurt −2] }
```

### Temperament of the player

The player's temperament starts neutral (0.5 for every trait) and moves with what the player does, as the game's `conduct` record does now.

## Condition and temporary effects

| Effect | When it starts | What it does | How it ends |
| --- | --- | --- | --- |
| Hurt | Hit points at or below half. Read from hit points, not stored, so the two can never disagree. | −2 to skills using Strength, Agility or Constitution. Never applied during fights: the nerve check at half health already marks that moment, and a penalty on top would make fights snowball. | Healing back above half |
| Shaken | Losing their nerve in a fight, or giving in to intimidation | −2 to Nerve, and −2 to resisting intimidation | Cleared explicitly, for example by resting |
| Drunk | Set explicitly, or by failing a Carousing check (DC 12) on drinking a bottle of spirits; someone already drunk stays drunk | −2 to skills using Agility or Intelligence, and to Insight and Notice; +2 to Nerve | Cleared explicitly, for example by sobering up |

An effect does not stack with itself; different effects add together. Each is named in explanations, for example "Hurt −2".

## Inventory

**Cash is a separate number,** not an item. In the game, money moves only through the ledger, where every transfer is recorded, so keeping it apart makes it easy to join to that later.

**An item** has a name and a list of effects. Each effect has a situation, a value, and when it applies: while carried, while shown (or worn), or when used. A carried weapon is hidden unless it is shown.

| Item | Effect |
| --- | --- |
| Knife | Can be drawn for armed intimidation: nerve DC 12 |
| Pistol | Can be drawn for armed intimidation: nerve DC 15 |
| Lockpicks | +2 to Larceny for locks, when used |
| Toolkit | +2 to Mechanics, when used |
| Good suit | +1 to Persuasion, while worn |
| Bottle of spirits | Drinking it means a Carousing check against DC 12; failing it makes the character Drunk |

Armed intimidation works as it does in the lab: the target makes a nerve check against the weapon first, and the actor rolls with advantage. With an inventory, a character can intimidate armed only if they carry a weapon, and the weapon sets the nerve DC.

### Weapons in fights

| Weapon | Skill | Damage |
| --- | --- | --- |
| Unarmed | Brawling | 1d4 + Strength, as in the lab |
| Knife | Brawling | 1d6 + Strength |
| Pistol | Firearms | 2d6, with no Strength |

Drawing a weapon during a fight makes each opponent take one nerve check against the weapon's DC (12 for a knife, 15 for a pistol), using the lab's existing "weapon drawn" trigger. These numbers change fight balance, so they are a starting point, checked and tuned with statistical tests on simulated fights once built.

## Relationships

One-way: how Rico feels about Sam can differ from how Sam feels about Rico. Each relationship holds everything the game's `Rel` holds: trust, respect, affection, grudge, fear, familiarity (how well they know each other), when they last met, and the reasons behind the grudge and the regard.

```ts
rico.towards(sam);   // { trust: 0.4, respect: 0.7, affection: 0.2, grudge: 0.1, fear: 0.6, ... }
```

### As modifiers on social checks

"High" and "low" mean the same as for temperament: 0.7 or more, and 0.3 or less. Every modifier is on the actor's roll.

**How the target feels about the actor:**

| Action | Modifiers |
| --- | --- |
| Persuade | Trust high +2, trust low −2; affection high +1; grudge high −2 |
| Deceive | Trust high +2; familiarity high −1 (they know the actor's tells); grudge high −1 (suspicious) |
| Intimidate | Fear high +2; respect high +1; grudge high −1 |

**How the actor feels about the target:**

| Action | Modifiers |
| --- | --- |
| Persuade | Familiarity high +1 (they know what moves the target) |
| Deceive | Familiarity high +1 (they know what the target will believe); affection high −1 (lying to someone they are fond of is harder) |
| Intimidate | Affection high −1 (they hold back); grudge high +1 (they mean it); fear high −2 (it is hard to threaten someone you are afraid of) |

### Aftermath

A social result changes how the target feels about the actor. Values run from 0 to 1, so these are small steps, as in the game.

| Result | Change |
| --- | --- |
| Intimidation: the target gives in | Fear +0.1, grudge +0.05, trust −0.05 |
| Intimidation: the target resists | Respect −0.05 |
| Intimidation: the target is provoked | Grudge +0.1 |
| Persuasion: succeeds | Trust +0.02 |
| Persuasion: fails | None |
| Deception: succeeds | None: the target does not know they were lied to. The lie is recorded as an event only the actor knows about, so it can come out later. |
| Deception: caught lying | Trust −0.15, grudge +0.05 |

Intimidation also changes how the actor feels about the target:

| Result | Change in the actor's feelings |
| --- | --- |
| The target gives in | Respect −0.05 |
| The target resists | Respect +0.05 |

## Knowledge

Follows the game's model (`Fact` and `Knowledge` in `src/types.ts`, `addFact` and `learn` in `src/core.ts`):

- **An event is recorded once,** in the cast's list of events: what kind of event, who did it, who it was done to, any business or amount, when, where, the event that caused it, and whether who did it is hidden.
- **Each character holds their own version** of the events they know about: when they learned it; where it came from (they did it, they witnessed it, it was public, or who told them); whether they know who did it; how they came by it (seen, told by a witness, heard second-hand); who they believe did it when they don't know, which can be wrong; and whether they heard it exaggerated.

### As modifiers on Deception

A lie names the event it is about: `sam.social.deceive(rico).about(eventId)`. The modifier comes from the target's own version of that event.

| What the target knows of the event | Modifier |
| --- | --- |
| Saw it, or took part in it | Impossible, explained as "Rico saw it himself" |
| Was told by a witness | −4 |
| Heard it second-hand | −2 |
| Does not know about it | None |
| The lie matches what they already believe, such as who they blame | +2 |

Intimidation has no knowledge modifier of its own: hearing what someone has done already raises fear of them (as `learn` does in the game), and fear is in the relationship table, so a separate modifier would count it twice.

## Checks and modifiers

- **The roll decides the response** in social checks, as decided in the lab ([Social actions](../../../../lab/character/README.md#social-actions)). What the target knows, what is at stake for them, how each feels about the other and their temperament are all modifiers on the roll. A certain outcome is the same as a modifier large enough to make the check impossible, so social checks have no automatic success.
- **The character works out its own modifiers** from the rules tables: temperament (as the lab does now), temporary effects, items, relationships and knowledge. Every modifier carries its reason, so an explanation always says where each number came from.
- **Situational modifiers** can still be added to any check with `.with(...)`.

## Fights

One against one: `sam.fight(rico)`. Groups are called squads: `squad(sam, joe).fight(squad(rico))`. ("Crew" already means a captain's men in the game.)

| Kind | Starts from | Nerve checks | Afterwards |
| --- | --- | --- | --- |
| Sparring | Full health | None: nobody flees or surrenders | Ends when someone first drops to half health, and they lose. Nothing lasts, and no event is recorded |
| Real fight | Current condition | As in the lab | Damage stays, and the fight is recorded as an event that witnesses learn about |

```ts
sam.fight(rico, { kind: 'sparring' });
squad(sam, joe).fight(squad(rico), { kind: 'real' });
```

### Beatings

A beating is not a separate kind: it is a real fight that the attackers start by setting on the target, and whether the target fights back is decided by their nerve and temperament, as with any nerve check.

1. **The attackers have advantage on their attacks in the first round,** because the target is caught or held. After that the normal rules apply, including advantage for ganging up.
2. **The target makes a nerve check when set upon:** DC 10, plus 2 for each attacker beyond the first. Nerve includes temperament, as it does in the lab.
   - **Pass:** they fight back, and it is an ordinary real fight.
   - **Fail:** temperament decides, by the lab's nerve rules: low courage or high caution flees; high volatility fights back anyway; anyone else takes it. Someone taking it does not attack, and the attackers keep their advantage against them.
3. **The usual nerve checks still apply,** at half health and when half a side is down, so someone who fought back can still give in.
4. **Someone taking it can snap:** at half health they make another nerve check, and on failing it a volatile character fights back.
5. **The recorded event comes from what happened.** If the target took it, it is a beating, and the target's feelings towards each attacker change by their courage: a brave target bears a grudge, a timid one becomes afraid, and trust drops either way.

| Change | Amount |
| --- | --- |
| Grudge | +0.15 × (0.4 + 0.6 × courage) |
| Fear | +0.15 × (1 − courage) × 0.8 |
| Trust | −0.075 |

If the target fought back, it is recorded as a fight.

```ts
squad(sam, joe).fight(squad(rico), { kind: 'real', start: 'set-upon' });
```

### Ambushes

An ambush is a real fight that the attacking squad starts unseen. Before it begins, the squad's lowest Stealth roll (the noisiest of them gives them away) is compared with each target's passive Notice: 10 plus their Notice bonus. A target who does not notice is surprised and cannot act in the first round. If every target notices, it is an ordinary real fight.

```ts
squad(sam, joe).fight(squad(rico), { kind: 'real', start: 'ambush' });
```

### Fleeing

Wanting to flee and getting away are separate. A failed nerve check (for a character whose temperament makes them run), or a character's own choice, makes them try to flee; getting away is a roll. This replaces the lab's rule, where fleeing takes a character out of the fight at once.

On their turn, instead of attacking, a fleeing character makes an escape check: their Reflexes against the highest Reflexes among the enemies still fighting, opposed, with ties going to the chaser as in every opposed check.

| Outcome | What happens |
| --- | --- |
| Critical success | They get away cleanly |
| Success | They get away cleanly |
| Partial success | They get away, but the nearest enemy gets one free attack first |
| Failure | Caught: still in the fight, and attacks against them have advantage until their next turn, when they try again |
| Critical failure | Caught and cornered: they cannot try again, and their temperament decides whether they fight back or take it |

- **Held:** in the first round of a beating the target is held, so breaking free is Brawling against the holder's Brawling instead.
- **No one to chase them:** with no enemy still fighting, they get away without a roll.
- **Choosing to run:** anyone can choose to flee on their turn. The player chooses for themselves; NPCs flee only by the nerve rules, for now.
- **Balance:** fleeing characters now stay in the fight longer and can be hit while running, so the numbers are checked with statistical tests on simulated fights once built.

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
| Planning | Intelligence (or Wisdom) | Preparing a job or a move; see [Planning](#planning) | Replaces the lab's Scheming |
| Mechanics | Intelligence | Repairing and operating engines, machines and electrics | — |
| Streetwise | Wisdom | Local knowledge: rumours, contacts, finding people | — |
| Insight | Wisdom | Reading people's intentions and detecting lies | — |
| Notice | Wisdom | Perception: spotting details, surveillance and danger | — |
| Nerve | Wisdom (or Constitution) | Staying composed under threat or interrogation | Same word as the game's `nerve`, for its composure use |
| Persuasion | Charisma | Negotiation and convincing others | The game's `charm` covers both this and Deception |
| Deception | Charisma | Lying convincingly | See Persuasion |

A skill with an alternative attribute uses whichever of the two is higher, as in the lab.

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

- One character plans, rolling Planning (Intelligence or Wisdom, whichever is higher) against a DC the job sets: for example 10 for a simple job, 15 for a tricky one, 20 for a hard one.
- One other character taking part in the job can help, giving the planner advantage on the roll. More helpers add nothing more.
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
- Fight rolls are not affected. A plan helps a fight through the checks around it instead, such as the Stealth roll for an ambush.

```ts
const plan = sam.planning.plan(burglary).helpedBy(joe).roll(dice);
squad(sam, joe).following(plan).larceny.check(15);   // includes "A good plan +2"
```

## Bookkeeping

Where it would be used once this is slotted into the game, which now uses `brains` for these:

- **Skimming:** reporting less than was earned to a superior (`src/books.ts`).
- **Running a business, a loan book or a numbers game well:** in place of `brains` in a business's management quality (`src/econ.ts`).

### Skimming

The skimmer chooses how much of their earnings to hide. The superior checks the books: the superior's Bookkeeping against the skimmer's, opposed, with the skimmer at −1 for every 10% of earnings hidden, so hiding more is harder.

| The superior's outcome | What happens |
| --- | --- |
| Success or better | They know: recorded as an event they saw for themselves in the books |
| Partial success | They suspect: trust −0.05, with no event recorded |
| Failure or worse | Nothing |

### Running a business

Left until the character is slotted into the game: it would replace the game's management-quality formula in `src/econ.ts`, which changes the game's economy, and this work stays separate from the game until then.

## Later

Left until the character is slotted into the game:

- **Running a business** with Bookkeeping, as above.
