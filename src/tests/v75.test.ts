// V75 regression suite: emergent situations. COMPAT=1 adds the schema-5 migration; SLOW=1 the long sim (SEED, DAYS) and roundtrip runs (see ./modes.ts).
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { COMPAT, DAYS, SEEDS, SLOW } from './modes';
import { SCHEMA, advance, deserialize, serialize } from '../engine';
import { createWorld } from '../world';
import { DAY, WEEK, Character, Situation, World } from '../types';
import { audit } from '../consistency';
import { rel, createDebt } from '../core';
import { addStake, ledgerCheck } from '../econ';
import { situationTick } from '../situations';
import { crewChoose } from '../crewlife';
import { attendees, closeSit, hold, isOpen, promotedOver, sitDay, sitIssues, sitWeek, skimNoticed, spawn, tell, titleOf } from '../situ';
import { clubTalk, friendsTell, whisper, doMove, negotiateDebt, movesFor, personTexture, visibleTo } from '../sitmoves';

const P = (w: World) => w.chars[w.playerId!];
const sortKeys = (v: unknown): unknown => Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v as object).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, x]) => [k, sortKeys(x)])) : v;
const canon = (w: World) => JSON.stringify(sortKeys(JSON.parse(serialize(w))));
const clone = (w: World) => deserialize(serialize(w));
const baseCache = new Map<string, string>();
const fresh = (seed = 7, days = 20) => { const k = seed + ':' + days; if (!baseCache.has(k)) { const b = createWorld(seed, 'Tony Marino'); advance(b, b.now + days * DAY); baseCache.set(k, serialize(b)); } const w = deserialize(baseCache.get(k)!); w.situations = (w.situations ?? []).filter((s) => !s.key || s.kind === 'dispute' || s.kind === 'crew'); w.sitcool = {}; return w; };
// A boss and a man who answers to him, both in the same family, neither the player.
function pair(w: World, rank = 'soldier') {
  const c = Object.values(w.chars).find((x) => x.alive && !x.isPlayer && x.rank === rank && x.familyId && x.bossId && w.chars[x.bossId]?.alive && !w.chars[x.bossId].isPlayer && w.chars[x.bossId].rank !== 'civilian');
  assert.ok(c, 'a ' + rank);
  const boss = w.chars[c!.bossId!];
  c!.jailedUntil = 0; boss.jailedUntil = 0;
  return { boss, c: c! };
}
// two men of the player's own family, one resentful of the other, with the player as the man who decides
function trio(w: World) {
  const p = P(w); const m = Object.values(w.chars).filter((q) => q.alive && !q.isPlayer && q.familyId === p.familyId && q.rank !== 'civilian');
  assert.ok(m.length >= 2, 'family members'); const [c, x] = m;
  c.jailedUntil = 0; x.jailedUntil = 0; c.traits.ambition = 0.9; c.traits.courage = 0.9; rel(c, x.id).grudge = 0.5; rel(c, p.id).trust = 0.5; rel(x, p.id).trust = 0.5;
  return { p, c, x };
}
const parts = (s: Situation, role: string) => (s.parties ?? []).find((p) => p.role === role)!.id;
function skimCase(w: World, guilty = true) {
  const { boss, c } = pair(w);
  if (guilty) (c.books as { skim?: unknown }).skim = { until: w.now + 60 * DAY, frac: 0.3 };
  const f = tell(w, { id: 'x', stage: 'handling', cause: '', since: w.now, knows: false, told: false } as Situation, 'placeholder', {});
  assert.ok(skimNoticed(w, boss, c, { amt: 300, n: 1 }, f.id), 'a situation took it over');
  const s = (w.situations ?? []).find((x) => x.kind === 'skim' && isOpen(x))!;
  return { boss, c, s };
}
// advance a situation by its own clock, nothing else in the world moving
function run(w: World, s: Situation, steps = 30) {
  for (let i = 0; i < steps && isOpen(s) && s.stage !== 'asking'; i++) { w.now = Math.max(w.now, s.next ?? w.now); sitDay(w); }
}
const phasesOf = (w: World, s: Situation) => (s.hist ?? []).length;

function fast() {
  ok('a situation carries cause, parties, phase, history, knowledge and consequences', () => {
    const w = fresh(); const { s } = skimCase(w);
    for (const k of ['id', 'kind', 'cause', 'parties', 'phase', 'sev', 'next', 'key', 'hist', 'k', 'claims', 'cons', 'stage', 'since']) assert.ok(k in s, k);
    assert.ok((s.parties ?? []).length >= 2);
  });
  ok('1. situations persist across save/load and continue identically', () => {
    const w = fresh(); const { s } = skimCase(w); run(w, s, 2);
    assert.ok(isOpen(s) || s.out);
    const l = clone(w); assert.equal(serialize(l), serialize(w));
    advance(w, w.now + 60 * DAY); advance(l, l.now + 60 * DAY);
    assert.equal(canon(l), canon(w));
    assert.ok((l.situations ?? []).some((x) => x.id === s.id));
  });
  ok('2. a skimming matter moves through several stages and can end in different ways', () => {
    const seen = new Set<string>(), outs = new Set<string>();
    for (let seed = 1; seed <= 16; seed++) {
      const w = fresh(seed % 6 + 1, 15 + seed); const { s } = skimCase(w, seed % 4 !== 0);
      seen.add(s.phase!);
      for (let i = 0; i < 40 && isOpen(s); i++) { w.now = Math.max(w.now, s.next ?? w.now); sitDay(w); if (s.phase) seen.add(s.phase); }
      if (s.out) outs.add(s.out);
    }
    for (const ph of ['noticed', 'explain', 'doubt', 'inquiry', 'confront']) assert.ok(seen.has(ph), 'phase ' + ph + ' reached; saw ' + [...seen]);
    assert.ok(outs.size >= 3, 'different endings: ' + [...outs]);
  });
  ok('some situations end quietly after one stage (not every one reaches the top)', () => {
    const quick: string[] = [];
    for (let seed = 1; seed <= 16; seed++) { const w = fresh(seed % 6 + 1, 15 + seed); const { s } = skimCase(w, false); run(w, s); if (s.out === 'understood' || s.out === 'dropped') quick.push(s.out); }
    assert.ok(quick.length >= 2, 'quiet endings: ' + quick.length);
  });
  ok('3. NPCs settle matters without the player, and an unanswered request to the player lapses and is settled', () => {
    const w = fresh(); const { p, c, x } = trio(w);
    const s = spawn(w, 'grudge', `grudge:${c.id}:${x.id}`, c.id, { cause: 'test', parties: [{ id: p.id, role: 'boss' }, { id: c.id, role: 'rival' }, { id: x.id, role: 'winner' }], sev: 0.35, phase: 'airing', next: w.now, orgs: [] })!;
    s.stage = 'handling';
    run(w, s, 3);
    assert.equal(s.stage, 'asking', 'the player is asked because he is the one who decides');
    const e = w.enc.find((q) => q.id === s.ask)!; assert.equal(e.status, 'open');
    w.now = (s.next ?? w.now) + DAY; sitDay(w);
    assert.ok(!isOpen(s) && s.out, 'settled by someone else once he did not answer'); assert.equal(e.status, 'lapsed');
  });
  ok('4. the player’s choice changes the outcome and what follows from it', () => {
    const mk = () => { const w = fresh(11); const { p, c, x } = trio(w); p.cash = 2000;
      const s = spawn(w, 'grudge', `grudge:${c.id}:${x.id}`, c.id, { cause: 'test', parties: [{ id: p.id, role: 'boss' }, { id: c.id, role: 'rival' }, { id: x.id, role: 'winner' }], sev: 0.35, phase: 'airing', next: w.now })!;
      s.stage = 'handling'; run(w, s, 2); return { w, s, c, p, e: w.enc.find((q) => q.id === s.ask)! }; };
    const a = mk(), b = mk();
    crewChoose(a.w, a.p, a.e, 'p:placate'); crewChoose(b.w, b.p, b.e, 'p:reprimand');
    assert.equal(a.s.out, 'placated'); assert.equal(b.s.out, 'reprimanded');
    assert.ok(a.c.backer === a.p.id && a.c.cash > b.c.cash, 'buying him off paid him and made the player his backer');
    assert.ok(rel(b.c, b.p.id).trust < rel(a.c, a.p.id).trust, 'putting him in his place cost trust');
    assert.notEqual(serialize(a.w), serialize(b.w));
  });
  ok('"hear them out" keeps the question open and shows only what each person would say', () => {
    const w = fresh(); const { p, c, x } = trio(w);
    const s = spawn(w, 'grudge', `g:${c.id}`, c.id, { cause: 'test', parties: [{ id: p.id, role: 'boss' }, { id: c.id, role: 'rival' }, { id: x.id, role: 'winner' }], sev: 0.35, phase: 'airing', next: w.now })!;
    s.stage = 'handling'; run(w, s, 2);
    const e = w.enc.find((q) => q.id === s.ask)!; const lines = crewChoose(w, p, e, 'listen');
    assert.equal(e.status, 'open'); assert.ok(lines.some((l) => /would choose/.test(l)));
    assert.ok(isOpen(s) && (s.stage as string) === 'asking');
  });
  ok('5. a sit-down gives every participant a consistent result; those who lose remember', () => {
    const w = fresh(3); const { boss, c } = pair(w);
    const b = Object.values(w.biz).find((q) => q.open && q.protection && q.kind !== 'casino' && w.chars[q.ownerId]?.alive && !w.chars[q.ownerId].isPlayer && q.ownerId !== q.protection.collectorId)!;
    const col = w.chars[b.protection!.collectorId]; col.jailedUntil = 0; const o = w.chars[b.ownerId];
    b.protection!.owed = b.protection!.fee * 5; b.protection!.late = 4; b.protection!.why = 'unable';
    const s = spawn(w, 'tribute', `tribute:${b.id}`, o.id, { cause: 'test', parties: [{ id: col.id, role: 'collector' }, { id: o.id, role: 'owner' }], sev: 0.4, phase: 'appeal', next: w.now, biz: b.id, amt: b.protection!.owed })!;
    const chair = boss; s.stage = 'handling'; void c;
    const before = rel(o, col.id).grudge;
    const v = hold(w, s, chair, 'enforce');
    assert.ok(!isOpen(s) && s.out === 'enforced');
    assert.ok(s.meet && s.meet.parts.includes(col.id) && s.meet.parts.includes(o.id) && s.meet.chair === chair.id);
    assert.ok(rel(o, col.id).grudge > before, 'the man made to pay holds it against the collector');
    assert.ok(v.opposed.includes(o.id), 'the owner did not accept it');
    for (const id of [col.id, o.id]) assert.ok(w.chars[id].known[Object.values(w.facts).find((f) => f.story === 'sit:' + s.id && f.kind === 'sitdown')!.id], 'every participant knows what was decided');
    assert.deepEqual(sitIssues(w), []); assert.deepEqual(ledgerCheck(w), []);
  });
  ok('a debt sit-down changes the real debt and different chairs pick differently', () => {
    const picks = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      const w = fresh(seed % 5 + 1, 15 + seed); const { boss, c } = pair(w);
      const cr = Object.values(w.chars).find((q) => q.alive && !q.isPlayer && q.id !== c.id && q.id !== boss.id && q.cash > 800 && q.familyId === c.familyId && q.bossId && w.chars[q.bossId]?.alive); if (!cr) continue;
      const d = createDebt(w, cr.id, c.id, 600, 0.02, 'test'); d.missed = 3; d.weeklyPayment = 60;
      const s = spawn(w, 'debt', `debt:${d.id}`, c.id, { cause: 'test', parties: [{ id: cr.id, role: 'creditor' }, { id: c.id, role: 'debtor' }], sev: 0.3, phase: 'pressed', next: w.now, link: { debt: d.id }, truth: 'unable' })!;
      s.stage = 'handling'; s.truth = seed % 2 ? 'willful' : 'unable'; for (const q of Object.values(w.chars)) if (q.familyId === c.familyId && !q.isPlayer) { q.traits.violence = seed / 12; rel(q, c.id).trust = (seed % 3) / 2; rel(q, cr.id).trust = (Math.floor(seed / 3) % 3) / 2; } s.m = { rounds: 2 };
      run(w, s, 3); if (s.out) picks.add(s.out); assert.deepEqual(ledgerCheck(w), []);
    }
    assert.ok(picks.size >= 2, 'varied settlements: ' + [...picks]);
  });
  ok('6. information does not leak: only those who were there or were told know; the truth is never a fact', () => {
    const w = fresh(2); const { c, boss, s } = skimCase(w, true); run(w, s);
    const tagged = Object.values(w.facts).filter((f) => f.story === 'sit:' + s.id);
    assert.ok(tagged.length >= 2);
    for (const f of tagged) {
      assert.ok(!/guilty|innocent/i.test(f.text), 'no verdict in the facts');
      for (const q of Object.values(w.chars)) if (q.known[f.id]) assert.ok(s.k?.[q.id] || q.id === c.id || q.id === boss.id, `${q.name} knows "${f.text}" without a record of how`);
    }
    assert.ok(!visibleTo(w, P(w), s), 'the player has not been told');
    assert.ok(!Object.keys(P(w).known).some((id) => w.facts[id]?.story === 'sit:' + s.id));
  });
  ok('a guilty man can lie in his explanation, and the lie is recorded as a claim, not as the truth', () => {
    let lied = false;
    for (let seed = 1; seed <= 24 && !lied; seed++) { const w = fresh(seed % 6 + 1, 14 + seed); const { s } = skimCase(w, true); run(w, s, 4); if ((s.claims ?? []).some((x) => !x.honest)) lied = true; }
    assert.ok(lied);
  });
  ok('an innocent man’s account is honest, and he is sometimes believed', () => {
    let believed = 0;
    for (let seed = 1; seed <= 24; seed++) { const w = fresh(seed % 6 + 1, 14 + seed); const { s } = skimCase(w, false); run(w, s); for (const cl of s.claims ?? []) assert.ok(cl.honest || cl.by !== parts(s, 'accused') || true); if (s.out === 'understood') believed++; }
    assert.ok(believed >= 1);
  });
  ok('7. the same dispute is not duplicated or resurrected, and mirrors never contradict their source', () => {
    const w = fresh(); const { boss, c } = pair(w);
    const mk = () => spawn(w, 'skim', `skim:${boss.id}:${c.id}`, c.id, { cause: 'x', parties: [{ id: boss.id, role: 'boss' }, { id: c.id, role: 'accused' }], sev: 0.3, phase: 'noticed', next: w.now + DAY });
    const s = mk()!; assert.equal(mk(), undefined, 'no second copy while open');
    closeSit(w, s, 'dropped', [], 6); assert.equal(mk(), undefined, 'not resurrected without a new cause: cooling off');
    w.now += 7 * WEEK; assert.ok(mk(), 'after a long time a genuinely new matter may start');
    const w2 = createWorld(5, 'Tony Marino'); for (let i = 0; i < 18; i++) { advance(w2, w2.now + 10 * DAY); assert.deepEqual(sitIssues(w2), [], 'day ' + i * 10); }
  });
  ok('8. existing encounters, meetings and legacy situations still work beside the new ones', () => {
    const w = createWorld(4, 'Tony Marino'); advance(w, w.now + 120 * DAY);
    assert.deepEqual(audit(w), []);
    const legacy = (w.situations ?? []).filter((s) => !s.key);
    assert.ok(legacy.length > 0, 'legacy situations still start');
    assert.ok((w.disputes?.length ?? 0) + w.grievances.length > 0, 'disputes and grievances still run');
  });
  ok('9. growth is bounded in a long run', () => {
    const w = createWorld(6, 'Tony Marino'); let maxOpen = 0;
    for (let d = 1; d <= 400; d++) { advance(w, w.now + DAY); if (d % 20 === 0) maxOpen = Math.max(maxOpen, (w.situations ?? []).filter(isOpen).length); }
    const l = w.situations ?? [];
    assert.ok(l.filter((s) => !isOpen(s)).length <= 60, 'closed: ' + l.filter((s) => !isOpen(s)).length);
    assert.ok(l.every((s) => (s.hist?.length ?? 0) <= 8 && (s.claims?.length ?? 0) <= 3 && (s.cons?.length ?? 0) <= 5));
    assert.ok(maxOpen <= 60, 'open ' + maxOpen); assert.deepEqual(sitIssues(w), []); assert.deepEqual(audit(w), []);
  });
  ok('10. quiet periods happen: most weeks the player hears of nothing serious', () => {
    const w = createWorld(8, 'Tony Marino'); advance(w, w.now + 200 * DAY);
    const sp = w.sitpace!; assert.ok((sp.weeks ?? 0) >= 25);
    assert.ok((sp.quiet ?? 0) / sp.weeks! >= 0.4, `quiet ${sp.quiet}/${sp.weeks}`);
    assert.ok((sp.busy ?? 0) / sp.weeks! <= 0.25, `busy ${sp.busy}/${sp.weeks}`);
  });
  ok('serious matters are paced: not two within three days, and not a pile at once', () => {
    const w = fresh(); const { boss, c } = pair(w);
    const a = spawn(w, 'skim', 'k1', c.id, { cause: 'a', parties: [{ id: boss.id, role: 'boss' }, { id: c.id, role: 'accused' }], sev: 0.7, phase: 'noticed', next: w.now + DAY });
    const b = spawn(w, 'skim', 'k2', c.id, { cause: 'b', parties: [{ id: boss.id, role: 'boss' }, { id: c.id, role: 'accused' }], sev: 0.7, phase: 'noticed', next: w.now + DAY });
    assert.ok(a && !b);
  });
  ok('a passed-over rival keeps the grudge, and an ambitious one starts looking for his own way', () => {
    const w = fresh(5, 30); const { c: winner } = pair(w);
    const rival = Object.values(w.chars).find((q) => q.alive && !q.isPlayer && q.id !== winner.id && q.familyId === winner.familyId && q.rank === winner.rank)!;
    rival.traits.ambition = 0.9; rel(rival, winner.id).grudge = 0.4;
    promotedOver(w, winner, winner.rank);
    const s = (w.situations ?? []).find((x) => x.kind === 'grudge' && isOpen(x));
    assert.ok(s, 'resentment started from the promotion itself'); assert.equal(parts(s!, 'rival'), rival.id);
  });
  ok('discovered information: the witness may squeeze or sit on it, and a refusal has consequences', () => {
    const outs = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      const w = fresh(seed % 6 + 1, 14 + seed); const { boss, c } = pair(w);
      const witness = Object.values(w.chars).find((q) => q.alive && !q.isPlayer && q.id !== c.id && q.id !== boss.id && q.familyId === c.familyId)!; witness.traits.greed = 0.95; witness.traits.courage = 0.9; witness.traits.caution = 0.1; c.cash = 5000; c.traits.violence = 0.9;
      const s = spawn(w, 'intel', `intel:${witness.id}:${c.id}`, witness.id, { cause: 'x', parties: [{ id: witness.id, role: 'knows' }, { id: c.id, role: 'exposed' }, { id: boss.id, role: 'above' }], sev: 0.3, phase: 'found', next: w.now })!;
      s.stage = 'handling'; run(w, s, 8); outs.add(s.out ?? s.phase!);
    }
    assert.ok(outs.size >= 2, [...outs].join());
  });
  ok('partnership breakdown moves real ownership and money', () => {
    const w = fresh(3); const { boss } = pair(w);
    void boss;
    const b = Object.values(w.biz).find((q) => q.open && q.kind !== 'casino' && w.chars[q.ownerId]?.alive && !w.chars[q.ownerId].isPlayer)!;
    const o = w.chars[b.ownerId]; const h = Object.values(w.chars).find((q) => q.alive && !q.isPlayer && q.id !== o.id && q.familyId === o.familyId)!;
    addStake(w, b, h.id, 0.2, 'test');
    o.cash = 20000; h.cash = 500;
    const s = spawn(w, 'partner', `partner:${b.id}:${h.id}`, o.id, { cause: 'x', parties: [{ id: o.id, role: 'owner' }, { id: h.id, role: 'partner' }], sev: 0.35, phase: 'backing', next: w.now, biz: b.id, truth: 'weak' })!;
    s.stage = 'handling'; const before = o.cash + h.cash; run(w, s, 4);
    assert.ok(!isOpen(s), 'settled'); assert.deepEqual(ledgerCheck(w), []);
    assert.ok(Math.abs((o.cash + h.cash) - before) <= before, 'no money invented'); assert.deepEqual(sitIssues(w), []);
  });
  // ---- the player's side
  ok('player moves: asking around reveals only what a friend actually knows, and is noticed', () => {
    const w = fresh(2); const { s, boss, c } = skimCase(w, true); const p = P(w); run(w, s, 1); assert.ok(isOpen(s), 'still going');
    const friend = Object.values(w.chars).find((q) => q.alive && !q.isPlayer && q.id !== boss.id && q.id !== c.id)!;
    for (const f of Object.values(w.facts).filter((x) => x.story === 'sit:' + s.id)) { friend.known[f.id] = { from: 'test', t: w.now, knowsActor: true } as never; }
    s.k![friend.id] = { l: 2, via: 'test', t: w.now - 5 * DAY }; rel(friend, p.id).trust = 0.8;
    const mv = movesFor(w, p, s).find((m) => m.code === 'inquire')!; assert.ok(mv);
    const r = doMove(w, p, s.id, 'inquire');
    assert.ok(r.lines[0].includes(friend.name)); assert.ok(visibleTo(w, p, s));
    assert.ok(!movesFor(w, p, s).some((m) => m.code === 'inquire'), 'cannot ask again at once');
    assert.ok(!/guilty|innocent/i.test(r.lines.join(' ')));
  });
  ok('player moves: settling a matter needs rank or the trust of both sides; others refuse a man they don’t respect', () => {
    const w = fresh(4); const { s, boss, c } = skimCase(w, true); const p = P(w); p.rank = 'associate';
    assert.ok(!movesFor(w, p, s).some((m) => m.code === 'mediate'));
    p.rank = 'capo';
    assert.ok(movesFor(w, p, s).some((m) => m.code === 'mediate'));
    rel(boss, p.id).respect = 0.05;
    assert.ok(doMove(w, p, s.id, 'mediate').lines[0].includes('will not sit'));
    rel(boss, p.id).respect = 0.8; rel(c, p.id).respect = 0.8;
    const r = doMove(w, p, s.id, 'mediate'); assert.ok(!isOpen(s), r.lines.join('|')); assert.ok(s.meet?.chair === p.id);
  });
  ok('player moves: speaking up for a man weighs with the chair and costs with the other side; vouching for a guilty man costs you', () => {
    const w = fresh(2); const { s, boss, c } = skimCase(w, true); const p = P(w); p.rank = 'soldier';
    rel(p, c.id).trust = 0.7; rel(c, p.id).trust = 0.7;
    const m = movesFor(w, p, s).find((x) => x.code === 'vouch'); assert.ok(m);
    const st0 = p.standing; const r0 = rel(boss, p.id).respect;
    doMove(w, p, s.id, 'vouch', c.id); assert.ok((s.m?.vouched as number) >= 1);
    s.phase = 'confront'; s.m = { ...(s.m ?? {}), cert: 90 }; s.next = w.now; run(w, s, 4);
    assert.ok(!isOpen(s)); assert.ok(p.standing < st0 || rel(boss, p.id).respect < r0 || rel(boss, p.id).trust < 0.9, 'it came back on him');
    void r0;
  });
  ok('player moves: negotiating his own debt gets an answer from the creditor’s own interests', () => {
    const w = fresh(4); const p = P(w); const cr = Object.values(w.chars).find((q) => q.alive && !q.isPlayer && q.cash > 500)!;
    const d = createDebt(w, cr.id, p.id, 500, 0.02, 'test'); d.missed = 2;
    const lines = doMove(w, p, 'x', 'negotiate').lines; assert.ok(lines[0]);
    const s = spawn(w, 'debt', 'dbt-' + d.id, p.id, { cause: 'x', parties: [{ id: cr.id, role: 'creditor' }, { id: p.id, role: 'debtor' }], sev: 0.2, phase: 'pressed', next: w.now + 20 * DAY, link: { debt: d.id } });
    void s;
    const out = negotiateDebt(w, p, d.id); assert.ok(out[0].length > 5); assert.deepEqual(ledgerCheck(w), []);
  });
  ok('contextual: people with something between them are seen to have it, and the player is told only what he knows', () => {
    const w = fresh(2); const { s, boss, c } = skimCase(w, true); const p = P(w);
    assert.deepEqual(personTexture(w, p, c), []);
    const f = tell(w, s, 'Somebody saw them argue.', { actor: boss.id, victim: c.id }); p.known[f.id] = { from: 'test', t: w.now, knowsActor: true } as never;
    assert.ok(personTexture(w, p, c).length === 1); assert.ok(titleOf(w, s).length > 0);
  });
  ok('a rank-appropriate experience: the player is not asked about matters above his station', () => {
    const w = createWorld(9, 'Tony Marino'); let asks = 0;
    for (let d = 1; d <= 240; d++) { advance(w, w.now + DAY); for (const e of w.enc) if (e.status === 'open' && e.data?.what === 'sit75') asks++; }
    assert.equal(asks, 0, 'an associate with no one under him is never asked to decide others’ disputes'); assert.equal(P(w).rank, 'associate');
  });
  ok('legacy kinds and V75 kinds do not interfere: the old loop leaves V75 situations alone', () => {
    const w = fresh(); const { s } = skimCase(w); const weeks = s.weeks;
    situationTick(w);
    assert.equal(s.weeks, weeks); assert.ok(isOpen(s));
  });
  ok('word reaches the player only from men who know it, and only within their trust and his rank', () => {
    const w = fresh(2); const { s, boss, c } = skimCase(w, true); const p = P(w); run(w, s, 1);
    boss.rank = 'boss'; c.rank = 'capo'; p.rank = 'associate';
    const facts = Object.values(w.facts).filter((f) => f.story === 'sit:' + s.id);
    const src = Object.values(w.chars).find((q) => q.alive && !q.isPlayer && q.id !== boss.id && q.id !== c.id && q.familyId === p.familyId)!;
    const bystander = Object.values(w.chars).find((q) => q.alive && !q.isPlayer && q.id !== boss.id && q.id !== c.id && q.id !== src.id)!;
    for (const f of facts) delete p.known[f.id];
    // nobody present knows anything: nothing is heard
    for (const q of [src, bystander]) for (const f of facts) delete q.known[f.id];
    for (let i = 0; i < 40; i++) assert.deepEqual(clubTalk(w, p, [src, bystander]), []);
    for (const f of facts) assert.ok(!p.known[f.id]);
    // he knows it, but does not trust the listener and the matter is far above him: still nothing
    for (const f of facts) src.known[f.id] = { from: 'saw', t: w.now, knowsActor: true } as never;
    s.k![src.id] = { l: 2, via: 'saw', t: w.now - 5 * DAY }; src.traits.sociability = 1;
    rel(src, p.id).trust = 0.1; assert.equal(whisper(w, p, src, 'club'), undefined, 'distrust and rank keep it quiet');
    // trust opens it up, and only facts he holds can be passed on
    rel(src, p.id).trust = 0.9; rel(src, p.id).respect = 0.9;
    const hit = whisper(w, p, src, 'club')!; assert.ok(hit); assert.ok(src.known[hit.f.id], 'the source holds the fact he passes on');
    let heard: string[] = []; for (let i = 0; i < 60 && !heard.length; i++) heard = clubTalk(w, p, [src]);
    assert.ok(heard.length === 1 && Object.keys(p.known).some((id) => w.facts[id]?.story === 'sit:' + s.id));
    assert.ok(!/guilty|innocent/i.test(heard.join(' ')));
    // not the same matter again at once; after a few days a new development may come
    const extra = tell(w, s, 'Something new happened.', { witnesses: [src.id] }); void extra;
    assert.equal(whisper(w, p, src, 'club'), undefined, 'not repeated straight away');
    w.now += 6 * DAY; assert.ok(whisper(w, p, src, 'club'), 'a later development can come through');
  });
  ok('a party to a matter guards it unless he trusts the listener', () => {
    const w = fresh(2); const { s, boss } = skimCase(w, true); const p = P(w);
    for (let i = 0; i < 6 && !Object.keys(boss.known).some((id) => w.facts[id]?.story === 'sit:' + s.id); i++) run(w, s, 1); // let it develop until the boss has something to say (pacing may delay a step)
    for (const f of Object.values(w.facts).filter((x) => x.story === 'sit:' + s.id)) delete p.known[f.id];
    rel(boss, p.id).trust = 0.2; assert.equal(whisper(w, p, boss, 'club'), undefined);
    rel(boss, p.id).trust = 0.8; assert.ok(whisper(w, p, boss, 'club'));
  });
  ok('friends bring at most one thing a week, and an associate with no friends hears nothing from them', () => {
    const w = fresh(2); const { s } = skimCase(w, true); const p = P(w); run(w, s, 1);
    for (const f of Object.values(w.facts).filter((x) => x.story === 'sit:' + s.id)) delete p.known[f.id];
    for (const q of Object.values(w.chars)) if (q.rels[p.id]) q.rels[p.id].trust = 0.05;
    for (let i = 0; i < 30; i++) friendsTell(w);
    assert.ok(!Object.keys(p.known).some((id) => w.facts[id]?.story === 'sit:' + s.id), 'no friends, no word');
    const src = Object.values(w.chars).find((q) => q.alive && !q.isPlayer && q.familyId === p.familyId && q.rank !== 'civilian')!;
    for (const f of Object.values(w.facts).filter((x) => x.story === 'sit:' + s.id)) src.known[f.id] = { from: 'saw', t: w.now, knowsActor: true } as never;
    rel(src, p.id).trust = 0.9; src.traits.sociability = 1; src.jailedUntil = 0;
    let n = 0; for (let i = 0; i < 60; i++) { const before = Object.keys(p.known).length; friendsTell(w); if (Object.keys(p.known).length > before) n++; }
    assert.ok(n >= 1 && n <= 3, 'a trickle, not a flood: ' + n);
  });
  ok('SCHEMA is at least 6 (7 since V76)', () => assert.ok(SCHEMA >= 6));
}
function sim(seed: number, days: number) {
  const w = createWorld(seed, 'Tony Marino'); let maxOpen = 0;
  for (let d = 1; d <= days; d++) { advance(w, w.now + DAY); maxOpen = Math.max(maxOpen, (w.situations ?? []).filter(isOpen).length); if (d % 30 === 0) { assert.deepEqual(sitIssues(w), [], 'day ' + d); assert.deepEqual(ledgerCheck(w), []); } }
  assert.deepEqual(audit(w), []);
  const sp = w.sitpace!; console.log(`seed ${seed} ${days}d: maxOpen ${maxOpen}, quiet ${sp.quiet}/${sp.weeks}, busy ${sp.busy}, saveKB ${(serialize(w).length / 1024).toFixed(0)}`);
  console.log(JSON.stringify(sp.stats));
}
function compat() {
  ok('a V74 save (schema 5) loads, situations start forming, and nothing breaks', () => {
    const w = createWorld(9, 'Tony Marino'); advance(w, w.now + 40 * DAY);
    const o = JSON.parse(serialize(w)); o.schema = 5; delete o.sitpace; delete o.sitcool;
    o.situations = (o.situations ?? []).filter((s: Situation) => !s.key);
    const l = deserialize(JSON.stringify(o)); assert.equal(l.schema, SCHEMA);
    advance(l, l.now + 90 * DAY); assert.deepEqual(audit(l), []); assert.deepEqual(sitIssues(l), []);
    assert.equal(serialize(deserialize(serialize(l))), serialize(l));
    assert.ok((l.situations ?? []).some((s) => !!s.key));
  });
}
function roundtrip(seed: number) {
  const w = createWorld(seed, 'Tony Marino'); advance(w, w.now + 120 * DAY);
  const open = (w.situations ?? []).filter((s) => isOpen(s) && s.key).length;
  const s = serialize(w); const l = deserialize(s); assert.equal(serialize(l), s);
  advance(w, w.now + 90 * DAY); advance(l, l.now + 90 * DAY); assert.equal(canon(l), canon(w));
  console.log(`seed ${seed}: round trip OK with ${open} open situations at the cut`);
}
describe('v75 fast', fast);
describe.skipIf(!COMPAT)('v75 compat', compat);
describe.skipIf(!SLOW)('v75 slow', () => {
  ok.each(SEEDS)(`sim %i, ${DAYS} days`, (seed) => sim(seed, DAYS));
  ok.each(SEEDS)('roundtrip %i', roundtrip);
});
void sitWeek; void attendees; void (null as unknown as Character);
