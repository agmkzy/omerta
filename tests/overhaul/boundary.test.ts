// The overhaul's boundary with the game, in both directions: the overhaul builds on nothing of the game's, so it can be slotted in
// deliberately, and the game builds on nothing of the overhaul's until then. See docs/overhaul/plans/character/README.md.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'vitest';
import { importsIn, importsOf, sourceFiles, target, within, type Found } from './support/imports';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SRC = join(ROOT, 'src');
const OVERHAUL = join(SRC, 'overhaul');
const TESTS = join(ROOT, 'tests', 'overhaul');
const LAB = join(ROOT, 'lab');
/** The overhaul's demo page (npm run demo:dev), which shows the overhaul in a browser and so is the one thing outside it that uses it. */
const DEMO = join(ROOT, 'demo', 'overhaul');

const where = (found: readonly Found[]) => found.map((f) => `${relative(ROOT, f.file)}:${f.line} imports '${f.specifier}'`);

describe('reading imports', { tags: ['unit'] }, () => {
  test('finds every form of import, with its line', () => {
    const source = [
      "import a from './a';",
      "import type { B } from './b';",
      "import './c';",
      "export { d } from './d';",
      "export * from './e';",
      "const f = await import('./f');",
      "const g = require('./g');",
      'import {',
      '  h,',
      "} from './h';",
    ].join('\n');
    assert.deepEqual(importsIn(source), [
      { specifier: './a', line: 1 },
      { specifier: './b', line: 2 },
      { specifier: './c', line: 3 },
      { specifier: './d', line: 4 },
      { specifier: './e', line: 5 },
      { specifier: './f', line: 6 },
      { specifier: './g', line: 7 },
      { specifier: './h', line: 10 },
    ]);
  });

  test('ignores comments and strings that only look like imports', () => {
    const source = ["// import a from './a';", "/* export * from './b'; */", 'const c = "import d from \'./d\'";'].join('\n');
    assert.deepEqual(importsIn(source), []);
  });

  test('resolves a path against the importing file, or the root for a path starting with /', () => {
    assert.equal(target('../core', '/repo/src/overhaul/x.ts', '/repo'), '/repo/src/core');
    assert.equal(target('./y', '/repo/src/overhaul/x.ts', '/repo'), '/repo/src/overhaul/y');
    assert.equal(target('/src/core.ts', '/repo/web/main.ts', '/repo'), '/repo/src/core.ts');
    assert.equal(target('vitest', '/repo/src/overhaul/x.ts', '/repo'), null);
    assert.equal(target('node:fs', '/repo/src/overhaul/x.ts', '/repo'), null);
  });

  test('tells a folder from one that only starts with the same name', () => {
    assert.equal(within('/repo/src/overhaul', '/repo/src/overhaul'), true);
    assert.equal(within('/repo/src/overhaul/a/b.ts', '/repo/src/overhaul'), true);
    assert.equal(within('/repo/src/overhauled.ts', '/repo/src/overhaul'), false);
    assert.equal(within('/repo/src/core.ts', '/repo/src/overhaul'), false);
  });

  test('lists source files, skipping the folders asked for and anything that is not source', () => {
    const dir = mkdtempSync(join(tmpdir(), 'overhaul-boundary-'));
    try {
      for (const folder of ['a', 'a/skip', 'a/node_modules', 'coverage']) mkdirSync(join(dir, folder), { recursive: true });
      for (const file of ['a/one.ts', 'a/two.mjs', 'a/notes.md', 'a/skip/three.ts', 'a/node_modules/four.js', 'coverage/five.js'])
        writeFileSync(join(dir, file), '');
      assert.deepEqual(sourceFiles(dir, [join(dir, 'a', 'skip')]).map((f) => relative(dir, f)).sort(), ['a/one.ts', 'a/two.mjs']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('the boundary', { tags: ['architecture'] }, () => {
  test('the overhaul imports only from within itself: nothing from the game, the lab or any package', () => {
    // Its rules depend on nothing they are not given, which keeps them deterministic and lets them be slotted in deliberately.
    const found = importsOf(sourceFiles(OVERHAUL), ROOT);
    assert.deepEqual(where(found.filter((f) => f.target === null || !within(f.target, OVERHAUL))), []);
  });

  test("the overhaul's tests import nothing from the game or the lab", () => {
    const found = importsOf(sourceFiles(TESTS), ROOT);
    const outside = (t: string | null) => t !== null && ((within(t, SRC) && !within(t, OVERHAUL)) || within(t, LAB));
    assert.deepEqual(where(found.filter((f) => outside(f.target))), []);
  });

  test("the demo page imports nothing from the game or the lab", () => {
    const files = sourceFiles(DEMO);
    assert.ok(files.some((f) => f.endsWith('.vue')), 'the scan found none of the demo’s components');
    const found = importsOf(files, ROOT);
    const outside = (t: string | null) => t !== null && ((within(t, SRC) && !within(t, OVERHAUL)) || within(t, LAB));
    assert.deepEqual(where(found.filter((f) => outside(f.target))), []);
  });

  test('nothing outside the overhaul imports from it, but its tests and its demo page', () => {
    const files = sourceFiles(ROOT, [OVERHAUL, TESTS, DEMO]);
    // (the scan must see the game, or an empty list would pass)
    assert.ok(files.some((f) => within(f, SRC)) && files.some((f) => within(f, LAB)), 'the scan found no game or lab files');
    const found = importsOf(files, ROOT);
    assert.deepEqual(where(found.filter((f) => f.target !== null && within(f.target, OVERHAUL))), []);
  });
});
