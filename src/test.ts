import assert from 'node:assert';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import { advance, deserialize, serialize } from './engine';
import { DAY } from './types';
import { createWorld } from './world';

function run(seed: number, days: number) {
  const w = createWorld(seed, 'Test Player');
  advance(w, w.now + days * DAY);
  return w;
}
const hash = (s: string) => createHash('sha256').update(s).digest('hex');

// Every world below is independent of the others, so each runs in its own process and they share the machine's cores.
// The checks, seeds and lengths are the same as when they ran one after another; only the waiting is shorter.
type Job = { kind: 'det'; roundTrip: boolean } | { kind: 'seed'; seed: number };
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

// A child process runs one job and prints its result as the last line.
function inChild(job: Job): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [...process.execArgv, fileURLToPath(import.meta.url), '--job', JSON.stringify(job)], { stdio: ['ignore', 'pipe', 'inherit'] });
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.on('error', reject);
    p.on('exit', (code) => (code === 0 ? resolve(JSON.parse(out.trim().split('\n').pop()!)) : reject(new Error(`job ${JSON.stringify(job)} failed (exit ${code})`))));
  });
}
async function pool<T>(jobs: Job[], n: number, f: (j: Job) => Promise<T>): Promise<T[]> {
  const res: T[] = new Array(jobs.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, jobs.length) }, async () => { while (next < jobs.length) { const i = next++; res[i] = await f(jobs[i]); } }));
  return res;
}

const ji = process.argv.indexOf('--job');
if (ji > 0) {
  console.log(JSON.stringify(work(JSON.parse(process.argv[ji + 1]))));
} else {
  // Longest jobs first, so no core is left with a long one at the end.
  const jobs: Job[] = [...[1, 2, 3, 4, 5, 6, 7, 8].map((seed) => ({ kind: 'seed' as const, seed })), { kind: 'det', roundTrip: true }, { kind: 'det', roundTrip: false }];
  const res = await pool(jobs, availableParallelism(), inChild);
  const [a, b] = res.slice(8) as Record<string, string>[];
  assert.equal(a.world, b.world, 'same seed must give identical worlds');
  console.log('ok  determinism (seed 7, 120 days)');
  assert.equal(a.played, a.loaded, 'a loaded save must continue identically');
  console.log('ok  save/load round trip');
  for (const line of res.slice(0, 8)) console.log(line);
  console.log('all tests passed');
}
