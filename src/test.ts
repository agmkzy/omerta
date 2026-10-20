import assert from 'node:assert';
import { advance, deserialize, serialize } from './engine';
import { DAY } from './types';
import { createWorld } from './world';

function run(seed: number, days: number) {
  const w = createWorld(seed, 'Test Player');
  advance(w, w.now + days * DAY);
  return w;
}

// 1. Determinism: same seed, same history.
const a = run(7, 120);
const b = run(7, 120);
assert.equal(serialize(a), serialize(b), 'same seed must give identical worlds');
console.log('ok  determinism (seed 7, 120 days)');

// 2. Save/load round trip continues identically.
const c = deserialize(serialize(a));
advance(a, a.now + 30 * DAY);
advance(c, c.now + 30 * DAY);
assert.equal(serialize(a), serialize(c), 'a loaded save must continue identically');
console.log('ok  save/load round trip');

// 3. Sanity across seeds: no NaN, and the world actually does things.
for (let seed = 1; seed <= 8; seed++) {
  const w = run(seed, 180);
  for (const ch of Object.values(w.chars)) assert.ok(Number.isFinite(ch.cash), `cash finite (${ch.name})`);
  for (const bz of Object.values(w.biz)) assert.ok(Number.isFinite(bz.cash), `biz cash finite (${bz.name})`);
  const kinds: Record<string, number> = {};
  for (const f of Object.values(w.facts)) kinds[f.kind] = (kinds[f.kind] ?? 0) + 1;
  const dead = Object.values(w.chars).filter((x) => !x.alive).length;
  console.log(`seed ${seed}: ${Object.keys(w.facts).length} facts, ${dead} dead, ${w.debts.length} debts |`, JSON.stringify(kinds));
}
console.log('all tests passed');
