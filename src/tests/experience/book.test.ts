// The book, run (Phase 1.4): a player's bookmaking operation brings him decisions. A big bet he can carry, split or lay off; a
// winner bigger than his drawer; another book on his ground; the precinct's envelope. Money is conserved through all of it, and each
// answer is remembered where it should be (favours, debts, regard, family tension, the raid odds).
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { advance } from '../../engine';
import { startOp } from '../../rackets';
import { betDue, bookChoose, bookWeek } from '../../book';
import { moneyTotal } from '../../goals';
import { applyRank } from '../../rank';
import { DAY, type World } from '../../types';
import { P } from '../helpers';
import { worldFor } from './play';

function withBook(seed: number) {
  const w = worldFor(seed), p = P(w);
  advance(w, w.now + 21 * DAY); // (three weeks of the world: other men have opened their books)
  applyRank(w, p, 'soldier', { fact: false, career: false });
  p.cash = 5000;
  startOp(w, p, 'bookie', p.district, null);
  const op = w.ops.find((o) => o.owner === p.id && o.kind === 'bookie')!;
  // (a book with a season behind it: it has made money enough for the precinct to notice, and it has regulars, some on a winning run
  // with money in their pockets: October 2026, the book's decisions come from its people, not a roll of the week)
  op.weeks = 5; op.total = 4000;
  const gs = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer && c.traits.vice >= 0.5 && c.jailedUntil <= w.now && c.bossId !== p.id).sort((a, b) => (a.id < b.id ? -1 : 1)).slice(0, 4);
  op.links = gs.map((c) => { c.cash = Math.max(c.cash, 1500); return { id: c.id, role: 'regular' as const, since: w.now, bal: 300 }; });
  return { w, p, op };
}
/** Weeks of the book until a decision of this kind comes up. */
function until(w: World, kind: string, f: () => void) {
  for (let i = 0; i < 80 && !w.enc.some((e) => e.kind === kind && e.status === 'open'); i++) { delete P(w).cooldown[({ bigbet: 'book:big', rivalbook: 'book:rival', pad: 'book:pad' } as Record<string, string>)[kind] ?? '']; for (const c of Object.values(w.chars)) for (const k of Object.keys(c.cooldown)) if (k.startsWith('bet:')) delete c.cooldown[k]; for (const e of w.enc) if (e.status === 'open' && ['bigbet', 'rivalbook', 'pad'].includes(e.kind) && e.kind !== kind) e.status = 'done'; f(); }
  return w.enc.find((e) => e.kind === kind && e.status === 'open');
}

describe('the player’s book brings him decisions', { tags: ['scenario'] }, () => {
  ok('a big bet: taken whole, it is settled at the race, and the money balances whichever way it goes', () => {
    const { w, p, op } = withBook(3);
    const e = until(w, 'bigbet', () => bookWeek(w, op, p));
    assert.ok(e, 'no big bet in 80 weeks');
    const m0 = moneyTotal(w);
    bookChoose(w, p, e!, 'take');
    assert.equal(moneyTotal(w), m0, 'the stake changes hands, nothing more');
    const q = w.pending!.find((x) => x.kind === 'bet')!;
    betDue(w, q);
    assert.equal(moneyTotal(w), m0, 'the race pays out what it should, nothing more');
    assert.ok(Object.values(w.facts).some((f) => /came in|ran fourth/.test(f.text)), 'the race was run');
  });
  ok('laid off, another book carries it, and is owed the courtesy', () => {
    for (const seed of [3, 7, 11, 13]) {
      const { w, p, op } = withBook(seed);
      const e = until(w, 'bigbet', () => bookWeek(w, op, p));
      if (!e?.opts.some((o) => o.code === 'layoff')) continue;
      bookChoose(w, p, e, 'layoff');
      assert.ok(w.favours.some((f) => f.to === p.id && /carrying a bet/.test(f.what)), 'the favour');
      return;
    }
    assert.fail('no book to lay off with in four worlds');
  });
  ok('a winner the drawer can’t cover is a decision, and stalling a man from another family raises the families’ tension', () => {
    for (const seed of [3, 7, 11, 13, 17, 19, 23, 29]) {
      const { w, p, op } = withBook(seed);
      const e = until(w, 'bigbet', () => bookWeek(w, op, p));
      if (!e) continue;
      bookChoose(w, p, e, 'take');
      p.cash = 0; // (spent before Saturday)
      betDue(w, w.pending!.find((x) => x.kind === 'bet')!);
      const c = w.enc.find((x) => x.kind === 'cantpay' && x.status === 'open');
      if (!c) continue;
      const g = w.chars[c.from!];
      const t0 = g.familyId && p.familyId ? (w.fam[p.familyId].tension[g.familyId] ?? 0) : 0;
      bookChoose(w, p, c, 'stall');
      assert.ok(w.debts.some((d) => d.creditor === g.id && d.debtor === p.id), 'he is owed it');
      assert.ok((g.rels[p.id]?.grudge ?? 0) > 0.2, 'and holds it against him');
      if (g.familyId && g.familyId !== p.familyId) assert.ok(w.fam[p.familyId!].tension[g.familyId] > t0, 'between the families too');
      return;
    }
    assert.fail('the favourite never came in when the drawer was empty, in eight worlds');
  });
  ok('paying the precinct makes a raid much rarer', () => {
    const { w, p, op } = withBook(3);
    op.links = []; // (no regular on a winning run to come first)
    const e = until(w, 'pad', () => bookWeek(w, op, p));
    assert.ok(e, 'the precinct never came');
    bookChoose(w, p, e!, 'pay');
    assert.ok((op.pad ?? 0) > w.now);
  });
});
