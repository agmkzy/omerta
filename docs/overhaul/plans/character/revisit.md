# Character: points to revisit

What building [the character plan](README.md) has left open: choices made while building that the plan did not settle, gaps
left for a later step, and anything not yet verified. It is updated after every build step. When a point is decided, it moves
into the plan and is taken off this list. What the plan itself leaves for before the overhaul replaces the game's systems is
under its [Before the swap](README.md#before-the-swap).

## For the game's integrity register

Found in the outside review, in the game itself (`docs/architecture/INTEGRITY.md`), not in the overhaul:

- The game's scheduled reveal of a hidden actor never reaches the victim, because `learn` returns early for a fact already known (`src/consequences.ts` with `src/core.ts` `learn`).
- `suspect` raises a grudge with no recorded reason, bypassing `bear` (`src/core.ts`).
- `broadcast`'s comment says listeners do not learn who did it; its code lets them, unless the actor is hidden.

Found in mapping the game's character fields ([game-mapping.md](game-mapping.md)):

- Characters' cash is changed directly in 254 places in 42 files, the ledger records only movements inside the player's circle, and no check proves a character's cash adds up (`ledgerCheck` and `audit` cover businesses and debts). Invariant H.
- Someone can be told a fact without their feelings changing (`revenge.ts`, `deeds.ts` `toldDirect`), bypassing `learn`. Invariant A.
- `encounters.ts` stores knowledge that has no fact behind it (`known['leave:<id>']`), so it has no recorded cause. Invariants A and D.

## To confirm

| Point | Where it came up | Now |
| --- | --- | --- |
| **A loser beaten with no blow struck.** Losing a fight while still conscious (surrendering, or running and being caught) counts as being beaten: the fight ends, a `beating` is recorded at the smallest beating's feelings, and nothing else happens to them. So someone unarmed who loses their nerve against a knife at the start can be "beaten" at full health by someone who never touched them, which also sits badly with a beating with no blow struck not counting as violence. Options: (1) the winners beat them when it is over, with real damage; (2) the fight ends with them at the winner's mercy, recorded as a fight they lost, and beating them afterwards is a separate choice by whoever controls the winner, recorded as a beating with real damage and the conduct of beating someone who cannot fight back, with letting them go a choice too. Recommended: (2). | The demo, 3 November 2026 | Built as described; open |

## Waiting for a later step

| Point | Where it came up | Waits for |
| --- | --- | --- |
| **Results given to a viewer for drinking.** Social checks give their odds, explanations and results to a viewer; drinking still returns the plain check result. | Steps 4 and 7 | Undecided: drinking has no one else in it yet |
| **Retention and the shadow run** are on the plan's [Before the swap](README.md#before-the-swap) list. | Steps 4 and 5 | The swap |
| **The lab's playground.** It still runs on the lab's code. The overhaul now has fights, but not the lab's stepping through a fight roll by roll, its exact fight odds, its fight descriptions or its assessment of how a fight will go, which the playground uses. | Steps 1 and 9 | Porting those, then pointing the playground at the overhaul and removing the lab's code |
| **How fast injuries heal.** A rest of 8 hours or more restores full health, so if sleep healed by it, everyone would be fully healed each night. Sleep makes someone unavailable but does not heal by this rule; healing gets its own rule with the clock. | Mapping the game (sleeping) | Healing over time (the design's Before the swap: The clock) |
| **Fight results for a viewer.** A fight's result is given whole, as anyone there sees it; it is not given to a viewer as social checks' are. | Step 9 | Undecided: a fight is seen by everyone in it |

## Not yet verified

| Point | Where it came up |
| --- | --- |
| **The overhaul's CI job** has not run, because nothing has been pushed. | Step 0 |
| **Whether traits drift to the ends.** The plan asks for long simulated runs to check that NPCs' choices, which follow their traits, do not push every trait to an end. Nothing chooses for NPCs in the overhaul yet, so there is nothing to run. | Step 8 |

## Choices made while building

These were reported when they were made and stand unless revisited.

- **Changing a replaced cast is refused, not merged,** even when the two changes would not conflict (step 2).
- **Character ids are given by the caller.** The cast's counter makes ids only for facts and jobs, which share it (steps 2, 5 and 10).
- **A conduct step's cause** is a fact, an item used up, or a job (step 10).
- **The overhaul imports no packages,** not only nothing of the game's; the boundary test enforces it (step 0).
- **A new character's cash cannot be set directly:** opening balances are transfers from the world (step 4).
- **Only weapons can be shown, and only clothing worn** (step 4).
- **Time is in minutes,** as in the game (step 3).
- **The game's fact kinds and learning tables are read from its source as text** by tests, so they cannot drift apart without the overhaul importing the game (steps 5 and 6).
- **Learning about someone makes them no longer a stranger,** even for a fact whose kind changes no feelings, such as a theft (step 6).
- **Social checks roll a d20,** as the plan's other checks do; the lab's choice of dice (2d10, 3d6) is not carried over (step 7).
- **A saved transfer of an item no longer recognised is left out and reported,** as the item is from the inventory that holds it, so the item audit still balances (building the decisions).
- **"Impossible" is a modifier of −100,** large enough that no roll can succeed, explained with its reason (step 7).
- **A lie must differ from what the liar believes** (otherwise it is telling), and a lie about a fact the liar invented is refused: a new lie invents a new fact (step 7).
- **A week for conduct is the seven days counted back from now,** not a calendar week (step 8).
- **Learning a fact reads the traits a character had before it happened;** the conduct it is for them comes after, and a lie to someone who trusts the liar reads their trust before the lie (step 8).
- **Conduct of an unknown kind in a save is left out and reported,** like anything else not recognised (step 8).
- **`damage(n)`** is a plain method for fights and tests (step 3).
- **Adding a character with items needs a time,** `add(input, { now })`, since the world gives them their items then (building the decisions).
- **Paying in person needs both there;** paying the world needs only the payer, and a plain `cast.transfer` checks no one (building the decisions).
- **A planning helper must be there,** as the planner must (building the decisions).
- **An unconscious character can rest,** and heals by it as anyone does (building the decisions).
- **Drinking takes a time and whoever else is there** (`drink(roller, { now, with })`), and drinking together, like any telling, makes those there meet (step 8; meeting decided 3 November 2026).
- **Who knows a modifier** follows from knowledge having a source: a situational modifier added with `.with()` is known to everyone there; anyone but the target judges a shown weapon by the weapons the target shows; anyone who saw a fact with the target knows the target saw it, and whoever told the target knows what they told (step 7).
- **Witnesses to a lie meet those in it but learn nothing,** and the lie fact records no witnesses, until what they believe is built (the plan's Before the swap, Lies told in front of others) (step 7).
- **Shaken on giving in:** a target who gives in to intimidation (partial success or better, as the table of how a roll looks has it) is shaken (step 7).
- **Trying counts as conduct:** persuading, lying and intimidating move the actor's traits whatever the outcome, since every roll records its fact, which is what the conduct table counts (step 8).
- **A beating is scaled by each attacker's damage:** the fact for each attacker records the hit points that attacker took, so the one beaten resents most whoever hurt them most (step 9).
- **A beating recorded directly,** with `cast.record` and no amount, changes feelings by the game's rows, unscaled (step 9).
- **Sparring** can end with someone knocked out (one hit taking them past half health), though nothing lasts; it uses everyone's current effects, such as drunk; and the fighters meet (step 9).
- **The chosen check:** a critical success's advantage goes to one check chosen when planning: the first check of a chosen skill by a chosen member, made for the job (step 10).
- **Who believes the plan:** every member of the job sees the plan as the planner does, a critical failure as a failure; anyone outside the job knows nothing of it (step 10).
- **What a job is:** its kind is free text, and it records no outcome: it is open until the caller ends it. Starting and ending it record no facts. A job of DC 20 or more is hard, and its members grow more ambitious when it starts (step 10).
