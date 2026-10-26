// Debts in the economy: a defaulted debt becomes a share of the debtor's business. Debtors' own plans are in
// agency/debts.test.ts, debt sit-downs in situations/sitdowns.test.ts. From the V73 suite.
import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { accrueVig, createDebt, payDebt, principalLeft, restructure, writeDown } from '../../core';
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
  // Stage 4: the terms the street keeps. The vig is charged on the principal still out, never on unpaid vig; a payment clears the
  // arrears before it touches the principal; terms can be renegotiated; a write-down takes the arrears first.
  ok('a loan of $1,000 at 5% a week: $50 of vig falls due each week, and paying only the vig leaves the principal where it was', () => {
    const w = newWorld(7); const [a, b] = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer).slice(0, 2); b.cash = 5000;
    const d = createDebt(w, a.id, b.id, 1000, 0.05, 'test', undefined, { payment: 50 });
    assert.equal(accrueVig(d), 50); assert.equal(d.balance, 1050);
    payDebt(w, d, 50); assert.equal(principalLeft(d), 1000); assert.equal(d.arrears, 0); assert.equal(d.balance, 1000);
    accrueVig(d); payDebt(w, d, 120); assert.equal(principalLeft(d), 930, 'what is paid beyond the vig comes off the principal');
    assert.equal(accrueVig(d), 47, 'and next week\'s vig is on the smaller principal');
  });
  ok('missed weeks add the vig to the arrears, never interest on interest', () => {
    const w = newWorld(7); const [a, b] = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer).slice(0, 2);
    const d = createDebt(w, a.id, b.id, 1000, 0.05, 'test');
    for (let i = 0; i < 6; i++) accrueVig(d);
    assert.equal(d.arrears, 300); assert.equal(principalLeft(d), 1000); assert.equal(d.balance, 1300);
  });
  ok('renegotiated terms change what each week costs from then on; a write-down takes the arrears first', () => {
    const w = newWorld(7); const [a, b] = Object.values(w.chars).filter((c) => c.alive && !c.isPlayer).slice(0, 2);
    const d = createDebt(w, a.id, b.id, 1000, 0.05, 'test');
    accrueVig(d); accrueVig(d); restructure(d, { rate: 0.03, payment: 60 });
    assert.equal(accrueVig(d), 30); assert.equal(d.weeklyPayment, 60);
    writeDown(w, d, 100); assert.equal(d.arrears, 30); assert.equal(principalLeft(d), 1000);
    assert.ok(writeDown(w, d, 5000), 'written off entirely, it is cleared'); assert.equal(d.status, 'paid');
  });
});

describe('nobody borrows from his own subordinates', { tags: ['unit'] }, () => {
  ok('a captain does not come to his soldier for money, nor ask a man beneath him; a soldier may still ask his captain', async () => {
    const { wontBorrowFrom } = await import('../../core');
    const { makeLoan } = await import('../../encounters');
    const w = newWorld(7), p = w.chars[w.playerId!];
    const cap = w.chars[p.bossId!];
    p.rank = 'soldier';
    assert.ok(wontBorrowFrom(cap, p), 'a captain above the player in his own family');
    assert.ok(!wontBorrowFrom(p, cap), 'the player may still go to his captain');
    const other = Object.values(w.chars).find((c) => c.alive && c.familyId && c.familyId !== p.familyId && c.rank === 'capo')!;
    assert.ok(!wontBorrowFrom(other, p), 'another family’s captain is a different matter');
    const before = w.enc.length;
    makeLoan(w, p, cap, 400);
    assert.equal(w.enc.length, before, 'no request for money from the man he answers to');
  });
});
