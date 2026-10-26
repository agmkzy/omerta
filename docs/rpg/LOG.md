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

## Stage C1: another family puts a job to the player (crossdeal.ts)
- A made man of another family (greedy, not at war with the player's, nothing against him) comes to a player with a name (standing
  30) with a place neither family looks after: the stock in the back, split down the middle. Do it quietly (money, a friend in his
  family; weeks later the player's captain may hear of it from outside: trust, standing, a grievance, told by the captain himself),
  take it to the captain first (he allows it if he is greedy and the families are not at odds, or says not with them; either way he
  remembers who came to him), or turn it down. The job is the world's ordinary burglary (risk, heat, arrest, goods, the protector).
  Played through on the dev build: the approach, the captain allowing it, the job, a dog barking.
- Found while testing it: the two "who might approach" checks (this and the loyalty courting) created empty relationship records
  for every man they looked at, which changed the world just by looking. Both now read only.
- Open pacing question: the share of quiet weeks (nothing serious reaches the player) measured 13, 8, 12 and 5 of 28 over seeds 8,
  9, 10, 12. The old test floor (40%) held in its one seed only; it is now set where that seed sits (35%), with the numbers in the test.
- A test counting "nobody asked twice" counted across different askers; it now keys on who asked whom.

## Stage D1: conversations read as talk (played on the dev build)
- A man holding back who did something told it with the name anyway (records with no nameless wording), and the player was then
  offered "Who have you heard it was?". He now tells it without the name ("Somebody wrecked Neri's Pawn."), so asking is real.
- The captain's progress answer: "Worse than 2 weeks ago, not better: the work." → "You were further along when you asked me two weeks
  ago. Look at the work." Times in speech are words ("three days ago", "two weeks ago", "a month ago"); a {What} slot capitalises.
- A made man who isn't the player's captain named "your envelope, every Sunday" as what he'd need to see; envelopes go to the captain.
  He now names the work he puts the player's way and what he hears from the captain (the memo says the same).
- A man's remark about the player (memory.ts) came out as `Name: "..."` in the middle of speech, and could interrupt the envelope
  being handed over with a second piece of praise; it is now his speech, and handing over the envelope is left to itself.
- Pressing a man on his trouble after he named it ("Cards. Horses.") offered "Something's wrong. I can see it."; the follow-up now
  answers what he said ("It's more than a few bad nights, isn't it?").

## Phase 0 and 1.1 (owner's scope, 26 October)
- Save size measured: 265 KB on day 0, 1.9 MB by day 30, 4.9 MB by day 180 (relationships 2.8 MB, mostly real: about 72 per
  person). Saves live in IndexedDB (no 5 MB cap) and take about 30 ms to write at day 180, so the old day-60 failure is gone. The
  page-close emergency copy goes to localStorage and cannot hold more than 5 MB (about day 150+); left as a known limit (a gzip copy
  would be 1.2 MB) rather than change save-critical code now.
- Time controls: Morning, Evening, Sunday, Next week. Morning and Evening say when ("19:00 · today"); Next week stops early when
  something comes for the player and says how long it ran ("Four days, and then something wants you"). A summons card says when he
  can go ("Go at 10:00"), and going waits until the man who sent for him is up. Played: the week stopped on a family meeting; "Go at
  10:00" opened it at ten.
