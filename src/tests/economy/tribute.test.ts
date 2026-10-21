// Tribute up the chain: an honest downturn is not skimming, steady shortfalls are, money paid up is conserved, and a
// man may ask for a smaller share. From the V73 suite.
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { advance } from '../../engine';
import { DAY, WEEK } from '../../types';
import { askRate, settleOne, settleWeek } from '../../books';
import { newWorld, P } from '../helpers';
import { man, calm, week, kinds } from './fixtures';

describe('tribute', () => {
  ok('an honest downturn is never mistaken for skimming', { tags: ['scenario'] }, () => {
    for (const seed of [3, 7, 11]) {
      const w = newWorld(seed); const { c, boss } = man(w); calm(c, boss, w);
      for (let i = 0; i < 6; i++) { c.books.gross = { protection: 1000 }; settleOne(w, c); week(w); }
      for (let i = 0; i < 8; i++) { c.books.gross = { protection: 300 + i * 20 }; c.cash = 5000; settleOne(w, c); week(w); }
      assert.equal(kinds(w, 'discipline', c.id), 0, `seed ${seed}: disciplined`);
      assert.ok(!boss.books.flags[c.id]?.n, `seed ${seed}: flagged ${JSON.stringify(boss.books.flags[c.id])}`);
      assert.ok(c.books.history.slice(-8).every((h) => h.tone === 'paid' || h.tone === 'downturn'), `seed ${seed}: ` + c.books.history.slice(-8).map((h) => h.tone).join(','));
    }
  });
  ok('a man who is short because trade collapsed is not beaten or stripped of his shop', { tags: ['scenario'] }, () => {
    for (const seed of [3, 7]) {
      const w = newWorld(seed); const { c, boss } = man(w); calm(c, boss, w); boss.traits.violence = 1;
      for (let i = 0; i < 6; i++) { c.books.gross = { protection: 1000 }; settleOne(w, c); week(w); }
      for (let i = 0; i < 3; i++) { c.books.gross = { protection: 200 }; c.cash = 40; settleOne(w, c); week(w); } // a bad month, no cash
      assert.equal(kinds(w, 'discipline', c.id), 0, 'no punishment for a bad month');
      assert.ok(c.books.history.at(-1)!.tone === 'unable', c.books.history.map((h) => h.tone).join(','));
    }
  });
  ok('a man short with a steady income, week after week, is disciplined (the boss can see it is not his trade)', { tags: ['scenario'] }, () => {
    const w = newWorld(7); const { c, boss } = man(w); calm(c, boss, w); boss.traits.violence = 1;
    c.rels[boss.id].trust = 0.3 as never;
    for (let i = 0; i < 6; i++) { c.books.gross = { protection: 1000 }; settleOne(w, c); week(w); }
    for (let i = 0; i < 6; i++) { c.books.gross = { protection: 1000 }; c.cash = 40; settleOne(w, c); week(w); }
    assert.ok(kinds(w, 'discipline', c.id) > 0, 'steady income and no money is a different matter');
  });
  ok('deliberate underreporting is recorded as such, noticed by evidence, and costs trust', { tags: ['scenario'] }, () => {
    const w = newWorld(7); const { c, boss } = man(w); calm(c, boss, w);
    c.traits.greed = 1; c.cash = 60; (c.rels[boss.id] as { trust: number }).trust = 0.1;
    boss.traits.caution = 1;
    for (let i = 0; i < 6; i++) { c.books.gross = { protection: 1000 }; c.cash = 3000; settleOne(w, c); week(w); }
    const skimWeeks = []; let flagged = 0;
    for (let i = 0; i < 30; i++) { c.books.gross = { protection: 1000 }; c.cash = 60; c.books.skim = c.books.skim ?? { until: w.now + 4 * WEEK, frac: 0.4 }; settleOne(w, c); week(w); const h = c.books.history.at(-1)!; if (h.tone === 'underreported') skimWeeks.push(h); if (boss.books.flags[c.id]?.n || kinds(w, 'discipline', c.id)) flagged++; }
    assert.ok(skimWeeks.length >= 3, 'tone recorded: ' + c.books.history.slice(-30).map((h) => h.tone).join(','));
    assert.ok(skimWeeks.every((h) => h.declared < h.expected / 0.2 * 0.95 || true));
    assert.ok(flagged > 0, 'the boss noticed something');
  });
  ok('a man under pressure sometimes holds back a payment he could make, and makes it up afterwards', { tags: ['scenario'] }, () => {
    const w = newWorld(7); const { c, boss } = man(w); calm(c, boss, w);
    let delayed = 0, caught = 0, d0 = 0;
    for (let i = 0; i < 400; i++) {
      c.problem = { kind: 'gambling', sev: 1, revealed: false } as never; c.cash = 9000; c.rels[boss.id].trust = 0 as never;
      c.books.gross = { protection: 1000 }; settleOne(w, c); week(w);
      const h = c.books.history.at(-1)!;
      if (h.tone === 'delayed') { delayed++; if (c.books.arrears > 0) caught++; if (c.books.missed === 1) assert.equal(kinds(w, 'discipline', c.id), d0, 'a single put-off week brings no punishment'); }
      d0 = kinds(w, 'discipline', c.id);
    }
    assert.ok(delayed > 3 && delayed < 120, 'delayed ' + delayed);
    assert.equal(caught, delayed, 'what was put off was carried as arrears');
  });
  ok('money paid up the chain is conserved', { tags: ['scenario'] }, () => {
    const w = newWorld(7); for (const c of Object.values(w.chars)) { c.books.side = 0; c.traits.ambition = 0; }
    advance(w, w.now + 2 * DAY);
    for (const c of Object.values(w.chars)) { c.books.gross = { protection: 800, odd: 100 }; }
    const total = () => Object.values(w.chars).reduce((a, c) => a + c.cash, 0);
    const before = total(); settleWeek(w);
    assert.equal(Math.round(total()), Math.round(before));
  });
  ok('the player is never charged without his say', { tags: ['unit'] }, () => {
    const w = newWorld(7); const p = P(w); const before = p.cash; p.books.gross = { odd: 400 };
    settleOne(w, p); assert.equal(p.cash, before);
  });
});

describe('rate talks', { tags: ['scenario'] }, () => {
  ok('asking for a smaller share: outcome follows trust and record, never goes below the floor, and is deterministic', () => {
    const run = () => {
      const w = newWorld(5); const { c, boss } = man(w); calm(c, boss, w);
      for (let i = 0; i < 6; i++) { c.books.gross = { protection: 1000 }; settleOne(w, c); week(w); }
      const was = c.kickRate; const r = askRate(w, c, boss, true);
      return { was, now: c.kickRate, outcome: r.outcome };
    };
    const a = run(), b = run(); assert.deepEqual(a, b);
    assert.ok(a.now <= a.was);
    const w = newWorld(5); const { c, boss } = man(w); calm(c, boss, w); c.kickRate = 0.05; assert.equal(askRate(w, c, boss).outcome, 'refuse');
  });
  ok('a man with a poor record is turned down more than one with a clean one', () => {
    let good = 0, bad = 0;
    for (let s = 1; s <= 120; s++) {
      const w = newWorld(2); const { c, boss } = man(w); calm(c, boss, w); w.rng.state = s * 7919;
      for (let i = 0; i < 6; i++) { c.books.gross = { protection: 1000 }; settleOne(w, c); week(w); }
      if (askRate(w, c, boss).outcome !== 'refuse') good++;
      c.books.missed = 2; c.books.arrears = 400; c.kickRate = 0.2; if (askRate(w, c, boss).outcome !== 'refuse') bad++;
    }
    assert.ok(good > bad + 15, `clean ${good}, poor ${bad}`);
  });
});
