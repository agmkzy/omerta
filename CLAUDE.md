# OMERTÀ – context for Claude Code

Read this, then `HANDOFF.md`, then the specs in `docs/`. This is a **continuation of V85**, not a rewrite. Do not recreate anything from descriptions; the source here is the real project.

## What it is
A single-player sandbox mafia RPG in **1970 New York**. The pitch: a world that produces its own stories. Three families (boss, underboss, capos, soldiers, associates) plus civilians, shopkeepers, businesses, rackets, loans, clubs. Everyone acts on their own schedule through a utility AI scored by personality (greed, violence, caution, ambition, vice…). The player is an associate of the Corrente family (default seed start: day 0, $1,500, boss Louie Costa) and rises through earnings, sponsorship, vacancies and the boss's agreement (made-man induction is a playable ceremony).

**Design philosophy:** nothing happens without a reason, and nothing significant happens without consequences. Prioritise **meaningful, interconnected gameplay** over superficial UI changes or disconnected mechanics. A state variable changing is not integration – a downstream system must read it and change behaviour.

## Architecture (src/)
- **Deterministic sim:** seeded RNG (`rng.ts`), event queue and tick (`engine.ts`), world generator (`world.ts`). Same seed + same actions = same history. No `Math.random`, no wall-clock, no runtime LLM calls.
- **World** is plain serialisable data (`types.ts`). Time advances only by what the player's actions cost; no offline progression.
- **Economy & ledger:** `ledger.ts`, `econ.ts`, `books.ts`. Money is conserved; every transfer is a recorded transaction; weekly tick handles debts, kick-ups, businesses. `audit()`/`ledgerCheck()` verify consistency (tests rely on them).
- **Knowledge is a mechanic:** every event is a `Fact`; characters only know facts they witnessed or were told (`core.ts`, `p.known[f]`, `knowsActor`). Victims may guess culprits wrongly. Dialogue and boss jobs must respect this (e.g. a boss only offers a "deal with X" job once he knows who wronged you).
- **NPC autonomy & relationships:** `actions.ts` (options + scoring, retaliation with cooldowns `ret:beat/torch/hit`), `goals.ts`, `ambition.ts`, `crewlife.ts`, `revenge.ts`, `consequences.ts`, `disputes.ts`, `politics.ts`/`powers2.ts` (Commission, leaders’ settlements). Relationships are trust/respect/grudge per pair (`rel()`).
- **Commitments:** memos (promise/threat/agreement/question/favour), favours (`addFavour`), debts (`createDebt`, weekly payments, missed payments, collections), encounters (`encounters.ts`), jobs (`jobs.ts`, `orders.ts`), meetings and sit-downs (`meetings.ts`).
- **Organisations & careers:** `orgs.ts`, `rank.ts`, `career.ts`, clubs (`club.ts`), rackets, Sunday envelopes.
- **Conversation & negotiation:** `dialogue.ts` (intents, nodes, used-option memory, `say()`), `flows.ts` (standing, promotion, sit-downs, threats, crew management, recruitment, rival organisations), `negotiate.ts`, voices in `voice.ts`/`voicesheet.ts` (archetypes proud, bitter, schemer, earnest, hothead, cold, jovial, frightened). Rules: used options grey out and give no benefit until a new conversation; no repeated lines (`Convo.spoken`); no database language or internal numbers shown; rank changes authority and choices; NPCs disclose only what they plausibly know; counteroffers must have a stated reason grounded in finances/motives.
- **UI:** `web.ts` entry, `ui/*` views, `web/index.html` (page shell and CSS). Built by Vite (`vite.config.ts`, `vite-plugin-singlefile`) into one HTML file.

## Hard requirements
- **Save compatibility:** `serialize/deserialize` (SCHEMA 7). Never break loading of older saves; new fields must be optional with safe defaults; add migrations, never delete them. `src/tests/oldsave.test.ts` loads genuine old saves (`src/tests/fixtures/`, incl. a schema-2 save) – keep it passing and add a fixture whenever the schema changes.
- **Portraits must not change.** They are procedurally painted in `src/ui/portrait.ts` (`portraits_pack.ts` is an intentionally empty override slot). Do not modify portrait code or output.
- Preserve V72–V76 mechanics, the ledger, NPC information restrictions and the conversation overhaul.
- Don't add gameplay systems or change balance unless asked; report integration gaps instead of hiding them.

## Build / test / deploy
```
npm install
npm run typecheck
npm run test:all          # Vitest: every suite + schema migrations, in parallel
npx vitest run v73 -t ledger   # one suite (file name filter), one check (name filter)
npm run build             # -> dist/omerta.html
npm run dev               # live-reload dev server, http://localhost:5173
```
Tests are Vitest files (`src/tests/*.test.ts`, found by name; assertions are `node:assert`). Slow modes are opt-in via env: `COMPAT=1` (schema migrations, included in `test:all`), `SLOW=1` with `SEED`/`DAYS` (long simulations, `npm run test:slow`); see `src/tests/modes.ts` and `docs/05-testing.md`. Before shipping any change: typecheck + v77–v79 at minimum (`make test`), full `test:all` for anything touching sim, saves or economy. Deploy = publish `dist/omerta.html` (GitHub Pages `index.html` at https://agmkzy.github.io/omerta/; artifact https://claude.ai/artifact/YDyiAu7Aw8bZdwMjaBRVV3). Don’t poll with sleep loops; run long tests in the background.

## Playtesting
`playtest/pt.ts` drives the real sim from the command line with persistent state (`playtest/state.json`, `actions.log`). The V85 playtest used seed 3, “Tony Marino”, 35 days, no manual state edits. Judge gameplay by tracing consequences (action → recorded state → later behaviour), not by passing tests.

## Known limitations identified in the V85 playtest
Bugs: haggling with no reason accepts too easily (`tipReply`, encounters.ts ~787); loan text grammar (“It’s the car is finished…”); completed promises still listed in memos; generic capo reply to a beating; flat weekly-envelope prompt; presumptuous recall line.
Integration gaps: ignored promises are penalised less than failed ones; routine jobs saturate relationships too fast (boss trust ~0.99 by day 35); `w.goals` rarely visibly drives NPC behaviour; rival organisations never approached the player and no promotion occurred in 35 days; a save-size failure around day ~60 is undiscussed.
Confirmed working chains: favour owed → backing; beating → boss learns → boss job; grudge → retaliation → alibi favour; loans → weekly payments; broken word → later dialogue.
