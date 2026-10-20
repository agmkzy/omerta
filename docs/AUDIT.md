# OMERTÀ — Complete Game Systems, Architecture & Future Development Audit

Status: analysis only. No source was modified for this report. Evidence is cited as `file.ts` / function name. Where I did not directly verify something, it is marked **[unverified]**. Where something does not exist, it says **not implemented**.

Codebase size: ~18,750 lines of TypeScript across 51 files in `src/` plus `src/ui/` (largest: `dialogue.ts` 1554, `jobs.ts` 1243, `encounters.ts` 973, `meetings.ts` 939, `web.ts` 819, `ui/views_b.ts` 748). Bundled by esbuild into one HTML file.

---

## 1. Purpose of this audit

To establish what OMERTÀ actually is today (as opposed to what earlier conversations intended), where its systems overlap or fail to connect, and what must change before the game is expanded toward a persistent NYC, factions, succession, and so on. Findings first, recommendations second, nothing implemented.

Method: read source for each system; ran the simulation headless over several seeds; ran `audit()` (world-consistency checker) at 120 days (no issues reported); measured save size and per-day sim cost; ran the existing `test.ts`.

---

## 2. Executive game overview

**Premise.** Single-player 1970s New York mafia sandbox. You are Tony Marino, an associate in the Corrente family, one of five fixed families. A deterministic simulation runs characters, businesses, grudges and rumours; you act through menus, encounters and a weekly "Sunday" accounting with your boss.

**Starting circumstances.** $1,500, no crew (changed in v68), a handful of prospects (9) you can recruit, a boss in Corrente. Player is hard-wired to `fam_corrente` (`world.ts`).

**Career paths.** Associate → soldier → capo → underboss → boss, via two parallel promotion mechanisms (`path.ts` and `career.ts`, see §10). Derived "specialisations" (Earner / Operator / Negotiator / Enforcer, `specs.ts`) are computed from past behaviour and grant perks; they are not a chosen class.

**Core loop.** Day/time-slot actions (go to places, run jobs, meet people, collect) → events tick (`weekly`, `daily`, per-character `think`) → Sunday: your men's tribute is settled, you pass money up, your boss reacts, you respond → situations, disputes and ambient events generate new decisions.

**First 30 minutes.** Guide card steps you through taking on a first man, the Sunday handover, first racket. This works and is the best-tested path.
**First weeks.** Recruit crew, assign them to rackets, keep tribute flowing, deal with generated situations (money, turf, org, life), visit the social club (v71).
**Long term.** Rank up, hold more men/rackets, politics/Commission. Beyond ~rank capo the content thins; there is no end state besides ambition completion and death.

**Implemented vs intended.** Implemented and playable: the loop above. Intended but not truly present: dynamic families, ownership transfer of businesses, persistent geography beyond abstract districts, faction creation/collapse, succession beyond "next in rank", law enforcement as an actor with goals, generational play.

---

## 3. Systems inventory

Format condensed: Purpose / Source / Persistence / Autonomy / Status. "Status" is critical: *Real* = drives world state; *Partial* = works for a subset; *UI-deep* = player-facing more than simulated.

| # | System | Source | What it actually does | Persistence | Autonomy (runs without player?) | Status |
|---|---|---|---|---|---|---|
| 1 | World/time engine | `engine.ts`, `types.ts` | Minute clock, event queue (`weekly`, `daily`, per-char `think`), serialize/deserialize (SCHEMA=2) | Whole `World` is plain data | Yes | Real |
| 2 | Characters | `types.ts`, `people.ts`, `world.ts` | Traits, rank, family, `rels` (trust/grudge), `known` facts, hustle, bossId | In world | Yes (think events) | Real |
| 3 | Families | `world.ts` `FAMILIES` | 5 hardcoded records; bosses chosen at creation | In world | Succession only | **Static** (see §7) |
| 4 | Rank/hierarchy | `career.ts`, `path.ts`, `powers2.ts` | `rank` string + `bossId` chain; powers unlocked by rank | In world | NPC promotion yes; player via path.ts | Partial, duplicated |
| 5 | Businesses/shops | `world.ts`, `rackets.ts`, `ways.ts` | Shops with owner/district; "ops" (rackets) with collectors | In world | Revenue ticks | Partial (static ownership) |
| 6 | Rackets/ways | `rackets.ts` `OPS`, `ways.ts` `WAYS` | Catalogue of standing rackets, take rates; WAYS is the UI catalogue | In world | Yes weekly | Real, but two parallel lists must be kept in sync (caused the v69 invisible-rackets bug) |
| 7 | Tribute/books | `books.ts` `settleWeek/settleOne` | Weekly takings, `declared` vs `expected`, skim decision, arrears | In world | Yes | Real (see §6) |
| 8 | Ledger | `ledger.ts` | Records player-circle settlements, hand-overs, loans | In world | Records only | **Partial** (not authoritative) |
| 9 | Favours/debts | `addFavour` | Creditor→debtor obligations | In world | NPC use limited | Partial |
| 10 | Facts/knowledge | `addFact`, `learn`, `known`, `reports.ts relevance` | Typed facts with hidden/true text; per-character knowledge | In world (largest save contributor) | Yes | Real; unbounded growth |
| 11 | Rumour/information | `reports.ts`, `voice.ts` | Filters which facts reach you | — | Yes | Real |
| 12 | Disputes | `disputes.ts` `disputeScan` | Pair-based grudges escalate to disputes | In world | Yes | Real; no resolution by third parties |
| 13 | Situations | `situations.ts`, `pulse.ts` | Money/ambition/turf/org/life situations offered to player | In world | Generated weekly; player-facing | Partial: mostly player-directed |
| 14 | Encounters | `encounters.ts` `Enc`, `choose`, `encounterTick` | Branching decision cards | In world | Triggered by world | Real |
| 15 | Scenes (club) | `club.ts`, `clubdata.ts`, `ui/clubview.ts` | Multi-exchange scripted conversations bound to a location, presence by schedule | In world (`w.scene`, `w.clubs`) | Presence is derived, not simulated | Real, **single location only** |
| 16 | Jobs/gigs | `jobs.ts`, `gigs.ts` | Crew jobs (`mkJob`) and offered gigs | In world | Gigs offered; NPC jobs limited | Real |
| 17 | Crew life | `crewlife.ts`, `orders.ts` | Men's moods, orders, going missing | In world | Yes | Real |
| 18 | Hustles | `hustle.ts` | NPC lines of work | In world | Yes | Partial: cosmetic income |
| 19 | Violence/danger/heat | `violence.ts`, `danger.ts`, `consequences.ts` | Hits, injuries, arrests, `purge`, `handleDeath` | In world | NPC purges happen | Real |
| 20 | Revenge | `revenge.ts` | Grudge → retaliation | In world | Yes | Real |
| 21 | Politics/Commission | `politics.ts` | Boss-level votes/sitdowns | In world | Yes | Partial |
| 22 | Ambient pulse | `pulse.ts` | Motives, ambient world, turf/org/life situations | In world | Yes | Real |
| 23 | Ambition (player) | `ambition.ts`, `ui/ambview.ts` | Current Ambition (made/crew/book/shops/rich/respect) | `p.ambition` | Checked weekly | Real, **duplicates `ambitions.ts`** |
| 24 | Ambitions (NPC/older) | `ambitions.ts` | Older NPC/player ambition model | In world | Yes | Real, overlaps #23 |
| 25 | Specialisations | `specs.ts` | Derived scores → tiers → perks | Derived | n/a | Real |
| 26 | Places | `places.ts`, `clubdata.ts` | `present()` decides who is where; club delegates to `clubPresent`, barber/bar use older random model | Partly derived | — | **Inconsistent** |
| 27 | Dialogue/voice | `dialogue.ts`, `voice.ts` | Large text banks keyed by situation | — | — | Real; the biggest file; no shared state with scenes beyond `ClubMem` |
| 28 | Meetings | `meetings.ts` | Sit-downs, crew meetings | In world | Triggered | Real |
| 29 | Powers | `powers2.ts` | Rank-gated actions (e.g. `errand`, `tipoff`, `squeeze`) | Cooldowns in world | Player-only | Real |
| 30 | UI | `web.ts`, `ui/*`, `web/template.html` | `data-a="action:value"` delegation, `View` union | `S` UI state | — | Real |
| 31 | Save/load | `engine.ts`, `web.ts` | localStorage key `omerta-save-v3`, 3 snapshots (`omerta-snaps-v1`) | — | — | Works; fragile (§16) |
| 32 | Test/audit | `test.ts`, `audit()`, `stress.ts` | Round-trip, consistency | — | — | **`test.ts` round-trip currently fails** (§16) |

Per-system Inputs/Outputs/Triggers/Dependencies are covered in §13 (dependency table) rather than repeated 32 times; I did not verify each cell of a finer-grained matrix and will not pretend to.

---

## 4. World simulation and time

- **Clock:** minutes; `DAY=1440`, `WEEK=10080`. Events are queued by time (`weekly`, `daily`, per-character `think`).
- **Order within a tick:** the queue pops by time; same-time order depends on insertion order. Weekly handlers (books, pulse, disputes, ranks) are chained; I did not find an explicit ordering contract — correctness relies on convention. **[partly unverified: exact intra-week order]**
- **Randomness:** one seeded `Rng` whose state is saved. Headless reruns from the same seed and inputs reproduce. UI code that touches the rng (e.g. render-time effects) would break determinism; v71 added a `once()` helper to stop that in scenes.
- **Reproducibility after save/load:** the sim continues identically after load (verified via diff in `rt.ts`), **but** `test.ts` fails its strict round-trip assertion because `deserialize` migrations add `chars.<player>.intro` — the migration is not idempotent with serialize. Harmless to play, bad for a test suite.
- **Incompatible intervals:** weekly and daily handlers both mutate the same money/relationship fields; no double-counting found in books. Daily vs weekly `think` can both act on one character in the same hour. **[no concrete bug found]**
- **Duplicate processing risk:** `ambition.ts` and `ambitions.ts` both advance on weekly ticks; two promotion paths can both evaluate the same character (§10).
- **Cost grows with world age:** per-character `known` fact lists and fact queries grow, so per-day cost rises over time (measured; exact figure in scratch outputs, not reproduced here).

---

## 5. NPC autonomy, intelligence, relationships

- NPCs have traits (violence, ambition, …), `rels` with trust/grudge, a `bossId`, a hustle, and knowledge. They "think" per character on a timer and pick from a small set of motives (`pulse.ts`).
- **What they can autonomously do:** form grudges, start disputes, retaliate (`revenge.ts`), purge a rival of lower rank (`consequences.purge`, p=0.012/week for violent ambitious leaders), die, get promoted, skim (when they are in the player's chain), take hustle income.
- **What they cannot:** open or buy businesses, change which family they belong to, form a faction, request changes to their financial arrangement, initiate a conversation with another NPC that has world effect, or plan across more than one step. There is no goal/plan structure; "intelligence" is weighted dice on traits.
- **NPC–NPC relationships** exist as numbers; they influence disputes and purges but do not produce narrated NPC–NPC scenes in the club (no rulings on NPC quarrels).
- **Knowledge discipline** is the strongest NPC-side design: each character has `known` and facts have `hiddenActor` / `textHidden` variants, so the player sees only what they would learn.

Verdict: relationships are real state; NPC *agency* is shallow and reactive.

---

## 6. Business and economic simulation (with tribute trace)

**Entities.** Shops (static, tied to district and owner), OPS/WAYS rackets with a collector, hustles (NPC incomes), player cash, and family/boss cash. Three earning models coexist: shop revenue + protection, racket "take" per op, and hustle/gig payments. Three money records coexist: character cash, `books` (weekly declared/expected), and `ledger.ts` (player-circle only).

**Tribute / kick-up trace (as implemented, `books.ts`):**
1. Each week `settleWeek` iterates collectors in the player's chain; `settleOne` computes the man's weekly take from his rackets (earner perk ×1.12 on take for the player).
2. **Expected** = take × agreed percentage. **Declared** = what he reports. If he skims, declared < expected; the skim decision uses his traits (greed vs loyalty/fear) and your relationship — a probability roll, not a plan.
3. **Actual** received = declared (paid in cash into your pocket). Shortfall accrues as arrears; repeated missing becomes `missed`.
4. On Sunday you pass a share up to your boss; the boss reacts to what you passed.
5. **Detection:** checking the books (Sunday UI) compares declared vs expected. Detection is available to the player via an action; NPCs do not independently audit.
6. **False dishonesty:** *can* occur — a downturn (revenue shock) lowers `expected` computed from the earlier baseline, or a race between the revenue update and the settle makes a man look short. I traced the code path and believe it is possible when a racket's take drops mid-week; I did not reproduce it with a concrete seed. **[unverified]** The v70 change simplified tribute to run itself, which reduced but did not remove this.
7. **Is there one authoritative source?** No. `books` (declared/expected), character cash, and `ledger` each hold part of the picture and can disagree. The ledger explicitly covers only player-circle settlements, hand-overs and loans.

**Racket downturn:** revenue is a function of the op's base and modifiers; no feedback into the collector's *behaviour* beyond the skim roll.

**Missing:** ownership of businesses by NPCs with their own P&L, prices/market, competition between rackets, investment returns for the player in an NPC's business.

---

## 7. Mafia hierarchy — dynamic or hardcoded?

**Direct answer: effectively hardcoded.**
- `FAMILIES` in `world.ts` is a fixed array of 5. Families are data records (id, name, boss), so the code *can* hold more, but nothing creates, splits, merges or dissolves one.
- District assignments are static.
- The player is wired to `fam_corrente`.
- Rank is a string on a character; hierarchy is `bossId` + rank. "Permissions" are enforced in `powers2.ts` and UI code by checking rank, not by an organisational model with roles/slots.
- Succession: when a boss dies, `handleDeath` promotes via rank rules; a **dangling dead boss** reference is possible in edge cases (observed risk, not reproduced in the 120-day audit — `audit()` found nothing).
- At 120 days, all five family bosses were alive with 11–20 members each; NPC rank counts were boss 5, underboss 5, capo 13, soldier 35, associate 21 — stable, i.e. the structure never meaningfully changes.

So: not "five hardcoded organisations" in the sense of impossible to extend (they are plain data), but the sim has **no organisational logic** that would make them dynamic.

---

## 8. Jobs, situations and emergent storytelling

- **Jobs** (`jobs.ts`) are structured crew jobs with outcomes; **gigs** are offers; **situations** are player-facing prompts generated from world conditions (money, ambition, turf, org, life).
- **Causal chains are mostly shallow:** a situation often references real state (a debtor, a quarrel, a rival), but it is generated *about* the player and resolved by the player; the world seldom continues the story on its own.
- **Rival-bookmaker chain** (rival opens → undercuts → your man's take drops → he skims or complains → you intervene): **cannot occur naturally.** There is no NPC-opened business, no competition effect on take, and no link from a rival's existence to a collector's revenue. Individual links exist in isolation (take changes, skim roll, intervention), but the first two links are missing.
- `ambientWeek` in `pulse.ts` creates world color and some state changes; fact generation is rich (`gambling_loss` facts are numerous).

---

## 9. Dialogue, scenes, social interaction

- `dialogue.ts` / `voice.ts`: big text banks, mostly one-shot lines per context; no persistent conversational state.
- `club.ts` is the only true **scene** system: multi-exchange nodes via `script()`, `ClubMem` remembers greetings/notes, topics have 3-day cooldowns, NPC-initiated only for real reasons (an encounter, a quarrel, a debt…). Roundtrips mid-scene are safe (tested).
- **Four interaction frameworks coexist:** encounters, meetings, powers, scenes. They do not share a model. Barber and bar still use the old random presence model.
- No NPC–NPC scenes; scene outcomes reach the world only through existing hooks (`enc`, settle, favours).

---

## 10. Player progression

- Rank via `path.ts` (player) and `career.ts` (NPC and some player logic) — **two systems** with different criteria.
- Two ambition systems (`ambition.ts`, `ambitions.ts`).
- Specialisations are derived and automatic.
- Rank powers (`powers2.ts`) are real but few; the audit added `errand`, `tipoff`, `squeeze`.
- Long-term: rank-ups saturate content; nothing beyond underboss/boss differs substantially.

---

## 11. Locations, territory, geography

- Districts are strings/records; shops and rackets reference them. No map topology, distance model beyond a `distance ×0.75` presence modifier, no travel cost, and no territory *control* state that changes (turf situations exist as prompts, not as ownership transfers). **[territory flip: not implemented]**
- Places: `places.ts` `present()`; only the club is schedule-driven.

---

## 12. Interface and information

- Single-page UI; `data-a` actions delegated in `web.ts` `doAction/pass/go`; `View` union. Screens: Life (stats card, specialisations, ambition), Rackets (catalogue from WAYS), Sunday, club lobby/scene.
- Strengths: information discipline (hidden facts), concise cards.
- Weaknesses: `web.ts` carries logic that belongs in the sim (`saccall`, `srule` rules like `cut` mutate `bossId` directly); `save()` swallows localStorage errors silently; phone layout depends on the template CSS only.

---

## 13. System connections and dependencies

```
            ┌──────────── engine/time/rng ────────────┐
            │                                          │
        characters ── rels/known ── facts ── reports ──┼── UI (views, scenes)
            │             │                            │
        hierarchy     disputes/revenge                 │
        (rank,bossId)      │                           │
            │         consequences (death, purge)      │
            │                                          │
 shops/rackets ── books (tribute) ── ledger(partial)   │
            │          │                               │
         hustles    favours                            │
            │                                          │
 pulse (ambient, situations) ── encounters ── scenes ──┘
            │
 ambition(s) / specs / path+career
```

| Connection | Class | Notes |
|---|---|---|
| Shop revenue → tribute | Direct | `books` |
| Tribute shortfall → boss reaction | Direct | Sunday |
| Skim → detection | Direct (player-initiated) | no NPC audit |
| Grudge → dispute → revenge | Direct | |
| Death → promotion/succession | Direct | dangling-boss risk |
| Facts → what player knows | Direct | |
| Ledger ↔ books ↔ cash | **Missing** (no single source) | |
| Rival business → collector's take | **Missing** | |
| Ownership change → shop owner | **Missing** (change-hands alters only the protection collector) | |
| Dispute → third-party ruling (boss/Commission) | Indirect/Partial | |
| Territory → revenue | **Missing** | |
| Specialisation → perks | Direct | |
| Ambition → rewards | Presentation-mostly | completes, minor reward **[unverified magnitude]** |
| Scenes → world | Indirect (through existing hooks) | |
| Two ambition systems | Duplicate | |
| Two promotion systems | Duplicate | |
| Law enforcement → pressure | Partial (heat/arrest only) | no actor |
| Life situations → world | Presentation-heavy | |

---

## 14. End-to-end gameplay traces

Each trace states what the code supports. "Unsupported" means the chain breaks at the named step.

1. **Recruit an associate.** Supported. Sunday/prospects list → accept (`saccall` or single recruit) → `bossId` set, man added to crew, enters books next week. Weakness: prospects are a fixed small pool (9) refilled by pulse.
2. **Racket downturn.** Partially. Take drops via modifiers → `expected` changes → collector's declared may fall → looks like skimming (false dishonesty possible). No cause is *explained* to the player and no NPC adapts.
3. **Associate pays less tribute.** Supported. `settleOne` skim roll from traits → declared < expected → arrears/missed → player checks books → demand/shout/beat/cut options (`srule`). Detection only if player checks.
4. **NPC develops a business opportunity.** **Unsupported.** NPCs have hustles but no mechanism to propose, open or lease a business; only player-directed gigs/situations.
5. **Two NPCs develop a dispute.** Supported. `rels` grudge ≥ threshold → `disputeScan` pair → may be surfaced via facts/rumour → revenge. Resolution by a boss/third party is thin; club has no ruling on NPC quarrels.
6. **Rival organisation competes.** **Unsupported** as economic competition. Families can purge individuals; there is no inter-family market, territory contest or war state.
7. **Player invests in a business.** Partial. Player can take racket slices (`ways`/stakes via `w.path?.stakes`); there is no returns model tied to a business's real performance beyond the racket take.
8. **Associate → soldier.** Supported via `path.ts` criteria (and also potentially `career.ts` — dual path). Powers change; no ceremony state beyond text.
9. **Becomes capo.** Supported with same caveats; capo-level powers are few, and presence/club behaviour changes by rank.
10. **NPC requests a financial arrangement change.** **Unsupported.** No NPC-initiated request that changes agreed percentage; the percentage is not a negotiated entity.
11. **Player completes Current Ambition.** Supported: `ambitionTick` evaluates progress weekly; completion flag; reward small. Note the older `ambitions.ts` can still run in parallel.
12. **NPC initiates a conversation.** Supported only at the club, for genuine reasons (`waiting`, capped 1/2/3 by rank); nowhere else.
13. **A situation develops over weeks.** Weak. Situations are generated and resolved, with some follow-up facts; there is no persistent multi-stage situation object driving world change independently.
14. **Family leadership vacancy.** Partial. `handleDeath` on a boss → rank-based promotion; no election, contest, split or outside takeover; dangling reference possible.
15. **Business changes ownership.** **Largely unsupported.** "Change hands" only changes the protection collector; shop owner records are static.

---

## 15. Future-expansion feasibility

| | Existing support | Missing | Architecture change | Risk | Complexity | Influences current work? | Horizon |
|---|---|---|---|---|---|---|---|
| A Persistent NYC | Districts as strings | Geography graph, place registry | Single `Place` model replacing `places.ts` randomness | Save growth | High | **Yes** — place model should be generic now | Medium |
| B Travel | Distance modifier | Costs, time, state | Needs A | Low | Medium | Little | Medium |
| C Territorial influence | Turf situations | Control state per district/business | Territory table feeding books | Medium | High | **Yes** — books must read it | Medium |
| D Faction wars | Purge, revenge | War state, objectives, front lines | Org entity with goals | High | High | Needs F/C first | Long |
| E Found your own family | Family as data | Creation/split logic; rank slots per family | Org entity w/ roles | High | High | Yes — remove hardcoded `fam_corrente` | Medium-long |
| F Autonomous faction formation | None | NPC goals/plans | Goal layer | High | Very high | Yes | Long |
| G Dynamic org identity | Names/colors in data | Derived identity from membership/actions | Org model | Low | Medium | Little | Long |
| H Succession | `handleDeath` basic | Contest, legitimacy, vacancy handling | Org model + events | Medium | Medium | **Yes** — fix dangling boss now | Near |
| I Diplomacy/Commission | `politics.ts` partial | Treaties, standing between orgs | Inter-org relation table | Medium | High | Little | Medium-long |
| J Law enforcement | Heat, arrest | Actor with goals, investigations | New agent | Medium | High | Little | Medium-long |
| K Generational | Death exists | Heirs, family trees, character switch | Player-as-pointer (`isPlayer` already a flag) | Medium | High | Little | Long |
| L 3D | None | Presentation layer | Needs clean sim/UI split (§19) | Low if sim stays pure | Very high | Keep sim UI-free | Long |

---

## 16. Technical architecture & code quality

Positives: pure-data `World`; deterministic seeded RNG; single serialize path; headless sim possible (`cli.ts`, `bot.ts`); `audit()` consistency checker.

Concerns:
1. **Save growth.** Measured ≈ 62 KB/day, dominated by per-character `known` and `gambling_loss` facts. Browser localStorage quota is typically ~5 MB per origin **[unverified for this device]**; extrapolation puts failure within roughly two months of play. `save()` in `web.ts` swallows errors, so failure would be silent; plus 3 snapshots multiply the footprint.
2. **Migration impurity.** `deserialize` adds `chars.<player>.intro`; `test.ts` strict round-trip fails.
3. **Duplicate systems:** two ambition systems, two promotion systems, four interaction frameworks, three earning models, three money records, two rackets lists (`OPS` vs `WAYS`).
4. **Logic in UI layer:** `web.ts` handlers mutate world (e.g. `srule` cut sets `bossId = null`).
5. **Sim cost grows with world age** (fact lists).
6. **Large files** (`dialogue.ts`, `jobs.ts`) and mixed responsibilities.
7. **Untuned economy** (odds, take rates, tribute); only sanity-checked.
8. **Tests:** `test.ts` red; `stress.ts` outcomes not rechecked in this audit **[unverified]**.

---

## 17. Prioritised problems

**Critical**
- C1 Save growth/silent save failure (`known` + facts unbounded; `save()` swallows).
- C2 No single authoritative money record (books/cash/ledger).

**High**
- H1 Families have no organisational logic; hardcoded player family; dangling boss on death.
- H2 Business ownership static; "change hands" only swaps collector.
- H3 Duplicate promotion (`path.ts`/`career.ts`) and ambition systems.
- H4 False dishonesty possible after downturns.
- H5 Red round-trip test (migration impurity).

**Medium**
- M1 Interaction frameworks fragmented; barber/bar not on the scene model.
- M2 UI handlers mutate world.
- M3 Sim cost grows with age.
- M4 OPS/WAYS dual catalogues.
- M5 NPC agency shallow (no goals/plans).

**Low**
- L1 Dialogue banks large and repetitive; L2 economy untuned; L3 recruiting pool fixed size.

---

## 18. Consolidation opportunities

- One ambition model; one promotion model.
- One money truth: books as source, ledger as a projection.
- Derive WAYS from OPS (or vice versa).
- One interaction contract (scene) that encounters/meetings/powers can enter through.
- Fact pruning/compaction policy (cap per character, age out irrelevant facts).
- Move world mutation out of `web.ts` into sim actions.

---

## 19. Recommended target architecture

```
 ┌────────────── Presentation (web / future 3D) ──────────────┐
 │ views, scene renderer — read-only queries + intents only   │
 └───────────────▲────────────────────────────┬───────────────┘
                 │ queries                    │ intents
 ┌───────────────┴────────────────────────────▼───────────────┐
 │ Sim actions (single mutation gateway, deterministic)       │
 └───────┬───────────┬────────────┬────────────┬──────────────┘
   Orgs/Ranks    Economy      People        Situations/Scenes
 (org entity,  (owners, P&L,  (goals, rels,  (persistent objects,
  roles, terr.) one ledger)    knowledge)     location-bound)
         └────────────── World state (plain data, pruned) ─────┘
```

---

## 20. Roadmap

**Immediate (stability, no new features):** save size cap/pruning + visible save-failure warning; fix migration purity and make `test.ts` green; resolve dangling boss on death; settle on one ambition/promotion system.
**Medium:** unify money into one authoritative record; business ownership model (owner, P&L, transfer); org entity replacing `FAMILIES`; extend scene model to barber/bar and make presence schedule-driven.
**Long-term:** NPC goals/plans; territory and faction conflict; succession, diplomacy, law enforcement; generational play; presentation split for 3D.

---

## 21. Final assessment

**Five strongest systems:** deterministic engine/serialization; knowledge/fact discipline; tribute settle loop (as a player-facing loop); disputes→revenge chain; club scene slice.
**Five weakest:** families/orgs; business ownership; NPC agency; money records; progression duplication.
**Three greatest architectural risks:** save growth/silent failure; no organisational model while content assumes five fixed families; multiple parallel systems drifting apart.
**Most important missing connections:** rival/market → take; ownership → revenue; territory → books; dispute → ruling; single money truth.
**Most valuable next task:** the stability pass in §20 Immediate — specifically fix save growth and silent save failure first, because every later feature adds more state and a player can currently lose progress without being told.
**Long-term feasibility:** good if the sim stays UI-free and an organisation/ownership model is introduced before factions, wars or founding families; poor if those are layered on the current static data.

---

## 22. Reporting notes

All claims come from reading code and running headless measurements in this session. Items marked **[unverified]** need confirmation before acting. No functionality has been invented; absent systems are labelled as such.
