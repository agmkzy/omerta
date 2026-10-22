# Simulation assessment against the vision

October 2026. A development reference, not a plan.

**The vision it is measured against** (agreed in discussion with the owner):
- OMERTÀ is a Mafia life simulator built around an emergent criminal career, where autonomous characters and their relationships generate unique stories.
- The player is one participant, not the centre.
- **The test of any change:** does it increase the number of meaningful things that can happen because of what everyone does? Not the number of things the player can do.
- **The working rules:**
  - NPCs and the player live by the same rules;
  - randomness depends on circumstances and is never arbitrary;
  - each shared mechanic has one authoritative implementation;
  - obsolete code is deleted, not wrapped;
  - success is judged by long runs and individual lives, not totals alone.

**How it was done.** I read all 72 modules (about 26,700 lines) and the simulation loop, and traced dependencies with searches. I also measured worlds in memory: seeds 3 and 7, at 0, 14, 45 and 90 days, plus 26 weeks for ambition. No game code was changed. Where something rests on reading code rather than measurement, it says so.

## 1. The verdict in brief

The simulation's **foundations are sound and worth keeping**:
- the deterministic loop;
- one record of what happened (facts) and who knows it;
- rumour;
- the ledger;
- one place where ranks change;
- organisations;
- temperament.

What fails the vision is **above** the foundations:

1. **The same idea is built many times over.**
   - A man wanting to rise is represented five ways.
   - There are six engines for running storylines.
   - There are more than ten ways to create a loan.
   - Relationship values are written directly in about 40 modules.

   Each copy has its own rules, so behaviour can't be reasoned about or tuned in one place.
2. **NPCs and the player follow different rules.** That applies to promotion above all, and the NPC rules almost never let a man rise on his own ambition.
3. **Change rarely has a cause.** Problems are dice rolls. Relationships drift warmer by default. Only about 8% of events record what caused them.

None of this requires a new simulation layer. It requires **one authoritative version of each idea**, connected to the others, with the copies deleted. That is what your "how we change the code" principles call for.

## 2. Key findings, with evidence

### 2.1 Ambition: why men don't rise

> **Corrected by the two-year baseline (docs/BASELINE.md).** Over 26 weeks almost no plan to rise succeeded, but over two years 40–50 men per world were promoted, nearly all of them men who had pushed for it.
> - The real problems are that the plan and the promotion are disconnected: plans give up after five weeks, and the promotion arrives later through a separate system.
> - The organisation inverts: capos reach a ceiling, associates drain away and seats above are never refilled.
> - The figures below are accurate for 26 weeks, but they described the wrong problem.

*Measured: 26 weeks, two worlds.*

- **Plans to rise almost never succeed:**
  - seed 3: 2 succeeded, 20 gave up after being told to be patient, 1 jailed;
  - seed 7: 1 succeeded, 23 gave up, 1 jailed.
- **The binding obstacle is reputation.** The NPC rule requires a reputation of 45. **Every NPC starts between 30 and 44, and after 26 weeks only 4 of 87 had reached 45.** NPCs barely have a way to earn reputation; in practice it's the player's measure.
- **The other obstacles:**
  - no free seat: blocks most samples (about 460 of roughly 610 weekly samples);
  - a promotion score below 0.55: about 420 of 610;
  - patience: a backed man waits five weeks for the decision and then gives up, so most plans end at exactly that point.
- **Some rules are already met.** About 85% of associates have passed up enough money to be made, and nearly all have a sponsor.
- **Real promotions are rare.** In 26 weeks, 5 men in seed 3 were genuinely promoted. The game's "promotion" record also counts associates **joining a crew** ("has started running with…"), so earlier counts of promotions overstated it by about half.
- **Two rulebooks** (read in code): the player rises by the path in `path.ts`, with goals, a trial and a sponsor; NPCs rise by a separate score in `career.ts`. Your vision says NPCs should rise by the player's rules.
- **"A man wants to rise" exists in five forms:**
  - his wish (`want`), which is set in three different modules;
  - a plan to rise (`goals.ts`);
  - an "ambition" storyline (`situations.ts`);
  - a "climbing" storyline (`matters.ts`);
  - work and advancement handed out by the family (`pulse.ts`).

### 2.2 Relationships: why everyone becomes friends

*Measured: 90 days. Mechanism read in code.*

- **The result:**
  - pairs with strong trust: 164 → about 1,400;
  - fond pairs: 10 → about 1,700;
  - grudges: about 35;
  - fear between NPCs: about 1.
- **Cause 1: socialising always increases trust and affection,** whatever the two men are like.
- **Cause 2: the decay rules are lopsided.** Grudges fade 8% every week regardless. Trust and affection fade only between men who haven't met in two weeks, and men in a crew meet constantly.
- **No familiarity, no shared history.** The relationship record is five numbers and the date they last met. A pair's history is never recorded as theirs. `memory.ts` reconstructs it for the player from other records.
- **Written from everywhere.** Relationship values are changed directly in about 40 modules, about 800 places. No single path exists through which "something happened between these two" is recorded, explained or balanced.

### 2.3 Causality

*Measured and read.*

- **Personal problems are dice rolls:** about 1.6% a week to start, 2.5% a week to end. Only one cause exists in code (being passed over makes a man resentful). Of the 19 to 26 men who lost at cards five times or more, 1 had a gambling problem.
- **The effects are good.** Problems drain money, cause short envelopes, can lead to a loan from another family's shark, and make a man likelier to talk to the police. **Causes are what's missing, not consequences.**
- **Causes are rarely recorded.** About 8% of events record their cause, and no chain is three links long.
- **Random draws are scattered.** About 250 of them across 20 simulation modules, most of them fixed odds rather than odds that depend on circumstances.

### 2.4 Duplication

*Read in code.*

| Idea | How many implementations | Where |
|---|---|---|
| Creating a loan | 11+ for the player (more for NPCs) | `dialogue`, `talk`, `encounters`, `situations`, `meetings`, `crewlife`, `asks` ×2, `goals` ×2, `people`, `actions`, `world`, `situ` |
| Running a storyline | **6 engines** | `situ.ts` (8 kinds); `matters.ts` (4 kinds); `asks.ts`; `disputes.ts` (its own store, copied into storylines); `situations.ts` (bypasses the storyline caps); `pulse.ts` (border disputes, likewise) |
| Wanting to rise | 5 | see 2.1 |
| Rules for promotion | 2 | player `path.ts`, NPC `career.ts` |
| Hitting back | about 6 routes | `actions` (daily retaliation), `matters` (revenge), `disputes`, `revenge.ts` (player), `orders`, `jobs` |
| Favours | created in 16 modules | — |
| Sit-downs | called from about 10 modules | `disputes`, `matters`, `meetings`, `situ`, `pulse`, `politics`, `powers2`, … |
| Relationship changes | about 40 modules | — |

### 2.5 Player-only systems

These exist only for the player: personal life (`life.ts`), the promotion path, jobs, opportunities, orders, rackets, choosing how to settle a score, and the danger ladder.

Some should stay player-only. They are how you play: orders, jobs, the danger ladder. Two contradict the vision's "one participant, not the centre":
- **promotion rules,** because NPCs should follow the same ones;
- **personal life,** later, when it becomes an autonomous system.

### 2.6 Criminal work: where NPC circumstances should come from

*Read in code. Reviewed at the owner's request, as part of the dependency assessment, not for a redesign.*

- **An NPC's criminal life today consists of:**
  - daily choices: work, lending, collecting, shaking down shops, gambling (`actions.ts`);
  - a weekly side business that grows, fails, draws heat and gets men arrested (`hustle.ts`);
  - plans to buy into businesses (`goals.ts`).

  These produce money, police attention, arrests, gambling losses and debts.
- **They produce almost no reputation.** Reputation ("standing") is changed in about 30 modules, and nearly every change applies to the player. That is why NPC reputation never moves (section 2.1).
- **Work never flows down the hierarchy between NPCs.**
  - Bosses offer jobs only to the player (`jobs.ts`).
  - Only the player gives orders to a crew (`orders.ts`).
  - So an NPC soldier is never given a job by his captain, never praised or blamed for how he did it, and never earns or loses standing for it.
  - This is the hierarchy's main engine of achievement, failure, reputation and resentment, and for NPCs it doesn't run. **It is a large part of why the organisation stagnates.**
- **The best behavioural model applies only to the player's crew.** In `orders.ts`, a man sent on a job may do it well, skim, lose half of it at cards, find nobody home, start a fight, or come back with a story that isn't true. That model is exactly the kind of cause the foundation needs: a job goes wrong, it costs him money and reputation, sours his captain, and feeds a problem. Today it runs only when the player gives an order.
- **Five sources of work offered to the player:**
  - the boss (`jobs.ts`);
  - tips;
  - opportunities from circumstances (`gigs.ts`);
  - ventures;
  - "work the family hands out" (`pulse.ts`).

  The player-facing duplication can wait. The asymmetry can't.
- **Implication for the foundation.** Work assigned down the hierarchy, judged by the same rules for everyone and carried out with the `orders.ts` behaviour model, is probably the single most important *cause generator* in the game. It feeds reputation, promotion, relationships with superiors, money trouble and ambition. It should be treated as a mechanic to consolidate, not a player feature.

### 2.7 The starting world

*Measured.*

At day 0:
- over 80% of people have nothing going on;
- nobody has an ambition or a side business;
- there are 0 grudges;
- every NPC's reputation sits in the same narrow band (30–44).

A new world has a structure but no history.

## 3. System by system

**Retain:** keep as it is, perhaps with small changes. **Improve:** keep the design, change behaviour. **Consolidate:** become the one version of an idea, absorbing the copies. **Replace:** rebuild. **Delete:** remove once its useful behaviour has moved.

### Foundations
| Module(s) | Verdict | Notes |
|---|---|---|
| `rng`, `engine` loop, `types`, `storage`, `savestore` | **Retain** | Sound. Save compatibility no longer constrains changes (the owner has no saves to keep). |
| `core` (facts, knowledge, witnesses) | **Retain, improve** | The knowledge model is the game's best asset. Improve: record causes as standard. |
| `rumour`, `retain`, `reports`, `news` | **Retain** | — |
| `rank` (the single door for rank changes) | **Retain** | The right pattern; extend it to other ideas. |
| `orgs` (organisations, succession) | **Retain** | — |
| `consistency` | **Retain** | — |
| `temper` | **Retain** | Temperament per man. Worth extending to the player's reputation. |

### Motivation, ambition and careers
| Module(s) | Verdict | Notes |
|---|---|---|
| `career` (NPC rules) + `path` (player rules) | **Replace with one rulebook** | One set of rules for rising, for everyone. The player's path becomes a view onto the same rules. Fix the reputation gate (NPCs need a way to earn reputation), the five-week patience limit and the free-seat flow. |
| `want`, set in `crewlife`, `pulse`, `path` | **Consolidate** | One place that decides and changes what a man wants, from his circumstances. The `pulse.ts` logic is the best of the three. |
| `goals` (NPC plans) | **Retain, improve** | Good design. Plans should end in success often enough. |
| `situations.ts` "ambition", `pulse.ts` advancement handouts | **Delete** | Copies of `goals` and climbing. |
| `matters.ts` climbing | **Retain** | The visible storyline of a man rising. |
| "Promotion" record used for joining a crew | **Fix** | Its own kind of record, so promotions can be counted and talked about correctly. |
| `ambition` (player milestones) | **Retain** | A player-side layer on top of the shared rules. |

### Circumstances and personal life
| Module(s) | Verdict | Notes |
|---|---|---|
| `people` (problems, skills) | **Improve** | Problems arise and end from conditions (losses, debts, setbacks, help), with causes recorded. Keep the consequences. |
| `situations.ts` "money" storylines | **Delete** (after moving it) | The same ground as `people` problems and `matters`, and it bypasses the storyline caps. |
| `life` (player only) | **Retain for now** | Becomes the basis of NPC personal life in the later phase. A thin layer of ordinary life comes earlier (see order). |
| `kin` | **Retain** | — |

### Relationships
| Module(s) | Verdict | Notes |
|---|---|---|
| The relationship record (`Rel`) | **Improve** | Add familiarity and a pair's shared history. |
| About 800 direct writes in about 40 modules | **Consolidate** | One entry point: "this happened between them", with a cause, from which trust, respect, affection, grudge, fear and familiarity change. `core.regard()` already exists and is the natural home. |
| Socialising and the weekly drift | **Replace** | Compatibility decides whether time together warms or cools a relationship. Decay should be even-handed. |
| `memory.ts` | **Delete** (once shared history exists) | It reconstructs what shared history would record directly. |

### Storylines
| Module(s) | Verdict | Notes |
|---|---|---|
| `situ.ts` (the storyline framework) | **Consolidate** | The one storyline engine. Review its 8 older kinds one by one: some (`grudge`, `intel`, `partner`) may be absorbed by `matters` or dropped. |
| `matters.ts` | **Retain** | The strongest storyline code. |
| `asks.ts` | **Retain, improve** | Already shared by NPCs and the player. Becomes the core of the social acts layer. |
| `disputes.ts` (its own store, copied into storylines) | **Consolidate** | One record, inside the storyline engine. |
| `pulse.ts` border disputes | **Consolidate** | Into the same engine, under its caps. |
| `politics`, `powers2`, `consequences` | **Retain, improve** | Real content (informants, the Commission, delayed consequences). Their decisions and sit-downs should go through the shared storyline engine and social acts. |

### Social acts
| Idea | Verdict | Notes |
|---|---|---|
| Lending, favours, protection, hitting back, apologies, threats, sit-downs | **Consolidate** | Each becomes one implementation used by NPCs, the player, conversations and screens. The rest are deleted. This must happen before the conversation rebuild, because many of the copies live inside the conversation code. |
| `negotiate.ts` | **Delete** (absorb) | 26 lines used by three modules; belongs in `asks`. |

### Economy and work
| Module(s) | Verdict | Notes |
|---|---|---|
| `econ`, `books`, `ledger`, `hustle` | **Retain** | Sound and tested. Debts become the one place loans live. |
| `orders` (a man doing a job, and how he does it) | **Consolidate** | The behaviour model becomes the one way anyone, NPC or player's man, carries out assigned work. |
| Work offered by superiors (`jobs` boss offers, `pulse` handouts) | **Consolidate** | One mechanic for a superior giving work to a man below him, used by NPC captains as well as the player's boss. |
| `rackets`, `gigs`, tips, ventures | **Retain for now** | Player-facing work. Review the duplication with places and HQs; no rebuild now. |
| The "obligations" block and random shop robberies in the weekly loop | **Improve later** | Fixed-odds events living in the loop; they belong to their own systems. |

### Violence
| Module(s) | Verdict | Notes |
|---|---|---|
| `violence` (who answers for what) | **Retain** | — |
| Hitting back (`actions`, `matters`, `disputes`, `revenge`, `orders`, `jobs`) | **Consolidate** | One act of hitting back, with methods. `revenge.ts` stays as the player's choice of method on top of it. |
| `danger` | **Retain** | The player's danger ladder. |

### Conversation
| Module(s) | Verdict | Notes |
|---|---|---|
| `dialogue`, `talk`, `flows`, `encounters`, `meetings`, `club`, `sitmoves`, `voice`, `voicesheet`, `react`, `exchange` | **Replace** (phase 2, as agreed) | First, every mechanic embedded in them moves to the social acts. `react`, `exchange` and `temper` hold the best ideas to carry over. |

### Tools
| Module(s) | Verdict | Notes |
|---|---|---|
| `cli`, `bot`, `stress` | **Review** | Developer tools. The long-run harness (below) may make `stress` redundant. |

## 4. Order of work (agreed with the owner)

**The foundation is not six new systems.** Some areas need new behaviour; others mostly need code deleted and better use made of what exists. Success means the world becomes more coherent, autonomous and causally connected, not that a checklist is implemented. Obsolete code is removed as part of each step, not saved for the end.

The order follows dependencies:

1. **A baseline harness with individual histories.**
   - Runs of one to two in-game years, several seeds, on today's code.
   - Totals: promotions and whether plans succeed; the spread of relationships, warm and cold; how many circumstances have causes and how long the chains are; money and debts; save size and speed.
   - **A readable history for individual men,** traced from cause to consequence.
   - **No quotas.** Promotions are not targeted at a rate. The test is whether men rise when the right candidate, backing and circumstances come together. If nobody rises over years, that is investigated, not forced.
2. **Consolidate the authoritative mechanics where duplication blocks the work:**
   - **one way relationships change,** with a cause (the about 800 direct writes go through it);
   - **one rulebook for rising and for reputation:** equivalent achievements earn equivalent reputation, NPC or player;
   - **one representation of ambition:** what he wants → his plan → the visible climb;
   - **one storyline engine;**
   - **one way work is given and carried out down the hierarchy;**
   - **one implementation of each social act** (lending, favours, protection, hitting back, apologies, threats, sit-downs).

   Each consolidation deletes the copies it replaces. The order within this step is set by what each one unblocks; the relationship path and the rulebook come first.
3. **Correct progression, relationships and causes using those mechanics:**
   - men rise when circumstances align;
   - relationships warm or cool by compatibility and history;
   - problems and wants arise from conditions, with causes recorded;
   - work down the hierarchy generates achievements and failures.
4. **Generated histories and ordinary NPC circumstances:**
   - a backbone of past events with causes, settled by a short simulation run;
   - one or two personal circumstances per notable man.
5. **Validate over extended periods** with the harness, reading individual lives as well as totals.
6. **Rebuild conversations** against the improved world.

After that: places and HQs, the wider consequence systems, personal life in depth, and Don gameplay.

## 5. Risks

- **Balance shifts with every step.** The harness exists to catch this. Expect retuning.
- **The conversation code contains game mechanics.** The social-act consolidation in step 2 must move them out before the conversation rebuild deletes that code.
- **Many tests are tied to today's structure.** Tests of behaviour should survive. Tests of structure (codes, kinds, modules) are rewritten or deleted along with what they test.
- **Still unmeasured** until the harness exists:
  - save size and speed over years;
  - the economy over years;
  - how much the player-facing work systems overlap.

## 6. Owner's decisions (October 2026)

1. **Reputation:** the same rules for everyone. Equivalent achievements produce equivalent reputation changes, even where NPCs and the player do different things.
2. **How often men rise:** no target. Test whether promotions occur naturally when candidates, sponsorship and circumstances align.
3. **The harness comes first,** with individual character histories, not just totals.
4. **Work systems:** reviewed now as part of the dependency assessment (section 2.6), not rebuilt now.
5. **Order:** dependency-led, as in section 4. Cleanup happens during the work, not after it.
