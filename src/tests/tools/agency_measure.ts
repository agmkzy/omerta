// V74 measurement: what the NPCs did unattended. Usage: tsx src/tests/tools/agency_measure.ts <seed> [days]
import { advance } from '../../engine';
import { createWorld } from '../../world';
import { DAY } from '../../types';
import { AGENCY, agencyOf, wealthReport, moneyTotal } from '../../goals';
import { audit } from '../../consistency';
const seed = +(process.argv[2] ?? 1), days = +(process.argv[3] ?? 180);
AGENCY.audit = true; if (process.argv[4] === 'off') AGENCY.on = false;
const w = createWorld(seed, 'Tony Marino');
const t0 = Date.now();
const rows: string[] = [];
let maxGoals = 0, maxEnc = 0, goalAsks = 0;
for (let d = 1; d <= days; d++) {
  advance(w, w.now + DAY);
  const a = agencyOf(w); maxGoals = Math.max(maxGoals, a.goals.length);
  maxEnc = Math.max(maxEnc, w.enc.length);
  if (d % 45 === 0) rows.push(`d${d}: active=${a.goals.length} ended=${a.ended.length} ` + JSON.stringify(wealthReport(w)));
}
const a = agencyOf(w);
console.log(`seed ${seed} ${days}d in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
console.log(rows.join('\n'));
console.log('stats', JSON.stringify(Object.fromEntries(Object.entries(a.stats).sort())));
console.log('active by kind', JSON.stringify(a.goals.reduce((m: any, g) => (m[g.kind] = (m[g.kind] ?? 0) + 1, m), {})));
console.log('maxActive', maxGoals, 'maxEnc', maxEnc, 'ended', a.ended.length, 'cool', Object.keys(a.cool).length, 'facts', Object.keys(w.facts).length, 'saveKB', Math.round(JSON.stringify(w).length / 1024));
console.log('audit', audit(w).slice(0, 8));
console.log('endings', JSON.stringify(a.ended.slice(-12).map((e) => `${e.kind}:${e.how}:${e.why}`)));
const sz: Record<string, number> = {}; for (const [k, v] of Object.entries(w)) sz[k] = JSON.stringify(v)?.length ?? 0;
const cs: Record<string, number> = {}; for (const c of Object.values(w.chars)) for (const [k, v] of Object.entries(c)) cs[k] = (cs[k] ?? 0) + (JSON.stringify(v)?.length ?? 0);
const top = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([k, v]) => `${k}:${Math.round(v / 1024)}K`).join(' ');
console.log('size by key', top(sz)); console.log('size by char field', top(cs));
void moneyTotal;
setTimeout(() => process.exit(0), 20);
