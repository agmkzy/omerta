# OMERTÀ – handoff (state at Version 85)

## What it is
Single-player sandbox mafia RPG, 1970s New York. Utility-AI world (3 families, ~30+ named characters, shops, rackets, loans), knowledge-as-mechanic (characters only know facts they witnessed or were told), real debts, favours, promises, grudges. Player is an associate of the Corrente family. Output is one HTML file, `dist/omerta.html`.
Live: Claude artifact https://claude.ai/artifact/YDyiAu7Aw8bZdwMjaBRVV3 (V85) and https://agmkzy.github.io/omerta/ (GitHub Pages; copy `dist/omerta.html` to `index.html` there).

## Setup
`npm install && npm run build && npm run test:all`
Node 22.12+. The build is Vite (`vite.config.ts`, `npm run dev` for a live-reload server); it replaced the V85 esbuild script `build-web.sh`.

## Layout
- `src/` engine and game logic (`engine.ts` tick, `world.ts` generation, `core.ts` relationships, `actions.ts` NPC choices incl. retaliation, `jobs.ts`, `encounters.ts`, `career.ts`, `consequences.ts`, `crewlife.ts`, `situations.ts`, `ledger.ts`/`econ.ts` money).
- Dialogue: `dialogue.ts` (options, nodes, used-option memory, `say()`), `flows.ts` (standing, promotion, sit-downs, threats, crew, recruitment, rivals), `voice.ts`/`voicesheet.ts` (archetype voices).
- UI: `src/web.ts` (entry), `src/ui/*` views, `web/index.html` (page shell/CSS, Vite's entry).
- `src/storage.ts` saves; `serialize/deserialize` in the world code (SCHEMA 7).
- `src/tests/` regression suites: storage, v72–v79 (v77–v79 = conversation overhaul crawler/info-leak/memory tests).
- `playtest/pt.ts` command-line harness for unassisted play (`state.json`, `actions.log`; seed 3, "Tony Marino", reached day 35). `npx tsx playtest/pt.ts status|talk <name>|do <code>|wait <n>|leave|…`
- `docs/` the owner's binding specs: conversation overhaul spec, final regression/playtest brief.
- Earlier reports and the original README are in `docs/`.

## Status
- Regression: storage, v72–v79 all pass; tsc clean; V85 published.
- Conversation overhaul (18-section spec) implemented incl. standing/promotion/threat/crew/recruit/rival flows.

## Known issues / next work (from the final report)
Bugs: haggling with no reason accepts too easily (`tipReply`, encounters.ts ~787); loan text grammar ("It’s the car is finished…"); completed promises still listed in memos; generic capo reply to a beating; flat weekly-envelope prompt; presumptuous recall line.
Integration: ignored promises penalised less than failed ones; routine jobs saturate relationships too fast (Louie trust ~0.99 by day 35); NPC goals store (`w.goals`) rarely visibly drives behaviour; rivals never approached the player in 35 days; no promotion occurred.
Open: save-size failure around day ~60 (undiscussed); old-save check now exists (`oldsave.test.ts`); stale preview artifact XCtjtUGmhoQwMCzM9pvSQE can be deleted.

## Working style the owner expects
Autonomous execution, honest reporting (don't call tests passing "compelling gameplay"), don't add systems quietly, never poll with sleep loops.
