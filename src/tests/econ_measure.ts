// Economy measurement (V73): what the money did over N days. Same output before and after the economy work.
// Usage: tsx src/tests/econ_measure.ts <seed> [days]
import { advance } from '../engine';
import { createWorld } from '../world';
import { DAY } from '../types';
const seed = +(process.argv[2] ?? 1), days = +(process.argv[3] ?? 180);
const w = createWorld(seed, 'Tony Marino');
const seen = new Set<string>(); const kinds: Record<string, number> = {};
const sample: string[] = [];
const tally = () => { for (const f of Object.values(w.facts)) if (!seen.has(f.id)) { seen.add(f.id); kinds[f.kind] = (kinds[f.kind] ?? 0) + 1; } };
const sum = (f: (x: any) => number, xs: any[]) => xs.reduce((a, x) => a + f(x), 0);
for (let d = 1; d <= days; d++) {
  advance(w, w.now + DAY); tally();
  if (d % 30 === 0) {
    const bs = Object.values(w.biz);
    sample.push(`d${d}: open=${bs.filter((b) => b.open).length}/${bs.length} bizCash=${Math.round(sum((b) => b.cash, bs.filter((b) => b.open)))} charCash=${Math.round(sum((c) => c.cash, Object.values(w.chars).filter((c) => c.alive)))}`);
  }
}
const men = Object.values(w.chars).filter((c) => c.alive && c.familyId && c.bossId);
const pick = ['terms', 'ownership', 'shortfall', 'discipline', 'protection_late', 'protection_refused', 'business_failed', 'debt_missed', 'debt_default', 'business_struggling', 'side_operation'];
console.log(`seed ${seed} ${days}d`, JSON.stringify(Object.fromEntries(pick.map((k) => [k, kinds[k] ?? 0]))));
console.log(sample.join(' | '));
console.log(`men behind now=${men.filter((c) => c.books.arrears > 0).length}/${men.length} avg arrears=${Math.round(sum((c) => c.books.arrears, men) / Math.max(1, men.length))} protectedOpen=${Object.values(w.biz).filter((b) => b.open && b.protection).length}`);
setTimeout(() => process.exit(0), 20);
