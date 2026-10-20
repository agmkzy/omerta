# OMERTÀ

Single-player sandbox mafia RPG set in 1970 New York. A deterministic, seeded simulation of three crime families, their crews, businesses, debts and grudges, played through a mobile-style UI that ships as **one self-contained HTML file** (`dist/omerta.html`). No server, no runtime AI.

Current version: **V85**.

## Requirements
- Node.js 22 (any recent LTS should work) and npm.

## Install
```
npm install
```

## Build the playable game
```
npm run build        # esbuild bundles src/web.ts + web/template.html -> dist/omerta.html
```
Open `dist/omerta.html` in a browser. Saves go to the browser's storage.

## Type-check and test
```
npm run typecheck                         # tsc --noEmit
npm run test:all                          # storage, v72–v79, old-save compatibility, legacy test
npx tsx src/tests/v77.test.ts fast        # a single suite
```
Suites: `storage` (save/load safety), `v72`–`v76` (simulation, economy ledger, NPC autonomy, careers, clubs), `v77`–`v79` (conversation overhaul: crawler, no repeated lines, no internal-data leaks, memory across save/load), `oldsave` (loads genuine older saves from `src/tests/fixtures/`). `v74` and `v75` are slow.

## Other commands
```
npm run sim -- --seed 4 --days 180        # watch the world run without a player (CLI)
npm run play -- --new --seed 4            # legacy text interface
npm run playtest -- status                # unassisted-play harness (see playtest/pt.ts)
```

## Deploy
The game is a static file. Copy `dist/omerta.html` to `index.html` of any static host. The existing deployment is at https://agmkzy.github.io/omerta/ (hosting setup not verified from the migration session; check it before changing anything). A copy is also published as a Claude artifact. Do not change hosting configuration as part of unrelated work.

## Documentation
- `CLAUDE.md` – project context and rules for Claude Code.
- `HANDOFF.md` – state at V85, known issues, open items.
- `docs/` – the binding specs (conversation overhaul, final regression/playtest brief), the architecture audit, earlier version reports and the original README.
