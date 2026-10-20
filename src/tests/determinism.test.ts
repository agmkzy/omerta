// Determinism (seed 7, 120 days, twice gives identical serialisation), save/load continuation, and 8 seeds × 180 days with no NaN cash.
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, test as ok } from 'vitest';
import type { Job } from './determinism.job';

// Every world below is independent of the others, so each runs in its own process (determinism.job.ts) and they share the machine's cores.
// The checks, seeds and lengths are the same as when they ran one after another; only the waiting is shorter. This also means the
// two determinism runs really are separate processes, with nothing shared between them.
const JOB = fileURLToPath(new URL('./determinism.job.ts', import.meta.url));
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

// A child process runs one job and prints its result as the last line; a failure carries the child's error output.
function inChild(job: Job): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['--import', 'tsx', JOB, JSON.stringify(job)], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('error', reject);
    p.on('exit', (code) => (code === 0 ? resolve(JSON.parse(out.trim().split('\n').pop()!)) : reject(new Error(`job ${JSON.stringify(job)} failed (exit ${code})\n${err.trim()}`))));
  });
}
async function pool<T>(jobs: Job[], n: number, f: (j: Job) => Promise<T>): Promise<T[]> {
  const res: T[] = new Array(jobs.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, jobs.length) }, async () => { while (next < jobs.length) { const i = next++; res[i] = await f(jobs[i]); } }));
  return res;
}

describe('determinism', { tags: ['determinism'] }, () => {
  // Longest jobs first, so no core is left with a long one at the end. A failed job is kept as its error and fails only its own check.
  const jobs: Job[] = [...SEEDS.map((seed) => ({ kind: 'seed' as const, seed })), { kind: 'det', roundTrip: true }, { kind: 'det', roundTrip: false }];
  let res: unknown[] = [];
  beforeAll(async () => { res = await pool(jobs, availableParallelism(), (j) => inChild(j).catch((e: Error) => e)); });
  const got = <T>(i: number): T => { if (res[i] instanceof Error) throw res[i]; return res[i] as T; };

  ok('determinism (seed 7, 120 days)', () => {
    const [a, b] = [got<Record<string, string>>(8), got<Record<string, string>>(9)];
    assert.equal(a.world, b.world, 'same seed must give identical worlds');
  });
  ok('save/load round trip', () => {
    const a = got<Record<string, string>>(8);
    assert.equal(a.played, a.loaded, 'a loaded save must continue identically');
  });
  ok.each(SEEDS)('seed %i: 180 days, every cash balance finite', (seed) => console.log(got<string>(seed - 1)));
});
