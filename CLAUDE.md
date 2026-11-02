# OMERTÀ – project instructions for Claude Code

Read this file first, then `HANDOFF.md`, then the specs in `docs/`. This project is a **continuation of V85**, not a rewrite. Do not recreate anything from descriptions; the source in this repository is the actual project.

## Overview
OMERTÀ is a single-player sandbox RPG about organised crime, set in **1970 New York**. The design goal is that the simulation itself generates the game's stories. The world contains three crime families (boss, underboss, capos, soldiers, associates), plus civilians, shopkeepers, businesses, rackets, loans and clubs. Every character acts on their own schedule, using a utility AI whose scores are weighted by personality traits (greed, violence, caution, ambition, vice…). The player starts as an associate of the Corrente family (default seed start: day 0, $1,500, boss Louie Costa). Promotion depends on earnings, sponsorship, vacancies and the boss's agreement. Induction as a made man is a playable ceremony.

**Design principles:** every event has a reason, and every significant event has consequences. Prioritise **meaningful, interconnected gameplay** over superficial UI changes or disconnected mechanics. A changed state variable is not integration: a downstream system must read it and change its behaviour.

## Architecture (src/)
- **Deterministic simulation:** seeded RNG (`rng.ts`), event queue and tick (`engine.ts`), world generator (`world.ts`). The same seed and the same actions produce the same history. No `Math.random`, no wall-clock time, no runtime LLM calls.
- **World:** plain serialisable data (`types.ts`). Time advances only by the time cost of the player's actions. There is no offline progression.
- **Economy and ledger:** `ledger.ts`, `econ.ts`, `books.ts`. Money is conserved, and every transfer is a recorded transaction. The weekly tick processes debts, kick-ups and businesses. `audit()`/`ledgerCheck()` verify consistency; the tests rely on them.
- **Knowledge:** knowledge is a game mechanic. Every event is a `Fact`, and characters know only the facts they witnessed or were told (`core.ts`, `p.known[f]`, `knowsActor`). Victims may identify the wrong culprit. Dialogue and boss jobs must respect this (for example, a boss offers a "deal with X" job only once he knows who wronged the player).
- **NPC autonomy and relationships:** `actions.ts` (options and scoring, retaliation with cooldowns `ret:beat/torch/hit`), `goals.ts`, `ambition.ts`, `crewlife.ts`, `revenge.ts`, `consequences.ts`, `disputes.ts`, `politics.ts`/`powers2.ts` (Commission, settlements between leaders). Relationships are stored per pair as trust, respect and grudge (`rel()`).
- **Commitments:** memos (promise/threat/agreement/question/favour), favours (`addFavour`), debts (`createDebt`, weekly payments, missed payments, collections), encounters (`encounters.ts`), jobs (`jobs.ts`, `orders.ts`), meetings and sit-downs (`meetings.ts`).
- **Organisations and careers:** `orgs.ts`, `rank.ts`, `career.ts`, clubs (`club.ts`), rackets, Sunday envelopes.
- **Conversation and negotiation:** `dialogue.ts` (intents, nodes, memory of used options, `say()`), `flows.ts` (standing, promotion, sit-downs, threats, crew management, recruitment, rival organisations), `negotiate.ts`, and character voices in `voice.ts`/`voicesheet.ts` (archetypes: proud, bitter, schemer, earnest, hothead, cold, jovial, frightened). Rules:
  - Used options are greyed out and give no benefit until a new conversation starts.
  - No line is repeated (`Convo.spoken`).
  - No database language or internal numbers are shown.
  - Rank changes a character's authority and the choices available.
  - NPCs disclose only what they could plausibly know.
  - Every counteroffer must have a stated reason based on the character's finances or motives.
- **UI:** `web.ts` (entry point and router), `ui/*` (views), `web/index.html` (page shell), `web/css/*` (one token set in `tokens.css`, then base, components, shell, conversation, screens, herald, opening; imported in that order by `web/main.ts`). Vite (`vite.config.ts`, `vite-plugin-singlefile`) builds everything into one HTML file. Since the UI rebuild (`docs/ui/`):
  - Screens are built from the components in `ui/kit.ts` (headings, rows, key/value, numbered choices, context box, buttons), not ad-hoc markup.
  - Every decision is a numbered `choices()` list (keys 1–9, Escape, arrow keys).
  - The relationship between the player and a character is presented by `ui/between.ts` (in conversation and on the character's page).
  - Money is presented by `ui/money.ts` (Business, Rackets, World).
  - Every view type declares its section in `ui/layout.ts`.
  - Show only what the player could know: never another character's private records.

## Development rules (permanent, 28 Oct 2026; full text in `docs/architecture/INVARIANTS.md`, register in `docs/architecture/INTEGRITY.md`)
There is one world: what is true in one system is true in all systems. Characters may lie, make mistakes or act irrationally, but the simulation must know the reason.
- **Fix the class of bug, not the instance.** For any nontrivial bug, establish: what happened; what should have happened; which invariant was broken; why the code allowed it; where else the same mechanism can fail (search by mechanism); and the right scope for the fix (local / shared rule / duplicated responsibility / missing concept / presentation). Make the smallest reliable change that removes the whole class. Record systemic issues in `INTEGRITY.md`.
- **Invariants:**
  - **A** Knowledge has provenance (seen, told, rumour, inference). Trust is never proof that something was said. A character's private state drives only that character's own behaviour.
  - **B** Authority follows position (`standing.positionOf`). Influence is not authority.
  - **C** Identity (`conv/persp.ts`, the speech pass).
  - **D** Every consequence has a recorded cause.
  - **E** State persists in the existing records, with no second copies.
  - **F** NPCs decide by their own knowledge, temperament and interests. A proposal is not an agreement.
  - **G** One record per thing.
  - **H** The ledger.
  - **I** One clock, processed in order.
  - **J** Conversation follows intention → interpretation → response → state → follow-ups that assume only what was actually said.
- **New features join existing systems** (commitments, knowledge, matters, ledger, hierarchy). Do not create parallel sources of truth. Remove whatever a change supersedes. Protect player agency.
- **Validation:** test the invariant across ranks and across unusual but valid cases, not just the reported example. For gameplay changes, read transcripts or play in the browser.
- **Reporting:** state what changed, why that scope was chosen, what wider class was checked, how consistency was established, what play showed, and what remains imperfect. Never claim a class of bug is eliminated on the basis of a clean, finite audit.
- Keep this process proportionate to the change: a typo fix is just a typo fix.

## Hard requirements
- **Save compatibility:** `serialize/deserialize` (SCHEMA 7). Never break loading of older saves. New fields must be optional with safe defaults. Add migrations; never delete them. `src/tests/saves/oldsave.test.ts` loads genuine old saves (`src/tests/fixtures/`, including a schema-2 save). Keep it passing, and add a fixture whenever the schema changes.
- **Portraits** are procedurally generated in `src/ui/portrait.ts` (`portraits_pack.ts` is an intentionally empty override slot). From V88 the owner has asked for them to be reworked (rank shown through clothing, more variety and options). Keep them deterministic (the same character always gets the same face) and save-compatible: the existing `Look` fields keep their meaning, and new options are optional with defaults.
- Preserve the V72–V76 mechanics, the ledger, the NPC information restrictions and the conversation overhaul.
- Do not add gameplay systems or change balance unless asked. Report integration gaps instead of hiding them.

## Build, test and deploy
```
npm install
npm run typecheck
npm run test:all          # Vitest: every test except the opt-in long runs, in parallel (~50 s)
npm run test:unit         # only the unit tests (~6 s)
npx vitest run economy -t ledger   # one system (path filter), one check (name filter)
npm run build             # -> dist/omerta.html
npm run dev               # live-reload dev server, http://localhost:5173
```
- Tests live in `src/tests/<system>/` (architecture, saves, hierarchy, economy, agency, situations, organisations, dialogue, creation, determinism). They are discovered by name, use `node:assert`, and each carries exactly one kind as a Vitest tag (`unit`, `scenario`, `sim`, `determinism`, `compat`, `architecture`, `property`; see `src/tests/tags.ts`).
- Put a new test in the file of the system whose rule it proves. Build worlds with the named fixtures (`newWorld(7)`, `agencyWorld(7, 20)`, `world60()`, …), never with a `fresh()` that has hidden defaults.
- Long runs are tagged `slow` and run only with `SLOW=1` (`npm run test:slow`, `SEED`/`DAYS`). See `docs/05-testing.md`.
- Before shipping any change, run at minimum the typecheck and the dialogue tests (`make test`). Run the full `test:all` for anything that touches the simulation, saves or economy.
- Deployment: publish `dist/omerta.html` (GitHub Pages `index.html` at https://agmkzy.github.io/omerta/; artifact https://claude.ai/artifact/YDyiAu7Aw8bZdwMjaBRVV3).
- Do not poll with sleep loops. Run long tests in the background.

## Playtesting
`playtest/pt.ts` drives the real simulation from the command line with persistent state (`playtest/state.json`, `actions.log`). The V85 playtest used seed 3, the character “Tony Marino”, 35 days, and no manual state edits. Evaluate gameplay by tracing consequences (action → recorded state → later behaviour), not by whether tests pass.

## Known limitations identified in the V85 playtest
**Bugs:**
- Haggling with no stated reason is accepted too easily (`tipReply`, encounters.ts ~787).
- Loan text grammar (“It’s the car is finished…”).
- Completed promises are still listed in memos.
- A capo gives a generic reply to a beating.
- The weekly-envelope prompt is flat.
- A recall line is presumptuous.

**Integration gaps:**
- Ignored promises are penalised less than failed ones.
- Routine jobs saturate relationships too quickly (boss trust ~0.99 by day 35).
- `w.goals` rarely drives NPC behaviour in a visible way.
- Rival organisations never approached the player, and no promotion occurred in 35 days.
- A save-size failure around day ~60 has not been discussed.

**Confirmed working chains:** favour owed → backing; beating → boss learns → boss job; grudge → retaliation → alibi favour; loans → weekly payments; broken word → later dialogue.
