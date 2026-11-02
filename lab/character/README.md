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
| `src/assessment.ts` | How a fight is likely to go for the left side, in words: estimated from simulated fights and described on a fixed likelihood scale. |
| `src/social.ts` | Social actions (intimidate, persuade, deceive) as single checks, with outcome meanings and exact odds. |
| `src/explain.ts` | Plain-text descriptions of rolls and checks. |
| `src/serialize.ts` | Versioned JSON save/load for characters, with validation and defaults for missing fields. |
| `playground/` | Framework-free browser page using the modules above (see below). |

## Playground

Tabs: **How it works** (a step-by-step introduction with worked examples whose numbers are calculated live), **Characters** (a list of saved characters and an editor for the selected one, split into attributes, skills
and temperament), **Skill check** (intimidate, persuade, deceive, or any skill), **Fight** (a set-up page where saved characters are added to
two sides, then the fight, either played automatically or stepped through roll by roll, rolling or choosing each
result; each fighter's card shows their stats and state, with a short log by round) and **Dice
and odds**. Characters are saved to `localStorage` in this
browser after every change, as is the open tab. The check tab picks its two characters from the saved list; the fight line-up is also saved. The roster and line-up logic (`playground/roster.ts`, `playground/parties.ts`) is pure and tested like the library. Saved data that cannot be fully read (a corrupt entry, or a newer format) is copied to a
backup key before anything is saved over it, and the Characters tab says so; unknown skills, attributes and traits are
ignored rather than rejected, and renames are handled by migrations. `test/fixtures/roster-format1.json` is a save written
by an older build and must keep loading.

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

Fights are between two sides (attackers and defenders) of one or more fighters, following D&D's combat rules; nobody
chooses actions.

- **Initiative:** everyone rolls Reflexes; the order is highest first (defenders first on a tie, then list order) and
  is used every round.
- **Attacks:** on their turn each fighter still in the fight attacks a random enemy who is still fighting (no die is
  rolled when there is only one): d20 + Brawling bonus against the target's **Defence** (10 + Reflexes bonus, like D&D's
  unarmoured Armour Class). A hit deals 1d4 + Strength modifier (minimum 1). A natural 20 always hits and rolls the
  damage dice twice; a natural 1 always misses. There are no wound penalties.
- **Ganging up** (after D&D's optional flanking rule): an attack has advantage if someone on the attacker's side has
  already attacked that target this round. One-against-one fights are unaffected; in simulation one fighter's chance
  against three civilians falls from 43% to 28%.
- **Hit points** are 10 + Constitution modifier, plus the proficiency bonus if trained in Toughness (twice if expert):
  D&D's first-level d10 hit die plus its Tough feat. 0 HP is a knockout.
- **Nerve (morale)**, following D&D's optional morale rules: a fighter makes one nerve check (DC 10) the first time they
  drop to half HP or below, and everyone left on a side makes one (DC 10) the first time half of that side is out of
  the fight. A failure takes that fighter out: a low-courage or high-caution fighter flees; otherwise a defender
  surrenders or an attacker backs off.
- **Ending:** a side loses when none of its fighters is still fighting; otherwise the round limit gives a stalemate.
- `tallyFights` counts wins per side and how each fighter ended up (`FIGHTER_STATUS_INFO` explains each status).
- **Stepping through:** every die in a fight says what it is for (initiative, target, attack, damage, nerve, with the
  numbers involved). `stepFight(spec, faces)` replays a fight from the rolls so far and returns the next roll it is
  waiting for, with the fight so far; `describeRollRequest` says what that roll needs and its chance. A fight is fully
  rebuilt from its rolls, so going back is dropping the last one.

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
