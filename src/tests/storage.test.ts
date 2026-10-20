import assert from 'node:assert';
import { describe, test as ok } from 'vitest';
import { writeSave, readSnaps, KEY, BUDGET, type StoreLike } from '../storage';

class Fake implements StoreLike {
  m = new Map<string, string>(); cap = Infinity; corrupt = false;
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) {
    const used = [...this.m].filter(([x]) => x !== k).reduce((a, [, y]) => a + y.length, 0);
    if (used + v.length > this.cap) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; }
    this.m.set(k, this.corrupt && k === KEY ? v.slice(1) : v);
  }
  removeItem(k: string) { this.m.delete(k); }
}
const blob = (n: number, c = 'a') => c.repeat(n);

describe('writeSave', () => {
  ok('normal saves succeed, snapshots every 3 days, at most 3, never beyond the budget', () => {
    const st = new Fake();
    for (let d = 0; d < 30; d++) { const r = writeSave(st, blob(400_000, String(d % 10)), d, 'day ' + d); assert.ok(r.ok, 'save ok'); assert.equal(st.getItem(KEY)!.length, 400_000); }
    const sn = readSnaps(st); assert.ok(sn.length >= 1 && sn.length <= 3, 'snapshots ' + sn.length);
    const used = [...st.m].reduce((a, [, y]) => a + y.length, 0); assert.ok(used <= BUDGET + 1000, 'within budget ' + used);
  });
  ok('a big save sheds snapshots oldest first, keeps the newest, and still lands', () => {
    const st = new Fake();
    for (let d = 0; d < 12; d += 3) writeSave(st, blob(900_000, 'x'), d, 'd' + d);
    const r = writeSave(st, blob(1_900_000, 'y'), 15, 'd15'); assert.ok(r.ok);
    assert.equal(st.getItem(KEY)!.length, 1_900_000);
  });
  ok('a quota failure is reported, and the last good save and newest snapshot are intact', () => {
    const st = new Fake(); const good = blob(500_000, 'g');
    assert.ok(writeSave(st, good, 0, 'd0').ok);
    st.cap = 600_000;
    const r = writeSave(st, blob(900_000, 'n'), 1, 'd1');
    assert.equal(r.ok, false, 'must report failure'); assert.ok(r.error);
    assert.equal(st.getItem(KEY), good, 'last good save untouched');
  });
  ok('read-back verification catches a write that reads back wrong, rolls it back and reports it', () => {
    const st = new Fake(); const good = blob(1000, 'g'); writeSave(st, good, 0, 'd0');
    st.corrupt = true; const r = writeSave(st, blob(2000, 'n'), 1, 'd1');
    assert.equal(r.ok, false);
    st.corrupt = false;
  });
  ok('storage that is blocked entirely is reported as unavailable', () => {
    const st: StoreLike = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
    const r = writeSave(st, 'x', 0, 'd'); assert.equal(r.ok, false); assert.equal(r.available, false);
  });
});
