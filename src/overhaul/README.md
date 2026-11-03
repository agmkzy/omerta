# Overhaul

Code built apart from the game, to be slotted into it later. Each folder here is one plan from [docs/overhaul/plans/](../../docs/overhaul/plans/README.md), and its tests are in the matching folder under [tests/overhaul/](../../tests/overhaul/).

- **Kept separate:** nothing here imports from the rest of `src/`, from `lab/` or from any package, and nothing outside the overhaul imports from here. `tests/overhaul/boundary.test.ts` fails if either happens.
- **Checked on its own:** `npm run overhaul:typecheck`, `npm run overhaul:test` and `npm run overhaul:cov` (coverage is held at 100%). CI runs the same checks.
