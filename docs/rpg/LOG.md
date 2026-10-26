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
