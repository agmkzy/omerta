# Character: points to revisit

What building [the character plan](README.md) has left open: choices made while building that the plan did not settle, gaps
left for a later step, and anything not yet verified. It is updated after every build step. When a point is decided, it moves
into the plan and is taken off this list. What the plan itself leaves for slotting into the game is under its
[Later](README.md#later).

## To decide

| Point | Where it came up | Now |
| --- | --- | --- |
| **Guessing a hidden actor.** The game's `suspect` has a victim of a hidden actor guess who did it, and they can guess wrong. | Step 5 | Not ported: it needs randomness and rules we have not agreed. A victim of a hidden actor blames no one. |
| **When the truth replaces a belief.** A listener who already knows a fact keeps their own version, as in the game's `learn`, so a victim who never saw the hidden actor cannot learn who it was just by being told. | Step 5 | Re-belief exists as a rule; when it applies (being lied to, learning the truth) is to be settled with deception in step 7. |
| **Telling.** A character telling another what they believe is an operation the plan implies (versions record who told them; Deception depends on told or heard) but does not name. | Step 5 | Built as `tell`. |
| **Items changing hands.** There is no giving or taking items: they come from a character's input and leave only when used up. | Step 4 | Moving an item should be recorded, as cash transfers are; how is to be decided. |
| **What resting stops.** A rest is recorded with its time, but nothing yet reads it except `restingAt`. | Step 3 | What a resting character cannot do is for when jobs and the game's clock arrive. |
| **Healing.** Resting is the only way back to health. | Step 3 | Healing over time is under the plan's Later; there is no `heal`. |
| **Taking damage.** `damage(n)` is a plain method the plan does not name. | Step 3 | Built for fights (step 9) and tests. |
| **A victim always learns.** The game can record a fact its victim does not know about yet (`victimKnows: false`), and can make a fact public to others (`broadcast`). | Step 5 | Neither is ported. |
| **Unconscious witnesses.** Anyone named as a witness learns a fact, even if unconscious at the time. | Step 5 | Not checked. |

## Waiting for a later step

| Point | Where it came up | Waits for |
| --- | --- | --- |
| **Pruning old facts and transfers.** Nothing is pruned yet. The short summary a version keeps once its fact is gone, and the balance kept when old transfers go, are not built, since keeping them now would copy facts and balances that still exist. | Steps 4 and 5 | Retention |
| **Results given to a viewer.** Drinking returns the plain check result. | Step 4 | Social checks (step 7) |
| **The lab's playground.** It still runs on the lab's code. | Step 1 | Fights in the overhaul (step 9), then it can be pointed at the overhaul and the lab's code removed |

## Not yet verified

| Point | Where it came up |
| --- | --- |
| **The overhaul's CI job** has not run, because nothing has been pushed. | Step 0 |

## Choices made while building

These were reported when they were made and stand unless revisited.

- **Changing a replaced cast is refused, not merged,** even when the two changes would not conflict (step 2).
- **Character ids are given by the caller.** The cast's counter makes ids only for facts, and later jobs (steps 2 and 5).
- **The overhaul imports no packages,** not only nothing of the game's; the boundary test enforces it (step 0).
- **A new character's cash cannot be set directly:** opening balances are transfers from the world (step 4).
- **Only weapons can be shown, and only clothing worn** (step 4).
- **Time is in minutes,** as in the game (step 3).
- **The game's fact kinds are read from its source as text** by a test, so they cannot drift apart without the overhaul importing the game (step 5).
