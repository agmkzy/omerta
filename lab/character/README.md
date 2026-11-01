# Character lab

An exploratory, self-contained prototype of a D&D-style character system: attributes, skills, temperament, checks and
fights. It is intended to eventually replace the game's `Traits`/`Skills` (`src/types.ts`), but nothing here is
connected to the game yet. The lab imports nothing from `src/`, and the game imports nothing from the lab.

## Running

```bash
npm run lab:test        # all lab tests (under a second)
npm run lab:watch       # tests in watch mode
npm run lab:cov         # tests with coverage (thresholds: 100%)
npm run lab:typecheck   # strict TypeScript (noUncheckedIndexedAccess, exactOptionalPropertyTypes)
npm run lab:dev         # playground at http://localhost:5180
```

## Structure

| Module | Purpose |
|---|---|
| `src/random.ts` | Injected randomness. `seeded()` is mulberry32, matching the game's `Rng`, which already satisfies `RandomSource`. |
| `src/dice.ts` | d20, 2d10 and 3d6 as interchangeable options; advantage/disadvantage. |
| `src/distribution.ts` | Exact probability distributions, so odds are calculated rather than sampled. |
| `src/check.ts` | DC checks and opposed checks; modifiers carry a reason; five graded outcomes; exact odds. |
| `src/attributes.ts` | STR, AGI, CON, INT, WIS, CHA on a 1–20 scale with the D&D modifier; 4d6-drop-lowest rolling. |
| `src/skills.ts` | 18 skills, each based on one attribute, some with an alternative (e.g. Intimidation with STR). |
| `src/character.ts` | Characters: attributes, training (untrained/trained/expert), proficiency bonus (2–6), temperament. `rollFor()` builds a roll. |
| `src/temperament.ts` | 12 traits (the game's 7 plus loyalty, pride, temper, honesty, cruelty), 0–1. One table lists where temperament modifies rolls. |
| `src/backgrounds.ts` | Backgrounds instead of classes: training, attribute priorities, temperament centres. `rollCharacter()` generates a character. |
| `src/fight.ts`, `src/fight-log.ts` | Fights: initiative, attack rolls, damage, hit points and morale (see below). |
| `src/nerve.ts` | The nerve check shared by fights and threats. |
| `src/social.ts` | Social actions (intimidate, persuade, deceive) as single checks, with outcome meanings and exact odds. |
| `src/explain.ts` | Plain-text descriptions of rolls and checks. |
| `src/serialize.ts` | Versioned JSON save/load for characters, with validation and defaults for missing fields. |
| `playground/` | Framework-free browser page using the modules above (see below). |

## Playground

Four tabs: **Characters** (a list of saved characters and an editor for the selected one, split into attributes, skills
and temperament), **Skill check** (intimidate, persuade, deceive, or any skill), **Fight** and **Dice and odds**. Characters are saved to `localStorage` in this
browser after every change, as is the open tab. The check and fight tabs pick their two characters from the saved
list. The roster logic (`playground/roster.ts`) is pure and tested like the library.

Tests are in `test/`, one file per module. Each is tagged `unit` or `property` (fast-check). The suite has 100% statement,
branch, function and line coverage.

## Design decisions

- **Three layers.** Attributes (innate ability), skills (training) and temperament (inclination) are separate, so a
  character's ability to do something is independent of whether they want to.
- **D&D arithmetic.** A check is dice + attribute modifier + proficiency (doubled for expertise) + situational
  modifiers, against a DC or an opposing total. In opposed checks, ties go to the passive side.
- **Graded outcomes.** Margin bands give critical failure / failure / partial / success / critical success
  (defaults: < −5, −5 to −1, 0 to 4, 5 to 9, ≥ 10). Bands are configurable.
- **Explainable modifiers.** Every modifier has a reason, so any result can be broken down.
- **Exact odds.** `checkOdds`/`opposedOdds` give exact probabilities. Intended for NPC decision-making.
- **Deterministic.** All randomness comes from an injected source; the same seed gives the same results.

### Social actions

As in D&D, getting someone to do something without force is a single check, not a multi-round contest:

- **Intimidate:** Intimidation against the target's Nerve. **Persuade:** Persuasion against Insight. **Deceive:**
  Deception against Insight. Temperament modifiers apply automatically (e.g. a proud target resists intimidation).
- Each of the five outcomes has a meaning for that action, e.g. a partial success at intimidation means the target
  complies but resents it; a critical failure at deception means they see through it.
- **Armed intimidation:** the target first makes a DC 12 nerve check. Failing it, they comply at once, flee (timid or
  cautious) or fight back (hot-tempered). If they hold, the intimidation is rolled with advantage.
- A critical failure at intimidating a hot-tempered target provokes a fight.
- `socialOdds` gives the exact chance of every result, including the nerve check.

### Fights

Fights follow D&D's combat rules; neither side chooses actions.

- **Initiative:** both characters roll Reflexes; the higher acts first each round (a tie goes to the defender).
- **Attacks:** each round each character attacks: d20 + Brawling bonus against the target's **Defence** (10 + Reflexes
  bonus, like D&D's unarmoured Armour Class). A hit deals 1d4 + Strength modifier (minimum 1). A natural 20 always hits
  and rolls the damage dice twice; a natural 1 always misses. There are no wound penalties.
- **Hit points** are 10 + Constitution modifier, plus the proficiency bonus if trained in Toughness (twice if expert):
  D&D's first-level d10 hit die plus its Tough feat. 0 HP is a knockout, and a knocked-out character does not act.
- **Nerve (morale):** the first time a character drops to half HP or below, they make one nerve check (DC 10), as in
  D&D's optional morale rule. Passing commits them to the fight. Failing ends it: a low-courage or high-caution
  character flees; otherwise the defender surrenders or the attacker backs off.
- **Other ending:** the round limit (stalemate).
- `FIGHT_ENDING_INFO` explains each ending; the playground groups simulated results by winner and cause.

The nerve check itself (`src/nerve.ts`) is shared: it is also made when a weapon is drawn on someone (DC 12).

## Open questions

- **Dice.** d20 is swingy: an untrained character beats a +11 expert in an opposed check 9% of the time (under 1% on
  3d6). Compare in the playground's dice panel.
- **Progression.** XP/levels versus improvement through use. Not implemented; only the proficiency bonus can be set.
- **Knowledge.** The player should see an estimate of an NPC's abilities based on what they know, not the true values.
  This would sit on top of the exact odds.
- **Fight balance.** Damage, hit points and the nerve DC are first guesses, all defined as constants. Simulated fights
  last about 2.5 rounds (about 5 attacks) and end about 50–60% by knockout and the rest by a failed nerve check.
- **Unused skills.** Firearms and others are defined but nothing uses them yet. Armour and weapons are not
  modelled.
- **Integration with the game.** Mapping the existing `Traits`/`Skills` onto this model, save migration, and replacing
  the game's existing ad-hoc checks in `src/` are not started.
