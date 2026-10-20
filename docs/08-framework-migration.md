# Framework migration: Vue, Vitest and Pinia

This document assesses whether moving to a standard framework (Vue 3) with a dependable test runner (Vitest) and a store (Pinia) is viable, what it would cost, and in what order to do it. It assumes the context in [01-stack.md](01-stack.md) and [02-state-saves-and-compatibility.md](02-state-saves-and-compatibility.md).

## Summary

| Change | Viable? | Effort | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| **Vitest** for the existing tests | Yes, almost mechanical | 1–2 days | Low: no game code changes | **Do it first** |
| **Vite** as the bundler (with `vite-plugin-singlefile`) | Yes | ½ day | Low | Do it together with Vitest, or before Vue |
| **Vue 3** for the UI layer (`web.ts` + `src/ui/*`, about 4,000 lines) | Yes, incrementally | Several weeks, part-time | Medium: there are no UI tests today | Do it when the UI needs component state, partial updates or richer screens. Port incrementally |
| **Pinia** for UI state (`S`) | Yes | Part of the Vue work | Low if the world is kept raw | Use it for `S` only. The world stays a raw object inside it |
| Vue/Pinia **inside the simulation** | **No** | — | High | Keep the engine plain TypeScript with zero dependencies |

The simulation (about 21,000 lines) has no DOM access, no UI imports and no framework assumptions, and no part of this migration requires changing it. That separation is the main reason the migration is viable.

## 1. Vitest

### Why
The current suites are plain scripts (`node:assert` plus a local `ok(name, fn)` helper), run serially by a shell loop in `package.json`. `test:all` takes about 7.5 minutes and stops at the first failing suite. Vitest would add:

- per-test reporting, filtering (`-t "ledger"`) and watch mode;
- parallel execution across files in worker threads. Most of the 7.5 minutes is a handful of long simulations, which would then overlap;
- coverage (`@vitest/coverage-v8`) with thresholds;
- CI-readable reporters (JUnit, GitHub Actions annotations);
- `describe.skipIf`/tags for slow suites instead of hand-parsed `process.argv` modes.

### How hard
It's easy, because the tests already throw `AssertionError` on failure, and Vitest treats any throw as a failure. `node:assert` works unchanged inside `test()`.

```ts
// before (src/tests/v77.test.ts)
let failed = 0;
const ok = (name: string, f: () => void) => { try { f(); console.log('ok   ' + name); } catch (e) { failed++; … } };
function fast() { ok('every temperament has lines …', () => { … }); … }
const arg = process.argv[2] ?? 'fast'; if (arg === 'fast') fast();
setTimeout(() => process.exit(failed ? 1 : 0), 50);

// after (src/tests/v77.test.ts)
import { describe, test as ok } from 'vitest';
describe('v77 fast', () => { ok('every temperament has lines …', () => { … }); … });
```

Steps:

1. `npm i -D vitest @vitest/coverage-v8`, then add `vitest.config.ts` with `test: { include: ['src/tests/**/*.test.ts'], testTimeout: 600_000, pool: 'threads' }`.
2. In each suite, delete the local `ok`, the `failed` counter and the `setTimeout(process.exit)`. Wrap `fast()` in `describe('…fast')`. Alias `test` as `ok` to keep the diff small.
3. Turn the slow modes (`sim:<seed>`, `growth:<seed>`, `compat`, `det`) into `describe.skipIf(!process.env.SLOW)` blocks, or move them to `*.slow.test.ts` files, parameterised with `test.each` over seeds.
4. Move expensive shared fixtures (`fresh()` builds a 60-day world) into `beforeAll` or keep them module-scoped. Each test file runs in its own worker, so each file pays for its own fixture once.
5. `oldsave.test.ts`, `storage.test.ts` and `test.ts` become one `describe` each.
6. Point `npm test` at `vitest run`, and add `test:watch` and `test:cov`.
7. Keep the measurement and trace scripts (`*_measure.ts`, `sit_trace.ts`, `stress.ts`, `bot.ts`) as `tsx` scripts. They are tools, not tests.

Watch out for:

- Two tests scan the source tree with `process.cwd() + '/src/'` (`v72`) or a path relative to `import.meta.url` (`v76`). Vitest's default root is the project root, so both work, but prefer `import.meta.url` everywhere.
- Some suites flip exported tuning objects (`AGENCY.on`, `SIT.on`). Vitest isolates modules per file by default, so this is safe across files. Within one file, reset them in `afterEach`.
- The determinism tests compare serialised worlds. Keep them as `assert.equal` on strings. Don't use Vitest snapshots for megabyte-sized worlds.

**Coverage target suggestion.** First measure, then set the threshold just below the measured figure so it can only go up. Aim for 80% line coverage of `src/*.ts`, excluding `web.ts`, `ui/`, `cli.ts`, `bot.ts` and `stress.ts`. The simulation is heavily exercised by the long runs, so this should already be close.

## 2. Vite (bundler)

Vite builds with esbuild and Rollup and is the natural pair for both Vitest and Vue. It can be adopted without Vue:

- `vite build` with `vite-plugin-singlefile` inlines all JS and CSS into one `index.html`, which preserves the single-file and artifact property. `build-web.sh` and its `</script` guard go away, and so does the POSIX-shell dependency (it then builds on Windows).
- `vite` dev server: instant reload while working on the UI, instead of rebuilding and refreshing.
- `web/template.html` becomes Vite's `index.html` entry. The CSS can move to a `.css` file that Vite inlines.

## 3. Vue 3 for the UI

### What exists today
About 45 `View` variants ([ui/state.ts](../src/ui/state.ts)), each rendered by a function that returns an HTML string. A single `render()` assigns the result to `#app.innerHTML` after every click. One delegated listener turns `data-a="action:value"` attributes into `handle(action, value)` calls, a switch of about 125 cases in [web.ts](../src/web.ts). Navigation is a hand-rolled view stack (`go`, `pop`, `tab`). Details are in [engine/08-ui-and-entry-points.md](engine/08-ui-and-entry-points.md).

### What Vue would fix
- **Escaping by default.** `{{ }}` interpolation escapes. Today every interpolation needs a manual `esc()`.
- **Partial updates.** Only changed DOM is patched. Focus, inputs and scroll survive, and the manual scroll-restore list goes away.
- **Component-local state** for things like expanded banners, selected pills and form fields, which today live in the global `S`.
- **Tooling:** Vue DevTools, component tests (`@vue/test-utils` under Vitest) and typed props.

### What it costs
- About 35–50 KB minified on a 1.08 MB bundle (negligible) plus the Vite build.
- Porting about 4,000 lines of view code. Most views are straightforward lists, banners and buttons. The large ones (`views_b.ts`, 776 lines, and the dialogue/talk view) will take longer.
- **No UI tests exist today**, so regressions would be found by playing. Add a small Playwright smoke suite (new game, talk to the boss, wait a day, save, reload) before porting.
- `portrait.ts` must not change (CLAUDE.md). Render its SVG string output with `v-html` inside an `<Avatar>` component, and leave the module untouched.

### Migration plan (strangler pattern)
1. **Vite and Vitest first** (above). Nothing visible changes.
2. **Mount Vue around the existing renderer.** Create one root component with a `<div v-html="html">` where `html` is a `computed` that calls today's `body()` and `tabs()`, keyed on a `version` counter bumped after every `handle()`. Keep the delegated `data-a` listener as-is. At this point Vue is in place and nothing else has changed.
3. **Introduce the Pinia store** for `S` (section 4). `handle()` becomes a store action. The `data-a` listener calls it.
4. **Port views one at a time,** leaves first: `brief`, `sunday`, `blackjack`, `family`, then the tabs, then `talk`/`meeting`. Each ported view replaces its `case` in `body()` with a component. Buttons call store actions directly (`@click="act('ent', c.id)"`), so `data-a` codes can be retired gradually.
5. **Replace the view stack** with a store-managed stack, which stays simple. `vue-router` in memory mode is possible but not needed, because there are no URLs to support.
6. Remove `render()`, the string helpers and `esc()` once nothing uses them.

### Alternatives worth weighing
- **lit-html** (about 7 KB): keep the current function-per-view structure but return `html\`…\`` tagged templates instead of strings. You get auto-escaping and efficient DOM patching for the smallest possible diff. This is the cheapest fix for the two real pains, XSS discipline and full re-render, but you don't get Vue's ecosystem.
- **Preact + signals / Svelte:** similar benefits to Vue. Vue is the requested standard and has the gentlest template syntax for designers, so there's no strong reason to choose these instead.

## 4. Pinia and the world

### The rule: the world is raw
The `World` is 0.3–3 MB of nested plain data. The simulation reads and writes it thousands of times per simulated day. Making it deeply reactive (`ref`/`reactive`) would:

- put a Proxy on every property access in `advance()`, a large constant-factor slowdown in the hottest code;
- trigger dependency tracking on every mutation, scheduling re-renders mid-simulation;
- risk proxy identity leaking into code that compares objects.

So the store holds the world with `shallowRef` and `markRaw`, plus a `version` counter that the UI depends on.

### Store sketch

```ts
// src/ui/store.ts
import { defineStore } from 'pinia';
import { markRaw, ref, shallowRef } from 'vue';
import { deserialize, serialize } from '../engine';
import { KEY, readSnaps, writeSave, type SaveStatus } from '../storage';
import { fmtTime } from '../core';
import type { World } from '../types';
import type { View } from './state';

export const useGame = defineStore('game', () => {
  const world = shallowRef<World | null>(null); // never deep-reactive
  const version = ref(0);                         // bump after every engine call
  const view = ref<View>({ t: 'tab', name: 'today' });
  const stack = ref<View[]>([]);
  const save = ref<SaveStatus | null>(null);

  function commit() {
    version.value++;
    const w = world.value!;
    save.value = writeSave(localStorage, serialize(w), Math.floor(w.now / 1440), fmtTime(w.now)); // unchanged guarantees
  }
  function act<T>(fn: (w: World) => T): T { const r = fn(world.value!); commit(); return r; }

  function loadFromStorage(): boolean {
    const raw = localStorage.getItem(KEY);
    if (raw) try { world.value = markRaw(deserialize(raw)); version.value++; return true; } catch { /* fall through to snapshots */ }
    for (const s of readSnaps(localStorage)) {
      const r = localStorage.getItem(s.key);
      if (r) try { world.value = markRaw(deserialize(r)); version.value++; return true; } catch { /* next */ }
    }
    return false;
  }
  return { world, version, view, stack, save, act, commit, loadFromStorage };
});

// in a component
const g = useGame();
const player = computed(() => { g.version; const w = g.world!; return w.chars[w.playerId!]; });
```

`storage.ts`, `serialize`/`deserialize` and the migration chain stay exactly as they are. The store is a thin shell around them. So **loading a localStorage backup into a Pinia store is straightforward**: it is `loadFromStorage()` above.

**Don't use `pinia-plugin-persistedstate`** or similar for the world. It would serialise through its own path, bypassing `writeSave`'s read-back verification, snapshots and quota handling, and `deserialize`'s migrations. It would also try to persist on every reactive change. Persist only through `commit()`.

If the simulation moves into a Web Worker later (recommended once long waits feel slow), the store keeps a structured-clone copy of the world. Actions become `await worker.call('act', …)`, and the same `version` pattern applies.

## 5. Suggested order and checkpoints

1. Vitest plus CI (green on today's tests, with coverage measured).
2. Vite build with `vite-plugin-singlefile`. Diff-test that the produced HTML runs, and load an existing save in it.
3. A Playwright smoke test of the core loop.
4. Wrap the existing renderer in Vue and the store. Ship it, which proves the plumbing.
5. Port views incrementally, shipping after each batch.

Each step is releasable on its own, and none of them touches simulation code or the save format.
