# OMERTÀ documentation

Developer documentation for the V85 codebase. New here? Read [CLAUDE.md](../CLAUDE.md) (what the game is, plus the hard rules), then [01-stack.md](01-stack.md) and [04-architecture.md](04-architecture.md). Then go to the [engine reference](engine/README.md) for whichever system you're about to touch.

## Contents

| Doc | What it covers |
| --- | --- |
| [01-stack.md](01-stack.md) | What it's built with and why, the cons, scaling hurdles (with measurements), global state, reactivity |
| [02-state-saves-and-compatibility.md](02-state-saves-and-compatibility.md) | The `World` object, serialisation, browser storage, export and import, cloud backup, Pinia, migrations and backwards compatibility, save size |
| [03-build-and-setup.md](03-build-and-setup.md) | The build pipeline, setting up a new machine, the [Makefile](../Makefile), npm scripts |
| [04-architecture.md](04-architecture.md) | Layers, how the engine is driven, how systems talk, the measured dependency graph and its cycle, guard-rails against tangling, swapping a system |
| [05-testing.md](05-testing.md) | Suites and what they cover, timings, coverage, the CI workflow, writing tests |
| [06-deployment.md](06-deployment.md) | Current hosting, why build output is committed, recommended GitHub Pages and Actions setup, DigitalOcean App Platform and other PaaS, release checklist |
| [07-guidelines.md](07-guidelines.md) | Design and engineering rules, single doors, code style, the PR checklist, enforcement ideas |
| [08-framework-migration.md](08-framework-migration.md) | Viability of Vue, Vitest, Vite and Pinia, with a step-by-step plan and a store sketch |
| [engine/](engine/README.md) | Per-system reference: purpose, state owned, public API, ticks, dependencies, invariants, known issues, replacement notes |

## The questions in issue #1, answered

| Question | Answer in |
| --- | --- |
| What tech is it built with? Why? | [01-stack.md: What it is built with](01-stack.md#what-it-is-built-with), [Why this stack](01-stack.md#why-this-stack) |
| Cons of the current stack? Hurdles as it grows? | [01-stack.md: Cons](01-stack.md#cons-of-the-current-stack), [Hurdles](01-stack.md#where-the-hurdles-will-be-as-the-project-grows) |
| Viability of Vue + Vitest? | [08-framework-migration.md](08-framework-migration.md) (summary in [01-stack.md](01-stack.md#viability-of-switching-to-vue--vitest--pinia)) |
| How is global state stored? | [01-stack.md](01-stack.md#how-global-state-is-stored), [02: In-memory state](02-state-saves-and-compatibility.md#1-in-memory-state) |
| How does the save system work? | [02: Serialisation](02-state-saves-and-compatibility.md#2-serialisation), [Browser persistence](02-state-saves-and-compatibility.md#3-browser-persistence) |
| Can saves be exported? Backed up to the cloud? | [02: Export, import and cloud backup](02-state-saves-and-compatibility.md#4-export-import-and-cloud-backup) |
| Could saves load from a localStorage backup into Pinia? | [02 §5](02-state-saves-and-compatibility.md#5-could-the-save-system-load-a-localstorage-backup-into-a-pinia-store), [08: Pinia and the world](08-framework-migration.md#4-pinia-and-the-world) |
| How is reactivity handled? | [01-stack.md](01-stack.md#how-reactivity-is-handled-today), [engine/08: Rendering model](engine/08-ui-and-entry-points.md#rendering-model) |
| What's the build pipeline? | [03-build-and-setup.md](03-build-and-setup.md#the-pipeline) |
| How to set up from scratch? | [03-build-and-setup.md](03-build-and-setup.md#setting-up-from-scratch-on-a-new-machine) |
| A Makefile that sets everything up and builds | [Makefile](../Makefile), documented in [03](03-build-and-setup.md#the-makefile) |
| Each system and its public API | [engine/](engine/README.md) |
| How do the systems connect? | [04-architecture.md](04-architecture.md#how-systems-talk-to-each-other), plus "How this group connects" in each engine doc |
| How do we stop it becoming a tangled mess? | [04-architecture.md](04-architecture.md#how-are-we-guaranteeing-these-systems-wont-become-a-tangled-mess) |
| What testing framework? Coverage targets? | [05-testing.md](05-testing.md) |
| Is there a GitHub Actions test runner (free tier)? | [05-testing.md](05-testing.md#is-there-a-github-actions-test-runner), [.github/workflows/ci.yml](../.github/workflows/ci.yml) |
| How is save backwards compatibility maintained? Will a new version wipe progress? | [02 §6](02-state-saves-and-compatibility.md#6-backwards-compatibility-will-a-new-version-wipe-progress) |
| Are dist files committed? Why? | [06-deployment.md](06-deployment.md#are-the-dist-files-committed) |
| Ideal deployment (DigitalOcean, App Platform, PaaS, build on deploy) | [06-deployment.md](06-deployment.md) |
| Clean code and best-practice guidelines | [07-guidelines.md](07-guidelines.md) |
| Can a main system be swapped for a new one with the same API? | [04-architecture.md](04-architecture.md#is-it-possible-to-swap-out-a-main-system-for-a-new-version-that-keeps-its-public-api), plus "Replacing this system" in each engine doc |

## Bugs found while writing this

Every bug found while documenting the code was checked against the source and filed in the **[V85 baseline review](https://github.com/agmkzy/omerta/milestone/1)** milestone, with `area:`, `severity:` and `invariant:` labels. The engine docs' "Known issues" sections describe them in context.

## Historical and binding documents

These are kept as they were. Some predate V72–V85, so check claims against the code.

| Doc | Status |
| --- | --- |
| [SPEC_conversation_overhaul.txt](SPEC_conversation_overhaul.txt) | **Binding** spec for conversation (see [engine/07](engine/07-conversation.md#spec-rules-and-where-they-are-enforced)) |
| [BRIEF_final_regression_and_playtest.txt](BRIEF_final_regression_and_playtest.txt) | **Binding** brief for regression and playtest |
| [AUDIT.md](AUDIT.md) | Architecture audit written before V72; several of its critical findings have since been addressed (save safety, retention, single money doors, organisations) |
| [V72_REPORT.md](V72_REPORT.md) … [V75_REPORT.md](V75_REPORT.md) | Version reports |
| [HISTORY_early_README.md](HISTORY_early_README.md) | The original README (text-only prototype) |
| [6d0b39a4-attachment.txt](6d0b39a4-attachment.txt) | The owner's feedback that led to the V78 conversation layers ("a conversation should unfold naturally, rather than expose the underlying simulation") |
