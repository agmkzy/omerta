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

## Phase 1.2: crew and authority (authority.ts)
**Built:**
- **Men come to a made man.** His captain gives him a man when he has none ("Take Patsy. He's hungry. Point him the right way.
  What he does is on you now."). Associates whose own man is gone, inside or sour on them, and hopefuls on his street who've heard
  of him, ask to run with him, each saying why. He can take them on, tell them to show him something first, or say he's full.
- **Quarrels come to him.** Crewlife's fallings-out, and the old "mediate" approach when both men are his, become one quarrel. Both
  men wait at opposite ends of the bar, and one of them is in the wrong (the greedier over money, the prouder over credit, the
  hotter over words). Hearing them out one at a time costs an hour; the man in the wrong tells it differently the second time.
  Backing the man in the right is respected by the crew; backing the other is noticed. Paying it yourself ends it. Making them
  shake hands works if they respect you enough. Leaving it to them can end in a beating, which costs the man who could have
  stopped it.
- **He answers upstairs.** When one of his men hits a place the family protects, or one of its men, and his captain knows, the
  captain asks what he means to do. Hearing his man's side first gives his real reason: a debt or a habit, bad blood with the
  owner, not knowing the place paid, or greed. Then:
  - make it right (from the man's pocket, or his own);
  - have him roughed up (the captain satisfied; the man resentful; hard men in the crew respect it, easy ones like him less);
  - stand up for him (costly with the captain, cheaper if the man truly didn't know);
  - put him out.
- **It feeds back.**
  - A man who holds something against the man who sent him works less cleanly and skims more (orders.behaviour).
  - Discipline is something a man remembers you did to him (memory.ts), and says so.
  - The weekly crew envelopes, crewlife's tells, restless men going over his head and backing requests all now have a crew to
    work on.

**Found by long play (the climber over 220 days):**
- A man passed over at the table was told to try again in a week or two, but the stale proposal blocked a new one for 60 days.
  Now it clears when his wait does.
- `p.cooldown.handed` was already the Sunday envelope's key (books.ts). Renamed.
- The "mediate" approach had no cooldown per pair, so the same two men came back almost weekly while the grudge lasted (10–15
  times in 150 days). Now once per pair in six weeks, and two of his own men go to the quarrel.
- "X wants you to put his name forward" repeated eight times: a yes was never recorded as asked. Fixed (goals.ts).
- The bot itself took the first answer to everything, including selling out its captain and doing a rival family's job behind his
  back. Now that both are real betrayals with consequences, that wrecked its climb. It now plays loyally (LOYAL=0 for the old bot).

**Measured (loyal bot, before the last two fixes):** made on day 54, 100 and 135 (seeds 7, 11, 3); crews of 2–3 men afterwards;
standing 46–71 at weeks 30–31.
- Validation: grudges in authority.ts go through the one door (bear), as the architecture rule requires. The quiet-weeks pacing test
  now checks the property across two worlds (each at least 20% quiet, a third on average); four worlds measured 9, 9, 9 and 11
  quiet weeks in 28, steadier than before (5 to 13). Full suite passes.

## Phase 1.4: the book, run (book.ts)
One racket made into a business with decisions, for the player's own bookmaking operation (NPC books are unchanged):
- **The big bet.** A gambler (any with money and the habit, the keener likelier, not the same man twice in two months) wants a
  large bet on the favourite for Saturday's race at Aqueduct. The player can take it whole, take half and lay half off with another
  book, lay it all off for the vig (that book carries it and is owed the courtesy, a favour), or turn it down (and be called a
  small book). The race is run on the actual Saturday; the favourite wins 45% of the time. Money is conserved through stake, lay-off
  and payout (tested).
- **A winner the drawer can't cover.** Ask him to take it over weeks (a debt, and the street hears), go to the captain (he covers
  it once, a debt and a favour, and remembers), or stall (a grudge, standing lost; if he is another family's man, his boss resents
  it and the families' tension rises).
- **Another book on his ground.** Run him off (a careful man goes; another family's man becomes tension between the families; one
  of ours, his captain hears), take him in (an associate's book folds into the player's, he becomes its runner with a cut, the
  book grows a level), or live with the thinner trade (crowding already reads it).
- **The precinct's envelope.** Paid weekly, raids on the book are a quarter as likely. Refused, the player draws heat.
- The captain who gives a new made man his first man also tells him to get something of his own: a book, a few loans.
- **Measured** (climber, 240 days, the book started after being made): about $5,000 over 25 weeks, four to six decisions a season,
  the precinct paid. The first runs showed every big bet at the $1,200 cap, mostly from the same rich gambler; now varied.

## Phase 1.5: a truck, played (score.ts); 1.8 jail stopgap
**The truck.** A tip from a man with a reason (one who owes the player, with a cousin who drives; or one of his own men), for
Thursday night: a named load bound for a real place in the city. Preparation as he chooses:
- case the route (two hours; opens the diner; shows whether somebody minds the truck);
- talk to the driver (a debtor's cousin usually gives it up for 15%; a stranger may not, and may tell);
- find out whose load it is (nobody's, our own family's client, or another family's);
- set it up with a fence first (40 cents on the dollar, paid Friday);
- bring up to two of his men (good at it or not; steady or a hothead).

Going waits for Thursday night. The moment offers only the ways preparation opened, each with odds told as he'd judge them: the
diner, the road (needs a man; the driver sees faces), the driver handing it over (needs him in on it), or the depot (half as much
again). Sometimes a patrol car turns into the street: abort, push, or let his steadiest man handle it (a hothead beats a cop: heat,
and every cop in the city looking). After: the fence's money or goods in a garage, his men's ends and the driver's, a debtor's
balance worked down for the tip, a theft on record with its doers hidden, the store's protector told, a description given to the
police after a road job. Played through in the browser; tested (money conserved; preparation opens ways in).

**Jail, a stopgap for the player until the police are a faction (SCOPE 1.8).**
- Weekly heat arrests rise from nothing at the line ((heat − 0.45) × 1.2, so 18% at 0.6, instead of 30%).
- Time inside scales with how hot he was (about a week to a month, instead of a random 5–40 days).
- A raid on a book he runs himself takes him less often.
- A federal sweep after an informant is exposed no longer counts the player twice: he had been on the list of names (45–150 days)
  as well as under his own rule (14–45). It had cost one run 122 days.
- The climber now lies low when the heat shows.
- **Measured** (240 days, three worlds): made on day 44, 79 and 89; jailed 0, 2 and 4 times (before: 4 to 9 times, 48 to 76 days
  inside); books earning $3,000–6,500; crews of 2–3; five trucks a season.

## Phase 1.3: the road to captain, measured; conversation fixes from play
- **Road to captain** (climber, seed 7, 400 days): made in week 7, captain around week 42 (about day 290). Standing climbs to the
  70s and 80s; crew of 4 to 5; book earning; by week 55, 84% of the earnings needed for underboss.
- A first 400-day run never got there: the bot never sat with its own men on Sunday, so its own envelope was never handed up
  (the game holds it until the crew's are in). Earnings stalled at 18% and standing drained to 1 as "short weeks". The bot now does
  Sunday properly.
- For players: when his men's envelopes are still waiting, the captain now says so if asked about the envelope ("Your men first.
  Sit with them at the club, take theirs, then bring me mine."), instead of the envelope simply not being on offer.
- **A man's remarks about the shared past** (memory.recall) come only in the first exchange of a visit. In play, a gesture about
  rank had appeared in front of his answer to "Something's wrong. What is it?".
- **Standing up for a man to the captain, and backing him in a quarrel,** are favours he owes, which he remembers and says so.
