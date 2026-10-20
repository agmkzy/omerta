# Build system and setup

## The pipeline

```
src/**/*.ts ──┐
              │  tsc --noEmit           (npm run typecheck)   types only, emits nothing
              │
src/web.ts ───┴─ esbuild --bundle --format=iife --minify --target=es2020
                        │
                        ▼
                  dist/web.js           (intermediate, git-ignored)
                        │  guard: fail if the bundle contains "</script"
                        ▼
web/template.html ── cp ──► dist/omerta.html ◄── append "<script>" + dist/web.js + "</script>"
                                     │
                                     ├─► index.html            (manual copy, GitHub Pages)
                                     └─► claude.ai artifact    (manual publish)
```

[build-web.sh](../build-web.sh), in full:

1. `esbuild src/web.ts --bundle --format=iife --minify --target=es2020 --outfile=dist/web.js`. Everything reachable from `web.ts` goes into one immediately-invoked function. It has no runtime dependencies, so nothing external is bundled.
2. Refuse to continue if the bundle contains the text `</script`, which would end the inline script early.
3. Copy `web/template.html` (the page shell: meta tags, all CSS, `<div id="app">`) to `dist/omerta.html`, then append the bundle inside a `<script>` tag.

`npm run build` sets `ESBUILD=./node_modules/.bin/esbuild` so the local devDependency is used.

**Properties:**

- **Fast.** esbuild takes about 15 ms. The whole build is well under a second.
- **Deterministic.** Rebuilding an unchanged tree produces a byte-identical `dist/omerta.html` (verified: a rebuild on a clean checkout leaves `git status` clean).
- **No type checking during the build.** esbuild strips types without checking them. `npm run typecheck` is a separate step, and the Makefile's default target runs both.
- **No source maps, no hashing, no code splitting.** These would contradict the single-file goal.

Nothing else is built. Tests, the CLI and the playtest harness run straight from TypeScript with `tsx`.

## Tooling

| Tool | Version (lockfile) | Used for |
| --- | --- | --- |
| Node.js | 22 LTS or newer ([.nvmrc](../.nvmrc)). Verified on 25.8 | Running `tsx`, `tsc`, `esbuild` |
| npm | Ships with Node | Installing from `package-lock.json` |
| TypeScript | ^5.6 | `tsc --noEmit` |
| tsx | ^4.19 | Running `.ts` directly (tests, CLI, playtest) |
| esbuild | ^0.28.2 | Bundling |
| @types/node | ^22 | Types for tests/CLI (`node:assert`, `node:fs`) |
| make | Any POSIX make (macOS/Linux built-in) | Optional convenience wrapper |
| sh, cp, grep, cat | POSIX | Used by `build-web.sh` |

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

Use WSL2 (Ubuntu) and follow the Linux steps. Native Windows can run `npm ci`, `npm run typecheck` and the tests, but `npm run build` calls `sh build-web.sh`, which needs Git Bash or WSL.

### Without make

```bash
npm ci && npm run typecheck && npm run build
```

### Check the setup

```bash
make test
```

`make test` runs the minimum pre-ship check from CLAUDE.md: a typecheck plus the v77–v79 conversation suites, in about a minute. Use `make test-all` for the full suite, which takes several minutes.

## The Makefile

[Makefile](../Makefile) at the repository root. Every target goes through the npm scripts, so `make` and `npm run …` never drift apart. `make help` lists the targets.

| Target | Does |
| --- | --- |
| `make` / `make all` | `install` (only if `package.json`/`package-lock.json` changed), then `typecheck`, then `build` |
| `make check-node` | Fails with a clear message unless Node ≥ 22 and npm are on the PATH |
| `make install` | `npm ci`. It uses `node_modules/.package-lock.json` as a stamp, so it is a no-op when nothing changed |
| `make typecheck` | `npm run typecheck` |
| `make build` | `npm run build`. It only rebuilds when a source `.ts` file, `web/template.html` or `build-web.sh` is newer than `dist/omerta.html` |
| `make test` | Typecheck plus v77, v78 and v79 (fast) |
| `make test-all` | Typecheck plus `npm run test:all` (storage, v72–v79, oldsave, determinism) |
| `make test-compat` | The synthetic migration checks in v73/v74/v75 (`compat` mode), which `test:all` does not run |
| `make test-sim SEED=3 DAYS=180` | Long v74/v75 simulations for one seed |
| `make ci` | `all` + `test-all` + `test-compat`. This is what CI runs |
| `make pages` | Build, then copy `dist/omerta.html` to `index.html` for GitHub Pages |
| `make play` / `make sim` | The terminal interface and the unattended simulation ([cli.ts](../src/cli.ts)) |
| `make playtest ARGS="status"` | The command-line playtest harness. **Currently broken outside the original environment:** [playtest/pt.ts](../playtest/pt.ts) hardcodes `DIR = '/home/claude/omerta/playtest'` |
| `make open` | Build, then open the game in the default browser |
| `make clean` / `make distclean` | Remove `dist/web.js` / also remove `node_modules`. The committed `dist/omerta.html` is kept |

Design notes:

- **`npm ci`, not `npm install`.** A fresh setup gets exactly the locked versions and never rewrites `package-lock.json`.
- **Real file targets** (`$(STAMP)`, `$(DIST)`) mean a second `make` does almost nothing. Only `typecheck` re-runs, because type errors can come from any file.
- `check-node` is an order-only prerequisite of the install stamp, so it runs before the first install without forcing reinstalls.

## npm scripts reference

| Script | Command |
| --- | --- |
| `typecheck` | `tsc --noEmit` |
| `build` | `ESBUILD=./node_modules/.bin/esbuild sh build-web.sh` |
| `test` | `tsx src/test.ts`: determinism, save round trip, multi-seed sanity |
| `test:all` | `storage`, `v72` … `v79` (each `fast`), then `oldsave`, then `test.ts`. It stops at the first failing suite |
| `test:v72` / `test:v73` / `test:v74` | Single version suites. v73/v74 include `compat` mode |
| `sim` | `tsx src/cli.ts sim`, for example `npm run sim -- --seed 4 --days 180` |
| `play` | `tsx src/cli.ts play`, for example `npm run play -- --new --seed 4` (legacy text UI, saves to `omerta-save.json`) |
| `bot` | `tsx src/bot.ts <seed> <days>`: a random-policy player used as a smoke test |
| `playtest` | `tsx playtest/pt.ts …` (see the note about the hardcoded path above) |

## Known build gaps

- `tsconfig.json` includes only `src/`, so **`playtest/pt.ts` is never typechecked**.
- There is no linter or formatter configuration. The code style is consistent by convention only (see [07-guidelines.md](07-guidelines.md)).
- `build-web.sh` needs a POSIX shell. A ~20-line Node script (`scripts/build.mjs` using esbuild's JS API) would make the build cross-platform with no new dependencies.
- `dist/web.js` is git-ignored but `dist/omerta.html` is committed. See [06-deployment.md](06-deployment.md#are-the-dist-files-committed) for why and the recommendation.
