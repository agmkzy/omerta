// V75 tuning: how often the player learns of situation-related matters. Usage: tsx src/tests/sit_freq.ts <seed> <days> passive|active|capo
import { advance } from '../engine';
import { createWorld } from '../world';
import { DAY, World } from '../types';
import { audit } from '../consistency';
import { sitAtClub } from '../places';
import { applyRank } from '../rank';
const seed = +(process.argv[2] ?? 1), days = +(process.argv[3] ?? 360), mode = process.argv[4] ?? 'passive';
const w: World = createWorld(seed, 'Tony Marino');
const p = w.chars[w.playerId!];
if (mode === 'capo') { applyRank(w, p, 'capo', {}); p.standing = 70; }
const seenFacts = new Set<string>(), seenMatters = new Set<string>();
const perMonthF: number[] = [], perMonthM: number[] = []; let monthF = 0, monthM = 0, visits = 0;
const bad: string[] = []; const byFrom: Record<string, number> = {};
for (let d = 1; d <= days; d++) {
  const dayStart = Math.floor(w.now / DAY) * DAY;
  advance(w, dayStart + 20 * 60);
  if (mode !== 'passive' && d % 3 === 0) { const r = sitAtClub(w, p); visits++; advance(w, w.now + r.minutes); }
  advance(w, dayStart + DAY);
  for (const [id, k] of Object.entries(p.known)) {
    const f = w.facts[id]; if (!f?.story?.startsWith('sit:') || seenFacts.has(id)) continue;
    seenFacts.add(id); monthF++; byFrom[String(k.from).startsWith('c') ? 'person' : String(k.from)] = (byFrom[String(k.from).startsWith('c') ? 'person' : String(k.from)] ?? 0) + 1;
    if (!seenMatters.has(f.story)) { seenMatters.add(f.story); monthM++; }
  }
  if (d % 30 === 0) { perMonthF.push(monthF); perMonthM.push(monthM); monthF = 0; monthM = 0; if (audit(w).length) bad.push(`day ${d}: ${audit(w)[0]}`); }
}
const avg = (a: number[]) => (a.reduce((x, y) => x + y, 0) / Math.max(1, a.length)).toFixed(2);
const starts = Object.entries(w.sitpace?.stats ?? {}).filter(([k]) => k.startsWith('start.') && !k.endsWith('dispute')).reduce((a, [, v]) => a + v, 0);
console.log(`seed ${seed} ${mode} ${days}d: facts/month ${avg(perMonthF)} [${perMonthF.join(',')}]  new matters/month ${avg(perMonthM)} [${perMonthM.join(',')}]  club visits ${visits}  non-mirror starts ${starts}  club ${w.sitpace?.stats?.club ?? 0} friend ${w.sitpace?.stats?.friend ?? 0} leak ${w.sitpace?.stats?.leak ?? 0} word ${w.sitpace?.stats?.word ?? 0}  rank ${p.rank}  audit ${JSON.stringify(bad)}`);
console.log('sources', JSON.stringify(byFrom));
process.exit(0);
