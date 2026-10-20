// V87: backgrounds and starting lives. Each package is real state in the ordinary simulation, applied once at creation,
// and the world runs on from it: the skills, the stock, the share, the job, the debt, the car, and the brother.
// The fast set checks four seeds (one for the 35-day run); SLOW=1 checks eight (two) (see ./modes.ts).
import assert from 'node:assert/strict';
import { test as ok } from 'vitest';
import { SLOW } from '../modes';
import { readdirSync, readFileSync } from 'node:fs';
import { BACKGROUNDS, bgOf, FLOOR, LEAD, SECOND, startingLines } from '../../background';
import { audit } from '../../consistency';
import { serialize, deserialize, advance } from '../../engine';
import { ledgerCheck, stakesOf } from '../../econ';
import { performMove } from '../../jobs';
import { workShift } from '../../orders';
import { SKILLS } from '../../people';
import { hierarchyIssues } from '../../rank';
import { introduced } from '../../dialogue';
import { promote } from '../../career';
import { jail } from '../../jobs';
import { handleDeath } from '../../core';
import { DAY, type Character, type World } from '../../types';
import { createWorld } from '../../world';

const fast = !SLOW;
const NAME = 'Salvatore DeMarco';
const SEEDS = fast ? [1, 2, 3, 4] : [1, 2, 3, 4, 5, 6, 7, 8];
const P = (w: World) => w.chars[w.playerId!];
const total = (c: Character) => SKILLS.reduce((a, k) => a + c.skills[k], 0);
const brotherOf = (w: World) => (w.life?.kin ?? []).map((k) => w.chars[k.id]).find((c) => c && c.rank !== 'civilian');
const clean = (w: World, why: string) => {
  assert.deepEqual(audit(w), [], why + ': audit');
  assert.deepEqual(ledgerCheck(w), [], why + ': ledger');
  assert.deepEqual(hierarchyIssues(w), [], why + ': hierarchy');
};

ok('every background starts a real associate: same rank, same boss, no crew, standing 40, its own cash', { tags: ['unit'] }, () => {
  for (const s of SEEDS) for (const b of BACKGROUNDS) {
    const plain = createWorld(s, NAME), w = createWorld(s, NAME, { bg: b.id });
    const p = P(w), q = P(plain);
    assert.equal(p.bg, b.id);
    assert.equal(p.rank, 'associate');
    assert.equal(p.familyId, 'fam_corrente');
    assert.equal(p.standing, 40);
    assert.equal(p.cash, b.cash, b.id + ' cash');
    assert.equal(w.chars[p.bossId!].name, plain.chars[q.bossId!].name, b.id + ' answers to the same captain');
    assert.ok(!Object.values(w.chars).some((c) => c.bossId === p.id), b.id + ' has nobody under him');
    assert.ok(b.cash < 1500, 'nobody starts with more cash than the plain start');
    clean(w, `${b.id} seed ${s}`);
  }
});

ok('skills: the background’s two land on top, reliably strong, and the total is what he rolled', { tags: ['unit'] }, () => {
  for (const s of SEEDS) for (const b of BACKGROUNDS) {
    const w = createWorld(s, NAME, { bg: b.id }), p = P(w);
    const [a, c] = b.skills;
    const rest = SKILLS.filter((k) => k !== a && k !== c).map((k) => p.skills[k]);
    // the targets are met whenever what he rolled in total can pay for them (it nearly always can)
    if (total(p) >= LEAD + SECOND + 3 * FLOOR) assert.ok(p.skills[a] >= LEAD - 1e-9 && p.skills[c] >= SECOND - 1e-9, `${b.id}: lead ${p.skills[a]} / ${p.skills[c]}`);
    assert.ok(p.skills[a] >= p.skills[c] && p.skills[c] >= Math.max(...rest), `${b.id}: order`);
    assert.ok(rest.every((v) => v >= FLOOR - 1e-9));
    if (b.id !== 'connected') assert.ok(Math.abs(total(p) - total(P(createWorld(s, NAME)))) < 0.006, `${b.id}: total unchanged`);
  }
});

ok('each starting package is the real thing in the real system', { tags: ['unit'] }, () => {
  for (const s of SEEDS) {
    const W = (id: string) => createWorld(s, NAME, { bg: id });
    // Street Hustler: stock the ordinary pawn move can sell
    { const w = W('hustler'), p = P(w); assert.equal(p.goods, 700); assert.equal(p.cars, 0); }
    // Small Businessman: a tenth of a real civilian shop that carries his name and lists him among its owners
    { const w = W('business'), p = P(w), mine = stakesOf(w, p.id);
      assert.equal(mine.length, 1); assert.equal(mine[0].s.share, 0.1);
      const shop = mine[0].b; assert.equal(w.chars[shop.ownerId].rank, 'civilian'); assert.ok(shop.name.startsWith('DeMarco’s') || shop.name.startsWith("DeMarco's"));
      assert.ok(shop.owners?.some((o) => o.id === p.id)); assert.ok(introduced(w, p, w.chars[shop.ownerId]));
      assert.ok(Object.values(w.facts).some((f) => f.kind === 'ownership' && f.business === shop.id && p.known[f.id])); }
    // Union Man: a porter's job at an open civilian business, for its owner
    { const w = W('union'), p = P(w), j = p.job!;
      assert.equal(j.kind, 'porter'); assert.ok(w.biz[j.biz!].open); assert.equal(w.biz[j.biz!].ownerId, j.boss); assert.ok(introduced(w, p, w.chars[j.boss])); }
    // Bookmaker: exactly one $500 debt owed to him, by a civilian who knows he owes it
    { const w = W('bookmaker'), p = P(w), mine = w.debts.filter((d) => d.creditor === p.id);
      assert.equal(mine.length, 1); assert.equal(mine[0].principal, 500); assert.equal(mine[0].status, 'active');
      const c = w.chars[mine[0].debtor]; assert.equal(c.rank, 'civilian'); assert.ok(c.known[mine[0].cause!]); }
    // Wheelman: one stolen car and enough heat to be noticed
    { const w = W('wheelman'), p = P(w); assert.equal(p.cars, 1); assert.ok(p.heat >= 0.2 && p.heat < 0.45); }
    // Nobody else gets any of it
    for (const b of BACKGROUNDS) {
      const w = W(b.id), p = P(w);
      if (b.id !== 'hustler') assert.equal(p.goods, 0);
      if (b.id !== 'wheelman') { assert.equal(p.cars, 0); assert.equal(p.heat, 0); }
      if (b.id !== 'business') assert.equal(stakesOf(w, p.id).length, 0);
      if (b.id !== 'union') assert.equal(p.job, undefined);
      if (b.id !== 'bookmaker') assert.equal(w.debts.filter((d) => d.creditor === p.id).length, 0);
      if (b.id !== 'connected') assert.equal(brotherOf(w), undefined);
      assert.ok(startingLines(w, p).length >= 1, b.id + ' is told where his old life left him');
    }
  }
});

ok('Connected Family: exactly one brother, a real Corrente soldier in another captain’s crew', { tags: ['unit'] }, () => {
  for (const s of SEEDS) {
    const w = createWorld(s, NAME, { bg: 'connected' }), p = P(w);
    const kin = w.life!.kin;
    assert.equal(kin.length, 2); // his mother and his brother; nobody invented beside them
    const k = kin.find((x) => x.role === 'brother')!;
    const b = w.chars[k.id];
    assert.ok(b, 'brother exists in the population');
    assert.equal(b.rank, 'soldier');
    assert.equal(b.familyId, p.familyId);
    assert.ok(b.name.endsWith(' DeMarco') && !b.name.startsWith('Salvatore'));
    const cap = w.chars[b.bossId!];
    assert.equal(cap.rank, 'capo'); assert.equal(cap.familyId, p.familyId); assert.notEqual(cap.id, p.bossId);
    assert.ok(!b.isPlayer && b.wage === 150 && b.kickRate > 0);
    assert.ok(w.queue.some((e) => e.kind === 'think' && e.who === b.id), 'he thinks for himself');
    assert.ok(introduced(w, p, b));
    assert.ok(b.rels[p.id].trust < 0.6 && b.rels[p.id].affection > 0.6, 'he cares, and is still deciding about you');
    assert.equal(Object.values(w.chars).filter((c) => c.name === b.name).length, 1);
    assert.equal(Object.values(w.chars).filter((c) => c.id !== p.id && c.name.endsWith(' DeMarco') && !kin.some((x) => x.id === c.id)).length, 0);
    clean(w, 'connected seed ' + s);
  }
});

ok('the brother goes through what any soldier goes through: promotion, arrest, death', { tags: ['scenario'] }, () => {
  const w = createWorld(3, NAME, { bg: 'connected' });
  const b = brotherOf(w)!;
  promote(w, b, 'capo');
  assert.equal(b.rank, 'capo'); clean(w, 'promoted brother');
  assert.equal(P(w).rank, 'associate'); assert.notEqual(P(w).bossId, b.id);
  jail(w, b, 20);
  assert.ok(b.jailedUntil > w.now && Object.values(w.facts).some((f) => f.kind === 'arrest' && f.actor === b.id));
  advance(w, w.now + 7 * DAY); clean(w, 'brother inside');
  handleDeath(w, b.id, { cause: 'test' });
  assert.equal(b.alive, false);
  advance(w, w.now + 7 * DAY); clean(w, 'brother dead');
  assert.equal(w.life!.kin.filter((k) => k.role === 'brother').length, 1, 'still his brother on the record');
});

ok('save and load: every package survives, and nothing is ever applied twice', { tags: ['determinism'] }, () => {
  for (const b of BACKGROUNDS) {
    const w = createWorld(5, NAME, { bg: b.id });
    const once = serialize(w);
    const back = deserialize(once);
    assert.equal(serialize(back), once, b.id + ' round trip');
    const again = deserialize(serialize(back));
    const p = P(again);
    assert.equal(p.cash, b.cash); assert.equal(again.debts.length, w.debts.length); assert.equal(Object.keys(again.chars).length, Object.keys(w.chars).length);
    assert.equal(stakesOf(again, p.id).length, stakesOf(w, p.id).length);
  }
  // the same seed and the same background make the same world
  for (const b of BACKGROUNDS) assert.equal(serialize(createWorld(9, NAME, { bg: b.id })), serialize(createWorld(9, NAME, { bg: b.id })));
});

ok('saves made before V87 load as they were: no package, no relative is added to them', { tags: ['compat'] }, () => {
  const dir = new URL('../fixtures/', import.meta.url);
  for (const f of readdirSync(dir)) {
    const raw = readFileSync(new URL(f, dir), 'utf8');
    const o = JSON.parse(raw);
    const w = deserialize(raw), p = P(w);
    assert.equal(Object.keys(w.chars).length, Object.keys(o.chars).length, f);
    assert.equal(p.cash, o.chars[o.playerId].cash, f);
    assert.equal(p.bg, o.chars[o.playerId].bg, f);
    assert.equal(w.life?.kin.length, o.life?.kin.length, f);
  }
});

ok('35 days on, every starting life is still running through the ordinary systems, and the world is sound', { tags: ['sim'] }, () => {
  for (const b of BACKGROUNDS) for (const s of fast ? [3] : [3, 7]) {
    const w = createWorld(s, NAME, { bg: b.id }), p = P(w);
    const bro = brotherOf(w), broRels = bro ? JSON.stringify(bro.rels) : '';
    // what a player would do in the first days: move the stock, work the shifts
    if (b.id === 'hustler') {
      const shop = Object.values(w.biz).find((x) => x.open && x.kind === 'pawnshop')!;
      const before = p.cash; performMove(w, { kind: 'pawn_goods', actor: p.id, biz: shop.id, label: '' });
      assert.equal(p.cash - before, 280); assert.equal(p.goods, 0);
    }
    if (b.id === 'wheelman') {
      const g = Object.values(w.biz).find((x) => x.open && x.kind === 'garage')!;
      const before = p.cash; performMove(w, { kind: 'sell_cars', actor: p.id, biz: g.id, label: '' });
      assert.equal(p.cash - before, 550); assert.equal(p.cars, 0);
    }
    if (b.id === 'union') {
      const shop = w.biz[p.job!.biz!];
      for (let i = 0; i < 3; i++) {
        const c0 = p.cash, b0 = shop.cash;
        const r = workShift(w, p);
        assert.equal(r.minutes, 240);
        assert.equal(p.cash - c0, b0 - shop.cash, 'every dollar of wages came out of the till');
        assert.ok(p.cash - c0 <= 75);
        advance(w, w.now + r.minutes);
      }
    }
    advance(w, w.now + 35 * DAY);
    clean(w, `${b.id} seed ${s} day 35`);
    assert.ok(p.alive);
    if (b.id === 'bookmaker') {
      const d = w.debts.find((x) => x.creditor === p.id)!;
      assert.ok((d.paid ?? 0) > 0 || d.missed > 0 || d.status !== 'active', 'the debt has been through the weekly cycle');
    }
    if (b.id === 'business') {
      const { b: shop } = stakesOf(w, p.id)[0] ?? { b: undefined };
      assert.ok(shop && (shop.acct ?? []).some((a) => (a.stakes ?? 0) > 0), 'the share has been paid out of the till in the shop’s own accounts');
    }
    if (b.id === 'wheelman') assert.ok(p.heat < 0.2, 'the heat has cooled on its own');
    if (bro) {
      assert.notEqual(JSON.stringify(bro.rels), broRels, 'his relationships have moved with his own life');
      assert.ok(!bro.alive || bro.familyId === p.familyId || bro.familyId === null || w.fam[bro.familyId!]);
    }
    console.log(`     ${b.id.padEnd(10)} seed ${s}: day-35 cash ${p.cash} (started ${bgOf(b.id)!.cash}), standing ${Math.round(p.standing)}, heat ${p.heat.toFixed(2)}`);
  }
});
