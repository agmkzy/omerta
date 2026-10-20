// Scratch measurement: how NPC plans start and end. Usage: npx tsx playtest/goalstats.ts [v]
import { advance } from '../src/engine';
import { createWorld } from '../src/world';
import { agencyOf, KINDS } from '../src/goals';
import { DAY } from '../src/types';
import { audit } from '../src/consistency';
import { ledgerCheck } from '../src/econ';
import { choose } from '../src/encounters';

for (const seed of [3, 7]) for (const days of [35, 70]) {
  const w = createWorld(seed, 'Tony Marino');
  const t0 = Date.now();
  const p = w.chars[w.playerId!];
  if (process.argv.includes('r')) p.cash = 6000;
  if (process.argv.includes('s')) {
    // a sociable player: he keeps up with his capo and the men in his crew, and answers yes to every approach
    for (let d = 0; d < days; d++) {
      for (const c of Object.values(w.chars)) if (c.alive && !c.isPlayer && (c.id === p.bossId || c.bossId === p.bossId)) { const r = (c.rels[p.id] ??= { trust: 0.5, respect: 0.4, affection: 0.4, grudge: 0, lastMet: w.now }); r.trust = Math.max(r.trust, 0.5); r.lastMet = w.now; }
      advance(w, w.now + DAY);
      for (const e of w.enc.filter((x) => x.status === 'open' && (x.data?.what === 'goal' || x.kind === 'ask'))) { const r = choose(w, p, e, process.argv.includes('n') ? 'no' : 'yes'); if (process.argv.includes('v')) console.log(`   d${Math.floor(w.now / DAY)} ${e.title}: ${e.lines.join(' ')} -> ${r.lines.join(' ')}`); }
    }
  } else advance(w, w.now + days * DAY);
  const a = agencyOf(w), s = a.stats;
  const row = KINDS.map((k) => `${k.slice(0, 5)} s${s['started.' + k] ?? 0}/d${s['done.' + k] ?? 0}/f${s['failed.' + k] ?? 0}/x${s['dropped.' + k] ?? 0}/a${a.goals.filter((g) => g.kind === k).length}`).join('  ');
  const ends = Object.values(w.facts).filter((f) => /^goal:/.test(String(f.story ?? ''))).length;
  const known = Object.values(w.facts).filter((f) => /^goal:/.test(String(f.story ?? '')) && Object.values(w.chars).some((c) => c.id !== f.actor && c.known[f.id])).length;
  const toPlayer = w.enc.filter((e) => e.data?.what === 'goal' || (e.kind === 'ask' && e.data?.goal)).length;
  console.log(`seed ${seed} ${days}d: active ${a.goals.length}, ${row}`);
  console.log(`   asks shown ${s['ask.shown'] ?? 0} acc ${s['ask.accepted'] ?? 0} ref ${s['ask.refused'] ?? 0}; goal facts ${ends} (known by others ${known}); goal encs ${toPlayer}; npc asks ${s['npcask'] ?? 0}; audit ${audit(w).length} ledger ${ledgerCheck(w).length}; ${Date.now() - t0}ms`);
  if (process.argv[2] === 'v') {
    const why: Record<string, number> = {};
    for (const e of a.ended) why[`${e.kind}:${e.how}:${e.why}`] = (why[`${e.kind}:${e.how}:${e.why}`] ?? 0) + 1;
    console.log(why);
    const st: Record<string, number> = {};
    for (const g of a.goals) st[`${g.kind}/${g.stage}`] = (st[`${g.kind}/${g.stage}`] ?? 0) + 1;
    console.log(st);
    console.log(w.enc.filter((e) => e.data?.what === 'goal' || e.kind === 'ask').map((e) => `d${Math.floor(e.t / DAY)} ${e.title} [${e.status}]`).join('\n'));
  }
}
