# Character: one object for every character

**Words:** what each term means is in the [glossary](glossary.md).

**Status:** design agreed in discussion on 2 and 3 November 2026, and revised after two adversarial reviews. Built step by step; what building has left open is in [Points to revisit](revisit.md), and the decisions taken on it after building (3 November 2026) are written into the sections below. What must still be built before it replaces the game's systems is under [Before the swap](#before-the-swap).

## Purpose

One character object that can represent any character in the game, the player included. It is built up from the [character lab](../../../../lab/character/README.md) (attributes, skills, temperament, checks, social actions, fights), extended with inventory, condition, relationships and knowledge, and written so that it can later be slotted into the game.

Until the swap, the game's own `Character` (`src/types.ts`) stays the game's record, and this is not modelled on it. Where the game already has a concept that this needs, such as knowledge or relationships, the design follows the game's meaning so the two can be joined. How they join is under [One record](#one-record).

## Where it lives and how it is built

- **Folders, kept separate from the game:** the overhaul's code goes in `src/overhaul/` and its tests in `tests/overhaul/`, so this plan's code is `src/overhaul/character/` with its tests in `tests/overhaul/character/`. Nothing in `src/overhaul/` imports from the rest of `src/`, from `lab/` or from any package, and nothing in the game imports from `src/overhaul/` until it is slotted in; an architecture test (`tests/overhaul/boundary.test.ts`) fails if either happens.
- **Its own configuration:** a tsconfig, a Vitest config and npm scripts (`overhaul:test`, `overhaul:typecheck`, `overhaul:cov`), as the lab has. The game's Vitest config finds tests only in `src/tests/`, so it does not run these.
- **Two changes to the game's configuration:** the game's coverage counts all of `src/`, so it excludes `src/overhaul/**`; and CI (`.github/workflows/ci.yml`) gains an overhaul job that runs the overhaul's typecheck and tests, so the boundary test runs on every push.
- **Types:** the lab's stricter settings (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax` and the rest), with the game's `lib` setting, so that code passing the overhaul's typecheck also passes the game's (which covers all of `src/`).
- **Tests:** written first, with Vitest and `node:assert`, each tagged with one kind (`unit`, `property`, `statistical`). Coverage is held at 100%.
- **Modules:** small, each owning one rule. A rule is written once and everything else uses it, and every rules table below is data in one place.
- **The lab's code is ported, not imported:** the lab's rules (checks, social actions, nerve, fights) are ported into `src/overhaul/character/` with their tests, and the lab is frozen as a reference. Nothing imports from `lab/`. Later the lab's playground can be pointed at the overhaul, and the lab's own code removed.
- **Determinism:** dice are always passed in and seeded. No `Math.random`, no wall-clock time. Everything else the model cannot know is an explicit input (see [Inputs](#inputs)).

## Shape

**A cast holds everyone.** One plain record holds every character, every fact, every [job](#jobs) and every cash transfer, so relationships and knowledge can refer to anyone by id. Handles for characters come from it and give a fluent interface:

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
outcome.result({ for: sam });   // what happened, as Sam can see it
outcome.cast;                   // a new cast, with Sam, Rico and any new facts updated
```

**Odds, explanations and results never leak private state.** They are always given to someone. The viewer's own modifiers are exact; another character's count only where the viewer knows them, and anything the viewer does not know counts as zero. So asking the odds of lying to Rico does not reveal whether Rico saw the fact, unless Sam knows Rico was a witness. A result given to a viewer shows only the modifiers they could know, and the outcome as they could see it (a planner sees a critical failure as a failure). The true numbers are used only by the roll itself, and by tests.

- **Private** means everything about another character except what anyone present can see: the items they show or wear, and whether they are visibly hurt (Hurt or unconscious). Their attributes, skills, temperament, feelings, knowledge, other effects and hidden items are private.
- **Witnesses are recorded on the fact,** so a witness knows who else was there. Someone told of a fact knows only who told them.

**Nothing changes in place.** A roll returns a new cast; `everyone`, `sam` and `rico` above are as they were.

- **No lost changes:** each handle and check is tied to the cast it came from, and rolling a check made from an older cast is refused, so one roll can never silently undo another.
- **Sharing what did not change:** a new cast shares every unchanged character with the old one. Adding to a list still copies the list, so the cost of a roll is measured with benchmarks once built rather than promised here.
- **Growth:** facts and transfers are kept for as long as the game keeps them: a fact while anything still refers to it, routine ones expiring, as in `src/retain.ts`; transfers for the ledger's window. A record that can outlive its fact (a character's version of it, a grudge's reason, a step in their conduct) keeps a short summary of the fact (its kind, who did it to whom as they believe it, and when), not only its id, so it still makes sense after the fact is pruned.
- **Cash and items move only by recorded transfers** (items: see [Inventory](#inventory)): a character's cash is a stored number, and every transfer that changes it is in the cast's log; a check verifies that the two agree, as the game's `audit` does. A transfer names who paid whom, how much, why and when, as the game's ledger does. Money entering or leaving the cast comes from or goes to a `world` party, and opening balances are transfers from it, so all cash has a recorded source. When old transfers are pruned, the log keeps each character's balance at that point. Cash is never set directly.

### One record

The overhaul replaces the game's systems in one sweep, not one system at a time, so there is never a time when both hold characters, and no writer between two records. Until then the overhaul stays apart from the game, as it is.

1. **Everything first:** what the swap needs is built in the overhaul first: see [Before the swap](#before-the-swap).
2. **A shadow run:** worlds are run on the same seeds and actions with the game's systems and with the overhaul's, in a test harness, and how they behave is compared over many runs: how much money moves, how often people fight, are promoted or fall out. Their characters are made differently, so the runs are compared as a whole, not record by record. The swap waits until they agree, or differ only where it has been decided they should.
3. **The swap:** every game system that reads or writes characters moves to the cast at once. **It is a clean break** (decided 3 November 2026): no character or save from the game before the swap comes across. A new game starts with characters made by the overhaul's rules, and saves from before the swap do not load in it.

**The player and NPCs are the same type.** There is no player flag in the character. Every character has an id.

### Inputs

What the model cannot work out for itself is passed in, so the same inputs always give the same result:

- **Dice:** seeded, as in the lab.
- **Time:** each roll is given `now`, for when a fact happened, when a character learned it, and when two characters last met.
- **Witnesses:** named at the call. With no positions, nothing else decides who saw what.
- **Ids for facts and jobs:** made by a counter in the cast, so they are deterministic. When slotted in, they come from the game's own id counter.

### Saves

The cast carries a format number. Every change to its shape adds a migration from the previous format, and migrations are never deleted, as the game requires of its own saves.

## What a character holds

| Part | What it is |
| --- | --- |
| Identity | Id, name, background |
| Attributes | The six [attributes](#attributes), 1 to 20 |
| Skills | Training in each [skill](#skills) (untrained, trained or expert) and the proficiency bonus (2 to 6) |
| Temperament | Starting [traits](#temperament), each 0 to 1, and a record of conduct; the current traits are worked out from both: see [Temperament moves with conduct](#temperament-moves-with-conduct) |
| Condition | Current hit points and [temporary effects](#condition-and-temporary-effects) |
| Inventory | Cash, as a number, and [items](#inventory) |
| Relationships | How this character feels about each other character they have met or learned about, one-way: see [Relationships](#relationships) |
| Knowledge | This character's own version of each fact they know about: see [Knowledge](#knowledge) |

A skill's status is its training plus any temporary effects, so its bonus lists every part:

```ts
sam.skills.larceny;
// { training: 'trained', bonus: 2,
//   modifiers: [Agility 14 +2, Trained +2, Hurt −2] }
```

### Temperament moves with conduct

Every character's temperament moves with what they do, the player's included, so the player needs no flag.

- **Stored:** each character's starting traits, and their conduct: for each trait, the steps that moved it, each naming its cause (a fact, a job's plan, or an item used up). The current traits are worked out by applying the steps in order to the starting traits, so there is no second copy of the traits.
- **Starting traits:** an NPC's are set when they are made; the player's start neutral, at 0.5 for every trait.
- **Used:** the current traits give modifiers on the character's own rolls and decide their response to a failed nerve check. For the player this is a deliberate difference from the game, where the player's temperament never limits what they can do.

A person is a product of their experiences, so three things move traits: what a character chooses to do, how they react when a roll decides their response, and what is done to them.

- **Slowly:** every step is 0.01. A step raises a trait by `0.01 × (1 − value)` and lowers it by `0.01 × value`, so a trait never leaves 0 to 1 and the extremes are hardest to reach.
- **Once a week:** each row below moves a character's traits at most once a week, however often it happens. Different rows add together.
- **So it takes about a year:** someone who runs from trouble every week goes from neutral (0.5) to timid (0.3) in about 51 weeks. These are starting values, checked with simulated runs once built.
- **A way out:** temperament never decides a nerve check, only what someone does after failing one. A timid character who passes stands their ground and gains courage from it, so no one becomes more timid by rule.

**What they choose to do:**

| Conduct | Recorded by | Traits moved |
| --- | --- | --- |
| Starting a real fight | A `beating` or `fight`, as attacker | Violence + |
| Starting one against a bigger squad, or against a weapon that outclasses theirs | The same | Courage + |
| Starting one while Hurt, or against a bigger squad | The same | Caution − |
| Setting an ambush | The same, started as an ambush | Caution + |
| Beating someone who could not fight back: set upon by more than one (for the squad that set upon them), or unarmed against a weapon that outclasses theirs; only for whoever struck them or started the fight | A `beating` | Cruelty +, Empathy − |
| Starting a fight with someone who provoked them, within 24 hours: the fight's cause is a `threat` that ended provoked, the one provoked is on the attacking squad and the one who provoked them among the defenders | A `beating` or `fight` caused by a provoking `threat` | Volatility + |
| Intimidating someone | A `threat` | Violence + |
| Persuading someone | A `persuasion` | Agreeable + |
| Lying | A `lie` | Honesty − |
| Lying to someone whose trust in them is high | A `lie` | Loyalty − |
| Robbery | A `robbery` | Greed +, Violence + |
| Theft, burglary or a scam | A `theft`, `burglary` or `scam` | Greed +, Honesty − |
| Drinking a bottle | The bottle used up | Vice +; and Sociability + with others present, Sociability − alone |
| Planning a job | The plan on its job | Caution +, Ambition + |
| Taking part in a hard job (DC 20) | The job | Ambition + |

**How they react:**

| Reaction | When | Traits moved |
| --- | --- | --- |
| Holding their nerve | Passing a nerve check in a fight and fighting on | Courage + |
| Standing by their squad | Holding their nerve when a member of their squad is not fighting: beaten, knocked out, fled or still running (decided 3 November 2026) | Loyalty + |
| Running | Failing a nerve check and trying to flee, whether or not they get away | Courage −, Caution + |
| Leaving their squad | Running while the rest of their squad fights on | Loyalty − |
| Surrendering in a fight | Failing a nerve check and surrendering | Courage −, Pride − |
| Giving in to a threat | Being intimidated: partial success or better for the actor | Courage −, Pride − |
| Standing up to a threat | Resisting intimidation: failure or critical failure for the actor | Courage +, Pride + |
| Losing their temper | Being provoked, or [losing their temper in a fight](#losing-their-temper) | Volatility + |

**What is done to them:**

| Experience | When | Traits moved |
| --- | --- | --- |
| Being beaten | The victim of a `beating`, knocked out or not | A brave victim (courage high): Volatility +. Anyone else: Caution + |
| Finding out they were lied to | Seeing through a lie, or later learning the truth | Agreeable − |

A risk to check with long simulated runs: an NPC's choices follow their temperament, so a violent NPC chooses violence and grows more violent. Small steps, the weekly limit and the way out above slow this; the runs should confirm that traits do not all drift to the ends.

## Condition and temporary effects

| Effect | When it starts | What it does | How it ends |
| --- | --- | --- | --- |
| Hurt | Hit points at or below half. Read from hit points, not stored, so the two can never disagree. | −2 to skills using Strength, Agility or Constitution. Never applied during fights: the nerve check at half health already marks that moment, and a penalty on top would make fights snowball. | Healing back above half |
| Shaken | Losing their nerve in a fight, or giving in to intimidation | −2 to Nerve (which is also what resists intimidation) | A full night's rest, or cleared explicitly |
| Drunk | Set explicitly, or by failing a Carousing check (DC 12) on drinking a bottle of spirits; someone already drunk stays drunk | −2 to skills using Agility or Intelligence, and to Insight and Notice; +2 to Nerve | A full night's rest, or cleared explicitly |
| Unconscious | Hit points at 0. Read from hit points, like Hurt. | Cannot act: no check can be made by them, and in a fight they are out | Regaining hit points |

An effect does not stack with itself; different effects add together. Each is named in explanations, for example "Hurt −2". Where a skill can use either of two attributes, Hurt and Drunk follow the attribute actually used.

**Resting** takes time, and returns a new cast like a roll: the call gives when it starts and how long it lasts, `sam.rest({ now, hours: 8 })`, and the cast records it. A full night, 8 hours or more, restores hit points to full and clears Shaken and Drunk; a shorter rest heals a share of the missing hit points in proportion to its length (4 hours heals half, rounded down) and clears no effects. While resting, a character is unavailable: nothing they do (checks, social actions, fights, drinking, planning, telling, paying) and nothing that needs them there (being the target of a social action, in a fight, told something or given an item) can happen at a `now` within their rest; a plain transfer between them and the world can. Attacking someone asleep, and healing over time without resting, are [before the swap](#before-the-swap).

## Inventory

**Cash is a separate number,** not an item, and changes only by [recorded transfers](#shape).

**Items change hands only by recorded transfers too,** in the same log as cash: a transfer of an item names it, with its count as the amount, who from and to, why and when, and optionally the fact that caused it (such as a robbery). A check counts each kind of item each character holds against the log, as cash is checked.

- **Starting items** are transfers from the world, as starting cash is: a new cast's at time 0, and a character added later with items at the time given, `everyone.add(input, { now })`, which is refused without one.
- **An item used up** (a drunk bottle) is a transfer to the world.
- **Giving:** `sam.give(rico, 'knife', { why, now, cause })`, with the cause optional. Both must be there. A carried one goes first; a shown weapon or a worn suit must be put away first; it arrives carried.
- **Taking by force** (robbery, disarming a beaten fighter) and **buying** (paying and receiving in one change) are [before the swap](#before-the-swap).

**An item** has a name and a list of effects. Each effect names the skill it applies to, optionally a situation within that skill, a value, and when it applies:

- **Situations:** `locks` (Larceny), `repairs` (Mechanics), and so on: a short, fixed list kept with the rules tables. An effect with no situation applies to every check of that skill.
- **When it applies:** while carried, while shown, while worn, or when used.
- **State:** a carried weapon is hidden unless it is shown, and the inventory records which items are shown or worn. An item used up (a drunk bottle) leaves the inventory, by a transfer to the world.

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

Weapons are part of a real fight from the start: there are no choices made mid-fight. Each armed character's attacks use their weapon's skill and damage. At the start, each fighter facing a weapon that outclasses theirs, by the same rule as the table above (a knife outclasses bare hands; a pistol outclasses bare hands and a knife), makes one nerve check against the strongest such weapon: DC 12 for a knife, 15 for a pistol. A fighter whose weapon answers everything they face does not check. These numbers change fight balance, so they are a starting point. They are kept for now (3 November 2026), with the measured rates pinned in a statistical test so that any change shows; a direction for retuning is to make the start check opposed to the armed fighter's Intimidation rather than a fixed DC.

## Relationships

One-way: how Rico feels about Sam can differ from how Sam feels about Rico. Each relationship holds everything the game's `Rel` holds: trust, respect, affection, grudge, fear, familiarity (how well they know each other), when they last met, and the reasons behind the grudge and the regard.

```ts
rico.towards(sam);   // { trust: 0.4, respect: 0.7, affection: 0.2, grudge: 0.1, fear: 0.6, ... }
```

**Strangers:** a character has a relationship only with someone they have met or learned about. Two characters meet by being together in something: taking part in the same roll or fight (as actor, target, squad member or witness), one telling the other anything, drinking together, or simply spending time together, such as a shift at the same bar or a crew's meeting (`cast.together(['sam', 'rico'], { now })`, which changes nothing else). Learning a fact about someone, such as seeing them beat someone, also creates the relationship, as in the game's `learn`. Between strangers there is no relationship, and so no relationship modifiers.

**A new relationship** starts from the character's own current traits (decided 3 November 2026). Trust starts at 0.5, lowered by caution and raised by agreeableness; affection at 0.5, raised by sociability; each by 0.3 × (trait − 0.5). Respect starts at 0.5, since it is earned, and grudge, fear and familiarity at 0. So an average character starts neutral, and only a quite cautious and disagreeable one starts off distrusting people (a caution of 0.9 and agreeableness of 0.2 gives trust 0.29, which counts as low).

**Familiarity** grows by 0.02 each time the two meet, as above. This is a starting value, tuned once built.

**One function changes feelings,** modelled on the game's `feelOn` (`src/core.ts`), and everything uses it, grudges included (the game has a separate `bear`). A gain shrinks as the value nears 1, and gains in trust and affection are smaller between people who barely know each other; losses are not damped. The amounts in the tables below are before damping. Feelings fading with time is [before the swap](#before-the-swap).

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
| Intimidate | Failure, or a critical failure on a target who is not volatile: resists | Respect −0.05 |
| Intimidate | Provoked: a critical failure on a volatile target, in place of the row above | Grudge +0.1 |
| Persuade | Success or better | Trust +0.05 |
| Persuade | Partial success or failure | None |
| Persuade | Critical failure: harder to persuade next time | Trust −0.02 |
| Deceive | Partial success or better: believes it | None: they do not know they were lied to. Their version of the fact now has the actor as its source, so the lie can come out later. |
| Deceive | Failure: does not believe it | None |
| Deceive | Critical failure: knows they were lied to | Trust −0.15, grudge +0.05 |

Intimidation also changes how the actor feels about the target:

| Outcome | Change in the actor's feelings |
| --- | --- |
| The target gives in (partial success or better) | Respect −0.05 |
| The target resists, provoked or not (decided 3 November 2026) | Respect +0.05 |

**Provoked** is returned as an outcome of its own, and the caller decides what follows, such as starting a fight. The roll never starts one itself.

**How a roll looks to anyone but the target** (decided 3 November 2026): only the target knows exactly how it ended. Everyone else there, the actor included, sees what the target says or does, never what they only feel:

| Action | What everyone else sees |
| --- | --- |
| Intimidate | Gives in (partial success or better), resists (failure or critical failure), or provoked |
| Persuade | Agrees (success or better); agrees, for something in return (partial success, since the target says so); declines (failure or critical failure) |
| Deceive | No sign, unless the target sees through it (critical failure) |

So resentment after giving in, doubts about a lie, and being put off persuasion stay private, and a liar cannot tell whether a lie was believed. What a price is, and what follows if it is not paid, is for the caller; it is [before the swap](#before-the-swap).

**Each social roll records a fact,** and that fact is the recorded cause of its aftermath: see [Fact kinds](#fact-kinds).

## Knowledge

Follows the game's model (`Fact` and `Knowledge` in `src/types.ts`, `addFact` and `learn` in `src/core.ts`):

- **A fact is recorded once,** in the cast's list of facts: what kind of fact, who did it, who it was done to, any business or amount, when, where, the fact that caused it, and whether who did it is hidden.
- **Each character holds their own version** of the facts they know about: when they learned it; where it came from (they did it, they witnessed it, it was public, or who told them); whether they know who did it; how they came by it (seen, told by a witness, heard second-hand); who they believe did it when they don't know, which can be wrong; and whether they heard it exaggerated.
- **Each part of a version has its own provenance:** how they came by who did it, and how they came by how big it was, each seen, told by a witness, heard second-hand, or guessed. Whatever reads what someone knows of a part (such as a lie's modifier) reads that part's provenance.
- **Who learns a fact when it is recorded:** whoever did it, whoever it was done to, and the witnesses named at the call, who are recorded on the fact. A witness must be there and conscious: naming one who is unconscious, or resting, is refused. In a fight, a fighter witnesses what happens to a loser only if they had not been knocked out or gone when that loser was beaten, knocked out or fled; someone who surrendered is still there and sees. A fighter knocked out can still be the actor of a later fact, and learns it as their own act.
- **Public facts:** a fact can also be made public to others named at the call (`public: [...]`), as the game's `broadcast` does. They learn it as public and heard; they know who did it unless the actor is hidden, and then they do not guess. They are not witnesses, and they do not meet those in it, though they are no longer strangers to them.
- **Guessing a hidden actor:** the victim of a hidden actor, of a kind that changes feelings (`GRUDGE`), guesses who did it, with no randomness: among those they hold a grudge of at least 0.3 against (and, for a violent kind, know to have been violent), the one they hold the biggest grudge against; on a tie, no one. The guess is their belief, marked guessed, so a telling or a lie can change it; their feelings change towards the one they suspect through the learning tables, with the fact as the cause. Only the victim guesses; anyone they tell hears it as their guess. A player can frame someone by raising a victim's grudge against them first; that is accepted.
- **Learning a fact changes feelings,** by the game's own tables, carried over from `learn`: respect for what someone has done, fear of someone violent (more for the less brave), and for the victim a grudge or fear by their courage, with less trust either way; and a grudge for anyone fond of the victim (affection high, 0.7 or more, since a new relationship here starts at 0.5, not the game's 0.1). Apart from the aftermath of social rolls, this is the only way facts change feelings, so nothing is counted twice: a beating changes the victim's feelings because they learn of it.
- **Re-belief:** when a character's version of a fact they already know changes (they are lied to, or learn the truth), their feelings follow the actor they now believe did it: the learning tables apply towards that actor as if they had learned the fact with them as its actor. They apply only once for each fact and each character held responsible for it, so changing one's mind back and forth counts nothing twice. Feelings towards whoever they believed before are not undone. A belief someone was only told still moves feelings, as rumours do (decided 3 November 2026), whether or not it is true.
- **Telling someone who already knows:** telling is a check like the social actions, `sam.social.tell(rico, factId)`, with odds and an explanation for a viewer, rolled only if what is told contradicts the listener. A telling that fills a gap (they know the fact, but not the part being told) is accepted, as any new telling is. One that agrees with them changes nothing. One that contradicts them is a roll: the teller's Persuasion against DC 10, with the knowledge modifiers of [Deception](#as-modifiers-on-deception) and the persuasion feelings; on a success their belief changes, with the teller's provenance (corrected by a witness, they know who did it; by someone who heard it, they heard it). Any telling, rolled or not, makes the two meet, and none moves traits. Asking the odds reveals nothing more of the listener's version than a lie's odds would. If the part overturned is the part a lie changed, and the lie was told as something the liar saw, the lie comes out: they learn the `lie` fact, with the change of a lie seen through and "finding out they were lied to". If instead it came from someone honestly mistaken, who believed what they told, the listener trusts them a little less (trust −0.05, a starting value), with no grudge; not if they passed it on only as a guess (decided 3 November 2026).

### Fact kinds

The game's kinds are used where the meaning matches, with their rows in the learning tables (`DEED`, `VIOLENT` and `GRUDGE` in `src/core.ts`). Three are added.

| Kind | Recorded when | Feelings on learning it |
| --- | --- | --- |
| `beating` | A real fight ends with someone beaten or knocked out | The game's rows. The victim's change is scaled by the share of their hit points they lost, and is never less than a successful intimidation's (fear +0.1, grudge +0.05, trust −0.05) |
| `fight` (added) | A real fight ends with someone fled, or in a stalemate | The beating's rows, scaled by the share of hit points lost, with no minimum |
| `threat` | Any intimidation roll | The game's row (respect, for those who hear of it); the target's and actor's change is the aftermath table |
| `persuasion` (added) | Any persuasion roll | None; the aftermath table only |
| `lie` (added) | Any deception roll | None; the aftermath table only. See below for who learns it |
| Any other game kind | A lie invents it, or the game records it | The game's rows; a kind with none, such as `theft`, changes no feelings |

A `lie` fact is known to the liar, and records what it claimed. The target learns it only when they see through the lie (a critical failure) or later learn the truth; witnesses to a deception learn nothing from it for now. A `beating` in which no blow was struck (its amount is 0) is still a beating, but not violence by its actor: it gives witnesses no fear of them, and does not count as having seen them be violent.

**Social facts record how they ended** (`ending`: the outcome, or provoked). That is the simulation's truth: anything that reads it on a character's behalf sees only how it looked to them, unless they were the target. A liar knows their lie fact, but not, through it, whether they were believed.

### As modifiers on Intimidation

What the target knows of the actor's violence (a fact of a violent kind, with the actor as its actor):

| What the target knows | Modifier |
| --- | --- |
| Saw the actor be violent | +2 |
| Was told or heard of it | +1 |

Only the best one counts. Fear from hearing of violence is too small to carry this alone (0.04 at most for a beating), so the knowledge counts directly as well.

### As modifiers on Deception

A lie is a claim, in the same shape as a character's version of a fact. It is either a different version of a real fact (who did it, how big it was) or a fact that never happened. A fact that never happened is still recorded, marked false, so the simulation always knows the truth. The liar's own version of it is marked known false. Nobody named in an invented fact learns it when it is recorded; only the liar knows it, and the target if they believe the lie.

```ts
sam.social.deceive(rico).claim({ about: factId, blame: 'joe' });                   // a different version of a real fact
sam.social.deceive(rico).claim({ invented: { kind: 'robbery', actor: 'joe' } });   // a fact that never happened
```

When a lie succeeds, the target's version changes by [re-belief](#knowledge), with "told by the actor" as its source. If they later learn the truth, that is re-belief again, by the rules of [telling someone who already knows](#knowledge).

The modifier comes from what the target knows of the part of the fact the claim changes: who did it, how big it was, or, for an invented fact, whether it happened at all. So a victim who never knew who robbed them can be told the wrong name.

| What the target knows of the part the claim changes | Modifier |
| --- | --- |
| Saw it themselves | Impossible, explained as "Rico saw it himself" |
| Was told by a witness | −4 |
| Heard it second-hand | −2 |
| Does not know it | None |
| The lie matches what they already believe, such as who they blame | +2 |

**A lie the liar knows cannot work is never told** (decided 3 November 2026). An impossible lie is tried only when the liar does not know it is impossible, and is then a certain critical failure: the target sees through it. A lie the liar can see would fail is refused before any roll, so it has no odds:

- **An invented fact naming the target,** as whoever did it or whoever it was done to: "you killed a man", or "Joe robbed you". The target would know, and so does the liar.
- **A fact the liar saw the target see:** Sam and Rico both watched John kill Tom, so Sam knows Rico knows; "Frank killed Tom" is refused. Joe, who was only told of it, does not know Rico saw it, so the same lie from Joe is tried, and fails.

## Checks and modifiers

- **The roll decides the response** in social checks, as decided in the lab ([Social actions](../../../../lab/character/README.md#social-actions)). What the target knows, what is at stake for them, how each feels about the other and their temperament are all modifiers on the roll. A certain outcome is the same as a modifier large enough to make the check impossible, so social checks have no automatic success.
- **The character works out its own modifiers** from the rules tables: temperament (as the lab does now), temporary effects, items, relationships and knowledge. Every modifier carries its reason, so an explanation always says where each number came from.
- **Situational modifiers** can still be added to any check with `.with(...)`.

## Fights

One against one: `sam.fight(rico)`. Groups are called squads: `squad(sam, joe).fight(squad(rico))`. ("Crew" already means a captain's men in the game.)

| Kind | Starts from | Nerve checks | Afterwards |
| --- | --- | --- | --- |
| Sparring | Full health, unarmed | None: nobody flees or surrenders | Ends for everyone when the first fighter drops to half health, and their side loses. Nothing lasts but familiarity, and no fact is recorded |
| Real fight | Current condition | As in the lab, plus the start-of-fight check against weapons | Damage stays, and the fight is recorded as facts that the named witnesses learn |

```ts
sam.fight(rico, { kind: 'sparring' });
squad(sam, joe).fight(squad(rico), { kind: 'real' });
```

A fighter who starts a real fight at or below half health makes the half-health nerve check at the start, since they are already past that point.

**One nerve check at the start** (decided 3 November 2026): however many reasons a fighter has to check at the start (a weapon that outclasses theirs, being set upon, already being at half health), they make one check, at the hardest of the DCs. It is one moment of standing or running, not a series of them.

### How a fight ends

During a fight each fighter is fighting, fleeing (see [Fleeing](#fleeing)), beaten, knocked out or fled. A squad loses when none of its members is still fighting. Anyone on it still fleeing then makes one last escape check: getting away means fled, and being caught means beaten. If both squads still have someone fighting after the round limit (12, as in the lab), it is a stalemate: nobody else is beaten, and the fight is recorded as a `fight` between the first fighter of each squad.

| State | Meaning | Recorded as |
| --- | --- | --- |
| Beaten | Surrendered while still conscious, whenever that happened, including straight away with no damage taken | A `beating` |
| Knocked out | Dropped to 0 hit points, and unconscious | A `beating`, whichever squad wins |
| Fled | Got away | A `fight` |

- **One fact for each loser and each attacker:** each member of the other squad who attacked them, or, if nobody did (they surrendered at the start), every member of the other squad still fighting. A knocked-out winner is recorded as beaten by whoever dropped them. A winner who surrendered is beaten by whoever hurt them; if no one did, it is a `fight` with those they surrendered to, as for someone who fled, since no one was left to beat them (decided 3 November 2026). All the facts of one fight share a story id, as the game links the facts of one matter.
- **Feelings:** the victim's feelings towards each attacker change once, through [learning the recorded fact](#fact-kinds), scaled by the damage they took. How badly a beaten character was hurt shows in their hit points.
- **Killing** is out of scope until it is decided whether weapons can kill.

### Being set upon

A real fight can start with the attackers setting on a target:

1. The attackers have advantage on their attacks in the first round, because the target is caught or held. After that the normal rules apply, including advantage for ganging up.
2. The target makes a nerve check: DC 10, plus 2 for each attacker beyond the first. On a pass they fight back. On a failure their temperament decides, by the lab's nerve rules: low courage or high caution tries to flee; anyone else surrenders, and is beaten.
3. The usual nerve checks still apply, at half health and when half a side is down. A target who also faces a weapon that outclasses theirs makes one nerve check, at the higher of the two DCs, not two.

```ts
squad(sam, joe).fight(squad(rico), { kind: 'real', start: 'set-upon' });
```

### Losing their temper

A volatile character (volatility high) who passes a nerve check in a real fight loses their temper. They fight on, but recklessly:

- **Their next turn:** their attacks have advantage, explained as "Lost their temper".
- **The cost:** attacks against them have advantage until their next turn, explained as "Left themselves open".
- **Stacking:** advantage and disadvantage combine as for any roll: they do not stack, and one of each cancels out.

It applies to every nerve check in a fight: the start-of-fight check against weapons, being set upon, dropping to half health, and half their squad going down. A volatile target set upon gets it on their first attacks back. A failed check is unchanged: they flee or surrender, by courage and caution. How much it changes who wins is checked with the same statistical tests on simulated fights as the weapon DCs.

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
- **Held:** in the first round of being set upon, the target is held, so breaking free is Brawling against the holder's Brawling instead. The holder is the attacker first in initiative order.
- **No one to chase them:** with no enemy still fighting, they get away without a roll.
- **Running alone** (decided 3 November 2026): a fighter whose squad has no one else still fighting has lost the moment they run, so they get one try at getting away, the last escape check. With others on their squad still fighting, they try on each of their turns, because the others are what holds the chasers off.
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

One set of traits, each 0 to 1, worked out from a character's starting traits and their conduct (see [Temperament moves with conduct](#temperament-moves-with-conduct)). The game has two layers (stored traits, and a temperament worked out from them in `src/temper.ts`); this has one set of trait names.

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

## Advancement

How a character gets better over time (direction decided 3 November 2026; not yet built):

- **Experience (XP)** is earned, and reaching a level gives a point to put into an attribute.
- **Levels, and what earns XP,** are to be decided.
- **Training in a skill is unlocked by things that happen in the game,** not bought with XP or levels.
- **Rank has no part in it:** rank follows what a character does, and never sets their abilities ([Before the swap](#before-the-swap)).
- **Every character advances,** the player included.
- **Auto-levelling:** a character whose points no one chooses puts them where their background's priorities say (the same
  attribute order that placed their rolled scores), taking turns through the top three: a fighter's go to Strength, then
  Constitution, then Charisma, then Strength again. An attribute already at 20 is passed over for the next in the order.
  The player chooses their own.
- **The proficiency bonus rises with level,** as in D&D: 2 at the start, rising a step every few levels to 6. How many
  levels each step takes is decided with the levels themselves.

- **What unlocks training** (decided 3 November 2026), three kinds of thing, mixed:
  - **Practice:** succeeding at the skill often enough in real situations, such as winning real fights for Brawling.
  - **Being taught:** spending time with someone trained in it who is willing, such as a crew's driver teaching Driving.
  - **Particular events,** for a few skills where it makes sense, such as time in prison for Streetwise.

  Practice and being taught cover most skills. Expert is unlocked the same ways, needing more: more practice, or being taught
  by an expert.

Open: the numbers (how much practice, how long being taught takes), which events unlock which skills, and the levels and XP
themselves. These replace the game's skills growing with use (`people.ts` `grow`).

## Planning

An optional roll made before a job or a move. Its result becomes modifiers on the checks that follow.

- One character plans, rolling Planning (Intelligence or Wisdom, whichever is higher) against a DC the job sets: for example 10 for a simple job, 15 for a tricky one, 20 for a hard one.
- One other character taking part in the job can help, giving the planner advantage on the roll. More helpers add nothing more.
- The result applies to every skill check made for the job, by anyone taking part in it, while it is open: the caller names the job on the check (`{ job }`), and nothing else they do meanwhile is affected (decided 3 November 2026). A social roll for the job counts it on the side of whoever is taking part, so a guard talking to a burglar meets the burglar's plan. Following the plan is not optional, so a bad plan cannot be dodged on the job's own checks. A plan has its own bands: a critical failure needs a margin of −11 or worse, rather than the usual −6 or worse.

| Outcome | Margin | Effect on the job's checks |
| --- | --- | --- |
| Critical success | 10 or more | +2, and advantage on one check of the planner's choosing, chosen when planning |
| Success | 5 to 9 | +2 |
| Partial success | 0 to 4 | +1 |
| Failure | −1 to −10 | No change |
| Critical failure | −11 or worse | −2: the plan is wrong, and following it makes things worse |

- The plan is recorded on its [job](#jobs), and ends when the job does.
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
const started = everyone.startJob({ kind: 'burglary', dc: 15, members: ['sam', 'joe'], now });
const planned = started.cast.character('sam').planning.plan(started.job).helpedBy('joe').roll(dice, { now });
const sam = planned.cast.character('sam');
sam.check('larceny', 15, { job: started.job }).explain({ for: sam });   // includes "A good plan +2", as Sam believes it
sam.check('larceny', 15).explain({ for: sam });                         // not for the job: no plan
sam.check('larceny', 15, { job: started.job }).roll(dice, { now, witnesses: ['joe'] }).result({ for: joe });   // Joe watched, so sees how it went
```

Each step uses the cast the previous one returned, so no handle is stale.

**A roll's result is given only to those who were there:** the one who made a skill check and whoever watched it; the two in a social roll and its witnesses. Anyone else asking gets nothing, and can learn of it only by being told.

### Jobs

A job is a record in the cast: an id, its kind, its members, the DC a plan for it rolls against, its plan if it has one, and when it started and ended. While it is open, every skill check made for it by a member, other than fight rolls, includes the plan's modifier. It ends when the caller ends it (`cast.endJob(job, { now })`), and a member can belong to one open job at a time.

## Bookkeeping

Where it would be used once this is slotted into the game, which now uses `brains` for these:

- **Skimming:** reporting less than was earned to a superior (`src/books.ts`).
- **Running a business, a loan book or a numbers game well:** in place of `brains` in a business's management quality (`src/econ.ts`).

Both belong to the game's books, so both are [before the swap](#before-the-swap).

## Before the swap

What must be built in the overhaul before it replaces the game's systems in one sweep (see [One record](#one-record)):

- **The rest of the game's characters:** the game's `Character` has about 60 fields this does not hold (rank, family, crew, debts, memos and more), each with the systems that read and write it.
- **Families,** and with them family as closeness to a victim, which the game's `learn` counts as it counts affection.
- **Minor facts,** which change no one's respect, and stay out of gossip and history.
- **The clock:** feelings fading when nothing feeds them, as the game's `feelingsWeek` does, traits easing back towards a character's starting traits, and healing over time without resting. Healing is its own rule: a night's sleep heals some, a serious beating takes days, so the resting rule as built (8 hours restores full health) is revisited with it.
- **Sleeping** (decided 3 November 2026): someone asleep, by their own hours, is unavailable, as someone resting is.
- **Attacking someone asleep,** a kind of ambush on someone resting.
- **Taking by force and buying** items.
- **What really drives loyalty, ambition and sociability:** keeping or breaking one's word, rank and standing, and a social life. For now they move only with the small signals in [Temperament moves with conduct](#temperament-moves-with-conduct).
- **A personal problem** (decided 3 November 2026): gambling, debt, drink and the like, with how bad it is, is part of the character in the cast, read by the game's systems, and character rules can give it effects. Who knows of it comes from facts, by the rule below.
- **What people reveal about themselves** (decided 3 November 2026): someone telling another what they want, who they get on with or not, what they owe, or that they mean to leave is a fact, that they said it; a false one is a lie, with its claim. The listener knows it as told, can pass it on, and cannot tell a true one from a lie. For every character, it replaces the game's `insight`, which only the player has, and its knowledge with no fact behind it (`encounters.ts`, `leave:<id>`).
- **Lies told in front of others:** what witnesses to a deception believe.
- **The price of a partial persuasion:** what the target wants in return, recorded as one of the game's favours owed (`addFavour`), and what follows if it is not paid.
- **Clearing a name:** whether learning someone was falsely blamed repairs the feelings the lie caused.
- **Retention:** pruning old facts and transfers, with the summaries and balances they leave.
- **The shadow run.**

- **Skimming:** an opposed Bookkeeping check between the skimmer and their superior. The chance of the superior catching it must scale with the gap they can see, as the game's own check does now. Running a check only when someone is skimming would leak who is, and a suspicion must be recorded as an inferred fact, not as a change in trust with no recorded cause.
- **Running a business** with Bookkeeping, in place of `brains` in the game's management quality. This changes the game's economy.
- **Rank is detached from a character's attributes, skills, training and proficiency bonus** (decided 3 November 2026): rank never sets them, and no rule reads them from rank. Rank follows what a character does (what they earn, the work they do, who vouches for them), so abilities reach it only through how those actions go.
- **Mapping the game's records** ([mapped field by field](game-mapping.md), 3 November 2026, with the decisions it needs): where each field of the game's characters lands, how the game's world generator and character creation make overhaul characters, which courage to keep (the game has two), hurt as hit points, the player's `conduct`, and cash against the ledger. Nothing is converted: the swap is a clean break.
