# OMERTÀ – one-command setup, build and test.
#
#   make            install dependencies (if needed), typecheck, build dist/omerta.html
#   make dev        Vite dev server with live reload (http://localhost:5173)
#   make help       list every target
#
# Everything goes through the npm scripts in package.json, so `make` and `npm run …` never disagree.
# See docs/03-build-and-setup.md for the pipeline this drives.

NODE_MIN  := 22.12
NPM       := npm
STAMP     := node_modules/.package-lock.json
DIST      := dist/omerta.html
SRC       := $(shell find src -name '*.ts' -not -path 'src/tests/*') web/index.html web/main.ts vite.config.ts

.DEFAULT_GOAL := all
.PHONY: all help check-node install typecheck build test test-unit test-all test-compat test-sim test-slow test-cov pages dev preview play sim bot playtest open clean distclean ci

all: install typecheck build ## Install deps if needed, typecheck, build dist/omerta.html

help: ## List targets
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[1m%-13s\033[0m %s\n", $$1, $$2}'

check-node: ## Fail early unless Node (see NODE_MIN) and npm are installed
	@command -v node >/dev/null 2>&1 || { echo "Node.js is not installed. Install Node $(NODE_MIN) LTS (e.g. 'nvm install' reads .nvmrc)."; exit 1; }
	@command -v $(NPM) >/dev/null 2>&1 || { echo "npm is not installed (it ships with Node.js)."; exit 1; }
	@node -e 'const [m, n] = process.versions.node.split(".").map(Number), [rm, rn] = "$(NODE_MIN)".split(".").map(Number); if (m < rm || (m === rm && n < rn)) { console.error("Node " + process.versions.node + " found; $(NODE_MIN) or newer is required (Vite needs it)."); process.exit(1) }'

# npm ci installs exactly what package-lock.json records and writes node_modules/.package-lock.json,
# which we use as the stamp so dependencies are only reinstalled when the manifest or lockfile change.
$(STAMP): package.json package-lock.json | check-node
	$(NPM) ci
	@touch $(STAMP)

install: $(STAMP) ## Install dependencies from package-lock.json (npm ci)

typecheck: install ## tsc --noEmit over src/, web/ and vite.config.ts
	$(NPM) run typecheck

$(DIST): $(STAMP) $(SRC)
	$(NPM) run build

build: $(DIST) ## Vite: bundle src/web.ts into web/index.html -> dist/omerta.html

# The tests run under Vitest (vitest.config.ts): src/tests/<system>/*.test.ts, found by name and tagged by kind (src/tests/tags.ts).
# See docs/05-testing.md.
test: typecheck ## Minimum pre-ship check: typecheck + the conversation tests (src/tests/dialogue/)
	$(NPM) test -- src/tests/dialogue

test-unit: install ## Only the unit tests (seconds): every test tagged unit
	$(NPM) run test:unit

test-all: typecheck ## Full regression: every test except the opt-in long runs, in parallel
	$(NPM) run test:all

test-compat: install ## Only the save-compatibility tests (real old saves and synthetic migrations; also part of test-all)
	$(NPM) run test:compat

test-sim: install ## The long simulations (tagged sim and slow): make test-sim SEED=3 DAYS=180 (SEED may be a list: SEED=3,7)
	SEED=$(or $(SEED),3) DAYS=$(or $(DAYS),180) $(NPM) run test:slow -- --tagsFilter 'sim && slow'

test-slow: install ## Everything, including every long run (stable, sim, roundtrip, growth): make test-slow SEED=3
	SEED=$(or $(SEED),3) DAYS=$(or $(DAYS),180) $(NPM) run test:slow

test-cov: install ## test-all with coverage of src/ (fails below the thresholds in vitest.config.ts); HTML report in coverage/. Not run in CI
	$(NPM) run test:cov

ci: all test-all ## What the CI workflow checks (typecheck, build, every test except the opt-in long runs)

pages: build ## Copy the build to index.html (the GitHub Pages entry point)
	cp $(DIST) index.html
	@echo "index.html updated – commit it to publish on GitHub Pages"

dev: install ## Vite dev server with live reload (http://localhost:5173). On a phone: make dev ARGS=--host
	$(NPM) run dev -- $(ARGS)

preview: build ## Serve the built dist/omerta.html over HTTP and open it (vite preview)
	$(NPM) run preview -- $(ARGS)

play: install ## Play in the terminal (src/cli.ts play)
	$(NPM) run play

sim: install ## Run an unattended simulation and print the report (src/cli.ts sim)
	$(NPM) run sim

bot: install ## Random-policy player smoke test: make bot SEED=3 DAYS=120 (src/bot.ts)
	$(NPM) run bot -- $(or $(SEED),3) $(or $(DAYS),120)

playtest: install ## Command-line playtest harness: make playtest ARGS="status"
	npx tsx playtest/pt.ts $(ARGS)

open: build ## Open the built game in the default browser
	@{ command -v open >/dev/null && open $(DIST); } || { command -v xdg-open >/dev/null && xdg-open $(DIST); } || echo "Open $(DIST) in a browser"

clean: ## Remove Vite's cache (keeps the committed dist/omerta.html)
	rm -rf node_modules/.vite

distclean: clean ## Also remove node_modules
	rm -rf node_modules
