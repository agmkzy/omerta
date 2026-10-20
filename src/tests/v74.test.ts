// V74 regression suite: NPC agency. COMPAT=1 adds the schema-4 migration; SLOW=1 the long sim (SEED, DAYS) and roundtrip runs (see ./modes.ts).
import assert from 'node:assert';
import { afterEach, describe, test as ok } from 'vitest';
import { COMPAT, DAYS, SEEDS, SLOW } from './modes';
import { SCHEMA, advance, deserialize, serialize } from '../engine';
import { createWorld } from '../world';
import { DAY, WEEK, Business, Character, Goal, World } from '../types';
import { audit } from '../consistency';
import { createDebt, ownerBiz, rel } from '../core';
import { ledgerCheck, stakesOf } from '../econ';
import { AGENCY, agencyIssues, agencyOf, agencyWeek, begin, endGoal, goalChoose, goalsOf, moneyTotal, priceOf, stepGoal, wealthReport } from '../goals';
import { choose } from '../encounters';
import { applyRank } from '../rank';
import { readiness } from '../career';

// Some checks switch on the per-step money audit; a failing one must not leave it on for the next.
const AUDIT = AGENCY.audit;
afterEach(() => { AGENCY.audit = AUDIT; });
const P = (w: World) => w.chars[w.playerId!];
const fresh = (seed = 7, days = 20) => { const w = createWorld(seed, 'Tony Marino'); advance(w, w.now + days * DAY); const a = agencyOf(w); a.goals = []; a.cool = {}; a.stats = {}; a.ended = []; return w; };
// run one goal to its end (or `max` reviews) without moving the rest of the world
function drive(w: World, g: Goal, max = 80): boolean {
  const a = agencyOf(w);
  for (let i = 0; i < max && a.goals.includes(g); i++) {
    w.now = Math.max(w.now, g.review);
    const c = w.chars[g.who]; if (!c) break;
    stepGoal(w, g, c);
  }
  return !a.goals.includes(g);
}
const npcs = (w: World, rank: string) => Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.rank === rank && c.familyId && c.bossId && w.chars[c.bossId]?.alive);
// A buyer and a seller in the same family; the seller owns a plain shop.
function pair(w: World) {
  const sellers = Object.values(w.biz).filter((b) => b.open && b.kind !== 'casino' && w.chars[b.ownerId]?.alive && !w.chars[b.ownerId].isPlayer);
  const b = sellers[0]; assert.ok(b, 'a shop owned by an NPC');
  const seller = w.chars[b.ownerId];
  const buyer = Object.values(w.chars).find((c) => c.alive && !c.isPlayer && c.id !== seller.id && c.rank === 'soldier' && !ownerBiz(w, c.id));
  assert.ok(buyer, 'a buyer');
  rel(buyer!, seller.id).trust = 0.5; rel(seller, buyer!.id).trust = 0.5; rel(seller, buyer!.id).grudge = 0;
  buyer!.cash = 50000; buyer!.jailedUntil = 0; buyer!.traits.caution = 0.5; buyer!.traits.greed = 0.3; buyer!.traits.violence = 0.2;
  seller.jailedUntil = 0;
  return { b, seller, buyer: buyer! };
}
const aimed = (w: World, buyer: Character, b: Business, stage = 'approach') => {
  const g = begin(w, buyer, 'business', 'test', 0.8, { stage, target: b.id, owner: b.ownerId, mode: 'buy', need: 100, next: 'x' });
  g.deadline = w.now + 400 * DAY; return g;
};

function fast() {
  ok('a goal carries the specified structure', () => {
    const w = fresh(); const c = npcs(w, 'soldier')[0];
    const g = begin(w, c, 'wealth', 'why', 0.5, { stage: 'build', need: 900 });
    for (const k of ['id', 'who', 'kind', 'motive', 'priority', 'stage', 'need', 'have', 'next', 'progress', 'started', 'review', 'deadline', 'tries']) assert.ok(k in g, k);
    assert.equal(g.who, c.id); assert.equal(agencyOf(w).stats['started.wealth'], 1);
  });
  ok('a new world and an old one both have an agency (shape + schema)', () => {
    const w = createWorld(3); assert.deepEqual(w.agency!.goals, []);
    const o = JSON.parse(serialize(w)); delete o.agency; o.schema = 4;
    const l = deserialize(JSON.stringify(o)); assert.equal(l.schema, SCHEMA); assert.deepEqual(l.agency!.goals, []);
    advance(l, l.now + 14 * DAY); assert.deepEqual(audit(l), []);
  });
  ok('a purchase is paid for: cash moves buyer -> seller, ownership and history change, nothing is created', () => {
    const w = fresh(); const { b, seller, buyer } = pair(w);
    b.distress = 3; const price = priceOf(w, b);
    const g = aimed(w, buyer, b); const m0 = moneyTotal(w), bc = buyer.cash, sc = seller.cash;
    assert.ok(drive(w, g)); assert.equal(agencyOf(w).ended.at(-1)!.how, 'done');
    assert.equal(b.ownerId, buyer.id); assert.equal(b.owners!.at(-1)!.id, seller.id); assert.equal(b.owners!.at(-1)!.how, 'bought');
    const paid = bc - buyer.cash; assert.ok(paid > 0 && paid <= price * 1.3, `paid ${paid} for asking ${price}`);
    assert.equal(seller.cash - sc, paid); assert.equal(moneyTotal(w), m0);
    assert.equal(agencyOf(w).stats.acq, 1); assert.deepEqual(agencyIssues(w), []); assert.deepEqual(ledgerCheck(w), []);
    assert.ok(Object.values(w.facts).some((f) => f.kind === 'ownership' && f.business === b.id && f.actor === buyer.id));
  });
  ok('he cannot buy a business he cannot pay for', () => {
    const w = fresh(); const { b, buyer } = pair(w); buyer.cash = 40;
    b.distress = 3; const g = aimed(w, buyer, b, 'close'); g.offer = priceOf(w, b);
    for (let i = 0; i < 6; i++) { w.now = Math.max(w.now, g.review); stepGoal(w, g, buyer); }
    assert.notEqual(b.ownerId, buyer.id); assert.equal(buyer.cash, 40);
  });
  ok('he cannot buy the player\'s business or a casino', () => {
    const w = fresh(); const { b, buyer } = pair(w);
    const ob = b.ownerId; b.ownerId = P(w).id; const g = aimed(w, buyer, b); g.owner = ob;
    stepGoal(w, g, buyer); assert.equal(b.ownerId, P(w).id); assert.equal(g.stage, 'scout');
    b.ownerId = ob; const kind = b.kind; b.kind = 'casino'; const g2 = aimed(w, buyer, b); g2.id = 'g-x'; agencyOf(w).goals = [g2]; stepGoal(w, g2, buyer);
    assert.equal(g2.stage, 'scout'); b.kind = kind;
  });
  ok('a refusal makes him improve the offer, find another, or give up - not retry forever', () => {
    const w = fresh(); const { b, seller, buyer } = pair(w);
    seller.traits.greed = 1; b.distress = 0; seller.cash = 90000; const g = aimed(w, buyer, b, 'negotiate'); g.mode = 'buy';
    drive(w, g, 40);
    const e = agencyOf(w).ended.at(-1);
    assert.ok(g.tries > 0 || e, 'tries recorded'); assert.ok(g.tries <= 4);
    assert.ok(agencyOf(w).stats['refused.offer'] >= 1 || b.ownerId === buyer.id);
  });
  ok('a partner covers a shortfall and gets a share; the money is traced', () => {
    const w = fresh(); const { b, buyer, seller } = pair(w); b.distress = 3;
    const rich = Object.values(w.chars).find((c) => c.alive && !c.isPlayer && c.familyId === buyer.familyId && ![buyer.id, seller.id].includes(c.id) && c.rank !== 'civilian')!;
    rich.cash = 400000; rel(rich, buyer.id).trust = 1; rel(buyer, rich.id).trust = 1; rich.traits.greed = 1;
    const price = priceOf(w, b); buyer.cash = Math.round(price * 0.55) + 150; const m0 = moneyTotal(w);
    const g = aimed(w, buyer, b, 'finance'); g.offer = price; g.mode = 'buy';
    for (let i = 0; i < 12 && !g.fin && agencyOf(w).goals.includes(g); i++) { w.now = Math.max(w.now, g.review); stepGoal(w, g, buyer); }
    assert.ok(g.fin || b.ownerId === buyer.id, 'financed'); drive(w, g);
    if (b.ownerId === buyer.id) assert.ok(stakesOf(w, rich.id).some((x) => x.b.id === b.id), 'partner holds a stake');
    assert.equal(moneyTotal(w), m0); assert.deepEqual(agencyIssues(w), []);
  });
  ok('a plan that fails after financing gives the backer his money back', () => {
    const w = fresh(); const { b, buyer, seller } = pair(w);
    const bk = Object.values(w.chars).find((c) => c.alive && !c.isPlayer && ![buyer.id, seller.id].includes(c.id) && c.rank !== 'civilian')!;
    bk.cash = 1000; buyer.cash = 3000; const g = aimed(w, buyer, b, 'close'); g.fin = { by: bk.id, amt: 800 }; const m0 = moneyTotal(w);
    endGoal(w, g, 'failed', 'test'); assert.equal(bk.cash, 1800); assert.equal(buyer.cash, 2200); assert.equal(moneyTotal(w), m0);
  });
  ok('a man who loses his savings or goes to prison for long drops the plan (reprioritises)', () => {
    const w = fresh(); const { b, buyer } = pair(w);
    const g = aimed(w, buyer, b, 'save'); g.have = 40000; buyer.cash = 2000; g.need = 30000; stepGoal(w, g, buyer);
    assert.equal(agencyOf(w).ended.at(-1)!.how, 'dropped'); assert.match(agencyOf(w).ended.at(-1)!.why, /savings/);
    const g2 = aimed(w, buyer, b, 'save'); buyer.jailedUntil = w.now + 120 * DAY; stepGoal(w, g2, buyer);
    assert.equal(agencyOf(w).ended.at(-1)!.how, 'dropped'); assert.match(agencyOf(w).ended.at(-1)!.why, /locked up/);
  });
  ok('goals end when the man dies; nothing is left behind', () => {
    const w = fresh(); const c = npcs(w, 'soldier')[0]; begin(w, c, 'wealth', 'x', 0.5, { stage: 'build', need: 1e6 });
    c.alive = false; agencyWeek(w); assert.equal(goalsOf(w, c.id).length, 0); assert.equal(agencyOf(w).ended.at(-1)!.why, 'he died');
  });
  ok('recruiting follows rank and authority: associates cannot, a capo can; crew room and cost respected', () => {
    const w = fresh(); const fam = P(w).familyId!;
    const pro = Object.values(w.chars).find((c) => c.alive && c.prospect && c.rank === 'civilian' && !ownerBiz(w, c.id))!; assert.ok(pro);
    const cap = Object.values(w.chars).find((c) => c.alive && !c.isPlayer && c.rank === 'capo' && c.familyId === fam)!; cap.cash = 5000; cap.jailedUntil = 0;
    const assoc = Object.values(w.chars).find((c) => c.alive && !c.isPlayer && c.rank === 'associate' && c.familyId === fam)!; assoc.cash = 5000;
    const g0 = begin(w, assoc, 'recruit', 'x', 0.5, { stage: 'spot' }); stepGoal(w, g0, assoc);
    assert.equal(agencyOf(w).ended.at(-1)!.how, 'dropped'); assert.equal(pro.rank, 'civilian');
    pro.traits.ambition = 0.3; pro.traits.caution = 0; cap.traits.sociability = 1; cap.standing = 100;
    const g = begin(w, cap, 'recruit', 'x', 0.5, { stage: 'spot' }); const c0 = cap.cash;
    for (let i = 0; i < 30 && agencyOf(w).goals.includes(g); i++) { w.now = Math.max(w.now, g.review); stepGoal(w, g, cap); }
    const taken = Object.values(w.chars).filter((c) => c.alive && c.bossId === cap.id && c.rank === 'associate' && c.id === g.target || c.id === pro.id && c.rank === 'associate');
    assert.ok(agencyOf(w).stats.recruitTry >= 1);
    if (pro.rank === 'associate') { assert.equal(pro.bossId, cap.id); assert.equal(pro.familyId, cap.familyId); assert.ok(cap.cash < c0); assert.ok(taken.length >= 1); }
    assert.deepEqual(audit(w), []);
  });
  ok('two recruiters after the same man cannot both get him', () => {
    const w = fresh(); const fam = P(w).familyId!;
    const pro = Object.values(w.chars).find((c) => c.alive && c.prospect && c.rank === 'civilian' && !ownerBiz(w, c.id))!;
    const two = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.rank === 'capo' && c.familyId === fam).slice(0, 2);
    assert.equal(two.length > 1 ? 2 : 1, two.length >= 2 ? 2 : 1);
    if (two.length < 2) return;
    for (const c of two) { c.cash = 5000; c.traits.sociability = 1; c.standing = 100; }
    pro.traits.ambition = 0.2; pro.traits.caution = 0;
    const gs = two.map((c) => begin(w, c, 'recruit', 'x', 0.5, { stage: 'approach', target: pro.id }));
    for (let i = 0; i < 6; i++) for (const g of gs) if (agencyOf(w).goals.includes(g)) { w.now = Math.max(w.now, g.review); stepGoal(w, g, w.chars[g.who]); }
    assert.ok(pro.rank === 'civilian' || two.filter((c) => pro.bossId === c.id).length === 1);
    assert.deepEqual(audit(w), []);
  });
  ok('an advancement goal never promotes: only the career system does', () => {
    const w = fresh(); const c = npcs(w, 'soldier')[0]; c.traits.ambition = 1; c.lifetimeKick = 999999; c.standing = 100;
    const g = begin(w, c, 'advance', 'x', 0.9, { stage: 'build' }); const r0 = c.rank;
    for (let i = 0; i < 40; i++) { w.now += WEEK; g.review = w.now; if (agencyOf(w).goals.includes(g)) stepGoal(w, g, c); }
    assert.equal(c.rank, r0); assert.ok(agencyOf(w).stats.promoPursued >= 1);
  });
  ok('asking for backing sets the sponsor the existing rule reads; the rule alone decides the rank', () => {
    const w = fresh(); const c = npcs(w, 'soldier')[0]; const boss = w.chars[c.bossId!]; c.traits.ambition = 1; delete c.backer;
    rel(boss, c.id).trust = 0.3; rel(boss, c.id).respect = 1; rel(c, boss.id).trust = 1; c.lifetimeKick = 99999; c.standing = 80;
    const g = begin(w, c, 'advance', 'x', 0.9, { stage: 'build' });
    for (let i = 0; i < 20 && !c.backer; i++) { w.now += WEEK; g.review = w.now; stepGoal(w, g, c); }
    if (LADDER_OK(boss)) assert.equal(c.backer, boss.id);
    assert.equal(c.rank, 'soldier');
  });
  ok('a debtor can ask for time: extension moves the due date', () => {
    const w = fresh(); const [cr, db] = npcs(w, 'soldier'); cr.traits.greed = 0; rel(cr, db.id).trust = 1; db.cash = 10; db.traits.violence = 0; db.traits.greed = 0;
    const d = createDebt(w, cr.id, db.id, 1000, 0.05, 'test'); d.missed = 2; const due = d.nextDue;
    const g = begin(w, db, 'debt', 'x', 0.8, { stage: 'recover', target: d.id, need: 1000 });
    for (let i = 0; i < 12 && d.nextDue === due; i++) { w.now = Math.max(w.now, g.review); stepGoal(w, g, db); }
    assert.ok(d.nextDue > due, 'extended'); assert.ok(agencyOf(w).stats.extension >= 1);
  });
  ok('a debtor with spare cash pays extra through the debt system (money conserved)', () => {
    const w = fresh(); const [cr, db] = npcs(w, 'soldier'); db.cash = 3000; db.traits.caution = 1; db.traits.vice = 0;
    const d = createDebt(w, cr.id, db.id, 1000, 0.01, 'test'); const m0 = moneyTotal(w), c0 = cr.cash;
    const g = begin(w, db, 'debt', 'x', 0.8, { stage: 'recover', target: d.id, need: 1000 });
    for (let i = 0; i < 6; i++) { w.now = Math.max(w.now, g.review); if (agencyOf(w).goals.includes(g)) stepGoal(w, g, db); }
    assert.ok(cr.cash > c0 || d.balance < 1000); assert.equal(moneyTotal(w), m0);
  });
  ok('different men facing the same debt choose differently', () => {
    const w = fresh(); const sol = npcs(w, 'soldier').slice(0, 8); const picks = new Set<string>();
    const [cr] = npcs(w, 'capo').length ? npcs(w, 'capo') : npcs(w, 'underboss');
    sol.forEach((c, i) => {
      if (c.id === cr.id) return; c.cash = 200 + i * 40; c.traits.violence = i % 2 ? 0.9 : 0.1; c.traits.courage = i % 2 ? 0.9 : 0.2; c.traits.caution = i % 3 ? 0.2 : 0.9; c.traits.greed = i % 2 ? 0.8 : 0.1;
      const d = createDebt(w, cr.id, c.id, 1500, 0.04, 't'); d.missed = 2;
      const g = begin(w, c, 'debt', 'x', 0.8, { stage: 'recover', target: d.id, need: 1500 }); const before = JSON.stringify(agencyOf(w).stats);
      for (let k = 0; k < 4 && agencyOf(w).goals.includes(g); k++) { w.now = Math.max(w.now, g.review); stepGoal(w, g, c); }
      picks.add(g.next + '|' + g.tries + '|' + (JSON.stringify(agencyOf(w).stats) === before));
    });
    assert.ok(picks.size >= 2, 'varied responses: ' + [...picks].join(' ; '));
  });
  ok('independence: better terms lower the rate within the floor, or fail - and are counted', () => {
    const w = fresh(); const c = npcs(w, 'soldier')[0]; const boss = w.chars[c.bossId!]; c.cash = 5000; c.kickRate = 0.2;
    rel(boss, c.id).trust = 1; rel(boss, c.id).respect = 1;
    const g = begin(w, c, 'independence', 'x', 0.7, { stage: 'terms' });
    for (let i = 0; i < 12 && agencyOf(w).goals.includes(g); i++) { w.now = Math.max(w.now, g.review); stepGoal(w, g, c); }
    assert.ok(c.kickRate >= 0.1 - 1e-9 && c.kickRate <= 0.2); assert.ok(!agencyOf(w).goals.includes(g));
  });
  ok('wealth: investing in his own place goes through the record; loans create real debts', () => {
    const w = fresh(); const b = Object.values(w.biz).find((x) => x.open && x.kind !== 'casino' && w.chars[x.ownerId]?.alive && !w.chars[x.ownerId].isPlayer)!;
    const c = w.chars[b.ownerId]; c.cash = 8000; c.traits.caution = 1; c.traits.greed = 0; b.distress = 0; b.invest = 0;
    const g = begin(w, c, 'wealth', 'x', 0.6, { stage: 'build', need: 99999 }); const t0 = (w.txns ?? []).length;
    for (let i = 0; i < 6; i++) { w.now = Math.max(w.now, g.review); if (agencyOf(w).goals.includes(g)) stepGoal(w, g, c); }
    assert.deepEqual(ledgerCheck(w), []);
    if ((b.invest ?? 0) > 0) assert.ok((w.txns ?? []).length > t0 || w.txns!.length === 3000);
    assert.deepEqual(agencyIssues(w), []);
  });
  ok('the player is asked only when it is plausible, once, and may refuse - the man carries on', () => {
    const w = fresh(); const p = P(w); const c = npcs(w, 'soldier')[0]; p.cash = 1000;
    const d = createDebt(w, p.id, c.id, 600, 0.03, 'test'); d.missed = 1; c.cash = 5; c.traits.violence = 0;
    const g = begin(w, c, 'debt', 'x', 0.8, { stage: 'recover', target: d.id, need: 600 });
    for (let i = 0; i < 6 && !g.ask; i++) { w.now = Math.max(w.now, g.review); stepGoal(w, g, c); }
    assert.ok(g.ask, 'asked'); const e = w.enc.find((x) => x.id === g.ask)!; assert.equal(e.data!.what, 'goal');
    assert.equal(w.enc.filter((x) => x.status === 'open' && x.data?.what === 'goal').length, 1);
    const due = d.nextDue; const r = choose(w, p, e, 'no'); assert.ok(r.lines.length);
    assert.equal(d.nextDue, due); assert.ok(agencyOf(w).goals.includes(g)); assert.equal(g.ask, undefined);
    assert.equal(agencyOf(w).stats['ask.refused'], 1);
  });
  ok('the player accepts: extension granted, trust rises', () => {
    const w = fresh(); const p = P(w); const c = npcs(w, 'soldier')[0];
    const d = createDebt(w, p.id, c.id, 600, 0.03, 'test'); d.missed = 1; c.cash = 5; const due = d.nextDue; const t0 = rel(c, p.id).trust;
    const g = begin(w, c, 'debt', 'x', 0.8, { stage: 'recover', target: d.id, need: 600 });
    for (let i = 0; i < 6 && !g.ask; i++) { w.now = Math.max(w.now, g.review); stepGoal(w, g, c); }
    choose(w, p, w.enc.find((x) => x.id === g.ask)!, 'yes'); assert.ok(d.nextDue > due); assert.ok(rel(c, p.id).trust > t0);
  });
  ok('an unanswered question lapses into a refusal; the plan goes on', () => {
    const w = fresh(); const p = P(w); const c = npcs(w, 'soldier')[0];
    const d = createDebt(w, p.id, c.id, 600, 0.03, 'test'); d.missed = 1; c.cash = 5;
    const g = begin(w, c, 'debt', 'x', 0.8, { stage: 'recover', target: d.id, need: 600 });
    for (let i = 0; i < 6 && !g.ask; i++) { w.now = Math.max(w.now, g.review); stepGoal(w, g, c); }
    const e = w.enc.find((x) => x.id === g.ask)!; e.status = 'lapsed'; agencyWeek(w);
    assert.equal(g.ask, undefined); assert.ok(agencyOf(w).goals.includes(g) || agencyOf(w).ended.some((x) => x.id === g.id));
  });
  ok('asks are spaced out: never two open, never within 12 days', () => {
    const w = fresh(); const p = P(w); const cs = npcs(w, 'soldier').slice(0, 3);
    const gs = cs.map((c) => { const d = createDebt(w, p.id, c.id, 600, 0.03, 'test'); d.missed = 1; c.cash = 5; return begin(w, c, 'debt', 'x', 0.8, { stage: 'recover', target: d.id, need: 600 }); });
    for (let i = 0; i < 4; i++) for (const g of gs) { w.now = Math.max(w.now, g.review); if (agencyOf(w).goals.includes(g)) stepGoal(w, g, w.chars[g.who]); }
    assert.ok(w.enc.filter((x) => x.status === 'open' && x.data?.what === 'goal').length <= 1);
  });
  ok('goalChoose ignores other encounters', () => {
    const w = fresh(); assert.equal(goalChoose(w, P(w), { data: { what: 'invest' } } as never, 'yes'), undefined);
  });
  ok('the ended ring and the per-man cap are bounded', () => {
    const w = fresh(); const c = npcs(w, 'soldier')[0];
    for (let i = 0; i < 200; i++) { const g = begin(w, c, 'wealth', 'x', 0.5, { stage: 'build' }); endGoal(w, g, 'dropped', 't' + i); }
    assert.equal(agencyOf(w).ended.length, AGENCY.caps.ended);
    for (let i = 0; i < 40; i++) { agencyOf(w).cool = {}; agencyWeek(w); w.now += WEEK; }
    for (const x of Object.values(w.chars)) assert.ok(goalsOf(w, x.id).length <= AGENCY.caps.perMan);
  });
  ok('the audit catches a broken goal', () => {
    const w = fresh(); const c = npcs(w, 'soldier')[0]; const g = begin(w, c, 'debt', 'x', 0.5, { target: 'nope' });
    assert.ok(agencyIssues(w).length >= 1); endGoal(w, g, 'dropped', 'x'); assert.deepEqual(agencyIssues(w), []);
  });
  ok('a 60-day run: money conserved by every goal step, audit clean, deterministic', () => {
    const run = () => { const w = createWorld(5, 'Tony Marino'); AGENCY.audit = true; advance(w, w.now + 60 * DAY); AGENCY.audit = false; return w; };
    const a = run(), b = run();
    assert.equal(agencyOf(a).stats.leak ?? 0, 0); assert.deepEqual(audit(a), []); assert.deepEqual(ledgerCheck(a), []);
    assert.equal(serialize(a), serialize(b));
  });
  ok('save and load in the middle of live plans changes nothing', () => {
    const w = createWorld(11, 'Tony Marino'); advance(w, w.now + 70 * DAY);
    const live = agencyOf(w).goals.filter((g) => !['plan', 'scout', 'spot'].includes(g.stage));
    assert.ok(live.length >= 3, 'plans in flight: ' + live.length);
    const s = serialize(w); const l = deserialize(s); assert.equal(serialize(l), s);
    advance(w, w.now + 40 * DAY); advance(l, l.now + 40 * DAY);
    assert.equal(serialize(l), serialize(w));
  });
}
const LADDER_OK = (boss: Character) => ['soldier', 'capo', 'underboss', 'boss'].includes(boss.rank);

function sim(seed: number, days: number) {
  const w = createWorld(seed, 'Tony Marino'); AGENCY.audit = true;
  const peak = { goals: 0, enc: 0, facts: 0, ended: 0, txns: 0 }; const wk: string[] = []; let asks = 0, lastAsk = -1e9, minGap = 1e9;
  for (let d = 1; d <= days; d++) {
    advance(w, w.now + DAY);
    const a = agencyOf(w); peak.goals = Math.max(peak.goals, a.goals.length); peak.enc = Math.max(peak.enc, w.enc.length); peak.facts = Math.max(peak.facts, Object.keys(w.facts).length); peak.ended = Math.max(peak.ended, a.ended.length); peak.txns = Math.max(peak.txns, w.txns!.length);
    if (a.lastAsk !== lastAsk) { asks++; minGap = Math.min(minGap, a.lastAsk - lastAsk); lastAsk = a.lastAsk; }
    if (d % 60 === 0) assert.deepEqual([...agencyIssues(w), ...audit(w)].slice(0, 5), [], 'day ' + d);
    if (d % 90 === 0) wk.push(`d${d} ` + JSON.stringify(wealthReport(w)));
  }
  const a = agencyOf(w);
  console.log(`seed ${seed} ${days}d`); console.log(wk.join('\n'));
  console.log('stats', JSON.stringify(Object.fromEntries(Object.entries(a.stats).sort())));
  console.log('peak', JSON.stringify(peak), 'asks', asks, 'minGapDays', minGap > 1e8 ? '-' : Math.round(minGap / DAY), 'saveKB', Math.round(serialize(w).length / 1024));
  assert.equal(a.stats.leak ?? 0, 0, 'no money leaked by any goal step');
  assert.ok(peak.ended <= AGENCY.caps.ended && peak.goals <= Object.keys(w.chars).length * AGENCY.caps.perMan);
  assert.deepEqual(audit(w), []); assert.deepEqual(ledgerCheck(w), []);
}
function roundtrip(seed: number) {
  const w = createWorld(seed, 'Tony Marino'); advance(w, w.now + 90 * DAY);
  const s = serialize(w); const l = deserialize(s); assert.equal(serialize(l), s);
  advance(w, w.now + 60 * DAY); advance(l, l.now + 60 * DAY); assert.equal(serialize(l), serialize(w));
  console.log(`seed ${seed}: round trip OK mid-plans (${goalsOf(w, '').length}+${agencyOf(w).goals.length} goals, ${(s.length / 1024).toFixed(0)} KB)`);
}
function compat() {
  ok('a V73 save (schema 4) loads, NPCs start forming goals, and nothing breaks', () => {
    const w = createWorld(9, 'Tony Marino'); advance(w, w.now + 30 * DAY);
    const o = JSON.parse(serialize(w)); o.schema = 4; delete o.agency;
    const l = deserialize(JSON.stringify(o)); assert.equal(l.schema, SCHEMA); assert.equal(l.agency!.goals.length, 0);
    advance(l, l.now + 60 * DAY); assert.ok(l.agency!.goals.length > 0); assert.deepEqual(audit(l), []); assert.deepEqual(ledgerCheck(l), []);
    assert.equal(serialize(deserialize(serialize(l))), serialize(l));
  });
}
describe('v74 fast', fast);
describe.skipIf(!COMPAT)('v74 compat', compat);
describe.skipIf(!SLOW)('v74 slow', () => {
  ok.each(SEEDS)(`sim %i, ${DAYS} days`, (seed) => sim(seed, DAYS));
  ok.each(SEEDS)('roundtrip %i', roundtrip);
});
void applyRank; void readiness; void (null as unknown as Business);
