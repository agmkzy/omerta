// V75 measurement. Usage: tsx src/tests/sit_measure.ts <seed> [days]
import { advance } from '../engine';
import { createWorld } from '../world';
import { DAY } from '../types';
import { audit } from '../consistency';
import { isOpen, SIT } from '../situ';
const seed = +(process.argv[2] ?? 1), days = +(process.argv[3] ?? 180);
if (process.argv[4] === 'off') SIT.on = false;
const w = createWorld(seed, 'Tony Marino');
const t0 = Date.now(); let maxOpen = 0, maxEnc = 0; const bad: string[] = [];
for (let d = 1; d <= days; d++) { advance(w, w.now + DAY); maxOpen = Math.max(maxOpen, (w.situations ?? []).filter(isOpen).length); maxEnc = Math.max(maxEnc, w.enc.length); if (d % 15 === 0) { const a = audit(w); if (a.length) bad.push(`day ${d}: ${a[0]}`); } }
console.log(`seed ${seed} ${days}d ${((Date.now() - t0) / 1000).toFixed(0)}s open=${(w.situations ?? []).filter(isOpen).length} total=${(w.situations ?? []).length} maxOpen=${maxOpen} maxEnc=${maxEnc}`);
console.log('pace', JSON.stringify({ ...w.sitpace, stats: undefined }));
console.log('stats', JSON.stringify(Object.fromEntries(Object.entries(w.sitpace?.stats ?? {}).sort())));
console.log('audit', audit(w).slice(0, 10), 'mid-run violations', bad.slice(0, 5));
const p0 = w.chars[w.playerId!]; console.log('player knows of', (w.situations ?? []).filter((s) => s.key && s.kind !== 'dispute' && s.kind !== 'crew' && Object.keys(p0.known).some((id) => w.facts[id]?.story === 'sit:' + s.id)).length, 'matters');
console.log('facts', Object.keys(w.facts).length, 'saveKB', Math.round(JSON.stringify(w).length / 1024));
setTimeout(() => process.exit(0), 20);
