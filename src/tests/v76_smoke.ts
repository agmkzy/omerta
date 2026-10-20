import { advance, serialize, deserialize } from '../engine';
import { createWorld } from '../world';
import { DAY } from '../types';
import { audit } from '../consistency';
import { orgIssues, orgList, treasuryCheck } from '../orgs';
const seed = Number(process.argv[2] ?? 3), days = Number(process.argv[3] ?? 60);
const w = createWorld(seed, 'Tony Marino');
const t0 = Date.now();
for (let d = 30; d <= days; d += 30) { advance(w, w.now + 30 * DAY); console.log('day', d, 'issues', audit(w).length, orgIssues(w).length, audit(w).slice(0, 4)); }
console.log('ms', Date.now() - t0);
for (const f of orgList(w)) console.log(f.name, 'treas', f.treasury, treasuryCheck(f), 'stand', f.standing, 'hist', (f.hist ?? []).map((h) => h.text).slice(-2));
console.log(Object.values(w.fam).map((f) => Object.entries(f.rel ?? {}).slice(0, 1)).slice(0, 1));
const s1 = serialize(w); console.log('size', s1.length, 'roundtrip', serialize(deserialize(s1)) === s1);
