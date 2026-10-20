# Build system and setup

## The pipeline

```
src/**/*.ts, web/, vite.config.ts
              │  tsc --noEmit           (npm run typecheck)   types only, emits nothing
              │
web/index.html ── <script type="module" src="./main.ts"> ── import '../src/web'
              │
              │  vite build             (npm run build)
              │    Rolldown bundles everything reachable from src/web.ts into one ES module,
              │    minified by Oxc for es2020
              │  omerta:single-page moves the entry <script> to the end of the page (after #app)
              │  vite-plugin-singlefile inlines it there as <script type="module">
              │  omerta:single-page then fails the build unless the output is one HTML file with
              │    one inline script and <meta charset> in its first 1024 bytes
              ▼
       dist/omerta.html
              ├─► index.html            (manual copy, GitHub Pages)
              └─► claude.ai artifact    (manual publish)
```

[vite.config.ts](../vite.config.ts) does the following:

1. **Root is `web/`.** [web/index.html](../web/index.html) is the page shell (title, meta tags, the Google Fonts link, all CSS, `<div id="app">`). The repository root is not used as Vite's root because its `index.html` is the GitHub Pages copy of the build.
2. **Entry is [web/main.ts](../web/main.ts)**, a one-line `import '../src/web'`. Pointing the HTML straight at `../src/web.ts` builds, but the dev server can't serve it: the browser resolves the URL against `/` and asks for `/src/web.ts`, which is outside the root. A module import is resolved on the filesystem, so it works in both.
3. **`vite-plugin-singlefile`** inlines the bundle into the HTML and escapes `</script>` and `<!--` inside it (as `\x3C…`). Its `outputFileName` option writes `dist/omerta.html` rather than `dist/index.html`. It also sets `base: './'` and turns off code splitting.
4. **`omerta:single-page`** is a small plugin in the config. It does two jobs:
   - **It moves the script to the end of the page.** Vite puts the entry script first, ahead of `<meta charset="utf-8">`. Once 1 MB of code is inlined there, the charset declaration is no longer in the first 1024 bytes, which is the only place browsers look for it. Unlike esbuild, Rolldown writes non-ASCII characters (`→`, `’`) as raw UTF-8, so when the server sends no charset (`file://`, a plain static server), the browser guesses, and it can guess windows-1252, which garbles the text. This happened in testing. GitHub Pages sends `charset=utf-8`, so it was never affected.
   - **It checks the result.** `vite-plugin-singlefile` only warns about files it couldn't inline, so this plugin fails the build unless the output is exactly `omerta.html` with one inline `<script>`, no `src=`, and `<meta charset="utf-8">` in the first 1024 bytes. It replaces the old `</script` guard in `build-web.sh`.
5. **`cssMinify: false`.** The hand-written CSS ships exactly as authored. Minifying it would save about 3 KB on a 1.07 MB page, but Lightning CSS also rewrites rules (it adds prefixes and merges declarations), so the page shell would no longer match `web/index.html`.
6. **`target: 'es2020'`** keeps the language level the esbuild build used. **`modulePreload.polyfill: false`** stops a preload polyfill being inlined into a single-chunk page.

**Properties:**

- **Fast.** `vite build` takes about 0.1 s.
- **Deterministic.** Rebuilding an unchanged tree produces a byte-identical `dist/omerta.html`.
- **The page shell is copied byte for byte.** Everything outside the inline script is identical to `web/index.html`, and the script sits at the end of the page, after `#app`, as it did in the esbuild build. It's a module script, so it runs once the document has been parsed.
- **No doctype is added.** The shell has none, so the page still renders in quirks mode outside claude.ai, just as before (see [engine/08-ui-and-entry-points.md](engine/08-ui-and-entry-points.md#webindexhtml)).
- **No type checking during the build.** Vite strips types without checking them. `npm run typecheck` is a separate step, and the Makefile's default target runs both.
- **No source maps, no hashing, no code splitting.** These would contradict the single-file goal.

Nothing else is built. The tests run under Vitest, which compiles TypeScript itself and reads [vitest.config.ts](../vitest.config.ts), not `vite.config.ts` (see [05-testing.md](05-testing.md)). The CLI, the measurement scripts and the playtest harness run straight from TypeScript with `tsx`.

### The dev server

```bash
make dev
```

This (or `npm run dev`) serves the game at http://localhost:5173 and reloads the page whenever a file under `src/` or `web/` changes. A reload resumes from the localStorage save, so you stay where you were. It's a full reload, not hot module replacement, because the UI keeps its state in the module-level `S` and isn't written for HMR. The dev server's origin differs from `file://`, GitHub Pages and the artifact, so it has its own saves.

`make preview` builds if needed, then serves `dist/omerta.html` over HTTP at http://localhost:4173 and opens it in the browser. Use it to check a production build. `dist/` has no `index.html`, so a small plugin in `vite.config.ts` (`omerta:preview-at-root`) answers `/` with the page. Without it, the address Vite prints would return a 404. `/omerta.html` also works.

## Tooling

| Tool | Version (lockfile) | Used for |
| --- | --- | --- |
| Node.js | 26 ([.nvmrc](../.nvmrc), the newest line, LTS from late October 2026; `engines` in package.json says `>=26`, and `make check-node` refuses anything older). Vite 8 needs `^20.19 \|\| >=22.12`, Vitest 5 `^22.12 \|\| ^24 \|\| >=26` | Running `tsx`, `tsc`, `vite`, `vitest` |
| npm | 11, shipped with Node 26 | Installing from `package-lock.json`. It skips dependency install scripts unless `allowScripts` in package.json approves them (see below) |
| TypeScript | ^5.6 | `tsc --noEmit` |
| tsx | ^4.19 | Running `.ts` directly (CLI, measurement scripts, playtest) |
| Vite | ^8.3 | Bundling (Rolldown, Oxc minifier) and the dev server |
| vite-plugin-singlefile | ^2.3 | Inlining the bundle into one HTML file |
| Vitest | ^5.0 | The test runner ([vitest.config.ts](../vitest.config.ts)) |
| @vitest/coverage-v8 | ^5.0 | Coverage for `npm run test:cov` |
| @types/node | ^26 | Types for tests/CLI (`node:assert`, `node:fs`), matching the Node version |
| make | Any POSIX make (macOS/Linux built-in) | Optional convenience wrapper |

## Setting up from scratch on a new machine

### macOS

```bash
xcode-select --install
```

```bash
brew install nvm
```

Follow brew's printed instructions to add nvm to your shell, then:

```bash
git clone https://github.com/agmkzy/omerta.git
```

```bash
cd omerta && nvm install && nvm use
```

```bash
make
```

`make` installs dependencies exactly as locked (`npm ci`), typechecks, and writes `dist/omerta.html`. Open that file in a browser, or run `make open`.

### Linux (Debian/Ubuntu)

```bash
sudo apt-get update && sudo apt-get install -y git make curl
```

```bash
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
```

Restart the shell, then:

```bash
git clone https://github.com/agmkzy/omerta.git && cd omerta && nvm install && make
```

### Windows

Use WSL2 (Ubuntu) and follow the Linux steps. The build no longer needs a POSIX shell, so native Windows should be able to run `npm ci`, `npm run typecheck`, `npm run build`, `npm run dev` and `npm test` (not tested). Only `npm run test:slow` sets an environment variable the POSIX way (`SLOW=1 vitest run`), and `make` needs a POSIX environment, so those still need Git Bash or WSL (or set `SLOW=1` first and run `npx vitest run`).

### Without make

```bash
npm ci && npm run typecheck && npm run build
```

### Check the setup

```bash
make test
```

`make test` runs the minimum pre-ship check from CLAUDE.md: a typecheck plus the conversation tests (`src/tests/dialogue/`), in about ten seconds on a recent laptop. Use `make test-all` for everything, which takes under a minute.

## The Makefile

[Makefile](../Makefile) at the repository root. Every target goes through the npm scripts, so `make` and `npm run …` never drift apart. `make help` lists the targets.

| Target | Does |
| --- | --- |
| `make` / `make all` | `install` (only if `package.json`/`package-lock.json` changed), then `typecheck`, then `build` |
| `make check-node` | Fails with a clear message unless Node ≥ 26.0 (`.nvmrc`) and npm are on the PATH |
| `make install` | `npm ci`. It uses `node_modules/.package-lock.json` as a stamp, so it is a no-op when nothing changed |
| `make typecheck` | `npm run typecheck` |
| `make build` | `npm run build`. It only rebuilds when a source `.ts` file, `web/index.html`, `web/main.ts` or `vite.config.ts` is newer than `dist/omerta.html` |
| `make dev` | `npm run dev`: the Vite dev server with live reload on http://localhost:5173. Extra Vite flags go in `ARGS`, for example `make dev ARGS=--host` to open the game from a phone on the same network |
| `make preview` | Build if needed, then `npm run preview`: serves `dist/omerta.html` over HTTP and opens it in the browser |
| `make test` | Typecheck plus the conversation tests (`npm test -- src/tests/dialogue`) |
| `make test-unit` | Only the tests tagged `unit` (about 6 s) |
| `make test-all` | Typecheck plus `npm run test:all`: every test in `src/tests/` except the opt-in long runs, in parallel |
| `make test-compat` | Only the save-compatibility tests, every test tagged `compat` (also part of `test-all`) |
| `make test-sim SEED=3 DAYS=180` | The long simulations, every test tagged `sim` and `slow`, for one seed (or a list: `SEED=3,7`) |
| `make test-slow SEED=3` | Every long run (tagged `slow`): stability, sims, round trips, save growth, the trace of the player's road to boss, the full seed set for backgrounds |
| `make test-cov` | `test-all` with coverage. It fails below the thresholds in `vitest.config.ts`, and writes an HTML report to `coverage/`. CI doesn't run it |
| `make ci` | `all` + `test-all`: typecheck, build and every test except the opt-in long runs. This is what CI checks |
| `make pages` | Build, then copy `dist/omerta.html` to `index.html` for GitHub Pages |
| `make play` / `make sim` | The terminal interface and the unattended simulation ([cli.ts](../src/cli.ts)) |
| `make bot SEED=3 DAYS=120` | The random-policy player smoke test ([bot.ts](../src/bot.ts)) |
| `make playtest ARGS="status"` | The command-line playtest harness. **Currently broken outside the original environment:** [playtest/pt.ts](../playtest/pt.ts) hardcodes `DIR = '/home/claude/omerta/playtest'` |
| `make open` | Build, then open the game in the default browser |
| `make clean` / `make distclean` | Remove Vite's cache (`node_modules/.vite`) / also remove `node_modules`. The committed `dist/omerta.html` is kept |

Design notes:

- **`npm ci`, not `npm install`.** A fresh setup gets exactly the locked versions and never rewrites `package-lock.json`.
- **Dependency install scripts are reviewed, not run blindly.** npm 11 blocks them unless `allowScripts` in package.json lists the package. Two dependencies have one, and neither needs it: `esbuild`'s `postinstall` only double-checks its native binary, which arrives as its own package (`@esbuild/darwin-arm64` and the like), and `fsevents` ships a prebuilt `fsevents.node`. Both are recorded as denied (`"esbuild": false`, `"fsevents": false`). If an update brings a new one, `npm ci` names it: read the script, then `npm install-scripts approve <pkg>` or `npm install-scripts deny <pkg>`.
- **Real file targets** (`$(STAMP)`, `$(DIST)`) mean a second `make` does almost nothing. Only `typecheck` re-runs, because type errors can come from any file.
- `check-node` is an order-only prerequisite of the install stamp, so it runs before the first install without forcing reinstalls.

## npm scripts reference

| Script | Command |
| --- | --- |
| `typecheck` | `tsc --noEmit` |
| `dev` | `vite`: dev server with live reload (see [The dev server](#the-dev-server)) |
| `build` | `vite build` → `dist/omerta.html` |
| `preview` | `vite preview`: serves `dist/omerta.html` at http://localhost:4173 and opens it |
| `test` | `vitest run`: every test in `src/tests/` except the opt-in long runs (tagged `slow`). All files run in parallel, and a failure doesn't stop the others. Extra arguments filter, for example `npm test -- economy -t ledger` |
| `test:all` | The same as `test` (kept because the docs and habits use it) |
| `test:unit` | `vitest run --tagsFilter unit`: only the unit tests |
| `test:compat` | `vitest run --tagsFilter compat`: only the save-compatibility tests |
| `test:slow` | `SLOW=1 vitest run`: everything, including the long simulations (`SEED`, `DAYS`) |
| `test:watch` | `vitest`: re-runs the affected suites on every change |
| `test:cov` | `vitest run --coverage`: `test:all` with coverage and thresholds |
| `sim` | `tsx src/cli.ts sim`, for example `npm run sim -- --seed 4 --days 180` |
| `play` | `tsx src/cli.ts play`, for example `npm run play -- --new --seed 4` (legacy text UI, saves to `omerta-save.json`) |
| `bot` | `tsx src/bot.ts <seed> <days>`: a random-policy player used as a smoke test |
| `playtest` | `tsx playtest/pt.ts …` (see the note about the hardcoded path above) |

## Known build gaps

- `tsconfig.json` includes `src/`, `web/` and `vite.config.ts` but not `playtest/`, so **`playtest/pt.ts` is never typechecked**.
- There is no linter or formatter configuration. The code style is consistent by convention only (see [07-guidelines.md](07-guidelines.md)).
- `dist/omerta.html` is committed. See [06-deployment.md](06-deployment.md#are-the-dist-files-committed) for why and the recommendation.
