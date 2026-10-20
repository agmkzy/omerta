// Long-run stress test: a random-ish player plays many days; report what the economy, the ladder and the scenes did.
// Usage: tsx src/stress.ts [seed] [days]
import { AMBITIONS } from './ambition';
import { assign, approaches, resolve, takeJob, schemes, startScheme, performMove } from './jobs';
import { choose as encChoose } from './encounters';
import { advance } from './engine';
import { money } from './core';
import { OPS, canStart, startOp } from './rackets';
import { orderMenu, giveOrder } from './orders';
import { activityOf } from './jobs';
import { audit } from './consistency';
import { createWorld } from './world';

const seed = Number(process.argv[2] ?? 1);
const days = Number(process.argv[3] ?? 300);
const t0 = Date.now();
const w = createWorld(seed);
const p = w.chars[w.playerId!];
const st: Record<string, number> = {};
const bump = (k: string) => (st[k] = (st[k] ?? 0) + 1);
const curve: string[] = [];
const viol = new Map<string, number>();
let lastRank = p.rank;
let rankDay: Record<string, number> = {};
while (w.now < days * 1440 && p.alive) {
  const crew = Object.values(w.chars).filter((c) => c.alive && c.bossId === p.id && c.jailedUntil <= w.now);
  for (const e of w.enc.filter((x) => x.status === 'open')) {
    const o = w.rng.pick(e.opts);
    encChoose(w, p, e, o.code);
    bump('enc:' + e.kind);
  }
  let spent = 0;
  for (const j of w.jobs.filter((x) => x.status === 'offered')) {
    if (w.rng.chance(0.3) || j.kind === 'summons') continue;
    if (j.kind === 'hit') { j.status = 'declined'; continue; }
    if (crew.length && w.rng.chance(0.5)) { const e = assign(w, j, w.rng.pick(crew).id, 'quiet'); bump(e ? 'deleg-blocked' : 'deleg'); continue; }
    const ap = approaches(w, j);
    if (!ap.length) continue;
    takeJob(w, j);
    const r = resolve(w, j, w.rng.pick(ap).code);
    spent += r.minutes;
    bump(r.ok ? 'job-ok' : 'job-fail');
  }
  // start rackets when affordable
  for (const k of Object.keys(OPS) as (keyof typeof OPS)[]) {
    if (!canStart(w, p, k, p.district) && p.cash > OPS[k].cost + 800 && w.rng.chance(0.5)) { startOp(w, p, k, p.district, crew.length ? crew[0].id : null); bump('op:' + k); }
  }
  // lean on shops
  if (w.rng.chance(0.25)) {
    const m = orderMenu(w, p).filter((o) => o.label.startsWith('Lean'));
    const free = crew.filter((c) => !activityOf(w, c));
    if (m.length && free.length) { const r = giveOrder(w, p, free[0], m[0], 'quiet'); bump(typeof r === 'string' ? 'order-blocked' : 'lean-order'); }
  }
  if (w.rng.chance(0.3)) {
    const s = schemes(w, p); const o = w.rng.pick(s);
    if (o.job) { const j = startScheme(w, p, o.job); const r = resolve(w, j, w.rng.pick(approaches(w, j)).code); spent += r.minutes; } else if (o.move) spent += performMove(w, o.move).minutes;
  }
  advance(w, w.now + Math.max(spent, 12 * 60));
  for (const v of audit(w)) viol.set(v, (viol.get(v) ?? 0) + 1);
  if (p.rank !== lastRank) { rankDay[p.rank] = Math.floor(w.now / 1440); lastRank = p.rank; }
  const d = Math.floor(w.now / 1440);
  if (d % 50 === 0 && !curve.some((c) => c.startsWith('d' + d + ' '))) curve.push(`d${d} ${money(p.cash)}`);
}
const deadN = Object.values(w.chars).filter((c) => !c.alive).length;
const deadByKind = Object.values(w.facts).filter((f) => f.kind === 'murder').length;
const maxTension = Math.max(0, ...Object.values(w.fam).flatMap((f) => Object.values(f.tension)));
const done = Object.keys(w.goals?.done ?? {}).length;
console.log(`seed ${seed} | ${p.alive ? 'alive' : 'DEAD'} day ${Math.floor(w.now / 1440)} | ${p.rank} (${JSON.stringify(rankDay)}) | cash ${money(p.cash)} | standing ${Math.round(p.standing)} | heat ${p.heat.toFixed(2)} | ambitions ${done}/${AMBITIONS.length} | npc dead ${deadN} (murders ${deadByKind}) | max tension ${maxTension.toFixed(1)} | ${((Date.now() - t0) / 1000).toFixed(0)}s`);
console.log('  cash curve:', curve.join('  '));
console.log('  actions:', JSON.stringify(st));
console.log('  open enc left:', w.enc.filter((e) => e.status === 'open').length, ' ops:', w.ops.filter((o) => o.state !== 'closed').length, ' threats:', Object.keys(w.threats).length);
console.log('  audit violations:', viol.size, [...viol.entries()].slice(0, 8));
console.log('  agency asks:', JSON.stringify(Object.fromEntries(Object.entries(w.agency?.stats ?? {}).filter(([k]) => k.startsWith('ask.') || k === 'recruit' || k === 'acq' || k === 'stake'))));
