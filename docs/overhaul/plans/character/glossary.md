# Character: glossary

What each word means in [the character plan](README.md), its [revisit list](revisit.md), its [game mapping](game-mapping.md)
and the code in `src/overhaul/character/`. Where the game (`src/`) uses the same word for something else, both meanings are
given. Numbers are the values built now; most are starting values, to be tuned.

If a word is used in discussion in a way this does not cover, it is added here first.

## Words that mean two things

These have caused, or could cause, confusion. Say which one is meant.

| Word | In the overhaul | In the game |
| --- | --- | --- |
| **Plan** | A job's plan: one member's Planning roll, whose result counts on the job's checks. See [Plan](#jobs-and-plans) | Also "the plan": this design document, [README.md](README.md). Say "the design" for the document |
| **Job** | Characters doing something together, with an optional plan. See [Job](#jobs-and-plans) | `w.jobs`: a task given to one man by a boss, a tip or a contract, with pay and an expiry |
| **Family** | Not yet built; on the Before the swap list | A crime family (`familyId`, `w.fam`). Blood relatives are not modelled. Say "crime family" when it matters |
| **Skill** | One of eighteen skills, each with a training level | One of five numbers, 0 to 1 (`muscle`, `driving`, `charm`, `nerve`, `brains`) |
| **Background** | One of eight (fighter, driver, marksman, negotiator, trickster, accountant, shopkeeper, labourer), which shapes how a character is rolled | One of six the player picks at the start (hustler, connected, business, union, bookmaker, wheelman) |
| **Courage / Nerve** | Courage is a trait: what someone does after failing a nerve check. Nerve is a skill: whether they fail it | The game has both too, as a trait and a skill |
| **Giving in / surrendering** | Giving in is to a threat (intimidation). Surrendering is in a fight, after a failed nerve check | The game counts the player backing down as `yielded`, without telling the two apart |
| **Rank / ability** | The overhaul has no rank, and rank is detached from attributes, skills, training and the proficiency bonus (decided 3 November 2026): it follows what a character does, never their abilities directly. "Ability" is not a defined term; say attribute, skill, training or proficiency bonus | Rank is civilian, associate, soldier, capo, underboss, boss, and the game rolls higher ranks better skills |
| **Standing / respect** | Respect is one feeling, of one character towards another | Standing is a reputation score, 0 to 100 |

## The record

- **Cast** — the one record of every character, with the facts, transfers and jobs between them (`CastRecord`). It never
  changes in place: every change returns a new cast.
- **Character** — one person in the cast, the player included. There is no player flag.
- **Handle** — what code uses to read a character and act through them (`cast.character('sam')`). It belongs to one cast.
- **Replaced cast** — a cast that a change has already been made from. Making another change from it is refused
  (`ReplacedCastError`), so two changes can never both start from the same cast.
- **Audit** — the checks `castOf` runs on every cast it builds: cash and items add up to the transfers, every cause is
  recorded before what it caused, and so on.
- **Save format** — the version of the cast's saved shape, now 8. A **migration** brings an older format up to date.
  These are the overhaul's own formats, not the game's.
- **The world** — the party money and items come from and go to when they enter or leave the cast (`WORLD`).

## Checks

- **Check** — a d20 roll plus modifiers, against a DC or another roll. Every action that can fail is one.
- **DC** — the number to reach. 10 is easy, 15 tricky, 20 hard.
- **Modifier** — a number added to a roll, always with its reason ("Agility 14 +2").
- **Margin** — the total minus the DC.
- **Outcome** — how a check went, read from its margin:

  | Outcome | Margin |
  | --- | --- |
  | Critical success | 10 or more |
  | Success | 5 to 9 |
  | Partial success | 0 to 4 |
  | Failure | −1 to −5 |
  | Critical failure | −6 or worse |

  A plan's own roll uses different bands (critical failure at −11 or worse).
- **Opposed check** — two rolls against each other, such as Deception against Insight. The side acting must beat the other;
  a tie goes to the side resisting.
- **Passive** — 10 plus a skill's bonus, used instead of rolling, such as passive Notice against an ambush.
- **Advantage** — roll twice and keep the higher. Advantage and disadvantage do not stack, and one of each cancels.
- **Impossible** — a modifier of −100, explained with its reason, so the check cannot succeed.
- **Odds** — the chance of each outcome, as one viewer can judge it.
- **Explanation** — the modifiers on a check, as one viewer can know them.
- **Viewer** — the character asking. Odds, explanations and results are always given to a viewer, who sees only what they
  could know.
- **Truth** — what really happened, for the simulation and tests, never shown to a character as such.
- **Result** — how a roll went, as one viewer saw it. Only those who were there get one.

## Abilities

- **Attribute** — one of six scores, 1 to 20, average 10: Strength, Agility, Constitution, Intelligence, Wisdom, Charisma.
  Its **modifier** is (score − 10) ÷ 2, rounded down.
- **Skill** — one of eighteen, each read from an attribute (Brawling from Strength, Persuasion from Charisma, Nerve from
  Wisdom or Constitution, and so on).
- **Training** — untrained, trained or expert in a skill. Trained adds the proficiency bonus; expert adds it twice.
- **Proficiency bonus** — 2 to 6: how much training adds. Every character has one; it is 2 unless set.
- **Bonus** — everything a skill adds to a roll: the attribute modifier, training, effects, items and anything else, each
  listed.

## Temperament

- **Trait** — one of fourteen, each 0 to 1: greed, violence, ambition, caution, sociability, vice, courage, pride,
  volatility, agreeable, empathy, loyalty, honesty, cruelty.
- **Low / high** — 0.3 or less / 0.7 or more. The same thresholds are used for feelings.
- **Starting traits** — what a character began with. Stored.
- **Current traits** — the starting traits moved by conduct. Worked out, never stored.
- **Conduct** — something a character did or had done to them that moves their traits: starting a fight, lying, being
  beaten, running. Each kind is a row in the conduct table.
- **Conduct step** — one recorded movement of a trait by 0.01, towards one end, with its cause. Each kind of conduct moves
  traits at most once in seven days.
- **Reaction** — conduct from how someone acted in a fight: holding their nerve, running, surrendering, losing their
  temper, standing by their squad, leaving it.

## Condition

- **Hit points** — health. Maximum 10, adjusted by Constitution and Toughness.
- **Hurt** — at or below half hit points. Read from hit points, never stored. −2 to Strength, Agility and Constitution
  skills, but not in fights.
- **Unconscious** — at 0 hit points.
- **Effect** — a temporary state that changes rolls. Shaken (−2 to Nerve) and drunk (−2 to Agility and Intelligence skills,
  Insight and Notice; +2 to Nerve) are stored; hurt and unconscious are read from hit points.
- **Rest** — time spent resting, from a start for some hours. A **full rest** (8 hours or more) restores all hit points and
  clears shaken and drunk; a shorter one heals its share of what is missing and clears nothing.
- **Available** — conscious and not resting. Only someone available can act, be the target of a social action, fight,
  witness, tell or be told, or pay, be paid or be given something in person. The victim of a recorded fact need not be.

## Relationships

- **Relationship** — how one character feels about another, one way. It exists once they have met or one has learned of
  the other.
- **Stranger** — someone a character has no relationship with, so no feelings count.
- **Feelings** — trust, respect, affection, grudge, fear and familiarity, each 0 to 1. A new relationship starts at 0.5 for
  trust, respect and affection, and 0 for the rest.
- **Familiarity** — how well they know each other. Rises 0.02 each time they meet.
- **Meet** — be together in something: take part in the same roll or fight (as actor, target, squad member or witness),
  one telling the other anything, or drinking together. Updates when they last met, and their familiarity.
- **Grudge reason / regard reason** — the event that did most to raise a grudge, or trust and affection.

## Knowledge

- **Fact** — something that happened, recorded once, with its kind, who did it, to whom, when, and its witnesses
  (`kind`, `actor`, `victim`, `at`).
- **Version** — one character's own belief about a fact: what they think happened and how they came to know it. Two
  characters can hold different versions of one fact.
- **Part** — a piece of a fact a version can get wrong on its own: **who** did it, and **size**, how big it was.
- **Provenance** — how a character came by a part: **seen**, **told** (by someone who saw it), **heard** (second-hand), or
  **guessed**. The version also records its **source**: self, witness, public or told.
- **Witness** — someone named as there when a fact happened. They must be available.
- **Knows the actor** — knows for certain who did it. Otherwise they may **blame** someone, which is a belief.
- **Blamed** — everyone a character has ever held responsible for a fact, so feelings towards each count only once.
- **Hidden actor** — a fact whose doer was not seen, so no one learns who did it from being there.
- **Guess** — the victim of a hidden actor blaming whoever they hold the biggest grudge against (0.3 or more). Marked as a
  guess, and passed on as one.
- **Public** — a fact made known to named people who were not there. They hear it; they are not witnesses.
- **Learning tables** — the game's rules for how feelings change on learning a fact, by its kind (`DEED`, `VIOLENT`,
  `GRUDGE`, `HEARD`), read from the game's source.
- **Re-belief** — a version changing because someone was told otherwise. Feelings then follow the person they now blame.
- **Telling** — one character passing on their version of a fact. A check: it rolls only if it contradicts what the listener
  believes (Persuasion against DC 10). It always makes the two meet.
- **Honest mistake** — passing on a version that turns out wrong while believing it. When it comes out, the listener trusts
  the teller a little less (−0.05).
- **Lie** — a deliberate claim the liar knows is false: who did it, how big it was, or a fact invented. Recorded as a `lie`
  fact with its **claim**. A lie the liar knows cannot work is refused before any roll.
- **Invented fact** — a fact that never happened, recorded as such so the simulation knows the truth, and known only to the
  liar until someone believes it.
- **Comes out** — a lie being found out, when the part it claimed is overturned by a telling. Trust −0.15, grudge +0.05, and
  the conduct of having been lied to.
- **Cause** — the recorded fact, item or job that led to something: a fact, a transfer, a conduct step.
- **Story** — the id shared by every fact of one fight or matter.

## Social actions

- **Social action** — intimidate, persuade or deceive: the actor's skill against the target's resisting skill, opposed.
- **Actor / target** — who acts, and who it is done to.
- **Ending** — how a social roll ended: one of the five outcomes, or **provoked** (a critical failure at intimidating a
  volatile target, who takes offence). Recorded on its fact.
- **Appearance** — how the ending looked to anyone there but the target: gives in, resists, provoked; agrees, agrees for
  something in return, declines; no sign, sees through it. Only the target knows the exact ending.
- **Aftermath** — the change in feelings after a social roll, by its ending.

## Inventory

- **Cash** — money in hand. Changes only by transfers.
- **Item** — a thing a character holds: knife, pistol, lockpicks, toolkit, good suit, bottle of spirits. Each held item is
  **carried**, **shown** (a weapon on display) or **worn** (clothing).
- **Transfer** — a recorded movement of cash or an item: who from, to whom, how much, why, when, and optionally the fact
  that caused it.
- **Give** — handing an item to someone there, as a transfer.

## Fights

- **Squad** — the characters on one side of a fight.
- **Attacker / defender** — the squad that started it, and the other.
- **Sparring** — a fight for practice: from full health, unarmed, ending when someone drops to half. Nothing lasts but
  familiarity.
- **Real fight** — a fight whose damage, facts and conduct last.
- **Start** — how a real fight begins: **ordinary**; **set upon** (several attackers on one target, who is caught and
  held in the first round); or **ambush** (started unseen, against the targets' passive Notice).
- **Nerve check** — a Nerve check during a fight: at the start (against a weapon that outclasses theirs, being set upon, or
  already being hurt; one check at the hardest DC), at half health, or when half their squad is down.
- **Outclasses** — a weapon better than another: a knife outclasses bare hands, a pistol bare hands and a knife.
- **Losing their temper** — a volatile fighter who passes a nerve check attacks with advantage next turn, and is easier to
  hit until then.
- **Fighting / fleeing / fled / beaten / knocked out** — a fighter's status. **Fleeing** is trying to get away; **fled** is
  having got away; **beaten** is having surrendered or been caught; **knocked out** is at 0 hit points.
- **Down** — not fighting, for any reason, including still running.
- **Escape** — a fleeing fighter's Reflexes against the quickest enemy's. A fighter whose squad has no one else fighting
  gets one try.
- **Winner / stalemate** — a squad wins when the other has no one fighting. After 12 rounds with both still fighting, it is
  a stalemate.

## Jobs and plans

- **Job** — characters doing something together, from when it starts until it is ended. One open job per character.
- **Plan** — a job's plan: one member's Planning roll against the job's DC, made once. Its result counts on every check
  made **for the job**, by its members, until it ends: +2 for a success, +1 partial, nothing for a failure, −2 for a
  critical failure.
- **For the job** — a check the caller marks as part of the job (`{ job }`). Nothing else a member does while the job is
  open is affected.
- **Planner / helper** — who rolls the plan, and one other member who gives them advantage.
- **Chosen check** — on a critical success, the first check of a chosen skill by a chosen member, made for the job, gets
  advantage.
- **Hard job** — a job of DC 20 or more. Its members grow more ambitious when it starts.

## The swap

- **The game** — the current game, `src/` outside `src/overhaul/`.
- **The overhaul** — the new systems in `src/overhaul/`, kept apart from the game until the swap.
- **The lab** — `lab/character/`, where the character work started. Frozen.
- **Before the swap** — everything the overhaul must have before it replaces the game's systems (the design's list).
- **Shadow run** — running worlds on the same seeds and actions with the game's systems and with the overhaul's, and
  comparing how they behave over many runs.
- **The swap** — every game system that reads or writes characters moving to the cast at once.
- **Clean break** — no character or save from before the swap comes across.
