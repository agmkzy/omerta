# OMERTÀ

Single-player sandbox mafia RPG set in 1970 New York. A deterministic, seeded simulation of three crime families, their crews, businesses, debts and grudges, played through a mobile-style UI that ships as **one self-contained HTML file** (`dist/omerta.html`). No server, no runtime AI.

Current version: **V85**.

## Requirements
- Node.js 26 or newer and npm (`.nvmrc` pins 26: `nvm install` picks it up).

## Quick start
```
make            # npm ci (if needed), typecheck, build dist/omerta.html
make dev        # dev server with live reload, http://localhost:5173
make help       # every target
```
Without make: `npm ci && npm run typecheck && npm run build`. Setup from scratch on a new machine: [docs/03-build-and-setup.md](docs/03-build-and-setup.md).

## Install
```
npm install
```

## Build the playable game
```
npm run build        # Vite bundles src/web.ts into web/index.html -> dist/omerta.html
```
Open `dist/omerta.html` in a browser. Saves go to the browser's storage.

While working on the UI, `make dev` (or `npm run dev`) serves the game at http://localhost:5173 and reloads the page on every save.

## Type-check and test
```
npm run typecheck                         # tsc --noEmit
npm run test:all                          # every test except the opt-in long runs, in parallel (Vitest)
npm run test:unit                         # only the unit tests, in seconds
npx vitest run economy                    # one system; add -t "<name>" for a single check
```
Tests are organised by game system under `src/tests/` (`architecture`, `saves/`, `hierarchy/`, `economy/`, `agency/`, `situations/`, `organisations/`, `dialogue/`, `creation/`, `determinism`) and tagged by kind (`unit`, `scenario`, `sim`, `determinism`, `compat`, `architecture`, `property`). Long simulations are opt-in: `npm run test:slow`. See [docs/05-testing.md](docs/05-testing.md).

## Other commands
```
npm run sim -- --seed 4 --days 180        # watch the world run without a player (CLI)
npm run play -- --new --seed 4            # legacy text interface
npm run playtest -- status                # unassisted-play harness (see playtest/pt.ts)
```

## Deploy
The game is a static file. Copy `dist/omerta.html` to `index.html` of any static host. The existing deployment is at https://agmkzy.github.io/omerta/ (hosting setup not verified from the migration session; check it before changing anything). A copy is also published as a Claude artifact. Do not change hosting configuration as part of unrelated work.

## Documentation
- [`docs/README.md`](docs/README.md) – start here: stack, saves and compatibility, build, architecture, testing, deployment, guidelines, framework migration, and a per-system [engine reference](docs/engine/README.md).
- `CLAUDE.md` – project context and rules for Claude Code.
- `HANDOFF.md` – state at V85, known issues, open items.
- `docs/` also holds the binding specs (conversation overhaul, final regression/playtest brief), the pre-V72 architecture audit, earlier version reports and the original README.
- Known bugs are tracked in the [V85 baseline review](https://github.com/agmkzy/omerta/milestone/1) milestone.
