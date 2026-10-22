// Architecture: source scans that keep each kind of change behind its one door. They read every src/*.ts file, which is
// why tests live in src/tests/ and never beside the code.
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { advance } from '../engine';
import { DAY } from '../types';
import { orgList } from '../orgs';
import { orgWorld, clean } from './organisations/fixtures';

describe('architecture', { tags: ['architecture'] }, () => {
  ok('rank has one door: no source line assigns .rank outside rank.ts/world.ts', () => {
    const bad: string[] = [];
    const dir = fileURLToPath(new URL('../', import.meta.url));
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.ts') && x !== 'rank.ts' && x !== 'world.ts')) {
      readFileSync(dir + f, 'utf8').split('\n').forEach((l, i) => { if (/\.rank = /.test(l)) bad.push(`${f}:${i + 1}`); });
    }
    assert.deepEqual(bad, []);
  });
  ok('no source file changes a business\'s cash directly', () => {
    const bad: string[] = []; const src = fileURLToPath(new URL('../', import.meta.url));
    for (const f of readdirSync(src).filter((x) => x.endsWith('.ts') && x !== 'econ.ts')) {
      readFileSync(src + f, 'utf8').split('\n').forEach((line, i) => { if (/\b(?:biz|shop|rb|sb|own|[a-z]*Biz)\.cash\s*[-+*]?=[^=]/.test(line) || /\bb\.cash\s*[-+*]?=[^=]/.test(line) && f !== 'disputes.ts') bad.push(`${f}:${i + 1}`); });
    }
    assert.deepEqual(bad, []);
  });
  ok('grudges and reputation have one door each: no source line sets .grudge or .standing outside core.ts', () => {
    // (core.bear/ease for grudges, which keep the reason with them; core.repute for anyone's standing. world.ts sets the first value.)
    const bad: string[] = [];
    const dir = fileURLToPath(new URL('../', import.meta.url));
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.ts') && !['core.ts', 'world.ts', 'cli.ts'].includes(x))) {
      readFileSync(dir + f, 'utf8').split('\n').forEach((l, i) => { if (/(?<!KITS)\.grudge\s*[-+*]?=[^=]/.test(l) || (/\.standing\s*[-+*]?=[^=]/.test(l) && !/\b(fam|f|F|T|parent)\.standing/.test(l))) bad.push(`${f}:${i + 1}`); }); // (a family's standing is its own)
    }
    assert.deepEqual(bad, []);
  });
  ok('11. no general logic names a family or counts five: other-sized worlds run clean', () => {
    for (const n of [4, 7]) {
      const w = orgWorld(5, 40, n); assert.equal(orgList(w).length, n); clean(w, n + ' orgs');
      advance(w, w.now + 30 * DAY); clean(w, n + ' orgs +30d');
    }
    const files = readdirSync(new URL('..', import.meta.url).pathname).filter((x) => x.endsWith('.ts') && x !== 'world.ts');
    for (const x of files) { const s = readFileSync(new URL('../' + x, import.meta.url), 'utf8'); assert.ok(!/fam_(corrente|marchetti|falco|brancato|santangelo)/.test(s), x + ' names a family id'); assert.ok(!/(fam(ilies)?|orgs?)\.length\s*[=!]==?\s*5/.test(s), x + ' counts five'); }
  });
});
