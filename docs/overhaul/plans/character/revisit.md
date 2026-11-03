# Character: points to revisit

What building [the character plan](README.md) has left open: choices made while building that the plan did not settle, gaps
left for a later step, and anything not yet verified. It is updated after every build step. When a point is decided, it moves
into the plan and is taken off this list. What the plan itself leaves for slotting into the game is under its
[Later](README.md#later).

## To decide

| Point | Where it came up | Now |
| --- | --- | --- |
| **Guessing a hidden actor.** The game's `suspect` has a victim of a hidden actor guess who did it, and they can guess wrong. | Step 5 | Not ported: it needs randomness and rules we have not agreed. A victim of a hidden actor blames no one. |
| **When the truth replaces a belief.** A listener who already knows a fact keeps their own version, as in the game's `learn`, so a victim who never saw the hidden actor cannot learn who it was just by being told, and someone who believed a lie keeps believing it when a witness tells them otherwise. | Steps 5 and 7 | A believed lie changes the target's version by re-belief. Learning the truth (and so finding out who lied, with the change of a lie seen through) is not built: when the truth should win over a belief, and whether that takes a roll, is to be decided. |
| **Inventing a fact about the target.** A lie inventing a fact that names the target (as whoever did it, or whoever it was done to) cannot succeed: "Rico would know: it would have been them". | Step 7 | Built this way; the plan only says an invented fact's modifier comes from whether it happened at all. |
| **How a social roll looks to others.** Only the target knows exactly how it went. Anyone else sees: for intimidation, gives in, resists or provoked; for persuasion, agrees or declines; for deception, no sign, unless the target sees through it. So a liar cannot tell whether a lie was believed. | Step 7 | Built this way. |
| **Who knows a modifier.** Situational modifiers added with `.with()` are known to everyone present. Anyone but the target judges a shown weapon by the weapons the target shows. Anyone who saw a fact with the target knows the target saw it; whoever told the target knows what they told. | Step 7 | Built this way. |
| **Lies and witnesses.** Witnesses to a deception meet those in it but learn nothing, and the lie fact records no witnesses. | Step 7 | As the plan has it for now; what witnesses believe is under the plan's Later. |
| **Lies the liar may tell.** A claim must differ from what the liar believes (otherwise it is telling, not lying), and a lie about a fact the liar invented is refused: a new lie invents a new fact. | Step 7 | Built this way. |
| **Provoked counts as resisting.** A provoked target holds a grudge (+0.1), and the actor's respect for them rises as for any target who resists (+0.05). | Step 7 | Built this way; the plan's two tables do not say which applies. |
| **Shaken on giving in.** Any target who gives in to intimidation (partial success or better) is shaken. | Step 7 | Built this way. |
| **What counts as a week.** Each kind of conduct moves a character's traits at most once in any seven days, counted back from now, not by calendar week. | Step 8 | Built this way. |
| **Trying counts as conduct.** Persuading, lying and intimidating move the actor's traits whatever the roll's outcome. | Step 8 | Built this way; the plan says "a persuasion" or "a lie", which every roll records. |
| **Drinking in company.** `drink` now takes a time and whoever else is there. Drinking together does not count as meeting. | Step 8 | Built this way. |
| **Traits before the experience.** When a fact is recorded, learning it reads the traits the character had before it happened; the conduct it is for them comes after. Lying to someone who trusts the liar reads their trust before the lie. | Step 8 | Built this way. |
| **Conduct of an unknown kind in a save** is left out and reported, like anything else not recognised, so the character's current traits lose that step. | Step 8 | Built this way. |
| **Fight balance.** Measured over 20,000 simulated fights each, between average characters: a shown weapon mostly ends a fight before a blow, because the start-of-fight nerve check fails often. Pistol against bare hands: the pistol wins 95%, and 70% of the time the other gives in unhurt. Knife against bare hands: 84%, and 55% unhurt. Pistol against knife: 91%. Two setting upon one: 98% (55% unhurt); two against one in an ordinary fight: 94%; an ambush adds about 1%. Even fights: 49% to 51%. A trained brawler wins 58%. A volatile fighter moves the odds by 2 to 3%. A timid fighter who runs gets away 46% of the time. | Step 9 | The weapon DCs (12, 15), the set-upon DC and the escape rule are the plan's starting values, to be tuned. |
| **One nerve check at the start.** Every reason to check at the start of a fight (a weapon that outclasses theirs, being set upon, already being at half health) is one check at the highest DC. | Step 9 | Built this way; the plan combines only the weapon and being set upon. |
| **A lone runner loses at once.** A squad with no one still fighting has lost, so a fighter on their own who fails their nerve and runs makes their one last escape straight away: away, or caught and beaten. | Step 9 | Follows the plan's rule; it means a lone runner has one chance. |
| **A beating scaled by each attacker's damage.** A fight's fact for each attacker records the hit points that attacker took, and the one beaten feels it by that share, so they resent most whoever hurt them most. | Step 9 | Built this way; the plan says "scaled by the damage they took". |
| **Who beat a winner who gave in.** A fighter on the winning squad who gave in is beaten by whoever attacked them, or, if no one did, by everyone on the other squad. | Step 9 | Built this way; the plan covers only a knocked-out winner. |
| **Fighting when provoked** is in the conduct table but not recorded: a `threat` fact does not record that it provoked its target, so a fight it caused cannot tell. | Step 9 | To decide: for example, the threat fact could record how it ended. |
| **Standing by their squad** counts a squad member as down if they are not fighting, including one who is running. | Step 9 | Built this way. |
| **Sparring** can knock someone out (a single hit past half health), uses everyone's effects, such as drunk, and makes the fighters meet. | Step 9 | Built this way. |
| **Beatings recorded directly.** A `beating` recorded with `cast.record` and no amount changes feelings by the game's rows, unscaled. | Step 9 | Built this way. |
| **Telling.** A character telling another what they believe is an operation the plan implies (versions record who told them; Deception depends on told or heard) but does not name. | Step 5 | Built as `tell`. |
| **Items changing hands.** There is no giving or taking items: they come from a character's input and leave only when used up. | Step 4 | Moving an item should be recorded, as cash transfers are; how is to be decided. |
| **What resting stops.** A rest is recorded with its time, but nothing yet reads it except `restingAt`. | Step 3 | What a resting character cannot do is for when jobs and the game's clock arrive. |
| **Healing.** Resting is the only way back to health. | Step 3 | Healing over time is under the plan's Later; there is no `heal`. |
| **Taking damage.** `damage(n)` is a plain method the plan does not name. | Step 3 | Built for fights (step 9) and tests. |
| **A victim always learns.** The game can record a fact its victim does not know about yet (`victimKnows: false`), and can make a fact public to others (`broadcast`). | Step 5 | Neither is ported. |
| **Unconscious witnesses.** Anyone named as a witness learns a fact, even if unconscious at the time; that includes a fighter knocked out early in a fight, who learns all of its facts. | Steps 5 and 9 | Not checked. |
| **Feelings follow whom someone is told did it.** The game's `learn` changes feelings only for someone who knows who did it; here, someone who only believes it (told "Joe did it") has their feelings change towards the one they blame, as the plan's re-belief has it. | Step 6 | Built this way. |
| **Telling is not meeting.** Two characters meet by taking part in the same roll, fight or recorded fact; being told a fact makes the listener no longer a stranger to those in it, but does not make teller and listener meet, so their familiarity does not grow. | Step 6 | Built this way. |
| **Who is close to a victim.** The game's `learn` has anyone fond of a victim, or in their family, resent whoever hurt them. | Step 6 | Only affection counts: the overhaul has no families yet. |
| **Minor facts.** The game's `minor` facts change no one's respect. | Step 6 | Not ported: the overhaul's facts have no `minor`. |

## Waiting for a later step

| Point | Where it came up | Waits for |
| --- | --- | --- |
| **Pruning old facts and transfers.** Nothing is pruned yet. The short summary a version keeps once its fact is gone, and the balance kept when old transfers go, are not built, since keeping them now would copy facts and balances that still exist. | Steps 4 and 5 | Retention |
| **Results given to a viewer for drinking.** Social checks give their odds, explanations and results to a viewer; drinking still returns the plain check result. | Steps 4 and 7 | Undecided: drinking has no one else in it yet |
| **Conduct in jobs.** Planning a job and taking part in a hard one are in the conduct table. A step's cause can be a fact or an item used up; a job's plan becomes a fact when jobs are recorded. | Step 8 | Planning and jobs (step 10) |
| **Finding out they were lied to, later.** Seeing through a lie makes the target less agreeable; learning the truth later would too, but is not built. | Step 8 | Learning the truth (see To decide) |
| **The lab's playground.** It still runs on the lab's code. The overhaul now has fights, but not the lab's stepping through a fight roll by roll, its exact fight odds, its fight descriptions or its assessment of how a fight will go, which the playground uses. | Steps 1 and 9 | Porting those, then pointing the playground at the overhaul and removing the lab's code |
| **Fight results for a viewer.** A fight's result is given whole, as anyone there sees it; it is not given to a viewer as social checks' are. | Step 9 | Undecided: a fight is seen by everyone in it |

## Not yet verified

| Point | Where it came up |
| --- | --- |
| **The overhaul's CI job** has not run, because nothing has been pushed. | Step 0 |
| **Whether traits drift to the ends.** The plan asks for long simulated runs to check that NPCs' choices, which follow their traits, do not push every trait to an end. Nothing chooses for NPCs in the overhaul yet, so there is nothing to run. | Step 8 |

## Choices made while building

These were reported when they were made and stand unless revisited.

- **Changing a replaced cast is refused, not merged,** even when the two changes would not conflict (step 2).
- **Character ids are given by the caller.** The cast's counter makes ids only for facts, and later jobs (steps 2 and 5).
- **The overhaul imports no packages,** not only nothing of the game's; the boundary test enforces it (step 0).
- **A new character's cash cannot be set directly:** opening balances are transfers from the world (step 4).
- **Only weapons can be shown, and only clothing worn** (step 4).
- **Time is in minutes,** as in the game (step 3).
- **The game's fact kinds and learning tables are read from its source as text** by tests, so they cannot drift apart without the overhaul importing the game (steps 5 and 6).
- **Learning about someone makes them no longer a stranger,** even for a fact whose kind changes no feelings, such as a theft (step 6).
- **Social checks roll a d20,** as the plan's other checks do; the lab's choice of dice (2d10, 3d6) is not carried over (step 7).
- **"Impossible" is a modifier of −100,** large enough that no roll can succeed, explained with its reason (step 7).
