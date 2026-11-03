import assert from 'node:assert/strict';
import fc from 'fast-check';
import { describe, test } from 'vitest';
import { ReplacedCastError, cast, castOf } from '../../../src/overhaul/character/cast';
import { createCharacter } from '../../../src/overhaul/character/character';
import { WORLD, assertTransfer, auditCash, type Transfer } from '../../../src/overhaul/character/transfers';

const opening = (to: string, amount: number, at = 0): Transfer => ({ from: WORLD, to, amount, why: 'opening balance', at });
const withCash = (id: string, cash: number) => createCharacter({ id, name: id, inventory: { cash } });

describe('assertTransfer', { tags: ['unit'] }, () => {
  test('accepts a positive whole amount between two parties, with a reason and a time', () => {
    assert.doesNotThrow(() => assertTransfer(opening('sam', 100)));
  });

  test('refuses anything else', () => {
    for (const bad of [
      { ...opening('sam', 0) }, { ...opening('sam', -5) }, { ...opening('sam', 2.5) },
      { ...opening('sam', 5), to: WORLD }, { ...opening('sam', 5), why: '' }, { ...opening('sam', 5), at: -1 },
    ])
      assert.throws(() => assertTransfer(bad), RangeError, JSON.stringify(bad));
  });
});

describe('auditCash', { tags: ['unit'] }, () => {
  test('passes when every character’s cash is what the transfers give them', () => {
    const transfers = [opening('sam', 100), { from: 'sam', to: 'rico', amount: 30, why: 'a debt', at: 60 }];
    assert.doesNotThrow(() => auditCash([withCash('sam', 70), withCash('rico', 30)], transfers));
    assert.doesNotThrow(() => auditCash([withCash('joe', 0)], []));
  });

  test('fails when cash and transfers disagree', () => {
    assert.throws(() => auditCash([withCash('sam', 50)], []), RangeError);
    assert.throws(() => auditCash([withCash('sam', 50)], [opening('sam', 40)]), RangeError);
  });

  test('fails when someone pays more than they have at the time, even if it comes back later', () => {
    const transfers = [{ from: 'sam', to: 'rico', amount: 10, why: 'early', at: 0 }, opening('sam', 10, 5)];
    assert.throws(() => auditCash([withCash('sam', 0), withCash('rico', 10)], transfers), RangeError);
  });

  test('fails for a party not in the cast, a character called world, a transfer out of time order, or an invalid one', () => {
    assert.throws(() => auditCash([withCash('sam', 10)], [opening('sam', 10), { from: 'sam', to: 'joe', amount: 5, why: 'x', at: 1 }]), RangeError);
    assert.throws(() => auditCash([withCash(WORLD, 0)], []), RangeError);
    assert.throws(() => auditCash([withCash('sam', 15)], [opening('sam', 10, 60), opening('sam', 5, 30)]), RangeError);
    assert.throws(() => auditCash([withCash('sam', 0)], [opening('sam', 0)]), RangeError);
  });
});

describe('cash in a cast', { tags: ['unit'] }, () => {
  const everyone = () => cast({ characters: [{ id: 'sam', name: 'Sam' }, { id: 'rico', name: 'Rico' }] });

  test('comes from the world and moves between characters, every transfer recorded', () => {
    const funded = everyone().transfer({ from: WORLD, to: 'sam', amount: 120, why: 'opening balance', now: 0 });
    const paid = funded.character('sam').pay(funded.character('rico'), 50, { why: 'a debt', now: 60 });
    const spent = paid.character('rico').pay(WORLD, 20, { why: 'dinner', now: 90 });
    assert.deepEqual(spent.characters.map((c) => [c.id, c.cash]), [['sam', 70], ['rico', 30]]);
    assert.deepEqual(spent.data.transfers, [
      { from: WORLD, to: 'sam', amount: 120, why: 'opening balance', at: 0 },
      { from: 'sam', to: 'rico', amount: 50, why: 'a debt', at: 60 },
      { from: 'rico', to: WORLD, amount: 20, why: 'dinner', at: 90 },
    ]);
  });

  test('shares the records of characters the transfer does not touch', () => {
    const before = cast({ characters: [{ id: 'sam', name: 'Sam' }, { id: 'rico', name: 'Rico' }, { id: 'joe', name: 'Joe' }] });
    const after = before.transfer({ from: WORLD, to: 'sam', amount: 5, why: 'found it', now: 0 });
    assert.equal(after.data.characters[1], before.data.characters[1]);
    assert.equal(after.data.characters[2], before.data.characters[2]);
  });

  test('cannot be set directly: a cast whose cash disagrees with its transfers is refused', () => {
    assert.throws(() => cast({ characters: [{ id: 'sam', name: 'Sam', inventory: { cash: 100 } }] }), RangeError);
    assert.throws(() => castOf({ format: 3, characters: [withCash('sam', 5)], transfers: [], facts: [], nextId: 1 }), RangeError);
  });

  test('refuses paying more than the payer has, a party not in the cast, a time before the last transfer, or an invalid transfer', () => {
    const funded = everyone().transfer({ from: WORLD, to: 'sam', amount: 10, why: 'opening balance', now: 100 });
    const sam = funded.character('sam');
    assert.throws(() => sam.pay(funded.character('rico'), 11, { why: 'too much', now: 120 }), RangeError);
    assert.throws(() => funded.transfer({ from: 'sam', to: 'joe', amount: 5, why: 'stranger', now: 120 }), RangeError);
    assert.throws(() => sam.pay(WORLD, 5, { why: 'too early', now: 50 }), RangeError);
    assert.throws(() => sam.pay(WORLD, 5, { why: '', now: 120 }), RangeError);
    assert.throws(() => sam.pay(cast({ characters: [{ id: 'joe', name: 'Joe' }] }).character('joe'), 5, { why: 'elsewhere', now: 120 }), RangeError);
    assert.equal(funded.current, true);
  });

  test('payments from a replaced cast are refused', () => {
    const start = everyone().transfer({ from: WORLD, to: 'sam', amount: 10, why: 'opening balance', now: 0 });
    const sam = start.character('sam');
    sam.pay(WORLD, 1, { why: 'a coffee', now: 10 });
    assert.throws(() => sam.pay(WORLD, 1, { why: 'another coffee', now: 20 }), ReplacedCastError);
  });

  test('is private: anyone present sees none of it', () => {
    const funded = everyone().transfer({ from: WORLD, to: 'sam', amount: 10, why: 'opening balance', now: 0 });
    assert.equal('cash' in funded.character('sam').seenBy(funded.character('rico')), false);
  });
});

describe('cash in a cast', { tags: ['property'] }, () => {
  test('is conserved: whatever valid payments are made, the characters’ cash adds up to what came from the world', () => {
    const pay = fc.record({ from: fc.integer({ min: 0, max: 2 }), to: fc.integer({ min: 0, max: 2 }), amount: fc.integer({ min: 1, max: 60 }) });
    fc.assert(
      fc.property(fc.array(pay, { maxLength: 25 }), (payments) => {
        const ids = ['a', 'b', 'c'];
        let c = cast({ characters: ids.map((id) => ({ id, name: id })) }).transfer({ from: WORLD, to: 'a', amount: 100, why: 'opening balance', now: 0 });
        payments.forEach((p, i) => {
          const from = c.character(ids[p.from]!);
          if (p.from !== p.to && from.cash >= p.amount) c = from.pay(c.character(ids[p.to]!), p.amount, { why: 'a payment', now: i + 1 });
        });
        assert.equal(c.characters.reduce((sum, x) => sum + x.cash, 0), 100);
        assert.ok(c.characters.every((x) => x.cash >= 0));
      }),
    );
  });
});
