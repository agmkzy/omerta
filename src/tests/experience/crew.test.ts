// Crew and authority (the made man's life): men come to a made man, his men's quarrels come to him to settle, and when one of them
// hits what the family looks after, his captain wants to know what he will do about it. Each decision is remembered by the men it
// touches, and a man who holds it against him works for him less well.
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { addFact, peek, rel } from '../../core';
import { authorityChoose, authorityWeek, quarrel } from '../../authority';
import { applyRank } from '../../rank';
import { mkJob } from '../../jobs';
import { behaviour } from '../../orders';
import { DAY, type Character, type World } from '../../types';
import { P } from '../helpers';
import { captain, familyMen, freeShops, worldFor } from './play';

/** The player made a soldier, nothing else changed. */
function made(seed: number) {
  const w = worldFor(seed), p = P(w);
  applyRank(w, p, 'soldier', { fact: false, career: false });
  p.standing = 50;
  return { w, p, cap: captain(w) };
}
const crew = (w: World, p: Character) => Object.values(w.chars).filter((c) => c.alive && c.bossId === p.id);
const enc = (w: World, kind: string) => w.enc.find((e) => e.kind === kind && e.status === 'open');

describe('men come to a made man', { tags: ['scenario'] }, () => {
  ok('made, with nobody under him, his captain gives him a man, and says so', () => {
    const { w, p, cap } = made(3);
    assert.equal(crew(w, p).length, 0);
    authorityWeek(w, p);
    assert.equal(crew(w, p).length, 1, 'he has a man');
    const e = enc(w, 'cometo')!;
    assert.equal(e.from, cap.id);
    authorityWeek(w, p);
    assert.equal(crew(w, p).length, 1, 'once');
  });
  ok('a man whose own man is inside asks to run with him, says why, and taken on answers to him', () => {
    for (const seed of [3, 7, 11, 13]) {
      const { w, p } = made(seed);
      p.cooldown['givenMan'] = w.now; // (past the first man)
      const a = familyMen(w, 'associate').find((c) => c.bossId && !w.chars[c.bossId].isPlayer);
      if (!a) continue;
      w.chars[a.bossId!].jailedUntil = w.now + 30 * DAY;
      for (let i = 0; i < 6 && !enc(w, 'cometo'); i++) { delete p.cooldown['cometo']; authorityWeek(w, p); }
      const e = enc(w, 'cometo');
      if (!e) continue;
      assert.match(e.lines.join(' '), /away|inside|gone|wasted|somebody|work/);
      const asker = w.chars[e.from!];
      authorityChoose(w, p, e, 'take');
      assert.equal(asker.bossId, p.id);
      return;
    }
    assert.fail('nobody came in four worlds');
  });
});

describe('his men’s quarrels come to him', { tags: ['scenario'] }, () => {
  const two = (seed: number) => {
    const { w, p } = made(seed);
    authorityWeek(w, p); // (the man he is given)
    const [a] = crew(w, p);
    const b = familyMen(w, 'associate').find((c) => c.id !== a.id && c.bossId !== p.id)!;
    b.bossId = p.id;
    return { w, p, a, b };
  };
  ok('backing one man is remembered by both', () => {
    const { w, p, a, b } = two(3);
    quarrel(w, p, a, b, 'money');
    const g0 = peek(b, p.id).grudge, t0 = peek(a, p.id).trust;
    authorityChoose(w, p, enc(w, 'quarrel')!, 'a');
    assert.ok(peek(a, p.id).trust > t0, 'the man he backed trusts him more');
    assert.ok(peek(b, p.id).grudge > g0, 'the other holds it against him');
    assert.ok(Object.values(w.facts).some((f) => f.actor === p.id && /settled it between/.test(f.text) && b.known[f.id]), 'and the crew saw it');
  });
  ok('left to themselves, a hot man can settle it his own way, and it costs the man who could have stopped it', () => {
    let hit = false;
    for (const seed of [3, 7, 11, 13, 17, 19]) {
      const { w, p, a, b } = two(seed);
      a.traits.violence = 0.95; a.traits.courage = 0.9; a.traits.sociability = 0.1;
      quarrel(w, p, a, b, 'words');
      const s0 = p.standing;
      authorityChoose(w, p, enc(w, 'quarrel')!, 'leave');
      if (Object.values(w.facts).some((f) => f.kind === 'beating' && f.victim === b.id && /nobody settled/.test(f.text))) { hit = true; assert.ok(p.standing < s0); break; }
    }
    assert.ok(hit, 'in six worlds, nobody settled it his own way');
  });
});

describe('he answers upstairs for his men', { tags: ['scenario'] }, () => {
  const robbed = (seed: number) => {
    const { w, p, cap } = made(seed);
    authorityWeek(w, p);
    const [man] = crew(w, p);
    const other = familyMen(w, 'soldier').find((c) => c.id !== p.id)!;
    const b = freeShops(w)[0];
    b.protection = { collectorId: other.id, familyId: p.familyId!, fee: 50, since: w.now } as never;
    const f = addFact(w, { kind: 'robbery', actor: man.id, victim: b.ownerId, business: b.id, amount: 300, text: `${man.name} robbed ${b.name}.`, district: b.district }, { witnesses: [cap.id] })!;
    cap.known[f.id] = { t: w.now, from: cap.id, knowsActor: true } as never;
    authorityWeek(w, p);
    return { w, p, cap, man, e: enc(w, 'answer') };
  };
  ok('his captain comes to him about it', () => {
    const { e, man, cap } = robbed(3);
    assert.ok(e, 'he was asked');
    assert.equal(e!.from, cap.id); assert.equal(e!.about, man.id);
  });
  ok('having the man roughed up satisfies the captain and is held against him by the man', () => {
    const { w, p, cap, man, e } = robbed(3);
    const c0 = peek(cap, p.id).trust, g0 = peek(man, p.id).grudge;
    authorityChoose(w, p, e!, 'rough');
    assert.ok(peek(cap, p.id).trust > c0);
    assert.ok(peek(man, p.id).grudge > g0);
    assert.ok(man.hurtUntil > w.now);
  });
  ok('standing up for him costs him with his captain and wins the man', () => {
    const { w, p, cap, man, e } = robbed(3);
    const c0 = peek(cap, p.id).trust, t0 = peek(man, p.id).trust;
    authorityChoose(w, p, e!, 'stand');
    assert.ok(peek(cap, p.id).trust < c0);
    assert.ok(peek(man, p.id).trust > t0);
  });
  ok('a man who holds it against him is likelier to skim what he carries for him', () => {
    const { w, p, man } = robbed(3);
    const j = mkJob(w, { kind: 'collect', giver: p.id, assignee: man.id, via: 'order', pay: 0, title: 'collect', brief: '', status: 'active' });
    const skims = (g: number) => { rel(man, p.id).grudge = g; let n = 0; for (let i = 0; i < 600; i++) if (behaviour(w, j, man) === 'skim') n++; return n; };
    const easy = skims(0), sore = skims(0.8);
    assert.ok(sore > easy * 1.2, `skims: ${easy} without a grudge, ${sore} with one`);
  });
});
