# Framework migration: Vue, Vitest and Pinia

This document assesses whether moving to a standard framework (Vue 3) with a dependable test runner (Vitest) and a store (Pinia) is viable, what it would cost, and in what order to do it. It assumes the context in [01-stack.md](01-stack.md) and [02-state-saves-and-compatibility.md](02-state-saves-and-compatibility.md).

## Summary

| Change | Viable? | Effort | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| **Vitest** for the existing tests | Yes, almost mechanical | 1–2 days | Low: no game code changes | **Done** (section 1) |
| **Vite** as the bundler (with `vite-plugin-singlefile`) | Yes | ½ day | Low | **Done** (section 2) |
| **Vue 3** for the UI layer (`web.ts` + `src/ui/*`, about 4,000 lines) | Yes, incrementally | Several weeks, part-time | Medium: there are no UI tests today | Do it when the UI needs component state, partial updates or richer screens. Port incrementally |
| **Pinia** for UI state (`S`) | Yes | Part of the Vue work | Low if the world is kept raw | Use it for `S` only. The world stays a raw object inside it |
| Vue/Pinia **inside the simulation** | **No** | — | High | Keep the engine plain TypeScript with zero dependencies |

The simulation (about 21,000 lines) has no DOM access, no UI imports and no framework assumptions, and no part of this migration requires changing it. That separation is the main reason the migration is viable.

## 1. Vitest: done

The suites run under Vitest 5, configured in [vitest.config.ts](../vitest.config.ts). How to run and write them is in [05-testing.md](05-testing.md). In short:

- **The conversion was mechanical.** Each suite imports `test as ok` from Vitest and wraps its `fast()` in a `describe`. The local `ok` helper, the `failed` counter and `process.exit` are gone. The assertions are still `node:assert`. No game code, save format or tuning changed. Every check that ran before still runs, with the same count per suite (208), plus the 7 of the V88 portrait suite.
- **Suites are found by name** (`src/tests/**/*.test.ts`). The hand-kept lists in `package.json`, the Makefile and the CI matrix had drifted: `v86`, `v87` and V88's `portrait` suite ran nowhere. All three now run in `test:all` and CI. `src/test.ts` became `src/tests/determinism.test.ts`.
- **The `process.argv` modes became environment switches** in [src/tests/modes.ts](../src/tests/modes.ts). `COMPAT=1` turns on the synthetic schema migrations, which are now part of `test:all`. `SLOW=1` turns on the long simulations, which take `SEED`/`DAYS` and are parameterised with `test.each`.
- **Files run in parallel.** `test:all` went from 5 min 29 s (serial, without compat, v86, v87 and portrait) to 3 min 13 s on the same machine. v75, one file of slow serial checks, is now the whole critical path. Splitting it is the next speed-up.
- **The determinism suite still builds its ten worlds in child processes** ([determinism.job.ts](../src/tests/determinism.job.ts)). They take 20 s that way; built serially in one worker they would take about three minutes, nearly as long as v75.
- **Coverage** (`npm run test:cov`) uses `@vitest/coverage-v8`, with thresholds set just below the measured figures (see [05-testing.md](05-testing.md#are-there-coverage-targets)). CI runs the suites in three parallel jobs (v75, v74, the rest), each writing a blob report with its coverage. A final job merges them and checks the thresholds once.
- **The watch-outs from the plan were handled.** The source scans use `import.meta.url` instead of `process.cwd()`. v74 restores `AGENCY.audit` in `afterEach`. The determinism checks stay `assert.equal` on serialised strings, with no snapshots.

## 2. Vite (bundler): done

Vite is the bundler. It builds with Rolldown and the Oxc minifier as of Vite 8, and it's the natural pair for both Vitest and Vue. It was adopted without Vue. How it's configured is in [03-build-and-setup.md](03-build-and-setup.md#the-pipeline). In short:

- `vite build` with `vite-plugin-singlefile` inlines the bundle into one HTML file, `dist/omerta.html`, so the single-file and artifact property is kept. `build-web.sh` and the POSIX-shell dependency are gone. A small plugin in `vite.config.ts` replaces the `</script` guard, and also fails the build if anything is left un-inlined.
- `npm run dev` runs a dev server that reloads the page on every change, instead of rebuilding and refreshing by hand.
- `web/template.html` became `web/index.html`, with Vite's root set to `web/` (the repository root's `index.html` is the GitHub Pages copy). The CSS stays inline in the shell and ships unminified. Moving it into a `.css` file that Vite inlines is still an option.
- The esbuild and Vite builds were compared in a browser: the same save and the same 300 clicks gave byte-identical screens and a byte-identical final save.

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
1. **Vite and Vitest first** (above; both are done). Nothing visible changes.
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

1. ~~Vitest plus CI (green on today's tests, with coverage measured).~~ Done.
2. ~~Vite build with `vite-plugin-singlefile`. Diff-test that the produced HTML runs, and load an existing save in it.~~ Done.
3. A Playwright smoke test of the core loop.
4. Wrap the existing renderer in Vue and the store. Ship it, which proves the plumbing.
5. Port views incrementally, shipping after each batch.

Each step is releasable on its own, and none of them touches simulation code or the save format.
