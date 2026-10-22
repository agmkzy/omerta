# Long-run baseline (October 2026)

What the world does on its own over two years, measured on the code as it stands (main, V90), before any foundation work. Use this as the yardstick: every later change is measured against it with the same harness.

**How it was measured.**
- `src/tests/tools/longrun.ts` ran four worlds (seeds 3, 7, 11, 19) for 104 weeks each, with the player idle. It recorded weekly totals and wrote readable histories of individual men, chosen by what happened to them.
- It only observes: a determinism test (`determinism.test.ts`) proves a world run under it is byte-identical to one run without it.
- The full reports, with every history, are in [baseline/](baseline): `seedN.md` to read, and `seedN.json` with the weekly numbers for comparison.
- To rerun: `npx tsx src/tests/tools/longrun.ts <seed> 104 <dir>`.
- [baseline/](baseline) holds the original reports, unchanged. [baseline/rerun/](baseline/rerun) holds the same unchanged game run again after the harness gained measures for the foundation steps: grudges' recorded reasons, reputation spread, falling respect, promotions of men still pushing, and men leaving the life. Its other numbers match the originals; the foundation log compares against it for the newer measures. That's about four minutes per world, and seeds can run side by side.

**What it can't see.**
- It only knows what the world records. Where the world doesn't record a cause, the harness can only show which events happened near each other.
- Events the world creates and deletes within the same day are missed.
- With the player idle, this is the world on its own, not the world as a player experiences it.

## The four worlds at a glance

| | Seed 3 | Seed 7 | Seed 11 | Seed 19 |
|---|---|---|---|---|
| Men in the life, start → end (associate/soldier/capo/underboss/boss) | 28/36/13/5/5 → 14/33/30/5/5 | 25/31/13/5/5 → 6/32/29/4/5 | 29/35/13/5/5 → 9/40/30/3/5 | 29/32/13/5/5 → 6/38/30/3/5 |
| Promotions (associate → soldier, soldier → capo) | 39 (19, 20) | 44 (26, 18) | 45 (25, 19) | 50 (29, 20) |
| Of the promoted, men who had pushed to rise | 37 | 36 | 35 | 43 |
| Plans to rise that ended "done" / given up waiting | 12 / 257 | 9 / 231 | 12 / 256 | 20 / 216 |
| Taken into the life from the street | 5 | 8 | 5 | 6 |
| Deaths | 1 | 4 | 3 | 4 |
| Bosses replaced | 0 | 0 | 1 (killed by his underboss) | 1 (deposed) |
| Arrested men who talked | 0 of 54 | 0 of 60 | 0 of 49 | 0 of 58 |
| Friend pairs at the end (of about 13,000 pairs) | 1,766 | 1,469 | 1,805 | 1,906 |
| Enemies at the end (grudge ≥ .4) | 33 | 21 | 30 | 18 |
| Times a man became afraid of another, in two years | 7 | 9 | 10 | 3 |
| Grudges formed / with an event between the two men in the two months before | 613 / 86% | 426 / 81% | 603 / 88% | 541 / 81% |
| Lasting events with a recorded cause | 3% | 2% | 3% | 4% |
| Chains of cause two or more links long | 0 | 0 | 0 | 0 |
| Family treasuries, start → end | $0 → $320k | $0 → $185k | $0 → $326k | $0 → $181k |
| Consistency and ledger problems, any week | 0 | 0 | 0 | 0 |
| Save size after 2 years | 5.0 MB | 5.0 MB | 4.9 MB | 5.0 MB |

## What it reveals

### 1. Men do rise, but the organisation turns upside down

This corrects my earlier assessment, which measured 26 weeks: **over two years, ambitious men do rise.** There were 40 to 50 promotions per world, and nearly all went to men who had pushed for it.

The problems are different from the ones I reported:

- **The plan and the promotion are disconnected.** A man's plan to rise gives up after five weeks of waiting "for the nod" (about 250 times per world). Months later the promotion arrives anyway, through the separate promotion system, which doesn't know he gave up.
  - So almost every plan to rise is recorded as abandoned, while the man is actually promoted later.
  - His frustration and his success never meet in one story.
- **Rising is one-way, and nothing replenishes the bottom.**
  - Each family's capos grow from 2–3 to exactly 6, then stop, because of a ceiling.
  - Associates drain from about 28 to between 6 and 14.
  - Only 5 to 8 men are brought in from the street in two years.
  - After two years a typical family has about 6 capos, 7 soldiers and 1 or 2 associates: officers with nobody to command.
- **The top never changes, except by violence.**
  - Underboss seats emptied by promotion or death are never refilled: 5 → 3 in two worlds.
  - In two years, only 2 of 20 bosses changed. Seed 11 had a genuine story: the underboss had his boss killed in week 7, took the chair, and the family was left unsettled.
  - Nobody retires, steps aside or loses the chair by losing support.
- **Reputation hardly moves, and starts identical.** Every man begins at exactly 40. After two years, about 30 men in each world have reached 45, and bosses are still at exactly 40. It is a gate for NPCs (section 2 below), not a description of anyone.

### 2. Work, money and reputation

- **Money flows up, then piles up.**
  - Kick-ups are paid every week: associates and soldiers to capos, capos to underbosses. Bosses receive comparatively little directly.
  - **Family treasuries rise steadily from $0 to between $180,000 and $330,000 and are effectively never spent.** The money leaves circulation instead of funding anything the family does.
- **An NPC's working life is his own side business and his own shakedowns.**
  - Nobody above him gives him work, so nothing he does is judged by a superior (confirming the assessment).
  - Reputation therefore barely moves, even for men whose histories are full of activity.
- **Protection demands dominate the world.** 2,000 to 2,900 demands per world in two years, about 60% of all storylines.
  - Sonny Cassano, an associate, demanded protection from 14 shops in his first two days, and his history has over 1,800 entries.
  - Every shop is asked again and again by rotating men. Shopkeepers ask each other's protectors to make the newcomer back off, in an endless circle.
  - This is the single biggest source of noise in the world, and probably of the "conflict without consequence" in the earlier 90-day test.
- **Incoherence found by reading histories (no automatic check catches these):**
  - **A boss pays protection to his own soldier.** Tommy Corrente, boss of the Corrente family, bought a failing jewellers. He is then shaken down for $70 a week by Dom Mancini, a Corrente soldier, falls behind, and gets "until the end of the month".
  - **A struggling business announces it every day.** "Tommy Corrente admits Galante's Jewellers is struggling to cover its costs" appears daily, sometimes several times a day. That's about 2,500 lasting events per world.
  - **Debts balloon late in some runs.** In seed 7, outstanding debt went from $34,000 to $157,000 in the last six months. This is unexplained; it is probably compound interest on a few large unpaid debts, and needs tracing.

### 3. Relationships: a society that warms up once and then stands still

- **Friendship is mostly settled within three months.**
  - Friend pairs jump from 0 to about 1,400 by week 13, then creep to about 1,500–1,900 by year 2.
  - About 2,200 friendships formed and only about 390 lapsed in two years.
- **Enmity is constant, short-lived and shallow.**
  - At any time there are only 20 to 40 enemies in a world of about 170 people.
  - About 400 to 600 grudges form and about as many are let go in two years, typically within weeks.
  - **Fear between men essentially doesn't exist:** 3 to 10 instances in two years.
- **Good news: grudges do have reasons in the world.** 81–88% of grudges come within two months of an event between the two men (a beating, a refusal, a shop taken). **But the link isn't recorded.** No system, whether conversation, rumour or memory, can tell why a man hates another.
- **Respect only accumulates.** The number of pairs with high respect rises every quarter, from about 1,400 to about 2,100. Nothing in the measurements shows it falling.

### 4. Cause and consequence

- **Behaviour contains real chains; the record doesn't.** Johnny Palumbo's history in seed 3:
  1. a civilian taken in by Marty Bellini;
  2. made a soldier, then a capo;
  3. buys DeSantis's Social Club, and refuses Sonny Cassano's protection demand five times;
  4. is beaten by him;
  5. a feud starts; he beats Cassano back; they come to blows again and again.

  That is a story. But only 2–4% of lasting events record their cause, and **no chain of two links exists in any world.** The story exists only for someone reading every line.
- **About 70% of lasting events are noise:** gambling losses (about 4,000), daily "struggling" announcements (about 2,500) and rumours (about 2,200). Meaningful events are buried under them, for the player as well as the harness.
- **Storylines run and resolve.**
  - Feuds last about 3.5 weeks: about half kept apart, a quarter ruled on, the rest peace or blows.
  - Revenge is usually carried out.
  - Disputes settle or are dropped.
  - Climbs almost always "give up", for the reason in section 1.
  - **No arrested man ever talked in 221 arrests.** The informant system never fires; this is the trust-saturation problem.

### 5. Coherence over two years

- **The automatic checks never failed.** In any week of any world: no consistency or ledger problem. The ledger and hierarchy invariants are solid.
- **Save size grows about 2.4 MB a year,** to 5 MB at two years. IndexedDB can hold that, but long games will keep growing. 70% of lasting events are noise (section 4), so most of the growth is noise.
- **Speed:** about 2 seconds of computer time per simulated week; a two-year run takes about four minutes.
- **The automatic checks can't see the incoherence that matters most:** the upside-down organisations, a boss paying protection to his own soldier, the endless demands. The histories are where those show up.

## The dependencies underneath

Tracing why each of these happens leads to a few roots, and they depend on each other:

1. **Events don't carry their consequences.** What happens is recorded once, as a fact. But its effects on relationships, reputation and causes are applied separately, by hand, in about 40 modules. That is why:
   - causes aren't recorded;
   - grudges have reasons nobody can see;
   - reputation moves only where someone remembered to move it (mostly for the player);
   - respect only rises.

   **Nearly everything else depends on this.**
2. **The organisation has no life cycle.** Promotion is a separate system from ambition, with fixed ceilings. Recruitment is a trickle. Nobody refills the seats above, and nobody leaves the top except by violence. That is why families invert and leadership is frozen. It depends on (1) for a meaningful reputation.
3. **Work doesn't flow down the hierarchy.** NPCs earn alone. That is why superiors never judge their men, why reputation barely moves, and why men's ties to their captains have no texture. It depends on (1) to turn work done into reputation and relationships, and on (2) to turn reputation into rank.
4. **Demands are unbounded, and money pools unspent.** The protection-demand storm, the shakedown of a boss by his own soldier, and treasuries that only grow are consequences of the work and money systems not knowing the hierarchy. They'll largely resolve when (3) gives work its proper shape, and they should be measured rather than patched first.
5. **Noise.** Daily "struggling" announcements and the volume of gambling-loss records hide everything else. This is the cheapest thing to fix, but it's measurement and presentation, not foundation.

## Where to start

**Recommendation: start with (1), making events carry their consequences, narrowly at first: reputation and grudges.**

- **What it means.** When something happens between people (a beating, a refusal, a job done, a debt paid or missed, a protection deal), the record of that event drives its effects:
  - on the reputation of the man who did it;
  - on what the man it was done to feels about him;
  - on what witnesses, and later those who hear of it, think.

  The event is recorded as the cause of each change.
- **Consolidation, not a new layer.** The event record already exists and is the game's strongest system. Its effects are currently scattered across about 40 modules, which change relationships directly, and about 30 that change reputation. Those direct changes move behind one door and the copies are deleted.
- **Why first:** it's the root of the other three dependencies, and it fixes things the baseline shows directly:
  - reputation that means the same for everyone;
  - grudges with a recorded reason;
  - recorded causes, and therefore chains;
  - respect that can fall as well as rise.
- **Why narrow:** relationship changes are about 800 edits across 40 modules. Starting with reputation and grudges proves the door on the two measures the baseline shows are broken, before moving the rest through it.
- **How we'll know it worked.** On the same four seeds, the harness should show:
  - reputation spreading out and moving for NPCs (bosses included);
  - grudges with a recorded cause, rising from about 0% towards the 81–88% that have one in the world;
  - chains of two or more links appearing;
  - respect falling as well as rising.

  The individual histories should read as cause and consequence without guesswork, and nothing else should change much yet.

**Then (2), the organisation's life cycle:**
- one set of rules for rank movement, for everyone;
- ambition and promotion as one story;
- seats above refilled;
- the ceilings reconsidered;
- recruitment in proportion to need;
- leadership that can change through support as well as violence;
- deleting the separate NPC promotion rules and the copies of "wanting to rise".

**Then (3), work down the hierarchy,** which will feed both. Item (5) can be done whenever it's convenient; it's cheap, and it makes the histories easier to read.

**An alternative, if you'd rather see a visible change first:** start with (2), the organisation's life cycle. It shows most clearly in a two-year run, and most of its pieces already exist (one door for rank changes, succession). The cost is that promotion would then rest on today's reputation, which barely moves, and would need reworking after (1). I recommend (1).
