// The record: business cash changes only through bizMove, every balance chains to the next, summaries come from the
// transactions, and the economy is deterministic and survives a save. From the V73 suite.
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { SEEDS } from '../modes';
import { SCHEMA, advance, deserialize, serialize } from '../../engine';
import { DAY, WEEK, Business } from '../../types';
import { audit } from '../../consistency';
import { bizBetween, bizMove, bizWeek, ledgerCheck, owedOf, wkOf } from '../../econ';
import { newWorld, P } from '../helpers';
import { shop } from './fixtures';

describe('the record', () => {
  ok('business cash can only change through the record (type-level)', { tags: ['unit'] }, () => {
    const w = newWorld(7); const b = Object.values(w.biz)[0];
    // @ts-expect-error cash is readonly outside econ.ts
    void (() => { b.cash = 5; });
    const before = b.cash; bizMove(w, b, 125, 'aid', 'x'); assert.equal(b.cash, before + 125);
    assert.equal(w.txns!.at(-1)!.bal, b.cash); assert.equal(w.txns!.at(-1)!.d, 125);
  });
  ok('the record chains: 28 days of play, every balance follows from the one before and ends at the real cash', { tags: ['sim'] }, () => {
    const w = newWorld(7); advance(w, w.now + 28 * DAY);
    assert.deepEqual(ledgerCheck(w), []);
    assert.ok(w.txns!.length > 50, 'transactions were written');
  });
  ok('ledgerCheck notices a hand-edited balance', { tags: ['scenario'] }, () => {
    const w = newWorld(7); advance(w, w.now + 10 * DAY); const b = Object.values(w.biz).find((x) => w.txns!.some((t) => t.b === x.id))!;
    (b as { cash: number }).cash += 77;
    assert.ok(ledgerCheck(w).length > 0);
  });
  ok('summaries come from the record: a struck week equals the sum of its transactions', { tags: ['scenario'] }, () => {
    const w = newWorld(7); advance(w, w.now + 5 * WEEK);
    const b = shop(w); const row = b.acct!.at(-1)!; const wk = row.wk; assert.ok(row, 'week was struck');
    const sum = bizBetween(w, b.id, row.t - WEEK, row.t);
    void wkOf;
    assert.equal(row.revenue, sum.revenue); assert.equal(row.expenses, sum.expenses); assert.equal(row.net, sum.net);
    assert.equal(bizWeek(w, b, wk).net, row.net);
    assert.equal(sum.net, row.net, 'the transactions of that week still sum to the struck row');
    assert.ok(b.acct!.length <= 8, 'bounded');
  });
  ok('every week of a business\'s accounts closes where the next one opens', { tags: ['sim'] }, () => {
    const w = newWorld(7); advance(w, w.now + 6 * WEEK);
    for (const b of Object.values(w.biz)) {
      const a = b.acct ?? [];
      for (let i = 1; i < a.length; i++) if (a[i].wk === a[i - 1].wk + 1) assert.equal(a[i - 1].close + a[i].net, a[i].close, `${b.name} wk${a[i].wk}`);
    }
  });
  ok('no duplicate revenue: one weekly revenue entry per business per week', { tags: ['sim'] }, () => {
    const w = newWorld(7); advance(w, w.now + 4 * WEEK);
    const seen = new Map<string, number>();
    for (const t of w.txns!) if (t.k === 'revenue' && t.d > 200 && w.biz[t.b].kind !== 'casino') { const key = t.b + ':' + Math.floor((t.t + 1) / WEEK); seen.set(key, (seen.get(key) ?? 0) + 1); }
    for (const [k, n] of seen) assert.ok(n <= 1, `${k} has ${n} revenue entries`);
  });
  ok('a loaded save keeps merging into the same entries as one that never stopped', { tags: ['determinism'] }, () => {
    const a = newWorld(7); const b = Object.values(a.biz).find((x) => x.kind === 'casino')!;
    bizMove(a, b, 50, 'gamble'); bizMove(a, b, -20, 'gamble');
    const l = deserialize(serialize(a));
    bizMove(a, b, 30, 'gamble'); bizMove(l, l.biz[b.id], 30, 'gamble');
    assert.equal(serialize(a), serialize(l)); assert.equal(a.txns!.filter((t) => t.b === b.id && t.k === 'gamble').length, 1);
  });
  ok('same seed, same economy', { tags: ['determinism'] }, () => {
    const a = newWorld(4), b = newWorld(4); advance(a, a.now + 6 * WEEK); advance(b, b.now + 6 * WEEK);
    assert.equal(serialize(a), serialize(b));
  });
});

describe('the record: compat', { tags: ['compat'] }, () => {
  ok('a V72 save loads: stakes move onto the businesses, lateness becomes money owed', () => {
    const w = newWorld(9); advance(w, w.now + 20 * DAY); const p = P(w);
    const b = shop(w); const b2 = Object.values(w.biz).find((x) => x.id !== b.id && x.open && x.kind !== 'casino')!;
    b.protection!.late = 2; delete b.protection!.owed; delete b.protection!.why;
    const o = JSON.parse(serialize(w)); o.schema = 3; delete o.txns;
    o.path = o.path ?? {}; o.path.stakes = [{ biz: b2.id, share: 0.25, since: 123 }];
    for (const x of Object.values(o.biz) as Business[]) { delete x.acct; delete x.rivals0; }
    const l = deserialize(JSON.stringify(o));
    assert.equal(l.schema, SCHEMA); assert.equal(l.path!.stakes, undefined);
    assert.deepEqual(l.biz[b2.id].stakes!.map((s) => [s.holder, s.share, s.since]), [[p.id, 0.25, 123]]);
    assert.equal(l.biz[b.id].protection!.owed, b.protection!.fee * 2);
    advance(l, l.now + 6 * WEEK);
    assert.deepEqual(ledgerCheck(l), []); assert.deepEqual(audit(l), []);
    assert.equal(serialize(deserialize(serialize(l))), serialize(l));
  });
});

// ------------------------------------------------------------------ long runs
function stable(seed: number) {
  const w = newWorld(seed); const days = 180; let worst = 0, chain = '';
  const failed0 = new Set<string>();
  for (let d = 1; d <= days; d++) {
    advance(w, w.now + DAY);
    if (d % 7 === 0) { const c = ledgerCheck(w); if (c.length) { worst = Math.max(worst, c.length); chain ||= `d${d}: ${c[0]}`; } }
    for (const b of Object.values(w.biz)) if (!b.open) failed0.add(b.id);
  }
  const a = audit(w);
  const tones: Record<string, number> = {}; let weeks = 0;
  for (const c of Object.values(w.chars)) for (const h of c.books.history) { tones[h.tone ?? 'none'] = (tones[h.tone ?? 'none'] ?? 0) + 1; weeks++; }
  const owners = Object.values(w.biz).filter((b) => b.owners?.length).length, mg = Object.values(w.biz).filter((b) => b.managerId).length;
  const arrears = Object.values(w.biz).filter((b) => owedOf(b) > 0).length;
  const stakes = Object.values(w.biz).reduce((n, b) => n + (b.stakes?.length ?? 0), 0);
  console.log(`seed ${seed}: ${days}d  record mismatches=${worst} ${chain}  audit issues=${a.length}  closed=${failed0.size}/${Object.keys(w.biz).length}  managers=${mg} transfers=${owners} stakes=${stakes} shops behind=${arrears}`);
  console.log(`   tribute weeks by cause (${weeks}): ${JSON.stringify(tones)}  txns held=${w.txns!.length}`);
  assert.equal(worst, 0, chain); assert.deepEqual(a, []);
}

function roundtrip(seed: number) {
  const a = newWorld(seed); advance(a, a.now + 60 * DAY);
  const s = serialize(a), c = deserialize(s);
  assert.equal(serialize(c), s, 'load + resave changes nothing');
  advance(a, a.now + 30 * DAY); advance(c, c.now + 30 * DAY);
  assert.equal(serialize(a) === serialize(c), true, 'a loaded save continues identically');
  assert.deepEqual(ledgerCheck(c), []);
  console.log(`seed ${seed}: round trip OK (${(s.length / 1024).toFixed(0)} KB at day 60; txns ${a.txns!.length})`);
}

describe('the record: long runs', { tags: ['sim', 'slow'] }, () => {
  ok.each(SEEDS)('stable %i', stable);
});

describe('the record: long round trips', { tags: ['determinism', 'slow'] }, () => {
  ok.each(SEEDS)('roundtrip %i', roundtrip);
});
