// Builds one world for determinism.test.ts in a process of its own, and prints the result as JSON on the last line of stdout.
// A failed check exits non-zero. By hand: npx tsx src/tests/determinism.job.ts '{"kind":"seed","seed":3}'
import assert from 'node:assert';
import { createHash } from 'node:crypto';
import { advance, deserialize, serialize } from '../engine';
import { DAY } from '../types';
import { createWorld } from '../world';

export type Job = { kind: 'det'; roundTrip: boolean } | { kind: 'seed'; seed: number };

function run(seed: number, days: number) {
  const w = createWorld(seed, 'Test Player');
  advance(w, w.now + days * DAY);
  return w;
}
const hash = (s: string) => createHash('sha256').update(s).digest('hex');

function work(job: Job): unknown {
  if (job.kind === 'det') {
    // 1. Determinism: same seed, same history (two separate processes must agree).
    const a = run(7, 120);
    const out: Record<string, string> = { world: hash(serialize(a)) };
    if (job.roundTrip) {
      // 2. Save/load round trip continues identically.
      const c = deserialize(serialize(a));
      advance(a, a.now + 30 * DAY);
      advance(c, c.now + 30 * DAY);
      out.played = hash(serialize(a));
      out.loaded = hash(serialize(c));
    }
    return out;
  }
  // 3. Sanity across seeds: no NaN, and the world actually does things.
  const w = run(job.seed, 180);
  for (const ch of Object.values(w.chars)) assert.ok(Number.isFinite(ch.cash), `cash finite (${ch.name})`);
  for (const bz of Object.values(w.biz)) assert.ok(Number.isFinite(bz.cash), `biz cash finite (${bz.name})`);
  const kinds: Record<string, number> = {};
  for (const f of Object.values(w.facts)) kinds[f.kind] = (kinds[f.kind] ?? 0) + 1;
  const dead = Object.values(w.chars).filter((x) => !x.alive).length;
  return `seed ${job.seed}: ${Object.keys(w.facts).length} facts, ${dead} dead, ${w.debts.length} debts | ${JSON.stringify(kinds)}`;
}

console.log(JSON.stringify(work(JSON.parse(process.argv[2]) as Job)));
