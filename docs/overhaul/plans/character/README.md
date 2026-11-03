# Character: one object for every character

**Status:** design agreed in discussion on 2 and 3 November 2026, and revised after an adversarial review. Nothing is built. What waits for slotting it into the game is under [Later](#later).

## Purpose

One character object that can represent any character in the game, the player included. It is built up from the [character lab](../../../../lab/character/README.md) (attributes, skills, temperament, checks, social actions, fights), extended with inventory, condition, relationships and knowledge, and written so that it can later be slotted into the game.

It does not replace the game's `Character` (`src/types.ts`) yet, and it is not modelled on it. Where the game already has a concept that this needs, such as knowledge or relationships, the design follows the game's meaning so the two can be joined later.

## Where it lives and how it is built

- **Folders, kept separate from the game:** the overhaul's code goes in `src/overhaul/` and its tests in `tests/overhaul/`, so this plan's code is `src/overhaul/character/` with its tests in `tests/overhaul/character/`. Nothing in `src/overhaul/` imports from the rest of `src/`, and nothing in the game imports from `src/overhaul/` until it is slotted in; an architecture test fails if either happens.
- **Its own configuration:** a tsconfig, a Vitest config and npm scripts (`overhaul:test`, `overhaul:typecheck`, `overhaul:cov`), as the lab has. The game's Vitest config finds tests only in `src/tests/`, so it does not run these.
- **Two changes to the game's configuration:** the game's coverage counts all of `src/`, so it excludes `src/overhaul/**`; and CI (`.github/workflows/ci.yml`) gains an overhaul job that runs the overhaul's typecheck and tests, so the boundary test runs on every push.
- **Types:** the lab's stricter settings (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax` and the rest), with the game's `lib` setting, so that code passing the overhaul's typecheck also passes the game's (which covers all of `src/`).
- **Tests:** written first, with Vitest and `node:assert`, each tagged with one kind (`unit`, `property`, `statistical`). Coverage is held at 100%.
- **Modules:** small, each owning one rule. A rule is written once and everything else uses it, and every rules table below is data in one place.
- **Determinism:** dice are always passed in and seeded. No `Math.random`, no wall-clock time. Everything else the model cannot know is an explicit input (see [Inputs](#inputs)).

## Shape

**A cast holds everyone.** One plain record holds every character, every fact and every cash transfer, so relationships and knowledge can refer to anyone by id. Handles for characters come from it and give a fluent interface:

```ts
const everyone = cast({ characters, facts });
const sam = everyone.character('sam');
const rico = everyone.character('rico');

sam.skills.larceny;             // training, the attribute used, the bonus and its parts
sam.inventory.cash;             // 120
rico.towards(sam);              // how Rico feels about Sam
sam.data;                       // the plain record
```

**An action returns a check before any dice are rolled.** The check works out its own modifiers, can be given more, can be asked for its odds and explanation, then rolled:

```ts
const check = sam.social.intimidate(rico)
  .with({ value: -3, reason: 'Rico has the police outside' });

check.odds({ for: sam });       // the chance of each outcome, as Sam can judge it
check.explain({ for: sam });    // the modifiers Sam can know about, with their reasons
const outcome = check.roll(dice, { now, witnesses: ['joe'] });
outcome.result;                 // what happened
outcome.cast;                   // a new cast, with Sam, Rico and any new facts updated
```

**Odds and explanations never leak private state.** They are always given to someone. The viewer's own modifiers are exact; another character's modifiers (their feelings, their knowledge, their effects) count only where the viewer knows them, and anything the viewer does not know counts as zero. So asking the odds of lying to Rico does not reveal whether Rico saw the fact, unless Sam knows Rico was a witness. The true numbers are used only by the roll itself, and by tests.

**Nothing changes in place.** A roll returns a new cast; `everyone`, `sam` and `rico` above are as they were.

- **No lost changes:** each handle and check is tied to the cast it came from, and rolling a check made from an older cast is refused, so one roll can never silently undo another.
- **No copying the world:** a new cast shares everything that did not change with the old one, so a roll costs only what it changes.
- **One record:** once it is slotted into the game, the cast *is* the game's record of characters and facts, not a copy written back to it.
- **Cash moves only by recorded transfers:** a transfer names who paid whom, how much and why, as the game's ledger does, and a character's cash is never set directly.

**The player and NPCs are the same type.** There is no player flag in the character. Every character has an id.

### Inputs

What the model cannot work out for itself is passed in, so the same inputs always give the same result:

- **Dice:** seeded, as in the lab.
- **Time:** each roll is given `now`, for when a fact happened, when a character learned it, and when two characters last met.
- **Witnesses:** named at the call. With no positions, nothing else decides who saw what.
- **Fact ids:** made by a counter in the cast, so they are deterministic. When slotted in, they come from the game's own id counter.

### Saves

The cast carries a format number. Every change to its shape adds a migration from the previous format, and migrations are never deleted, as the game requires of its own saves.

## What a character holds

| Part | What it is |
| --- | --- |
| Identity | Id, name, background |
| Attributes | The six [attributes](#attributes), 1 to 20 |
| Skills | Training in each [skill](#skills) (untrained, trained or expert) and the proficiency bonus (2 to 6) |
| Temperament | One stored set of [traits](#temperament), each 0 to 1 |
| Condition | Current hit points and [temporary effects](#condition-and-temporary-effects) |
| Inventory | Cash, as a number, and [items](#inventory) |
| Relationships | How this character feels about each other character they have met, one-way: see [Relationships](#relationships) |
| Knowledge | This character's own version of each fact they know about: see [Knowledge](#knowledge) |

A skill's status is its training plus any temporary effects, so its bonus lists every part:

```ts
sam.skills.larceny;
// { training: 'trained', bonus: 2,
//   modifiers: [Agility 14 +2, Trained +2, Hurt −2] }
```

### Temperament of the player

The player's temperament starts neutral (0.5 for every trait) and moves with what the player does. It works exactly as any character's does: it gives modifiers on the player's own rolls and decides their response to a failed nerve check. This is a deliberate difference from the game, where the player's temperament never limits what they can do. The traits are stored like anyone's; the player's conduct is the record of what moved them, so it is the recorded cause of each change, not a second copy of the traits.

## Condition and temporary effects

| Effect | When it starts | What it does | How it ends |
| --- | --- | --- | --- |
| Hurt | Hit points at or below half. Read from hit points, not stored, so the two can never disagree. | −2 to skills using Strength, Agility or Constitution. Never applied during fights: the nerve check at half health already marks that moment, and a penalty on top would make fights snowball. | Healing back above half |
| Shaken | Losing their nerve in a fight, or giving in to intimidation | −2 to Nerve (which is also what resists intimidation) | Resting, or cleared explicitly |
| Drunk | Set explicitly, or by failing a Carousing check (DC 12) on drinking a bottle of spirits; someone already drunk stays drunk | −2 to skills using Agility or Intelligence, and to Insight and Notice; +2 to Nerve | Resting, or cleared explicitly |

An effect does not stack with itself; different effects add together. Each is named in explanations, for example "Hurt −2". Where a skill can use either of two attributes, Hurt and Drunk follow the attribute actually used.

**Resting** restores hit points to full and clears Shaken and Drunk: `sam.rest()`.

## Inventory

**Cash is a separate number,** not an item, and changes only by [recorded transfers](#shape).

**An item** has a name and a list of effects. Each effect names the skill it applies to, optionally a situation within that skill, a value, and when it applies:

- **Situations:** `locks` (Larceny), `repairs` (Mechanics), and so on: a short, fixed list kept with the rules tables. An effect with no situation applies to every check of that skill.
- **When it applies:** while carried, while shown, while worn, or when used.
- **State:** a carried weapon is hidden unless it is shown, and the inventory records which items are shown or worn. An item used up (a drunk bottle) leaves the inventory.

| Item | Effect |
| --- | --- |
| Knife | A weapon: see [Weapons](#weapons) |
| Pistol | A weapon: see [Weapons](#weapons) |
| Lockpicks | +2 to Larceny for locks, when used |
| Toolkit | +2 to Mechanics for repairs, when used |
| Good suit | +1 to Persuasion, while worn |
| Bottle of spirits | Drinking it means a Carousing check against DC 12; failing it makes the character Drunk. The bottle is used up. |

### Weapons

A weapon only frightens someone who has nothing to answer it with.

**In social checks,** a weapon the actor carries and shows is a modifier on intimidation, by how far it outclasses what the target carries:

| Actor's weapon | Target unarmed | Target has a knife | Target has a pistol |
| --- | --- | --- | --- |
| Knife | +2 | None | None |
| Pistol | +4 | +2 | None |

This replaces the lab's armed intimidation (a nerve check before the roll, and advantage for the actor).

#### In fights

| Weapon | Skill | Damage |
| --- | --- | --- |
| Unarmed | Brawling | 1d4 + Strength, as in the lab |
| Knife | Brawling | 1d6 + Strength |
| Pistol | Firearms | 2d6, with no Strength |

Weapons are part of a real fight from the start: there are no choices made mid-fight. Each armed character's attacks use their weapon's skill and damage. At the start, each unarmed fighter facing an armed opponent makes one nerve check against the strongest weapon they face (DC 12 for a knife, 15 for a pistol); an armed fighter does not. These numbers change fight balance, so they are a starting point, checked and tuned with statistical tests on simulated fights once built.

## Relationships

One-way: how Rico feels about Sam can differ from how Sam feels about Rico. Each relationship holds everything the game's `Rel` holds: trust, respect, affection, grudge, fear, familiarity (how well they know each other), when they last met, and the reasons behind the grudge and the regard.

```ts
rico.towards(sam);   // { trust: 0.4, respect: 0.7, affection: 0.2, grudge: 0.1, fear: 0.6, ... }
```

**Strangers:** a character has a relationship only with someone they have met. Between strangers there is no relationship, and so no relationship modifiers.

**Every change is damped,** the way the game's `feelOn` (`src/core.ts`) damps them: a value changes more slowly as it nears its limit, and trust and affection grow more slowly between people who barely know each other. The amounts in the tables below are before damping. There is one function that changes feelings, and everything uses it.

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
| Deceive | Affection high −1 (lying to someone they are fond of is harder) |
| Intimidate | Affection high −1 (they hold back); grudge high +1 (they mean it); fear high −2 (it is hard to threaten someone you are afraid of) |

### Aftermath

A social result changes how the target feels about the actor, following what each outcome means in the lab. Values run from 0 to 1, so these are small steps.

| Action | Outcome (as in the lab) | Change in the target's feelings |
| --- | --- | --- |
| Intimidate | Critical success: will not make trouble | Fear +0.15, trust −0.05 |
| Intimidate | Success | Fear +0.1, grudge +0.05, trust −0.05 |
| Intimidate | Partial success: resents it, may make trouble | Fear +0.1, grudge +0.1, trust −0.05 |
| Intimidate | Failure or critical failure: resists | Respect −0.05 |
| Intimidate | Provoked (a hot-tempered target, on a critical failure) | Grudge +0.1 |
| Persuade | Success or better | Trust +0.02 |
| Persuade | Partial success or failure | None |
| Persuade | Critical failure: harder to persuade next time | Trust −0.05 |
| Deceive | Partial success or better: believes it | None: they do not know they were lied to. Their version of the fact now has the actor as its source, so the lie can come out later. |
| Deceive | Failure: does not believe it | None |
| Deceive | Critical failure: knows they were lied to | Trust −0.15, grudge +0.05 |

Intimidation also changes how the actor feels about the target:

| Outcome | Change in the actor's feelings |
| --- | --- |
| The target gives in (partial success or better) | Respect −0.05 |
| The target resists | Respect +0.05 |

## Knowledge

Follows the game's model (`Fact` and `Knowledge` in `src/types.ts`, `addFact` and `learn` in `src/core.ts`):

- **A fact is recorded once,** in the cast's list of facts: what kind of fact, who did it, who it was done to, any business or amount, when, where, the fact that caused it, and whether who did it is hidden.
- **Each character holds their own version** of the facts they know about: when they learned it; where it came from (they did it, they witnessed it, it was public, or who told them); whether they know who did it; how they came by it (seen, told by a witness, heard second-hand); who they believe did it when they don't know, which can be wrong; and whether they heard it exaggerated.
- **Who learns a fact when it is recorded:** whoever did it, whoever it was done to, and the witnesses named at the call.
- **Learning a fact changes feelings,** by the game's own tables, carried over from `learn`: respect for what someone has done, fear of someone violent (more for the less brave), and for the victim a grudge or fear by their courage, with less trust either way. This is the only way facts change feelings, so nothing is counted twice: a beating changes the victim's feelings because they learn of it, and intimidation needs no knowledge modifier because fear already carries what the target has heard.

### As modifiers on Deception

A lie is a claim, in the same shape as a character's version of a fact. It is either a different version of a real fact (who did it, how big it was) or a fact that never happened. A fact that never happened is still recorded, marked false, so the simulation always knows the truth; only the liar knows it is false.

```ts
sam.social.deceive(rico).claim({ about: factId, blame: 'joe' });                // a different version of a real fact
sam.social.deceive(rico).claim({ invented: { kind: 'theft', actor: 'joe' } });  // a fact that never happened
```

When a lie succeeds, the target's version is updated with "told by the actor" as its source. If they later learn the truth, that is how the lie comes out. The modifier comes from the target's own version of the fact the claim is about:

| What the target knows of the fact | Modifier |
| --- | --- |
| Saw it, or took part in it | Impossible, explained as "Rico saw it himself" |
| Was told by a witness | −4 |
| Heard it second-hand | −2 |
| Does not know about it | None |
| The lie matches what they already believe, such as who they blame | +2 |

## Checks and modifiers

- **The roll decides the response** in social checks, as decided in the lab ([Social actions](../../../../lab/character/README.md#social-actions)). What the target knows, what is at stake for them, how each feels about the other and their temperament are all modifiers on the roll. A certain outcome is the same as a modifier large enough to make the check impossible, so social checks have no automatic success.
- **The character works out its own modifiers** from the rules tables: temperament (as the lab does now), temporary effects, items, relationships and knowledge. Every modifier carries its reason, so an explanation always says where each number came from.
- **Situational modifiers** can still be added to any check with `.with(...)`.

## Fights

One against one: `sam.fight(rico)`. Groups are called squads: `squad(sam, joe).fight(squad(rico))`. ("Crew" already means a captain's men in the game.)

| Kind | Starts from | Nerve checks | Afterwards |
| --- | --- | --- | --- |
| Sparring | Full health, unarmed | None: nobody flees or surrenders | Ends for everyone when the first fighter drops to half health, and their side loses. Nothing lasts, and no fact is recorded |
| Real fight | Current condition | As in the lab, plus the start-of-fight check against weapons | Damage stays, and the fight is recorded as a fact that the named witnesses learn |

```ts
sam.fight(rico, { kind: 'sparring' });
squad(sam, joe).fight(squad(rico), { kind: 'real' });
```

### How a fight ends for the losers

A real fight ends with each loser in one state:

| State | Meaning | Recorded as |
| --- | --- | --- |
| Beaten | Gave in while still conscious, whenever that happened, including straight away with no damage taken | A beating |
| Knocked out | Dropped to 0 hit points | A beating |
| Fled | Got away (see [Fleeing](#fleeing)) | A fight |

How badly a beaten character was hurt shows in their hit points. Killing is out of scope until it is decided whether weapons can kill. The victim's feelings towards the attackers change once, through [learning the recorded fact](#knowledge).

### Being set upon

A real fight can start with the attackers setting on a target:

1. The attackers have advantage on their attacks in the first round, because the target is caught or held. After that the normal rules apply, including advantage for ganging up.
2. The target makes a nerve check: DC 10, plus 2 for each attacker beyond the first. On a pass they fight back. On a failure their temperament decides, by the lab's nerve rules: low courage or high caution tries to flee; anyone else gives in, and is beaten.
3. The usual nerve checks still apply, at half health and when half a side is down.

```ts
squad(sam, joe).fight(squad(rico), { kind: 'real', start: 'set-upon' });
```

### Ambushes

An ambush is a real fight that the attacking squad starts unseen. Before it begins, the squad's lowest Stealth roll (the noisiest of them gives them away) is compared with each target's passive Notice: 10 plus their Notice bonus. A roll that meets or beats it goes unnoticed; one below it is noticed. A target who does not notice is surprised and cannot act in the first round. If every target notices, it is an ordinary real fight.

```ts
squad(sam, joe).fight(squad(rico), { kind: 'real', start: 'ambush' });
```

### Fleeing

Wanting to flee and getting away are separate. A failed nerve check, for a character whose temperament makes them run, makes them try to flee; getting away is a roll. Fights have no mid-fight choices, so for now nobody, the player included, flees except after a failed nerve check. This replaces the lab's rule, where fleeing takes a character out of the fight at once.

On their turn, instead of attacking, a fleeing character makes an escape check: their Reflexes against the highest Reflexes among the enemies still fighting, opposed, with ties going to the chaser as in every opposed check.

| Outcome | What happens |
| --- | --- |
| Critical success or success | They get away cleanly |
| Partial success | They get away, but the chaser they rolled against gets one free attack first |
| Failure or critical failure | Caught: still in the fight, and attacks against them have advantage until their next turn, when they try again |

- **While trying to flee,** a character can still be attacked, and does not count as out of the fight (for "half a side is down") until they get away.
- **Held:** in the first round of being set upon, the target is held, so breaking free is Brawling against the holder's Brawling instead.
- **No one to chase them:** with no enemy still fighting, they get away without a roll.
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

The game's word for a recorded event is `Fact`, so this plan says "fact" throughout.

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

An optional roll made before a job or a move. Its result becomes modifiers on the checks that follow.

- One character plans, rolling Planning (Intelligence or Wisdom, whichever is higher) against a DC the job sets: for example 10 for a simple job, 15 for a tricky one, 20 for a hard one.
- One other character taking part in the job can help, giving the planner advantage on the roll. More helpers add nothing more.
- The result applies to every skill check made by anyone following the plan during that job. A plan has its own bands: a critical failure needs a margin of −10 or worse, rather than −5.

| Outcome | Margin | Effect on the job's checks |
| --- | --- | --- |
| Critical success | 10 or more | +2, and advantage on one check of the planner's choosing, chosen when planning |
| Success | 5 to 9 | +2 |
| Partial success | 0 to 4 | +1 |
| Failure | −1 to −10 | No change |
| Critical failure | −11 or worse | −2: the plan is wrong, and following it makes things worse |

- The plan is recorded in the cast with the job it belongs to, and ends when the job does.
- There is one plan per job, and a job cannot be replanned.
- The planner does not know exactly how good the plan is: a critical failure looks like a failure to them, so they follow a bad plan without knowing. Explanations given to the planner, or anyone following the plan, show what they believe it gives; only the roll uses the real modifier.
- Fight rolls are not affected, including nerve and escape checks during a fight. A plan helps a fight through the checks around it instead, such as the Stealth roll for an ambush.

Expected modifier on each of the job's checks, counting a critical success's extra advantage as about +0.5:

| Planner | DC 10 | DC 15 | DC 15, helped | DC 20 | DC 20, helped |
| --- | --- | --- | --- | --- | --- |
| Untrained (+0) | +0.88 | −0.05 | +0.53 | −0.85 | −0.31 |
| Trained (+2) | +1.13 | +0.35 | +0.90 | −0.55 | +0.03 |
| Expert (+4) | +1.38 | +0.75 | +1.19 | −0.25 | +0.31 |
| Expert, Intelligence 16 (+7) | +1.75 | +1.13 | +1.66 | +0.35 | +0.90 |

So a capable planner helps, and an untrained one planning a hard job alone makes it worse, which is why planning is a choice.

```ts
const plan = sam.planning.plan(burglary).helpedBy(joe).roll(dice, { now });
squad(sam, joe).following(plan).larceny.check(15);   // includes "A good plan +2", as Sam believes it
```

## Bookkeeping

Where it would be used once this is slotted into the game, which now uses `brains` for these:

- **Skimming:** reporting less than was earned to a superior (`src/books.ts`).
- **Running a business, a loan book or a numbers game well:** in place of `brains` in a business's management quality (`src/econ.ts`).

Both belong to the game's books, so both wait for slotting it in (see [Later](#later)).

## Later

Left until the character is slotted into the game:

- **Skimming:** an opposed Bookkeeping check between the skimmer and their superior. The chance of the superior catching it must scale with the gap they can see, as the game's own check does now. Running a check only when someone is skimming would leak who is, and a suspicion must be recorded as an inferred fact, not as a change in trust with no recorded cause.
- **Running a business** with Bookkeeping, in place of `brains` in the game's management quality. This changes the game's economy, and this work stays separate from the game until then.
- **Joining the game's records:** mapping the game's five skills onto the six attributes and eighteen skills; which courage to keep (the game has two); hit points against the game's `hurtUntil`; the player's `conduct`; cash against the ledger; and the save migration from the game's current format.
