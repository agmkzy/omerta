# Character overhaul: handover

Where the work stands, for picking it up in a new session. Written 3 November 2026. Read with [the plan](README.md) (the source of truth for what was decided) and [the revisit list](revisit.md) (what is open). Delete this file once its work is done.

## Working rules (from the owner)

- Branch `feat/character-lab`. **Never push.** Commit in logical chunks, conventional commits, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Plain professional language everywhere (no period or themed flavour).
- Talk with the owner before changing design or mechanics; no balance changes unless asked.
- After every build step, update `revisit.md` with open points, gaps and anything unverified.
- When presenting decisions, put tables and drafts in the closing message, never before a question tool.
- Checks before committing: `npm run overhaul:typecheck`, `npm run overhaul:cov` (100% is the threshold), `npm run typecheck` (the game).

## What is done

All eleven build steps of the plan (steps 0 to 10) are built and committed: the cast, condition, inventory and cash, knowledge, relationships, social actions, conduct, fights, jobs and planning. Nine open mechanics were then reviewed by an outside agent and decided with the owner; they are written into the plan (commit bf326fb), and the owner chose to replace the game's systems in **one sweep, after a shadow run** (plan: One record, Before the swap).

## In progress: building the nine decisions

Committed as work in progress, with **all 458 tests passing but coverage below 100%** (about 98%), so `overhaul:cov` fails until the remaining tests are written.

### Built

- **Save format 8** (`CAST_FORMAT = 8`, migration 7→8 in `save.ts`, which gives existing characters' items as transfers from the world at time 0). New optional fields: a version's `who` / `size` (each part's provenance) and `blamed`; a fact's `ending` and `claim`; a transfer's `item` and `cause`.
- **Per-part provenance** (`knowledge.ts`: `partOf`, `passOn`, `PartSource`, `PartHow` with `'guessed'`). `rebelieve` now changes one part (`Belief`), keeping the rest of the version. The lie table (`knowledgePart` in `social.ts`) reads the changed part's provenance; a guess counts as not knowing.
- **Feelings once per fact and person blamed** (`learnFact`, `blamedFor` in `learning.ts`); `blamed` is stored only when it holds more than the current belief.
- **Telling is a check**: `sam.social.tell(rico, factId)` (`tell.ts`), replacing `character.tell`. Filling a gap or a new telling needs no roll; agreeing changes nothing; contradicting is Persuasion against `TELL_DC` (10) with the knowledge and persuasion-feeling modifiers; on success the part changes with the teller's provenance; a lie comes out (`lieBehind`, `foundOut`) when the overturned part came straight from a liar who told it as seen and whose lie fact claimed that part. A roll makes the two meet.
- **Social facts record `ending`; lie facts record `claim`.**
- **A beating with no blow struck is not violence** (`isViolent` in `learning.ts`): no witness fear, no "has seen them be violent".
- **Fondness means affection high** (≥ 0.7) in the learning tables.
- **Guessing a hidden actor** (`guessActor`, `SUSPECT_GRUDGE` = 0.3), applied in `recordFact`, stored as blame with `who: { how: 'guessed' }`.
- **Public facts**: `record(fact, { now, witnesses, public: [...] })`.
- **Who can be there**: `assertAvailable` (`condition.ts`: conscious and not resting; also `restingAt`) checked for the actor and witnesses in `record`, everyone in a social roll, fighters and witnesses in a fight, both sides of `give` and `pay`. In fights, facts' witnesses follow the order of events (`FighterResult.endedAt` / `goneAt`).
- **Items change hands by transfers**: `auditItems` in `transfers.ts`; starting items are world transfers from `cast()` and `add(input, { now })`; drinking sends the bottle to the world; `sam.give(rico, item, { why, now, cause? })`; `transfer` and `pay` take an optional `cause`, checked in `castOf`.

### Still to build

1. **Fights** (`fight-record.ts`):
   - Beating the helpless: "set upon by more than one" only when the actor is on the attacking squad; and only for an actor who struck the victim (damage > 0) or is on the attacking squad.
   - Fighting when provoked: if `options.cause` is a `threat` with `ending: 'provoked'`, its victim is on the attacking squad and its actor among the defenders, and the fight is within 24 hours (`DAY`) of it, record `'fighting-when-provoked'` for the provoked one.
   - Pin the measured fight rates (revisit list, Fight balance) in a statistical test.
2. **Resting** (`cast.ts` `rest`): 8 hours or more restores full health and clears Shaken and Drunk; a shorter rest heals `floor(missing × hours / 8)` and clears nothing. Refuse while resting (via `assertAvailable` at `now`): `check`, the planning roll, `drink` (and its company), and telling (teller and listener). A plain `cast.transfer` with the world stays allowed.
3. **Tests to bring coverage back to 100%**: giving and the item audit (including giving what one does not carry, a shown item, someone resting); `add` with items and no `now`; transfer causes; format-8 saves (a `cast-format8.json` fixture, the 7→8 migration, reading and rejecting `who`/`size`/`blamed`/`ending`/`claim`/`item`/`cause`); and the gaps `overhaul:cov` lists in `facts.ts`, `transfers.ts`, `tell.ts`, `social.ts`, `cast.ts`.
4. **Docs**: in the plan, note `sam.social.tell` (telling is a check) and `add(input, { now })`; move the "Decided, to build" rows of `revisit.md` out once built, and add choices made while building (telling meets only when it rolls; `add` needs `now` for items; `pay` needs both there).
5. **Commit** in logical chunks, then ask the owner about the 27 points under "To confirm" in `revisit.md`.

## Known context

- The game itself has three problems found by the review, listed in `revisit.md` (For the game's integrity register).
- The lab (`lab/character/`) is frozen; its playground still runs on the lab's code.
- Nothing has been pushed, so the overhaul's CI job has never run.
