// Debts in the economy: a defaulted debt becomes a share of the debtor's business. Debtors' own plans are in
// agency/debts.test.ts, debt sit-downs in situations/sitdowns.test.ts. From the V73 suite.
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { createDebt } from '../../core';
import { bizMove, businessWeek, seizeShare, stakesOf } from '../../econ';
import { newWorld } from '../helpers';
import { shop } from './fixtures';

describe('debts', { tags: ['scenario'] }, () => {
  ok('a defaulted debt gives the lender a share of the debtor\'s business, which pays the debt down', () => {
    const w = newWorld(7); const b = shop(w); const o = w.chars[b.ownerId]; const lender = Object.values(w.chars).find((c) => c.rank === 'soldier' && c.alive && !c.isPlayer)!;
    const d = createDebt(w, lender.id, o.id, 1000, 0.05, 'test'); d.status = 'defaulted';
    seizeShare(w, d);
    assert.equal(stakesOf(w, lender.id).length, 1); const before = d.balance;
    b.income = 2000; bizMove(w, b, 3000, 'aid', 'x'); const l0 = lender.cash; businessWeek(w);
    assert.ok(lender.cash > l0, 'the lender is paid'); assert.ok(d.balance < before, 'and the debt comes down');
  });
});
