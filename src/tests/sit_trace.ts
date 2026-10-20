// V75 traces: a few situations followed from cause to consequence. Usage: tsx src/tests/sit_trace.ts
import { advance } from '../engine';
import { createWorld } from '../world';
import { DAY, Situation, World } from '../types';
import { createDebt, rel } from '../core';
import { crewChoose } from '../crewlife';
import { isOpen, promotedOver, sitDay, skimNoticed, spawn, tell, titleOf } from '../situ';
import { doMove, movesFor } from '../sitmoves';

const P = (w: World) => w.chars[w.playerId!];
const day = (w: World, t: number) => 'day ' + Math.floor((t - 0) / DAY);
const fresh = (seed: number, days: number) => { const w = createWorld(seed, 'Tony Marino'); advance(w, w.now + days * DAY); w.situations = (w.situations ?? []).filter((s) => !s.key); w.sitcool = {}; return w; };
const pair = (w: World) => { const c = Object.values(w.chars).find((x) => x.alive && !x.isPlayer && x.rank === 'soldier' && x.familyId && x.bossId && w.chars[x.bossId]?.alive && !w.chars[x.bossId].isPlayer)!; return { c, boss: w.chars[c.bossId!] }; };
const show = (w: World, s: Situation) => {
  console.log(`  cause: ${s.cause}`); console.log(`  parties: ${(s.parties ?? []).map((p) => p.role + '=' + w.chars[p.id].name).join(', ')}`);
  console.log(`  who knew what: ${Object.entries(s.k ?? {}).map(([id, k]) => `${w.chars[id].name} (${k.l === 2 ? 'knows' : 'suspects'}, ${k.via})`).join('; ')}`);
  console.log(`  claims: ${(s.claims ?? []).map((c) => `${w.chars[c.by].name}: "${c.text}" [${c.honest ? 'true' : 'false - hidden from everyone'}]`).join(' | ') || '-'}`);
  console.log(`  history: ${(s.hist ?? []).map((h) => `\n    ${day(w, h.t)}: ${h.text}`).join('')}`);
  console.log(`  outcome: ${s.out ?? 'still open (' + s.phase + ')'}; consequences: ${(s.cons ?? []).join('; ') || '-'}`);
};
const drive = (w: World, s: Situation, n = 30) => { for (let i = 0; i < n && isOpen(s) && s.stage !== 'asking'; i++) { w.now = Math.max(w.now, s.next ?? w.now); sitDay(w); } };
const skim = (seed: number, guilty: boolean, label: string) => {
  const w = fresh(seed, 16); const { c, boss } = pair(w);
  if (guilty) (c.books as { skim?: unknown }).skim = { until: w.now + 60 * DAY, frac: 0.3 };
  const witness = Object.values(w.chars).find((q) => q.alive && !q.isPlayer && q.bossId === c.id);
  console.log(`\n=== ${label} (seed ${seed}) ===\n  ${boss.name} (boss) and ${c.name} (soldier, ${guilty ? 'actually skimming' : 'honest, trade is just slow'}).${witness ? ` ${witness.name} works under ${c.name}.` : ''}`);
  const f = tell(w, { id: 'x', stage: 'handling', cause: '', since: w.now } as Situation, `${boss.name} noticed ${c.name}'s numbers don't add up. About $280 has gone missing.`, { kind: 'shortfall' });
  const t0 = c.cash, tr0 = rel(c, boss.id).trust, g0 = rel(c, boss.id).grudge;
  skimNoticed(w, boss, c, { amt: 280, n: 1 }, f.id); const s = w.situations!.find((x) => x.kind === 'skim')!;
  drive(w, s); show(w, s);
  console.log(`  persistent: ${c.name} trust in boss ${tr0.toFixed(2)}→${rel(c, boss.id).trust.toFixed(2)}, grudge ${g0.toFixed(2)}→${rel(c, boss.id).grudge.toFixed(2)}, cash ${t0}→${c.cash}, still in the family: ${c.familyId === boss.familyId}`);
  console.log(`  does the player know? ${P(w).known[Object.keys(w.facts).find((id) => w.facts[id].story === 'sit:' + s.id && P(w).known[id])!] ? 'yes' : 'no - nobody told him'}`);
};
skim(2, true, 'TRACE 1: a skimming matter that unravels');
skim(4, false, 'TRACE 2: an innocent man under suspicion');
skim(6, true, 'TRACE 3: the same matter, another boss and another roll');

{ // late tribute
  const w = fresh(3, 16); const { boss } = pair(w);
  const b = Object.values(w.biz).find((q) => q.open && q.protection && q.kind !== 'casino' && w.chars[q.ownerId]?.alive && !w.chars[q.ownerId].isPlayer && q.ownerId !== q.protection.collectorId)!;
  const col = w.chars[b.protection!.collectorId], o = w.chars[b.ownerId]; col.traits.violence = 0.8;
  b.protection!.owed = b.protection!.fee * 5; b.protection!.late = 4; b.protection!.why = 'unable';
  console.log(`\n=== TRACE 4: a shop that cannot pay ===\n  ${o.name} owns ${b.name}; ${col.name} collects for the family; ${boss.name} sits above.`);
  const s = spawn(w, 'tribute', `tribute:${b.id}`, o.id, { cause: `${b.name} is behind on what it owes ${col.name}`, parties: [{ id: col.id, role: 'collector' }, { id: o.id, role: 'owner' }], sev: 0.4, phase: 'late', next: w.now, biz: b.id, truth: 'unable', amt: b.protection!.owed })!; s.stage = 'handling';
  const gr0 = rel(o, col.id).grudge; drive(w, s); show(w, s);
  console.log(`  persistent: ${o.name}'s grudge against ${col.name} ${gr0.toFixed(2)}→${rel(o, col.id).grudge.toFixed(2)}; arrears now ${b.protection?.owed ?? 0}; stakes ${JSON.stringify((b.stakes ?? []).map((x) => [w.chars[x.holder].name, x.share]))}; owner now ${w.chars[b.ownerId].name}`);
}
{ // debt
  const w = fresh(2, 16); const { c } = pair(w);
  const cr = Object.values(w.chars).find((q) => q.alive && !q.isPlayer && q.id !== c.id && q.cash > 800 && q.familyId === c.familyId && q.bossId && w.chars[q.bossId]?.alive)!;
  const d = createDebt(w, cr.id, c.id, 600, 0.02, 'a loan'); d.missed = 3; d.weeklyPayment = 60;
  console.log(`\n=== TRACE 5: a loan that has gone bad ===\n  ${cr.name} lent ${c.name} 600; ${c.name} has missed three payments.`);
  const s = spawn(w, 'debt', `debt:${d.id}`, c.id, { cause: `${c.name} is behind on what he owes ${cr.name}`, parties: [{ id: cr.id, role: 'creditor' }, { id: c.id, role: 'debtor' }], sev: 0.3, phase: 'missed', next: w.now, link: { debt: d.id }, truth: 'unable' })!; s.stage = 'handling';
  drive(w, s); show(w, s); console.log(`  persistent: debt balance ${d.balance}, weekly ${d.weeklyPayment}, status ${d.status}`);
}
{ // the player decides
  for (const choice of ['p:placate', 'p:reprimand']) {
    const w = fresh(11, 16); const p = P(w);
    const m = Object.values(w.chars).filter((q) => q.alive && !q.isPlayer && q.familyId === p.familyId && q.rank !== 'civilian'); const [c, x] = m;
    c.traits.ambition = 0.9; c.traits.courage = 0.9; rel(c, x.id).grudge = 0.5; p.cash = 2000;
    promotedOver(w, x, x.rank);
    const s = spawn(w, 'grudge', `grudge:${c.id}:${x.id}`, c.id, { cause: `${c.name} was passed over when ${x.name} was made`, parties: [{ id: p.id, role: 'boss' }, { id: c.id, role: 'rival' }, { id: x.id, role: 'winner' }], sev: 0.35, phase: 'sulk', next: w.now })!; s.stage = 'handling';
    if (choice === 'p:placate') console.log(`\n=== TRACE 6: the player is asked to decide (${c.name} resents ${x.name}; the player runs the crew) ===`);
    drive(w, s); const e = w.enc.find((q) => q.id === s.ask);
    if (!e) { console.log('  (no question reached the player in this run)'); continue; }
    console.log(`  question to the player: ${e.title}\n  options: ${e.opts.map((o) => o.label + ' — ' + o.hint).join(' / ')}`);
    const c0 = c.cash, t0 = rel(c, p.id).trust; const lines = crewChoose(w, p, e, choice);
    console.log(`  player chooses "${choice.slice(2)}": ${lines.join(' ')}`); show(w, s);
    console.log(`  persistent: ${c.name} cash ${c0}→${c.cash}, trust in the player ${t0.toFixed(2)}→${rel(c, p.id).trust.toFixed(2)}, backer=${c.backer === p.id ? 'the player' : '-'}`);
  }
}
{ // player-initiated
  const w = fresh(2, 16); const p = P(w); const { c, boss } = pair(w); p.rank = 'capo';
  (c.books as { skim?: unknown }).skim = { until: w.now + 60 * DAY, frac: 0.3 };
  const f = tell(w, { id: 'x', stage: 'handling', cause: '', since: w.now } as Situation, `${boss.name} noticed ${c.name}'s numbers don't add up. About $280 has gone missing.`, { kind: 'shortfall' }); skimNoticed(w, boss, c, { amt: 280, n: 1 }, f.id);
  const s = w.situations!.find((x) => x.kind === 'skim')!; drive(w, s, 1);
  console.log(`\n=== TRACE 7: the player gets involved on his own initiative ===\n  matter: ${titleOf(w, s)}`);
  console.log(`  before he hears of it, moves open to him: ${movesFor(w, p, s).map((m) => m.label).join(' / ')}`);
  const friend = Object.values(w.chars).find((q) => q.alive && !q.isPlayer && q.id !== boss.id && q.id !== c.id)!;
  for (const id of Object.keys(w.facts)) if (w.facts[id].story === 'sit:' + s.id) friend.known[id] = { from: 'saw', t: w.now, knowsActor: true } as never;
  s.k![friend.id] = { l: 2, via: 'saw', t: w.now - 5 * DAY }; rel(friend, p.id).trust = 0.8;
  console.log(`  asks around: ${doMove(w, p, s.id, 'inquire').lines.join(' ')}`);
  rel(boss, p.id).respect = 0.7; rel(c, p.id).respect = 0.7;
  console.log(`  offers to settle: ${doMove(w, p, s.id, 'mediate').lines.join(' ')}`); show(w, s);
}
process.exit(0);
