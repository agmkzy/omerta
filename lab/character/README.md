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
| `src/fight.ts`, `src/fight-step.ts`, `src/fight-odds.ts`, `src/fight-log.ts` | Fights: the rules and simulation, stepping roll by roll, exact odds, and descriptions (see below). |
| `src/nerve.ts` | The nerve check shared by fights and threats. |
| `src/assessment.ts` | Simulated fights counted, and how a fight is likely to go for the left side in words, on a fixed likelihood scale. |
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
browser after every change, as is the open tab. The check tab picks its two characters from the saved list; the fight line-up is also saved. The roster and line-up logic (`playground/roster.ts`, `playground/parties.ts`) is pure and tested like the library. Saved data is protected by `openRoster`:
- If storage cannot be read, or holds data saved by a newer version, the data is left alone and nothing is saved that
  session.
- Anything else that cannot be fully read (a corrupt entry, or a field, background, skill, attribute or trait this
  version does not recognise, in a character or in the roster) is copied, with the fight line-up, to backup keys named
  from their content (`playground/storage.ts`), so reloading makes no further copies. It is left as it is until the
  first change. If a backup fails, nothing is saved that session.
- The fight line-up (`lineUp` in `playground/parties.ts`) is only saved when it is changed on the Fight tab. If saving
  what was read would change the stored line-up (it was corrupt, or held something not recognised), it is backed up first.
- A warning above the tabs says what happened and where the original is kept.

Renames are handled by migrations (format 1 to 2 renamed the backgrounds). `test/fixtures/roster-format1.json` is a save
written by an older build and must keep loading.

Tests are in `test/`, one file per module. Each is tagged `unit`, `property` (fast-check) or `statistical` (a seeded
simulation checked against expected rates). Fight tests script their dice by what each roll is for (`fightWith` in
`test/support.ts`). Coverage is 100% (statements, branches, functions and lines) for `src/` and the playground's pure
modules (`roster.ts`, `parties.ts`, `storage.ts`, `animation.ts`); the panels that build the page are checked in the
browser.

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

**Decided (November 2026): the roll decides the target's response.** In a discussion of whether a roll may make someone
comply against their will, the conclusion was that it may, as long as everything about the target goes into the roll:

- What the target knows, what is at stake for them and their temperament are all modifiers on the check. A rumour
  that the lie is false, or a request that would cost them a lot, makes the check harder; it does not take the
  decision away from the roll. Because the modifiers come from the target's own state, the result is still the
  target's own reaction (their nerve failing, their belief), not something imposed from outside.
- Those modifiers must come from what the target actually knows, with its source (seen, told, rumour), never from the
  truth or from what the player knows. The game, which tracks knowledge, works them out; the lab only takes them as
  situational modifiers (`SocialSpec.modifiers`), which it already does. A modifier on the actor's side is equivalent to
  the opposite one on the target's side.
- A certain outcome (the target saw the truth themselves) needs no roll. That is the same as a modifier large enough
  to make the check impossible, which works only while social checks have no automatic success: on a d20 the target's
  bonus must lead the actor's by 19 or more (18 on 2d10, 15 on 3d6), since ties go to the target. Adding "the highest
  roll always succeeds" to social checks would turn "impossible" into a small chance. Saying why a check cannot work
  ("he saw it himself") is clearer to the player than showing a hopeless roll.
- The roll decides the immediate response only. What the target does afterwards (resenting it, telling others,
  getting even) comes from their own state in the game.
- Temperament changes the odds, never removes them: a brave or proud target is harder to intimidate, not immune,
  unless the modifiers make it impossible as above.

### Fights

Fights are between two sides (attackers and defenders) of one or more fighters, following D&D's combat rules; nobody
chooses actions. Each fighter rolls initiative, then on their turn attacks a random enemy (with advantage when ganging
up, after D&D's optional flanking rule); hits deal damage, a fighter at 0 hit points is knocked out, and nerve checks
(after D&D's optional morale rules) take fighters out when they first drop to half hit points or see half their side
out. The rules in words, with every number, come from `fightRules(dice)` in `src/fight-log.ts`, built from the
constants the code uses; the playground's Fight tab and guide show them.

- `src/fight.ts`: the rules and the simulation. `attackOutcome` is the one attack rule (the highest possible roll is a
  critical hit, the lowest a miss, otherwise the total against Defence); `passes` in `src/check.ts` is the one pass
  rule for every check. Every die rolled says what it is for in a `RollRequest`, which carries the fight's dice, who
  rolls and against whom, and the modifiers with their reasons, so anything that explains a roll reads it from there.
- `src/fight-step.ts`: `stepFight(spec, faces)` replays a fight from the rolls so far and returns the next roll it is
  waiting for, the fight so far and where each roll started. A fight is fully rebuilt from its rolls, so going back is
  dropping the last one (`withoutLastRoll`).
- `src/fight-odds.ts`: the exact odds of any roll, from the same rules.
- `src/fight-log.ts`: events, roll requests and the rules in words.
- `src/assessment.ts`: `tallyFights` counts simulated fights; `simulateFights` uses a fixed seed, so the setup page's
  assessment and the Simulate button show the same 2,000 fights.

The nerve check itself (`src/nerve.ts`) is shared: it is also made when a weapon is drawn on someone (DC 12).

## Open questions

- **Dice.** d20 is swingy: an untrained character beats a +11 expert in an opposed check 9% of the time (under 1% on
  3d6). Compare in the playground's dice panel.
- **Progression.** XP/levels versus improvement through use. Not implemented; only the proficiency bonus can be set.
- **Knowledge.** The player should see an estimate of an NPC's abilities based on what they know, not the true values.
  This would sit on top of the exact odds.
- **Fight balance.** Damage, hit points and the nerve DC are first guesses, all defined as constants. The Fight tab's
  Simulate button shows how a line-up's fights tend to end.
- **Unused skills.** Firearms and others are defined but nothing uses them yet. Armour and weapons are not
  modelled.
- **Integration with the game.** Mapping the existing `Traits`/`Skills` onto this model, save migration, and replacing
  the game's existing ad-hoc checks in `src/` are not started.
