# Character lab

An exploratory, self-contained prototype of a D&D-style character system: attributes, skills, temperament, checks and
contests. It is intended to eventually replace the game's `Traits`/`Skills` (`src/types.ts`), but nothing here is
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
| `src/contest.ts` | Automatically resolved multi-round contests (see below). |
| `src/contest-log.ts`, `src/explain.ts` | Plain-text descriptions of results and events. |
| `src/serialize.ts` | Versioned JSON save/load for characters, with validation and defaults for missing fields. |
| `playground/` | Framework-free browser page using the modules above (see below). |

## Playground

Four tabs: **Characters** (a list of saved characters and an editor for the selected one, split into attributes, skills
and temperament), **Skill check**, **Contest** and **Dice and odds**. Characters are saved to `localStorage` in this
browser after every change, as is the open tab. The check and contest tabs pick their two characters from the saved
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

### Contests

A contest is a multi-round opposed check that resolves automatically; neither side chooses actions.

- **Intimidation and armed threats are decided by a lead.** Each round both characters roll. Whoever rolls higher gains
  lead points: 1 per 5 points of difference, rounded up. A tie changes nothing. A character wins outright when their
  lead reaches the **winning lead** (default 5). `intimidation` is Intimidation vs Nerve; `armed-threat` is the same
  with attacker advantage and a DC 12 nerve check for the defender before round 1.
- **Fights are decided by hit points, using D&D's attack rules.** When a fight starts, both characters roll Reflexes
  for initiative; the higher acts first each round (a tie goes to the defender). Each round each character attacks:
  d20 + Brawling bonus against the target's **Defence** (10 + Reflexes bonus, like D&D's unarmoured Armour Class). A
  hit deals 1d4 + Strength modifier (minimum 1). A natural 20 always hits and rolls the damage dice twice; a natural 1
  always misses. 0 HP is a knockout, and a knocked-out character does not act. There are no wound penalties.
- **Hit points** are 10 + Constitution modifier, plus the proficiency bonus if trained in Toughness (twice if expert):
  D&D's first-level d10 hit die plus its Tough feat.
- **Nerve checks** happen when a character falls behind by half the winning lead (DC 10, once per side), first drops to
  half HP or below in a fight (DC 10, once per side: fight or flight, as in D&D's optional morale rule), or has a weapon
  drawn on them (DC 12).
- **A failed nerve check** ends the contest: a high-temper character escalates to a fight instead (once, and not when
  already fighting), a low-courage or high-caution character flees, and anyone else yields: in a fight the defender
  surrenders and the attacker backs off; otherwise the defender complies and the attacker backs down.
- **Other endings:** the attacker's optional withdraw setting (lead contests only) and the round limit (stalemate).
- `ENDING_INFO` explains each kind of ending; the playground groups simulated results by winner and cause.

## Open questions

- **Dice.** d20 is swingy: an untrained character beats a +11 expert in an opposed check 9% of the time (under 1% on
  3d6). Compare in the playground's dice panel.
- **Progression.** XP/levels versus improvement through use. Not implemented; only the proficiency bonus can be set.
- **Knowledge.** The player should see an estimate of an NPC's abilities based on what they know, not the true values.
  This would sit on top of the exact odds.
- **Contest balance.** The lead step, nerve DCs, damage and temperament effects are first guesses, all defined as
  constants or in one table. Simulated fights last about 2.5 rounds (about 5 attacks) and end
  about 50–60% by knockout and the rest by a failed nerve check.
- **Unused skills.** Firearms and others are defined but no contest uses them yet. Armour and weapons are not
  modelled.
- **Integration with the game.** Mapping the existing `Traits`/`Skills` onto this model, save migration, and replacing
  the game's existing ad-hoc checks in `src/` are not started.
