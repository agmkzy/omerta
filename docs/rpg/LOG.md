# From coherent simulation to compelling RPG: working log

The running record of the autonomous stage that began 2026-10-26 (owner's brief "From Coherent Simulation to Compelling Mafia
RPG"). Each entry says what was found, what was changed, how it was checked, and whether it is live.

## Stage 0: the coherence repair goes live
- Full suite: 689 passed, 0 failed. Production build, Pages deploy c01065d; the live page's hash matches the build. A smoke test on the
  live site played the opening (a captain offering work).
- Found on the live site: asking the captain for work could show "About what he asked" instead of the answer, because the job taken as
  "his" was the newest record rather than his. Fixed on the branch.

## Stage A: a road to being made that a player can walk
**Found** (src/tests/tools/climber.ts, an ambitious player driven through the real conversation and job code):
- Made men had almost nothing that needed doing (work.needsOf was empty for nearly every soldier and captain), so "Is there anything I
  can do for you?" got "Nothing now" and backing could only come from evenings out, which trust caps and time erodes.
- $3,000 passed up for a soldier: at an associate's earnings, well over a year of play.
- A man who had done everything waited for a seat until somebody died; the ceremony could be missed because the boss was asleep.

**Changed:**
- The ordinary work of the life (work.needsOf): a made man's week's envelopes carried up to his captain, a man of another family told to
  stay off his ground, a man he holds something against watched. The same needs drive NPCs and the player.
- Made men put their own work the player's way when he asks, and come to him with it when they have nobody free (at most two such asks
  open; ten days between asks from one man). Work from a man he doesn't answer to is a favour asked, not orders.
- Doing it is how they come to trust him (the job's own regard on completion), which is what backing reads.
- Soldier: $1,500 passed up, three jobs finished. A man whose road is done gets a seat within three weeks ("the books are opened"). The
  ceremony is held on a set night, and going to it early waits for it.
- Errands became decisions: a pickup carried straight, or skimmed (from the man's own money; he may count); a message said civilly, or so
  the man remembers it (he backs off, or it becomes a quarrel between the families). A warning given in conversation delivers it.
- Gig kinds are paced (not the same kind again within twelve days). A punishment is told once, by the man who gave it.

**Measured:** the climber was made on day 61, 100 and 129 (seeds 11, 3, 7) by cultivating three made men and doing the work offered;
before, it stayed an associate.

## Stage B1: loyalty tested
- A captain of the player's own family who holds something against the player's captain comes to him, once he is worth having
  (standing 38, two jobs done), and asks him to tell him how things go in his crew. Three answers: take the money (a favour and a
  friend higher up; weeks later his captain may find out, and if he does, trust, standing and backing go), say he is his captain's man
  (respected, resented a little), or take it to his captain (trusted more; the other man may learn who told).
- Tested in src/tests/experience/loyalty.test.ts over four worlds.

## Validation and deploy of A and B1 (6d327d4, live)
- A tip about a mark that the player passes over no longer costs the shopkeeper's trust; a favour asked and let lapse still does.
  (Found through the Ferrara chain test: a world where Nate tipped Henry about a flush customer ended with Nate trusting him less
  for a promise kept.)
- The new skim/hard-message outcomes are the player's choices only; NPC errands keep the old outcomes (pacing tests).
- The wedding invitation is for tonight's reception, so the answer and the evening agree.
- Tests that depended on one man or one world doing a particular thing now sample several (debtors asking the player; men going
  to somebody for help).
- Suites run in three chunks: all pass (the "innocent man" scenario, which times out under load, passes alone). Live hash matches
  the build; a save from the previous version loads on the live site with no errors.

## Stage B2: the world notices the player
- A man of his own family who has heard what just happened to him (made, out from inside, beaten, disciplined, a shop on his book
  hit) says so the next time they talk, in his own voice, once. A man who hasn't heard says nothing (memory.ts recall, step 0).

## Stage B3: a man inside is not blamed for what he could not do
**Found** (climber, now answering summons and logging what moved standing and when he was put inside): work and summons his captain
sent while he was inside lapsed as "ignored": standing −3, trust −0.05 each, and two in a month brought a beating or a bigger share.
His captain also sent for him for coffee while he was inside.
**Changed:** an offer that lapses while he was inside lapses with no word against him (and does not count towards "twice in a
month"); nobody sends for a man who is inside (jobs.daily, meetings.summonsTick). Tested in experience/consequences.
**Measured:** a careful player (who answers summons and lies low when the heat bar shows) is made on day 72, 86 and 94 (seeds 7, 3,
11) and his standing climbs after (53–75 by week 19–21). A reckless one, who takes every job, spends 48–76 of 150 days inside.
Arrests from heat are still the largest drag on a careful player too (1–3 spells of 5–33 days in 150 days); left as balance, reported.
