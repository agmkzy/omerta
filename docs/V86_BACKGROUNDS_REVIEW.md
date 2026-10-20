# OMERTÀ – Character backgrounds and starting conditions: review (V86)

Investigation only. No code was changed. Evidence comes from the source on branch `v86-opening-redesign` and the V85 playtest save (`playtest/state.json`, seed 3, day 35).

**Short answer:** yes, but only one way does it properly. The game already has five player skills that are saved, shown to the player and read by about a dozen systems. A background can choose **which of the player's randomly rolled skills come out on top**, without adding anything. That gives six distinct, durable, balanced-by-construction starts with no new attributes, no migration and a small change. Starting circumstances (cash, standing, assets, knowledge) cannot support six distinct backgrounds without either favourable relationships, invented knowledge, or cash-only differences, so I recommend against them, with one optional exception (Wheelman).

---

## A. Current architecture

### What a new player is
`createWorld()` in `src/world.ts` makes the player with the same `mk()` used for every NPC, then overrides a few fields:

| Field | Start value | Set where | Read by gameplay? |
|---|---|---|---|
| `cash` | $1,500 | `world.ts` (`mk(... cash: 1500)`) | Yes: everywhere money is spent; gates actions (e.g. lending needs $700+, a $1,000 loan needs $1,300+, `actions.ts` `case 'lend'`) |
| `rank` / `familyId` / `bossId` | associate, Corrente, a capo | `world.ts` | Yes: authority, wages, career (`rank.ts`, `career.ts`) |
| `standing` (reputation 0–100) | 40 | `mk()` default | Yes, very widely (~150 reads; `path.ts`, `dialogue.ts`, `meetings.ts`, `career.ts` …). Promotion is blocked below 45 (`career.ts:74`) |
| `skills` (brains, charm, driving, muscle, nerve) | **random**: each 0.2–0.7, plus +0.2 on one random "gift" skill | `rollSkills()` in `people.ts` | Yes (see below) |
| `traits` (greed, violence, caution…) | fixed for the player | `world.ts` | Partly: e.g. promotion-trial odds (`path.ts` `chanceOf`), day-job shifts (`orders.ts`) |
| `heat` (police attention) | 0 | `mk()` | Yes: arrest risk above 0.45, decays 0.08 a week (`engine.ts:224–230`) |
| `cars`, `goods` | 0 | `mk()` | Yes: stolen goods sell at $550 a car (`jobs.ts:923`) |
| `rels`, `intro`, `known` | one link to his capo, nobody introduced, no facts | `world.ts` | Yes: the knowledge and relationship systems |
| `job` (day job), `hustle` | none | — | Day jobs are open to everyone from day 0 (`orders.ts` `dayJobOptions`); hustles are **NPC-only** (`hustle.ts:53` skips the player) |
| `bg` | the chosen background | `background.ts` `applyBackground` | **No.** Since V86 it is stored and displayed only (profile, `views_b.ts`) |

### Skills are a real, shared, player-facing system
- Player and NPCs use the same `Skills` type and the same `aptitude()` / `grow()` functions (`people.ts`).
- Where the **player's** skills change outcomes: own job success (`jobs.ts:517`), racket work when he runs it (`rackets.ts:172`), promotion trials, where he picks muscle / charm / nerve / brains and the odds come from his skills (`path.ts` `chanceOf`), taking the chair (`path.ts:278`, nerve), persuasion in conversation (`dialogue.ts:1366`, charm), courting (`life.ts:310`, charm), getting caught after revenge (`revenge.ts:159`, charm), fights (`violence.ts:161`, muscle), the "enforcer" specialisation (`specs.ts`).
- Skills grow by about 0.025 each time the matching work is done (`grow()`), and are already shown on the player's own page as "What you're good at" (`views_b.ts:587`), right above where the background is shown.

### Residual effects of backgrounds
None. In V86 `applyBackground` only sets `p.bg`. In V85 it changed cash, skills, standing, heat, cars and gave 2–4 NPCs trust of 0.35–0.6 with the player (`git show 87fca6d:src/background.ts`).

### What the V85 playtest shows (seed 3, no background, day 35)
- Cash **fell** from $1,500 to $1,079: an associate's wage ($80) is below living costs ($100) (`engine.ts:89, 176`), so early money pressure is real.
- Standing rose from 40 to **70.5**, and the boss's trust reached **1.0**. Relationship and standing bonuses are erased by ordinary play within days. This is the known "relationship inflation" problem.
- Skills ended at 0.40–0.50 and barely moved. **Skill differences survive the whole 35 days.**

---

## B. Feasibility comparison

| | A. Narrative only (current) | B. Starting circumstances | C. Background abilities |
|---|---|---|---|
| What it means here | Text only | Vary cash / standing / heat / assets / debts / knowledge | As briefed: new abilities, perks or job modifiers. **But** a light version exists with no new systems: shape the existing skill roll |
| Complexity | None | Low per lever, but each lever is a separate rule. Debts and assets touch the ledger | Full version: high (new attributes, UI, every job module, migration, balancing). Light version: very low (one function) |
| Gameplay value | Role-play only; no difference after the first screen | Mostly short-lived: standing and trust bonuses vanish by day 7–14; heat is gone in 2–3 weeks; cash matters for the first weeks only | Light version: lasts to day 35 and beyond; changes which jobs and which promotion approach suit you |
| Balancing risk | None | High. V85 shows it: Small Businessman got +$1,500 (double the start) and was clearly best | Light version: low. Everyone keeps exactly the same rolled values, only their placement changes |
| Maintenance | None | Each lever must stay in step with economy changes | Light version: none beyond the mapping table |
| Save migration | — | None (new games only) | None (`skills` already saved) |

Can B give six distinct backgrounds without relationships? **No.** The levers that work naturally are cash, standing (relationship-like and quickly erased), heat (a small, temporary penalty), stolen cars and pre-made loans. Several backgrounds have nothing truthful to attach to (see C). It would come down to "different amounts of cash", which the brief rules out.

---

## C. Background by background

The "skill emphasis" column is the recommended light version: these two skills take the highest and second-highest of the player's own rolled values.

| Background | Identity | Natural existing lever(s) | Matters early? | Fair? | Overlap | Recommended |
|---|---|---|---|---|---|---|
| **Street Hustler** | Corners, errands, reading people | Charm + nerve (leaning, messages, scams). Cash: no truthful reason | Yes: early jobs are errands and leaning | Yes | Some with Connected (nerve) | **Charm, nerve** |
| **Connected Family** | Grew up around the life | Only relationships or standing, both excluded by the brief. +5 standing would clear the promotion blocker at 45 on day 0, and is erased by day ~7 anyway | Only via skills | Standing would be an unfair shortcut | — | **Nerve, muscle** (composure, the hard side of the work) |
| **Small Businessman** | Tried honest money | "Knows which shops are struggling" (`p.struggling`, used by the loan options) **cannot be true on day 0**: no business is in distress yet. Extra cash = the V85 imbalance | Via skills: fixing, finding, numbers | Yes, with skills only | Shares brains with Bookmaker | **Brains, charm** |
| **Union Man** | Influence over wages | No union system exists. Collecting and guarding fit | Yes: collection jobs come early | Yes | — | **Muscle, charm** |
| **Bookmaker** | Bets, records, collecting | A pre-made loan to an NPC is possible (`createDebt`), but the player can already lend on day 0 with the same money, and it creates an NPC tie and $25 a week interest | Via skills | A loan book would be an income edge | Shares brains with Businessman | **Brains, nerve** |
| **Wheelman** | Drove, didn't ask | Driving skill (car thefts, hijacks, deliveries). Optional: one stolen car on hand (`p.cars`, sells for $550), and a little heat | Yes for car work; less elsewhere | Driving is the narrowest skill, so the pairing gives nerve too | — | **Driving, nerve** (+ optional car, see D) |

There are five skills and six backgrounds, so one primary skill repeats (brains). The ordered pairs are all different. If you want strictly distinct primaries, Bookmaker and Small Businessman are the pair to merge or rename.

---

## D. Recommended design

**Backgrounds shape the start; they don't add to it.**

1. **Skill emphasis (do this).** At the start of a new game, after the usual random roll, rearrange the player's five rolled skill values so the background's first skill gets the highest value and its second skill the next highest. Nothing is added or removed, so every background has exactly the same total ability; only the shape differs.
   - It lasts: skills grow slowly (about 0.025 per job), so the emphasis is still visible at day 35, but any skill can catch up with use. It decides where you start, not where you can go.
   - It matters: it changes the odds on the jobs you take, which promotion-trial approach is best for you, and your conversation and courting odds.
   - It is honest: the existing "What you're good at" card already shows it to the player.
   - It adds nothing: no new attribute, progression, relationship, cash or position.
2. **Keep $1,500, standing 40, no heat, no relationships for everyone.** Cash-only differences are a trap (V85's Small Businessman), and standing and trust bonuses are both shortcuts and erased within a week by the known inflation.
3. **Optional, Wheelman only:** start with one stolen car on hand instead of $550 of the cash (same net worth), with heat 0.1. That's a real first decision: sell it, chop it or sit on it. It is the only circumstance that is truthful, distinct and supported by an existing mechanic. I'd leave it out of the first pass and add it only if the skill emphasis alone feels too quiet.

If even the light version isn't wanted, **narrative-only is the right fallback**. It is better than any version of B.

---

## E. Implementation scope (for the recommended design)

- `src/background.ts`: add `skills: [primary, secondary]` to each entry; `applyBackground` swaps values into place. Deterministic, uses no random numbers, about 15 lines. Legacy ids (`boxer`, `convict`, `driver`) do nothing.
- `src/ui/opening.ts` (text only, no layout change): one quiet line under each background in the History panel, e.g. "Leans on: charm, nerve", so the choice is informed.
- **No save migration.** It applies once, when a new game begins. Existing saves keep their skills and backgrounds.
- No change to the simulation, economy, CLI or playtest harness. `createWorld` and the tests don't call `applyBackground`, so `test:all` is unaffected.
- **Tests:** update `src/tests/v86.test.ts` "a background is history only" to check that the set of five values is unchanged, the right skills end up first and second, and cash ($1,500), standing (40), heat, cars, relationships and introductions are identical to a world without a background. Keep the save/load round-trip test. Then run typecheck, v77–v79 and v86; the full suite isn't needed since the simulation is untouched.

## F. Risks and trade-offs

- **Skills aren't equally useful.** Charm is read by more player-facing systems (conversation, courting, revenge, trials) than driving (car work, plus a share of the "nerve" trial). Pairing driving with nerve offsets this, but Wheelman stays the more specialised choice. That's acceptable as long as it's a style rather than a weakness. Watch it in the next playtest.
- **Rerolling** a new game to fish for high skills is already possible today; this design doesn't make it worse, since the background places values but never raises them.
- **Hidden numbers:** the effect only shows through the existing skill words ("good", "sharp", "gifted"). Without the one-line hint in the creator, players won't know the choice did anything.
- **Old saves:** they keep their V85 background effects, which were already applied, and their labels. Nothing to migrate.
- **Not solved here:** relationship inflation, the 45-standing promotion gate being trivial by day 35, and early cash pressure are V85 integration issues. Backgrounds shouldn't be used to patch them.
